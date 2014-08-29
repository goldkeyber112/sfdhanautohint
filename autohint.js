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
Contour.prototype.stat = function(){
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

function overlapRatio(a, b){
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
	}

	return len / Math.max(la, lb)
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


var blueFuzz = 15
var MIN_OVERLAP_RATIO = 0.3;
var MIN_STEM_OVERLAP_RATIO = 0.2;
var Y_FUZZ = 3
var SLOPE_FUZZ = 0.04

function findStems(glyph, MIN_STEM_WIDTH, MAX_STEM_WIDTH) {
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
	}
	function findRadicals(contours){
		var radicals = []
		for(var j = 0; j < contours.length; j++){
			radicals[j] = {
				contour: contours[j],
				parts: []
			}
			radicals[j].root = radicals[j];
		}
		// Merge disjoint sets
		for(var j = 0; j < radicals.length; j++){
			for(var k = 0; k < radicals.length; k++){
				if(rootof(radicals[j]).contour.includes(radicals[k].contour)) {
					radicals[k].root = radicals[j].root;
				}
			}
		};
		for(var j = 0; j < radicals.length; j++){
			rootof(radicals[j]).parts.push(radicals[j].contour)
		};
		return radicals.filter(function(r){ return r.parts.length }).map(function(r){ return { parts: r.parts, outline: r.contour } })
	}

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

	function stemAtRadicalTop(stem, radical){
		var a0 = stem.low[0][0].xori, az = stem.low[stem.low.length - 1][stem.low[stem.low.length - 1].length - 1].xori
		var b0 = stem.high[0][0].xori, bz = stem.high[stem.high.length - 1][stem.high[stem.high.length - 1].length - 1].xori
		var xmin = Math.min(a0, b0, az, bz), xmax = Math.max(a0, b0, az, bz);
		for(var j = 0; j < radical.parts.length; j++) for(var k = 0; k < radical.parts[j].points.length; k++) {
			var point = radical.parts[j].points[k];
			if(point.yori > stem.yori + blueFuzz && point.xori <= xmax && point.xori >= xmin) return false;
		}
		//return stem.yori >= radical.outline.ymax - MAX_STEM_WIDTH;
		return true
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
						stem.high = segs[k]
						stem.yori = stem.high[0][0].yori
						stem.width = Math.abs(segs[k][0][0].yori - segs[j][0][0].yori)
						stem.atRadicalTop = stemAtRadicalTop(stem, radicals[r])
						stem.atGlyphTop = stem.high[0][0].yori >= stats.ymax;
						stem.belongRadical = radicals[r];
						segs[j] = segs[k] = null;
						radicalStems.push(stem);
					}
					break;
				}
			};

			for(var k = 0; k < radicalStems.length; k++) {
				for(var j = 0; j < radicalStems.length; j++) {
					if(enoughOverlapBetweenStems(radicalStems[j], radicalStems[k]) && radicalStems[j].yori > radicalStems[k].yori)
						radicalStems[k].atRadicalTop = radicalStems[k].atGlyphTop = false;
				}
			}
			stems = stems.concat(radicalStems)
		}
		return stems;
	}
	var radicals = findRadicals(glyph.contours);
	var stats = statGlyph(glyph.contours);
	findHorizontalSegments(radicals);
	var stems = stemSegments(radicals);
	glyph.stems = stems;
	return glyph;
}

function autohint(glyph, ppem){

	var contours = glyph.contours;
	var stems = glyph.stems;

	var uppx = upm / ppem;
	var glyfBottom = -round(0.075 * upm)
	var glyfTop = round(0.84 * upm)
	function round(xori){ return Math.round(xori / upm * ppem) / ppem * upm }
	function roundDown(xori){ return Math.floor(xori / upm * ppem) / ppem * upm }
	function roundUp(xori){ return Math.ceil(xori / upm * ppem) / ppem * upm }
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
	function alignStem(stem, that){
		while(that.alignTo) that = that.alignTo;
		stem.roundMethod = 0;
		stem.alignTo = that;
		stem.ytouch = that.ytouch;
	}

	var WIDTH_FACTOR_X = 2
	var MIN_ADJUST_PPEM = 12
	var MAX_ADJUST_PPEM = 32

	function clamp(x){ return Math.min(1, Math.max(0, x)) }
	function calculateWidth(w){
		if(ppem < 20) return uppx;
		if(w < uppx) return uppx;
		else if (w < 2 * uppx) return uppx * WIDTH_FACTOR_X 
			* (w / uppx / WIDTH_FACTOR_X + clamp((ppem - MIN_ADJUST_PPEM) / (MAX_ADJUST_PPEM - MIN_ADJUST_PPEM)) * (1 - w / uppx / WIDTH_FACTOR_X));
		else return w;
	}

	function initStemTouches(stems){
		for(var j = 0; j < stems.length; j++) {
			var w = calculateWidth(stems[j].width);
			if(w < 1.9 * uppx) w = uppx
			// stems[j].touchwidth = w;
			stems[j].touchwidth = uppx;
			stems[j].alignTo = null;
			roundDownStem(stems[j])
			if(stems[j].ytouch - roundUp(w) < glyfBottom){
				roundUpStem(stems[j])
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

	function adjustDownward(stems, transitions, k, bottom){
		var s = spaceBelow(stems, transitions, k, bottom);
		if(s >= 2 * uppx || s < 0.3 * uppx) {
			// There is enough space below stem k, just bring it downward
			if(stems[k].roundMethod === 1 && stems[k].ytouch > bottom) {
				roundDownStem(stems[k]);
				return true;
			}
		}
		for(var j = 0; j < k; j++){
			if(!adjustDownward(stems, transitions, j, bottom)) return false;
		}
		return false;
	}

	// Collision resolving
	function uncollide(stems){
		// In this procedure we move some segment stems to resolve collisions between them.
		// A "collision" means that two stems meet togther after gridfitting.
		// We will merge some of these stems to preserve the outfit of glyph while leaving
		// space between strokes;
		if(!stems.length) return;
		stems = stems.sort(function(a, b){ return a.yori - b.yori });

		var transitions = [];
		for(var j = 0; j < stems.length; j++){
			transitions[j] = []
			for(var k = 0; k < stems.length; k++){
				transitions[j][k] = enoughOverlapBetweenStems(stems[j], stems[k])
			}
		}

		// Step 0 : Adjust top and bottom stems
		var ytouchmin0 = stems[0].ytouch;
		var ytouchmin = ytouchmin0;
		for(var j = 0; j < stems.length; j++) {
			if(stems[j].roundMethod === -1 && stems[j].ytouch === ytouchmin0 && stems[j].ytouch - stems[j].touchwidth >= -1
				&& stems[j].yori - stems[j].ytouch >= 0.5 * uppx) {
				ytouchmin = ytouchmin0 + uppx;
				roundUpStem(stems[j])
			}
		}
		// Avoid stem merging at the bottom
		for(var j = 0; j < stems.length; j++) if(stems[j].ytouch === ytouchmin) for(var k = 0; k < j; k++) {
			if(transitions[j][k] && stems[j].roundMethod === -1) roundUpStem(stems[j]);
		}

		var ytouchmax0 = stems[stems.length - 1].ytouch;
		var ytouchmax = ytouchmax0;
		var hasStemAtGlyphTop = stems[stems.length - 1].atGlyphTop
		for(var j = stems.length - 1; j >= 0; j--) {
			var stem = stems[j];
			if(stem.ytouch === ytouchmax0) {
				var canAdjustUpToGlyphTop = stem.ytouch < glyfTop - blueFuzz && stem.ytouch >= glyfTop - uppx - 1
				if(stem.roundMethod === -1 && stem.atRadicalTop
					? stem.ytouch < glyfTop - blueFuzz && stem.yori - stem.ytouch >= 0.47 * uppx
					: stem.ytouch + uppx < glyfTop - blueFuzz && stem.yori - stem.ytouch >= 0.47 * uppx) {
					ytouchmax = ytouchmax0 + uppx;
					roundUpStem(stem);
				};
				var canAdjustUpToGlyphTop = stem.ytouch < glyfTop - blueFuzz && stem.ytouch >= glyfTop - uppx - 1
				if(hasStemAtGlyphTop && stem.atRadicalTop && canAdjustUpToGlyphTop && stem.yori - stem.ytouch >= 0.2 * uppx) {
					if(stem.roundMethod === -1) {
						ytouchmax = ytouchmax0 + uppx;
						roundUpStem(stem);
					}
				};
				if(stem.atRadicalTop && canAdjustUpToGlyphTop) {
					stem.allowMoveUpward = true
				}
			}
		}
		// Step 1: Uncollide
		// We will perform stem movement using greedy method
		// Not always works but okay for most characters
		for(var j = 0; j < stems.length; j++){

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
					if(stems[j].roundMethod === -1 && stems[j].allowMoveUpward) {
						roundUpStem(stems[j]);
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
					if(stems[j].roundMethod === -1) {
						roundUpStem(stems[j]);
						break;
					}
				}			
			}
		};

		// Stem 2 : Alignment reduction
		// In this step we will move aligned stems two pixels upward there is enough space.
		for(var j = stems.length - 1; j >= 0; j--) if(stems[j].ytouch <= Math.min(ytouchmax - 1, glyfTop - 2 * uppx) && stems[j].ytouch > ytouchmin) {
			if(canBeAdjustedUp(stems, transitions, j, 2.8 * uppx) && stems[j].roundMethod === 0) {
				stems[j].alignTo = null;
				roundUpStem(stems[j]);
				stems[j].roundMethod = 2;
				stems[j].ytouch += uppx;
			}
		}
		// Step 3 : In-radical alignment reduction
		// Once we find a in-radical alignment......
		for(var j = stems.length - 1; j >= 0; j--) if(stems[j].atRadicalTop && stems[j].roundMethod === 0 && stems[j].belongRadical === stems[j].alignTo.belongRadical) {
			// Find a proper stem above it......
			for(var k = j; k < stems.length; k++) if(stems[k].ytouch === stems[j].ytouch + 2 * uppx && stems[k].belongRadical !== stems[j].belongRadical) {
				// And align them.
				alignStem(stems[j], stems[k]);
				break;
			}
		}
		// Step 4 : Position Rebalance
		// Stems are rounded down by default, may cause improper movements
		// Therefore we bring them upward one pixel when there is enough space
		// above.
		for(var j = stems.length - 1; j >= 0; j--) if(stems[j].ytouch < ytouchmax && stems[j].ytouch > ytouchmin) {
			if(canBeAdjustedUp(stems, transitions, j, 1.75 * uppx) && stems[j].yori - stems[j].ytouch > 0.5 * uppx) {
				if(stems[j].roundMethod === -1) { roundUpStem(stems[j]) }
			}
		}
		// Stem 5 : Stem Width Allocation
		// In this step we will adjust stem width when there is enough space below the stem.
		for(var j = stems.length - 1; j >= 0; j--) {
			var sb = spaceBelow(stems, transitions, j, ytouchmin + uppx * 3);
			var sa = spaceAbove(stems, transitions, j, ytouchmax + uppx * 3);
			var w = Math.round(Math.min(stems[j].touchwidth + sa + sb - 2 * uppx, calculateWidth(stems[j].width)) / uppx) * uppx;
			if(w <= uppx) continue;
			if(sb >= 1.75 * uppx && stems[j].ytouch - w >= glyfBottom - 1) {
				stems[j].touchwidth = w;
			} else if (sa > 1.6 * uppx && stems[j].roundMethod === -1 && stems[j].ytouch - w + uppx >= glyfBottom - 1) {
				roundUpStem(stems[j]);
				stems[j].touchwidth = w
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
						if(stem.roundMethod === 1) topkey = (['ROUNDUP', stem.high[0][0], null, stem.yori])
						else if(stem.roundMethod === -1) topkey = (['ROUNDDOWN', stem.high[0][0], null, stem.yori])
						else if(stem.roundMethod === 2) topkey = (['ROUNDUP2', stem.high[0][0], null, stem.yori])
						else if(stem.alignTo) topkey = (['ALIGN0', stem.alignTo.high[0][0], stem.high[0][0]])
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
					stem.low[k][p].keypoint = true;
					if(k === 0) {
						bottomkey = ['ALIGNW', stem.high[0][0], stem.low[0][0], stem.touchwidth / uppx]
					} else {
						bottomaligns.push(['ALIGN0', stem.low[0][0], stem.low[k][0]])
					}
				} else {
					stem.low[k][p].donttouch = true;
				}
			}
			instructions[topkey[0] === 'ALIGN0' ? 'alignedStems' : 'roundingStems'].push({
				topkey: topkey,
				bottomkey: bottomkey,
				topaligns: topaligns,
				bottomaligns: bottomaligns
			})
		}
	}

	function touchBlueZonePoints(contours) {
		function flushBottom(seq){
			var mink = 0;
			for(var s = 0; s < seq.length; s++) if(seq[s].yori < seq[mink].yori) mink = s;
			seq[mink].touched = true;
			seq[mink].ytouch = glyfBottom;
			seq[mink].keypoint = true;
			instructions.blueZoneAlignments.push(['BLUETOP', seq[mink], glyfBottom])
		}
		function flushTop(seq){
			var mink = 0;
			for(var s = 0; s < seq.length; s++) if(seq[s].yori > seq[mink].yori) mink = s;
			seq[mink].touched = true;
			seq[mink].ytouch = glyfTop;
			seq[mink].keypoint = true;
			instructions.blueZoneAlignments.push(['BLUEBOTTOM', seq[mink], glyfTop])
		}
		for(var j = 0; j < contours.length; j++) {
			var seq = []
			for(var k = 0; k < contours[j].points.length - 1; k++){
				var point = contours[j].points[k];
				if(point.yori <= -65){
					if(!point.touched && !point.donttouch && !point.interpolated) seq.push(point);
				} else if(seq.length){
					flushBottom(seq); seq = [];
				}
			}
			if(seq.length){
				flushBottom(seq); seq = [];
			}
			var seq = []
			for(var k = 0; k < contours[j].points.length - 1; k++){
				var point = contours[j].points[k];
				if(point.yori >= 825){
					if(!point.touched && !point.donttouch && !point.interpolated) seq.push(point);
				} else if(seq.length){
					flushTop(seq); seq = [];
				}
			}
			if(seq.length){
				flushTop(seq); seq = [];
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
		for(var j = 0; j < contours.length; j++) for(var k = 0; k < contours[j].points.length; k++) if(contours[j].points[k].touched && contours[j].points.keypoint) {
			touchedPoints.push(contours[j].points[k]);
		}
		touchedPoints = touchedPoints.sort(function(p, q){ return p.yori - q.yori })
		out: for(var j = 0; j < contours.length; j++) { 
			var localtopp = null, localbottomp = null;
			for(var k = 0; k < contours[j].points.length; k++) {
				var point = contours[j].points[k];
				if(!localtopp || point.yori > localtopp.yori) localtopp = point;
				if(!localbottomp || point.yori < localbottomp.yori) localbottomp = point;
			}
			if(!localtopp.touched && !localtopp.donttouch) for(var k = 1; k < touchedPoints.length; k++) {
				if(touchedPoints[k].yori > localtopp.yori && touchedPoints[k - 1].yori <= localtopp.yori) {
					interpolate(touchedPoints[k], touchedPoints[k - 1], localtopp, true);
					break;
				}
			}
			if(!localbottomp.touched && !localbottomp.donttouch) for(var k = 1; k < touchedPoints.length; k++) {
				if(touchedPoints[k].yori > localbottomp.yori && touchedPoints[k - 1].yori <= localbottomp.yori) {
					interpolate(touchedPoints[k], touchedPoints[k - 1], localbottomp, true);
					break;
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
	initStemTouches(stems);
	uncollide(stems);
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