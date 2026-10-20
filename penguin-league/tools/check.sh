#!/bin/sh
# Builds the page, then syntax-checks the whole game module with JavaScriptCore
# (catches typos and duplicate top-level names across source files).
cd "$(dirname "$0")/.."
./build.sh >/dev/null || exit 1
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
TMP=$(mktemp -d)
python3 - "$TMP" <<'PY'
import sys, re
html = open('penguin-league.html').read()
m = re.search(r'<script type="module">\n(.*?)\n</script>', html, re.S)
open(sys.argv[1] + '/game.mjs', 'w').write(m.group(1))
open(sys.argv[1] + '/check.js', 'w').write("try { checkModuleSyntax(read('%s/game.mjs')); print('SYNTAX OK'); } catch (e) { print('SYNTAX ERROR: ' + e); }" % sys.argv[1])
PY
"$JSC" "$TMP/check.js"
rm -rf "$TMP"
