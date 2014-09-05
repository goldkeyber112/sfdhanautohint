var fs = require('fs');
var readline = require('readline');
var stream = require('stream');
var instruct = require('./instructor').instruct;

var argv = require('optimist').argv;

var instream = argv._[0] ? fs.createReadStream(argv._[0]) : process.stdin;
var outstream = argv.o ? fs.createWriteStream(argv.o, { encoding: 'utf-8' }) : process.stdout;
var rl = readline.createInterface(instream, outstream);

var n = 0;
var buf = '';

var strategy = {
	MIN_STEM_WIDTH: 20,
	MAX_STEM_WIDTH: 140,
	STEM_SIDE_MIN_RISE: 40,
	STEM_SIDE_MIN_DESCENT: 60,
	PPEM_MIN: 10,
	PPEM_MAX: 36,
	BLUEZONE_TOP_CENTER: 840,
	BLUEZONE_BOTTOM_CENTER: -75,
	UPM: 1000
}

var MAX_SW = 4;

var cvt = [0, strategy.BLUEZONE_TOP_CENTER, strategy.BLUEZONE_BOTTOM_CENTER];
for(var ppem = strategy.PPEM_MIN; ppem < strategy.PPEM_MAX; ppem++){
	for(var w = 1; w <= MAX_SW; w++){
		cvt.push(-Math.round(strategy.UPM / ppem * w))
	}
};

var curChar = null;
var readingSpline = false;
var readingTT = false;
rl.on('line', function(line) {

	if(/^StartChar:/.test(line)) {
		curChar = { input: '', id: line.split(' ')[1] }
	} else if(/^SplineSet/.test(line)) {
		readingSpline = true;
	} else if(/^EndSplineSet/.test(line)) {
		readingSpline = false;
	} else if(curChar && readingSpline) {
		curChar.input += line + '\n';
	} else if(/^EndChar/.test(line)) {
		if(curChar){
			if(!argv.silent && n % (argv.verbose ? 1 : 200) === 0) process.stdout.write("Hinting /" + curChar.id + ' of ' + process.argv[2] + '\n')
			var instructions = instruct(curChar.input, strategy, cvt)
			if(instructions) buf += "TtInstrs:\n" + instructions + "\nEndTTInstrs\n";
			n++;
		};
		curChar = null;
	} else if(/^DEI:/.test(line)) {
		buf += 'ShortTable: cvt  ' + cvt.length + '\n' + cvt.join('\n') + '\nEndShort\n'
	};

	buf += line + '\n';
	if(buf.length >= 40960) {
		outstream.write(buf);
		buf = '';
	}
});

rl.on('close', function() {
	if(buf) outstream.write(buf);
	outstream.end()
});