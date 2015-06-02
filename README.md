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
extract-features <infile.sfd> -o <features.hgf> {--<STRATEGY_PARAMETER_NAME> <STRATEGY_PARAMETER_VALUE>}
hgfhint <features.hgf> -o <instructions.hgi> {--<STRATEGY_PARAMETER_NAME> <STRATEGY_PARAMETER_VALUE>}
weave <instructions.hgi> <infile.sfd> -o <hinted.sfd> {--<STRATEGY_PARAMETER_NAME> <STRATEGY_PARAMETER_VALUE>}
```