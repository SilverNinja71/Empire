# Penguin League

Rocket League-style car soccer with belly-sliding jetpack penguins instead of cars.
Play 1v1, 2v2 or 5v5 against bots from Easy to God. The bots drive a stock penguin with the same physics and controls as you; harder bots only play better. Earn fish to buy upgrades in the garage and hats, feathers and boost trails in the locker.

## Play

Open `index.html`, or run `./start.sh` at the repo root and go to `http://localhost:8080/penguin-league/`. Three.js and the fonts load from CDNs, so it needs an internet connection.

## Play with friends

Press **PLAY WITH FRIENDS** on the title screen, then **CREATE ROOM**, and send the invite link (`…/penguin-league/?room=CODE`) to up to 3 friends. Opening the link joins the room; friends can also type the 5-letter code. The host picks 1v1, 2v2 or 5v5, friends-vs-friends or all-together-vs-bots, the bot level and the match length, and bots fill the empty spots. Everyone drives a stock penguin.

The match runs on the host's computer, so the host should keep the tab open and in front. Friends send their controls and see the match about 0.1 s behind, which keeps motion smooth. Connections go browser to browser through PeerJS, so it needs an internet connection.

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Drive / reverse, tilt nose in the air | W / S | RT / LT, left stick |
| Steer, turn in the air | A / D | left stick |
| Jump (press again with a direction to belly dive) | Space or right click | A |
| Boost | Shift or left click | B |
| Charged shot (hold; steer at contact to curve it) | F | RB |
| Powerslide | X | X |
| Ball cam | C | Y |
| Pause | Esc or P | Start |

On touch screens there are on-screen JUMP, BOOST, SLIDE and SHOT buttons.

## Mechanics

- **Ice crystals:** six glowing crystal pads (four corners, two at midfield) fill the tank and give a 1.35× speed burst for 1.5 s, then regrow after 10 s. Small fish pads give 12 boost.
- **Spin and curve:** glancing hits, hits while turning and charged shots put sidespin on the ball, and a Magnus force bends it in flight (shown by an icy ribbon). Bot ball prediction uses the same physics.
- **Charged shots:** holding charge slows you slightly; past the first notch the next touch adds power and curves toward the side you're steering.
- **Goal highlight:** every goal plays 2.5 s of 0.35× slow motion with the camera zooming toward the net and the scorer, an air horn and confetti, then the kickoff resets.
- **Team roles:** each team has a Goalie, a Sweeper in 5v5, and Strikers. Only the lead striker chases the ball, duties swap as play moves, and badges over bot names show who is doing what.

## Build

The game is split into parts in `src/`. `./build.sh` joins them into `index.html` (standalone page) and `penguin-league.html` (page body for publishing elsewhere). `tools/check.sh` builds and syntax-checks the result with macOS JavaScriptCore.
