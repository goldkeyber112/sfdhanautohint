var upm = 1000;

function Point(x, y, on, interpolated){
	this.xori = x;
	this.yori = y;
	this.xtouch = x;
	this.ytouch = y;
	this.touched = false;
	this.donttouch = false;
	this.on = on;
	this.interpolated = interpolated;
}
function Contour(){
	this.points = []
	this.ccw = false
}
Contour.prototype.stat = function() {
	var points = this.points;
	if(points[0].yori > points[points.length - 2].yori && points[0].yori >= points[1].yori ||points[0].yori < points[points.length - 2].yori && points[0].yori <= points[1].yori) {
		points[0].yExtrema = true;
	}
	for(var j = 0; j < points.length - 1; j++){
		if(j > 0 && 
			(  points[j].yori > points[j - 1].yori && points[j].yori >= points[j + 1].yori 
			|| points[j].yori < points[j - 1].yori && points[j].yori <= points[j + 1].yori)) points[j].yExtrema = true;
	};
	var xoris = this.points.map(function(p){ return p.xori })
	var yoris = this.points.map(function(p){ return p.yori })
	this.xmax = Math.max.apply(Math, xoris)
	this.ymax = Math.max.apply(Math, yoris)
	this.xmin = Math.min.apply(Math, xoris)
	this.ymin = Math.min.apply(Math, yoris)
	this.orient()
}
Contour.prototype.orient = function() {
	// Findout PYmin
	var jm = 0, ym = this.points[0].yori
	for(var j = 0; j < this.points.length - 1; j++) if(this.points[j].yori < ym){
		jm = j; ym = this.points[j].yori;
	}
	var p0 = this.points[(jm ? jm - 1 : this.points.length - 2)], p1 = this.points[jm], p2 = this.points[jm + 1];
	var x = ((p0.xori - p1.xori) * (p2.yori - p1.yori) - (p0.yori - p1.yori) * (p2.xori - p1.xori))
	if(x < 0) this.ccw = true;
	else if(x === 0) this.ccw = p2.xori > p1.xori
}
var inPoly = function (point, vs) {
    // ray-casting algorithm based on
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
    
    var x = point.xori, y = point.yori;
    
    var inside = false;
    for (var i = 0, j = vs.length - 2; i < vs.length - 1; j = i++) {
        var xi = vs[i].xori, yi = vs[i].yori;
        var xj = vs[j].xori, yj = vs[j].yori;
        
        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
};
Contour.prototype.includes = function(that){
	for(var j = 0; j < that.points.length - 1; j++){
		if(!inPoly(that.points[j], this.points)) return false
	}
	return true;
}
function Glyph(contours){
	this.contours = contours || []
	this.stems = []
}
function numberPoints(contours){
	var n = 0
	for(var j = 0; j < contours.length; j++){
		for(var k = 0; k < contours[j].points.length - 1; k++) if(!contours[j].points[k].interpolated)
			contours[j].points[k].id = (n++)
	}
	return n;
}
function parseSFD(input){
	var contours = [], currentContour = null
	input = input.trim().split('\n');
	for(var j = 0; j < input.length; j++){
		var line = input[j].trim().split(/ +/);
		if(line[2] === 'm'){
			// Moveto
			if(currentContour) contours.push(currentContour);
			currentContour = new Contour();
			currentContour.points.push(new Point(line[0] - 0, line[1] - 0, true))
		} else if(line[2] === 'l' && currentContour){
			// Lineto
			currentContour.points.push(new Point(line[0] - 0, line[1] - 0, true))
		} else if(line[6] === 'c' && currentContour){
			// curveTo
			currentContour.points.push(new Point(line[0] - 0, line[1] - 0, false))
			currentContour.points.push(new Point(line[4] - 0, line[5] - 0, true, /^128,/.test(line[7])))
		}
	}
	if(currentContour) contours.push(currentContour);
	contours.forEach(function(c){ c.stat() })
	var nPoints = numberPoints(contours);
	var glyph = new Glyph(contours);
	glyph.nPoints = nPoints;
	return glyph
}

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
		if(bc && !bb) sb += e.at;
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
function enoughOverlapBetweenStems(a, b){
	return enoughOverlapBetweenSegments(a.low, b.low, MIN_STEM_OVERLAP_RATIO) 
		|| enoughOverlapBetweenSegments(a.high, b.high, MIN_STEM_OVERLAP_RATIO) 
		|| enoughOverlapBetweenSegments(a.low, b.high, MIN_STEM_OVERLAP_RATIO) 
		|| enoughOverlapBetweenSegments(a.high, b.low, MIN_STEM_OVERLAP_RATIO)
}
function stemOverlapLength(a, b){
	return Math.max(overlapRatio(a.low, b.low), overlapRatio(a.high, b.low), overlapRatio(a.low, b.high), overlapRatio(a.high, b.high))
}

var MIN_OVERLAP_RATIO = 0.3;
var MIN_STEM_OVERLAP_RATIO = 0.2;
var Y_FUZZ = 3
var SLOPE_FUZZ = 0.04

function findStems(glyph, strategy) {
	var MIN_STEM_WIDTH = strategy.MIN_STEM_WIDTH;
	var MAX_STEM_WIDTH = strategy.MAX_STEM_WIDTH;
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
	var COEFF_S = strategy.COEFF_S || 10000;
	var COEFF_A_SYMMETRY = strategy.COEFF_A_SYMMETRY || -40;

	function calculateCollisionMatrices(stems) {
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
				var ovr = stemOverlapLength(stems[j], stems[k]);
				var coeffA = 1;
				if(stems[j].belongRadical === stems[k].belongRadical) {
					if(!stems[j].hasSameRadicalStemAbove || !stems[k].hasSameRadicalStemBelow) coeffA = COEFF_A_FEATURE_LOSS
					else coeffA = COEFF_A_SAME_RADICAL
				} else {
					if(atRadicalBottom(stems[j]) && atRadicalTop(stems[k])) coeffA = COEFF_A_RADICAL_MERGE
				}
				A[j][k] = COEFF_A_MULTIPLIER * ovr * coeffA;
				if(ovr === 0 && Math.abs(stems[j].yori - stems[k].yori) < blueFuzz && stems[j].belongRadical !== stems[k].belongRadical) {
					A[j][k] = COEFF_A_SYMMETRY
				};

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
			var radicals = []
			for(var k = 0; k < contours.length; k++) if(inclusions[j][k]) {
				if(contours[k].ccw !== orient) {
					radicals = radicals.concat(inclusionToRadicals(inclusions, contours, k, !orient))
				}
			};
			return radicals
		} else {
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
	function transitiveReduce(g){
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
		// Merge disjoint sets
		for(var j = 0; j < contours.length; j++) {
			for(var k = 0; k < contours.length; k++) {
				if(j !== k && contours[j].includes(contours[k])) {
					inclusions[j][k] = true;
					contours[k].outline = false;
				}
			}
		};
		transitiveReduce(inclusions);
		for(var j = 0; j < contours.length; j++) if(contours[j].outline) {
			radicals = radicals.concat(inclusionToRadicals(inclusions, contours, j, contours[j].ccw))
		};
		return radicals;
	};

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

	function pointBelowLine(point, y, xmin, xmax){
		return point.yori < y - blueFuzz && point.xori < xmax && point.xori > xmin
	}
	function getRadicalPointRelationships(stem, radical){
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

	function stemSegments(radicals){
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
						getRadicalPointRelationships(stem, radicals[r]);
						stem.atGlyphTop = stem.high[0][0].yori >= stats.ymax - blueFuzz;
						stem.atGlyphBottom = stem.high[0][0].yori - stem.width <= stats.ymin + blueFuzz;
						stem.belongRadical = radicals[r];
						segs[j] = segs[k] = null;
						radicalStems.push(stem);
					}
					break;
				}
			};

			for(var k = 0; k < radicalStems.length; k++) {
				for(var j = 0; j < radicalStems.length; j++) {
					if(enoughOverlapBetweenStems(radicalStems[j], radicalStems[k]) && radicalStems[j].yori > radicalStems[k].yori) {
						radicalStems[k].hasSameRadicalStemAbove = radicalStems[k].hasGlyphStemAbove = true;
						radicalStems[j].hasSameRadicalStemBelow = radicalStems[j].hasGlyphStemBelow = true;
					}
				}
			}
			stems = stems.concat(radicalStems)
			radicals[r].stems = radicalStems;
		}
		for(var k = 0; k < stems.length; k++) {
			for(var j = 0; j < stems.length; j++) {
				if(enoughOverlapBetweenStems(stems[j], stems[k]) && stems[j].yori > stems[k].yori) {
					stems[k].hasGlyphStemAbove = true;
					stems[j].hasGlyphStemBelow = true;
				}
			}
		}
		return stems.sort(function(a, b){ return a.yori - b.yori });
	};
	var radicals = findRadicals(glyph.contours);
	var stats = statGlyph(glyph.contours);
	findHorizontalSegments(radicals);
	var stems = stemSegments(radicals);
	glyph.radicals = radicals;
	glyph.stems = stems;
	glyph.collisionMatrices = calculateCollisionMatrices(stems);
	glyph.stemTransitions = (function(){
		var transitions = [];
		for(var j = 0; j < stems.length; j++){
			transitions[j] = []
			for(var k = 0; k < stems.length; k++){
				transitions[j][k] = enoughOverlapBetweenStems(stems[j], stems[k])
			}
		};
		return transitions
	})()
	return glyph;
}

function autohint(glyph, ppem, strategy) {
	var MIN_STEM_WIDTH = strategy.MIN_STEM_WIDTH;
	var MAX_STEM_WIDTH = strategy.MAX_STEM_WIDTH;
	var STEM_SIDE_MIN_RISE = strategy.STEM_SIDE_MIN_RISE || strategy.MIN_STEM_WIDTH;
	var STEM_CENTER_MIN_RISE = strategy.STEM_CENTER_MIN_RISE || STEM_SIDE_MIN_RISE;
	var STEM_SIDE_MIN_DESCENT = strategy.STEM_SIDE_MIN_DESCENT || strategy.MIN_STEM_WIDTH;
	var STEM_CENTER_MIN_DESCENT = strategy.STEM_CENTER_MIN_DESCENT || STEM_SIDE_MIN_DESCENT;

	var POPULATION_LIMIT = strategy.POPULATION_LIMIT || 200;
	var CHILDREN_LIMIT = strategy.CHILDREN_LIMIT || 50;
	var EVOLUTION_STAGES = strategy.EVOLUTION_STAGES || 10;
	var MUTANT_PROBABLITY = strategy.MUTANT_PROBABLITY || 0.4;
	var ELITE_COUNT = strategy.ELITE_COUNT || 10;

	var blueFuzz = strategy.BLUEZONE_WIDTH || 15;

	var WIDTH_FACTOR_X = strategy.WIDTH_FACTOR_X || 2;
	var MIN_ADJUST_PPEM = strategy.MIN_ADJUST_PPEM || 16;
	var MAX_ADJUST_PPEM = strategy.MAX_ADJUST_PPEM || 32;

	var ABLATION_IN_RADICAL = strategy.ABLATION_IN_RADICAL || 2;
	var ABLATION_RADICAL_EDGE = strategy.ABLATION_RADICAL_EDGE || 4;
	var ABLATION_GLYPH_EDGE = strategy.ABLATION_GLYPH_EDGE || 15;
	var ABLATION_GLYPH_HARD_EDGE = strategy.ABLATION_GLYPH_HARD_EDGE || 25;



	var shouldAddGlyphHeight = strategy.shouldAddGlyphHeight || function(stem, ppem, glyfTop, glyfBottom) {
		return stem.yori - stem.ytouch >= 0.25 * uppx
	}

	var contours = glyph.contours;
	function byyori(a, b){
		return a.yori - b.yori
	}
	var stems = glyph.stems.sort(byyori);

	var uppx = upm / ppem;
	var glyfBottom = -round(0.075 * upm)
	var glyfTop = round(0.84 * upm)

	function round(y){ return Math.round(y / upm * ppem) / ppem * upm }
	function roundDown(y){ return Math.floor(y / upm * ppem) / ppem * upm }
	function roundUp(y){ return Math.ceil(y / upm * ppem) / ppem * upm }
	function roundDownStem(stem){
		stem.roundMethod = -1; // Positive for round up, negative for round down
//		if(roundUp(stem.yori) === roundDown(stem.yori)) {
//			stem.ytouch = roundDown(stem.yori) - uppx;
//		} else {
			stem.ytouch = roundDown(stem.yori);
//		}
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
		if(w < uppx) return uppx;
		else if (w < 2 * uppx) return uppx * Math.round(WIDTH_FACTOR_X 
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
			low = Math.max(low, atGlyphBottom(stems[j]) ? glyfBottom + w : glyfBottom + w + uppx);
			high = Math.min(high, atGlyphTop(stems[j]) ? glyfTop : glyfTop - uppx);
			
			var center = stems[j].yori - stems[j].width / 2 + w / 2;
			if(atGlyphTop(stems[j]) && center > glyfTop - uppx && stems[j].yori - roundDown(center) >= 0.25 * uppx) center = glyfTop;
//			else if(!stems[j].hasGlyphStemAbove && center > glyfTop - 2 * uppx) center = glyfTop - uppx;
			if(atGlyphBottom(stems[j]) && center < glyfBottom + w + 0.75 * uppx) center = glyfBottom + w;
//			else if(!stems[j].hasGlyphStemBelow && center < glyfBottom + w + 2 * uppx) center = glyfBottom + w + uppx;
			center = xclamp(center, low, high);
			
			var ablationCoeff = atGlyphTop(stems[j]) || atGlyphBottom(stems[j]) ? ABLATION_GLYPH_HARD_EDGE
			                  : !stems[j].hasGlyphStemAbove || !stems[j].hasGlyphStemBelow ? ABLATION_GLYPH_EDGE
			                  : !stems[j].hasSameRadicalStemAbove || !stems[j].hasSameRadicalStemBelow ? ABLATION_RADICAL_EDGE : ABLATION_IN_RADICAL;
			avaliables[j] = {
				low: Math.round(low / uppx),
				high: Math.round(high / uppx), 
				center: center, 
				ablationCoeff: ablationCoeff / uppx
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
			if(stems[j].ytouch - roundUp(w) < glyfBottom){
				stems[j].ytouch += uppx;
			} else if(!atGlyphBottom(stems[j]) && stems[j].ytouch - roundUp(w) <= glyfBottom) {
				stems[j].ytouch += uppx;
			}
		}
	}
	var COLLISION_FUZZ = 1.04;
	var HIGHLY_COLLISION_FUZZ = 0.3;
	function collideWith(stems, transitions, j, k){
		return transitions[j][k] && (stems[j].ytouch > stems[k].ytouch 
			? stems[j].ytouch - stems[k].ytouch <= stems[j].touchwidth * COLLISION_FUZZ 
			: stems[k].ytouch - stems[j].ytouch <= stems[k].touchwidth * COLLISION_FUZZ)
	}
	function highlyCollideWith(stems, transitions, j, k){
		return transitions[j][k] && (stems[j].ytouch > stems[k].ytouch 
			? stems[j].ytouch - stems[k].ytouch <= stems[j].touchwidth * HIGHLY_COLLISION_FUZZ 
			: stems[k].ytouch - stems[j].ytouch <= stems[k].touchwidth * HIGHLY_COLLISION_FUZZ)
	}
	function spaceBelow(stems, transitions, k, bottom){
		var space = stems[k].ytouch - stems[k].touchwidth + bottom;
		for(var j = k - 1; j >= 0; j--){
			if(transitions[j][k] && Math.abs(stems[k].ytouch - stems[j].ytouch) - stems[k].touchwidth < space)
				space = stems[k].ytouch - stems[j].ytouch - stems[k].touchwidth
		}
		return space;
	}
	function spaceAbove(stems, transitions, k, top){
		var space = top - stems[k].ytouch;
		for(var j = k + 1; j < stems.length; j++){
			if(transitions[k][j] && Math.abs(stems[j].ytouch - stems[k].ytouch) - stems[j].touchwidth < space)
				space = stems[j].ytouch - stems[k].ytouch - stems[j].touchwidth
		}
		return space;
	}
	function canBeAdjustedUp(stems, transitions, k, distance){
		for(var j = k + 1; j < stems.length; j++){
			if(transitions[j][k] && Math.abs(stems[j].ytouch - stems[k].ytouch) - stems[j].touchwidth <= distance)
				return false
		}
		return true;
	}
	function canBeAdjustedDown(stems, transitions, k, distance){
		for(var j = 0; j < k; j++){
			if(transitions[k][j] && Math.abs(stems[k].ytouch - stems[j].ytouch) - stems[k].touchwidth <= distance)
				return false
		}
		return true;
	}

	function adjustDownward(stems, transitions, k, bottom){
		var s = spaceBelow(stems, transitions, k, bottom);
		if(s >= 1.8 * uppx) {
			// There is enough space below stem k, just bring it downward
			if(stems[k].ytouch > Math.max(bottom, avaliables[k].low * uppx)) {
				stems[k].ytouch -= uppx;
				return true;
			}
		}
		for(var j = 0; j < k; j++){
			if(!adjustDownward(stems, transitions, j, bottom)) return false;
		}
		return false;
	}
	var transitions = glyph.stemTransitions;
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
			if(transitions[j][k] && stems[j].roundMethod === -1) roundUpStem(stems[j]);
		}

		// Step 0b : Adjust top stems
		var ytouchmax = stems[stems.length - 1].ytouch;
		for(var j = stems.length - 1; j >= 0; j--) if(!stems[j].hasGlyphStemAbove) {
			var stem = stems[j]
			if(atGlyphTop(stem)) {
				var canAdjustUpToGlyphTop = stem.ytouch < Math.min(avaliables[j].high * uppx, glyfTop - blueFuzz) && stem.ytouch >= glyfTop - uppx - 1;
				if(canAdjustUpToGlyphTop && stem.yori - stem.ytouch >= 0.47 * uppx) {
					// Rounding-related upward adjustment
					stem.ytouch += uppx
				} else if(canAdjustUpToGlyphTop && shouldAddGlyphHeight(stem, ppem, glyfTop, glyfBottom)) {
					// Strategy-based upward adjustment
					stem.ytouch += uppx
				};
				stem.allowMoveUpward = stem.ytouch < glyfTop - blueFuzz;
			} else {
				if(stem.ytouch < glyfTop - blueFuzz - uppx && stem.yori - stem.ytouch >= 0.47 * uppx){
					stem.ytouch += uppx
				}
				stem.allowMoveUpward = stem.ytouch < glyfTop - uppx - blueFuzz
			}
		};

		var ytouchmin = Math.min.apply(Math, stems.map(function(s){ return s.ytouch }));
		var ytouchmax = Math.max.apply(Math, stems.map(function(s){ return s.ytouch }));

		// Step 1: Uncollide
		// We will perform stem movement using greedy method
		// Not always works but okay for most characters
		for(var j = 0; j < stems.length; j++) {
			if(stems[j].ytouch <= ytouchmin) { 
				// Stems[j] is a bottom stem
				// DON'T MOVE IT
			} else if(stems[j].ytouch >= ytouchmax) {
				// Stems[j] is a top stem
				// It should not be moved, but we can uncollide stems below it.
				for(var k = j - 1; k >= 0; k--) if(collideWith(stems, transitions, j, k)) {
					if(highlyCollideWith(stems, transitions, j, k)) {
						alignStem(stems[k], stems[j])
						continue
					} 
					var r = adjustDownward(stems, transitions, k, ytouchmin)
					if(r) continue;
					if(stems[j].ytouch < avaliables[j].high * uppx && stems[j].allowMoveUpward) {
						stems[j].ytouch += uppx;
						break;
					}
				}
			} else {
				// Stems[j] is a middle stem
				for(var k = j - 1; k >= 0; k--) if(collideWith(stems, transitions, j, k)) {
					if(highlyCollideWith(stems, transitions, j, k)) {
						alignStem(stems[j], stems[k])
						break;
					} 
					var r = adjustDownward(stems, transitions, k, ytouchmin);
					if(r) continue;
					if(!stems[j].atGlyphTop && stems[j].ytouch < avaliables[j].high * uppx && stems[j].ytouch < glyfTop - blueFuzz) {
						stems[j].ytouch += uppx;
						break;
					}
				}
			}
		};
	};

	function rebalance(stems){
		for(var j = stems.length - 1; j >= 0; j--) if(!atGlyphTop(stems[j]) && !atGlyphBottom(stems[j])) {
			if(canBeAdjustedUp(stems, transitions, j, 1.75 * uppx) && stems[j].yori - stems[j].ytouch > 0.6 * uppx) {
				if(stems[j].ytouch < avaliables[j].high * uppx) { stems[j].ytouch += uppx }
			} else if(canBeAdjustedDown(stems, transitions, j, 1.75 * uppx) && stems[j].ytouch - stems[j].yori > 0.6 * uppx) {
				if(stems[j].ytouch > avaliables[j].low * uppx) { stems[j].ytouch -= uppx }
			}
		};		
	}

	function potential(y, A, C, S, avaliables) {
		var p = 0;
		var n = y.length;
		for(var j = 0; j < n; j++) {
			for(var k = 0; k < j; k++) {
				if(y[j] === y[k]) p += A[j][k]
				else if(y[j] === y[k] + 1 || y[j] + 1 === y[k]) p += C[j][k];
				if(y[j] < y[k]) p += S[j][k]
			};
			p += avaliables[j].ablationCoeff * Math.abs(y[j] * uppx - avaliables[j].center)
		}
		return p;
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
		var p1 = population.concat(children).sort(byPotential);
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
		for(var j = stems.length - 1; j >= 0; j--) {
			var sb = spaceBelow(stems, transitions, j, ytouchmin + uppx * 3);
			var sa = spaceAbove(stems, transitions, j, ytouchmax + uppx * 3);
			var wr = Math.min(stems[j].touchwidth + sa + sb - 2 * uppx, calculateWidth(stems[j].width));
			var w = round(wr);
			if(w < uppx + 1) continue;
			if(sb >= 1.75 * uppx && (stems[j].ytouch - w > glyfBottom || atGlyphBottom(stems[j]) && stems[j].ytouch - w >= glyfBottom - 1)) {
				stems[j].touchwidth = wr;
			} else if (sa > 1.6 * uppx && stems[j].ytouch < avaliables[j].high * uppx && stems[j].ytouch - w + uppx >= glyfBottom - 1 && stems[j].ytouch < glyfTop - uppx) {
				stems[j].ytouch += uppx;
				stems[j].touchwidth = wr;
			}
		}
	}
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
					stem.high[k][p].keypoint = true;
					if(k === 0) {
						topkey = (['ROUND', stem.high[0][0], stem.yori, stem.ytouch])
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
						if(stem.touchwidth === round(stem.width)) {
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
			}
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
				if(point.ytouch <= -65 && point.yExtrema){
					point.touched = true;
					point.ytouch = glyfBottom;
					point.keypoint = true;
					instructions.blueZoneAlignments.push(['BLUEBOTTOM', point, glyfTop])
				}
				if(point.ytouch >= 825 && point.yExtrema){
					point.touched = true;
					point.ytouch = glyfTop;
					point.keypoint = true;
					instructions.blueZoneAlignments.push(['BLUETOP', point, glyfTop])
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
	rebalance(stems);
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

if(typeof exports !== 'undefined') {
	exports.parseSFD = parseSFD;
	exports.findStems = findStems;
	exports.autohint = autohint;
}