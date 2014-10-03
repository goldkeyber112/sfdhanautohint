sfdhanautohint
=========================

An optimized hinting genreator for Han characters powered by Node.js. It turns

![Before sfdhanautohint](http://ww3.sinaimg.cn/large/798f7769gw1ek267cmaudj20m90gok26.jpg)

into

![After sfdhanautoyint](http://ww4.sinaimg.cn/large/798f7769gw1ekynffll4uj20m50gpwmb.jpg)

Components
-------------------------
There are three major components in `sfdhanautohint`:

- `hanhint`, the major part, generates gridfit instructions optimized for Han characters
- `fontforge-scripts/prepare.pe`, the Fontforge script used to prepare a proper `.sfd` file used by `hanhint`
- `fontforge-scripts/finish.pe`, the Fontforge script which generates gridfit for non-Han characters

Usage
-------------------------
The main command `hanhint` takes a Truetype (quadratic), unhinted `.sfd` font file into hinted font.

```bash
hanhint <infile> -o <outfile> {--<STRATEGY_PARAMETER_NAME> <STRATEGY_PARAMETER_VALUE>}
```