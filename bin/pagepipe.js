var app, auth, basicAuth, clientCount, dateformat, express, favicon, formatLine, homepage, http, lines, name, options, pass, pipeClosed, server, split, startLineIndex, useAuth, _ref, _ref1;

options = require('commander');

express = require('express');

basicAuth = require('basic-auth');

http = require('http');

split = require('split');

dateformat = require('dateformat');

favicon = require('serve-favicon');

app = express();

app.use(favicon(__dirname + "/favicon.ico"));

options.version('1.0.0').option('-p, --port <n>', 'server port [10371]', '10371').option('-c, --color <#rgb>', 'text color for page [#000]', '#000').option('-b, --bgcolor <#rgb>', 'background color for page [#fff]', '#fff').option('-f, --font <name>', 'font family for page [monospace]', 'monospace').option('-m, --margin <n>', 'margin around output in page [1em]', '1em').option('-t, --title <text>', 'title tag and text for page [pagepipe]', 'pagepipe').option('-i, --interface <ip>', 'server interface [localhost]', 'localhost').option('-a, --auth <username>/<password>', 'require basic auth to view page').option('-r, --realm <name>', 'realm name for basic auth [pagepipe]', 'pagepipe').option('-z, --zombie', 'stays alive after stdin is exhausted').option('-o, --output', 'pipes to stdout').option('-n, --numlines <n>', 'size of line buffer, 0 is unlimited [0]', '0').option('-d, --datestamp', 'prefixes datestamps to all lines').option('-l, --lines', 'prefixes 1-based line numbers').option('-j, --json', 'sends event-source data as json');

options.on('--help', function() {
  return console.log('  Created by Doug Martin, http://dougmart.in/pagepipe');
});

options.parse(process.argv);

options.numlines = parseInt(options.numlines, 10);

_ref1 = !options.auth ? [false, null] : ((_ref = options.auth.split('/'), name = _ref[0], pass = _ref[1], _ref), !(pass != null ? pass.length : void 0) > 0 ? (console.error("auth option must be in the form of <username>/<password>"), process.exit(1)) : void 0, [
  true, {
    name: name,
    pass: pass
  }
]), useAuth = _ref1[0], auth = _ref1[1];

if (useAuth) {
  app.use(function(req, res, next) {
    var user;
    user = basicAuth(req);
    if (!user || user.name !== auth.name || user.pass !== auth.pass) {
      res.set('WWW-Authenticate', ['Basic realm="', options.realm, '"'].join(''));
      return res.sendStatus(401);
    }
    return next();
  });
}

formatLine = function(line, lineNumber) {
  var date, json, prefix, prefixes;
  date = options.datestamp ? dateformat(line.date, 'isoDateTime') : null;
  if (options.json) {
    json = {};
    if (options.lines) {
      json.line = lineNumber;
    }
    if (options.datestamp) {
      json.date = date;
    }
    json.text = line.text;
    return JSON.stringify(json);
  } else {
    prefixes = [];
    if (options.lines) {
      prefixes.push(lineNumber);
    }
    if (options.datestamp) {
      prefixes.push("[" + date + "]");
    }
    prefix = prefixes.length > 0 ? (prefixes.join(' ')) + " " : '';
    return "" + prefix + line.text;
  }
};

homepage = "<!DOCTYPE html>\n<html>\n  <head>\n    <title>" + options.title + "</title>\n    <style>\n      html, body {\n        margin: 0;\n        padding: 0;\n      }\n      body {\n        color: " + options.color + ";\n        background-color: " + options.bgcolor + ";\n        font-family: " + options.font + ";\n        font-size: 1em;\n      }\n      div#header {\n        top: 0;\n        left: 0;\n        right: 0;\n      }\n      div#title {\n        padding: 0.25em 0.5em;\n      }\n      div#status {\n        float: right;\n        padding: 0.25em 0.5em;\n      }\n      div#output {\n        position: absolute;\n        top: 1.5em;\n        left: 0;\n        bottom: 0;\n        right: 0;\n        overflow: auto;\n      }\n      pre#innerOutput {\n        margin: " + options.margin + ";\n        padding: 0;\n        font-family: " + options.font + ";\n        font-size: 1em;\n      }\n    </style>\n  </head>\n  <body>\n    <div id='header'><div id='status'>Loading...</div><div id='title'>" + options.title + "</div></div>\n    <div id='output'><pre id='innerOutput'></pre></div>\n    <script>\n      var outputDiv = document.getElementById('innerOutput'),\n          statusDiv = document.getElementById('status'),\n          eventSource = window.EventSource ? new EventSource('event-source') : null,\n          bytesReceived = 0,\n          setStatus;\n          \n      setStatus = function (newStatus) { \n        var html = [newStatus]; \n        if (bytesReceived > 0) {\n          html.push(' (', bytesReceived, ' bytes)');\n        }\n        statusDiv.innerHTML = html.join('');\n      };\n      \n      if (!eventSource) {\n        outputDiv.innerHTML = 'Sorry, your browser does not support EventSource which is needed to get the pagepipe output.';\n        setStatus('Error!');\n      }\n      else {\n        eventSource.addEventListener('line', function(e) {\n          outputDiv.appendChild(document.createTextNode(e.data));\n          outputDiv.appendChild(document.createElement('br'));\n          bytesReceived += e.data.length;\n          setStatus('Streaming');\n        }, false);\n        eventSource.addEventListener('done', function() {\n          setStatus('Done');\n          eventSource.close();\n        }, false);\n        eventSource.addEventListener('open', function() {\n          setStatus('Opened');\n        }, false);\n        eventSource.addEventListener('error', function() {\n          setStatus('Disconnected!');\n        }, false);\n      }\n    </script>\n  </body>\n</html>";

startLineIndex = 0;

lines = [];

pipeClosed = false;

process.stdin.pipe(split('\n')).on('data', function(data) {
  var linesToRemove;
  lines.push({
    date: new Date(),
    text: data
  });
  linesToRemove = options.numlines > 0 ? Math.max(0, lines.length - options.numlines) : 0;
  if (linesToRemove > 0) {
    lines.splice(0, linesToRemove);
    return startLineIndex += linesToRemove;
  }
}).on('end', function() {
  return pipeClosed = true;
}).on('error', function() {
  return pipeClosed = true;
});

if (options.output) {
  process.stdin.pipe(process.stdout);
}

app.get('/', function(req, res) {
  return res.send(homepage);
});

clientCount = 0;

app.get('/event-source', function(req, res) {
  var endOfResponse, lineNumber, sendInterval, sendLines;
  clientCount++;
  req.socket.setTimeout(Infinity);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write('\n');
  endOfResponse = function() {
    clearInterval(sendInterval);
    clientCount--;
    if (pipeClosed && clientCount <= 0 && !options.zombie) {
      return process.exit(0);
    }
  };
  res.on('close', endOfResponse);
  lineNumber = startLineIndex;
  sendLines = function() {
    var index, lineIndex, _i, _ref2, _results;
    lineIndex = Math.max(0, lineNumber - startLineIndex);
    if (lines.length > lineIndex) {
      _results = [];
      for (index = _i = lineIndex, _ref2 = lines.length - 1; lineIndex <= _ref2 ? _i <= _ref2 : _i >= _ref2; index = lineIndex <= _ref2 ? ++_i : --_i) {
        _results.push(res.write("event: line\nid: " + (lineNumber++) + "\ndata: " + (formatLine(lines[index], lineNumber)) + "\n\n"));
      }
      return _results;
    } else if (pipeClosed) {
      res.write("event: done\ndata: all done!\n\n");
      res.end();
      return endOfResponse();
    }
  };
  return sendInterval = setInterval(sendLines, 100);
});

server = http.createServer(app);

server.on('error', function(err) {
  console.error((function() {
    switch (err.code) {
      case 'EADDRINUSE':
        return "Sorry port " + options.port + " is already in use";
      default:
        return "Error: " + err.code;
    }
  })());
  return process.exit(1);
});

server.listen(options.port, options["interface"]);
