var util = require('util')

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
	} else if(vals.length < 250) {
		tt.push('NPUSH' + datatype);
		tt.push(vals.length);
		for(var j = 0; j < vals.length; j++) tt.push(vals[j])
	}
};

function initialMDRPs(stems, useMDRPnr){
	var tt = [];
	var args = [];
	var movements = [];
	for(var k = 0; k < stems.length; k++){
		args.push(stems[k].advKey.id, stems[k].posKey.id);
		movements.push('MDAP[rnd]', 'MDAP[rnd]');
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
		var rp1 = actions[k][0];
		var rp2 = actions[k][1];
		if(cur_rp1 !== rp1) {
			cur_rp1 = rp1;
			args.push(rp1);
			movements.push('SRP1')
		};
		if(cur_rp2 !== rp2) {
			cur_rp2 = rp2;
			args.push(rp2);
			movements.push('SRP2')
		};
		args.push(actions[k][2]);
		movements.push('IP')
	};
	if(args.length) {
		pushargs(tt, args.reverse())
		return tt.concat(movements);
	} else {
		return []
	}
}

function instruct(glyph, actions, strategy, cvt, padding, useMDRPnr) {
	var padding = padding || 0;
	var upm = strategy.UPM || 1000;
	var cvtTopID = cvt.indexOf(strategy.BLUEZONE_TOP_CENTER, padding);
	var cvtBottomID = cvt.indexOf(strategy.BLUEZONE_BOTTOM_CENTER, padding);

	function decideDelta(gear, original, target, upm, ppem){
		var rounded = rtg(original, upm, ppem);
		var d = Math.round(gear * (target - rounded) / (upm / ppem));
		var roundBias = (original - rounded) / (upm / ppem);
		if(roundBias >= 0.4375 && roundBias <= 0.5625) {
			// RTG rounds TK down, but it is close to the middle
			d -= 1
		} else if(roundBias >= -0.5625 && roundBias <= -0.4375) {
			d += 1
		};
		if(!d) return -1;
		if(d < -8 || d > 8) return -2;
		var selector = (d > 0 ? d + 7 : d + 8);
		var deltappem = (ppem - strategy.PPEM_MIN) % 16;
		return deltappem * 16 + selector
	}
	// if(!glyph.stems.length) return;
	var tt = ['SVTCA[y-axis]', 'RTG'];
	tt.push('PUSHB_1', strategy.PPEM_MIN, 'MPPEM', 'LTEQ', 'PUSHB_1', strategy.PPEM_MAX, 'MPPEM', 'GT', 'AND', 'IF');

	// Blue zone alignment instructions
	for(var k = 0; k < glyph.topBluePoints.length; k++){
		pushargs(tt, [glyph.topBluePoints[k], cvtTopID]);
		tt.push('MIAP[rnd]');
	};
	for(var k = 0; k < glyph.bottomBluePoints.length; k++){
		pushargs(tt, [glyph.bottomBluePoints[k], cvtBottomID]);
		tt.push('MIAP[rnd]');
	};

	// Microsoft eats my deltas, i have to add additional MDAPs
	// cf. http://www.microsoft.com/typography/cleartype/truetypecleartype.aspx#Toc227035721
	if(glyph.stems.length) {
		var initialTouchArgs = [];
		var initialTouches = [];
		for(var k = 0; k < glyph.stems.length; k++){
			initialTouchArgs.push(glyph.stems[k].posKey.id);
			initialTouchArgs.push(glyph.stems[k].advKey.id);
			initialTouches.push('MDAP[0]');
			initialTouches.push('MDAP[0]');
		};
		pushargs(tt, initialTouchArgs);
		tt = tt.concat(initialTouches);
	};


	var deltaInstructions = [];
	pushargs(deltaInstructions, [1, strategy.PPEM_MIN]);
	deltaInstructions.push('SDB', 'SDS');

	var mirps = [];
	if(glyph.stems.length) {
		for(var ppem = 0; ppem < actions.length; ppem++) {
			if(actions[ppem]) {
				var instrs = actions[ppem];
				var deltas = [];
				var args = [];
				var movements = [];
				for(var k = 0; k < instrs.length; k++) {
					var d = decideDelta(2, instrs[k].pos[2], instrs[k].pos[3], upm, ppem);
					if(d >= 0) deltas.push({ id: instrs[k].pos[1], delta: d });
	
					if(instrs[k].adv.length > 4) {
						var touchedStemWidthPixels 	= (instrs[k].adv[4] || 0);
						var originalStemWidthPixels	= (instrs[k].adv[3] || 0);
						var originalAdvKeyPosition 	= instrs[k].pos[2] + (instrs[k].orient ? (-1) : 1) * instrs[k].adv[3] * (upm / ppem);
						var targetAdvKeyPosition   	= instrs[k].pos[3] + (instrs[k].orient ? (-1) : 1) * instrs[k].adv[4] * (upm / ppem);
						var d = decideDelta(2, originalAdvKeyPosition, targetAdvKeyPosition, upm, ppem);
						if(d >= 0) {
							deltas.push({ id: instrs[k].adv[2], delta: d });
						} else if(d === -1) {
							// IGNORE
						} else if(Math.round(originalStemWidthPixels) === touchedStemWidthPixels && Math.abs(originalStemWidthPixels - touchedStemWidthPixels) < 0.48) {
							args.push(instrs[k].adv[2], instrs[k].pos[1]);
							movements.push('MDRP[rnd,grey]', 'SRP0');
						} else {
							var cvtwidth = (instrs[k].orient ? (-1) : 1) * Math.round(upm / ppem * touchedStemWidthPixels);
							var cvtj = cvt.indexOf(cvtwidth, padding);
							if(cvtj >= 0) {
								args.push(instrs[k].adv[2], cvtj, instrs[k].pos[1]);
								movements.push('MIRP[0]', 'SRP0');
							} else {
								process.stderr.write([ppem, touchedStemWidthPixels, (instrs[k].orient ? (-1) : 1) * Math.round(upm / ppem * touchedStemWidthPixels)] + '\n')
								var msirpwidth = (instrs[k].orient ? (-1) : 1) * ((instrs[k].adv[3] | 0) * 64);
								args.push(instrs[k].adv[2], msirpwidth, instrs[k].pos[1]);
								movements.push('MSIRP[0]', 'SRP0');
							}
						};
					} else {
						args.push(instrs[k].adv[2], instrs[k].pos[1]);
						movements.push('MDRP[0]', 'SRP0');
					}
				};
				if(deltas.length) {
					var deltapArgs = [];
					for(var j = 0; j < deltas.length; j++){
						deltapArgs.push(deltas[j].delta, deltas[j].id)
					};
					deltapArgs.push(deltapArgs.length >> 1)
					pushargs(deltaInstructions, deltapArgs);
					deltaInstructions.push('DELTAP' + (1 + Math.floor((ppem - strategy.PPEM_MIN) / 16)))
				};
				var ppemSpecificMRPs = [];
				if(args.length) {
					pushargs(ppemSpecificMRPs, args)
					ppemSpecificMRPs = ppemSpecificMRPs.concat(movements.reverse());
				};
				if(ppemSpecificMRPs.length) {
					mirps.push('MPPEM', 'PUSHB_1', ppem, 'EQ', 'IF');
					mirps = mirps.concat(ppemSpecificMRPs);
					mirps.push('EIF');
				}
			}
		};
	};

	// Interpolations
	tt = tt.concat(deltaInstructions, initialMDRPs(glyph.stems, useMDRPnr), mirps, ipInstrs(glyph.interpolations));

	// In-stem alignments
	for(var j = 0; j < glyph.stems.length; j++) {
		[[glyph.stems[j].posKey.id, glyph.stems[j].posAlign], [glyph.stems[j].advKey.id, glyph.stems[j].advAlign]].forEach(function(x){
			if(x[1].length) {
				pushargs(tt, x[1], [x[0]]);
				tt.push('SRP0');
				tt = tt.concat(x[1].map(function(x){ return 'MDRP[0]'}))
			}
		});
	};

	tt.push('EIF', 'IUP[y]');
	return tt.join("\n")
};

exports.instruct = instruct