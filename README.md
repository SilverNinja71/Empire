# SilverNinja Games

Two browser games that share one account (username, sign-in and gold):

| Folder | Game |
| :--- | :--- |
| [`mace-pvp/`](mace-pvp/) | **Spear-Mace PVP**: 2D aerial fighting inspired by Minecraft's Mace and Spear |
| [`penguin-life/`](penguin-life/) | **Penguin Life**: a Duck Life-style game. Train swimming, waddling, climbing, jumping, hunting and stamina, then race from the Zoo to the Arctic, the North Pole and beyond |

Run both locally (served from one origin so the account is shared):

```bash
./start.sh
```

Then open `http://localhost:8080/`.

The account is saved in the browser (`localStorage`), so it's shared by every game on the same site in the same browser.
