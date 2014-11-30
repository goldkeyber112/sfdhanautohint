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

function initialMDRPs(stems){
	var tt = [];
	var args = [];
	var movements = [];
	for(var k = 0; k < stems.length; k++){
		args.push(stems[k].advKey.id, stems[k].posKey.id);
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
		if(actions[k].adv.length > 4) {
			var touchedStemWidthPixels = (actions[k].adv[4] || 0);
			var originalStemWidthPixels = (actions[k].adv[3] || 0);
			if(Math.round(originalStemWidthPixels) === touchedStemWidthPixels && Math.abs(originalStemWidthPixels - touchedStemWidthPixels) < 0.48) {
				//args.push(actions[k].adv[2], actions[k].pos[1]);
				//movements.push('MDRP[rnd,grey]', 'MDAP[rnd]');
			} else {
				var cvtwidth = (actions[k].orient ? (-1) : 1) * Math.round(upm / ppem * touchedStemWidthPixels);
				var cvtj = cvt.indexOf(cvtwidth, padding);
				if(cvtj >= 0) {
					args.push(actions[k].adv[2], cvtj, actions[k].pos[1]);
					movements.push('MIRP[0]', 'MDAP[rnd]');
				} else {
				 	var msirpwidth = (actions[k].orient ? (-1) : 1) * ((actions[k].adv[3] | 0) * 64);
				 	args.push(actions[k].adv[2], msirpwidth, actions[k].pos[1]);
				 	movements.push('MSIRP[0]', 'MDAP[rnd]');
				}				
			};
		} else {
			args.push(actions[k].adv[2], actions[k].pos[1]);
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

function instruct(glyph, actions, strategy, cvt, padding) {
	var padding = padding || 0;
	var upm = strategy.UPM || 1000;
	var cvtTopID = cvt.indexOf(strategy.BLUEZONE_TOP_CENTER, padding);
	var cvtBottomID = cvt.indexOf(strategy.BLUEZONE_BOTTOM_CENTER, padding);

	// if(!glyph.stems.length) return;
	var tt = ['SVTCA[y-axis]', 'RTG'];

	// Microsoft eats my deltas, i have to add additional MDAPs
	// cf. http://www.microsoft.com/typography/cleartype/truetypecleartype.aspx#Toc227035721
	if(glyph.stems.length) {
		var initialTouchArgs = [];
		var initialTouches = [];
		for(var k = 0; k < glyph.stems.length; k++){
			initialTouchArgs.push(glyph.stems[k].posKey.id);
			initialTouches.push('MDAP[0]');
		};
		pushargs(tt, initialTouchArgs);
		tt = tt.concat(initialTouches);
	};

	// Blue zone alignment instructions
	for(var k = 0; k < glyph.topBluePoints.length; k++){
		pushargs(tt, [glyph.topBluePoints[k], cvtTopID]);
		tt.push('MIAP[rnd]');
	}
	for(var k = 0; k < glyph.bottomBluePoints.length; k++){
		pushargs(tt, [glyph.bottomBluePoints[k], cvtBottomID]);
		tt.push('MIAP[rnd]');
	}

	var deltaInstructions = [];
	pushargs(deltaInstructions, [2, strategy.PPEM_MIN]);
	deltaInstructions.push('SDB', 'SDS');

	var mirps = [];

	if(glyph.stems.length) {
		mirps.push('MPPEM');
		for(var ppem = 0; ppem < actions.length; ppem++) if(actions[ppem]){
			var instrs = actions[ppem];
			var deltas = [];
			for(var k = 0; k < instrs.length; k++){
				var tk = instrs[k].pos;
				var original = tk[2];
				var rounded = rtg(original, upm, ppem);
				var target = tk[3];
				var d = 4 * Math.round((target - rounded) / (upm / ppem));
				var roundBias = (original - rounded) / (upm / ppem);
				if(roundBias >= 0.4375 && roundBias <= 0.5625) {
					// RTG rounds TK down, but it is close to the middle
					d -= 1
				} else if(roundBias >= -0.5625 && roundBias <= -0.4375) {
					d += 1
				};

				if(d) deltas.push({id: tk[1], delta: d});
			};
			if(deltas.length) {
				var deltapArgs = [];
				for(var j = 0; j < deltas.length; j++){
					var point = deltas[j];
					var d = deltas[j].delta;
					if(d <= 8 && d >= -8) {
						var selector = (d > 0 ? d + 7 : d + 8);
						var deltappem = (ppem - strategy.PPEM_MIN) % 16;
						deltapArgs.push(deltappem * 16 + selector, point.id)
					}
				};
				deltapArgs.push(deltas.length)
				pushargs(deltaInstructions, deltapArgs);
				deltaInstructions.push('DELTAP' + (1 + Math.floor((ppem - strategy.PPEM_MIN) / 16)))
			};

			var ppemSpecificMRPs = roundingStemInstrs(glyph, upm, ppem, instrs, cvt, padding);
			if(ppemSpecificMRPs.length) {
				mirps.push('DUP', 'PUSHB_1', ppem, 'EQ', 'IF');
				mirps = mirps.concat(ppemSpecificMRPs);
				mirps.push('EIF');				
			}
		};
	};

	// Interpolations
	tt = tt.concat(deltaInstructions, initialMDRPs(glyph.stems), mirps, ipInstrs(glyph.interpolations));

	// In-stem alignments
	for(var j = 0; j < glyph.stems.length; j++) {
		[[glyph.stems[j].posKey.id, glyph.stems[j].posAlign], [glyph.stems[j].advKey.id, glyph.stems[j].advAlign]].forEach(function(x){
			if(x[1].length) {
				pushargs(tt, x[1], [x[0]]);
				tt.push('SRP0');
				tt = tt.concat(x[1].map(function(x){ return 'MDRP[0]'}))
			}
		});
	}

	tt.push('IUP[y]');
	return tt.join("\n")
};

exports.instruct = instruct