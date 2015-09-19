function slopeOf(segs){
	var sy = 0, sx = 0, n = 0;
	for(var j = 0; j < segs.length; j++) for(var k = 0; k < segs[j].length; k++) {
		sy += segs[j][k].yori;
		sx += segs[j][k].xori;
		n += 1;
	};
	var ax = sx / n, ay = sy / n;
	var b1num = 0, b1den = 0;
	for(var j = 0; j < segs.length; j++) for(var k = 0; k < segs[j].length; k++) {
		b1num += (segs[j][k].xori - ax) * (segs[j][k].yori - ay);
		b1den += (segs[j][k].xori - ax) * (segs[j][k].xori - ax);
	};
	return b1num / b1den
}
function intercept(point, slope){
	return point.yori - point.xori * slope;
}
exports.extractFeature = function(glyph, strategy) {
	// Stem Keypoints
	for(var js = 0; js < glyph.stems.length; js++) {
		var s = glyph.stems[js];
		var b = !s.hasSameRadicalStemBelow
			&& !(s.hasRadicalPointBelow && s.radicalCenterDescent > strategy.STEM_CENTER_MIN_DESCENT)
			&& !(s.hasRadicalLeftAdjacentPointBelow && s.radicalLeftAdjacentDescent > strategy.STEM_SIDE_MIN_DESCENT)
			&& !(s.hasRadicalRightAdjacentPointBelow && s.radicalRightAdjacentDescent > strategy.STEM_SIDE_MIN_DESCENT)
			&& !s.hasGlyphStemBelow
		var slope = (slopeOf(s.high) + slopeOf(s.low)) / 2
		// get highkey and lowkey
		var highkey = s.high[0][0], lowkey = s.low[0][0], highnonkey = [], lownonkey = [];
		var jHigh = 0, jLow = 0;
		for(var j = 0; j < s.high.length; j++) for(var k = 0; k < s.high[j].length; k++) if(s.high[j][k].id >= 0 && intercept(s.high[j][k], slope) < intercept(highkey, slope)) {
			highkey = s.high[j][k];
			jHigh = j;
		}
		for(var j = 0; j < s.low.length; j++) for(var k = 0; k < s.low[j].length; k++) if(s.low[j][k].id >= 0 && intercept(s.low[j][k], slope)> intercept(lowkey, slope)) {
			lowkey = s.low[j][k];
			jLow = j;
		}
		highkey.touched = lowkey.touched = true;
		for(var j = 0; j < s.high.length; j++) for(var k = 0; k < s.high[j].length; k++) {
			if(j !== jHigh) {
				if(k === 0) {
					highnonkey.push(s.high[j][k])
					s.high[j][k].touched = true;
				} else {
					s.high[j][k].donttouch = true;
				}
			} else if(s.high[j][k] !== highkey){
				s.high[j][k].donttouch = true;
			}
		}
		for(var j = 0; j < s.low.length; j++) for(var k = 0; k < s.low[j].length; k++) {
			if(j !== jLow) {
				if(k === s.low[j].length - 1) {
					lownonkey.push(s.low[j][k])
					s.low[j][k].touched = true
				} else {
					s.low[j][k].donttouch = true
				}
			} else if(s.low[j][k] !== lowkey) {
				s.low[j][k].donttouch = true
			}
		};
		s.yori = highkey.yori;
		s.width = highkey.yori - lowkey.yori;
		s.posKey = b ? lowkey : highkey;
		s.advKey = b ? highkey : lowkey;
		s.posAlign = b ? lownonkey : highnonkey;
		s.advAlign = b ? highnonkey : lownonkey;
		s.posKeyAtTop = !b;
		s.posKey.keypoint = true;
	}
	
	// Blue zone points
	var topBluePoints = [];
	var bottomBluePoints = [];
	for(var j = 0; j < glyph.contours.length; j++) {
		for(var k = 0; k < glyph.contours[j].points.length - 1; k++){
			var point = glyph.contours[j].points[k];
			if(point.ytouch >= strategy.BLUEZONE_TOP_LIMIT && point.yExtrema && !point.touched && !point.donttouch){
				point.touched = true;
				point.keypoint = true;
				topBluePoints.push(point);
			}
			if(point.ytouch <= strategy.BLUEZONE_BOTTOM_LIMIT && point.yExtrema && !point.touched && !point.donttouch){
				point.touched = true;
				point.keypoint = true;
				bottomBluePoints.push(point);
			}

		}
	}

	// Interpolations
	var interpolations = [];
	var shortAbsorptions = [];
	function BY_YORI(p, q){ return p.yori - q.yori }

	function interpolateByKeys(pts, keys, inSameRadical){
		for(var k = 0; k < pts.length; k++) if(!pts[k].touched) {
			for(var m = 1; m < keys.length; m++) {
				if(strategy.DO_SHORT_ABSORPTION && inSameRadical && pts[k].yori - keys[m - 1].yori <= strategy.MAX_STEM_WIDTH
					&& Math.abs(pts[k].xori - keys[m - 1].xori) <= strategy.MAX_STEM_WIDTH) {
					shortAbsorptions.push([keys[m - 1].id, pts[k].id]);
					pts[k].touched = true;
					break;
				}
				if(keys[m].yori > pts[k].yori && keys[m - 1].yori <= pts[k].yori) {
					interpolations.push([keys[m - 1].id, keys[m].id, pts[k].id]);
					pts[k].touched = true;
					break;
				}
			}
		}
	}
	function findInterpolates(contours) {
		var glyphKeypoints = [];
		for(var j = 0; j < contours.length; j++) for(var k = 0; k < contours[j].points.length; k++) {
			if(contours[j].points[k].touched && contours[j].points[k].keypoint) {
				glyphKeypoints.push(contours[j].points[k]);
			}
		}
		glyphKeypoints = glyphKeypoints.sort(BY_YORI);

		for(var j = 0; j < contours.length; j++) {
			var contourpoints = contours[j].points
			var contourKeypoints = contourpoints.filter(function(p){ return p.touched });
			var contourExtrema = [];
			for(var k = 0; k < contours[j].points.length; k++) {
				var point = contours[j].points[k]
				if(point.yExtrema && !point.touched && !point.donttouch) {
					contourExtrema.push(point);
				}
			};
			if(contourKeypoints.length > 1) { 
				interpolateByKeys(contourExtrema, contourKeypoints.sort(BY_YORI), true)
			}
			interpolateByKeys(contourExtrema, glyphKeypoints, false)
		}
	};
	findInterpolates(glyph.contours);

	var directOverlaps = (function(){
		var d = [];
		for(var j = 0; j < glyph.stemOverlaps.length; j++){
			d[j] = [];
			for(var k = 0; k < j; k++) {
				d[j][k] = glyph.stemOverlaps[j][k] > strategy.COLLISION_MIN_OVERLAP_RATIO
			}
		};
		for(var x = 0; x < d.length; x++) for(var y = 0; y < d.length; y++) for(var z = 0; z < d.length; z++) {
			if(d[x][y] && d[y][z]) d[x][z] = false;
		};
		return d;
	})();
	return {
		stats: glyph.stats,
		stems: glyph.stems.map(function(s){
			return {
				xmin: s.xmin,
				xmax: s.xmax,
				yori: s.yori,
				width: s.width,
				atGlyphTop: s.atGlyphTop,
				atGlyphBottom: s.atGlyphBottom,
				
				hasGlyphStemAbove: s.hasGlyphStemAbove,
				hasSameRadicalStemAbove: s.hasSameRadicalStemAbove,
				hasRadicalPointAbove: s.hasRadicalPointAbove,
				radicalCenterRise: s.radicalCenterRise,
				hasGlyphPointAbove: s.hasGlyphPointAbove,
				glyphCenterRise: s.glyphCenterRise,
				hasRadicalLeftAdjacentPointAbove: s.hasRadicalLeftAdjacentPointAbove,
				hasRadicalRightAdjacentPointAbove: s.hasRadicalRightAdjacentPointAbove,
				radicalRightAdjacentRise: s.radicalRightAdjacentRise,
				radicalLeftAdjacentRise: s.radicalLeftAdjacentRise,
				hasGlyphLeftAdjacentPointAbove: s.hasGlyphLeftAdjacentPointAbove,
				hasGlyphRightAdjacentPointAbove: s.hasGlyphRightAdjacentPointAbove,
				glyphRightAdjacentRise: s.glyphRightAdjacentRise,
				glyphLeftAdjacentRise: s.glyphLeftAdjacentRise,
				hasRadicalLeftDistancedPointAbove: s.hasRadicalLeftDistancedPointAbove,
				hasRadicalRightDistancedPointAbove: s.hasRadicalRightDistancedPointAbove,
				radicalRightDistancedRise: s.radicalRightDistancedRise,
				radicalLeftDistancedRise: s.radicalLeftDistancedRise,
				hasGlyphLeftDistancedPointAbove: s.hasGlyphLeftDistancedPointAbove,
				hasGlyphRightDistancedPointAbove: s.hasGlyphRightDistancedPointAbove,
				glyphRightDistancedRise: s.glyphRightDistancedRise,
				glyphLeftDistancedRise: s.glyphLeftDistancedRise,
				
				hasGlyphStemBelow: s.hasGlyphStemBelow,
				hasSameRadicalStemBelow: s.hasSameRadicalStemBelow,
				hasRadicalPointBelow: s.hasRadicalPointBelow,
				radicalCenterDescent: s.radicalCenterDescent,
				hasGlyphPointBelow: s.hasGlyphPointBelow,
				glyphCenterDescent: s.glyphCenterDescent,
				hasRadicalLeftAdjacentPointBelow: s.hasRadicalLeftAdjacentPointBelow,
				hasRadicalRightAdjacentPointBelow: s.hasRadicalRightAdjacentPointBelow,
				radicalLeftAdjacentDescent: s.radicalLeftAdjacentDescent,
				radicalRightAdjacentDescent: s.radicalRightAdjacentDescent,
				hasGlyphLeftAdjacentPointBelow: s.hasGlyphLeftAdjacentPointBelow,
				hasGlyphRightAdjacentPointBelow: s.hasGlyphRightAdjacentPointBelow,
				glyphLeftAdjacentDescent: s.glyphLeftAdjacentDescent,
				glyphRightAdjacentDescent: s.glyphRightAdjacentDescent,
				hasRadicalLeftDistancedPointBelow: s.hasRadicalLeftDistancedPointBelow,
				hasRadicalRightDistancedPointBelow: s.hasRadicalRightDistancedPointBelow,
				radicalLeftDistancedDescent: s.radicalLeftDistancedDescent,
				radicalRightDistancedDescent: s.radicalRightDistancedDescent,
				hasGlyphLeftDistancedPointBelow: s.hasGlyphLeftDistancedPointBelow,
				hasGlyphRightDistancedPointBelow: s.hasGlyphRightDistancedPointBelow,
				glyphLeftDistancedDescent: s.glyphLeftDistancedDescent,
				glyphRightDistancedDescent: s.glyphRightDistancedDescent,
				
				posKey: {id: s.posKey.id, yori: s.posKey.yori},
				advKey: {id: s.advKey.id, yori: s.advKey.yori},
				posAlign: s.posAlign.map(function(x){ return x.id }),
				advAlign: s.advAlign.map(function(x){ return x.id }),
				posKeyAtTop: s.posKeyAtTop
			}
		}),
		stemOverlaps: glyph.stemOverlaps,
		directOverlaps: directOverlaps,
		collisionMatrices: glyph.collisionMatrices,
		topBluePoints: topBluePoints.map(function(x){ return x.id }),
		bottomBluePoints: bottomBluePoints.map(function(x){ return x.id }),
		interpolations: interpolations,
		shortAbsorptions: shortAbsorptions
	}
}