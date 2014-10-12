var parseSFD = require('./sfdParser').parseSFD;
var findStems = require('./findstem').findStems;
var hint = require('./hinter').hint;

function rtg(y, upm, ppem){ return Math.round(y / upm * ppem) / ppem * upm }
function pushargs(tt){
	var vals = [];
	for(var j = 1; j < arguments.length; j++) vals = vals.concat(arguments[j]);

	var datatype = 'B';
	var shortpush = vals.length <= 8;
	for(var j = 0; j < vals.length; j++) if(vals[j] < 0 || vals[j] > 255) datatype = 'W';
	if(shortpush){
		tt.push('PUSH' + datatype + '_' + vals.length);
		for(var j = 0; j < vals.length; j++) tt.push(vals[j])
	} else if(vals.length < 256) {
		tt.push('NPUSH' + datatype);
		tt.push(vals.length);
		for(var j = 0; j < vals.length; j++) tt.push(vals[j])
	}
};

function roundingStemInstrs(glyph, upm, ppem, actions, cvt, padding){
	var tt = [];
	var args = [];
	var movements = [];
	padding = padding || 0;
	for(var k = 0; k < actions.length; k++){
		if(actions[k].bottomkey.length > 3) {
			var cvtwidth = -Math.round(upm / ppem * (actions[k].bottomkey[3] | 0));
			var msirpwidth = -((actions[k].bottomkey[3] | 0) * 64);
			var cvtj = cvt.indexOf(cvtwidth, padding)
			if(cvtj >= 0) {
				args.push(actions[k].bottomkey[2].id, cvtj, actions[k].topkey[1].id);
				movements.push('MIRP[0]', 'MDAP[rnd]');
			} else {
				args.push(actions[k].bottomkey[2].id, msirpwidth, actions[k].topkey[1].id);
				movements.push('MSIRP[0]', 'MDAP[rnd]');
			}
		} else {
			args.push(actions[k].bottomkey[2].id, actions[k].topkey[1].id);
			movements.push('MDRP[0]', 'MDAP[rnd]');
		}
	};
	if(args.length) {
		pushargs(tt, args);
		return tt.concat(movements.reverse());
	} else {
		return []
	}
};
function by_rp(a, b){
	return a[1] - b[1] || a[2] - b[2]
}
function ipInstrs(actions){
	var tt = [];
	var args = [];
	var movements = [];
	actions = actions.sort(by_rp);
	var cur_rp1 = -1;
	var cur_rp2 = -1;
	for(var k = 0; k < actions.length; k++) {
		var rp1 = actions[k][1];
		var rp2 = actions[k][2];
		if(cur_rp1 !== rp1) {
			cur_rp1 = rp1;
			args.push(rp1.id);
			movements.push('SRP1')
		};
		if(cur_rp2 !== rp2) {
			cur_rp2 = rp2;
			args.push(rp2.id);
			movements.push('SRP2')
		};
		args.push(actions[k][3].id);
		movements.push('IP')
	};
	if(args.length) {
		pushargs(tt, args.reverse())
		return tt.concat(movements);
	} else {
		return []
	}
}

function instruct(input, strategy, cvt, padding) {
	var upm = strategy.UPM || 1000;
	var PPEM_MIN = strategy.PPEM_MIN;
	var PPEM_MAX = strategy.PPEM_MAX;

	var padding = padding || 0;

	var cvtTopID = cvt.indexOf(strategy.BLUEZONE_TOP_CENTER, padding);
	var cvtBottomID = cvt.indexOf(strategy.BLUEZONE_BOTTOM_CENTER, padding);

	var glyph = findStems(parseSFD(input), strategy);
	// if(!glyph.stems.length) return;
	var tt = ['SVTCA[y-axis]'];

	// Hint for bluezone alignments
	var h0 = hint(glyph, upm, strategy).instructions;
	if(h0.blueZoneAlignments.length) {
		var bluetops = [], bluebottoms = [];
		for(var k = 0; k < h0.blueZoneAlignments.length; k++){
			if(h0.blueZoneAlignments[k][0] === 'BLUETOP') bluetops.push(h0.blueZoneAlignments[k][1]);
			else bluebottoms.push(h0.blueZoneAlignments[k][1]);
		}
		tt.push('RTG');
		for(var k = 0; k < bluetops.length; k++){
			pushargs(tt, [bluetops[k].id, cvtTopID]);
			tt.push('MIAP[rnd]');
		}
		for(var k = 0; k < bluebottoms.length; k++){
			pushargs(tt, [bluebottoms[k].id, cvtBottomID]);
			tt.push('MIAP[rnd]');
		}
	}

	if(glyph.stems.length) {
		tt.push('MPPEM');
		for(var ppem = PPEM_MIN; ppem < PPEM_MAX; ppem++){
			var instrs = hint(glyph, ppem, strategy).instructions;
			tt.push('DUP', 'PUSHB_1', ppem, 'EQ', 'IF');
			var biases = {}
			for(var k = 0; k < instrs.roundingStems.length; k++){
				var tk = instrs.roundingStems[k].topkey;
				var original = tk[2]
				var rounded = rtg(original, upm, ppem);
				var target = tk[3];
				var bias = 64 * Math.round((target - rounded) / (upm / ppem));
				var roundBias = (original - rounded) / (upm / ppem);
				if(roundBias >= 0.48 && roundBias <= 0.52) {
					// RTG rounds TK down, but it is close to the middle
					bias -= 16
				} else if(roundBias >= -0.52 && roundBias <= -0.48) {
					bias += 16
				}
				if(!biases[bias]) biases[bias] = []
				biases[bias].push(instrs.roundingStems[k])
			};
			tt.push('RTG');
			// SHPIX instructions
			for(var bias in biases) {
				if(bias - 0) {
					pushargs(tt, biases[bias].map(function(s){ return s.topkey[1].id }));
					pushargs(tt, [bias - 0, biases[bias].length]);
					tt.push('SLOOP', 'SHPIX')
				}
			}
			tt = tt.concat(roundingStemInstrs(glyph, upm, ppem, instrs.roundingStems, cvt, padding));
			tt.push('EIF');
		};		
	}
	
	// Interpolations
	tt = tt.concat(ipInstrs(h0.interpolations));
	// Hint for in-stem alignments
	var ials = [], stemops = h0.roundingStems.concat(h0.alignedStems);
	for(var k = 0; k < stemops.length; k++){
		if(stemops[k].topaligns.length) ials.push(stemops[k].topaligns)
		if(stemops[k].bottomaligns.length) ials.push(stemops[k].bottomaligns)
	}
	ials.sort(function(p, q){ return p.length - q.length });
	var looplen = 0
	for(var k = 0; k < ials.length; k++){
		pushargs(tt, ials[k].map(function(x){ return x[2].id }), [ials[k][0][1].id, ials[k].length])
		tt.push('SLOOP', 'SRP0', 'ALIGNRP')
	}

	tt.push('IUP[y]');
	return tt.join("\n")
};

exports.parseSFD = parseSFD
exports.findStems = findStems
exports.hint = hint
exports.instruct = instruct