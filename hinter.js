function hint(glyph, ppem, strategy) {
	var upm							= strategy.UPM || 1000;

	var MIN_STEM_WIDTH         		= strategy.MIN_STEM_WIDTH;
	var MAX_STEM_WIDTH         		= strategy.MAX_STEM_WIDTH;
	var STEM_SIDE_MIN_RISE     		= strategy.STEM_SIDE_MIN_RISE || strategy.MIN_STEM_WIDTH;
	var STEM_CENTER_MIN_RISE   		= strategy.STEM_CENTER_MIN_RISE || STEM_SIDE_MIN_RISE;
	var STEM_SIDE_MIN_DESCENT  		= strategy.STEM_SIDE_MIN_DESCENT || strategy.MIN_STEM_WIDTH;
	var STEM_CENTER_MIN_DESCENT		= strategy.STEM_CENTER_MIN_DESCENT || STEM_SIDE_MIN_DESCENT;

	var POPULATION_LIMIT 			= strategy.POPULATION_LIMIT || 200;
	var CHILDREN_LIMIT   			= strategy.CHILDREN_LIMIT || 100;
	var EVOLUTION_STAGES 			= strategy.EVOLUTION_STAGES || 15;
	var MUTANT_PROBABLITY			= strategy.MUTANT_PROBABLITY || 0.4;
	var ELITE_COUNT      			= strategy.ELITE_COUNT || 10;

	var blueFuzz					= strategy.BLUEZONE_WIDTH || 15;

	var WIDTH_FACTOR_X             	= strategy.WIDTH_FACTOR_X || 2;
	var MIN_ADJUST_PPEM            	= strategy.MIN_ADJUST_PPEM || 16;
	var MAX_ADJUST_PPEM            	= strategy.MAX_ADJUST_PPEM || 32;
	var COLLISION_MIN_OVERLAP_RATIO	= strategy.COLLISION_MIN_OVERLAP_RATIO || 0.2;

	var PPEM_STEM_WIDTH_GEARS		= strategy.PPEM_STEM_WIDTH_GEARS || [[0, 1, 1], [13, 1, 2], [21, 2, 2], [27, 2, 3], [32, 3, 3]];
	var WIDTH_GEAR_LOW, WIDTH_GEAR_HIGH = 999;
	for(var j = 0; j < PPEM_STEM_WIDTH_GEARS.length; j++){
		WIDTH_GEAR_LOW = PPEM_STEM_WIDTH_GEARS[j][1];
		if(j + 1 < PPEM_STEM_WIDTH_GEARS.length && PPEM_STEM_WIDTH_GEARS[j][0] <= ppem && PPEM_STEM_WIDTH_GEARS[j + 1][0] > ppem) {
			WIDTH_GEAR_HIGH = PPEM_STEM_WIDTH_GEARS[j][2];
			break;
		}
	};

	var ABLATION_IN_RADICAL     	= strategy.ABLATION_IN_RADICAL || 1;
	var ABLATION_RADICAL_EDGE   	= strategy.ABLATION_RADICAL_EDGE || 2;
	var ABLATION_GLYPH_EDGE     	= strategy.ABLATION_GLYPH_EDGE || 15;
	var ABLATION_GLYPH_HARD_EDGE	= strategy.ABLATION_GLYPH_HARD_EDGE || 25;
	
	var COEFF_PORPORTION_DISTORTION = strategy.COEFF_PORPORTION_DISTORTION || 4;

	var BLUEZONE_BOTTOM_CENTER		= strategy.BLUEZONE_BOTTOM_CENTER || -75;
	var BLUEZONE_TOP_CENTER   		= strategy.BLUEZONE_TOP_CENTER || 840;
	var BLUEZONE_BOTTOM_LIMIT 		= strategy.BLUEZONE_BOTTOM_LIMIT || -65;
	var BLUEZONE_TOP_LIMIT    		= strategy.BLUEZONE_TOP_LIMIT || 825;

	var DONT_ADJUST_STEM_WIDTH = strategy.DONT_ADJUST_STEM_WIDTH || false;


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
	function calculateWidth(w){
		if(w <= WIDTH_GEAR_LOW * uppx) return WIDTH_GEAR_LOW * uppx;
		else if (!DONT_ADJUST_STEM_WIDTH && w < Math.min(WIDTH_GEAR_LOW + 1, WIDTH_GEAR_HIGH) * uppx) 
			return uppx * Math.max(WIDTH_GEAR_LOW, Math.min(WIDTH_GEAR_HIGH, Math.round(
				WIDTH_FACTOR_X * (w / uppx / WIDTH_FACTOR_X + clamp((ppem - MIN_ADJUST_PPEM) / (MAX_ADJUST_PPEM - MIN_ADJUST_PPEM)) * (1 - w / uppx / WIDTH_FACTOR_X)))));
		else return Math.max(WIDTH_GEAR_LOW, Math.min(WIDTH_GEAR_HIGH, Math.round(w / uppx))) * uppx;
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
			if(atGlyphTop(stems[j])) {
				var yrdtg = roundDown(stems[j].yori)
				var canAdjustUpToGlyphTop = yrdtg < Math.min(high * uppx, pixelTop - blueFuzz) && yrdtg >= pixelTop - uppx - 1;
				if(canAdjustUpToGlyphTop && stems[j].yori - yrdtg >= 0.47 * uppx) {
					// Rounding-related upward adjustment
					center = yrdtg + uppx
				} else if(canAdjustUpToGlyphTop && stems[j].yori - yrdtg >= 0.25 * uppx) {
					// Strategy-based upward adjustment
					center = yrdtg + uppx
				};
			} 
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
	
	// Pass 1. Early Uncollide
	// In this pass we move stems to avoid collisions between them.
	// This pass is deterministic, and its result will be used as the seed in the next
	// pass.
	function earlyUncollide(stems){
		if(!stems.length) return;

		// Adjust bottom stems
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

		// Adjust top stems
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

		// Uncollide
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

	function collidePotential(y, A, C, S, avaliables) {
		var p = 0;
		var n = y.length;
		for(var j = 0; j < n; j++) {
			for(var k = 0; k < j; k++) {
				if(y[j] === y[k]) p += A[j][k]
				else if(y[j] === y[k] + 1 || y[j] + 1 === y[k]) p += C[j][k];
				if(y[j] < y[k] || Math.abs(avaliables[j].center - avaliables[k].center) < 4 && y[j] !== y[k]) p += S[j][k]
			};
		};
		return p;	
	}
	function ablationPotential(y, A, C, S, avaliables) {
		var p = 0;
		var n = y.length;
		var ymin = ppem, ymax = -ppem;
		for(var j = 0; j < n; j++) {
			if(y[j] > ymax) ymax = y[j];
			if(y[j] < ymin) ymin = y[j];
		}
		var ymaxt = Math.max(ymax, glyfTop);
		var ymint = Math.min(ymin, glyfBottom);
		for(var j = 0; j < y.length; j++) {
			p += avaliables[j].ablationCoeff * Math.abs(y[j] * uppx - avaliables[j].center)
			p += COEFF_PORPORTION_DISTORTION * Math.abs(y[j] - (ymin + avaliables[j].proportion * (ymax - ymin)))
		};
		return p;
	};
	function byPotential(p, q){ return p.collidePotential + p.ablationPotential - q.collidePotential - q.ablationPotential };
	function Organism(y){
		this.gene = y;
		this.collidePotential = collidePotential(y, glyph.collisionMatrices.alignment, glyph.collisionMatrices.collision, glyph.collisionMatrices.swap, avaliables)
		this.ablationPotential = ablationPotential(y, glyph.collisionMatrices.alignment, glyph.collisionMatrices.collision, glyph.collisionMatrices.swap, avaliables)
	};
	function birth(father, mother){
		var y1 = father.slice(0);
		var lastChoosedMother = false;
		 if(Math.random() > 0.5) {
		 	y1[0] = mother[0];
		 	lastChoosedMother = true;
		 }
		for(var j = 1; j < father.length; j++) { 
			if(symmetricQ(j, j - 1)) {
				y1[j] = lastChoosedMother ? mother[j] : father[j]
			} else {
				if(Math.random() > 0.5) { y1[j] = mother[j]; lastChoosedMother = true }
				else lastChoosedMother = false
			}
		}
		if(Math.random() < MUTANT_PROBABLITY) mutant(y1)
		return new Organism(y1);
	};
	function symmetricQ(j, k){
		return Math.abs(avaliables[j].center - avaliables[k].center) < 4
	}
	function mutantAt(y1, rj, pos){
		y1[rj] = pos;
		for(var j = rj + 1; j < y1.length && symmetricQ(j, rj); j++) y1[j] = y1[rj]
		for(var j = rj - 1; j >= 0 && symmetricQ(j, rj); j--) y1[j] = y1[rj]
	};
	function mutant(y1){
		var rj = Math.floor(Math.random() * y1.length);
		mutantAt(y1, rj, avaliables[rj].low + Math.floor(Math.random() * (avaliables[rj].high - avaliables[rj].low + 0.999)))
	}
	function dedup(pop){
		var res = [pop[0]];
		for(var j = 1; j < pop.length; j++) if(pop[j].potential !== pop[j - 1].potential) res.push(pop[j]);
		return res;
	};
	function sqr(x){ return x }

	function evolve(population) {
		var children = [];
		for(var c = 0; c < POPULATION_LIMIT - population.length + CHILDREN_LIMIT; c++) {
			var father = population[Math.floor(sqr(Math.random()) * population.length)].gene;
			var mother = population[Math.floor(sqr(Math.random()) * population.length)].gene;
			var y1 = father.slice(0);
			for(var j = 0; j < father.length; j++) if(Math.random() > 0.5) y1[j] = mother[j]
			if(Math.random() < MUTANT_PROBABLITY) mutant(y1)
			children[c] = new Organism(y1)
		};
		return dedup(population.concat(children).sort(byPotential)).slice(0, POPULATION_LIMIT);
	}
	// Pass 2 : Uncollide
	// In this pass a genetic algorithm take place to optimize stroke placements of the glyph.
	// The optimization target is the "collision potential" evaluated using stroke position
	// state vector |y>. Due to randomized mutations, the result is not deterministic, though
	// reliable under most cases.
	function uncollide(stems){

		if(!stems.length) return;

		var n = stems.length;
		var y0 = stems.map(function(s, j){ return xclamp(Math.round(stems[j].ytouch / uppx), avaliables[j].low, avaliables[j].high) });

		var population = [new Organism(y0)];
		for(var j = 0; j < n; j++){
			for(var k = avaliables[j].low; k <= avaliables[j].high; k++) if(k !== y0[j]) {
				var y1 = y0.slice(0);
				mutantAt(y1, j, k)
				population.push(new Organism(y1));
			}
		}

		for(var s = 0; s < EVOLUTION_STAGES; s++) {
			population = evolve(population);
		}
		
		// Assign
		for(var j = 0; j < stems.length; j++){
			stems[j].ytouch = population[0].gene[j] * uppx;
			//stems[j].touchwidth = uppx;
			stems[j].roundMethod = stems[j].ytouch >= stems[j].yori ? 1 : -1;
		}
	};

	// Pass 3 : Rebalance
	function rebalance(stems){
		for(var j = stems.length - 1; j >= 0; j--) if(!atGlyphTop(stems[j]) && !atGlyphBottom(stems[j])) {
			if(canBeAdjustedUp(stems, overlaps, j, 1.75 * uppx) && stems[j].yori - stems[j].ytouch >= 0.6 * uppx) {
				if(stems[j].ytouch < avaliables[j].high * uppx) { stems[j].ytouch += uppx }
			} else if(canBeAdjustedDown(stems, overlaps, j, 1.75 * uppx) && stems[j].ytouch - stems[j].yori >= 0.6 * uppx) {
				if(stems[j].ytouch > avaliables[j].low * uppx) { stems[j].ytouch -= uppx }
			}
		};		
	}

	// Pass 4 : Width allocation
	function allocateWidth(stems) {
		var ytouchmin = Math.min.apply(Math, stems.map(function(s){ return s.ytouch }));
		var ytouchmax = Math.max.apply(Math, stems.map(function(s){ return s.ytouch }));
		var allocated = [];
		var properWidths = [];
		for(var j = 0; j < stems.length; j++) {
			properWidths[j] = calculateWidth(stems[j].width)
		};

		function allocateDown(j){
			var sb = spaceBelow(stems, overlaps, j, pixelBottom - uppx);
			var wr = properWidths[j];
			var w = Math.min(wr, round(stems[j].touchwidth + sb - uppx));
			if(w < uppx + 1) return;
			if(sb + stems[j].touchwidth > wr + uppx - 1 && stems[j].ytouch - wr >= pixelBottom + uppx - 1 || atGlyphBottom(stems[j]) && stems[j].ytouch - wr >= pixelBottom - 1) {
				stems[j].touchwidth = wr;
				allocated[j] = true;
			} else if(stems[j].ytouch - w >= pixelBottom + uppx - 1 || atGlyphBottom(stems[j]) && stems[j].ytouch - w >= pixelBottom - 1) {
				stems[j].touchwidth = w;
				allocated[j] = true;
			}
		};
		function allocateUp(j){
			var sb = spaceBelow(stems, overlaps, j, pixelBottom - uppx);
			var sa = spaceAbove(stems, overlaps, j, pixelTop + uppx);
			var wr = properWidths[j];
			var w = Math.min(wr, round(stems[j].touchwidth + sb + sa - 2 * uppx));
			if(w < uppx + 1) return;
			if(sa > 1.75 * uppx && stems[j].ytouch < avaliables[j].high * uppx && (atGlyphTop(stems[j]) || stems[j].ytouch < ytouchmax)) {
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
		}

		// Allowcate top and bottom stems
		for(var j = 0; j < stems.length; j++) if((atGlyphTop(stems[j]) || atGlyphBottom(stems[j])) && !allocated[j]){ allocateDown(j) };   		
		for(var j = stems.length - 1; j >= 0; j--) if((atGlyphTop(stems[j]) || atGlyphBottom(stems[j])) && !allocated[j]){ allocateUp(j) };		
		// Allocate stem width downward
		for(var j = 0; j < stems.length; j++) if(!(atGlyphTop(stems[j]) || atGlyphBottom(stems[j])) && !allocated[j]) { allocateDown(j) };
		// Allocate stem width upward
		for(var j = stems.length - 1; j >= 0; j--) if(!(atGlyphTop(stems[j]) || atGlyphBottom(stems[j])) && !allocated[j]) { allocateUp(j) };
	};
	var instructions = {
		roundingStems : [],
		alignedStems : [],
		blueZoneAlignments: [],
		interpolations: []
	};
	// Touching procedure
	function touchStemPoints(stems) {
		for(var j = 0; j < stems.length; j++){
			var stem = stems[j], w = stem.touchwidth;
			var topkey = null, bottomkey = null, topaligns = [], bottomaligns = [];
			var sb = spaceBelow(stems, overlaps, j, pixelBottom - uppx);
			var sa = spaceAbove(stems, overlaps, j, pixelTop + uppx);

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
			};

			// Bottom edge of a stem
			for(var k = 0; k < stem.low.length; k++) for(var p = 0; p < stem.low[k].length; p++) {
				if(p === 0) {
					stem.low[k][p].ytouch = stem.ytouch - w;
					stem.low[k][p].touched = true;
					if(k === 0) {
						stem.low[k][p].keypoint = true;
						var canUseMdrp = stem.touchwidth >= stem.width && stem.touchwidth - stem.width <= 0.48 * uppx
						              || stem.width > stem.touchwidth && stem.width - stem.touchwidth <= 0.48 * uppx && (sb >= 1.75 * uppx || atGlyphBottom(stem) && sa >= 1.75 * uppx);

						if(canUseMdrp && (stem.ytouch - stem.width >= pixelBottom || atGlyphBottom(stem))) {
							if(atGlyphBottom(stem)) {
								topkey = ['ROUND', stem.low[0][0], stem.low[0][0].yori, stem.ytouch - stem.touchwidth]
								bottomkey = ['ALIGNW', stem.low[0][0], stem.high[0][0], stem.width / uppx]
							} else {
								bottomkey = ['ALIGNW', stem.high[0][0], stem.low[0][0], stem.width / uppx];
							}
							stem.touchwidth = stem.width;
						} else {
							if(atGlyphBottom(stem)) {
								topkey = ['ROUND', stem.low[0][0], stem.low[0][0].yori, stem.ytouch - stem.touchwidth]
								bottomkey = ['ALIGNW', stem.low[0][0], stem.high[0][0], stem.width / uppx, Math.round(stem.touchwidth / uppx)]
							} else {
							 	bottomkey = ['ALIGNW', stem.high[0][0], stem.low[0][0], stem.width / uppx, Math.round(stem.touchwidth / uppx)]
							}							
						}
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
	function BY_YORI(p, q){ return p.yori - q.yori }

	function interpolateByKeys(pts, keys){
		for(var k = 0; k < pts.length; k++) if(!pts[k].touched) {
			for(var m = 1; m < keys.length; m++) {
				if(keys[m].yori > pts[k].yori && keys[m - 1].yori <= pts[k].yori) {
					interpolate(keys[m - 1], keys[m], pts[k], 'IP');
					break;
				}
			}
		}
	}
	function interpolatedUntouchedTopBottomPoints(contours) {
		var glyphKeypoints = [];
		for(var j = 0; j < contours.length; j++) for(var k = 0; k < contours[j].points.length; k++) {
			if(contours[j].points[k].touched && contours[j].points[k].keypoint) {
				glyphKeypoints.push(contours[j].points[k]);
			}
		}
		glyphKeypoints = glyphKeypoints.sort(BY_YORI);

		for(var j = 0; j < contours.length; j++) {
			var contourpoints = contours[j].points
			var contourKeypoints = contourpoints.filter(function(p){ return p.touched});
			if(contourKeypoints.length >= 2) {
				var k0 = contourpoints.indexOf(contourKeypoints[0]);
				var keyk = 0;
				for(var k_ = k0; k_ < contourpoints.length + k0; k_++){
					var k = k_ % contourpoints.length;
					if(contourpoints[k] === contourKeypoints[keyk + 1]) {
						keyk += 1;
					} else if(contourpoints[k].yori >= contourKeypoints[keyk].yori && contourpoints[k].yori <= contourKeypoints[(keyk + 1) % contourKeypoints.length].yori || contourpoints[k].yori <= contourKeypoints[keyk].yori && contourpoints[k].yori >= contourKeypoints[(keyk + 1) % contourKeypoints.length].yori) {
						contourpoints[k].donttouch = true;
					}
				}
			}

			var contourExtrema = [];
			for(var k = 0; k < contours[j].points.length; k++) {
				var point = contours[j].points[k]
				if(point.yExtrema && !point.touched && !point.donttouch) {
					contourExtrema.push(point);
				}
			};
			if(contourKeypoints.length > 1) { interpolateByKeys(contourExtrema, contourKeypoints.sort(BY_YORI)) }
			interpolateByKeys(contourExtrema, glyphKeypoints)
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
	};

	untouchAll(contours);
	(function(){
		var y0 = avaliables.map(function(a){ return Math.round(a.center / uppx) });
		var y0min = y0[0];
		var y0max = y0[y0.length - 1];
		for(var j = 0; j < stems.length; j++){
			y0[j] = xclamp(Math.round(y0min + (y0max - y0min) * avaliables[j].proportion), avaliables[j].low, avaliables[j].high)
		}
		var og = new Organism(y0);
		if(og.collidePotential <= 0) {
			for(var j = 0; j < stems.length; j++){
				stems[j].ytouch = og.gene[j] * uppx;
				stems[j].touchwidth = uppx;
				stems[j].roundMethod = stems[j].ytouch >= stems[j].yori ? 1 : -1;
			}
		} else {
			initStemTouches(stems, glyph.radicals);
			earlyUncollide(stems);
			uncollide(stems);
		}
	})();
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