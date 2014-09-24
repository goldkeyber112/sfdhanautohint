var Contour = require('./types.js').Contour;
var Point = require('./types.js').Point;
var Glyph = require('./types.js').Glyph;

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
	var currentid = -1;
	var sequentid = -1;
	var nPoints = 0;
	for(var j = 0; j < input.length; j++){
		var line = input[j].trim().split(/ +/);
		var flags = line[line.length - 1].split(',');
		currentid = flags[1] - 0;
		if(line[2] === 'm'){
			// Moveto
			if(currentContour) contours.push(currentContour);
			currentContour = new Contour();
			currentContour.points.push(new Point(line[0] - 0, line[1] - 0, true, currentid))
		} else if(line[2] === 'l' && currentContour){
			// Lineto
			currentContour.points.push(new Point(line[0] - 0, line[1] - 0, true, currentid))
		} else if(line[6] === 'c' && currentContour){
			// curveTo
			currentContour.points.push(new Point(line[0] - 0, line[1] - 0, false, sequentid))
			currentContour.points.push(new Point(line[4] - 0, line[5] - 0, true, currentid))
		}
		sequentid = flags[2] - 0;
		nPoints = Math.max(nPoints, currentid, sequentid)
	}
	if(currentContour) contours.push(currentContour);
	contours.forEach(function(c){ c.stat() })
//	var nPoints = numberPoints(contours);
	var glyph = new Glyph(contours);
	glyph.nPoints = nPoints;
	return glyph
}

exports.parseSFD = parseSFD;