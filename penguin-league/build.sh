#!/bin/sh
# Concatenates the source parts into one self-contained page.
cd "$(dirname "$0")"
# page body (no doctype), the form used when publishing the page elsewhere
cat src/00-head.html src/0[1-6]*.js src/99-tail.html > penguin-league.html
# standalone page, so /penguin-league/ opens the game directly
{ printf '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>\n'; cat penguin-league.html; printf '\n</body></html>\n'; } > index.html
wc -l penguin-league.html
