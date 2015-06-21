var defaultStrategy = function(){
	var g = [[0,1,1],[23,2,2],[36,3,2]]
	return {
		UPM: 1000,
		MIN_STEM_WIDTH: 20,
		MAX_STEM_WIDTH: 100,
		MOST_COMMON_STEM_WIDTH: 65,
		STEM_SIDE_MIN_RISE: 40,
		STEM_SIDE_MIN_DESCENT: 60,
		PPEM_MIN: 10,
		PPEM_MAX: 36,
		POPULATION_LIMIT: 1000,
		CHILDREN_LIMIT: 1000,
		EVOLUTION_STAGES: 25,
		MUTANT_PROBABLITY: 0.075,
		ELITE_COUNT: 10,
		ABLATION_IN_RADICAL: 1,
		ABLATION_RADICAL_EDGE: 2,
		ABLATION_GLYPH_EDGE: 30,
		ABLATION_GLYPH_HARD_EDGE: 50,
		COEFF_PORPORTION_DISTORTION: 4,
		BLUEZONE_BOTTOM_CENTER: -77,
		BLUEZONE_TOP_CENTER: 836,
		BLUEZONE_BOTTOM_LIMIT: -65,
		BLUEZONE_TOP_LIMIT: 810,
		BLUEZONE_WIDTH: 15,
		COEFF_A_MULTIPLIER: 10,
		COEFF_A_SAME_RADICAL: 4,
		COEFF_A_SHAPE_LOST: 25,
		COEFF_A_FEATURE_LOSS: 30,
		COEFF_A_RADICAL_MERGE: 1,
		COEFF_C_MULTIPLIER: 100,
		COEFF_C_SAME_RADICAL: 6,
		COEFF_S: 10000,
		COEFF_DISTORT: 5,
		REBALANCE_PASSES: 10,
		COLLISION_MIN_OVERLAP_RATIO: 0.2,
		DONT_ADJUST_STEM_WIDTH: false,
		PPEM_STEM_WIDTH_GEARS: g,
		gears: JSON.stringify(g)
	}
};
exports.defaultStrategy = defaultStrategy();
exports.from = function(argv){
	var strategy = defaultStrategy();
	for(var prop in strategy) {
		if(argv[prop]) {
			strategy[prop] = isFinite(argv[prop] - 0) ? argv[prop] : strategy[prop]
		}
	};
	if(argv.gears) {
		try {
			strategy.PPEM_STEM_WIDTH_GEARS = JSON.parse(argv.gears)
			strategy.gears = argv.gears
		}catch(e){
		}
	};
	return strategy;
}