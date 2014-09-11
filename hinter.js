function hint(glyph, ppem, strategy) {
	var upm = strategy.UPM || 1000;

	var MIN_STEM_WIDTH = strategy.MIN_STEM_WIDTH;
	var MAX_STEM_WIDTH = strategy.MAX_STEM_WIDTH;
	var STEM_SIDE_MIN_RISE = strategy.STEM_SIDE_MIN_RISE || strategy.MIN_STEM_WIDTH;
	var STEM_CENTER_MIN_RISE = strategy.STEM_CENTER_MIN_RISE || STEM_SIDE_MIN_RISE;
	var STEM_SIDE_MIN_DESCENT = strategy.STEM_SIDE_MIN_DESCENT || strategy.MIN_STEM_WIDTH;
	var STEM_CENTER_MIN_DESCENT = strategy.STEM_CENTER_MIN_DESCENT || STEM_SIDE_MIN_DESCENT;

	var POPULATION_LIMIT = strategy.POPULATION_LIMIT || 200;
	var CHILDREN_LIMIT = strategy.CHILDREN_LIMIT || 100;
	var EVOLUTION_STAGES = strategy.EVOLUTION_STAGES || 15;
	var MUTANT_PROBABLITY = strategy.MUTANT_PROBABLITY || 0.4;
	var ELITE_COUNT = strategy.ELITE_COUNT || 10;

	var blueFuzz = strategy.BLUEZONE_WIDTH || 15;

	var WIDTH_FACTOR_X = strategy.WIDTH_FACTOR_X || 2;
	var MIN_ADJUST_PPEM = strategy.MIN_ADJUST_PPEM || 16;
	var MAX_ADJUST_PPEM = strategy.MAX_ADJUST_PPEM || 32;
	var COLLISION_MIN_OVERLAP_RATIO = strategy.COLLISION_MIN_OVERLAP_RATIO || 0.2;

	var MIN_TOUCHED_STEM_WIDTH = strategy.MIN_TOUCHED_STEM_WIDTH || 1;

	var ABLATION_IN_RADICAL = strategy.ABLATION_IN_RADICAL || 1;
	var ABLATION_RADICAL_EDGE = strategy.ABLATION_RADICAL_EDGE || 2;
	var ABLATION_GLYPH_EDGE = strategy.ABLATION_GLYPH_EDGE || 15;
	var ABLATION_GLYPH_HARD_EDGE = strategy.ABLATION_GLYPH_HARD_EDGE || 25;
	
	var COEFF_PORPORTION_DISTORTION = strategy.COEFF_PORPORTION_DISTORTION || 4;

	var BLUEZONE_BOTTOM_CENTER = (strategy.BLUEZONE_BOTTOM_CENTER || -75) / 1000 * upm;
	var BLUEZONE_TOP_CENTER = (strategy.BLUEZONE_TOP_CENTER || 840) / 1000 * upm;
	var BLUEZONE_BOTTOM_LIMIT = (strategy.BLUEZONE_BOTTOM_LIMIT || -65) / 1000 * upm;
	var BLUEZONE_TOP_LIMIT = (strategy.BLUEZONE_TOP_LIMIT || 825) / 1000 * upm;


	var shouldAddGlyphHeight = strategy.shouldAddGlyphHeight || function(stem, ppem, pixelTop, pixelBottom) {
		return stem.yori - stem.ytouch >= 0.25 * uppx
	}

	var contours = glyph.contours;
	function byyori(a, b){
		return a.yori - b.yori
	}
	var stems = glyph.stems.sort(byyori);

	var uppx = upm / ppem;
	var pixelBottom = -round(-BLUEZONE_BOTTOM_CENTER);
	var pixelTop = round(BLUEZONE_TOP_CENTER);
	var glyfBottom = Math.max(round(glyph.stats.ymin), pixelBottom);
	var glyfTop = Math.min(round(glyph.stats.ymax), pixelTop);

	function round(y){ return Math.round(y / upm * ppem) / ppem * upm }
	function roundDown(y){ return Math.floor(y / upm * ppem) / ppem * upm }
	function roundUp(y){ return Math.ceil(y / upm * ppem) / ppem * upm }
	function roundDownStem(stem){
		stem.roundMethod = -1; // Positive for round up, negative for round down
		stem.ytouch = roundDown(stem.yori);
		stem.deltaY = 0
	}
	function roundUpStem(stem){
		stem.roundMethod = 1;
		stem.ytouch = roundUp(stem.yori);
		stem.deltaY = 0
	}
	function roundUpStem2(stem){
		stem.roundMethod = 2;
		stem.ytouch = roundUp(stem.yori) + uppx;
		stem.deltaY = 0
	}
	function alignStem(stem, that){
		while(that.alignTo) that = that.alignTo;
		stem.roundMethod = 0;
		stem.alignTo = that;
		stem.ytouch = that.ytouch;
	}
	function unalign(stem){
		stem.roundMethod = (stem.ytouch < stem.yori ? -1 : 1);
		stem.alignTo = null;
	}

	function clamp(x){ return Math.min(1, Math.max(0, x)) }
	function xclamp(x, low, high){ return Math.min(high, Math.max(low, x)) }
	function calculateWidth(w, mstw){
		mstw = mstw || 1;
		if(w < mstw * uppx) return mstw * uppx;
		else if (w < (1 + mstw) * uppx) return uppx * Math.round(WIDTH_FACTOR_X 
			* (w / uppx / WIDTH_FACTOR_X + clamp((ppem - MIN_ADJUST_PPEM) / (MAX_ADJUST_PPEM - MIN_ADJUST_PPEM)) * (1 - w / uppx / WIDTH_FACTOR_X)));
		else return Math.round(w / uppx) * uppx;
	}

	function atRadicalTop(stem){
		return !stem.hasSameRadicalStemAbove
			&& !(stem.hasRadicalPointAbove && stem.radicalCenterRise > STEM_CENTER_MIN_RISE)
			&& !(stem.hasRadicalLeftAdjacentPointAbove && stem.radicalLeftAdjacentRise > STEM_SIDE_MIN_RISE)
			&& !(stem.hasRadicalRightAdjacentPointAbove && stem.radicalRightAdjacentRise > STEM_SIDE_MIN_RISE)
	}
	function atGlyphTop(stem){
		return atRadicalTop(stem) && !stem.hasGlyphStemAbove
	}
	function atRadicalBottom(stem){
		return !stem.hasSameRadicalStemBelow
			&& !(stem.hasRadicalPointBelow && stem.radicalCenterDescent > STEM_CENTER_MIN_DESCENT)
			&& !(stem.hasRadicalLeftAdjacentPointBelow && stem.radicalLeftAdjacentDescent > STEM_SIDE_MIN_DESCENT)
			&& !(stem.hasRadicalRightAdjacentPointBelow && stem.radicalRightAdjacentDescent > STEM_SIDE_MIN_DESCENT)
	}
	function atGlyphBottom(stem){
		return atRadicalBottom(stem) && !stem.hasGlyphStemBelow
	};

	var avaliables = function(stems){
		var avaliables = []
		for(var j = 0; j < stems.length; j++) {
			var low = roundDown(stems[j].yori) - uppx;
			var high = roundUp(stems[j].yori) + uppx;
			var w = calculateWidth(stems[j].width);
			low = Math.max(low, atGlyphBottom(stems[j]) ? pixelBottom + w : pixelBottom + w + uppx);
			high = Math.min(high, atGlyphTop(stems[j]) ? pixelTop : pixelTop - uppx);
			
			var center = stems[j].yori - stems[j].width / 2 + w / 2;
			if(atGlyphTop(stems[j]) && center > pixelTop - uppx && stems[j].yori - roundDown(center) >= 0.25 * uppx) center = pixelTop;
			if(atGlyphBottom(stems[j]) && center < pixelBottom + w + 0.75 * uppx) center = pixelBottom + w;
			center = xclamp(center, low, high);
			
			var ablationCoeff = atGlyphTop(stems[j]) || atGlyphBottom(stems[j]) ? ABLATION_GLYPH_HARD_EDGE
			                  : !stems[j].hasGlyphStemAbove || !stems[j].hasGlyphStemBelow ? ABLATION_GLYPH_EDGE
			                  : !stems[j].hasSameRadicalStemAbove || !stems[j].hasSameRadicalStemBelow ? ABLATION_RADICAL_EDGE : ABLATION_IN_RADICAL;
			avaliables[j] = {
				low: Math.round(low / uppx),
				high: Math.round(high / uppx), 
				center: center, 
				ablationCoeff: ablationCoeff / uppx,
				proportion: (stems[j].yori - stems[0].yori) / (stems[stems.length - 1].yori - stems[0].yori) || 0
			};
		}
		return avaliables;
	}(stems);

	function initStemTouches(stems, radicals) {
		for(var j = 0; j < stems.length; j++) {
			var w = calculateWidth(stems[j].width);
			stems[j].touchwidth = uppx;
			stems[j].alignTo = null;
			roundDownStem(stems[j])
			if(stems[j].ytouch - roundUp(w) < pixelBottom){
				stems[j].ytouch += uppx;
			} else if(!atGlyphBottom(stems[j]) && stems[j].ytouch - roundUp(w) <= pixelBottom) {
				stems[j].ytouch += uppx;
			}
		}
	}
	var COLLISION_FUZZ = 1.04;
	var HIGHLY_COLLISION_FUZZ = 0.3;
	function collideWith(stems, overlaps, j, k){
		return overlaps[j][k] > COLLISION_MIN_OVERLAP_RATIO && (stems[j].ytouch > stems[k].ytouch 
			? stems[j].ytouch - stems[k].ytouch <= stems[j].touchwidth * COLLISION_FUZZ 
			: stems[k].ytouch - stems[j].ytouch <= stems[k].touchwidth * COLLISION_FUZZ)
	}
	function highlyCollideWith(stems, overlaps, j, k){
		return overlaps[j][k] > COLLISION_MIN_OVERLAP_RATIO && (stems[j].ytouch > stems[k].ytouch 
			? stems[j].ytouch - stems[k].ytouch <= stems[j].touchwidth * HIGHLY_COLLISION_FUZZ 
			: stems[k].ytouch - stems[j].ytouch <= stems[k].touchwidth * HIGHLY_COLLISION_FUZZ)
	}
	function spaceBelow(stems, overlaps, k, bottom){
		var space = stems[k].ytouch - stems[k].touchwidth - bottom;
		for(var j = k - 1; j >= 0; j--){
			if(overlaps[j][k] > COLLISION_MIN_OVERLAP_RATIO && Math.abs(stems[k].ytouch - stems[j].ytouch) - stems[k].touchwidth < space)
				space = stems[k].ytouch - stems[j].ytouch - stems[k].touchwidth
		}
		return space;
	}
	function spaceAbove(stems, overlaps, k, top){
		var space = top - stems[k].ytouch;
		for(var j = k + 1; j < stems.length; j++){
			if(overlaps[k][j] > COLLISION_MIN_OVERLAP_RATIO && Math.abs(stems[j].ytouch - stems[k].ytouch) - stems[j].touchwidth < space)
				space = stems[j].ytouch - stems[k].ytouch - stems[j].touchwidth
		}
		return space;
	}
	function canBeAdjustedUp(stems, overlaps, k, distance){
		for(var j = k + 1; j < stems.length; j++){
			if(overlaps[j][k] > COLLISION_MIN_OVERLAP_RATIO && Math.abs(stems[j].ytouch - stems[k].ytouch) - stems[j].touchwidth <= distance)
				return false
		}
		return true;
	}
	function canBeAdjustedDown(stems, overlaps, k, distance){
		for(var j = 0; j < k; j++){
			if(overlaps[k][j] > COLLISION_MIN_OVERLAP_RATIO && Math.abs(stems[k].ytouch - stems[j].ytouch) - stems[k].touchwidth <= distance)
				return false
		}
		return true;
	}

	function adjustDownward(stems, overlaps, k, bottom){
		var s = spaceBelow(stems, overlaps, k, bottom);
		if(s >= 1.8 * uppx) {
			// There is enough space below stem k, just bring it downward
			if(stems[k].ytouch > Math.max(bottom, avaliables[k].low * uppx)) {
				stems[k].ytouch -= uppx;
				return true;
			}
		}
		for(var j = 0; j < k; j++){
			if(!adjustDownward(stems, overlaps, j, bottom)) return false;
		}
		return false;
	}
	var overlaps = glyph.stemOverlaps;
	// Collision resolving
	function earlyUncollide(stems){
		// In this procedure we move some segment stems to resolve collisions between them.
		// A "collision" means that two stems meet togther after gridfitting.
		// We will merge some of these stems to preserve the outfit of glyph while leaving
		// space between strokes;
		if(!stems.length) return;

		// Step 0a : Adjust bottom stems
		var ytouchmin0 = stems[0].ytouch;
		var ytouchmin = ytouchmin0;
		for(var j = 0; j < stems.length; j++) {
			if(!stems[j].hasRadicalPointBelow && !stems[j].hasGlyphStemBelow && stems[j].roundMethod === -1 && stems[j].ytouch === ytouchmin0 && stems[j].yori - stems[j].touchwidth >= -blueFuzz
				&& stems[j].yori - stems[j].ytouch >= 0.5 * uppx) {
				ytouchmin = ytouchmin0 + uppx;
				stems[j].ytouch += uppx;
			}
		}
		// Avoid stem merging at the bottom
		for(var j = 0; j < stems.length; j++) if(stems[j].ytouch === ytouchmin) for(var k = 0; k < j; k++) {
			if(overlaps[j][k] > COLLISION_MIN_OVERLAP_RATIO && stems[j].roundMethod === -1) roundUpStem(stems[j]);
		}

		// Step 0b : Adjust top stems
		var ytouchmax = stems[stems.length - 1].ytouch;
		for(var j = stems.length - 1; j >= 0; j--) if(!stems[j].hasGlyphStemAbove) {
			var stem = stems[j]
			if(atGlyphTop(stem)) {
				var canAdjustUpToGlyphTop = stem.ytouch < Math.min(avaliables[j].high * uppx, pixelTop - blueFuzz) && stem.ytouch >= pixelTop - uppx - 1;
				if(canAdjustUpToGlyphTop && stem.yori - stem.ytouch >= 0.47 * uppx) {
					// Rounding-related upward adjustment
					stem.ytouch += uppx
				} else if(canAdjustUpToGlyphTop && shouldAddGlyphHeight(stem, ppem, pixelTop, pixelBottom)) {
					// Strategy-based upward adjustment
					stem.ytouch += uppx
				};
				stem.allowMoveUpward = stem.ytouch < pixelTop - blueFuzz;
			} else {
				if(stem.ytouch < pixelTop - blueFuzz - uppx && stem.yori - stem.ytouch >= 0.47 * uppx){
					stem.ytouch += uppx
				}
				stem.allowMoveUpward = stem.ytouch < pixelTop - uppx - blueFuzz
			}
		};

		var ytouchmin = Math.min.apply(Math, stems.map(function(s){ return s.ytouch }));
		var ytouchmax = Math.max.apply(Math, stems.map(function(s){ return s.ytouch }));

		// Step 1: Early Uncollide
		// We will perform stem movement using greedy method
		// Not always works but okay for most characters
		for(var j = 0; j < stems.length; j++) {
			if(stems[j].ytouch <= ytouchmin) { 
				// Stems[j] is a bottom stem
				// DON'T MOVE IT
			} else if(stems[j].ytouch >= ytouchmax) {
				// Stems[j] is a top stem
				// It should not be moved, but we can uncollide stems below it.
				for(var k = j - 1; k >= 0; k--) if(collideWith(stems, overlaps, j, k)) {
					if(highlyCollideWith(stems, overlaps, j, k)) {
						alignStem(stems[k], stems[j])
						continue
					} 
					var r = adjustDownward(stems, overlaps, k, ytouchmin)
					if(r) continue;
					if(stems[j].ytouch < avaliables[j].high * uppx && stems[j].allowMoveUpward) {
						stems[j].ytouch += uppx;
						break;
					}
				}
			} else {
				// Stems[j] is a middle stem
				for(var k = j - 1; k >= 0; k--) if(collideWith(stems, overlaps, j, k)) {
					if(highlyCollideWith(stems, overlaps, j, k)) {
						alignStem(stems[j], stems[k])
						break;
					} 
					var r = adjustDownward(stems, overlaps, k, ytouchmin);
					if(r) continue;
					if(!stems[j].atGlyphTop && stems[j].ytouch < avaliables[j].high * uppx && stems[j].ytouch < pixelTop - blueFuzz) {
						stems[j].ytouch += uppx;
						break;
					}
				}
			}
		};
	};

	function rebalance(stems){
		for(var j = stems.length - 1; j >= 0; j--) if(!atGlyphTop(stems[j]) && !atGlyphBottom(stems[j])) {
			if(canBeAdjustedUp(stems, overlaps, j, 1.75 * uppx) && stems[j].yori - stems[j].ytouch >= 0.6 * uppx) {
				if(stems[j].ytouch < avaliables[j].high * uppx) { stems[j].ytouch += uppx }
			} else if(canBeAdjustedDown(stems, overlaps, j, 1.75 * uppx) && stems[j].ytouch - stems[j].yori >= 0.6 * uppx) {
				if(stems[j].ytouch > avaliables[j].low * uppx) { stems[j].ytouch -= uppx }
			}
		};		
	}

	function potential(y, A, C, S, avaliables) {
		var p = 0;
		var n = y.length;
		var ymin = ppem, ymax = -ppem;
		for(var j = 0; j < n; j++) {
			if(y[j] > ymax) ymax = y[j];
			if(y[j] < ymin) ymin = y[j];
			for(var k = 0; k < j; k++) {
				if(y[j] === y[k]) p += A[j][k]
				else if(y[j] === y[k] + 1 || y[j] + 1 === y[k]) p += C[j][k];
				if(y[j] < y[k]) p += S[j][k]
			};
			p += avaliables[j].ablationCoeff * Math.abs(y[j] * uppx - avaliables[j].center)
		};
		var ymaxt = Math.max(ymax, glyfTop);
		var ymint = Math.min(ymin, glyfBottom);
		var pd = 0
		for(var j = 0; j < y.length; j++) {
			pd += COEFF_PORPORTION_DISTORTION * Math.abs(y[j] - (ymin + avaliables[j].proportion * (ymax - ymin)))
		};
		return p + pd;
	};
	function byPotential(p, q){ return p.potential - q.potential };
	function Entity(y){
		this.gene = y;
		this.potential = potential(y, glyph.collisionMatrices.alignment, glyph.collisionMatrices.collision, glyph.collisionMatrices.swap, avaliables)
	};
	function mutant(y1){
		var rj = Math.floor(Math.random() * y1.length);
		y1[rj] = avaliables[rj].low + Math.floor(Math.random() * (avaliables[rj].high - avaliables[rj].low + 0.999));	
	}

	function evolve(population) {
		var children = [];
		for(var c = 0; c < POPULATION_LIMIT - population.length + CHILDREN_LIMIT; c++) {
			var father = population[Math.floor(Math.random() * population.length)].gene;
			var mother = population[Math.floor(Math.random() * population.length)].gene;
			var y1 = father.slice(0);
			for(var j = 0; j < father.length; j++) if(Math.random() > 0.5) y1[j] = mother[j]
			if(Math.random() < MUTANT_PROBABLITY) mutant(y1)
			children[c] = new Entity(y1)
		};
		return population.concat(children).sort(byPotential).slice(0, POPULATION_LIMIT);
		var p = p1.slice(0, ELITE_COUNT)
		var index = ELITE_COUNT;
		for(var j = ELITE_COUNT; j < POPULATION_LIMIT; j++) {
			if(Math.random() < 0.1) index += 1;
			if(index >= p1.length) break;
			p[j] = p1[index++]
		};
		return p;
	}
	// Collision resolving
	function uncollide(stems){
		// In this procedure we move some segment stems to resolve collisions between them.
		// A "collision" means that two stems meet togther after gridfitting.
		// We will merge some of these stems to preserve the outfit of glyph while leaving
		// space between strokes;
		if(!stems.length) return;

		var n = stems.length;
		var y0 = stems.map(function(s, j){ return xclamp(Math.round(stems[j].ytouch / uppx), avaliables[j].low, avaliables[j].high) });

		var population = [new Entity(y0)];
		for(var j = 0; j < n; j++){
			for(var k = avaliables[j].low; k <= avaliables[j].high; k++) if(k !== y0[j]) {
				var y1 = y0.slice(0);
				y1[j] = k;
				population.push(new Entity(y1));
			}
		}

		for(var s = 0; s < EVOLUTION_STAGES; s++) population = evolve(population)

		// Assign
		for(var j = 0; j < stems.length; j++){
			stems[j].ytouch = population[0].gene[j] * uppx;
			stems[j].touchwidth = uppx;
			stems[j].roundMethod = stems[j].ytouch >= stems[j].yori ? 1 : -1;
		}
	};

	function allocateWidth(stems) {
		var ytouchmin = Math.min.apply(Math, stems.map(function(s){ return s.ytouch }));
		var ytouchmax = Math.max.apply(Math, stems.map(function(s){ return s.ytouch }));
		var allocated = [];
		for(var j = 0; j < stems.length; j++) {
			debugger;
			var sb = spaceBelow(stems, overlaps, j, pixelBottom - uppx);
			var wr = calculateWidth(stems[j].width, MIN_TOUCHED_STEM_WIDTH);
			var w = Math.min(round(wr), round(stems[j].touchwidth + sb - uppx));
			if(w < uppx + 1) continue;
			if(sb + stems[j].touchwidth > wr + uppx - 1 && stems[j].ytouch - wr >= pixelBottom + uppx - 1 || atGlyphBottom(stems[j]) && stems[j].ytouch - wr >= pixelBottom - 1) {
				stems[j].touchwidth = wr;
				allocated[j] = true;
			} else if(stems[j].ytouch - w >= pixelBottom + uppx - 1 || atGlyphBottom(stems[j]) && stems[j].ytouch - w >= pixelBottom - 1) {
				stems[j].touchwidth = w;
				allocated[j] = true;
			}
		};
		for(var j = 0; j < stems.length; j++) if(!allocated[j]){
			var sb = spaceBelow(stems, overlaps, j, pixelBottom - uppx);
			var sa = spaceAbove(stems, overlaps, j, pixelTop);
			var wr = calculateWidth(stems[j].width, MIN_TOUCHED_STEM_WIDTH);
			var w = Math.min(round(wr), round(stems[j].touchwidth + sb + sa - 2 * uppx));
			if(w < uppx + 1) continue;
			if(sa > 1.75 * uppx && stems[j].ytouch < avaliables[j].high * uppx) {
				if(sb + stems[j].touchwidth > wr - 1 && stems[j].ytouch - wr >= pixelBottom - 1 || atGlyphBottom(stems[j]) && stems[j].ytouch + uppx - wr >= pixelBottom - 1) {
					stems[j].touchwidth = wr;
					stems[j].ytouch += uppx;
					allocated[j] = true;
				} else if(stems[j].ytouch - w >= pixelBottom - 1 || atGlyphBottom(stems[j]) && stems[j].ytouch + uppx - w >= pixelBottom - 1) {
					stems[j].touchwidth = w;
					stems[j].ytouch += uppx;
					allocated[j] = true;
				}
			}
		};
	};
	var instructions = {
		roundingStems : [],
		alignedStems : [],
		blueZoneAlignments: [],
		interpolations: []
	};
	// Touching procedure
	function touchStemPoints(stems){
		for(var j = 0; j < stems.length; j++){
			var stem = stems[j], w = stem.touchwidth;
			var topkey = null, bottomkey = null, topaligns = [], bottomaligns = [];
			// Top edge of a stem
			for(var k = 0; k < stem.high.length; k++) for(var p = 0; p < stem.high[k].length; p++) {
				if(p === 0) {
					stem.high[k][p].ytouch = stem.ytouch
					stem.high[k][p].touched = true;
					if(k === 0) {
						stem.high[k][p].keypoint = true;
						topkey = ['ROUND', stem.high[0][0], stem.high[0][0].yori, stem.ytouch]
					} else {
						topaligns.push(['ALIGN0', stem.high[0][0], stem.high[k][0]])
					}
				} else {
					stem.high[k][p].donttouch = true;
				}
			}
			for(var k = 0; k < stem.low.length; k++) for(var p = 0; p < stem.low[k].length; p++) {
				if(p === 0) {
					stem.low[k][p].ytouch = stem.ytouch - w;
					stem.low[k][p].touched = true;
					if(k === 0) {
						if(stem.touchwidth >= round(stem.width) && Math.abs(stem.ytouch - stem.touchwidth - pixelBottom) < 1 && stem.width >= uppx) {
							stem.touchwidth = stem.width;
							stem.low[k][p].keypoint = true;
							topkey = ['ROUND', stem.low[0][0], stem.low[0][0].yori, pixelBottom]
							bottomkey = ['ALIGNW', stem.low[0][0], stem.high[0][0]]
						} else if(stem.touchwidth >= round(stem.width) && stem.ytouch - stem.width >= pixelBottom && stem.width >= uppx) {
							stem.touchwidth = stem.width;
							bottomkey = ['ALIGNW', stem.high[0][0], stem.low[0][0]]
						}
						else bottomkey = ['ALIGNW', stem.high[0][0], stem.low[0][0], stem.touchwidth / uppx]
					} else {
						bottomaligns.push(['ALIGN0', stem.low[0][0], stem.low[k][0]])
					}
				} else {
					stem.low[k][p].donttouch = true;
				}
			};
			instructions.roundingStems.push({
				topkey: topkey,
				bottomkey: bottomkey,
				topaligns: topaligns,
				bottomaligns: bottomaligns
			})
		}
	}

	function touchBlueZonePoints(contours) {
		for(var j = 0; j < contours.length; j++) {
			for(var k = 0; k < contours[j].points.length - 1; k++){
				var point = contours[j].points[k];
				if(point.ytouch <= BLUEZONE_BOTTOM_LIMIT && point.yExtrema && !point.touched && !point.donttouch){
					point.touched = true;
					point.ytouch = pixelBottom;
					point.keypoint = true;
					instructions.blueZoneAlignments.push(['BLUEBOTTOM', point, pixelTop])
				}
				if(point.ytouch >= BLUEZONE_TOP_LIMIT && point.yExtrema && !point.touched && !point.donttouch){
					point.touched = true;
					point.ytouch = pixelTop;
					point.keypoint = true;
					instructions.blueZoneAlignments.push(['BLUETOP', point, pixelTop])
				}
			}
		}
	}
	function interpolate(a, b, c, touch){
		c.touched = touch;
		if(c.yori <= a.yori) c.ytouch = c.yori - a.yori + a.ytouch;
		else if(c.yori >= b.yori)  c.ytouch = c.yori - b.yori + b.ytouch;
		else c.ytouch = (c.yori - a.yori) / (b.yori - a.yori) * (b.ytouch - a.ytouch) + a.ytouch;
		if(touch) {
			instructions.interpolations.push(['IP', a, b, c])
		}
	}
	function interpolatedUntouchedTopBottomPoints(contours){
		var touchedPoints = [];
		for(var j = 0; j < contours.length; j++) for(var k = 0; k < contours[j].points.length; k++) {
			if(contours[j].points[k].touched && contours[j].points[k].keypoint) {
				touchedPoints.push(contours[j].points[k]);
			}
		}
		touchedPoints = touchedPoints.sort(function(p, q){ return p.yori - q.yori });

		for(var j = 0; j < contours.length; j++) {
			var contourExtrema = [];
			for(var k = 0; k < contours[j].points.length; k++) {
				var point = contours[j].points[k]
				if(point.yExtrema && !point.touched) {
					contourExtrema.push(point);
				}
			};
			for(var k = 0; k < contourExtrema.length; k++) {
				for(var m = 1; m < touchedPoints.length; m++) {
					if(touchedPoints[m].yori > contourExtrema[k].yori && touchedPoints[m - 1].yori <= contourExtrema[k].yori) {
						interpolate(touchedPoints[m - 1], touchedPoints[m], contourExtrema[k], true);
						break;
					}
				}
			}
		}
	}
	// IUPy interpolates untouched points just like TT instructions.
	function IUPy(contours){
		for(var j = 0; j < contours.length; j++){
			var contour = contours[j];
			var k = 0;
			while(k < contour.points.length && !contour.points[k].touched) k++;
			if(contour.points[k]) {
				// Found a touched point in contour
				var kleft = k, k0 = k;
				var untoucheds = []
				for(var k = 0; k <= contour.points.length; k++){
					var ki = (k + k0) % contour.points.length;
					if(contour.points[ki].touched){
						var pleft = contour.points[kleft];
						var pright = contour.points[ki];
						var lower = pleft.yori < pright.yori ? pleft : pright
						var higher = pleft.yori < pright.yori ? pright : pleft
						for(var w = 0; w < untoucheds.length; w++) interpolate(lower, higher, untoucheds[w])
						untoucheds = []
						kleft = ki;
					} else {
						untoucheds.push(contour.points[ki])
					}
				}
			}
		}
	}

	function untouchAll(contours) {
		for(var j = 0; j < contours.length; j++) for(var k = 0; k < contours[j].points.length; k++) {
			contours[j].points[k].touched = false;
			contours[j].points[k].donttouch = false;
			contours[j].points[k].ytouch = contours[j].points[k].yori;
		}
	}

	untouchAll(contours);
	initStemTouches(stems, glyph.radicals);
	earlyUncollide(stems);
//	rebalance(stems);
	uncollide(stems);
	rebalance(stems);
	allocateWidth(stems);
	touchStemPoints(stems);
	touchBlueZonePoints(contours);
	interpolatedUntouchedTopBottomPoints(contours);
	IUPy(contours);
	
	return {
		contours: contours,
		instructions: instructions
	}

}

exports.hint = hint;