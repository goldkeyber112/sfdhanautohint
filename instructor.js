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

function initialMDRPs(actions){
	var tt = [];
	var args = [];
	var movements = [];
	for(var k = 0; k < actions.length; k++){
		args.push(actions[k].bottomkey[2].id, actions[k].topkey[1].id);
		movements.push('MDRP[rnd,grey]', 'MDAP[rnd]');
	};
	if(args.length) {
		pushargs(tt, args);
		return tt.concat(movements.reverse());
	} else {
		return []
	}
};
function roundingStemInstrs(glyph, upm, ppem, actions, cvt, padding){
	var tt = [];
	var args = [];
	var movements = [];
	padding = padding || 0;
	for(var k = 0; k < actions.length; k++){
		if(actions[k].bottomkey.length > 4) {
			var touchedStemWidthPixels = (actions[k].bottomkey[4] || 0);
			var originalStemWidthPixels = (actions[k].bottomkey[3] || 0);
			if(Math.round(originalStemWidthPixels) === touchedStemWidthPixels && Math.abs(originalStemWidthPixels - touchedStemWidthPixels) < 0.48) {
				// args.push(actions[k].bottomkey[2].id, actions[k].topkey[1].id);
				// movements.push('MDRP[rnd,grey]', 'MDAP[rnd]');
			} else {
				var cvtwidth = -Math.round(upm / ppem * touchedStemWidthPixels);
				var cvtj = cvt.indexOf(cvtwidth, padding);
				if(cvtj >= 0) {
					args.push(actions[k].bottomkey[2].id, cvtj, actions[k].topkey[1].id);
					movements.push('MIRP[0]', 'MDAP[rnd]');
				} else {
					var msirpwidth = -((actions[k].bottomkey[3] | 0) * 64);
					args.push(actions[k].bottomkey[2].id, msirpwidth, actions[k].topkey[1].id);
					movements.push('MSIRP[0]', 'MDAP[rnd]');
				}				
			};
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
	var tt = ['SVTCA[y-axis]', 'RTG'];

	// Hint for bluezone alignments
	var h0 = hint(glyph, upm, strategy).instructions;
	
	// Microsoft eats my deltas, i have to add additional MDAPs
	// cf. http://www.microsoft.com/typography/cleartype/truetypecleartype.aspx#Toc227035721
	if(h0.roundingStems.length) {
		var initialTouchArgs = [];
		var initialTouches = [];
		for(var k = 0; k < h0.roundingStems.length; k++){
			initialTouchArgs.push(h0.roundingStems[k].topkey[1].id);
			initialTouches.push('MDAP[0]');
		};
		pushargs(tt, initialTouchArgs);
		tt = tt.concat(initialTouches);
	};

	// Blue zone alignment instructions
	if(h0.blueZoneAlignments.length) {
		var bluetops = [], bluebottoms = [];
		for(var k = 0; k < h0.blueZoneAlignments.length; k++){
			if(h0.blueZoneAlignments[k][0] === 'BLUETOP') bluetops.push(h0.blueZoneAlignments[k][1]);
			else bluebottoms.push(h0.blueZoneAlignments[k][1]);
		}
		for(var k = 0; k < bluetops.length; k++){
			pushargs(tt, [bluetops[k].id, cvtTopID]);
			tt.push('MIAP[rnd]');
		}
		for(var k = 0; k < bluebottoms.length; k++){
			pushargs(tt, [bluebottoms[k].id, cvtBottomID]);
			tt.push('MIAP[rnd]');
		}
	};

	var deltaInstructions = [];
	pushargs(deltaInstructions, [2, PPEM_MIN]);
	deltaInstructions.push('SDB', 'SDS');

	var mirps = [];

	if(glyph.stems.length) {
		mirps.push('MPPEM');
		for(var ppem = PPEM_MIN; ppem < PPEM_MAX; ppem++){
			var instrs = hint(glyph, ppem, strategy).instructions;
			var deltas = [];
			for(var k = 0; k < instrs.roundingStems.length; k++){
				var tk = instrs.roundingStems[k].topkey;
				var original = tk[2]
				var rounded = rtg(original, upm, ppem);
				var target = tk[3];
				var d = 4 * Math.round((target - rounded) / (upm / ppem));
				var roundBias = (original - rounded) / (upm / ppem);
				if(roundBias >= 0.48 && roundBias <= 0.52) {
					// RTG rounds TK down, but it is close to the middle
					d -= 1
				} else if(roundBias >= -0.52 && roundBias <= -0.48) {
					d += 1
				};

				if(d) deltas.push({id: tk[1].id, delta: d});
			};
			if(deltas.length) {
				var deltapArgs = [];
				for(var j = 0; j < deltas.length; j++){
					var point = deltas[j].id;
					var d = deltas[j].delta;
					if(d <= 8 && d >= -8) {
						var selector = (d > 0 ? d + 7 : d + 8);
						var deltappem = (ppem - PPEM_MIN) % 16;
						deltapArgs.push(deltappem * 16 + selector, point)
					}
				};
				deltapArgs.push(deltas.length)
				pushargs(deltaInstructions, deltapArgs);
				deltaInstructions.push('DELTAP' + (1 + Math.floor((ppem - PPEM_MIN) / 16)))
			};

			var ppemSpecificMRPs = roundingStemInstrs(glyph, upm, ppem, instrs.roundingStems, cvt, padding);
			if(ppemSpecificMRPs.length) {
				mirps.push('DUP', 'PUSHB_1', ppem, 'EQ', 'IF');
				mirps = mirps.concat(ppemSpecificMRPs);
				mirps.push('EIF');				
			}
		};		
	};

	// Interpolations
	tt = tt.concat(deltaInstructions, initialMDRPs(h0.roundingStems), mirps, ipInstrs(h0.interpolations));
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