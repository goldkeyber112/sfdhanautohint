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

![Before sfdhanautohint](http://ww3.sinaimg.cn/large/798f7769gw1ek267cmaudj20m90gok26.jpg)

![After sfdhanautoyint](http://ww4.sinaimg.cn/large/798f7769gw1ekynffll4uj20m50gpwmb.jpg)

The core hinting strategy is to minimize a number called "readbility potential" which measures the readibility loss of readibility caused by gridfitting, including stem collisions and stem merges. The minimization is achieved via a genetic algorithm.


Usage
-------------------------
The main command `hanhint` takes a Truetype (quadratic), unhinted `.sfd` font file into hinted font.

```bash
hanhint <infile> -o <outfile> {--<STRATEGY_PARAMETER_NAME> <STRATEGY_PARAMETER_VALUE>}
```