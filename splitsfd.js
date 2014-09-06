var fs = require('fs');
var path = require('path');
var stream = require('stream');
var readline = require('readline');
var argv = require('optimist').argv;
var devnull = require('dev-null');

var instream = argv._[0] ? fs.createReadStream(argv._[0]) : process.stdin;
var outdir = argv.o;
var nStreams = (argv.n - 0) || 8;

var fontinfoStream = fs.createWriteStream(outdir + '/font.info', { encoding: 'utf-8' });
var streams = [fontinfoStream];
for(var j = 0; j < nStreams; j++) {
	streams.push(fs.createWriteStream(outdir + '/part' + j + '.glyphs', { encoding: 'utf-8' }))
};
streams.push(fs.createWriteStream(outdir + '/final.info', { encoding: 'utf-8' }))

var rl = readline.createInterface(instream, devnull())

var buffers = streams.map(function(){ return '' });
function flush() {
	for(var j = 0; j < streams.length; j++) {
		if(buffers[j].length >= 40900) {
			streams[j].write(buffers[j]);
			buffers[j] = ''
		}
	}
}
function forceFlush() {
	for(var j = 0; j < streams.length; j++) {
		streams[j].write(buffers[j]);
		buffers[j] = ''
	}
};

var jbuf = 0;
var n = 0;

var finished = false;

rl.on('line', function(line) {
	if(/^BeginChars:/.test(line)) {
		buffers[jbuf] += line + '\n';
		jbuf = 1;
		flush();
		return;
	} else if(/^StartChar:/.test(line)) {
		jbuf = n % nStreams + 1;
		n += 1;
	} else if(/^EndChars/.test(line)) {
		jbuf = streams.length - 1
	}
	buffers[jbuf] += line + '\n';
	flush();
});

rl.on('close', function() {
	forceFlush();
	streams.forEach(function(s){ s.end() })
});