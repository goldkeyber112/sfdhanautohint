var fs = require('fs');
var readline = require('readline');
var stream = require('stream');
var autohint = require('./autohint');

var instream = fs.createReadStream(process.argv[2]);
var outstream = fs.createWriteStream(process.argv[3], { encoding: 'utf-8' });
var rl = readline.createInterface(instream, outstream);

var n = 0;
var buf = '';
var curChar = false;

var PPEM_MIN = 10;
var PPEM_MAX = 36;
var MAX_SW = 4;

var cvt = [0, 840, -75];
for(var ppem = PPEM_MIN; ppem < PPEM_MAX; ppem++){
	for(var w = 1; w <= MAX_SW; w++){
		cvt.push(-Math.round(1000 / ppem * w))
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
			try{
				generateInstruction(curChar);
				if(curChar.instructions) buf += "TtInstrs:\n" + curChar.instructions + "\nEndTTInstrs\n";
			} catch(ex) {

			}
			n++;
		}

		curChar = null;
	} else if(curChar) {
		curChar.input += line + '\n';
	} else if(/^DEI:/.test(line)) {
		buf += 'ShortTable: cvt  ' + cvt.length + '\n' + cvt.join('\n') + '\nEndShort\n'
	}
});

function roundingStemInstrs(glyph, ppem, actions){
	var tt = [];
	for(var k = 0; k < actions.length; k++){
		var sw = actions[k].bottomkey[3] | 0;
		if(glyph.nPoints < 256 && sw > 0 && sw < MAX_SW) {
			tt.push('PUSHB_3', actions[k].bottomkey[2].id, 3 + MAX_SW * (ppem - PPEM_MIN) + (sw - 1), actions[k].topkey[1].id,
				'MDAP[rnd]',
				'MIRP[0]')
		} else {
			tt.push('PUSHW_3', actions[k].bottomkey[2].id, -(actions[k].bottomkey[3].toFixed(0) * 64), actions[k].topkey[1].id,
				'MDAP[rnd]',
				'MSIRP[0]')
		}
	}
	return tt;
}
function alignedStemInstrs(glyph, ppem, actions){
	var tt = [];
	for(var k = 0; k < actions.length; k++){
		var sw = actions[k].bottomkey[3] | 0;
		if(glyph.nPoints < 256 && sw > 0 && sw < MAX_SW) {
			tt.push('PUSHB_5', actions[k].bottomkey[2].id, 3 + MAX_SW * (ppem - PPEM_MIN) + (sw - 1), actions[k].topkey[2].id, 0, actions[k].topkey[1].id,
				'SRP0',
				'MIRP[10000]',
				'MIRP[0]')
		} else {
			tt.push('PUSHW_5', actions[k].bottomkey[2].id, -(actions[k].bottomkey[3].toFixed(0) * 64), actions[k].topkey[2].id, 0, actions[k].topkey[1].id,
				'SRP0',
				'MIRP[10000]',
				'MSIRP[0]')
		}
	}
	return tt;
}

function generateInstruction(ch){
	var glyph = autohint.findStems(autohint.parseSFD(ch.input), 20, 140);
	if(!glyph.stems.length) return;
	var tt = ['SVTCA[y-axis]', 'MPPEM'];
	var cvts = [];
	for(var ppem = PPEM_MIN; ppem < PPEM_MAX; ppem++){
		var instrs = autohint.autohint(glyph, ppem).instructions;
		tt.push('DUP', 'PUSHB_1', ppem, 'EQ', 'IF');
		var roundups = [];
		var rounddowns = [];
		for(var k = 0; k < instrs.roundingStems.length; k++){
			if(instrs.roundingStems[k].topkey[3] >= 0) {
				if(instrs.roundingStems[k].topkey[0] === 'ROUNDDOWN') rounddowns.push(instrs.roundingStems[k])
				else roundups.push(instrs.roundingStems[k]);
			} else {
				if(instrs.roundingStems[k].topkey[0] === 'ROUNDDOWN') roundups.push(instrs.roundingStems[k])
				else rounddowns.push(instrs.roundingStems[k]);
			}
			if(instrs.roundingStems[k].topkey[0] === 'ROUNDUP2') instrs.roundingStems[k].shpix = true;
		};

		if(roundups.length){
			tt.push('RUTG');
			var shpixes = [];
			for(var k = 0; k < roundups.length; k++){
				if(roundups[k].shpix) shpixes.push(roundups[k].topkey[1].id);
			}
			if(shpixes.length && shpixes.length <= 16) {
				tt.push('PUSHB_1', shpixes.length, 'SLOOP')
				tt.push('PUSHW_' + shpixes.length)
				shpixes.forEach(function(x){ tt.push(x) })
				tt.push('PUSHW_1', 64)
				tt.push('SHPIX')
			}
			tt = tt.concat(roundingStemInstrs(glyph, ppem, roundups))
		};
		if(rounddowns.length){
			tt.push('RDTG');
			tt = tt.concat(roundingStemInstrs(glyph, ppem, rounddowns))
		};
		if(instrs.alignedStems.length) {
			tt.push('PUSHB_1', 1, 'SLOOP');
			tt = tt.concat(alignedStemInstrs(glyph, ppem, instrs.alignedStems))
		}

		tt.push('EIF')
	};
	// Hint for bluezone alignments
	var PUSH = (glyph.nPoints < 256 ? 'PUSHB_' : 'PUSHW_');
	var h0 = autohint.autohint(glyph, 1000).instructions;
	if(h0.blueZoneAlignments.length) {
		var bluetops = [], bluebottoms = [];
		for(var k = 0; k < h0.blueZoneAlignments.length; k++){
			if(h0.blueZoneAlignments[k][0] === 'BLUETOP') bluetops.push(h0.blueZoneAlignments[k][1]);
			else bluebottoms.push(h0.blueZoneAlignments[k][1]);
		}
		tt.push('RTG');
		for(var k = 0; k < bluetops.length; k++){
			tt.push(PUSH + '2', bluetops[k].id, 1, 'MIAP[rnd]')
		}
		for(var k = 0; k < bluebottoms.length; k++){
			tt.push(PUSH + '2', bluebottoms[k].id, 2, 'MIAP[rnd]')
		}		
	}

	// Hint for in-stem alignments
	var stemops = h0.roundingStems.concat(h0.alignedStems);
	for(var k = 0; k < stemops.length; k++){
		if(stemops[k].topaligns.length){
			tt.push(PUSH + '2', stemops[k].topaligns[0][1].id, stemops[k].topaligns.length,
				'SLOOP', 'SRP0');
			if(stemops[k].topaligns.length <= 16) {
				tt.push(PUSH + stemops[k].topaligns.length)
				for(var l = 0; l < stemops[k].topaligns.length; l++){
					tt.push(stemops[k].topaligns[l][2].id)
				};
			}
			tt.push('ALIGNRP')
		}
		if(stemops[k].bottomaligns.length){
			tt.push(PUSH + '2', stemops[k].bottomaligns[0][1].id, stemops[k].bottomaligns.length,
				'SLOOP', 'SRP0');
			if(stemops[k].bottomaligns.length <= 16) {
				tt.push(PUSH + stemops[k].bottomaligns.length)
				for(var l = 0; l < stemops[k].bottomaligns.length; l++){
					tt.push(stemops[k].bottomaligns[l][2].id)
				};
			}
			tt.push('ALIGNRP')
		}
	}
	tt.push('IUP[y]')
	ch.instructions = tt.join('\n')
	glyph = tt = null;
}

rl.on('close', function() {
	if(buf) outstream.write(buf);
	outstream.end()
});