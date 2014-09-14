var MIN_OVERLAP_RATIO = 0.3;
var MIN_STEM_OVERLAP_RATIO = 0.2;
var Y_FUZZ = 7
var SLOPE_FUZZ = 0.04

function findStems(glyph, strategy) {
	

	var upm = strategy.UPM || 1000;

	var MIN_STEM_WIDTH = strategy.MIN_STEM_WIDTH || 20;
	var MAX_STEM_WIDTH = strategy.MAX_STEM_WIDTH || 120;
	var STEM_SIDE_MIN_RISE = strategy.STEM_SIDE_MIN_RISE || strategy.MIN_STEM_WIDTH;
	var STEM_CENTER_MIN_RISE = strategy.STEM_CENTER_MIN_RISE || STEM_SIDE_MIN_RISE;
	var STEM_SIDE_MIN_DESCENT = strategy.STEM_SIDE_MIN_DESCENT || strategy.MIN_STEM_WIDTH;
	var STEM_CENTER_MIN_DESCENT = strategy.STEM_CENTER_MIN_DESCENT || STEM_SIDE_MIN_DESCENT;

	var blueFuzz = strategy.BLUEZONE_WIDTH || 15;
	var COEFF_A_MULTIPLIER = strategy.COEFF_A_MULTIPLIER || 5;
	var COEFF_A_SAME_RADICAL = strategy.COEFF_A_SAME_RADICAL || 4;
	var COEFF_A_FEATURE_LOSS = strategy.COEFF_A_FEATURE_LOSS || 15;
	var COEFF_A_RADICAL_MERGE = strategy.COEFF_A_RADICAL_MERGE || 1;
	var COEFF_C_MULTIPLIER = strategy.COEFF_C_MULTIPLIER || 25;
	var COEFF_C_SAME_RADICAL = strategy.COEFF_C_SAME_RADICAL || 3;
	var COEFF_S = strategy.COEFF_S || 500;
	var COEFF_A_SYMMETRY = strategy.COEFF_A_SYMMETRY || -40;

	var COLLISION_MIN_OVERLAP_RATIO = strategy.COLLISION_MIN_OVERLAP_RATIO || 0.2;

	function overlapInfo(a, b){ 
		var events = []
		for(var j = 0; j < a.length; j++){
			var low = Math.min(a[j][0].xori, a[j][a[j].length - 1].xori)
			var high = Math.max(a[j][0].xori, a[j][a[j].length - 1].xori)
			events.push({at: low, on: true, a: true})
			events.push({at: high, on: false, a: true})
		}
		var probeb = new Array(upm);
		for(var j = 0; j < b.length; j++){
			var low = Math.min(b[j][0].xori, b[j][b[j].length - 1].xori)
			var high = Math.max(b[j][0].xori, b[j][b[j].length - 1].xori)
			events.push({at: low, on: true, a: false})
			events.push({at: high, on: false, a: false})
		}
		events.sort(function(p, q){ return p.at - q.at })
		var len = 0, la = 0, lb = 0;
		var st = 0, sa = 0, sb = 0;
		var ac = 0;
		var bc = 0;
		for(var j = 0; j < events.length; j++){
			var e = events[j]
			var intersectBefore = ac * bc;
			var ab = ac, bb = bc;
			if(e.a) { if(e.on) ac += 1; else ac -= 1 }
			else    { if(e.on) bc += 1; else bc -= 1 }
			if(ac * bc && !intersectBefore) st = e.at;
			if(!(ac * bc) && intersectBefore) len += e.at - st;
			if(ac && !ab) sa = e.at;
			if(!ac && ab) la += e.at - sa;
			if(bc && !bb) sb = e.at;
			if(!bc && bb) lb += e.at - sb;
		};
		return {
			len: len, 
			la: la, 
			lb: lb
		}
	}

	function overlapRatio(a, b){
		var i = overlapInfo(a, b)
		return i.len / Math.max(i.la, i.lb)
	}

	function enoughOverlapBetweenSegments(a, b, ratio){
		return overlapRatio(a, b) >= ratio
	}
	function stemOverlapRatio(a, b){
		return Math.max(overlapRatio(a.low, b.low), overlapRatio(a.high, b.low), overlapRatio(a.low, b.high), overlapRatio(a.high, b.high))
	}
	function stemOverlapLength(a, b){
		return Math.max(overlapInfo(a.low, b.low).len, overlapInfo(a.high, b.low).len, overlapInfo(a.low, b.high).len, overlapInfo(a.high, b.high).len) / upm
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

	function statGlyph(contours){
		var points = []
		points = points.concat.apply(points, contours.map(function(c){ return c.points }));
		var ys = points.map(function(p){ return p.yori })
		var xs = points.map(function(p){ return p.xori })
		return {
			xmax: Math.max.apply(Math, xs),
			ymax: Math.max.apply(Math, ys),
			xmin: Math.min.apply(Math, xs),
			ymin: Math.min.apply(Math, ys)
		}
	}
	function rootof(radical){
		if(radical.root === radical) return radical;
		else {
			// Path compression
			var r = rootof(radical.root);
			radical.root = r;
			return r;
		}
	};
	function inclusionToRadicals(inclusions, contours, j, orient){
		if(orient) {
			// contours[j] is an inner contour
			// find out radicals inside it
			var radicals = []
			for(var k = 0; k < contours.length; k++) if(inclusions[j][k]) {
				if(contours[k].ccw !== orient) {
					radicals = radicals.concat(inclusionToRadicals(inclusions, contours, k, !orient))
				}
			};
			return radicals
		} else {
			// contours[j] is an outer contour
			// find out its inner contours and radicals inside it
			var radical = { parts: [contours[j]], outline: contours[j], subs: [] };
			var radicals = [radical];
			for(var k = 0; k < contours.length; k++) if(inclusions[j][k]) {
				if(contours[k].ccw !== orient) {
					radical.parts.push(contours[k]);
					var inner = inclusionToRadicals(inclusions, contours, k, !orient);
					radical.subs = inner;
					radicals = radicals.concat(inner);
				}
			};
			return radicals
		}
	};
	function transitiveReduce(g) {
		// Floyd-warshall transitive reduction
		for(var x = 0; x < g.length; x++) for(var y = 0; y < g.length; y++) for(var z = 0; z < g.length; z++) {
			if(g[x][y] && g[y][z]) g[x][z] = false;
		}
	}
	function findRadicals(contours){
		var inclusions = [];
		var radicals = []
		for(var j = 0; j < contours.length; j++){
			inclusions[j] = [];
			contours[j].outline = true;
		}
		// Find out all inclusion relationships
		for(var j = 0; j < contours.length; j++) {
			for(var k = 0; k < contours.length; k++) {
				if(j !== k && contours[j].includes(contours[k])) {
					inclusions[j][k] = true;
					contours[k].outline = false;
				}
			}
		};
		// Transitive reduction
		transitiveReduce(inclusions);
		// Figure out radicals
		for(var j = 0; j < contours.length; j++) if(contours[j].outline) {
			radicals = radicals.concat(inclusionToRadicals(inclusions, contours, j, contours[j].ccw))
		};
		return radicals;
	};

	// Stemfinding
	function findHorizontalSegments(radicals){
		var segments = []
		for(var r = 0; r < radicals.length; r++) {
			radicals[r].mergedSegments = []
			for(var j = 0; j < radicals[r].parts.length; j++){
				var contour = radicals[r].parts[j];
				var lastPoint = contour.points[0]
				var segment = [lastPoint];
				segment.radical = r;
				for(var k = 1; k < contour.points.length - 1; k++) if(!contour.points[k].interpolated) {
					if(Math.abs((contour.points[k].yori - lastPoint.yori) / (contour.points[k].xori - lastPoint.xori)) <= SLOPE_FUZZ) {
						segment.push(contour.points[k])
					} else {
						if(segment.length > 1) segments.push(segment)
						lastPoint = contour.points[k];
						segment = [lastPoint]
						segment.radical = r;
					}
				};
				if(Math.abs((contour.points[0].yori - lastPoint.yori) / (contour.points[0].xori - lastPoint.xori)) <= SLOPE_FUZZ) {
					segment.push(contour.points[0])
					segment.push(contour.points[contour.points.length - 1])
				}
				if(segment.length > 1) segments.push(segment)
			}
		}

		segments = segments.sort(function(p, q){ return p.xori - q.xori })

		for(var j = 0; j < segments.length; j++) if(segments[j]){
			var pivot = [segments[j]];
			var pivotRadical = segments[j].radical;
			var orientation = pivot[0][1].xori > pivot[0][0].xori
			segments[j] = null;
			for(var k = j + 1; k < segments.length; k++) if(segments[k] && Math.abs(segments[k][0].yori - pivot[0][0].yori) <= Y_FUZZ && segments[k].radical === pivotRadical && orientation === (segments[k][1].xori > segments[k][0].xori)){
				var r = pivot.radical;
				pivot.push(segments[k])
				segments[k] = null;
			}
			radicals[pivotRadical].mergedSegments.push(pivot.sort(function(s1, s2){
				return orientation ? s1[0].xori - s2[0].xori : s2[0].xori - s1[0].xori}))
		}
	}

	function pairSegments(radicals){
		var stems = [];
		for(var r = 0; r < radicals.length; r++) {
			var radicalStems = [];
			var segs = radicals[r].mergedSegments.sort(function(a, b){ return a[0][0].yori - b[0][0].yori});
			var ori = radicals[r].outline.ccw;
			// We stem segments bottom-up.
			for(var j = 0; j < segs.length; j++) if(segs[j] && ori === (segs[j][0][0].xori < segs[j][0][segs[j][0].length - 1].xori)) {
				var stem = {low: segs[j]};
				for(var k = j + 1; k < segs.length; k++) if(segs[k] && overlapRatio(segs[j], segs[k]) >= MIN_OVERLAP_RATIO) {
					if(ori !== (segs[k][0][0].xori < segs[k][0][segs[k][0].length - 1].xori)
							&& segs[k][0][0].yori - segs[j][0][0].yori <= MAX_STEM_WIDTH
							&& segs[k][0][0].yori - segs[j][0][0].yori >= MIN_STEM_WIDTH) {
						// A stem is found
						stem.high = segs[k];
						stem.yori = stem.high[0][0].yori;
						stem.width = Math.abs(segs[k][0][0].yori - segs[j][0][0].yori);
						stem.atGlyphTop = stem.high[0][0].yori >= stats.ymax - blueFuzz;
						stem.atGlyphBottom = stem.high[0][0].yori - stem.width <= stats.ymin + blueFuzz;
						stem.belongRadical = radicals[r];
						segs[j] = segs[k] = null;
						radicalStems.push(stem);
					}
					break;
				}
			};
			stems = stems.concat(radicalStems)
			radicals[r].stems = radicalStems;
		}
		return stems.sort(function(a, b){ return a.yori - b.yori });
	};

	// Spatial relationship analyzation
	function analyzePointToStemSpatialRelationships(stem, radical){
		var a0 = stem.low[0][0].xori, az = stem.low[stem.low.length - 1][stem.low[stem.low.length - 1].length - 1].xori
		var b0 = stem.high[0][0].xori, bz = stem.high[stem.high.length - 1][stem.high[stem.high.length - 1].length - 1].xori
		var xmin = Math.min(a0, b0, az, bz), xmax = Math.max(a0, b0, az, bz);
		for(var j = 0; j < radical.parts.length; j++) for(var k = 0; k < radical.parts[j].points.length - 1; k++) {
			var point = radical.parts[j].points[k];
			if(point.yori > stem.yori && point.xori < xmax - blueFuzz && point.xori > xmin + blueFuzz) {
				stem.hasRadicalPointAbove = true;
				stem.radicalCenterRise = Math.max(stem.radicalCenterRise || 0, point.yori - stem.yori)
			}
			if(point.yori > stem.yori && point.xori >= xmax - blueFuzz) {
				stem.hasRadicalRightAdjacentPointAbove = true;
				stem.radicalRightAdjacentRise = Math.max(stem.radicalRightAdjacentRise || 0, point.yori - stem.yori)
			}
			if(point.yori > stem.yori && point.xori <= xmin + blueFuzz) {
				stem.hasRadicalLeftAdjacentPointAbove = true;
				stem.radicalLeftAdjacentRise = Math.max(stem.radicalLeftAdjacentRise || 0, point.yori - stem.yori)
			}
			if(point.yori < stem.yori - stem.width && point.xori < xmax - blueFuzz && point.xori > xmin + blueFuzz) {
				stem.hasRadicalPointBelow = true;
				stem.radicalCenterDescent = Math.max(stem.radicalCenterDescent || 0, stem.yori - stem.width - point.yori)
			}
			if(point.yori < stem.yori - stem.width && point.xori >= xmax - blueFuzz) {
				stem.hasRadicalRightAdjacentPointBelow = true;
				stem.radicalRightAdjacentDescent = Math.max(stem.radicalRightAdjacentDescent || 0, stem.yori - stem.width - point.yori)
			}
			if(point.yori < stem.yori - stem.width && point.xori <= xmin + blueFuzz) {
				stem.hasRadicalLeftAdjacentPointBelow = true;
				stem.radicalLeftAdjacentDescent = Math.max(stem.radicalLeftAdjacentDescent || 0, stem.yori - stem.width - point.yori)
			}
		}
		stem.xmin = xmin;
		stem.xmax = xmax;
	}
	function analyzeStemSpatialRelationships(stems, overlaps) {
		for(var k = 0; k < stems.length; k++) {
			analyzePointToStemSpatialRelationships(stems[k], stems[k].belongRadical);
			for(var j = 0; j < stems.length; j++) {
				if(overlaps[j][k] > COLLISION_MIN_OVERLAP_RATIO && stems[j].yori > stems[k].yori) {
					stems[k].hasGlyphStemAbove = true;
					stems[j].hasGlyphStemBelow = true;
					if(stems[j].belongRadical === stems[k].belongRadical) {
						stems[j].hasSameRadicalStemBelow = true;
						stems[k].hasSameRadicalStemAbove = true;
					}
				}
			}
		}
	};

	// Collision matrices, used to calculate collision potential
	function calculateCollisionMatrices(stems, overlaps) {
		// A : Alignment operator
		// C : Collision operator
		// S : Swap operator
		var A = [], C = [], S = [], n = stems.length;
		for(var j = 0; j < n; j++){
			A[j] = [];
			C[j] = [];
			S[j] = [];
			for(var k = 0; k < n; k++) {
				A[j][k] = C[j][k] = S[j][k] = 0
			}
		};
		for(var j = 0; j < n; j++) {
			for(var k = 0; k < j; k++) {
				// var ovr = overlaps[j][k];
				var ovr = Math.sqrt(stemOverlapLength(stems[j], stems[k]) * overlaps[j][k])
				var coeffA = 1;
				if(stems[j].belongRadical === stems[k].belongRadical) {
					if(!stems[j].hasSameRadicalStemAbove || !stems[k].hasSameRadicalStemBelow) coeffA = COEFF_A_FEATURE_LOSS
					else coeffA = COEFF_A_SAME_RADICAL
				} else {
					if(atRadicalBottom(stems[j]) && atRadicalTop(stems[k])) coeffA = COEFF_A_RADICAL_MERGE
				}
				A[j][k] = COEFF_A_MULTIPLIER * ovr * coeffA;
//				if(ovr === 0 && Math.abs(stems[j].yori - stems[k].yori) < blueFuzz && stems[j].belongRadical !== stems[k].belongRadical) {
//					A[j][k] = COEFF_A_SYMMETRY
//				};

				var coeffC = 1;
				if(stems[j].belongRadical === stems[k].belongRadical) coeffC = COEFF_C_SAME_RADICAL;
				C[j][k] = COEFF_C_MULTIPLIER * ovr * coeffC;
				
				S[j][k] = COEFF_S;
			};
		};
		return {
			alignment: A, 
			collision: C,
			swap: S
		}
	};


	var radicals = glyph.radicals = findRadicals(glyph.contours);
	var stats = glyph.stats = statGlyph(glyph.contours);
	findHorizontalSegments(radicals);
	var stems = glyph.stems = pairSegments(radicals);
	var overlaps = glyph.stemOverlaps = (function(){
		var transitions = [];
		for(var j = 0; j < stems.length; j++){
			transitions[j] = []
			for(var k = 0; k < stems.length; k++){
				transitions[j][k] = stemOverlapRatio(stems[j], stems[k])
			}
		};
		return transitions
	})();
	analyzeStemSpatialRelationships(stems, overlaps);
	glyph.collisionMatrices = calculateCollisionMatrices(stems, overlaps);
	return glyph;
}

exports.findStems = findStems;