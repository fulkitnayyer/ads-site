#!/usr/bin/env bash
# Rebuilds public/fonts/archivo.woff2 from the Google Fonts source.
# Only needed if the type scale starts using a width or weight outside the ranges below,
# or a character outside the subset. Needs Python 3 with: pip install fonttools brotli
#
#   ./scripts/subset-font.sh
#
# Archivo (SIL Open Font License 1.1, see public/fonts/OFL.txt) by Omnibus-Type.
set -euo pipefail

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

curl -fsSL -o "$work/Archivo-VF.ttf" \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf"

# Keep only the axis ranges the type scale uses: weight 400-800, width 100-118.
python3 -m fontTools.varLib.instancer "$work/Archivo-VF.ttf" wght=400:800 wdth=100:118 \
  -o "$work/limited.ttf"

# Latin, Latin-1 and typographic punctuation (curly quotes, dashes, ellipsis, bullet, minus).
# Layout features: kerning, ligatures, case-sensitive forms, tabular/proportional figures.
python3 -m fontTools.subset "$work/limited.ttf" \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2009-200A,U+2011,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2032-2033,U+2039-203A,U+20AC,U+2122,U+2212" \
  --layout-features="kern,liga,ccmp,locl,mark,mkmk,case,tnum,lnum,pnum,rvrn" \
  --flavor=woff2 --no-hinting --desubroutinize --name-IDs='*' --drop-tables+=DSIG \
  --output-file="public/fonts/archivo.woff2"

ls -l public/fonts/archivo.woff2
