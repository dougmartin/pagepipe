options = require 'commander'
express = require 'express'
basicAuth = require 'basic-auth'
http = require 'http'
split = require 'split'
dateformat = require 'dateformat'
favicon = require 'serve-favicon'

# use express for the server - this is probably overkill but
# if makes the code a lot shorter!
app = express()

# add favicon.ico
app.use favicon "#{__dirname}/favicon.ico"

# get the options
options
  .version '1.0.0'
  .option '-p, --port <n>', 'server port [10371]', '10371'
  .option '-c, --color <#rgb>', 'text color for page [#000]', '#000'
  .option '-b, --bgcolor <#rgb>', 'background color for page [#fff]', '#fff'
  .option '-f, --font <name>', 'font family for page [monospace]', 'monospace'
  .option '-m, --margin <n>', 'margin around output in page [1em]', '1em'
  .option '-t, --title <text>', 'title tag and text for page [pagepipe]', 'pagepipe'
  .option '-i, --interface <ip>', 'server interface [localhost]', 'localhost'
  .option '-a, --auth <username>/<password>', 'require basic auth to view page'
  .option '-r, --realm <name>', 'realm name for basic auth [pagepipe]', 'pagepipe'
  .option '-z, --zombie', 'stays alive after stdin is exhausted'
  .option '-o, --output', 'pipes to stdout'
  .option '-n, --numlines <n>', 'size of line buffer, 0 is unlimited [0]', '0'
  .option '-d, --datestamp', 'prefixes datestamps to all lines'
  .option '-l, --lines', 'prefixes 1-based line numbers'
  .option '-j, --json', 'sends event-source data as json'
options.on '--help', ->
  console.log '  Created by Doug Martin, http://dougmart.in/pagepipe'
options.parse process.argv

# convert the numlines string to an int
options.numlines = parseInt options.numlines, 10
  
# if authentication is needed parse the username/password  
[useAuth, auth] = if not options.auth then [false, null] else
  [name, pass] = options.auth.split '/'
  if not pass?.length > 0
    console.error "auth option must be in the form of <username>/<password>"
    process.exit 1
  [true, {name: name, pass: pass}]

# add authentication middleware if needed
if useAuth
  app.use (req, res, next) ->
    user = basicAuth req
    if not user or user.name isnt auth.name or user.pass isnt auth.pass
      res.set 'WWW-Authenticate', ['Basic realm="', options.realm, '"'].join ''
      return res.sendStatus 401
    next()
    
# create the line formatter
formatLine = (line, lineNumber) ->
  date = if options.datestamp then dateformat(line.date, 'isoDateTime') else null
  if options.json 
    json = {}
    json.line = lineNumber if options.lines
    json.date = date if options.datestamp
    json.text = line.text
    JSON.stringify json
  else 
    prefixes = []
    prefixes.push lineNumber if options.lines
    prefixes.push "[#{date}]" if options.datestamp
    prefix = if prefixes.length > 0 then "#{prefixes.join ' '} " else ''
    "#{prefix}#{line.text}"
  
# homepage html - this could be done in an external template too but I think it is clearer to do it inline
homepage = """
  <!DOCTYPE html>
  <html>
    <head>
      <title>#{options.title}</title>
      <style>
        html, body {
          margin: 0;
          padding: 0;
        }
        body {
          color: #{options.color};
          background-color: #{options.bgcolor};
          font-family: #{options.font};
          font-size: 1em;
        }
        div#header {
          top: 0;
          left: 0;
          right: 0;
        }
        div#title {
          padding: 0.25em 0.5em;
        }
        div#status {
          float: right;
          padding: 0.25em 0.5em;
        }
        div#output {
          position: absolute;
          top: 1.5em;
          left: 0;
          bottom: 0;
          right: 0;
          overflow: auto;
        }
        pre#innerOutput {
          margin: #{options.margin};
          padding: 0;
          font-family: #{options.font};
          font-size: 1em;
        }
      </style>
    </head>
    <body>
      <div id='header'><div id='status'>Loading...</div><div id='title'>#{options.title}</div></div>
      <div id='output'><pre id='innerOutput'></pre></div>
      <script>
        var outputDiv = document.getElementById('innerOutput'),
            statusDiv = document.getElementById('status'),
            eventSource = window.EventSource ? new EventSource('event-source') : null,
            bytesReceived = 0,
            setStatus;
            
        setStatus = function (newStatus) { 
          var html = [newStatus]; 
          if (bytesReceived > 0) {
            html.push(' (', bytesReceived, ' bytes)');
          }
          statusDiv.innerHTML = html.join('');
        };
        
        if (!eventSource) {
          outputDiv.innerHTML = 'Sorry, your browser does not support EventSource which is needed to get the pagepipe output.';
          setStatus('Error!');
        }
        else {
          eventSource.addEventListener('line', function(e) {
            outputDiv.appendChild(document.createTextNode(e.data));
            outputDiv.appendChild(document.createElement('br'));
            bytesReceived += e.data.length;
            setStatus('Streaming');
          }, false);
          eventSource.addEventListener('done', function() {
            setStatus('Done');
            eventSource.close();
          }, false);
          eventSource.addEventListener('open', function() {
            setStatus('Opened');
          }, false);
          eventSource.addEventListener('error', function() {
            setStatus('Disconnected!');
          }, false);
        }
      </script>
    </body>
  </html>
"""

# variables used in both processing stdin and sending it out to the page
startLineIndex = 0    # increases to match start of buffer when numlines is used
lines = []            # line buffer
pipeClosed = false    # flag to mark when stdin in closed

# split stdin coming in and push each line on the line queue
process.stdin
  .pipe split '\n'
  .on 'data', (data) ->
    lines.push 
      date: new Date()
      text: data
      
    # trim the buffer if needed
    linesToRemove = if options.numlines > 0 then Math.max 0, lines.length - options.numlines else 0
    if linesToRemove > 0
      lines.splice 0, linesToRemove
      startLineIndex += linesToRemove
  .on 'end', -> 
    pipeClosed = true
  .on 'error', -> 
    pipeClosed = true

# pipe the data if requested    
if options.output
   process.stdin.pipe process.stdout
   
# homepage route   
app.get '/', (req, res) ->
  res.send homepage

# event source route loaded by homepage javascript
clientCount = 0
app.get '/event-source', (req, res) ->

  # track the number of clients so we know when to exit the program
  clientCount++

  # tell the client that this is an event stream
  req.socket.setTimeout Infinity
  res.writeHead 200,
    'Content-Type': 'text/event-stream'
    'Cache-Control': 'no-cache'
    'Connection': 'keep-alive'
  res.write '\n'

  # called when done event received or client closes the connection
  endOfResponse = ->
    clearInterval sendInterval
    clientCount--
    # close the program if stdin is exhaused, this is the last connected client and 
    # we are not in zombie mode
    if pipeClosed and clientCount <= 0 and not options.zombie
      process.exit 0 
      
  # if the client closes unexpectantly then we are done
  res.on 'close', endOfResponse
    
  # keep sending lines until stdin is exhausted and the pipeClosed flag is set
  lineNumber = startLineIndex
  sendLines = ->
    lineIndex = Math.max 0, lineNumber - startLineIndex
    if lines.length > lineIndex
      for index in [lineIndex..(lines.length - 1)]
        res.write "event: line\nid: #{lineNumber++}\ndata: #{formatLine lines[index], lineNumber}\n\n"
    else if pipeClosed
      res.write "event: done\ndata: all done!\n\n"
      res.end()
      endOfResponse()
  sendInterval = setInterval sendLines, 100
  
# try to create the server manually so we can listen for the error event
server = http.createServer app
server.on 'error', (err) ->
  console.error switch err.code
    when 'EADDRINUSE' then "Sorry port #{options.port} is already in use"
    else "Error: #{err.code}"
  process.exit 1
    
# start 'er up
server.listen options.port, options.interface