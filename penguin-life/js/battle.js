// ==========================================
// PENGUIN LIFE - Battles
// A 5-penguin race over a mixed course: waddling, swimming, climbing,
// jumping and sliding. You steer, but HOW FAST you go in each part comes
// from your training levels. Run out of stamina and you lose on the spot.
//
// To keep it exciting: boost pads, a speed burst for perfect moves,
// overtake call-outs, a final stretch, cheering crowds, and a key panel
// that always shows what to press for the section you're in.
// ==========================================
(function (PL) {
    const W = PL.W, H = PL.H;
    const UNIT = PL.JUMP_UNIT;
    const GROUND = 0; // world y of the base ground line

    // Speed in px/s for a skill level
    const BASE = { run: 110, swim: 115, climb: 62, jump: 108, slide: 125, downhill: 380 };
    const PER = { run: 8, swim: 8.5, climb: 4.4, jump: 7.5, slide: 9, downhill: 0 };
    PL.segSpeed = (type, lv) => BASE[type] + PER[type] * lv;
    PL.maxStamina = (lv) => 40 + lv * 9;

    const SEG_COLOR = { run: "#ffb74d", swim: "#29b6f6", climb: "#a1887f", downhill: "#e0e0e0", jump: "#ba68c8", slide: "#4dd0e1" };
    const SEG_ICON = { run: "waddle", swim: "swim", climb: "climb", jump: "jump", slide: "slide", downhill: "slide" };
    const SEG_NAME = { run: "Waddle", swim: "Swim", climb: "Climb", jump: "Jump", slide: "Hill Slide", downhill: "Slide Down" };
    // What to press in each section (shown in the key panel at the bottom)
    const CONTROLS = {
        run: [["SPACE", "hop rocks"], ["→", "sprint"]],
        swim: [["↓", "hold to dive under land"], ["→", "sprint"]],
        climb: [["SPACE", "jump when the arrow is green"]],
        downhill: [["SPACE", "hold going down"], ["", "let go going up"]],
        jump: [["1-5", "jump that high"], ["→", "sprint"]],
        slide: [["SPACE", "hold going down"], ["", "let go going up"]]
    };
    const CLIMB_AIM = 0.95; // the climbing arrow swings this far either side of straight up
    const TAG_COLORS = ["#ef5350", "#ab47bc", "#42a5f5", "#26a69a", "#ffca28"];

    // ---------- Keyboard key drawing ----------
    function keyFont(h) {
        return "800 " + Math.round(h * 0.5) + "px 'Baloo 2', 'Trebuchet MS', sans-serif";
    }
    PL.keyWidth = function (ctx, label, h) {
        ctx.font = keyFont(h);
        return Math.max(h, ctx.measureText(label).width + h * 0.6);
    };
    // A keyboard key drawn as a little rounded cap, centered on (x, y).
    // hot = green "press it now!"
    PL.drawKey = function (ctx, label, x, y, h, hot) {
        h = h || 30;
        const w = PL.keyWidth(ctx, label, h);
        ctx.fillStyle = hot ? "#2e7d32" : "#9e8f80";
        PL.roundRect(ctx, x - w / 2, y - h / 2 + 3, w, h, 7);
        ctx.fill();
        ctx.fillStyle = hot ? "#b9f6ca" : "#fff8ec";
        PL.roundRect(ctx, x - w / 2, y - h / 2, w, h - 2, 7);
        ctx.fill();
        ctx.font = keyFont(h);
        ctx.fillStyle = "#3b2a1e";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x, y);
        return w;
    };

    // ---------- Course ----------
    // Holds up a race cliff: h is the height, dx how far out from the cliff edge.
    // The first is at the bottom, the last right at the top lip.
    function climbHolds(rng, len) {
        const n = Math.max(2, Math.round(len / 88));
        const holds = [{ h: 0, dx: -14 }];
        let dx = -14;
        for (let i = 1; i <= n; i++) {
            const h = i === n ? len : (len * (i + (rng() - 0.5) * 0.25)) / n;
            const step = h - holds[i - 1].h;
            // Sideways steps stay within reach of the swinging arrow
            const most = step * 0.75;
            if (i === n) dx = PL.clamp(-12, dx - most, dx + most);
            else dx = PL.clamp(dx + (rng() < 0.5 ? -1 : 1) * Math.min(most, 30 + rng() * 30), -100, -14);
            holds.push({ h, dx });
        }
        return holds;
    }
    // How far out from the cliff a racer is at height p (between two holds)
    function climbDx(s, p) {
        const hs = s.holds;
        for (let i = 0; i < hs.length - 1; i++) {
            if (p <= hs[i + 1].h) {
                const u = PL.clamp((p - hs[i].h) / (hs[i + 1].h - hs[i].h), 0, 1);
                return PL.lerp(hs[i].dx, hs[i + 1].dx, u);
            }
        }
        return hs[hs.length - 1].dx;
    }

    PL.buildCourse = function (biomeId, raceIdx, seed) {
        const b = PL.BIOMES[biomeId];
        const rng = PL.makeRng(seed);
        const r = (a, c) => a + rng() * (c - a);
        // Sections are a bit shorter than they used to be, so races feel snappier
        const L = b.lengthMult * 0.85;
        const spread = Math.max(1, b.lengthMult * 1.05);
        const count = b.segBase + Math.min(raceIdx, 3);
        const segs = [{ type: "run", len: 420, obs: [], boosts: [] }];
        const types = Object.keys(b.course);
        // Boost pads go in some of the open spaces between obstacles
        const addBoosts = (seg) => {
            seg.boosts = [];
            for (let i = 0; i < seg.obs.length - 1; i++) {
                if (rng() < 0.4) seg.boosts.push({ at: (seg.obs[i].at + seg.obs[i + 1].at) / 2 });
            }
        };
        // Pick the order of sections: never the same twice in a row, never a
        // hill slide straight after a climb (you slide down after every climb anyway)
        const order = [];
        let last = "run";
        for (let i = 0; i < count; i++) {
            const ok = (k) => k !== last && !(last === "climb" && k === "slide");
            const total = types.reduce((sum, k) => sum + (ok(k) ? b.course[k] : 0), 0);
            let roll = rng() * total;
            const type = types.find((k) => ok(k) && (roll -= b.course[k]) < 0) || "run";
            order.push(type);
            last = type;
        }
        // Every race has at least one climb
        if (!order.includes("climb")) {
            const i = 1 + Math.floor(rng() * Math.max(1, order.length - 1));
            order[Math.min(i, order.length - 1)] = "climb";
        }
        for (let i = 0; i < order.length; i++) {
            if (order[i] === order[i - 1]) order[i] = order[i] === "run" ? "jump" : "run";
            if (order[i - 1] === "climb" && order[i] === "slide") order[i] = "run";
        }
        for (const type of order) {
            const seg = { type, boosts: [] };
            if (type === "run") {
                seg.len = r(800, 1300) * L;
                seg.obs = [];
                // Gaps grow with the biome so fast racers can land between rocks
                for (let p = 250; p < seg.len - 120; p += r(230, 380) * spread) seg.obs.push({ at: p });
                addBoosts(seg);
            } else if (type === "swim") {
                seg.len = r(800, 1200) * L;
                seg.obs = [];
                for (let p = 220; p < seg.len - 150; p += r(260, 420)) seg.obs.push({ at: p, w: r(100, 160) });
            } else if (type === "climb") {
                seg.len = r(260, 400) * Math.sqrt(b.lengthMult);
                seg.holds = climbHolds(rng, seg.len);
            } else if (type === "jump") {
                seg.len = r(900, 1200) * L;
                seg.obs = [];
                for (let p = 260; p < seg.len - 120; p += r(230, 320) * Math.max(1, b.lengthMult * 1.15)) {
                    const h = 1 + Math.floor(rng() * b.maxHurdle);
                    seg.obs.push({ at: p, h, ceil: b.tier >= 1 && h < 5 && rng() < 0.15 + b.tier * 0.08 });
                }
            } else if (type === "slide") {
                // Rolling hills: hold to dive down them, let go to fly off the tops
                seg.len = r(1500, 2100) * L;
                seg.drop = seg.len * 0.1;
                seg.hills = PL.raceHills(rng, seg.len, seg.drop, b.tier);
            }
            segs.push(seg);
            if (type === "climb") {
                // ...and then belly-slide down the hills on the far side
                const len = Math.max(1200, seg.len * 3.4);
                segs.push({ type: "downhill", len, drop: seg.len, hills: PL.raceHills(rng, len, seg.len, b.tier), boosts: [] });
            }
        }
        segs.push({ type: "run", len: 520, finish: true, obs: [], boosts: [] });

        // Lay the segments out in world space
        let x = 0, y = GROUND;
        for (const s of segs) {
            s.x0 = x;
            s.y0 = y;
            if (s.type === "climb") y -= s.len;
            else {
                x += s.len;
                y += s.drop || 0;
            }
            s.x1 = x;
            s.y1 = y;
        }
        let acc = 0;
        for (const s of segs) {
            s.start = acc;
            acc += s.len;
        }
        return { segs, total: acc, biome: b };
    };

    // ---------- Racer ----------
    function makeRacer(def, i) {
        return {
            id: def.id || (def.isPlayer ? "me" : "r" + i),
            name: def.name,
            look: def.look,
            lv: def.lv,
            isPlayer: !!def.isPlayer,
            remote: !!def.remote,
            peerId: def.peerId || null,
            // You run in the front lane; everyone else is a little further back
            lane: def.isPlayer ? 4 : Math.min(3, Math.max(0, i - 1)),
            tag: TAG_COLORS[(i + 4) % TAG_COLORS.length],
            seg: 0,
            p: 0,
            stam: PL.maxStamina(def.lv.stamina),
            maxStam: PL.maxStamina(def.lv.stamina),
            stumble: 0,
            air: null,
            airH: 0,
            dive: false,
            boostT: 0,
            boostMult: 1,
            finished: false,
            finishTime: 0,
            out: false,
            skill: def.skill || 0.85,
            hopNext: null
        };
    }

    // AI levels for a race: the champion gets one strong penguin
    PL.makeOpponents = function (biomeId, raceIdx, rng) {
        const b = PL.BIOMES[biomeId];
        rng = rng || Math.random;
        const base = b.ai[Math.min(raceIdx, 3)];
        const names = b.names.slice().sort(() => rng() - 0.5);
        const colors = ["classic", "adelie", "chinstrap", "rockhopper", "littleblue", "emperor"];
        const hats = ["none", "beanie", "none", "party", "tophat", "none", "flower"];
        const out = [];
        for (let i = 0; i < 4; i++) {
            const champ = raceIdx === 3 && i === 0;
            const lvBase = champ ? base + 3 : base - 2 - i * 1.5;
            const lv = {};
            PL.SKILLS.forEach((s) => {
                let v = lvBase + (rng() * 4 - 2);
                if (b.special && s.id === b.special) v += 8;
                lv[s.id] = Math.max(1, Math.round(v));
            });
            out.push({
                name: champ ? b.champion.name : names[i],
                look: champ ? b.champion.look : { color: colors[Math.floor(rng() * colors.length)], hat: hats[Math.floor(rng() * hats.length)], scarf: "none", glasses: "none" },
                lv,
                skill: champ ? 0.95 : 0.78 + rng() * 0.12
            });
        }
        return out;
    };

    PL.santaOpponents = function () {
        return PL.SANTA.racers.map((r) => {
            const lv = {};
            PL.SKILLS.forEach((s) => { lv[s.id] = r.level; });
            return { name: r.name, look: r.look, lv, skill: 0.93 };
        });
    };

    // ---------- Race ----------
    class Race {
        // opts: { biomeId, raceIdx, seed, player, opponents, title, online, mood }
        constructor(opts) {
            this.opts = opts;
            this.course = PL.buildCourse(opts.biomeId, opts.raceIdx, opts.seed);
            this.b = this.course.biome;
            for (const s of this.course.segs) if (s.hills) s.hl = new PL.Hills(s.hills);
            const defs = [opts.player].concat(opts.opponents).slice(0, 5);
            this.racers = defs.map((d, i) => makeRacer(d, i));
            this.me = this.racers[0];
            this.t = 0;
            this.over = false;
            this.endT = null;
            // Start the camera where it will settle so the first frame is not off to the side
            this.camX = -300;
            this.camY = GROUND - 360;
            this.msg = null;
            this.order = [];
            this.title = opts.title || this.b.name;
            this.mood = opts.mood || (PL.pickMood ? PL.pickMood(this.b, opts.seed) : undefined);
            this.lastPlace = null;
            this.baseY = GROUND;
            this.callT = 0;
            this.finalShown = false;
        }

        segOf(r) {
            return this.course.segs[r.seg];
        }

        progress(r) {
            return this.segOf(r).start + r.p;
        }

        // World position of a racer's feet / body center
        posOf(r) {
            const s = this.segOf(r);
            if (s.type === "climb") return { x: s.x0 + climbDx(s, r.p), y: s.y0 - r.p };
            if (s.hl) return { x: s.x0 + r.p, y: s.y0 + s.hl.at(r.p).y };
            return { x: s.x0 + r.p, y: s.y0 };
        }

        // Back lanes sit a little higher and smaller, like they're further away
        laneOf(r) {
            const s = this.segOf(r);
            if (s.type === "climb" || s.type === "swim") return { dy: 0, scale: 0.66 + r.lane * 0.02 };
            return { dy: (r.lane - 4) * 8, scale: 0.62 + r.lane * 0.03 };
        }

        screenOf(r) {
            const p = this.posOf(r);
            return { x: p.x - this.camX, y: p.y - this.camY + this.laneOf(r).dy };
        }

        update(dt) {
            const I = PL.input;
            this.t += dt;
            for (const r of this.racers) {
                // Friends online: glide toward their latest position instead of jumping
                if (r.remote && r.netP != null && !r.finished) r.p += (r.netP - r.p) * Math.min(1, dt * 12);
                if (r.finished || r.out || r.remote) continue;
                if (r.isPlayer) this.controlPlayer(r, dt, I);
                else this.controlAI(r, dt);
                this.advance(r, dt);
            }
            if (this.msg) {
                this.msg.life -= dt;
                if (this.msg.life <= 0) this.msg = null;
            }

            // Camera follows the player
            const pos = this.posOf(this.me);
            const ms = this.segOf(this.me);
            const lift = ms.hl ? Math.min(220, this.me.airH) : 0;
            // The far scenery sits at the ground level of the flat parts (not the cliff tops)
            if (ms.type !== "climb" && ms.type !== "downhill") this.baseY = PL.lerp(this.baseY, ms.hl ? ms.y0 + ms.drop * 0.5 : ms.y0, Math.min(1, dt * 2));
            this.camX = PL.lerp(this.camX, pos.x - 300, Math.min(1, dt * 6));
            this.camY = PL.lerp(this.camY, pos.y - lift - 360, Math.min(1, dt * 4));

            this.callOvertakes(dt);
            // Blizzard races are slicker on the slides: say so once the race is going
            if (!this.weatherShown && this.mood === "blizzard" && this.t > 1.2) {
                this.weatherShown = true;
                PL.fx.banner("BLIZZARD!", "#e1f5fe", "Slides +20% for everyone");
            }
            if (!this.finalShown && !this.me.out && this.me.seg === this.course.segs.length - 1) {
                this.finalShown = true;
                PL.fx.banner("FINAL STRETCH!", "#ffca28");
                PL.sfx("combo");
            }

            // A short moment to enjoy the finish (or the flop) before the results
            if ((this.me.finished || this.me.out) && this.endT === null) this.endT = this.me.finished ? 1.4 : 0.7;
            if (this.endT !== null) {
                this.endT -= dt;
                if (this.endT <= 0) this.over = true;
            }
        }

        // "You passed Frosty!" / "Frosty passed you!"
        callOvertakes(dt) {
            this.callT = Math.max(0, this.callT - dt);
            if (this.me.finished || this.me.out) return;
            const place = this.place(this.me);
            if (this.lastPlace !== null && place !== this.lastPlace && this.callT <= 0) {
                const sorted = this.racers.slice().sort((a, c) => this.place(a) - this.place(c));
                if (place < this.lastPlace) {
                    const passed = sorted[place];
                    if (passed) PL.fx.text("You passed " + passed.name + "!", W / 2, 150, { color: "#b9f6ca", size: 24, life: 1.3, rise: 20 });
                    PL.sfx("coin");
                } else {
                    const by = sorted[place - 2];
                    if (by) PL.fx.text(by.name + " passed you!", W / 2, 150, { color: "#ff8a80", size: 22, life: 1.1, rise: 20 });
                }
                this.callT = 0.8;
            }
            this.lastPlace = place;
        }

        say(text, color, life) {
            this.msg = { text, color: color || "#fff", life: life || 1.6 };
        }

        burstAt(r, color, n) {
            const s = this.screenOf(r);
            PL.fx.burst(s.x, s.y - 30, { n: n || 10, color, speed: 220, life: 0.6 });
        }

        controlPlayer(r, dt, I) {
            const s = this.segOf(r);
            r.sprint = I.down("sprint") || I.down("right");
            const dazed = r.stumble > 0;
            if (!dazed && s.type === "run" && (I.hit("action") || I.hit("up"))) this.startHop(r, 1.4);
            if (s.type === "swim") r.dive = I.down("down");
            if (s.type === "climb" && (I.hit("action") || I.hit("up"))) r.climbPress = true;
            r.slideHold = I.down("action") || I.down("down");
            if (!dazed && s.type === "jump" && !r.air) {
                for (let k = 1; k <= 5; k++) {
                    if (I.hit(String(k))) {
                        this.startJump(r, k);
                        break;
                    }
                }
            }
        }

        controlAI(r, dt) {
            const s = this.segOf(r);
            r.sprint = r.stam > r.maxStam * 0.5 && Math.sin(this.t * 0.7 + r.lane) > 0.3;
            if (r.stumble > 0) return; // dazed: can't act until it wears off
            const sp = this.speedOf(r, s);
            if (s.type === "run" && !r.air) {
                const o = s.obs.find((o) => o.at > r.p && o.at - r.p < sp * 0.25 + 6);
                if (o && r.hopNext !== o) {
                    r.hopNext = o;
                    if (Math.random() < r.skill) this.startHop(r, 1.4);
                }
            }
            if (s.hl && r.sb) {
                // Hold going downhill and when coming down from a jump. Now and
                // then an AI gets a hill wrong and just coasts
                const i = s.hl.seg(r.sb.x);
                if (r.aiHill !== i) {
                    r.aiHill = i;
                    r.aiHillOk = Math.random() < r.skill;
                }
                const g = s.hl.at(r.sb.x);
                r.slideHold = r.aiHillOk && (r.sb.ground ? g.slope > 0.02 : r.sb.vy > 0);
            }
            if (s.type === "swim") {
                const o = s.obs.find((o) => o.at + o.w > r.p && o.at - r.p < 80);
                if (o) {
                    if (r.diveFor !== o) {
                        r.diveFor = o;
                        r.diveOk = Math.random() < r.skill;
                    }
                    r.dive = r.diveOk;
                } else {
                    r.dive = false;
                }
            }
            if (s.type === "jump" && !r.air) {
                const o = s.obs.find((o) => o.at > r.p);
                if (o) {
                    // Jump just high enough (or a little short if the AI fumbles)
                    if (r.jumpFor !== o) {
                        r.jumpFor = o;
                        r.jumpK = Math.random() < r.skill ? o.h : Math.max(1, o.h - 1);
                    }
                    const k = r.jumpK;
                    const arc = this.raceArc(r, k);
                    if (o.at - r.p < sp * arc.T * 0.5 + 4) this.startJump(r, k);
                }
            }
        }

        startHop(r, cost) {
            if (r.air) return;
            r.air = { kind: "hop", time: 0, T: 0.5, apex: 50 };
            r.stam -= cost * 0.4;
            if (r.isPlayer) PL.sfx("jump");
        }

        // Same height as training, but a fast racer spends less time in the air so
        // one jump never carries it over two walls
        raceArc(r, k) {
            const arc = PL.jumpArc(k, r.lv.jump);
            const sp = this.speedOf(r, this.segOf(r));
            const minGap = 230 * Math.max(1, this.b.lengthMult * 1.15);
            const T = Math.min(arc.T, (0.8 * minGap) / sp);
            if (T >= arc.T) return arc;
            const apex = k * UNIT + 12;
            const g = (8 * apex) / (T * T);
            return { T, g, v0: (g * T) / 2 };
        }

        startJump(r, k) {
            if (r.air) return;
            const arc = this.raceArc(r, k);
            r.air = { kind: "jump", k, time: 0, T: arc.T, g: arc.g, v0: arc.v0 };
            r.stam -= k * 0.7;
            if (r.isPlayer) PL.sfx("jump");
        }

        stumble(r, time, text) {
            r.stumble = time;
            r.stam -= 1.5;
            r.boostT = 0;
            if (r.isPlayer) {
                PL.sfx("hit");
                PL.fx.shake(6, 0.2);
                const s = this.screenOf(r);
                PL.fx.text(text, s.x, s.y - 90, { color: "#ff8a80", size: 20, life: 1.2 });
                this.burstAt(r, "#ffffff");
            }
        }

        // A clean, well-timed move gives a short burst of speed
        perfect(r, text) {
            if (r.boostT <= 0) r.boostMult = 1.25;
            r.boostT = Math.max(r.boostT, 0.7);
            if (r.isPlayer) {
                const s = this.screenOf(r);
                PL.fx.text(text || "Perfect!", s.x, s.y - 90, { color: "#fff59d", size: 20 });
                PL.fx.sparkle(s.x, s.y - 40);
            }
        }

        speedOf(r, s) {
            const stat = PL.STAT_FOR_SEGMENT[s.type];
            let sp = PL.segSpeed(s.type, r.lv[stat]);
            if (r.sprint && s.type !== "downhill") sp *= 1.3;
            if (s.type === "swim" && r.dive) sp *= 0.85;
            if (r.boostT > 0) sp *= r.boostMult;
            return sp;
        }

        advance(r, dt) {
            const s = this.segOf(r);
            const b = this.b;
            r.boostT = Math.max(0, r.boostT - dt);

            // Air time (hops and number-jumps)
            if (r.air) {
                const a = r.air;
                a.time += dt;
                if (a.kind === "hop") r.airH = Math.sin((a.time / a.T) * Math.PI) * a.apex;
                else if (a.kind === "fall") r.airH = a.from * Math.max(0, 1 - (a.time / a.T) * (a.time / a.T));
                else r.airH = a.v0 * a.time - 0.5 * a.g * a.time * a.time;
                if (a.time >= a.T) {
                    r.air = null;
                    r.airH = 0;
                }
            }

            // Stamina drain (Siberia drains fastest)
            if (s.type !== "downhill") {
                let drain = 0.55 * b.drain;
                if (r.sprint && !s.hl && s.type !== "climb") drain += 2.2;
                if (s.type === "climb") drain += 0.8;
                r.stam -= drain * dt;
            }
            if (r.stam <= 0) {
                r.stam = 0;
                if (r.isPlayer || r.remote) {
                    r.out = true;
                    if (r.isPlayer) {
                        PL.sfx("lose");
                        this.say("OUT OF STAMINA!", "#ff8a80", 2);
                    }
                    return;
                }
                r.stam = 0.01; // AI penguins are seasoned athletes and never collapse
            }

            if (r.stumble > 0) {
                r.stumble -= dt;
                return;
            }

            if (s.type === "climb") {
                this.climbStep(r, s, dt);
                return;
            }
            if (s.hl) {
                this.hillStep(r, s, dt);
                return;
            }

            const before = r.p;
            r.p += this.speedOf(r, s) * dt;

            // Boost pads
            for (const bp of s.boosts || []) {
                if (before < bp.at && r.p >= bp.at && !r.air) {
                    r.boostT = 1.2;
                    r.boostMult = 1.45;
                    if (r.isPlayer) {
                        const sc = this.screenOf(r);
                        PL.fx.text("BOOST!", sc.x, sc.y - 90, { color: "#ffca28", size: 24 });
                        PL.fx.burst(sc.x, sc.y, { n: 14, color: ["#ffca28", "#fff59d"], shape: "star", speed: 220, gravity: 0, life: 0.5 });
                        PL.sfx("power");
                    }
                }
            }

            // Obstacles are solid: hitting one bounces you back, and you have
            // to clear it properly (hop it, dive under it, duck, jump high enough)
            const sp = this.speedOf(r, s);
            if (s.type === "run") {
                for (const o of s.obs) {
                    if (!(before < o.at && r.p >= o.at)) continue;
                    if (r.airH < 22) {
                        r.p = Math.max(0, o.at - (sp * 0.45 + 20));
                        r.hopNext = null;
                        this.stumble(r, 0.5, "Bonk! Hop rocks with SPACE");
                    } else if (r.airH > 38) this.perfect(r);
                    break;
                }
            } else if (s.type === "swim") {
                for (const o of s.obs) {
                    // Can't surface while underneath a land chunk
                    if (r.p + 20 > o.at && r.p - 20 < o.at + o.w && before + 20 > o.at) r.dive = true;
                    if (r.p + 20 > o.at && before + 20 <= o.at) {
                        if (!r.dive) {
                            r.p = Math.max(0, o.at - 22 - sp * 0.2);
                            r.diveFor = null;
                            this.stumble(r, 0.6, "Bonk! Hold ↓ to dive under");
                        } else if (o.at - before < 70 && r.isPlayer) this.perfect(r, "Nice dive!");
                        break;
                    }
                }
            } else if (s.type === "jump") {
                for (const o of s.obs) {
                    if (before < o.at && r.p >= o.at) {
                        const tooLow = r.airH < o.h * UNIT - 3;
                        const tooHigh = o.ceil && r.airH + 60 > o.h * UNIT + 90;
                        if (tooLow || tooHigh) {
                            r.p = Math.max(0, o.at - (sp * 0.5 + 20));
                            // Bounce off the wall and drop to the ground
                            r.air = r.airH > 4 ? { kind: "fall", time: 0, T: 0.25, from: r.airH } : null;
                            r.jumpFor = null;
                            this.stumble(r, 0.7, tooLow ? "Too low! Press " + o.h : "Too high! Bonked the bar");
                        } else if (r.air && r.air.k === o.h) this.perfect(r);
                        break;
                    }
                }
            }

            if (r.p >= s.len) {
                const next = this.course.segs[r.seg + 1];
                // Finish the hop before moving on (and don't fly into a cliff).
                // Hills take you straight away, still in the air.
                if (!r.air || !next) this.nextSeg(r, r.p - s.len);
                else if (next.hills) {
                    r.entryAirH = r.airH;
                    this.nextSeg(r, r.p - s.len);
                    r.airH = r.entryAirH;
                } else if (next.type === "climb") r.p = s.len;
            }
        }

        // Finished a section: on to the next one (or over the finish line)
        nextSeg(r, extra) {
            const s = this.segOf(r);
            if (r.seg < this.course.segs.length - 1) {
                // Carry some speed into a slide
                r.entryS = s.type === "climb" ? 220 : s.hl && r.sb ? r.sb.s : PL.clamp(this.speedOf(r, s), 150, 450);
                r.seg++;
                // Climbs always start at the bottom of the cliff
                const ns = this.segOf(r);
                r.p = ns.type === "climb" ? 0 : Math.min(extra, ns.len - 60);
                r.air = null;
                r.airH = 0;
                r.sb = null;
                r.cj = null;
                r.ci = 0;
                r.aim = 0;
                r.aimDir = 1;
                r.climbPress = false;
                if (r.isPlayer) this.announce(this.segOf(r));
            } else {
                r.p = s.len;
                r.finished = true;
                r.finishTime = this.t;
                this.order.push(r);
                if (r.isPlayer) {
                    const place = this.order.length;
                    PL.fx.confetti(place === 1 ? 90 : 40);
                    this.say(place === 1 ? "YOU WIN!" : place + nth(place) + " place!", place === 1 ? "#ffca28" : "#ffffff", 2);
                }
            }
        }

        // ---------- Climbing: jump hold to hold ----------
        // An arrow swings above you; press SPACE when it's lined up with the
        // next hold. Higher Climbing gives a bigger target and quicker jumps.
        climbStep(r, s, dt) {
            const hs = s.holds;
            if (r.cj) {
                const j = r.cj;
                j.t += dt;
                const u = Math.min(1, j.t / j.dur);
                if (j.whiff) {
                    r.p = hs[r.ci].h + Math.sin(u * Math.PI) * 24;
                    if (u >= 1) {
                        r.cj = null;
                        r.p = hs[r.ci].h;
                    }
                } else {
                    r.p = PL.lerp(hs[j.from].h, hs[j.to].h, 1 - (1 - u) * (1 - u));
                    if (u >= 1) {
                        r.cj = null;
                        r.ci = j.to;
                        r.p = hs[r.ci].h;
                        const nx = hs[r.ci + 1];
                        r.aim = 0;
                        r.aimDir = nx && nx.dx >= hs[r.ci].dx ? 1 : -1;
                        if (r.ci >= hs.length - 1) {
                            this.nextSeg(r, 0);
                            return;
                        }
                    }
                }
                r.climbPress = false;
                return;
            }
            if (r.aim === undefined) {
                r.aim = 0;
                r.aimDir = 1;
            }
            const swing = 1.9 + this.b.tier * 0.2;
            r.aim += r.aimDir * swing * dt;
            if (r.aim > CLIMB_AIM) {
                r.aim = CLIMB_AIM;
                r.aimDir = -1;
            } else if (r.aim < -CLIMB_AIM) {
                r.aim = -CLIMB_AIM;
                r.aimDir = 1;
            }
            const cur = hs[r.ci], next = hs[r.ci + 1];
            const dist = Math.hypot(next.dx - cur.dx, next.h - cur.h);
            const diff = Math.abs(r.aim - Math.atan2(next.dx - cur.dx, next.h - cur.h));
            const tol = Math.atan2(18 + r.lv.climb * 0.5, dist);
            r.aligned = diff < tol;
            let press = false;
            if (r.isPlayer) press = r.climbPress;
            else {
                // AIs usually wait for the arrow, but sometimes jump too soon
                if (r.aiHold !== r.ci) {
                    r.aiHold = r.ci;
                    r.aiOk = Math.random() < r.skill;
                    r.aiWait = PL.rand(0.15, 0.5);
                }
                if (r.aiOk) press = diff < tol * 0.7;
                else if ((r.aiWait -= dt) <= 0) {
                    press = true;
                    r.aiOk = true;
                }
            }
            r.climbPress = false;
            if (!press) return;
            if (r.aligned) {
                const perfect = diff < tol * 0.4;
                r.cj = { from: r.ci, to: r.ci + 1, t: 0, dur: Math.max(0.16, 0.32 - r.lv.climb * 0.004) * (perfect ? 0.8 : 1) };
                r.stam -= 0.6;
                if (r.isPlayer) {
                    PL.sfx("jump");
                    if (perfect) {
                        const sc = this.screenOf(r);
                        PL.fx.text("Perfect!", sc.x, sc.y - 90, { color: "#fff59d", size: 20 });
                    }
                }
            } else {
                r.cj = { whiff: true, t: 0, dur: 0.45 };
                r.stam -= 1;
                if (r.isPlayer) {
                    PL.sfx("hit");
                    const sc = this.screenOf(r);
                    PL.fx.text("Missed! Wait for green", sc.x, sc.y - 90, { color: "#ff8a80", size: 18, life: 1.1 });
                }
            }
        }

        // ---------- Sliding: rolling hills ----------
        // Hold SPACE going down, let go going up, land smoothly on downslopes.
        hillStep(r, s, dt) {
            if (!r.sb) {
                const g = s.hl.at(r.p);
                const up = r.entryAirH || 0;
                const s0 = r.entryS || 240;
                r.sb = { x: r.p, y: g.y - up, vx: s0, vy: 0, s: s0, ground: up < 1, airT: 0 };
                r.entryAirH = 0;
                r.slideP = PL.slideParams(r.lv.slide);
                r.slideP.maxS = 780 + r.lv.slide * 12;
                // Blizzard: fresh powder makes every racer's slide 20% slicker
                if (this.mood === "blizzard" && PL.slickSlide) PL.slickSlide(r.slideP, PL.WEATHER_FX.blizzard.slide);
            }
            const B = r.sb;
            const next = this.course.segs[r.seg + 1];
            const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
            for (let i = 0; i < steps; i++) {
                const ev = PL.slideStep(B, s.hl, !!r.slideHold, dt / steps, r.slideP);
                // A cliff comes next: you can't fly into it, so drop down at its foot
                if (next && next.type === "climb" && B.x > s.len) {
                    B.x = s.len;
                    B.vx = 0;
                }
                if (ev && ev.land && r.isPlayer) {
                    const sc = this.screenOf(r);
                    if (ev.land === "perfect") {
                        PL.fx.text("Perfect landing!", sc.x, sc.y - 80, { color: "#fff59d", size: 20 });
                        PL.fx.sparkle(sc.x, sc.y - 20);
                    } else if (ev.land === "bumpy") {
                        PL.fx.text("Bumpy! Land going downhill", sc.x, sc.y - 80, { color: "#ff8a80", size: 18 });
                        PL.fx.shake(5, 0.15);
                    }
                }
            }
            r.p = B.x;
            r.airH = Math.max(0, s.hl.at(B.x).y - B.y);
            // Only move on once you've landed, so nobody snaps out of the air
            if (r.p >= s.len && B.ground) this.nextSeg(r, r.p - s.len);
        }

        announce(s) {
            if (s.finish) return; // the FINAL STRETCH banner covers it
            this.say(SEG_NAME[s.type].toUpperCase() + "!", SEG_COLOR[s.type], 1.3);
        }

        place(r) {
            if (r.out) return 5;
            const idx = this.order.indexOf(r);
            if (idx >= 0) return idx + 1;
            const ahead = this.racers.filter((o) => o !== r && (o.finished || (!o.out && this.progress(o) > this.progress(r)))).length;
            return ahead + 1;
        }

        // ---------- Drawing ----------
        draw(ctx) {
            const b = this.b;
            const cx = this.camX, cy = this.camY;
            PL.drawBackdrop(ctx, b, cx, PL.clamp(this.baseY - cy + 10, 120, 620), this.t, this.mood);

            ctx.save();
            ctx.translate(-cx, -cy);
            const segs = this.course.segs;
            for (let i = 0; i < segs.length; i++) {
                const s = segs[i];
                if (s.x1 < cx - 200 && s.type !== "climb" && !s.finish) continue;
                if (s.x0 > cx + W + 200) continue;
                this.drawSegment(ctx, s, i);
            }
            // Back lanes first, you in front
            const sorted = this.racers.slice().sort((a, c) => a.lane - c.lane);
            for (const r of sorted) this.drawRacer(ctx, r);
            this.drawPrompt(ctx);
            ctx.restore();

            if (this.me.boostT > 0) PL.drawSpeedLines(ctx, 520, this.t, 80, H - 120);
            if (PL.drawWeather) PL.drawWeather(ctx, this.mood, this.t, cx);
            this.drawHud(ctx);
        }

        // Spectator penguins cheering by the track
        drawCrowd(ctx, s) {
            const meX = this.posOf(this.me).x;
            const end = s.finish ? s.x1 + 500 : s.x1 - 60;
            for (let x = s.x0 + 140; x < end; x += 320) {
                const near = Math.abs(meX - x) < 260;
                for (let i = 0; i < 3; i++) {
                    const k = Math.floor(x / 10) + i;
                    const hop = near ? Math.abs(Math.sin(this.t * 8 + k)) * 7 : 0;
                    PL.drawPenguin(ctx, x + i * 24, s.y0 - 44 - hop, 0.42, {
                        look: { color: ["classic", "adelie", "littleblue", "emperor", "chinstrap"][k % 5] },
                        pose: near ? "cheer" : "stand",
                        t: this.t + k,
                        seed: k,
                        face: near ? "happy" : "normal"
                    });
                }
                // A little flag on a stick
                ctx.fillStyle = "#8d5a3b";
                ctx.fillRect(x + 72, s.y0 - 96, 3, 52);
                ctx.fillStyle = TAG_COLORS[Math.floor(x / 10) % TAG_COLORS.length];
                PL.poly(ctx, [x + 75, s.y0 - 96, x + 98 + Math.sin(this.t * 6 + x) * 3, s.y0 - 90, x + 75, s.y0 - 84]);
            }
        }

        // Banner arch over the track (START / FINISH), centered on x
        drawArch(ctx, x, y, text, checkered) {
            const L = x - 100, R = x + 100;
            ctx.fillStyle = "#8d5a3b";
            ctx.fillRect(L - 5, y - 150, 10, 150);
            ctx.fillStyle = "#6d4428";
            ctx.fillRect(R - 5, y - 150, 10, 150);
            // Bunting
            ctx.strokeStyle = "#8d5a3b";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(L, y - 136);
            ctx.quadraticCurveTo(x, y - 106, R, y - 136);
            ctx.stroke();
            for (let i = 0; i < 9; i++) {
                const u = (i + 0.5) / 9;
                const bx = L + u * 200;
                const by = y - 136 + Math.sin(u * Math.PI) * 15;
                ctx.fillStyle = TAG_COLORS[i % TAG_COLORS.length];
                PL.poly(ctx, [bx - 8, by, bx + 8, by, bx, by + 14]);
            }
            // Banner
            ctx.fillStyle = checkered ? "#ffffff" : "#ef5350";
            PL.roundRect(ctx, L - 14, y - 178, 228, 38, 8);
            ctx.fill();
            if (checkered) {
                ctx.fillStyle = "#222222";
                for (let i = 0; i < 22; i++) {
                    for (let j = 0; j < 2; j++) {
                        if ((i + j) % 2) ctx.fillRect(L - 10 + i * 10, y - 174 + j * 15, 10, 15);
                    }
                }
                ctx.fillStyle = "#ffca28";
                PL.roundRect(ctx, x - 62, y - 170, 124, 22, 6);
                ctx.fill();
            }
            PL.hudText(ctx, text, x, y - 159, { size: 20, align: "center", stroke: false, color: checkered ? "#3b2a1e" : "#ffffff" });
            if (checkered) {
                // Finish line on the ground
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(x - 6, y - 2, 12, 8);
                ctx.fillStyle = "#222222";
                ctx.fillRect(x - 6, y - 2, 6, 4);
                ctx.fillRect(x, y + 2, 6, 4);
            }
        }

        // Signpost at the start of each section
        drawSignpost(ctx, s) {
            const x = s.x0 + 40, y = s.y0;
            ctx.fillStyle = "#8d5a3b";
            ctx.fillRect(x - 3, y - 64, 6, 64);
            ctx.fillStyle = "#c88a52";
            PL.roundRect(ctx, x - 48, y - 100, 96, 38, 9);
            ctx.fill();
            PL.drawIcon(ctx, SEG_ICON[s.type], x - 28, y - 81, 26);
            PL.hudText(ctx, SEG_NAME[s.type], x + 12, y - 81, { size: 13, align: "center", stroke: false, color: "#fff8e1" });
        }

        drawBoosts(ctx, s) {
            for (const bp of s.boosts || []) {
                const x = s.x0 + bp.at, y = s.y0;
                ctx.fillStyle = "#3b2a1e";
                PL.roundRect(ctx, x - 42, y - 3, 84, 9, 4);
                ctx.fill();
                for (let i = 0; i < 3; i++) {
                    const lit = Math.floor(this.t * 8 - i) % 3 === 0;
                    ctx.fillStyle = lit ? "#fff59d" : "#ffb300";
                    const bx = x - 30 + i * 22;
                    PL.poly(ctx, [bx, y - 2, bx + 10, y - 2, bx + 18, y + 1.5, bx + 10, y + 5, bx, y + 5, bx + 8, y + 1.5]);
                }
            }
        }

        drawSegment(ctx, s, index) {
            const b = this.b;
            const depth = 900;
            if (s.type === "run" || s.type === "jump") {
                PL.drawGround(ctx, b, s.x0, s.y0, s.len + (s.finish ? 1200 : 1), depth, s.x0);
                this.drawCrowd(ctx, s);
                if (index === 0) this.drawArch(ctx, 200, s.y0, "START", false);
                if (s.type === "run") for (const o of s.obs) PL.drawObstacle(ctx, b.obstacle, s.x0 + o.at, s.y0, 0.8);
                if (s.type === "jump") {
                    for (const o of s.obs) PL.drawHurdle(ctx, b, s.x0 + o.at, s.y0, o.h, UNIT, o.ceil ? o.h * UNIT + 90 : 0, true);
                }
                if (s.finish) this.drawArch(ctx, s.x1, s.y0, "FINISH", true);
            } else if (s.hl) {
                this.drawHills(ctx, s);
            } else if (s.type === "swim") {
                PL.drawWater(ctx, b, s.x0, s.y0 + 2, s.len + 1, 158, this.t, s.x0);
                for (let k = 0; k * 120 < s.len - 40; k++) {
                    PL.drawSeaweed(ctx, b, s.x0 + 40 + k * 120 + PL.hash(k + s.x0) * 50, s.y0 + 162, 40 + PL.hash(k + 7) * 60, this.t, k + Math.floor(s.x0));
                }
                PL.drawGround(ctx, b, s.x0, s.y0 + 160, s.len + 1, depth, s.x0);
                for (const o of s.obs) PL.drawChunk(ctx, b, s.x0 + o.at, s.y0 - 40, o.w, s.y0 + 52, Math.floor(o.at), this.t, s.y0 + 2);
            } else if (s.type === "climb") {
                this.drawCliff(ctx, s);
            }
            this.drawBoosts(ctx, s);
            if (index > 0 && s.type !== "downhill" && s.type !== "climb" && !s.finish) this.drawSignpost(ctx, s);
        }

        // Rolling hills: the ground under the curve, a snow layer and a shiny edge
        drawHills(ctx, s) {
            const b = this.b;
            const x0 = Math.max(s.x0, this.camX - 40), x1 = Math.min(s.x1, this.camX + W + 40);
            if (x1 <= x0) return;
            const pts = [];
            for (let x = x0; x < x1; x += 10) pts.push(x, s.y0 + s.hl.at(x - s.x0).y);
            pts.push(x1, s.y0 + s.hl.at(x1 - s.x0).y);
            const bottom = Math.max(s.y0, s.y1) + 900;
            ctx.fillStyle = b.ground;
            ctx.beginPath();
            ctx.moveTo(x0, bottom);
            for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
            ctx.lineTo(x1, bottom);
            ctx.closePath();
            ctx.fill();
            const line = (dy) => {
                ctx.beginPath();
                ctx.moveTo(pts[0], pts[1] + dy);
                for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1] + dy);
                ctx.stroke();
            };
            ctx.lineJoin = "round";
            ctx.strokeStyle = PL.shade(b.ground, -12);
            ctx.lineWidth = 24;
            line(60);
            ctx.strokeStyle = b.groundTop;
            ctx.lineWidth = 16;
            line(6);
            ctx.strokeStyle = "rgba(255,255,255,0.7)";
            ctx.lineWidth = 3;
            line(-1);
            // A few pine trees along the way
            for (let k = Math.ceil((x0 - s.x0) / 260); k * 260 < x1 - s.x0; k++) {
                if (PL.hash(k + s.x0) < 0.55) continue;
                const tx = s.x0 + k * 260 + PL.hash(k * 3 + s.x0) * 80;
                if (tx > s.x1 - 20) continue;
                PL.drawPine(ctx, tx, s.y0 + s.hl.at(tx - s.x0).y + 6, 60, "#2e6b4f");
            }
        }

        // The cliff: a rock face with colored holds from the bottom to the top lip
        drawCliff(ctx, s) {
            const b = this.b;
            const L = s.x0 - 120, top = s.y1, bot = s.y0;
            ctx.fillStyle = PL.shade(b.wall, -8);
            ctx.fillRect(L, top, s.x0 - L, bot - top);
            for (let y = top, k = 0; y < bot; y += 44, k++) {
                ctx.fillStyle = PL.shade(b.wall, k % 2 ? -16 : 0);
                ctx.fillRect(L, y, s.x0 - L, Math.min(44, bot - y));
                ctx.fillStyle = PL.shade(b.wall, -26);
                PL.ell(ctx, L + 20 + PL.hash(k + s.x0) * 80, y + 22, 12, 5);
            }
            ctx.fillStyle = b.wall;
            ctx.fillRect(s.x0 - 6, top, 12, bot - top);
            ctx.fillStyle = b.groundTop;
            PL.roundRect(ctx, L - 6, top - 8, s.x0 - L + 12, 12, 6);
            ctx.fill();
            const colors = ["#ef5350", "#ffca28", "#66bb6a", "#42a5f5", "#ab47bc"];
            s.holds.forEach((h, i) => {
                if (i === 0 || i === s.holds.length - 1) return;
                const x = s.x0 + h.dx, y = s.y0 - h.h - 44;
                const c = colors[i % colors.length];
                ctx.fillStyle = PL.shade(c, -35);
                PL.ell(ctx, x, y + 3, 13, 8);
                ctx.fillStyle = c;
                PL.ell(ctx, x, y, 13, 8);
                ctx.fillStyle = "rgba(255,255,255,0.45)";
                PL.ell(ctx, x - 4, y - 2, 4, 2);
            });
            // A flag at the top
            ctx.fillStyle = "#8d5a3b";
            ctx.fillRect(s.x0 + 20, top - 46, 3, 46);
            ctx.fillStyle = "#ef5350";
            PL.poly(ctx, [s.x0 + 23, top - 46, s.x0 + 46, top - 39, s.x0 + 23, top - 32]);
        }

        drawRacer(ctx, r) {
            const s = this.segOf(r);
            const pos = this.posOf(r);
            const lane = this.laneOf(r);
            const sc = lane.scale;
            const x = pos.x;
            let y = pos.y + lane.dy;
            const opts = { look: r.look, t: this.t + r.lane, seed: r.lane };
            if (r.out) opts.alpha = 0.4;
            if (r.stumble > 0) opts.face = "hurt";
            else if (r.boostT > 0 || r.finished) opts.face = "happy";
            let headY;
            if (s.type === "swim") {
                y += (r.dive ? 85 : 20) + (r.lane - 4) * 3;
                PL.drawPenguin(ctx, x, y, sc, Object.assign(opts, { pose: "swim" }));
                headY = y - 26;
            } else if (s.type === "climb") {
                const cx = x - (4 - r.lane) * 7;
                const jumping = r.cj && !r.cj.whiff;
                PL.drawPenguin(ctx, cx, y, sc, Object.assign(opts, { pose: jumping ? "jump" : "climb", face: r.cj && r.cj.whiff ? "hurt" : opts.face }));
                headY = y - 70 * sc;
            } else if (s.hl) {
                // Belly sliding over the hills, tilted with the slope (or the flight)
                const B = r.sb;
                const g = s.hl.at(r.p);
                const airborne = r.airH > 2;
                const tilt = airborne ? (B ? Math.atan2(B.vy, B.vx) : r.netTilt != null ? r.netTilt : g.angle) : g.angle;
                const by = y - r.airH;
                ctx.save();
                ctx.translate(x, by);
                if (r.slideHold && !airborne) ctx.scale(1.08, 0.82);
                PL.drawPenguin(ctx, 0, 0, sc, Object.assign(opts, { pose: "slide", tilt, face: opts.face || "happy" }));
                ctx.restore();
                if (!airborne) {
                    ctx.fillStyle = "rgba(255,255,255,0.75)";
                    for (let i = 0; i < 3; i++) PL.circ(ctx, x - 34 - i * 9, by - 4 - PL.hash(Math.floor(this.t * 20) + i + r.lane) * 8, 3 - i * 0.6);
                }
                headY = by - 34;
            } else {
                PL.drawPenguin(ctx, x, y - r.airH, sc, Object.assign(opts, { walk: !r.air && r.stumble <= 0, pose: r.air ? "jump" : "stand", body: r }));
                headY = y - r.airH - 80 * sc;
            }
            // Boost glow trail
            if (r.boostT > 0) {
                ctx.fillStyle = "rgba(255,202,40,0.55)";
                for (let i = 0; i < 3; i++) PL.ell(ctx, x - 30 - i * 14, (s.type === "swim" ? y : y - 22 - r.airH) + Math.sin(this.t * 30 + i) * 2, 9 - i * 2, 3);
            }
            // Name badge (yours is gold with an arrow)
            const name = r.isPlayer ? "YOU" : r.name;
            const tagY = headY - 10;
            ctx.font = "800 11px 'Baloo 2', 'Trebuchet MS', sans-serif";
            const tw = ctx.measureText(name).width + 14;
            if (!r.isPlayer) ctx.globalAlpha = 0.9;
            ctx.fillStyle = r.isPlayer ? "#ffca28" : r.remote ? "#29b6f6" : r.tag;
            PL.roundRect(ctx, x - tw / 2, tagY - 9, tw, 17, 8);
            ctx.fill();
            PL.poly(ctx, [x - 5, tagY + 7, x + 5, tagY + 7, x, tagY + 13]);
            PL.hudText(ctx, name, x, tagY, { size: 11, align: "center", stroke: false, color: r.isPlayer ? "#3b2a1e" : "#ffffff" });
            ctx.globalAlpha = 1;
            if (r.stumble > 0) PL.drawIcon(ctx, "dizzy", x + tw / 2 + 12, tagY, 22);
        }

        // A bouncing key over the next thing you need to deal with
        drawPrompt(ctx) {
            const me = this.me;
            if (me.finished || me.out) return;
            const s = this.segOf(me);
            const bob = Math.sin(this.t * 7) * 4;
            if (s.type === "climb") {
                if (me.cj) return;
                // The swinging arrow from your flippers, and the hold it needs to point at
                const p = this.posOf(me);
                const ox = p.x, oy = p.y - 48;
                const dx = Math.sin(me.aim || 0), dy = -Math.cos(me.aim || 0);
                const col = me.aligned ? "#69f0ae" : "#fff59d";
                ctx.strokeStyle = col;
                ctx.lineWidth = 5;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(ox + dx * 12, oy + dy * 12);
                ctx.lineTo(ox + dx * 44, oy + dy * 44);
                ctx.stroke();
                ctx.fillStyle = col;
                const hx = ox + dx * 54, hy = oy + dy * 54;
                PL.poly(ctx, [hx + dx * 7, hy + dy * 7, hx - dy * 9 - dx * 5, hy + dx * 9 - dy * 5, hx + dy * 9 - dx * 5, hy - dx * 9 - dy * 5]);
                const next = s.holds[(me.ci || 0) + 1];
                if (next) {
                    const nx = s.x0 + next.dx, ny = s.y0 - next.h - 44;
                    ctx.strokeStyle = col;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(nx, ny, 20 + Math.sin(this.t * 12) * 2, 0, Math.PI * 2);
                    ctx.stroke();
                    PL.drawKey(ctx, "SPACE", nx - 70, ny + (me.aligned ? 0 : bob), me.aligned ? 32 : 28, me.aligned);
                }
                return;
            }
            if (s.hl) {
                // HOLD going down, LET GO going up
                const g = s.hl.at(me.p);
                const p = this.posOf(me);
                const y = p.y - me.airH;
                if (me.airH < 3 && g.slope > 0.12 && !me.slideHold) {
                    PL.drawKey(ctx, "SPACE", p.x, y - 74 + bob, 30, true);
                    PL.hudText(ctx, "HOLD", p.x, y - 104 + bob, { size: 16, align: "center", color: "#b9f6ca" });
                } else if (me.airH < 3 && g.slope < -0.12 && me.slideHold) {
                    PL.hudText(ctx, "LET GO!", p.x, y - 80 + bob, { size: 20, align: "center", color: "#ffe082" });
                }
                return;
            }
            if (!s.obs) return;
            const o = s.obs.find((o) => o.at + (o.w || 0) > me.p - 10 && o.at - me.p < 320);
            if (!o) return;
            const x = s.x0 + o.at;
            // The key turns green at the right moment to press it
            const dist = o.at - me.p, sp = this.speedOf(me, s);
            if (s.type === "jump") {
                const T = this.raceArc(me, o.h).T;
                const hot = !me.air && dist < sp * T * 0.55 + 8 && dist > sp * T * 0.2;
                PL.drawKey(ctx, String(o.h), x, s.y0 - o.h * UNIT - 50 + bob, 34, hot);
            } else if (s.type === "swim") {
                if (!me.dive) PL.drawKey(ctx, "↓", x + o.w / 2, s.y0 - 84 + bob, 32, dist < 110);
            } else {
                const hot = !me.air && dist < sp * 0.4 && dist > sp * 0.1;
                PL.drawKey(ctx, "SPACE", x, s.y0 - 70 + (hot ? 0 : bob), hot ? 34 : 30, hot);
            }
        }

        drawHud(ctx) {
            const me = this.me;
            // Progress track with section colors
            ctx.fillStyle = "rgba(20,14,8,0.45)";
            PL.roundRect(ctx, 196, 10, 568, 30, 15);
            ctx.fill();
            const total = this.course.total;
            for (const s of this.course.segs) {
                ctx.fillStyle = SEG_COLOR[s.type];
                ctx.fillRect(210 + (s.start / total) * 540, 21, (s.len / total) * 540 - 1, 8);
            }
            const dots = this.racers.slice().sort((a, c) => (a.isPlayer ? 1 : 0) - (c.isPlayer ? 1 : 0));
            for (const r of dots) {
                const fx = 210 + (Math.min(total, this.progress(r)) / total) * 540;
                ctx.fillStyle = r.isPlayer ? "#ffca28" : r.remote ? "#29b6f6" : r.tag;
                PL.circ(ctx, fx, 25, r.isPlayer ? 8 : 5);
            }

            const place = this.place(me);
            PL.hudText(ctx, place + nth(place), 20, 34, { size: 42, color: place === 1 ? "#ffca28" : "#ffffff" });
            PL.hudText(ctx, this.title, 20, 70, { size: 15 });

            const frac = me.stam / me.maxStam;
            PL.drawBar(ctx, W - 230, 16, 210, 18, frac, frac > 0.3 ? "#66bb6a" : "#ef5350", "Stamina " + Math.ceil(me.stam));
            if (frac < 0.25 && Math.floor(this.t * 4) % 2 === 0) PL.hudText(ctx, "LOW STAMINA! Stop sprinting!", W - 125, 52, { size: 14, align: "center", color: "#ff8a80" });

            // Key panel: what to press for this section, and what's next
            if (!me.finished && !me.out) {
                const s = this.segOf(me);
                const ctrls = CONTROLS[s.type] || [];
                ctx.fillStyle = "rgba(255,244,220,0.92)";
                PL.roundRect(ctx, W / 2 - 300, H - 56, 600, 44, 14);
                ctx.fill();
                PL.drawIcon(ctx, SEG_ICON[s.type], W / 2 - 274, H - 34, 28);
                let x = W / 2 - 248;
                for (const c of ctrls) {
                    if (c[0]) {
                        const kw = PL.keyWidth(ctx, c[0], 26);
                        PL.drawKey(ctx, c[0], x + kw / 2, H - 35, 26);
                        x += kw + 7;
                    }
                    PL.hudText(ctx, c[1], x, H - 34, { size: 15, color: "#3b2a1e", stroke: false });
                    x += ctx.measureText(c[1]).width + 20;
                }
                const next = this.course.segs[me.seg + 1];
                if (next) {
                    PL.hudText(ctx, "Next", W / 2 + 214, H - 34, { size: 13, color: "#8a7360", stroke: false });
                    PL.drawIcon(ctx, SEG_ICON[next.type], W / 2 + 266, H - 34, 26);
                } else {
                    PL.drawIcon(ctx, "flag", W / 2 + 266, H - 34, 26);
                }
            }

            if (this.msg) {
                ctx.globalAlpha = PL.clamp(this.msg.life * 2, 0, 1);
                PL.hudText(ctx, this.msg.text, W / 2, 104, { size: 36, align: "center", color: this.msg.color });
                ctx.globalAlpha = 1;
            }
        }
    }

    function nth(n) {
        return ["", "st", "nd", "rd", "th", "th"][n] || "th";
    }
    PL.nth = nth;
    PL.Race = Race;
})(window.PL);
