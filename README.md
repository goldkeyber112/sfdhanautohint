sfdhanautohint
=========================

An optimized hinting genreator for Han characters powered by Node.js.

Components
-------------------------
There are three major components in `sfdhanautohint`:

- `hanhint`, the major part, generates gridfit instructions optimized for Han characters
- `fontforge-scripts/prepare.pe`, the Fontforge script used to prepare a proper `.sfd` file used by `hanhint`
- `fontforge-scripts/finish.pe`, the Fontforge script which generates gridfit for non-Han characters

Hinting Strategy
-------------------------
Chinese, Japanese, and Korean characters often contain many strokes which are difficult to render distinctly at small sizes. Simply aligning horizontal and vertical strokes to the pixel grid (e.g., by rounding each stroke to the nearest grid point) is not sufficient to produce a clear image and can often lead to disastrous results (upper row). The *sfdhanautohint* generates optimized grid fitting instructions which performs character simplification when needed, to ensure that each character remains clear and legible, even at small sizes (lower row).

![sfdhanautohint side-by-side comparison](https://raw.githubusercontent.com/be5invis/sfdhanautohint/master/example-img/example.png)

The core hinting strategy is to minimize a number called "readbility potential" which measures the readibility loss of readibility caused by gridfitting, including stem collisions and stem merges. The minimization is achieved via a genetic algorithm.


Usage
-------------------------
The main command `hanhint` takes a Truetype (quadratic), unhinted `.sfd` font file into hinted font.

```bash
extract-features <hans.sfd> -o <features.hgf> {--<STRATEGY_PARAMETER_NAME>=<STRATEGY_PARAMETER_VALUE>}
hgfhint <features.hgf> -o <instructions.hgi> {--<STRATEGY_PARAMETER_NAME>=<STRATEGY_PARAMETER_VALUE>}
applyhgi <instructions.hgi> <hans.sfd> -o <hans-hinted.sfd> {--<STRATEGY_PARAMETER_NAME>=<STRATEGY_PARAMETER_VALUE>}
```

The input file `hans.sfd` should

* Have TrueType point index information
* Contain Han characters only
* Do not have any TT instructions

The strategy parameters determines how `sfdhanautohint` generate the instructions. The key parameters are:

* **Metric Parameters**
	* UPM : The units-per-em value of your sfd
	* BLUEZONE_TOP_CENTER and BLUEZONE_TOP_LIMIT : Center and lower limit of the top blue zone
	* BLUEZONE_BOTTOM_CENTER and BLUEZONE_BOTTOM_LIMIT: Center and upper limit of the bottom blue zone
	* BLUEZONE_TOP_BAR : Common position of the upper edge of "top" hotizontal strokes without any stroke above or touching its upper edge. Like the position of the first horizontal stroke in "里"
	* BLUEZONE_BOTTOM_BAR : Common position of the lower edge of "bottom" hotizontal strokes without any stroke below or touching its lower edge. Like the position of the lowest horizontal stroke in "里"
	* BLUEZONE_TOP_DOTBAR：Common position of the upper edge of "top" hotizontal strokes with stroke touching its upper edge. Like the position of the first horizontal stroke in "章"
	* BLUEZONE_BOTTOM_DOTBAR：Common position of the lower edge of "bottom" hotizontal strokes with stroke touching its upper edge.
	* gears : Stroke width allocation strategy. It is an array like `[[0,1,1],[20,2,1],[22,2,2]]`, each item is a triplet: ppem, common width (in pixels) and minimum width. The term `[20,2,1]` stands for "for sizes being 20,21px, most strokes are 2 pixels wide, though some thin strokes will be 1 pixel wide, even if the space below or undef is enough".

* **Stem Detection Parameters**
	* MIN_STEM_WIDTH and MAX_STEM_WIDTH ： Minimum and maximum of stem width
	* MOST_COMMON_STEM_WIDTH : The common stem width
	* STEM_SIDE_MIN_RISE : The maximum height of decorative shapes placed aside a hotizontal stem's upper edge.
	* STEM_SIDE_MIN_DESCENT : The maximum depth of decorative shapes placed aside a hotizontal stem's lower edge.

You can adjust these parameters using the `paramadj`:

```bash
paramadj hans.sfd -w "<test characters" {--<STRATEGY_PARAMETER_NAME>=<STRATEGY_PARAMETER_VALUE>}
```

It will provide an interactive parameter adjustment utility accessable from `localhost:9527`.