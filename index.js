var fs = require('fs');
var readline = require('readline');
var stream = require('stream');
var instruct = require('./instructor').instruct;

var instream = fs.createReadStream(process.argv[2]);
var outstream = fs.createWriteStream(process.argv[3], { encoding: 'utf-8' });
var rl = readline.createInterface(instream, outstream);

var n = 0;
var buf = '';
var curChar = false;

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
}

rl.on('line', function(line) {
	buf += line + '\n';
	if(buf.length >= 40960) {
		outstream.write(buf);
		buf = '';
	}

	if(/^SplineSet/.test(line)) {
		curChar = { input: '' }
	} else if(/^EndSplineSet/.test(line)) {
		if(curChar){
			if(n % 100 === 0) process.stderr.write("Hinting glyph #" + n + '\n')
//			try{
				var instructions = instruct(curChar.input, strategy, cvt)
				if(instructions) buf += "TtInstrs:\n" + instructions + "\nEndTTInstrs\n";
//			} catch(ex) {

//			}
			n++;
		}

		curChar = null;
	} else if(curChar) {
		curChar.input += line + '\n';
	} else if(/^DEI:/.test(line)) {
		buf += 'ShortTable: cvt  ' + cvt.length + '\n' + cvt.join('\n') + '\nEndShort\n'
	}
});

rl.on('close', function() {
	if(buf) outstream.write(buf);
	outstream.end()
});