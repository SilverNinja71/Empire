# Penguin League

Rocket League-style car soccer with belly-sliding jetpack penguins instead of cars.
Play 1v1, 2v2 or 5v5 against bots from Easy to God. The bots drive a stock penguin with the same physics and controls as you; harder bots only play better. Earn fish to buy upgrades in the garage and hats, feathers and boost trails in the locker.

## Play

Open `index.html`, or run `./start.sh` at the repo root and go to `http://localhost:8080/penguin-league/`. Three.js and the fonts load from CDNs, so it needs an internet connection.

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Drive / reverse, tilt nose in the air | W / S | RT / LT, left stick |
| Steer, turn in the air | A / D | left stick |
| Jump (press again with a direction to belly dive) | Space or right click | A |
| Boost | Shift or left click | B |
| Powerslide | X | X |
| Ball cam | C | Y |
| Pause | Esc or P | Start |

## Build

The game is split into parts in `src/`. `./build.sh` joins them into `index.html` (standalone page) and `penguin-league.html` (page body for publishing elsewhere). `tools/check.sh` builds and syntax-checks the result with macOS JavaScriptCore.
