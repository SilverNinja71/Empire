// ==========================================
// PENGUIN LIFE - Training mini-games
// Swimming, Waddling, Climbing, Jumping and Sliding.
// Each game gets harder the longer you last. Your level in that skill makes
// the penguin quicker and more forgiving; the biome sets the base difficulty.
// ==========================================
(function (PL) {
    const W = PL.W, H = PL.H;

    const POWER_TIME = { magnet: 9, double: 9 };
    const POWER_NAMES = { magnet: "Coin Magnet!", shield: "Shield!", double: "Double Coins!" };
    PL.POWER_TIME = POWER_TIME;

    // Weather with gameplay effects. Blizzard: fresh powder makes slides 20% slicker and rare Frost Fish
    // turn up. Northern Lights: 1.5x training XP and power-ups (the rare drops) show up 1.6x as often.
    PL.WEATHER_FX = {
        blizzard: { name: "BLIZZARD!", color: "#e1f5fe", sub: "Slides +20% · rare Frost Fish about", slide: 1.2, frost: true },
        aurora: { name: "NORTHERN LIGHTS!", color: "#69f0ae", sub: "x1.5 XP · more power-ups", xp: 1.5, drops: 1.6 }
    };
    const FROST_FISH_VALUE = 10;
    // More momentum on a slide: less drag and a higher top speed
    PL.slickSlide = function (P, k) {
        P.drag /= k;
        P.maxS *= k;
        return P;
    };

    // Predator lunges in the chase games: LUNGE.wind seconds of warning (red ring), then the strike.
    // Dodging during the warning is a Perfect Dodge; up to LUNGE.late seconds into the strike still dodges.
    const LUNGE = { wind: 0.4, strike: 0.32, late: 0.12, perfectCoins: 5, counter: 1.5 };
    PL.LUNGE = LUNGE;

    class Game {
        constructor(c) {
            this.c = c;
            this.b = c.biome;
            this.d = this.b.diff;
            this.t = 0;
            this.over = false;
            this.coins = 0;
            this.hearts = 3;
            this.inv = 0;
            // Combo: clean moves in a row. Every 8 raises the coin multiplier (up to x2.5)
            this.combo = 0;
            this.bestCombo = 0;
            this.mult = 1;
            // Power-ups and things to pick up
            this.powers = { magnet: 0, double: 0, shield: false };
            this.pickups = [];
            this.powerTimer = PL.rand(8, 13);
            this.happyT = 0;
            this.coinTarget = [W - 96, 66];
            // Weather / time of day for this run (chases are always moody)
            this.mood = PL.pickMood(this.b, null, !!this.constructor.CHASE);
            this.weather = PL.WEATHER_FX[this.mood] || null;
            this.weatherShown = false;
            this.frostTimer = PL.rand(9, 14);
            this.frostFish = 0;
            this.perfectDodges = 0;
            this.lunge = null;
        }
        burst(x, y, color, n) {
            PL.fx.burst(x, y, { color, n: n || 10, speed: 220, life: 0.6 });
        }
        popup(text, x, y, color) {
            PL.fx.text(text, x, y, { color: color || "#ffffff", size: 22 });
        }

        // ---------- Combo ----------
        clean(x, y, label) {
            this.combo++;
            this.bestCombo = Math.max(this.bestCombo, this.combo);
            const m = Math.min(2.5, 1 + Math.floor(this.combo / 8) * 0.5);
            if (m > this.mult) {
                this.mult = m;
                PL.fx.banner("COMBO x" + m + "!", "#ffca28");
                PL.sfx("combo");
            }
            if (label) this.popup(label, x, y, "#fff59d");
        }
        breakCombo(x, y) {
            if (this.combo >= 8) this.popup("Combo lost!", x, y - 30, "#ff8a80");
            this.combo = 0;
            this.mult = 1;
        }

        // ---------- Coins ----------
        coinValue(v) {
            return Math.max(1, Math.round(v * this.mult * (this.powers.double > 0 ? 2 : 1)));
        }
        collectCoin(x, y, v) {
            const val = this.coinValue(v || 1);
            this.coins += val;
            this.happyT = 0.35;
            PL.fx.sparkle(x, y);
            PL.fx.flyCoin(x, y, this.coinTarget[0], this.coinTarget[1]);
            if (val > 1) this.popup("+" + val, x, y - 20, "#ffeb3b");
            PL.sfx("coin");
        }

        // ---------- Pickups (coins and power-ups) ----------
        addCoin(x, y) {
            this.pickups.push({ x, y, kind: "coin", t: Math.random() * 6 });
        }
        addCoinArc(x, y, n, rise) {
            for (let i = 0; i < n; i++) {
                const f = n > 1 ? i / (n - 1) : 0.5;
                this.addCoin(x + i * 32, y - Math.sin(f * Math.PI) * (rise || 0));
            }
        }
        addPower(x, y, kinds) {
            const list = kinds || ["magnet", "shield", "double"];
            this.pickups.push({ x, y, kind: list[Math.floor(Math.random() * list.length)], t: 0 });
        }
        // Counts down to the next power-up; the game decides where to put it
        powerDue(dt) {
            this.powerTimer -= dt * ((this.weather && this.weather.drops) || 1);
            if (this.powerTimer > 0) return false;
            this.powerTimer = PL.rand(12, 18);
            return true;
        }
        // Blizzard only: a rare Frost Fish every so often (placed by each game, like a power-up)
        frostDue(dt) {
            if (!this.weather || !this.weather.frost) return false;
            this.frostTimer -= dt;
            if (this.frostTimer > 0) return false;
            this.frostTimer = PL.rand(12, 18);
            return true;
        }
        addFrostFish(x, y) {
            this.pickups.push({ x, y, kind: "frostfish", t: 0 });
        }
        catchFrostFish(x, y) {
            const val = this.coinValue(FROST_FISH_VALUE);
            this.frostFish++;
            this.coins += val;
            this.happyT = 0.6;
            PL.fx.banner("FROST FISH!", "#b3e5fc", "+" + val + " coins");
            PL.fx.burst(x, y, { n: 22, color: ["#e1f5fe", "#81d4fa", "#ffffff"], shape: "star", speed: 260, gravity: 0, life: 0.7 });
            for (let i = 0; i < 3; i++) PL.fx.flyCoin(x, y, this.coinTarget[0], this.coinTarget[1]);
            PL.sfx("catch");
        }
        movePickups(dx, dy) {
            for (const p of this.pickups) {
                p.x += dx;
                p.y += dy;
            }
        }
        // (px, py) is the penguin's middle on screen, r its size.
        // offX / offY are the camera for worlds that scroll (pickups are in world coords there).
        updatePickups(dt, px, py, r, offX, offY) {
            offX = offX || 0;
            offY = offY || 0;
            for (const p of this.pickups) {
                p.t += dt;
                const sx = p.x - offX, sy = p.y - offY;
                const dist = Math.hypot(sx - px, sy - py);
                if (this.powers.magnet > 0 && p.kind === "coin" && dist < 240) {
                    const a = Math.atan2(py - sy, px - sx);
                    p.x += Math.cos(a) * 620 * dt;
                    p.y += Math.sin(a) * 620 * dt;
                }
                if (dist < r + (p.kind === "coin" ? 14 : 22)) {
                    p.got = true;
                    if (p.kind === "coin") this.collectCoin(sx, sy, 1);
                    else if (p.kind === "frostfish") this.catchFrostFish(sx, sy);
                    else this.gainPower(p.kind, sx, sy);
                }
            }
            const ahead = this.cullAhead || 600;
            this.pickups = this.pickups.filter((p) => {
                const sx = p.x - offX, sy = p.y - offY;
                if (p.got || sx <= -80 || sx >= W + ahead) return false;
                // Only check the height once it's close to the screen
                return sx > W + 40 || (sy < H + 80 && sy > -600);
            });
        }
        gainPower(kind, x, y) {
            if (kind === "shield") this.powers.shield = true;
            else this.powers[kind] = POWER_TIME[kind];
            PL.fx.banner(POWER_NAMES[kind], "#80deea");
            PL.fx.burst(x, y, { n: 18, color: ["#80deea", "#ffffff", "#fff59d"], shape: "star", speed: 240, gravity: 0, life: 0.6 });
            PL.sfx("power");
        }
        drawPickups(ctx, offX, offY) {
            for (const p of this.pickups) {
                const x = p.x - (offX || 0), y = p.y - (offY || 0);
                if (x < -40 || x > W + 40) continue;
                if (p.kind === "coin") PL.drawCoin(ctx, x, y, this.t + p.t);
                else if (p.kind === "frostfish") PL.drawFrostFish(ctx, x, y, this.t + p.t);
                else PL.drawPowerup(ctx, x, y, p.kind, this.t + p.t);
            }
        }

        // ---------- Getting hit ----------
        hurt(x, y) {
            if (this.inv > 0) return false;
            if (this.useShield(x, y)) return false;
            this.hearts--;
            this.inv = 1.3;
            this.hitFx(x, y);
            if (this.hearts <= 0) this.over = true;
            return true;
        }
        useShield(x, y) {
            if (!this.powers.shield) return false;
            this.powers.shield = false;
            this.inv = 1.0;
            PL.fx.burst(x, y, { n: 20, color: ["#80deea", "#e0f7fa", "#ffffff"], shape: "star", speed: 280, gravity: 0, life: 0.5 });
            this.popup("Shield saved you!", x, y - 40, "#80deea");
            PL.sfx("shield");
            return true;
        }
        hitFx(x, y) {
            PL.sfx("hit");
            PL.fx.shake(9, 0.3);
            PL.fx.stop(0.07);
            PL.fx.flash("#ff1744", 0.22, 0.18);
            PL.fx.burst(x, y, { n: 14, color: ["#ffffff", "#ffcdd2"], shape: "star", speed: 260, life: 0.5 });
            this.breakCombo(x, y);
        }

        // ---------- Predator lunges (chase games) ----------
        // Every few seconds the chaser winds up (red ring for LUNGE.wind seconds), then strikes.
        // pressed: the game's dodge move was just pressed. ready: the chaser can lunge right now.
        // Returns "perfect" (dodged during the wind-up), "dodge" (just in time), "hit", or null.
        stepLunge(dt, pressed, ready) {
            const L = this.lunge || (this.lunge = { phase: "idle", t: PL.rand(6, 9), dodged: false, hitDone: false });
            L.t -= dt;
            if (L.phase === "idle") {
                if (L.t <= 0) {
                    if (!ready || this.over) {
                        L.t = 0.5;
                        return null;
                    }
                    L.phase = "wind";
                    L.t = LUNGE.wind;
                    L.dodged = false;
                    L.hitDone = false;
                    PL.sfx("lunge");
                }
                return null;
            }
            if (L.phase === "wind") {
                if (pressed) {
                    L.dodged = true;
                    L.phase = "strike";
                    L.t = LUNGE.strike;
                    return "perfect";
                }
                if (L.t <= 0) {
                    L.phase = "strike";
                    L.t = LUNGE.strike;
                }
                return null;
            }
            // Strike
            let ev = null;
            if (!L.dodged && !L.hitDone) {
                if (pressed && LUNGE.strike - L.t <= LUNGE.late) {
                    L.dodged = true;
                    ev = "dodge";
                } else if (LUNGE.strike - L.t > LUNGE.late) {
                    L.hitDone = true;
                    ev = "hit";
                }
            }
            if (L.t <= 0) {
                L.phase = "idle";
                L.t = PL.rand(5, 9) - this.hard01() * 2;
            }
            return ev;
        }
        hard01() {
            return Math.min(1, this.t / 120);
        }
        // 0..1 progress of the red warning ring, or -1 when there's no wind-up
        lungeWind() {
            const L = this.lunge;
            return L && L.phase === "wind" ? 1 - L.t / LUNGE.wind : -1;
        }
        // How far the chaser has surged forward (0..1) during a strike, for drawing
        lungeSurge() {
            const L = this.lunge;
            return L && L.phase === "strike" ? Math.sin((1 - L.t / LUNGE.strike) * Math.PI) : 0;
        }
        perfectDodge(x, y) {
            this.perfectDodges++;
            PL.fx.slowmo(0.45, 0.3);
            PL.fx.banner("PERFECT DODGE!", "#ffea00", "Counter-attack x" + LUNGE.counter + "!");
            PL.fx.burst(x, y, { n: 24, color: ["#ffea00", "#ffffff", "#ff9100"], shape: "star", speed: 300, gravity: 0, life: 0.6 });
            this.collectCoin(x, y - 30, LUNGE.perfectCoins);
            this.clean(x, y - 60, null);
            PL.sfx("perfect");
        }
        plainDodge(x, y) {
            this.popup("Dodged!", x, y - 50, "#b9f6ca");
            PL.fx.dust(x, y, 4);
        }
        drawLunge(ctx, hx, hy, r) {
            const k = this.lungeWind();
            if (k >= 0) PL.drawLungeRing(ctx, hx, hy, r, k, this.t);
        }
        // Shown once at the start when the weather changes the rules
        weatherBanner() {
            if (this.weatherShown || !this.weather || this.t < 1.2) return;
            this.weatherShown = true;
            PL.fx.banner(this.weather.name, this.weather.color, this.weather.sub);
        }

        stepCommon(dt) {
            this.t += dt;
            this.inv = Math.max(0, this.inv - dt);
            this.happyT = Math.max(0, this.happyT - dt);
            this.powers.magnet = Math.max(0, this.powers.magnet - dt);
            this.powers.double = Math.max(0, this.powers.double - dt);
            this.weatherBanner();
        }
        // Penguin's face: dizzy when hit, scared when the chaser is close, happy after a coin
        face(danger) {
            return this.inv > 0 ? "hurt" : danger ? "scared" : this.happyT > 0 ? "happy" : "normal";
        }

        // HUD extras: combo counter and active power-ups (top right, under the coins)
        drawCommon(ctx) {
            let y = 104;
            if (this.combo >= 2) {
                const pulse = this.mult > 1 ? 1 + Math.abs(Math.sin(this.t * 6)) * 0.08 : 1;
                ctx.save();
                ctx.translate(W - 20, y);
                ctx.scale(pulse, pulse);
                PL.hudText(ctx, "Combo " + this.combo + (this.mult > 1 ? "  x" + this.mult : ""), 0, 0, { size: 18, align: "right", color: this.mult > 1 ? "#ffca28" : "#ffffff" });
                ctx.restore();
                y += 32;
            }
            for (const k of ["shield", "magnet", "double"]) {
                const on = k === "shield" ? this.powers.shield : this.powers[k] > 0;
                if (!on) continue;
                PL.drawPowerup(ctx, W - 36, y + 6, k, this.t, true);
                if (k !== "shield") PL.drawBar(ctx, W - 132, y + 1, 72, 10, this.powers[k] / POWER_TIME[k], "#80deea", "");
                y += 42;
            }
        }
        drawHearts(ctx) {
            for (let i = 0; i < 3; i++) PL.drawHeart(ctx, W - 100 + i * 30, 30, i < this.hearts);
        }
        drawCoinCount(ctx) {
            const bump = 1 + PL.fx.coinBump * 1.8;
            ctx.save();
            ctx.translate(W - 96, 66);
            ctx.scale(bump, bump);
            PL.drawCoin(ctx, 0, 0, 0);
            ctx.restore();
            PL.hudText(ctx, "+" + this.coins, W - 78, 67, { size: 18 });
        }
        flashPenguin() {
            return this.inv > 0 && Math.floor(this.t * 12) % 2 === 0;
        }
        // value is the run's score number (meters, walls, fish) used for stars, bests and missions
        result(stat, xpBase, scoreText, value) {
            const wxp = (this.weather && this.weather.xp) || 1;
            return {
                stat,
                xp: Math.round(xpBase * this.b.xpMult * (1 + Math.min(0.25, this.bestCombo * 0.01)) * wxp),
                weather: this.weather ? this.mood : null,
                weatherXp: wxp,
                perfectDodges: this.perfectDodges,
                frostFish: this.frostFish,
                staminaXp: Math.round((6 + this.t * 0.35) * this.b.xpMult),
                coins: this.coins,
                score: scoreText,
                value: Math.floor(value || 0),
                bestCombo: this.bestCombo
            };
        }
    }

    // ---------------- SWIMMING ----------------
    // A predator chases you. Land chunks float at the surface: dive under them,
    // or leap out of the water and run across the top. It keeps getting faster.
    const SWIM_SETBACK = 75; // how much closer a mistake lets the predator get
    class SwimGame extends Game {
        constructor(c) {
            super(c);
            this.title = "Swimming";
            this.hint = "↑ / ↓ to swim · hold ↑ at the surface to leap and run over land · or dive under it!";
            this.lv = c.lv.swim;
            this.surface = 190;
            this.floor = 505;
            this.px = 380;
            this.py = 320;
            this.vy = 0;
            this.mode = "swim"; // swim | air | land
            this.land = null;
            this.hopT = 0;
            this.squash = 0;
            this.fromLand = false;
            this.baseX = 380;
            this.stun = 0;
            this.speed = 190 + this.d * 35;
            this.dist = 0;
            this.predX = 70;
            this.predY = 320;
            this.obs = [];
            this.jellies = [];
            this.bubbleT = 0;
            this.next = 300;
            this.id = 1;
        }
        get hard() {
            return Math.min(1, this.dist / 9000 + (this.d - 1) * 0.15);
        }
        // Long stretches of land with wide open water between them.
        // Returns the chunk's width so the next one can be spaced after it.
        spawn() {
            const x = W + 30;
            const w = PL.rand(240, 420) + this.hard * 60;
            const depth = PL.rand(60, 110 + this.hard * 90);
            const chunk = { kind: "chunk", x, w, top: this.surface - 34, bottom: this.surface + depth, id: this.id++ };
            this.obs.push(chunk);
            if (Math.random() < 0.35 + this.hard * 0.5) {
                // Seabed rocks under the land leave a narrow tunnel to squeeze through
                const gap = 86 - this.hard * 22;
                const top = Math.max(chunk.bottom + gap, this.floor - 200);
                if (this.floor - top > 40) {
                    const two = w > 330 && Math.random() < 0.5;
                    const spots = two ? [PL.rand(10, w / 2 - 90), PL.rand(w / 2 + 10, w - 90)] : [PL.rand(20, w - 100)];
                    for (const off of spots) this.obs.push({ kind: "rock", x: x + off, w: 80, top, bottom: this.floor, id: this.id++ });
                }
            }
            // Stinging jellyfish drifting up and down in the open water after the land
            if (this.dist > 1200 && Math.random() < 0.35 + this.hard * 0.4) {
                this.jellies.push({ x: x + w + PL.rand(140, 280), y0: PL.rand(this.surface + 60, this.floor - 70), ph: Math.random() * 6 });
            }
            // Coins: along the top of the land (leap up and hop across for them) or through the tunnel below
            const r = Math.random();
            const n = Math.max(4, Math.floor(w / 42));
            if (r < 0.45) this.addCoinArc(x + 30, chunk.top - 28, n, 18);
            else if (r < 0.85) this.addCoinArc(x + 24, chunk.bottom + 42, n, 0);
            // A wavy line of coins out in the open water
            if (Math.random() < 0.5) {
                const cy = PL.rand(this.surface + 70, this.floor - 80);
                for (let i = 0; i < 5; i++) this.addCoin(x + w + 90 + i * 34, cy + Math.sin(i * 1.2) * 26);
            }
            return w;
        }
        update(dt) {
            const I = PL.input;
            this.stepCommon(dt);
            this.speed += dt * (7 + this.d * 2);
            const move = this.speed * dt;
            this.dist += move;
            this.next -= move;
            if (this.next <= 0) {
                const w = this.spawn();
                this.next = w + PL.rand(320, 540) * (1 - this.hard * 0.25);
            }
            for (const o of this.obs) o.x -= move;
            this.movePickups(-move, 0);
            if (this.powerDue(dt)) this.addPower(W + 40, PL.rand(this.surface + 50, this.floor - 60));
            if (this.frostDue(dt)) this.addFrostFish(W + 60, PL.rand(this.surface + 60, this.floor - 70));
            for (const j of this.jellies) {
                j.x -= move;
                j.y = j.y0 + Math.sin(this.t * 1.8 + j.ph) * 45;
            }
            this.jellies = this.jellies.filter((j) => j.x > -40);
            this.obs = this.obs.filter((o) => o.x + o.w > -60);

            const ctrl = 220 + this.lv * 6;
            this.squash = Math.max(0, this.squash - dt);
            const prevY = this.py;
            if (this.mode === "land") {
                // On land the penguin hops along, then jumps off the far edge
                this.py = this.land.top;
                this.hopT += dt;
                if (this.land.x + this.land.w < this.px + 6) {
                    this.mode = "air";
                    this.fromLand = true;
                    this.vy = -400;
                    PL.sfx("jump");
                } else if (I.hit("up") || I.hit("action")) {
                    this.mode = "air";
                    this.fromLand = true;
                    this.vy = -470;
                    PL.sfx("jump");
                }
            } else if (this.mode === "air") {
                this.vy += 1150 * dt;
                this.py += this.vy * dt;
                for (const o of this.obs) {
                    if (o.kind === "chunk" && this.vy > 0 && this.px > o.x + 4 && this.px < o.x + o.w - 4 && this.py >= o.top && prevY <= o.top + 6) {
                        this.mode = "land";
                        this.land = o;
                        this.py = o.top;
                        this.hopT = 0;
                        this.squash = 0.15;
                        PL.fx.dust(this.px, o.top, 5);
                        PL.sfx("step");
                        break;
                    }
                }
                if (this.mode === "air" && this.vy > 0 && this.py >= this.surface + 6) {
                    this.mode = "swim";
                    this.fromLand = false;
                    PL.sfx("splash");
                    PL.fx.splash(this.px, this.surface, 16);
                }
            } else {
                let dy = 0;
                this.stun = Math.max(0, this.stun - dt);
                if (this.stun <= 0) {
                    if (I.down("up")) dy -= 1;
                    if (I.down("down")) dy += 1;
                }
                this.py += dy * ctrl * dt;
                this.vy = dy * ctrl;
                if (this.py < this.surface + 12) {
                    if (I.down("up") || I.down("action")) {
                        this.mode = "air";
                        this.vy = -(420 + this.lv * 2);
                        this.py = this.surface;
                        PL.sfx("jump");
                        PL.fx.splash(this.px, this.surface, 10);
                    } else {
                        this.py = this.surface + 12;
                    }
                }
                this.py = Math.min(this.py, this.floor - 16);
            }

            // Solid obstacles: the penguin is pushed out of anything it runs into.
            // Getting pushed back means the predator catches up.
            let blocked = false;
            if (this.mode !== "land") {
                const air = this.mode === "air";
                const hw = air ? 16 : 24;
                for (let pass = 0; pass < 2; pass++) {
                    for (const o of this.obs) {
                        if (o.ghost) continue;
                        const L = o.x + 6, R = o.x + o.w - 6, T = o.top + 2, B = o.bottom - 2;
                        const top = air ? this.py - 60 : this.py - 11;
                        const bot = air ? this.py - 2 : this.py + 11;
                        if (!(this.px + hw > L && this.px - hw < R && bot > T && top < B)) continue;
                        const pushLeft = this.px + hw - L;
                        // Chunks push you down (under them), rocks push you up (over them)
                        const pushV = o.kind === "chunk" ? B - top : bot - T;
                        const vOk = o.kind === "chunk" ? (air || B + 11 < this.floor - 16) : (!air && T - 11 > this.surface + 12);
                        if (vOk && pushV < pushLeft) {
                            if (o.kind === "chunk") {
                                this.py += pushV;
                                if (air) this.vy = Math.max(this.vy, 0);
                            } else {
                                this.py -= pushV;
                            }
                        } else {
                            this.px -= pushLeft;
                            blocked = true;
                            if (!o.bumped) {
                                o.bumped = true;
                                if (this.useShield(this.px + hw, this.py)) {
                                    o.ghost = true;
                                } else {
                                    this.hitFx(this.px + hw, this.py);
                                    this.predX += SWIM_SETBACK; // mistakes let the predator lunge closer
                                    this.popup("Blocked!", this.px, this.py - 40, "#ff8a80");
                                }
                            }
                        }
                    }
                }
            }
            // Jellyfish sting: knocked back and dazed for a moment
            for (const j of this.jellies) {
                if (!j.hit && Math.hypot(j.x - this.px, j.y - this.py) < 30) {
                    j.hit = true;
                    if (this.useShield(this.px, this.py)) continue;
                    this.px -= 70;
                    this.stun = 0.5;
                    this.hitFx(this.px, this.py);
                    this.predX += SWIM_SETBACK;
                    this.popup("Stung!", this.px, this.py - 40, "#ff8a80");
                }
            }
            // Predator lunges: a fresh ↑ / ↓ / jump while the red ring flashes is a Perfect Dodge
            const lev = this.stepLunge(dt, I.hit("up") || I.hit("down") || I.hit("action"), this.mode === "swim" && this.stun <= 0);
            if (lev === "perfect") {
                this.perfectDodge(this.px, this.py);
                this.predX -= SWIM_SETBACK * LUNGE.counter; // counter-attack: knock it back
                PL.fx.burst(this.predX + 60, this.predY, { n: 14, color: ["#ffffff", "#b3e5fc"], speed: 220, life: 0.5 });
            } else if (lev === "dodge") this.plainDodge(this.px, this.py);
            else if (lev === "hit" && !this.useShield(this.px, this.py)) {
                this.hitFx(this.px, this.py);
                this.predX += SWIM_SETBACK;
                this.popup("Bitten!", this.px, this.py - 40, "#ff8a80");
            }
            // Swim back up to your normal spot when nothing is in the way
            if (!blocked && this.px < this.baseX) this.px = Math.min(this.baseX, this.px + (30 + this.lv * 2.5) * dt);

            // Clean passes build the combo
            for (const o of this.obs) {
                if (o.kind === "chunk" && !o.scored && o.x + o.w < this.px - 30) {
                    o.scored = true;
                    if (!o.bumped) this.clean(this.px, this.py - 50, this.combo % 5 === 4 ? "Smooth!" : null);
                }
            }
            for (const j of this.jellies) {
                if (!j.scored && j.x < this.px - 40) {
                    j.scored = true;
                    if (!j.hit) this.clean(this.px, this.py - 50, "Dodged!");
                }
            }
            const midY = this.mode === "swim" ? this.py : this.py - 30;
            this.updatePickups(dt, this.px, midY, 22);
            // Bubble trail while swimming
            this.bubbleT -= dt;
            if (this.mode === "swim" && this.bubbleT <= 0) {
                this.bubbleT = 0.09;
                PL.fx.bubbles(this.px - 26, this.py + PL.rand(-6, 6), 1);
            }

            // Predator creeps closer; a better swimmer pulls away
            // The predator only gains when you make a mistake; swim cleanly and it drops back
            // (after a counter-attack it's pushed back further and swims back up to its spot)
            this.predX = this.predX < 70 ? Math.min(70, this.predX + 45 * dt) : Math.max(70, this.predX - (10 + this.lv * 0.3) * dt);
            this.predY = PL.lerp(this.predY, PL.clamp(this.py, this.surface + 30, this.floor - 40), dt * 1.5);
            if (this.predX >= this.px - 40) {
                this.over = true;
                this.caught = true;
                PL.sfx("hit");
                PL.fx.shake(14, 0.45);
                PL.fx.flash("#b71c1c", 0.35, 0.3);
            }
        }
        draw(ctx) {
            const b = this.b;
            const gap = PL.clamp((this.px - 40 - this.predX) / (this.baseX - 110), 0, 1);
            PL.drawBackdrop(ctx, b, this.dist, this.surface, this.t, this.mood);
            PL.drawWater(ctx, b, 0, this.surface, W, this.floor - this.surface, this.t, this.dist);
            PL.drawSeaLife(ctx, b, this.surface, this.floor - this.surface, this.t, this.dist);
            PL.drawSeabed(ctx, b, 0, this.floor, W, H - this.floor, this.dist, this.t);
            // Seaweed, sea grass and coral swaying on the seabed
            for (let k = Math.floor(this.dist / 85) - 1; k * 85 < this.dist + W + 85; k++) {
                const x = k * 85 - this.dist + PL.hash(k) * 40;
                PL.drawSeaweed(ctx, b, x, this.floor + 4, 50 + PL.hash(k + 5) * 110, this.t, k);
            }
            // Gloomy water: something is hunting you
            ctx.fillStyle = "#0b1a2a";
            ctx.globalAlpha = 0.2;
            ctx.fillRect(0, this.surface + 8, W, H - this.surface);
            ctx.globalAlpha = 1;

            for (const o of this.obs) {
                if (o.ghost) ctx.globalAlpha = 0.45;
                if (o.kind === "chunk") PL.drawChunk(ctx, b, o.x, o.top, o.w, o.bottom, o.id, this.t, this.surface);
                else PL.drawSeaRock(ctx, b, o.x, o.top, o.w, o.bottom, o.id, this.t);
                ctx.globalAlpha = 1;
            }
            PL.drawSpeedLines(ctx, this.speed, this.t, this.surface + 10, this.floor - 10);
            this.drawPickups(ctx);
            for (const j of this.jellies) PL.drawJelly(ctx, j.x, j.y, this.t + j.ph, j.hit);

            const lx = this.predX + Math.max(0, this.lungeWind()) * 20 + this.lungeSurge() * 70;
            PL.drawPredator(ctx, b.predator, lx, this.predY, 0.85, this.t, Math.max(1 - gap, this.lungeSurge()));
            this.drawLunge(ctx, Math.max(46, lx - 18), this.predY, 42);

            if (!this.flashPenguin()) {
                const look = this.c.look;
                const face = this.face(gap < 0.35);
                if (this.mode === "land") {
                    const hop = Math.abs(Math.sin((this.hopT * Math.PI) / 0.3)) * 16;
                    const sq = this.squash > 0 ? 1 - this.squash : 1;
                    ctx.save();
                    ctx.translate(this.px, this.py);
                    ctx.scale(2 - sq, sq);
                    PL.drawPenguin(ctx, 0, -hop, 0.9, { look, pose: hop > 4 ? "jump" : "stand", t: this.t, face });
                    ctx.restore();
                } else if (this.mode === "air") {
                    // Upright jump, feet at py so landing on a chunk lines up
                    PL.drawPenguin(ctx, this.px, this.py, 0.9, { look, pose: "jump", t: this.t, face });
                } else PL.drawPenguin(ctx, this.px, this.py, 0.9, { look, pose: "swim", t: this.t, tilt: PL.clamp(this.vy / 900, -0.6, 0.6), face });
                if (this.powers.shield) PL.drawShieldBubble(ctx, this.px, this.mode === "swim" ? this.py : this.py - 32, 40, this.t);
            }
            PL.drawWeather(ctx, this.mood, this.t, this.dist);
            this.drawCommon(ctx);
            PL.drawDangerEdges(ctx, PL.clamp((0.45 - gap) / 0.45, 0, 1), this.t);

            PL.hudText(ctx, Math.floor(this.dist / 10) + " m", 20, 30, { size: 26 });
            PL.drawBar(ctx, 20, 58, 200, 14, gap, gap > 0.4 ? "#66bb6a" : "#ef5350", b.predName + " distance");
            this.drawCoinCount(ctx);
        }
        result() {
            return super.result("swim", this.dist / 35, Math.floor(this.dist / 10) + " m swum" + (this.caught ? " before the " + this.b.predName + " caught you" : ""), this.dist / 10);
        }
    }

    // ---------------- WADDLING ----------------
    // Side-view runner like Duck Life's running: jump over things on the
    // ground, belly-slide under things overhead. It keeps speeding up.
    const WADDLE_SETBACK = 60;
    class WaddleGame extends Game {
        constructor(c) {
            super(c);
            this.title = "Waddling";
            this.hint = "↑ or SPACE to jump · hold ↓ to belly-slide under low things";
            this.lv = c.lv.waddle;
            this.gy = 440;
            this.px = 230;
            this.jy = 0; // height above the ground
            this.vy = 0;
            this.sliding = false;
            this.speed = 220 + this.d * 30;
            this.dist = 0;
            this.obs = [];
            this.next = 500;
            this.coyote = 0;
            this.buffer = 0;
            this.dustT = 0;
            // Something is chasing you (a zookeeper, polar bear, wolf...)
            this.chaserX = -40;
        }
        update(dt) {
            const I = PL.input;
            this.stepCommon(dt);
            this.speed += dt * (6 + this.d * 2);
            const move = this.speed * dt;
            this.dist += move;
            this.next -= move;
            const hard = Math.min(1, this.dist / 15000 + (this.d - 1) * 0.15);
            if (this.next <= 0) {
                const high = this.dist > 1500 && Math.random() < 0.35 + hard * 0.15;
                this.obs.push({ x: W + 40, high });
                // Coins arc over blocks (jump through them) or sit low under hanging things
                if (Math.random() < 0.7) {
                    if (high) this.addCoinArc(W + 6, this.gy - 18, 3, 0);
                    else this.addCoinArc(W - 20, this.gy - 70, 4, 50);
                }
                this.next = PL.rand(320, 520) * (1 - hard * 0.3);
            }
            for (const o of this.obs) o.x -= move;
            this.movePickups(-move, 0);
            if (this.powerDue(dt)) this.addPower(W + 40, this.gy - 120);
            if (this.frostDue(dt)) this.addFrostFish(W + 60, this.gy - 135);
            this.obs = this.obs.filter((o) => o.x > -80);

            // What the penguin stands on: the ground, or the top of a block
            const BLOCK_H = 40, BLOCK_W = 18, HANG_W = 46, PW = 12;
            const overlapX = (o, half) => this.px + PW > o.x - half && this.px - PW < o.x + half;
            let support = 0;
            for (const o of this.obs) if (!o.high && overlapX(o, BLOCK_W) && this.jy >= BLOCK_H - 8) support = BLOCK_H;
            const grounded = this.jy <= support + 0.5 && this.vy <= 0;
            // Under something low you stay flat on your belly until you're clear
            const underHang = this.obs.some((o) => o.high && overlapX(o, HANG_W)) && this.jy < 52;
            this.sliding = grounded && (I.down("down") || (underHang && this.wasSliding));
            this.wasSliding = this.sliding;
            // Forgiving controls: a press just before landing, or just after running
            // off an edge, still counts as a jump
            if (grounded) this.coyote = 0.1;
            else this.coyote = Math.max(0, this.coyote - dt);
            if (I.hit("up") || I.hit("action")) this.buffer = 0.13;
            else this.buffer = Math.max(0, this.buffer - dt);
            if (this.buffer > 0 && (grounded || this.coyote > 0) && !underHang && this.vy <= 0) {
                this.vy = 560 + Math.min(80, this.lv * 2);
                this.buffer = 0;
                this.coyote = 0;
                PL.fx.dust(this.px, this.gy - this.jy, 4);
                PL.sfx("jump");
            }
            if (!grounded || this.vy > 0) {
                this.vy -= 1650 * dt;
                this.jy += this.vy * dt;
                if (this.jy <= support) {
                    this.jy = support;
                    if (this.vy < -60) {
                        this.landed = 0.12;
                        PL.fx.dust(this.px, this.gy - support, 6);
                    }
                    this.vy = 0;
                }
            } else {
                this.jy = support;
            }
            this.landed = Math.max(0, (this.landed || 0) - dt);

            // Obstacles are solid: running into one pushes you back (and costs a heart)
            let blocked = false;
            const height = this.sliding ? 28 : 66;
            for (const o of this.obs) {
                const hit = o.high ? overlapX(o, HANG_W) && this.jy + height > 52 : overlapX(o, BLOCK_W) && this.jy < BLOCK_H - 4;
                if (!hit) continue;
                this.px = o.x - (o.high ? HANG_W : BLOCK_W) - PW;
                blocked = true;
                if (!o.hit) {
                    o.hit = true;
                    if (this.hurt(this.px + PW, this.gy - this.jy - 30)) this.chaserX += WADDLE_SETBACK; // a stumble lets it catch up
                }
            }
            if (!blocked && this.px < 230) this.px = Math.min(230, this.px + (60 + this.lv * 2) * dt);
            // Clean hops and slides build the combo
            for (const o of this.obs) {
                if (!o.scored && o.x + (o.high ? 46 : 18) < this.px - 12) {
                    o.scored = true;
                    if (!o.hit) this.clean(this.px, this.gy - this.jy - 100, o.high ? "Slide!" : "Hop!");
                }
            }
            // Little dust puffs from your feet
            this.dustT -= dt;
            if (grounded && !this.sliding && this.dustT <= 0) {
                this.dustT = 0.22;
                PL.fx.dust(this.px - 8, this.gy - this.jy, 1);
            }
            // Chaser lunges: jump or duck while the red ring flashes for a Perfect Dodge
            const lev = this.stepLunge(dt, I.hit("up") || I.hit("action") || I.hit("down"), true);
            const py = this.gy - this.jy - 33;
            if (lev === "perfect") {
                this.perfectDodge(this.px, py);
                this.chaserX -= WADDLE_SETBACK * LUNGE.counter;
            } else if (lev === "dodge") this.plainDodge(this.px, this.gy - this.jy);
            else if (lev === "hit" && this.hurt(this.px, py)) {
                this.chaserX += WADDLE_SETBACK;
                this.popup("Grabbed!", this.px, py - 40, "#ff8a80");
            }
            // Only mistakes bring the chaser closer; clean running lets it fall back
            // (after a counter-attack it's knocked further back and runs back up)
            this.chaserX = this.chaserX < -40 ? Math.min(-40, this.chaserX + 40 * dt) : Math.max(-40, this.chaserX - (8 + this.lv * 0.25) * dt);
            if (this.px - 12 <= this.chaserX + 60) {
                this.over = true;
                this.caught = true;
                PL.sfx("hit");
                PL.fx.shake(14, 0.45);
                PL.fx.flash("#b71c1c", 0.35, 0.3);
            }
            this.updatePickups(dt, this.px, this.gy - this.jy - (this.sliding ? 14 : 33), this.sliding ? 18 : 26);
        }
        draw(ctx) {
            const b = this.b;
            const gap = PL.clamp((this.px - 72 - this.chaserX) / 200, 0, 1);
            PL.drawBackdrop(ctx, b, this.dist, this.gy, this.t, this.mood);
            PL.drawGround(ctx, b, 0, this.gy, W, H - this.gy, this.dist);
            ctx.fillStyle = "#1b2531";
            ctx.globalAlpha = 0.22;
            ctx.fillRect(0, this.gy, W, H - this.gy);
            ctx.globalAlpha = 1;
            PL.drawSpeedLines(ctx, this.speed, this.t, 120, this.gy - 10);
            this.drawPickups(ctx);
            // Winding up, it steps into view; striking, it surges forward
            const lx = this.chaserX + Math.max(0, this.lungeWind()) * 60 + this.lungeSurge() * 80;
            PL.drawLandPredator(ctx, b.chaser, lx, this.gy, 0.95, this.t, Math.max(1 - gap, this.lungeSurge()));
            this.drawLunge(ctx, Math.max(50, lx + 30), this.gy - 58, 44);
            for (const o of this.obs) {
                if (o.high) PL.drawOverhead(ctx, b, o.x, this.gy, 52, this.t);
                else PL.drawObstacle(ctx, b.obstacle, o.x, this.gy, 1);
            }
            ctx.fillStyle = "rgba(0,0,0,0.18)";
            PL.ell(ctx, this.px, this.gy + 3, 24 - Math.min(14, this.jy / 8), 5);
            if (!this.flashPenguin()) {
                const look = this.c.look;
                const face = this.face(gap < 0.35);
                if (this.sliding) {
                    PL.drawPenguin(ctx, this.px, this.gy - this.jy, 1.0, { look, pose: "slide", t: this.t, face });
                } else {
                    ctx.save();
                    ctx.translate(this.px, this.gy - this.jy);
                    if (this.landed > 0) ctx.scale(1.15, 0.85);
                    PL.drawPenguin(ctx, 0, 0, 1.0, { look, walk: this.jy <= 0, pose: this.jy > 0 ? "jump" : "stand", t: this.t, face });
                    ctx.restore();
                }
                if (this.powers.shield) PL.drawShieldBubble(ctx, this.px, this.gy - this.jy - (this.sliding ? 16 : 36), this.sliding ? 34 : 44, this.t);
            }
            PL.drawWeather(ctx, this.mood, this.t, this.dist);
            this.drawCommon(ctx);
            PL.drawDangerEdges(ctx, PL.clamp((0.45 - gap) / 0.45, 0, 1), this.t);
            PL.hudText(ctx, Math.floor(this.dist / 10) + " m", 20, 30, { size: 26 });
            PL.drawBar(ctx, 20, 58, 200, 14, gap, gap > 0.4 ? "#66bb6a" : "#ef5350", b.chaserName + " distance");
            this.drawHearts(ctx);
            this.drawCoinCount(ctx);
        }
        result() {
            return super.result("waddle", this.dist / 45, Math.floor(this.dist / 10) + " m waddled" + (this.caught ? " before the " + this.b.chaserName + " caught you" : ""), this.dist / 10);
        }
    }

    // ---------------- CLIMBING ----------------
    // Jump from hold to hold up a tall cliff. An arrow swings back and forth
    // above your penguin: press SPACE when it points at a hold (it turns green)
    // to leap there. The higher you get, the farther apart and smaller the holds,
    // the faster the arrow swings, and the trickier the wall: holds that crumble,
    // icy holds you slide off, holds that slide side to side, springs, gold side
    // routes, falling rocks and birds. Something rises from below and never stops.
    const CLIMB_L = W / 2 - 300, CLIMB_R = W / 2 + 300;
    const HANG_Y = 330; // screen y of the hold you're hanging from
    const PX_PER_M = 32;
    const AIM_MAX = 1.2; // the arrow swings this far (radians) either side of straight up
    const HOLD_COLORS = ["#ef5350", "#ffca28", "#66bb6a", "#42a5f5", "#ab47bc", "#ff7043"];
    const HOLD_R = { normal: 18, crimp: 11, crumble: 17, ice: 17, spring: 19, gold: 16, ledge: 46 };

    function riseKind(b) {
        if (b.id === "iceland") return "lava";
        if (["arctic", "northpole", "greenland", "siberia", "antarctica"].includes(b.id)) return "snow";
        return "water";
    }
    const RISE_NAMES = { lava: "lava", snow: "avalanche", water: "water" };

    class ClimbGame extends Game {
        constructor(c) {
            super(c);
            this.title = "Climbing";
            this.rise = riseKind(c.biome);
            this.hint = "Press SPACE when the arrow turns green to jump to that hold · the " + RISE_NAMES[this.rise] + " is rising!";
            this.lv = c.lv.climb;
            this.reach = 185 + Math.min(50, this.lv * 1.1);
            this.holds = [];
            this.path = [];
            this.nextId = 0;
            const start = this.makeHold(W / 2, 0, "ledge");
            this.path.push(start);
            this.cur = start;
            this.history = [];
            this.px = start.x;
            this.py = start.y;
            this.state = "hang"; // hang | fly | fall
            this.fly = null;
            this.hangT = 0;
            this.slipY = 0;
            this.stun = 0;
            this.camY = 0; // world y shown at HANG_Y (world y grows downward)
            this.threat = 380; // world y of the rising danger's surface
            this.bestH = 0;
            this.jumps = 0;
            this.rocks = [];
            this.rockT = 9;
            this.birds = [];
            this.birdT = 7;
            this.goals = PL.progress ? PL.progress.STAR_GOALS.climb : [60, 150, 280];
            this.starsHit = 0;
            this.danger = 0;
            this.ensureHolds();
            this.resetAim();
        }
        get meters() {
            return Math.floor(this.bestH / PX_PER_M);
        }
        makeHold(x, y, type) {
            const h = { id: this.nextId++, x, y, x0: x, type, r: HOLD_R[type] || 18, shape: Math.floor(Math.random() * 4) };
            h.color = HOLD_COLORS[h.id % HOLD_COLORS.length];
            this.holds.push(h);
            return h;
        }
        // Keep the route built a little above the top of the screen
        ensureHolds() {
            const topY = this.camY - HANG_Y - 380;
            while (this.path[this.path.length - 1].y > topY) this.addPathHold();
        }
        // The main route: every hold can always be reached from the one before
        addPathHold() {
            const last = this.path[this.path.length - 1];
            const m = -last.y / PX_PER_M;
            const k = PL.clamp(m / 200, 0, 1);
            const dMin = 110 + k * 45;
            const dMax = Math.max(dMin + 5, Math.min(this.reach - 15, 150 + k * 75) - (last.move ? last.move.amp : 0));
            let x = last.x, y = last.y - dMin;
            for (let tries = 0; tries < 30; tries++) {
                const d = PL.rand(dMin, dMax);
                const side = last.x < W / 2 - 150 ? 1 : last.x > W / 2 + 150 ? -1 : Math.random() < 0.5 ? -1 : 1;
                const a = Math.random() < 0.2 ? PL.rand(-0.25, 0.25) : side * PL.rand(0.3, 1.0);
                x = last.x + Math.sin(a) * d;
                y = last.y - Math.cos(a) * d;
                if (x > CLIMB_L + 45 && x < CLIMB_R - 45) break;
            }
            x = PL.clamp(x, CLIMB_L + 45, CLIMB_R - 45);
            y = Math.min(y, last.y - 60);

            // What kind of hold: more tricky ones the higher you go
            let type = "normal";
            if (m > 6) {
                const odds = [
                    ["crumble", Math.min(0.2, 0.05 + m * 0.001)],
                    ["crimp", m > 15 ? Math.min(0.25, (m - 15) * 0.003) : 0],
                    ["moving", m > 25 ? Math.min(0.22, 0.06 + (m - 25) * 0.0015) : 0],
                    ["ice", m > 35 ? Math.min(0.14, (m - 35) * 0.0015) : 0],
                    ["spring", m > 18 ? 0.05 : 0]
                ];
                let roll = Math.random();
                for (const [t, p] of odds) {
                    if ((roll -= p) < 0) {
                        type = t;
                        break;
                    }
                }
                // No two tricky holds of the same kind in a row
                if (type !== "crimp" && type !== "moving" && type === last.type) type = "normal";
                if (type === "moving" && last.move) type = "normal";
            }
            const h = this.makeHold(x, y, type === "moving" ? "normal" : type);
            if (type === "moving") {
                // Slides side to side on a rail; both ends stay in reach of the hold before
                let amp = Math.min(PL.rand(45, 85), x - CLIMB_L - 40, CLIMB_R - 40 - x);
                const far = (a) => Math.max(Math.hypot(x + a - last.x, y - last.y), Math.hypot(x - a - last.x, y - last.y));
                while (amp > 20 && far(amp) > this.reach - 12) amp -= 5;
                if (amp >= 20) h.move = { amp, speed: PL.rand(0.9, 1.5) + k * 0.6, phase: Math.random() * 6.28 };
            }
            if (h.type === "normal" && m > 8 && Math.random() < 0.04) h.power = PL.pick(["shield", "double", "magnet"]);
            this.path.push(h);
            // A coin hanging on the way up to this hold
            if (m > 2 && Math.random() < 0.3) this.addCoin((last.x + x) / 2, (last.y + y) / 2 - 16);
            if (this.path.length >= 3) {
                const n = this.path.length;
                this.addBranch(this.path[n - 3], this.path[n - 2], this.path[n - 1]);
            }
        }
        // A side hold off the main route (often gold): out of the way, so it
        // costs time to grab, but it still leads back to the route
        addBranch(a, mid, c) {
            if (a.move || mid.move || c.move || Math.random() > 0.3) return;
            const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
            const side = mid.x > mx ? -1 : 1;
            const bx = mx + side * PL.rand(70, 120), by = my + PL.rand(-20, 20);
            if (bx < CLIMB_L + 45 || bx > CLIMB_R - 45) return;
            const R = this.reach - 15;
            const d1 = Math.hypot(bx - a.x, by - a.y), d2 = Math.hypot(c.x - bx, c.y - by);
            if (d1 > R || d2 > R || d1 < 80 || d2 < 80) return;
            if (this.holds.some((h) => Math.hypot(h.x - bx, h.y - by) < 75)) return;
            const roll = Math.random();
            const h = this.makeHold(bx, by, roll < 0.65 ? "gold" : "normal");
            if (h.type === "normal") h.power = PL.pick(["shield", "double", "magnet"]);
        }
        // Start the arrow a little to one side of the next hold on the route,
        // swinging toward it, so there's always a moment to get ready
        resetAim() {
            const i = this.path.indexOf(this.cur);
            const next = i >= 0 ? this.path[i + 1] : null;
            if (!next) {
                this.aim = 0;
                this.aimDir = Math.random() < 0.5 ? -1 : 1;
                return;
            }
            const ang = Math.atan2(next.x - this.cur.x, this.cur.y - next.y);
            this.aimDir = Math.random() < 0.5 ? -1 : 1;
            this.aim = PL.clamp(ang - this.aimDir * 0.6, -AIM_MAX, AIM_MAX);
            if (Math.abs(this.aim) >= AIM_MAX) this.aimDir = -Math.sign(this.aim);
        }
        screenY(wy) {
            return HANG_Y + (wy - this.camY);
        }
        // The hold the arrow is pointing at (if any)
        findTarget() {
            let best = null;
            for (const h of this.holds) {
                if (h === this.cur || h.broken || h.y > this.py + 40) continue;
                const dx = h.x - this.px, dy = this.py - h.y;
                const dist = Math.hypot(dx, dy);
                if (dist > this.reach || dist < 20) continue;
                const diff = Math.atan2(dx, dy) - this.aim;
                const tol = Math.atan2(h.r + 14 + this.lv * 0.25, dist);
                const score = Math.abs(diff) / tol;
                if (score < 1 && (!best || score < best.score)) best = { hold: h, diff, tol, dist, score };
            }
            return best;
        }
        jump() {
            const t = this.target;
            const from = { x: this.px, y: this.py };
            this.target = null;
            this.state = "fly";
            PL.sfx("jump");
            if (t) {
                this.fly = { from, hold: t.hold, t: 0, dur: 0.2 + t.dist / 1000, arc: Math.min(30, t.dist * 0.15), perfect: t.score < 0.4 };
            } else {
                // Nothing there: a leap into thin air, then you drop back to your hold
                const d = this.reach * 0.55;
                this.fly = { from, end: { x: this.px + Math.sin(this.aim) * d, y: this.py - Math.cos(this.aim) * d }, t: 0, dur: 0.24, arc: 0, whiff: true };
                const sy = this.screenY(this.py);
                this.breakCombo(this.px, sy);
                this.popup("Missed!", this.px, sy - 60, "#ff8a80");
            }
        }
        land(h, quiet, perfect) {
            if (!quiet && h !== this.cur) {
                this.history.push(this.cur);
                if (this.history.length > 12) this.history.shift();
            }
            this.cur = h;
            this.state = "hang";
            this.fly = null;
            this.target = null;
            this.hangT = 0;
            this.slipY = 0;
            this.px = h.x;
            this.py = h.y;
            this.resetAim();
            const sx = h.x, sy = this.screenY(h.y);
            PL.fx.burst(sx, sy, { n: 5, color: ["#ffffff", "#eceff1"], shape: "puff", speed: 60, gravity: -20, life: 0.4, size: 5 });
            if (quiet) return;
            this.jumps++;
            PL.sfx("step");
            this.clean(sx, sy - 50, perfect ? "Perfect!" : null);
            if (perfect) PL.fx.sparkle(sx, sy - 10);
            if (-h.y > this.bestH) {
                this.bestH = -h.y;
                const m = this.meters;
                if (Math.floor(m / 25) > Math.floor(this.lastCall || 0)) {
                    this.lastCall = Math.floor(m / 25);
                    if (m >= 25) this.popup(Math.floor(m / 25) * 25 + " m!", sx, sy - 80, "#fff59d");
                }
                while (this.starsHit < 3 && m >= this.goals[this.starsHit]) {
                    this.starsHit++;
                    PL.fx.banner("STAR " + this.starsHit + "!", "#ffca28", m + " m");
                    PL.sfx("star");
                }
            }
            if (h.type === "gold" && !h.taken) {
                h.taken = true;
                this.collectCoin(sx, sy, 3);
            }
            if (h.power && !h.taken) {
                h.taken = true;
                this.gainPower(h.power, sx, sy);
            }
            if (h.type === "spring") {
                // Boing! Straight up past a few holds
                const i = this.path.indexOf(h);
                while (this.path.length <= i + 3) this.addPathHold();
                const to = this.path[i + 3];
                this.state = "fly";
                this.fly = { from: { x: h.x, y: h.y }, hold: to, t: 0, dur: 0.5, arc: 40, spring: true };
                PL.sfx("jump");
                this.popup("Boing!", sx, sy - 50, "#b9f6ca");
            }
        }
        // Lost your grip: drop back to the last good hold
        fallBack(text) {
            const sy = this.screenY(this.py);
            if (this.useShield(this.px, sy)) {
                // The shield holds you on: the hold is safe now
                if (this.cur.type === "crumble" || this.cur.type === "ice") this.cur.type = "normal";
                this.cur.broken = false;
                this.hangT = 0;
                this.slipY = 0;
                return;
            }
            this.breakCombo(this.px, sy);
            if (text) this.popup(text, this.px, sy - 50, "#ff8a80");
            PL.sfx("hit");
            PL.fx.shake(6, 0.2);
            this.dropDown();
        }
        dropDown() {
            let h = this.history.pop();
            while (h && h.broken) h = this.history.pop();
            if (!h) {
                // Nothing remembered: catch the nearest solid hold below
                h = this.holds.filter((o) => !o.broken && o !== this.cur && o.y > this.py).sort((a, b) => a.y - b.y)[0];
            }
            if (!h) {
                this.over = true;
                this.caught = true;
                return;
            }
            this.state = "fall";
            this.fly = { from: { x: this.px, y: this.py }, hold: h, t: 0, dur: 0.4, arc: 0, fall: true, quiet: true };
            this.stun = 0.2;
        }
        update(dt) {
            const I = PL.input;
            this.stepCommon(dt);
            this.stun = Math.max(0, this.stun - dt);
            for (const h of this.holds) {
                if (h.move) h.x = h.x0 + Math.sin(this.t * h.move.speed + h.move.phase) * h.move.amp;
                if (h.broken && h.regrowT > 0 && (h.regrowT -= dt) <= 0) {
                    h.broken = false;
                    h.type = "normal";
                    h.regrowT = 0;
                }
                // Gold holds twinkle now and then
                if (h.type === "gold" && !h.taken && (h.sparkT = (h.sparkT || Math.random() * 1.5) - dt) <= 0) {
                    h.sparkT = 1.5;
                    const y = this.screenY(h.y);
                    if (y > -40 && y < H + 40) PL.fx.sparkle(h.x + PL.rand(-14, 14), y + PL.rand(-8, 8));
                }
            }
            const m = this.meters;

            if (this.state === "hang") {
                // The arrow swings faster the higher you are
                const swing = (1.1 + Math.min(1.3, m * 0.006) + (this.d - 1) * 0.12) * (1 - Math.min(0.2, this.lv * 0.004));
                this.aim += this.aimDir * swing * dt;
                if (this.aim > AIM_MAX) {
                    this.aim = AIM_MAX;
                    this.aimDir = -1;
                } else if (this.aim < -AIM_MAX) {
                    this.aim = -AIM_MAX;
                    this.aimDir = 1;
                }
                this.hangT += dt;
                const h = this.cur;
                if (h.type === "ice" && this.hangT > 0.35) this.slipY = Math.min(40, this.slipY + 30 * dt);
                this.px = h.x;
                this.py = h.y + this.slipY;
                this.target = this.findTarget();
                const crumbleTime = 1.4 - Math.min(0.5, m * 0.003);
                if (h.type === "crumble" && this.hangT > crumbleTime) {
                    h.broken = true;
                    h.regrowT = 1.6; // it grows back, so the way up is never blocked for good
                    PL.fx.burst(h.x, this.screenY(h.y), { n: 12, color: ["#a1887f", "#6d4c41", "#d7ccc8"], speed: 160, gravity: 600, life: 0.6, size: 4 });
                    this.fallBack("It crumbled!");
                } else if (h.type === "ice" && this.hangT > 1.5) {
                    this.fallBack("Too slippery!");
                } else if (this.stun <= 0 && (I.hit("action") || I.hit("up"))) {
                    this.jump();
                }
            } else {
                const f = this.fly;
                f.t += dt;
                const u = Math.min(1, f.t / f.dur);
                const end = f.hold ? { x: f.hold.x, y: f.hold.y } : f.end;
                const e = f.fall ? u * u : 1 - (1 - u) * (1 - u);
                this.px = PL.lerp(f.from.x, end.x, e);
                this.py = PL.lerp(f.from.y, end.y, e) - Math.sin(u * Math.PI) * f.arc;
                if (u >= 1) {
                    if (f.whiff) {
                        this.state = "fall";
                        this.fly = { from: { x: this.px, y: this.py }, hold: this.cur, t: 0, dur: 0.32, arc: 0, fall: true, quiet: true };
                    } else this.land(f.hold, f.quiet, f.perfect);
                }
            }

            this.updateHazards(dt, m);

            // The danger below rises faster and faster, and is never far behind
            const speed = Math.min(160, 30 + this.t * 1.05 + (this.d - 1) * 10) * (1 - Math.min(0.3, this.lv * 0.006));
            this.threat = Math.min(this.threat - speed * dt, this.py + 420);
            const feet = this.py + 70;
            this.danger = PL.clamp(1 - (this.threat - feet) / 330, 0, 1);
            if (this.threat <= feet && !this.over) {
                this.over = true;
                this.caught = true;
                PL.sfx("hit");
                PL.fx.shake(12, 0.4);
            }

            // Camera, pickups, more wall above, forget holds far below
            this.camY = PL.lerp(this.camY, this.py, Math.min(1, dt * 6));
            this.updatePickups(dt, this.px, this.screenY(this.py) + 30, 28, 0, this.camY - HANG_Y);
            this.ensureHolds();
            if (this.holds.length > 80) this.holds = this.holds.filter((h) => h.y < this.threat + 200 || h === this.cur || this.history.includes(h));
        }
        // Falling rocks (warned first) and birds flying across
        updateHazards(dt, m) {
            const bodyY = this.py + 30;
            this.rockT -= dt;
            if (this.rockT <= 0 && m > 12) {
                const x = Math.random() < 0.6 ? this.px + PL.rand(-80, 80) : PL.rand(CLIMB_L + 40, CLIMB_R - 40);
                this.rocks.push({ x: PL.clamp(x, CLIMB_L + 30, CLIMB_R - 30), warn: 1.1, y: 0 });
                this.rockT = Math.max(1.6, 5.5 - m * 0.025) * PL.rand(0.7, 1.3);
            }
            for (const r of this.rocks) {
                if (r.warn > 0) {
                    r.warn -= dt;
                    r.y = this.camY - HANG_Y - 40;
                    continue;
                }
                r.y += 520 * dt;
                if (r.done) continue;
                if (Math.abs(r.x - this.px) < 28 && Math.abs(r.y - bodyY) < 34) {
                    r.done = true;
                    this.knocked();
                } else if (r.y > bodyY + 50) {
                    r.done = true;
                    if (Math.abs(r.x - this.px) < 70) this.clean(this.px, this.screenY(this.py) - 60, "Close one!");
                }
            }
            this.rocks = this.rocks.filter((r) => this.screenY(r.y) < H + 60);

            this.birdT -= dt;
            if (this.birdT <= 0 && m > 40) {
                const dir = Math.random() < 0.5 ? 1 : -1;
                this.birds.push({ dir, x: dir > 0 ? -40 : W + 40, y: this.py - PL.rand(40, 190), warn: 0.9, speed: PL.rand(230, 300) + Math.min(120, m) });
                this.birdT = Math.max(3.5, 9 - m * 0.02) * PL.rand(0.7, 1.3);
            }
            for (const bd of this.birds) {
                if (bd.warn > 0) {
                    bd.warn -= dt;
                    continue;
                }
                bd.x += bd.dir * bd.speed * dt;
                if (!bd.done && Math.abs(bd.x - this.px) < 34 && Math.abs(bd.y + Math.sin(this.t * 5) * 6 - bodyY) < 32) {
                    bd.done = true;
                    this.knocked();
                }
            }
            this.birds = this.birds.filter((bd) => bd.x > -80 && bd.x < W + 80);
        }
        // Hit by a rock or a bird: lose a heart and drop down a hold
        knocked() {
            const sy = this.screenY(this.py);
            if (this.hurt(this.px, sy + 20) && !this.over) this.dropDown();
        }
        drawRise(ctx, y) {
            const t = this.t;
            if (y > H + 20) return;
            const kind = this.rise;
            const col = kind === "lava" ? ["#ff7043", "#e64a19", "#ffca28"] : kind === "snow" ? ["#ffffff", "#e3eef7", "#cfd8dc"] : ["#4fc3f7", "#0288d1", "#e1f5fe"];
            ctx.fillStyle = col[1];
            ctx.fillRect(0, y + 14, W, H - y);
            ctx.fillStyle = col[0];
            ctx.beginPath();
            ctx.moveTo(0, H + 10);
            for (let x = 0; x <= W; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.03 + t * 4) * 6 + Math.sin(x * 0.011 - t * 2) * 5);
            ctx.lineTo(W, H + 10);
            ctx.closePath();
            ctx.fill();
            if (kind === "snow") {
                for (let i = 0; i < 12; i++) blobAt(ctx, (i * 97 + t * 60) % (W + 80) - 40, y - 4 + Math.sin(t * 3 + i) * 6, 22 + (i % 3) * 8, col[2]);
            } else {
                ctx.fillStyle = col[2];
                for (let i = 0; i < 10; i++) {
                    const bx = (i * 113 + t * 40) % W;
                    const by = y + 20 + ((t * 30 + i * 37) % 60);
                    PL.circ(ctx, bx, by, kind === "lava" ? 5 : 3);
                }
            }
        }
        draw(ctx) {
            const b = this.b;
            const top = this.camY - HANG_Y; // world y at the top of the screen
            const height = Math.max(0, -this.camY);
            const horizon = Math.min(1100, 470 + height * 0.25);
            PL.drawBackdrop(ctx, b, height * 0.15, horizon, this.t, this.mood);
            if (horizon < H) PL.drawGround(ctx, b, 0, horizon, W, H - horizon + 4, 0);

            // Cliff face with rock bands that scroll with the climb
            const L = CLIMB_L - 20, R = CLIMB_R + 20;
            const floor = Math.min(H, this.screenY(110));
            ctx.fillStyle = b.wall;
            ctx.fillRect(L, 0, R - L, floor);
            const band = 48;
            for (let k = Math.floor(top / band) - 1; k * band - top < floor; k++) {
                const y = k * band - top;
                ctx.fillStyle = PL.shade(b.wall, k % 2 ? -10 : 6);
                ctx.fillRect(L, y, R - L, Math.min(band, floor - y));
                ctx.fillStyle = PL.shade(b.wall, -22);
                for (let i = 0; i < 4; i++) PL.ell(ctx, L + 30 + PL.hash(k * 7 + i) * (R - L - 60), y + band / 2, 14 + PL.hash(k + i) * 16, 5);
            }
            ctx.fillStyle = PL.shade(b.wall, -30);
            for (let k = Math.floor(top / 40) - 1; k * 40 - top < floor; k++) {
                const y = k * 40 - top;
                PL.poly(ctx, [L, y, L + 14 + PL.hash(k) * 16, y + 20, L, y + 40]);
                PL.poly(ctx, [R, y, R - 14 - PL.hash(k + 50) * 16, y + 20, R, y + 40]);
            }

            // Height marks and star lines painted on the wall
            for (let mm = Math.max(10, Math.floor(-(top + H) / PX_PER_M / 10) * 10); mm * PX_PER_M < -top + 40; mm += 10) {
                const y = this.screenY(-mm * PX_PER_M);
                if (y < -20 || y > H + 20) continue;
                ctx.fillStyle = "rgba(255,255,255,0.35)";
                ctx.fillRect(L + 6, y, 26, 3);
                PL.hudText(ctx, mm + "m", L + 40, y + 2, { size: 13, color: "#fff8e1" });
                const si = this.goals.indexOf(mm);
                if (si >= 0) {
                    ctx.fillStyle = "rgba(255,202,40,0.35)";
                    ctx.fillRect(L, y - 1, R - L, 4);
                    ctx.fillStyle = "#8d5a3b";
                    ctx.fillRect(R - 8, y - 46, 4, 46);
                    ctx.fillStyle = "#ffca28";
                    PL.poly(ctx, [R - 4, y - 46, R + 30, y - 38, R - 4, y - 30]);
                    for (let s = 0; s <= si; s++) PL.star(ctx, R + 6 + s * 9, y - 38, 4, 1.8, 5);
                }
            }

            // Holds (rails for the moving ones first)
            for (const h of this.holds) {
                const y = this.screenY(h.y);
                if (y < -40 || y > H + 40 || !h.move) continue;
                ctx.fillStyle = PL.shade(b.wall, -40);
                PL.roundRect(ctx, h.x0 - h.move.amp - 8, y - 4, h.move.amp * 2 + 16, 8, 4);
                ctx.fill();
                ctx.fillStyle = "#9e9e9e";
                PL.circ(ctx, h.x0 - h.move.amp - 4, y, 3);
                PL.circ(ctx, h.x0 + h.move.amp + 4, y, 3);
            }
            for (const h of this.holds) {
                const y = this.screenY(h.y);
                if (y < -40 || y > H + 40 || h.broken) continue;
                this.drawHold(ctx, h, h.x, y);
            }
            this.pickupsDraw(ctx);

            // The aim: an arrow from your flippers, green when it's lined up with a hold
            if (this.state === "hang" && !this.over) this.drawAim(ctx);

            // Rocks (with warnings) and birds
            for (const r of this.rocks) {
                if (r.warn > 0) {
                    const blink = Math.floor(this.t * 10) % 2 === 0;
                    ctx.fillStyle = blink ? "#ff5252" : "#ffab91";
                    PL.poly(ctx, [r.x - 14, 8, r.x + 14, 8, r.x, 28]);
                    ctx.fillStyle = "rgba(255,82,82,0.12)";
                    ctx.fillRect(r.x - 30, 0, 60, H);
                } else PL.drawFalling(ctx, b.falling, r.x, this.screenY(r.y), this.t);
            }
            for (const bd of this.birds) {
                const y = this.screenY(bd.y);
                if (bd.warn > 0) {
                    const ex = bd.dir > 0 ? 24 : W - 24;
                    if (Math.floor(this.t * 8) % 2 === 0) {
                        ctx.fillStyle = "#ff5252";
                        PL.circ(ctx, ex, y, 15);
                        PL.hudText(ctx, "!", ex, y + 1, { size: 20, align: "center", stroke: false });
                    }
                } else drawBird(ctx, bd.x, y + Math.sin(this.t * 5) * 6, bd.dir, this.t);
            }

            // The penguin (hands on the hold, hanging below it)
            const sy = this.screenY(this.py);
            if (!this.flashPenguin()) {
                const flying = this.state !== "hang";
                const facing = this.fly && this.fly.end ? (this.fly.end.x < this.px ? -1 : 1) : this.fly && this.fly.hold ? (this.fly.hold.x < this.fly.from.x ? -1 : 1) : 1;
                PL.drawPenguin(ctx, this.px, sy + 62, 0.9, {
                    look: this.c.look,
                    pose: flying && !(this.fly && this.fly.fall) ? "jump" : "climb",
                    facing,
                    t: flying ? this.t * 2 : this.t * 0.4,
                    face: this.fly && this.fly.fall ? "hurt" : this.face(this.danger > 0.55)
                });
                if (this.powers.shield) PL.drawShieldBubble(ctx, this.px, sy + 30, 44, this.t);
            }

            // The rising danger
            this.drawRise(ctx, this.screenY(this.threat));
            PL.drawWeather(ctx, this.mood, this.t, 0);
            PL.drawDangerEdges(ctx, this.danger, this.t);

            this.drawCommon(ctx);
            PL.hudText(ctx, this.meters + " m", 20, 30, { size: 28 });
            const next = this.goals.find((g) => g > this.meters);
            if (next) PL.hudText(ctx, "Next star: " + next + " m", 20, 60, { size: 14, color: "#ffe082" });
            PL.drawBar(ctx, 20, 76, 180, 12, 1 - this.danger, this.danger < 0.5 ? "#66bb6a" : "#ef5350", RISE_NAMES[this.rise] + " below");
            this.drawHearts(ctx);
            this.drawCoinCount(ctx);

            // How to play, until you've got the hang of it
            if (this.jumps < 4 && PL.drawKey) {
                const hot = !!this.target && this.state === "hang";
                ctx.fillStyle = "rgba(255,244,220,0.92)";
                PL.roundRect(ctx, W / 2 - 190, H - 56, 380, 42, 14);
                ctx.fill();
                PL.drawKey(ctx, "SPACE", W / 2 - 130, H - 36, 28, hot);
                PL.hudText(ctx, "when the arrow is green!", W / 2 - 84, H - 34, { size: 16, color: "#3b2a1e", stroke: false });
            }
        }
        pickupsDraw(ctx) {
            this.drawPickups(ctx, 0, this.camY - HANG_Y);
        }
        drawAim(ctx) {
            const ox = this.px, oy = this.screenY(this.py) - 6;
            const dx = Math.sin(this.aim), dy = -Math.cos(this.aim);
            const tg = this.target;
            const col = tg ? "#69f0ae" : "#fff59d";
            // Dotted guide out to how far you can jump (or to the hold it's on)
            const len = tg ? tg.dist : this.reach;
            ctx.fillStyle = tg ? "rgba(105,240,174,0.9)" : "rgba(255,255,255,0.45)";
            for (let d = 70; d < len - 10; d += 16) PL.circ(ctx, ox + dx * d, oy + dy * d, 2.5);
            // The arrow
            ctx.strokeStyle = col;
            ctx.lineWidth = 6;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(ox + dx * 16, oy + dy * 16);
            ctx.lineTo(ox + dx * 50, oy + dy * 50);
            ctx.stroke();
            ctx.fillStyle = col;
            const hx = ox + dx * 62, hy = oy + dy * 62;
            PL.poly(ctx, [hx + dx * 8, hy + dy * 8, hx - dy * 10 - dx * 6, hy + dx * 10 - dy * 6, hx + dy * 10 - dx * 6, hy - dx * 10 - dy * 6]);
            if (tg) {
                const h = tg.hold;
                const pulse = 1 + Math.sin(this.t * 14) * 0.12;
                ctx.strokeStyle = "#69f0ae";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(h.x, this.screenY(h.y), (h.r + 10) * pulse, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        drawHold(ctx, h, x, y) {
            const t = this.t;
            const r = h.r;
            if (h.type === "ledge") {
                ctx.fillStyle = PL.shade(this.b.wall, -25);
                PL.roundRect(ctx, x - r * 1.6, y - 6, r * 3.2, 22, 8);
                ctx.fill();
                ctx.fillStyle = this.b.groundTop;
                PL.roundRect(ctx, x - r * 1.6, y - 10, r * 3.2, 9, 5);
                ctx.fill();
                return;
            }
            if (h.type === "spring") {
                ctx.strokeStyle = "#9e9e9e";
                ctx.lineWidth = 3;
                ctx.beginPath();
                for (let i = 0; i < 5; i++) ctx.lineTo(x + (i % 2 ? 9 : -9), y + 10 - i * 4 - Math.abs(Math.sin(t * 6)) * 2);
                ctx.stroke();
                ctx.fillStyle = "#66bb6a";
                PL.ell(ctx, x, y - 10, 17, 6);
                ctx.fillStyle = "#b9f6ca";
                PL.ell(ctx, x - 5, y - 12, 6, 2);
                return;
            }
            let color = h.color;
            if (h.type === "gold") color = h.taken ? "#bdbdbd" : "#ffca28";
            else if (h.type === "crumble") color = "#a1887f";
            else if (h.type === "ice") color = "#b3e5fc";
            const hanging = h === this.cur && this.state === "hang";
            const sx = x + (h.type === "crumble" && hanging ? Math.sin(t * 60) * Math.min(3, this.hangT * 3) : 0);
            const dark = PL.shade(color, -35);
            // A few different hold shapes so the wall looks like a real route
            if (h.shape === 0 || h.type === "gold") {
                ctx.fillStyle = dark;
                PL.ell(ctx, sx, y + 4, r, r * 0.66);
                ctx.fillStyle = color;
                PL.ell(ctx, sx, y, r, r * 0.62);
            } else if (h.shape === 1) {
                ctx.fillStyle = dark;
                PL.ell(ctx, sx - r * 0.45, y + 3, r * 0.6, r * 0.55);
                PL.ell(ctx, sx + r * 0.45, y + 3, r * 0.6, r * 0.55);
                ctx.fillStyle = color;
                PL.ell(ctx, sx - r * 0.45, y, r * 0.58, r * 0.52);
                PL.ell(ctx, sx + r * 0.45, y, r * 0.58, r * 0.52);
            } else if (h.shape === 2) {
                ctx.fillStyle = dark;
                ctx.beginPath();
                ctx.ellipse(sx, y + 6, r * 1.1, r * 0.9, 0, Math.PI, 0);
                ctx.fill();
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(sx, y + 4, r * 1.05, r * 0.85, 0, Math.PI, 0);
                ctx.fill();
            } else {
                ctx.fillStyle = color;
                PL.ell(ctx, sx, y, r, r * 0.7);
                ctx.fillStyle = dark;
                PL.ell(ctx, sx, y + 1, r * 0.5, r * 0.32);
            }
            ctx.fillStyle = "rgba(255,255,255,0.45)";
            PL.ell(ctx, sx - r * 0.35, y - r * 0.25, r * 0.3, r * 0.16);
            if (h.type === "crumble") {
                ctx.strokeStyle = "#4e342e";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(sx - 8, y - 6);
                ctx.lineTo(sx - 1, y);
                ctx.lineTo(sx - 4, y + 7);
                ctx.moveTo(sx + 6, y - 7);
                ctx.lineTo(sx + 2, y + 2);
                ctx.stroke();
            }
            if (h.type === "ice") {
                ctx.fillStyle = "#e1f5fe";
                PL.poly(ctx, [sx - 6, y + 8, sx - 2, y + 8, sx - 4, y + 16 + Math.sin(t * 3 + h.id) * 2]);
                PL.poly(ctx, [sx + 4, y + 8, sx + 8, y + 8, sx + 6, y + 13]);
                if (Math.floor(t * 3 + h.id) % 4 === 0) {
                    ctx.fillStyle = "#ffffff";
                    PL.star(ctx, sx + 6, y - 5, 4, 1.5, 4);
                }
            }
            if (h.power && !h.taken) PL.drawPowerup(ctx, x + r + 16, y - 4, h.power, t, true);
        }
        result() {
            const m = this.meters;
            return super.result("climb", m * 1.5, m + " m climbed" + (this.caught ? " before the " + RISE_NAMES[this.rise] + " got you" : ""), m);
        }
    }

    // A gull flying across the cliff (dir 1 = flying right)
    function drawBird(ctx, x, y, dir, t) {
        const flap = Math.sin(t * 16) * 0.8;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(dir, 1);
        ctx.fillStyle = "#cfd8dc";
        PL.poly(ctx, [-4, -2, -26, -14 - flap * 14, -20, 0]);
        ctx.fillStyle = "#ffffff";
        PL.ell(ctx, 0, 0, 16, 8);
        PL.circ(ctx, 13, -4, 7);
        ctx.fillStyle = "#90a4ae";
        PL.poly(ctx, [-14, -2, -24, -5, -24, 4]);
        ctx.fillStyle = "#eceff1";
        PL.poly(ctx, [2, -2, -18, -16 - flap * 16, -10, 2]);
        ctx.fillStyle = "#ffa726";
        PL.poly(ctx, [18, -5, 27, -2, 18, -1]);
        ctx.fillStyle = "#212121";
        PL.circ(ctx, 15, -6, 1.6);
        ctx.restore();
    }

    function blobAt(ctx, x, y, r, color) {
        PL.blob(ctx, [[x, y, r], [x - r * 0.7, y + r * 0.2, r * 0.7], [x + r * 0.7, y + r * 0.2, r * 0.7]], color);
    }

    // ---------------- JUMPING ----------------
    // Press 1-5 to jump that high. Some walls have a bar above them, so you need
    // exactly the right height.
    const UNIT = 34;
    PL.JUMP_UNIT = UNIT;
    PL.jumpArc = function (k, lv) {
        const T = 0.6 + k * 0.07 + Math.min(0.25, lv * 0.004);
        const apex = k * UNIT + 12;
        const g = (8 * apex) / (T * T);
        return { T, g, v0: (g * T) / 2 };
    };

    class JumpGame extends Game {
        constructor(c) {
            super(c);
            this.title = "Jumping";
            this.hint = "Press 1 · 2 · 3 · 4 · 5 to jump that high. Bars overhead mean: not too high!";
            this.lv = c.lv.jump;
            this.gy = 440;
            this.px = 230;
            this.speed = 230 + this.d * 25;
            this.dist = 0;
            this.obs = [];
            this.spawnT = 1.2;
            this.cleared = 0;
            this.jy = 0;
            this.vy = 0;
            this.inAir = false;
        }
        update(dt) {
            const I = PL.input;
            this.stepCommon(dt);
            this.speed += dt * (7 + this.d * 2);
            const move = this.speed * dt;
            this.dist += move;
            this.spawnT -= dt;
            if (this.spawnT <= 0) {
                const maxH = Math.min(5, 1 + Math.floor(this.cleared / 3) + (this.d - 1));
                const h = 1 + Math.floor(Math.random() * maxH);
                const ceil = this.cleared >= 5 && h < 5 && Math.random() < 0.2 + this.d * 0.07;
                this.obs.push({ x: W + 40, h, ceil });
                // A coin floats just above the wall: jump the exact height to grab it
                if (Math.random() < 0.4) this.addCoin(W + 40, this.gy - h * UNIT - 34);
                this.spawnT = Math.max(1.05, 2.2 - this.t * 0.02) * PL.rand(0.85, 1.2);
            }
            for (const o of this.obs) o.x -= move;
            this.movePickups(-move, 0);
            if (this.powerDue(dt)) this.addPower(W + 40, this.gy - 3 * UNIT - 60);
            if (this.frostDue(dt)) this.addFrostFish(W + 60, this.gy - 3 * UNIT - 100);

            // Stand on the ground or on top of a wall you landed on
            const PW = 12, WALL = 16, BAR = 38;
            const over = (o, half) => this.px + PW > o.x - half && this.px - PW < o.x + half;
            let support = 0;
            for (const o of this.obs) if (over(o, WALL) && this.jy >= o.h * UNIT - 8) support = Math.max(support, o.h * UNIT);
            const grounded = this.jy <= support + 0.5 && this.vy <= 0;
            if (grounded) {
                for (let k = 1; k <= 5; k++) {
                    if (I.hit(String(k))) {
                        const arc = PL.jumpArc(k, this.lv);
                        this.vy = arc.v0;
                        this.g = arc.g;
                        this.lastK = k;
                        PL.fx.dust(this.px, this.gy - this.jy, 4);
                        PL.sfx("jump");
                        break;
                    }
                }
            }
            if (!grounded || this.vy > 0) {
                this.vy -= (this.g || 1600) * dt;
                this.jy += this.vy * dt;
                if (this.jy <= support) {
                    this.jy = support;
                    if (this.vy < -80) PL.fx.dust(this.px, this.gy - support, 5);
                    this.vy = 0;
                }
            } else {
                this.jy = support;
            }
            this.inAir = this.jy > support + 0.5 || this.vy > 0;

            // Walls and bars are solid
            let blocked = false;
            for (const o of this.obs) {
                const wallTop = o.h * UNIT;
                if (o.ceil && over(o, BAR)) {
                    const cb = wallTop + 90;
                    if (this.jy + 66 > cb && this.jy < cb + 14) {
                        if (this.vy > 0 && this.jy + 66 - this.vy * dt <= cb + 4) {
                            // Bonk! Head hits the bar and you drop back down
                            this.jy = cb - 66;
                            this.vy = 0;
                            if (!o.hit) {
                                o.hit = true;
                                this.hurt(this.px, this.gy - this.jy - 60);
                            }
                        } else {
                            this.px = o.x - BAR - PW;
                            blocked = true;
                        }
                    }
                }
                // Remember which jump carried you over this wall
                if (over(o, WALL) && this.inAir) o.k = this.lastK;
                if (over(o, WALL) && this.jy < wallTop - 4) {
                    this.px = o.x - WALL - PW;
                    blocked = true;
                    if (!o.hit) {
                        o.hit = true;
                        this.hurt(this.px + PW, this.gy - this.jy - 30);
                    }
                }
                if (!o.done && o.x + WALL < this.px - PW) {
                    o.done = true;
                    if (!o.hit) {
                        this.cleared++;
                        // Exactly the right height is a "Perfect!" worth an extra coin
                        const perfect = o.k === o.h;
                        this.collectCoin(this.px, this.gy - this.jy - 70, (o.ceil ? 2 : 1) + (perfect ? 1 : 0));
                        this.clean(this.px, this.gy - this.jy - 120, perfect ? (o.ceil ? "Perfect thread!" : "Perfect!") : null);
                        if (perfect) PL.fx.sparkle(this.px, this.gy - this.jy - 40);
                    }
                }
            }
            if (!blocked && this.px < 230) this.px = Math.min(230, this.px + (70 + this.lv * 2) * dt);
            if (this.px < -10) this.over = true;
            this.updatePickups(dt, this.px, this.gy - this.jy - 33, 26);
            this.obs = this.obs.filter((o) => o.x > -60);
        }
        draw(ctx) {
            const b = this.b;
            PL.drawBackdrop(ctx, b, this.dist, this.gy, this.t, this.mood);
            PL.drawGround(ctx, b, 0, this.gy, W, H - this.gy, this.dist);
            // Height guide on the left
            for (let k = 1; k <= 5; k++) {
                ctx.fillStyle = "rgba(255,255,255,0.35)";
                ctx.fillRect(0, this.gy - k * UNIT, 30, 3);
                PL.hudText(ctx, String(k), 40, this.gy - k * UNIT, { size: 14, align: "center" });
            }
            for (const o of this.obs) PL.drawHurdle(ctx, b, o.x, this.gy, o.h, UNIT, o.ceil ? o.h * UNIT + 90 : 0, true);
            this.drawPickups(ctx);
            ctx.fillStyle = "rgba(0,0,0,0.2)";
            PL.ell(ctx, this.px, this.gy, 20 - Math.min(12, this.jy / 15), 5);
            if (!this.flashPenguin()) {
                PL.drawPenguin(ctx, this.px, this.gy - this.jy, 0.95, { look: this.c.look, walk: !this.inAir, pose: this.inAir ? "jump" : "stand", t: this.t, face: this.face(false) });
                if (this.powers.shield) PL.drawShieldBubble(ctx, this.px, this.gy - this.jy - 34, 42, this.t);
            }
            PL.drawWeather(ctx, this.mood, this.t, this.dist);
            this.drawCommon(ctx);
            PL.hudText(ctx, "Cleared: " + this.cleared, 20, 30, { size: 26 });
            this.drawHearts(ctx);
            this.drawCoinCount(ctx);
        }
        result() {
            return super.result("jump", this.cleared * 5, this.cleared + " walls cleared", this.cleared);
        }
    }

    // ---------------- HILL SLIDING (shared with battles) ----------------
    // Rolling snowy hills made of smooth curves between peaks and valleys.
    // Holding SPACE makes the penguin heavy: it speeds up going downhill but
    // slows down going uphill. So hold going down, let go going up, and you
    // fly off the tops of hills. Land smoothly on a downslope for a speed boost.
    class Hills {
        // keys: [{ x, y }] alternating peaks and valleys (y grows downward)
        constructor(keys) {
            this.keys = keys;
            this.i = 0;
        }
        seg(x) {
            const k = this.keys;
            let i = PL.clamp(this.i, 0, k.length - 2);
            while (i > 0 && x < k[i].x) i--;
            while (i < k.length - 2 && x >= k[i + 1].x) i++;
            this.i = i;
            return i;
        }
        // Ground height, slope (dy/dx), angle and bend (d2y/dx2) at x
        at(x) {
            const i = this.seg(x);
            const a = this.keys[i], b = this.keys[i + 1];
            const w = b.x - a.x;
            const u = PL.clamp((x - a.x) / w, 0, 1);
            const y = a.y + ((b.y - a.y) * (1 - Math.cos(Math.PI * u))) / 2;
            const inside = x >= a.x && x <= b.x;
            const slope = inside ? (((b.y - a.y) * Math.PI) / (2 * w)) * Math.sin(Math.PI * u) : 0;
            const bend = inside ? (((b.y - a.y) * Math.PI * Math.PI) / (2 * w * w)) * Math.cos(Math.PI * u) : 0;
            return { y, slope, bend, angle: Math.atan(slope) };
        }
    }
    PL.Hills = Hills;

    // How the sliding skill changes the physics
    PL.slideParams = function (lv) {
        return {
            gHold: 1900 + lv * 14, // pull along the slope while holding
            gFree: 760,
            gAir: 1150,
            gAirHold: 2700, // holding in the air dives you down faster
            drag: Math.max(0.035, 0.07 - lv * 0.0008),
            minS: 150,
            maxS: 1150 + lv * 12,
            perfectAngle: 0.34,
            perfectBoost: 1.1 + Math.min(0.06, lv * 0.0015)
        };
    };

    // Move a sliding body one small step. body: { x, y, vx, vy, s, ground, airT }
    // Returns "takeoff", { land: "perfect" | "ok" | "bumpy", airT } or null.
    PL.slideStep = function (body, hills, hold, dt, P) {
        if (body.ground) {
            const g = hills.at(body.x);
            const c = Math.cos(g.angle), sn = Math.sin(g.angle);
            // Holding makes you heavy: great going down, worse than coasting going up
            const pull = hold ? (sn < 0 ? P.gHold * 1.3 : P.gHold) : P.gFree;
            body.s += pull * sn * dt;
            body.s -= body.s * P.drag * dt;
            body.s = PL.clamp(body.s, P.minS, P.maxS);
            const vx = body.s * c, vy = body.s * sn;
            const gAir = hold ? P.gAirHold : P.gAir;
            body.vx = vx;
            body.vy = vy;
            // Over the top of a hill the ground curves away; if you're going fast
            // enough that gravity can't keep you on it, you take off
            const k = g.bend / Math.pow(1 + g.slope * g.slope, 1.5);
            if (k > 0 && body.s * body.s * k > gAir * c) {
                body.ground = false;
                body.airT = 0;
                body.x += vx * dt;
                body.y += vy * dt;
                return "takeoff";
            }
            body.x += vx * dt;
            body.y = hills.at(body.x).y;
            return null;
        }
        const gAir = hold ? P.gAirHold : P.gAir;
        body.airT += dt;
        body.vy += gAir * dt;
        body.x += body.vx * dt;
        body.y += body.vy * dt;
        const g = hills.at(body.x);
        if (body.y < g.y) return null;
        // Landing: smooth onto a downslope is perfect, crashing into a slope is bumpy
        const c = Math.cos(g.angle), sn = Math.sin(g.angle);
        const along = body.vx * c + body.vy * sn;
        const diff = Math.abs(Math.atan2(body.vy, body.vx) - g.angle);
        let kind = "ok", s = along;
        if (diff < P.perfectAngle && g.angle > 0.05) {
            kind = "perfect";
            s = Math.max(along, Math.hypot(body.vx, body.vy) * 0.95) * P.perfectBoost;
        } else if (diff > 0.7) {
            // Thumped into a slope: you lose some speed, not all of it
            kind = "bumpy";
            s = Math.max(along, body.vx * 0.75);
        }
        body.s = PL.clamp(s, P.minS, P.maxS);
        body.y = g.y;
        body.ground = true;
        body.vx = body.s * c;
        body.vy = body.s * sn;
        return { land: kind, airT: body.airT };
    };

    // Hills for a race section: from (0, 0) to (len, drop), seeded so every
    // player in an online race gets the same hills
    PL.raceHills = function (rng, len, drop, tier) {
        const n = Math.max(2, Math.round(len / 330));
        const keys = [{ x: 0, y: 0 }];
        for (let i = 1; i < n; i++) {
            const x = (len * (i + (rng() - 0.5) * 0.3)) / n;
            const base = (drop * x) / len;
            const amp = (40 + rng() * 70) * (1 + tier * 0.15);
            keys.push({ x, y: base + (i % 2 ? amp : -amp * 0.6) });
        }
        keys.push({ x: len, y: drop });
        return keys;
    };

    // ---------------- SLIDING ----------------
    // Belly-slide over endless rolling hills with a seal sliding after you.
    // Hold SPACE (or ↓) on the way down, let go on the way up, fly off the tops
    // and land smoothly. The seal is a steady slider: it only catches up when
    // you lose speed (bumpy landings, holding uphill, not diving).
    const PEN_X = 300; // where the penguin sits on screen
    const SLIDE_SETBACK = 160;
    class SlideGame extends Game {
        constructor(c) {
            super(c);
            this.title = "Sliding";
            this.hint = "HOLD SPACE going down a hill · LET GO going up to fly · HOLD again to dive onto the next downhill!";
            this.lv = c.lv.slide;
            this.P = PL.slideParams(this.lv);
            if (this.weather && this.weather.slide) PL.slickSlide(this.P, this.weather.slide);
            this.keys = [{ x: -500, y: 140 }, { x: 0, y: 0, peak: true }];
            this.hills = new Hills(this.keys);
            this.decor = [];
            this.extend(2400);
            this.body = { x: 0, y: 0, vx: 0, vy: 0, s: 260, ground: true, airT: 0 };
            this.camX = -PEN_X;
            this.camY = -330;
            this.sealX = -420;
            this.cullAhead = 3600; // coins are placed on hills built far ahead
            this.perfects = 0;
            this.bestSpeed = 0;
            this.hold = false;
            this.sprayT = 0;
        }
        get hard() {
            return Math.min(1, this.body ? this.body.x / 60000 : 0);
        }
        // More hills ahead: normal rolling hills, big hills for big air, and
        // runs of small bumpy ones
        extend(toX) {
            const k = this.keys;
            while (k[k.length - 1].x < toX) {
                const hard = this.hard;
                const roll = Math.random();
                let wMin = 250, wMax = 420, aMin = 60, aMax = 130, pairs = 1;
                if (roll < 0.15) {
                    wMin = 380; wMax = 520; aMin = 150; aMax = 220;
                } else if (roll < 0.28) {
                    wMin = 150; wMax = 200; aMin = 25; aMax = 45; pairs = 3;
                }
                // Faster sliders get longer hills, so a jump off the top lands on the next downhill
                const ws = this.body ? Math.max(1, this.body.s / 500) : 1;
                for (let p = 0; p < pairs; p++) {
                    // Down into a valley, then up to the next peak (a bit lower each time)
                    const last = k[k.length - 1];
                    const w1 = PL.rand(wMin, wMax) * (1 + hard * 0.25) * ws;
                    const w2 = PL.rand(wMin, wMax) * (1 + hard * 0.25) * ws;
                    const a = PL.rand(aMin, aMax) * (1 + hard * 0.35);
                    const valley = { x: last.x + w1, y: last.y + a + w1 * 0.02 };
                    const peak = { x: valley.x + w2, y: valley.y - a * 0.85, peak: true };
                    k.push(valley, peak);
                    // Coins: an arc above the peak (where you fly) or along the downslope
                    const r2 = Math.random();
                    if (peak.x > 600 && r2 < 0.4) {
                        for (let i = 0; i < 5; i++) this.addCoin(peak.x + 20 + i * 55, peak.y - 70 - Math.sin((i / 4) * Math.PI) * 45);
                    } else if (valley.x > 600 && r2 < 0.65) {
                        for (let i = 0; i < 4; i++) {
                            const cx = last.x + w1 * (0.35 + i * 0.15);
                            this.pendingCoins = (this.pendingCoins || []).concat([cx]);
                        }
                    }
                    if (Math.random() < 0.35) this.decor.push({ x: valley.x + PL.rand(-60, 60), kind: Math.random() < 0.7 ? "pine" : "flag" });
                }
            }
            // Coins that hug the slope need the hill to exist first
            if (this.pendingCoins) {
                for (const cx of this.pendingCoins) this.addCoin(cx, this.hills.at(cx).y - 26);
                this.pendingCoins = null;
            }
            // Forget hills far behind
            const behind = this.body ? this.body.x - 1500 : -1e9;
            while (k.length > 4 && k[1].x < behind) k.shift();
            this.decor = this.decor.filter((d) => d.x > behind);
        }
        update(dt) {
            const I = PL.input;
            this.stepCommon(dt);
            const B = this.body;
            this.extend(B.x + 2400);
            this.hold = I.down("action") || I.down("down");

            // Physics in small steps so fast slides stay smooth
            const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
            for (let i = 0; i < steps; i++) {
                const ev = PL.slideStep(B, this.hills, this.hold, dt / steps, this.P);
                if (ev) this.onSlideEvent(ev);
            }
            this.bestSpeed = Math.max(this.bestSpeed, B.s);

            // Snow spray while sliding fast
            this.sprayT -= dt;
            if (B.ground && this.sprayT <= 0) {
                this.sprayT = 0.05;
                PL.fx.burst(B.x - this.camX - 22, B.y - this.camY - 2, { n: 2, color: ["#ffffff", this.b.groundTop], speed: 80 + B.s * 0.2, angle: -2.6, spread: 0.6, gravity: 500, life: 0.35, size: 3 });
            }

            if (this.powerDue(dt)) {
                const ax = B.x + 1200;
                this.addPower(ax, this.hills.at(ax).y - 40);
            }
            if (this.frostDue(dt)) {
                const fishX = B.x + 1500;
                this.addFrostFish(fishX, this.hills.at(fishX).y - 90);
            }
            this.updatePickups(dt, B.x - this.camX, B.y - this.camY - 18, 26, this.camX, this.camY);

            // The seal: a steady slider that gets a bit faster over time
            // It always catches up in the end, since it keeps getting faster than your top speed
            const sealV = Math.min(this.P.maxS * 1.05, 230 + this.t * 11 + (this.d - 1) * 30);
            this.sealX = Math.max(this.sealX + sealV * dt, B.x - 900);
            if (B.x - this.sealX < 45 && !this.over) {
                const sx = B.x - this.camX, sy = B.y - this.camY;
                if (this.useShield(sx, sy - 20)) {
                    this.sealX = B.x - 400;
                    PL.fx.shake(8, 0.3);
                } else {
                    this.over = true;
                    this.caught = true;
                    PL.sfx("hit");
                    PL.fx.shake(14, 0.45);
                    PL.fx.flash("#ff1744", 0.25, 0.2);
                }
            }

            // Seal lunges (only once it's close enough to see): tap SPACE / ↓ while the red ring flashes
            const lev = this.stepLunge(dt, I.hit("action") || I.hit("down"), B.x - this.sealX < PEN_X - 40);
            if (lev) {
                const sx = B.x - this.camX, sy = B.y - this.camY;
                if (lev === "perfect") {
                    this.perfectDodge(sx, sy - 20);
                    this.sealX -= SLIDE_SETBACK * LUNGE.counter;
                } else if (lev === "dodge") this.plainDodge(sx, sy);
                else if (!this.useShield(sx, sy - 20)) {
                    this.hitFx(sx, sy - 20);
                    B.s = Math.max(this.P.minS, B.s * 0.75);
                    this.popup("Nipped! Speed lost", sx, sy - 70, "#ff8a80");
                }
            }

            // Camera: keep the hill in view, follow you up when you fly high
            this.camX = B.x - PEN_X;
            const g = this.hills.at(B.x);
            const want = Math.min(B.y - 300, g.y - 330);
            this.camY = PL.lerp(this.camY, want, Math.min(1, dt * 5));
        }
        onSlideEvent(ev) {
            const B = this.body;
            const sx = B.x - this.camX, sy = B.y - this.camY;
            if (ev === "takeoff") {
                if (B.s > 450) PL.sfx("whoosh");
                return;
            }
            PL.fx.dust(sx, sy, 5);
            if (ev.land === "perfect") {
                this.perfects++;
                this.clean(sx, sy - 70, "Perfect landing!");
                PL.fx.sparkle(sx, sy - 20);
                PL.sfx("step");
            } else if (ev.land === "bumpy") {
                this.breakCombo(sx, sy);
                this.popup("Bumpy! Land on a downhill", sx, sy - 70, "#ff8a80");
                PL.fx.shake(6, 0.2);
                PL.sfx("hit");
            }
            if (ev.airT > 1.1) {
                this.popup("Big air!", sx, sy - 100, "#b9f6ca");
                this.collectCoin(sx, sy - 40, 2);
            }
        }
        draw(ctx) {
            const b = this.b;
            const cx = this.camX, cy = this.camY;
            const B = this.body;
            const gap = PL.clamp((B.x - this.sealX - 45) / 400, 0, 1);
            PL.drawBackdrop(ctx, b, cx * 0.6, PL.clamp(this.hills.at(cx + W / 2).y - cy - 60, 160, 420), this.t, this.mood);

            // The hills: a deep layer, the snow on top and a shiny edge
            const pts = [];
            for (let x = -10; x <= W + 10; x += 8) pts.push(x, this.hills.at(x + cx).y - cy);
            ctx.fillStyle = b.ground;
            ctx.beginPath();
            ctx.moveTo(-10, H + 20);
            for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
            ctx.lineTo(W + 10, H + 20);
            ctx.closePath();
            ctx.fill();
            ctx.lineJoin = "round";
            ctx.strokeStyle = PL.shade(b.ground, -12);
            ctx.lineWidth = 26;
            this.strokeCurve(ctx, pts, 70);
            ctx.strokeStyle = b.groundTop;
            ctx.lineWidth = 18;
            this.strokeCurve(ctx, pts, 7);
            ctx.strokeStyle = "rgba(255,255,255,0.7)";
            ctx.lineWidth = 3;
            this.strokeCurve(ctx, pts, -1);
            for (const d of this.decor) {
                const sx = d.x - cx;
                if (sx < -60 || sx > W + 60) continue;
                const sy = this.hills.at(d.x).y - cy + 4;
                if (d.kind === "pine") PL.drawPine(ctx, sx, sy, 64, "#2e6b4f");
                else {
                    ctx.fillStyle = "#8d5a3b";
                    ctx.fillRect(sx - 2, sy - 50, 4, 50);
                    ctx.fillStyle = "#ef5350";
                    PL.poly(ctx, [sx + 2, sy - 50, sx + 26 + Math.sin(this.t * 6 + d.x) * 3, sy - 43, sx + 2, sy - 36]);
                }
            }
            this.drawPickups(ctx, cx, cy);
            PL.drawSpeedLines(ctx, B.s * 0.6, this.t, 60, H - 60);

            // The seal, belly-sliding on the snow behind you
            const sealSX = this.sealX - cx;
            if (sealSX > -50) {
                const lw = this.sealX + this.lungeSurge() * 60;
                const sg = this.hills.at(lw);
                PL.drawSlideSeal(ctx, lw - cx, sg.y - cy, sg.angle, 0.55, this.t, Math.max(1 - gap, this.lungeSurge()));
                this.drawLunge(ctx, lw - cx + Math.cos(sg.angle) * 28, sg.y - cy - 20 + Math.sin(sg.angle) * 28, 36);
            } else {
                // Off screen: an arrow on the left edge shows how far back it is
                const ay = PL.clamp(this.hills.at(cx).y - cy - 40, 90, H - 90);
                ctx.fillStyle = "rgba(42,28,18,0.75)";
                PL.roundRect(ctx, 8, ay - 16, 104, 32, 10);
                ctx.fill();
                ctx.fillStyle = "#ff8a80";
                PL.poly(ctx, [14, ay, 26, ay - 9, 26, ay + 9]);
                PL.hudText(ctx, "Seal " + Math.round((B.x - this.sealX) / 60) + " m", 32, ay + 1, { size: 14, stroke: false });
            }

            // The penguin: tilted to match the hill (or its flight), squashed flat while diving
            const sx = B.x - cx, sy = B.y - cy;
            const g = this.hills.at(B.x);
            let tilt = B.ground ? g.angle : Math.atan2(B.vy, B.vx);
            if (!B.ground && this.hold) tilt += 0.25;
            if (!this.flashPenguin()) {
                ctx.save();
                ctx.translate(sx, sy);
                if (this.hold && B.ground) ctx.scale(1.08, 0.82);
                PL.drawPenguin(ctx, 0, 0, 0.95, { look: this.c.look, pose: "slide", t: this.t, tilt, face: this.face(gap < 0.35) });
                ctx.restore();
                if (this.powers.shield) PL.drawShieldBubble(ctx, sx, sy - 18, 40, this.t);
            }

            // Teach the rhythm: HOLD on the way down, LET GO on the way up
            if (this.t < 30 && this.perfects < 6 && B.ground && !this.over) {
                const bob = Math.sin(this.t * 8) * 3;
                if (g.slope > 0.12 && !this.hold) {
                    PL.drawKey(ctx, "SPACE", sx, sy - 74 + bob, 30, true);
                    PL.hudText(ctx, "HOLD", sx, sy - 104 + bob, { size: 16, align: "center", color: "#b9f6ca" });
                } else if (g.slope < -0.12 && this.hold) {
                    PL.hudText(ctx, "LET GO!", sx, sy - 80 + bob, { size: 20, align: "center", color: "#ffe082" });
                }
            } else if (this.t < 30 && this.perfects < 6 && !B.ground && B.vy > 0 && !this.hold && !this.over) {
                PL.hudText(ctx, "HOLD to dive down!", sx, sy - 60, { size: 16, align: "center", color: "#b9f6ca" });
            }

            PL.drawWeather(ctx, this.mood, this.t, this.camX);
            this.drawCommon(ctx);
            PL.drawDangerEdges(ctx, PL.clamp((0.35 - gap) / 0.35, 0, 1), this.t);
            PL.hudText(ctx, this.meters + " m", 20, 30, { size: 28 });
            PL.drawBar(ctx, 20, 56, 180, 12, (B.s - this.P.minS) / (this.P.maxS - this.P.minS), "#4dd0e1", "Speed");
            PL.drawBar(ctx, 20, 78, 180, 12, gap, gap > 0.4 ? "#66bb6a" : "#ef5350", "Seal distance");
            this.drawCoinCount(ctx);
        }
        strokeCurve(ctx, pts, dy) {
            ctx.beginPath();
            ctx.moveTo(pts[0], pts[1] + dy);
            for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1] + dy);
            ctx.stroke();
        }
        get meters() {
            return Math.floor(Math.max(0, this.body.x) / 60);
        }
        result() {
            const m = this.meters;
            return super.result("slide", m / 4, m + " m slid" + (this.caught ? " before the seal caught you" : ""), m);
        }
    }

    // Chases get moody weather (never a plain sunny day)
    SwimGame.CHASE = WaddleGame.CHASE = SlideGame.CHASE = true;

    PL.TRAININGS = {
        swim: { cls: SwimGame, name: "Swimming" },
        waddle: { cls: WaddleGame, name: "Waddling" },
        climb: { cls: ClimbGame, name: "Climbing" },
        jump: { cls: JumpGame, name: "Jumping" },
        slide: { cls: SlideGame, name: "Sliding" }
    };
})(window.PL);
