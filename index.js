var fs = require('fs');
var readline = require('readline');
var stream = require('stream');
var instruct = require('./instructor').instruct;

var argv = require('optimist').argv;

var instream = argv._[0] ? fs.createReadStream(argv._[0]): process.stdin;
var outstream = argv.o ? fs.createWriteStream(argv.o, { encoding: 'utf-8' }): process.stdout;
var rl = readline.createInterface(instream, outstream);

var n = 0;
var buf = '';

var strategy = {
	UPM: 1000,
	MIN_STEM_WIDTH: 20,
	MAX_STEM_WIDTH: 140,
	STEM_SIDE_MIN_RISE: 40,
	STEM_SIDE_MIN_DESCENT: 60,
	PPEM_MIN: 10,
	PPEM_MAX: 36,
	POPULATION_LIMIT: 200,
	CHILDREN_LIMIT: 100,
	EVOLUTION_STAGES: 15,
	MUTANT_PROBABLITY: 0.4,
	ELITE_COUNT: 10,
	WIDTH_FACTOR_X: 2,
	MIN_ADJUST_PPEM: 16,
	MAX_ADJUST_PPEM: 32,
	MIN_TOUCHED_STEM_WIDTH: 1,
	ABLATION_IN_RADICAL: 1,
	ABLATION_RADICAL_EDGE: 2,
	ABLATION_GLYPH_EDGE: 15,
	ABLATION_GLYPH_HARD_EDGE: 25,
	COEFF_PORPORTION_DISTORTION: 4,
	BLUEZONE_BOTTOM_CENTER: -75,
	BLUEZONE_TOP_CENTER: 840,
	BLUEZONE_BOTTOM_LIMIT: -65,
	BLUEZONE_TOP_LIMIT: 825,
	BLUEZONE_WIDTH: 15,
	COEFF_A_MULTIPLIER: 5,
	COEFF_A_SAME_RADICAL: 4,
	COEFF_A_FEATURE_LOSS: 15,
	COEFF_A_RADICAL_MERGE: 1,
	COEFF_C_MULTIPLIER: 25,
	COEFF_C_SAME_RADICAL: 3,
	COEFF_S: 10000,
	COEFF_A_SYMMETRY: -40,
	COLLISION_MIN_OVERLAP_RATIO: 0.2
};

for(var prop in strategy) {
	if(argv[prop]) {
		strategy[prop] = isFinite(argv[prop] - 0) ? argv[prop] : strategy[prop]
	}
};

var MAX_SW = 3;
var cvt = [0, strategy.BLUEZONE_TOP_CENTER, strategy.BLUEZONE_BOTTOM_CENTER];
for(var ppem = strategy.PPEM_MIN; ppem < strategy.PPEM_MAX; ppem++){
	for(var w = 1; w <= MAX_SW; w++){
		cvt.push(-Math.round(strategy.UPM / ppem * w))
	}
};
for(var ppem = strategy.PPEM_MIN; ppem < strategy.PPEM_MAX; ppem++){
	for(var w = 1; w <= MAX_SW; w++){
		cvt.push(Math.round(strategy.UPM / ppem * w))
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
			if(!argv.silent && n % (argv.verbose ? 1: 200) === 0) process.stdout.write("Hinting /" + curChar.id + ' of ' + process.argv[2] + '\n')
			var instructions = instruct(curChar.input, strategy, cvt)
			if(instructions) buf += "TtInstrs:\n" + instructions + "\nEndTTInstrs\n";
			n++;
		};
		curChar = null;
	} else if(/^BeginChars:/.test(line)) {
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