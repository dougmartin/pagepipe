## What is Pagepipe?

Pagepipe brings the power of pipes to the web. Use it on the command line to stream the output of a process to any browser (well, except for IE since it doesn't support EventSource). It works great on Windows, Mac and Linux/Unix machines.  

The full documentation along with options and example usage can be found at [dougmart.in/projects/pagepipe](http://dougmart.in/projects/pagepipe).

## Installation

```bash
$ npm install -g pagepipe
```

*npm is a builtin CLI when you install Node.js*

## Sample Usage

### No options specified

```bash
$ someprocess | pagepipe
```
This sends  the output of someprocess to [http://localhost:10371/](http://localhost:10371/) (10371 is the default port).  Pagepipe will terminate when the output is complete and the first web client consumes the page.

### Zombified on port 80

```bash
$ someprocess | pagepipe -p 80 -z
```

### Zombified on port 80 with a 10 line buffer

This sends  the output of someprocess to [http://localhost/](http://localhost/) (the -p option sets the port).  Pagepipe will not terminate (the -z option sets it to zombie mode) and multiple web clients can load the page to see the same output. 
```bash
$ someprocess | pagepipe -p 80 -z -n 10
```
This sends the last 10 lines of output of someprocess to [http://localhost/](http://localhost/) (the -n option sets the number of lines). The 10 lines are held in a buffer and if someprocess emits more lines after a web client connects those lines will also be appended on the page.  The -n option is very useful to limit memory usage if you have a source process that generates a lot of output over a long span of time such as tailing a log.

### Zombified on port 80 with password protection

```bash
$ secretprocess | pagepipe -p 80 -z -a foo/bar
```
This sends the output of secretprocess to [http://localhost/](http://localhost/) and requires the viewer to enter the username of "foo" and password of "bar" to view the contents.


## Options

    -h, --help                        output usage information
    -V, --version                     output the version number
    -p, --port <n>                    server port [10371]
    -c, --color <#rgb>                text color for page [#000]
    -b, --bgcolor <#rgb>              background color for page [#fff]
    -f, --font <name>                 font face for page [monospace]
    -m, --margin <n>                  margin around output in page [1em]
    -t, --title <text>                title tag and text for page [pagepipe]
    -i, --interface <ip>              server interface [localhost]
    -a, --auth <username>/<password>  require basic auth to view page
    -r, --realm <name>                realm name for basic auth [pagepipe]
    -z, --zombie                      stays alive after stdin is exhausted
    -o, --output                      pipes to stdout
    -n, --numlines <n>                size of line buffer, 0 is unlimited [0]
    -d, --datestamp                   prefixes datestamps to all lines
    -l, --lines                       prefixes 1-based line numbers
    -j, --json                        sends event-source data as json


## Contributors

Send a pull request!

## License

[MIT](http://opensource.org/licenses/MIT)
