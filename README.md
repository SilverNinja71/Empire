# SilverNinja Games

Three browser games that share one account (username, sign-in and gold):

| Folder | Game |
| :--- | :--- |
| [`mace-pvp/`](mace-pvp/) | **Spear-Mace PVP**: 2D aerial fighting inspired by Minecraft's Mace and Spear |
| [`penguin-life/`](penguin-life/) | **Penguin Life**: a Duck Life-style game. Train swimming, waddling, climbing, jumping, hunting and stamina, then race from the Zoo to the Arctic, the North Pole and beyond |
| [`penguintrack/`](penguintrack/) | **Penguintrack**: a snow-themed, Trackmania-style 3D racer with a 35-track campaign, track editor, replays and ghosts, TAS tools and an AI training kit |

Run them locally (served from one origin so the account is shared):

```bash
./start.sh
```

Then open `http://localhost:8080/`.

The account is saved in the browser (`localStorage`), so it's shared by every game on the same site in the same browser.
