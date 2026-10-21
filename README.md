# SilverNinja Games

The front page for a set of browser games that share one account (username, sign-in, gold and trophies).
Play at https://silverninja71.github.io/Empire/.

Each game lives in its own repo:

| Repo | Game | Play |
| :--- | :--- | :--- |
| [`penguin-league`](https://github.com/SilverNinja71/penguin-league) | **Penguin League**: Rocket League-style soccer with jetpack penguins | [play](https://silverninja71.github.io/penguin-league/) |
| [`mace-pvp`](https://github.com/SilverNinja71/mace-pvp) | **Spear-Mace PVP**: 2D aerial fighting inspired by Minecraft's Mace and Spear | [play](https://silverninja71.github.io/mace-pvp/) |
| [`penguin-life`](https://github.com/SilverNinja71/penguin-life) | **Penguin Life**: a Duck Life-style game. Train your penguin, then race from the Zoo to the Arctic, the North Pole and beyond | [play](https://silverninja71.github.io/penguin-life/) |
| [`penguintrack`](https://github.com/SilverNinja71/penguintrack) | **Penguintrack**: a snow-themed, Trackmania-style 3D racer with a track editor, replays, TAS tools and an AI training kit | [play](https://silverninja71.github.io/penguintrack/) |
| [`battlegrounds`](https://github.com/SilverNinja71/battlegrounds) | **Stone Court Battlegrounds**: 3D arena brawler with combos, ultimates and room codes | [play](https://silverninja71.github.io/battlegrounds/) |

This repo holds:

- `index.html`: the game picker and trophy shelf.
- `shared/accounts.js`: the shared account. Every game loads it from `../Empire/shared/accounts.js`.
- `server.py` / `start.sh`: a local server for every game at once.

## Run everything locally

Clone the hub and the games side by side in one folder:

```bash
mkdir silverninja && cd silverninja
git clone https://github.com/SilverNinja71/Empire.git
git clone https://github.com/SilverNinja71/mace-pvp.git
git clone https://github.com/SilverNinja71/penguin-league.git
git clone https://github.com/SilverNinja71/penguin-life.git
git clone https://github.com/SilverNinja71/penguintrack.git
git clone https://github.com/SilverNinja71/battlegrounds.git
python3 Empire/server.py
```

Then open `http://localhost:8080/Empire/`. The server serves the whole folder, so the addresses match GitHub Pages and the account is shared.

Old links to the games' former addresses (`/mace-pvp/penguintrack/` and so on) are forwarded by redirect pages in the `mace-pvp` repo.

The account is saved in the browser (`localStorage`). Every repo is served from the same site (`silverninja71.github.io`), so all the games see it.
