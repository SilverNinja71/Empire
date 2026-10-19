// ==========================================
// PENGUIN LIFE - Main: home screen, menus and game flow
// Home works like Duck Life: Feed on the far left, waddle right past the
// training arenas, then the Battle Grounds, and Customize at the far right.
// ==========================================
(function (PL) {
    const W = PL.W, H = PL.H;
    const GY = 440;
    const WORLD_W = 3460;
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    const $ = (id) => document.getElementById(id);

    const STATIONS = [
        { id: "feed", x: 260, name: "Feed", verb: "Feed your penguin" },
        { id: "swim", x: 720, name: "Swimming", verb: "Train Swimming" },
        { id: "waddle", x: 1130, name: "Waddling", verb: "Train Waddling" },
        { id: "climb", x: 1530, name: "Climbing", verb: "Train Climbing" },
        { id: "jump", x: 1930, name: "Jumping", verb: "Train Jumping" },
        { id: "slide", x: 2330, name: "Sliding", verb: "Train Sliding" },
        { id: "battle", x: 2820, name: "Battle Grounds", verb: "Enter the Battle Grounds" },
        { id: "custom", x: 3250, name: "Customize", verb: "Customize your penguin" }
    ];
    const SECRET_X = 70;

    const app = {
        scene: "title",
        happyT: 0,
        hx: 720,
        facing: 1,
        walking: false,
        camX: 400,
        t: 0,
        target: null,
        openOnArrive: null,
        modal: false,
        game: null,
        gameStat: null,
        race: null,
        raceInfo: null,
        phase: null,
        count: 0,
        lastNet: 0
    };

    const biome = () => PL.BIOMES[PL.account.penguin().biome] || PL.BIOMES.zoo;

    // ================= HUD (drawn on the canvas, like Duck Life) =================
    // Clickable icon buttons in the top-right corner of the home screen
    const HUD_BUTTONS = [
        { id: "account", tip: "Account" },
        { id: "daily", tip: "Daily reward" },
        { id: "stats", tip: "Stats" },
        { id: "sound", tip: "Sound" },
        { id: "mace", tip: "Mace PVP" }
    ];
    function hudButtonRects() {
        return HUD_BUTTONS.map((b, i) => ({ id: b.id, x: W - 58 - (HUD_BUTTONS.length - 1 - i) * 54, y: 12, w: 46, h: 46 }));
    }
    function drawHomeHud() {
        const prof = PL.account.cached();
        const pl = prof.penguinLife;
        // Coins + energy panel
        PL.roundRect(ctx, 12, 12, 230, 74, 14);
        PL.fo(ctx, "#fff4dc", 3);
        PL.drawCoin(ctx, 34, 34, 0);
        PL.hudText(ctx, String(prof.gold), 52, 35, { size: 22, color: "#3b2a1e", stroke: false });
        PL.hudText(ctx, biome().name, 230, 35, { size: 13, align: "right", color: "#7a6450", stroke: false });
        PL.drawBar(ctx, 24, 56, 206, 16, pl.energy / 100, pl.energy < PL.TRAIN_ENERGY_COST ? "#ef5350" : "#ffb300", "Energy " + Math.round(pl.energy));
        drawMissionsPanel(pl);
        const dailyReady = PL.progress.dailyStatus(pl).available;
        for (const r of hudButtonRects()) {
            const ready = r.id === "daily" && dailyReady;
            const bounce = ready ? -Math.abs(Math.sin(app.t * 4)) * 6 : 0;
            ctx.save();
            ctx.translate(0, bounce);
            PL.roundRect(ctx, r.x, r.y, r.w, r.h, 12);
            PL.fo(ctx, ready ? "#ffe082" : "#fff4dc");
            const icon = { sound: PL.sound.muted ? "mute" : "sound", mace: "swords", stats: "stats", daily: "chest", account: "penguin" }[r.id];
            PL.drawIcon(ctx, icon, r.x + r.w / 2, r.y + r.h / 2, 32);
            // Green dot when you're logged in
            if (r.id === "account" && window.GameAccounts && window.GameAccounts.current()) {
                ctx.fillStyle = "#43a047";
                PL.circ(ctx, r.x + r.w - 6, r.y + r.h - 6, 6);
            }
            if (ready) {
                ctx.fillStyle = "#ef5350";
                PL.circ(ctx, r.x + r.w - 4, r.y + 4, 7);
                if (Math.floor(app.t * 6) % 4 === 0) PL.fx.sparkle(r.x + PL.rand(0, r.w), r.y + PL.rand(0, r.h));
            }
            ctx.restore();
        }
    }

    // Missions board under the coins: three goals with progress bars
    const MISSION_PANEL = { x: 12, y: 94, w: 262, h: 100 };
    function drawMissionsPanel(pl) {
        const m = MISSION_PANEL;
        if (!pl.missions) return;
        PL.roundRect(ctx, m.x, m.y, m.w, m.h, 14);
        PL.fo(ctx, "#fff4dc");
        PL.drawIcon(ctx, "missions", m.x + 20, m.y + 18, 24);
        PL.hudText(ctx, "MISSIONS", m.x + 38, m.y + 19, { size: 14, color: "#7a6450", stroke: false });
        ctx.font = "700 12px 'Baloo 2', 'Trebuchet MS', sans-serif";
        pl.missions.slice(0, 3).forEach((ms, i) => {
            const y = m.y + 42 + i * 21;
            let text = PL.progress.missionText(ms);
            while (ctx.measureText(text).width > 172 && text.length > 4) text = text.slice(0, -2);
            if (text !== PL.progress.missionText(ms)) text += "…";
            PL.hudText(ctx, text, m.x + 12, y, { size: 12, weight: "700", color: "#3b2a1e", stroke: false });
            PL.drawBar(ctx, m.x + 192, y - 4, 58, 8, Math.min(1, ms.have / ms.n), "#5cb83c", "");
        });
    }
    function hudClick(x, y) {
        const m = MISSION_PANEL;
        if (x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h) {
            PL.sfx("click");
            openMissions();
            return true;
        }
        const r = hudButtonRects().find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
        if (!r) return false;
        PL.sfx("click");
        if (r.id === "account") openAccount();
        else if (r.id === "daily") openDaily();
        else if (r.id === "stats") openStats();
        else if (r.id === "sound") {
            PL.sound.muted = !PL.sound.muted;
            try { localStorage.setItem("penguin_life_sound", PL.sound.muted ? "off" : "on"); } catch (e) { /* storage blocked */ }
        } else if (r.id === "mace") window.location.href = "../mace-pvp/";
        return true;
    }

    // ================= HOVER TOOLTIPS =================
    // Point at anything on the home screen to see what it's for.
    const TIPS = {
        daily() {
            const st = PL.progress.dailyStatus(PL.account.cached().penguinLife);
            return ["Daily Reward", st.available ? "Ready! Click to claim day " + st.day + " of your streak" : "Claimed today. Come back tomorrow for more gold"];
        },
        stats: () => ["Stats", "Your penguin's skill levels, best scores and records"],
        account() {
            const c = window.GameAccounts && window.GameAccounts.current();
            return ["Account", c ? "Logged in as " + c.username + ". Switch player, log out or move devices" : "Playing as a guest. Make an account or log in"];
        },
        sound: () => ["Sound", PL.sound.muted ? "Sound is off. Click to turn it on" : "Sound is on. Click to mute it"],
        mace: () => ["Spear-Mace PVP", "Play the other game (same account and gold)"],
        missions: () => ["Missions", "Finish these goals for bonus gold. Click to see them all"],
        wallet: () => ["Gold & Energy", "Gold buys food and outfits. Training uses energy; eat to refill it"]
    };
    const STATION_TIPS = {
        feed: "Buy food to refill energy (some foods boost a skill)",
        swim: "Dive under land and outswim the predator",
        waddle: "Run, hop and duck to get away from the chaser",
        climb: "Press SPACE when the arrow points at a hold to jump to it. Don't let the danger below catch you",
        jump: "Press 1-5 to jump exactly as high as each wall",
        slide: "Hold SPACE going down hills, let go going up, and stay ahead of the seal",
        battle: "Race 4 other penguins over a mixed course. Win to unlock new places",
        custom: "Change your penguin's color, hat, scarf and glasses"
    };
    let mouse = null;
    let hover = { id: null, since: 0 };

    function hoverTarget() {
        if (!mouse || app.scene !== "home" || app.modal || PL.fx.wipe) return null;
        const { x, y } = mouse;
        const m = MISSION_PANEL;
        if (x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h) return { id: "missions", tip: TIPS.missions() };
        if (x >= 12 && x <= 242 && y >= 12 && y <= 86) return { id: "wallet", tip: TIPS.wallet(), passive: true };
        const r = hudButtonRects().find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
        if (r) return { id: r.id, tip: TIPS[r.id]() };
        const wx = x + app.camX;
        const st = STATIONS.find((o) => Math.abs(o.x - wx) < 110 && y > GY - 240 && y < GY + 24);
        if (st) {
            const skill = PL.SKILLS.find((k) => k.id === st.id);
            const title = st.name + (skill ? "  ·  Level " + PL.account.level(st.id) : "");
            return { id: st.id, tip: [title, STATION_TIPS[st.id] || st.verb] };
        }
        return null;
    }

    function drawTooltip() {
        const tg = hoverTarget();
        if (!tg) {
            hover.id = null;
            return;
        }
        if (tg.id !== hover.id) hover = { id: tg.id, since: app.t };
        const a = PL.clamp((app.t - hover.since - 0.08) * 8, 0, 1);
        if (a <= 0) return;
        const [title, text] = tg.tip;
        ctx.font = "800 15px 'Baloo 2', 'Trebuchet MS', sans-serif";
        const tw = ctx.measureText(title).width;
        ctx.font = "700 13px 'Baloo 2', 'Trebuchet MS', sans-serif";
        const w = Math.max(tw, ctx.measureText(text).width) + 24, h = 50;
        let x = mouse.x + 16, y = mouse.y + 20;
        if (x + w > W - 8) x = mouse.x - w - 10;
        if (y + h > H - 8) y = mouse.y - h - 12;
        x = PL.clamp(x, 8, W - w - 8);
        ctx.globalAlpha = a;
        ctx.fillStyle = "rgba(42,28,18,0.94)";
        PL.roundRect(ctx, x, y, w, h, 10);
        ctx.fill();
        PL.hudText(ctx, title, x + 12, y + 16, { size: 15, color: "#ffe082", stroke: false });
        PL.hudText(ctx, text, x + 12, y + 35, { size: 13, weight: "700", color: "#fff8ec", stroke: false });
        ctx.globalAlpha = 1;
    }

    canvas.addEventListener("mousemove", (e) => {
        const r = canvas.getBoundingClientRect();
        mouse = { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
        const tg = hoverTarget();
        canvas.style.cursor = app.scene === "title" || (tg && !tg.passive) ? "pointer" : "default";
    });
    canvas.addEventListener("mouseleave", () => {
        mouse = null;
    });

    // ================= MODALS =================
    function showModal(html, cls, closable) {
        app.closable = closable !== false;
        $("modal-card").className = "modal-card " + (cls || "");
        $("modal-card").innerHTML = (app.closable ? '<button class="modal-x" id="modal-x" title="Close (Esc)">' + PL.icon("close", 18) + "</button>" : "") + html;
        $("modal").classList.add("open");
        app.modal = true;
        PL.input.clear();
        const x = $("modal-x");
        if (x) x.addEventListener("click", closeModal);
    }
    function closeModal() {
        $("modal").classList.remove("open");
        app.modal = false;
        PL.input.clear();
    }
    function bind(sel, fn) {
        document.querySelectorAll(sel).forEach((el) => el.addEventListener("click", (e) => {
            PL.sfx("click");
            fn(el, e);
        }));
    }
    function esc(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    // Small canvas preview of the penguin (used in menus)
    function penguinPreview(id, look, size) {
        const cv = document.getElementById(id);
        if (!cv) return;
        const c = cv.getContext("2d");
        c.clearRect(0, 0, cv.width, cv.height);
        PL.drawPenguin(c, cv.width / 2, cv.height - 12, size || 1.6, { look, t: app.t });
    }

    // ================= FIRST LAUNCH =================
    function askPenguinName(first) {
        const pl = PL.account.penguin();
        showModal(
            "<h2>" + (first ? PL.icon("egg", 30) + " A penguin has hatched!" : "Rename your penguin") + "</h2>" +
            (first ? "<p>Welcome to <b>Penguin Life</b>! Train your penguin, feed it fish, and battle your way from the Zoo to the ends of the Earth.</p>" : "") +
            '<canvas id="pv" width="160" height="150" class="preview"></canvas>' +
            '<label>Name your penguin</label><input id="pname" maxlength="16" value="' + esc(pl.name || "Pingu") + '">' +
            (window.GameAccounts && window.GameAccounts.current()
                ? '<p class="small">Your account (<b>' + esc(PL.account.cached().username) + "</b>) and gold are shared with Spear-Mace PVP.</p>"
                : '<p class="small">Tip: make an account with the penguin button at the top right to keep your progress safe.</p>') +
            '<div class="row"><button id="pname-ok" class="btn primary">Let\'s go!</button></div>', "", !first
        );
        penguinPreview("pv", pl.look);
        bind("#pname-ok", () => {
            const v = $("pname").value.trim().slice(0, 16) || "Pingu";
            PL.account.update((p, pl2) => { pl2.name = v; });
            closeModal();
            if (first) setTimeout(openDailyIfReady, 350);
        });
    }

    // ================= FEED =================
    function openFeed() {
        const prof = PL.account.get();
        const pl = prof.penguinLife;
        showModal(
            "<h2>" + PL.icon("fish", 30) + " Feed</h2>" +
            '<div class="energy-big"><div class="bar"><i style="width:' + pl.energy + '%"></i></div><span>Energy ' + Math.round(pl.energy) + "/100 · " + PL.icon("coin", 18) + " " + prof.gold + "</span></div>" +
            '<div class="grid foods">' + PL.FOODS.map((f) =>
                '<button class="card pick food" data-id="' + f.id + '"' + (prof.gold < f.cost ? " disabled" : "") + '>' + PL.icon(f.id, 44) + "<b>" + f.name + "</b><small>" + f.desc + "</small>" +
                '<span class="price">' + f.cost + " " + PL.icon("coin", 16) + "</span></button>"
            ).join("") + "</div>", "wide"
        );
        bind(".food", (el) => feed(el.dataset.id));
    }

    function feed(id) {
        const f = PL.FOODS.find((x) => x.id === id);
        const prof = PL.account.get();
        if (prof.gold < f.cost) return;
        if (prof.penguinLife.energy >= 100 && !f.boost) {
            toast("Your penguin is full!");
            return;
        }
        let ups = 0, done = [];
        PL.account.update((p, pl) => {
            p.gold -= f.cost;
            pl.energy = Math.min(100, pl.energy + f.energy);
            if (f.boost) for (const k of Object.keys(f.boost)) ups += PL.account.addXp(pl, k, f.boost[k]);
            done = PL.progress.report(p, pl, { type: "feed" });
        });
        PL.sfx("eat");
        app.happyT = 1.2;
        if (ups) PL.sfx("levelup");
        if (done.length) {
            PL.sfx("mission");
            toast("Mission complete: " + done[0].text + " (+" + done[0].reward + " gold)");
        } else {
            toast("Yum! " + f.name + (ups ? " · Level up!" : ""));
        }
        openFeed();
    }

    // ================= TRAINING =================
    function startTraining(stat) {
        const pl = PL.account.penguin();
        if (pl.energy < PL.TRAIN_ENERGY_COST) {
            toast("Too hungry to train! Feed your penguin first.");
            return;
        }
        if (PL.fx.wipe) return;
        PL.account.update((p, pl2) => { pl2.energy -= PL.TRAIN_ENERGY_COST; });
        PL.sfx("whoosh");
        PL.fx.wipeTo(() => beginTraining(stat));
    }

    function beginTraining(stat) {
        closeModal();
        PL.fx.clear();
        app.game = new PL.TRAININGS[stat].cls({ biome: biome(), lv: PL.account.levels(), look: PL.account.penguin().look });
        app.gameStat = stat;
        app.scene = "training";
        app.phase = "count";
        app.count = 3;
        setTouchMode(stat);
    }

    function finishTraining() {
        const g = app.game;
        const res = g.result();
        app.phase = "done";
        let ups = 0, stamUps = 0, best = null, missions = [], stars = 0, starBonus = 0;
        const before = Object.assign({}, PL.account.penguin().stats[res.stat]);
        PL.account.update((p, pl) => {
            PL.progress.ensure(pl);
            stars = PL.progress.stars(res.stat, res.value);
            starBonus = stars * 5 * (1 + biome().tier);
            p.gold += res.coins + starBonus;
            ups = PL.account.addXp(pl, res.stat, res.xp);
            stamUps = PL.account.addXp(pl, "stamina", res.staminaXp);
            pl.record.trainings++;
            best = PL.progress.recordBest(pl, res.stat, res.value);
            pl.bestCombo = Math.max(pl.bestCombo || 0, res.bestCombo);
            missions = PL.progress.report(p, pl, { type: "training", stat: res.stat, value: res.value, combo: res.bestCombo, coins: res.coins, stars });
        });
        const pl = PL.account.penguin();
        const st = pl.stats[res.stat];
        const skill = PL.SKILLS.find((s) => s.id === res.stat);
        const unit = PL.progress.UNITS[res.stat];
        const need = (lv) => (lv >= PL.MAX_LEVEL ? 1 : PL.xpNeeded(lv));
        const fromFrac = before.xp / need(before.lv);
        const toFrac = st.lv >= PL.MAX_LEVEL ? 1 : st.xp / need(st.lv);

        // Celebrate the good stuff
        if (best.isNew) {
            PL.fx.banner("NEW BEST!", "#ffca28", res.value + unit);
            PL.sfx("best");
        } else if (ups) {
            PL.fx.banner("LEVEL UP!", "#69f0ae", skill.name + " " + st.lv);
            PL.sfx("levelup");
        } else {
            PL.sfx("coin");
        }
        if (best.isNew || ups || stars === 3) PL.fx.confetti(90);

        const starHtml = [0, 1, 2].map((i) => '<span class="star-slot" data-on="' + (i < stars ? 1 : 0) + '">' + PL.icon(i < stars ? "star" : "starOff", 48) + "</span>").join("");
        showModal(
            "<h2>" + PL.icon(skill.id, 30) + " Training complete!</h2>" +
            '<div class="stars">' + starHtml + "</div>" +
            '<p class="score">' + res.score + "</p>" +
            (best.isNew ? '<p class="newbest">NEW BEST!</p>' : '<p class="small">Your best: ' + (pl.best[res.stat] || res.value) + unit + "</p>") +
            '<div class="loot">' +
            "<div>" + PL.icon("coin", 26) + ' <b id="coin-up">0</b><small>coins</small></div>' +
            "<div><b>" + res.bestCombo + "</b><small>best combo</small></div>" +
            (starBonus ? "<div><b>+" + starBonus + "</b><small>star bonus</small></div>" : "") +
            "</div>" +
            '<div class="xp-row"><span>' + skill.name + "</span><b>+" + res.xp + " XP</b><span>Lv " + before.lv + " → <b>" + st.lv + "</b></span></div>" +
            '<div class="xp-bar"><i id="xp-fill" style="width:' + (fromFrac * 100).toFixed(0) + "%;background:" + skill.color + '"></i></div>' +
            '<div class="xp-row"><span>Stamina</span><b>+' + res.staminaXp + " XP</b><span>Lv <b>" + pl.stats.stamina.lv + "</b>" + (stamUps ? " (up!)" : "") + "</span></div>" +
            (ups ? '<p class="levelup">LEVEL UP! ' + skill.name + " is now level " + st.lv + "!</p>" : "") +
            missionsHtml(missions) +
            '<div class="row"><button class="btn primary" id="ok">Continue</button></div>', "", false
        );
        animateResults(res.coins + starBonus, fromFrac, toFrac, ups > 0);
        if (missions.length) setTimeout(() => PL.sfx("mission"), 900);
        bind("#ok", () => goHome());
    }

    // Stars pop in one by one, coins count up, the XP bar fills (and wraps on level up)
    function animateResults(coins, fromFrac, toFrac, leveled) {
        document.querySelectorAll(".star-slot").forEach((el, i) => {
            setTimeout(() => {
                el.classList.add("show");
                if (el.dataset.on === "1") PL.sfx("star");
            }, 250 + i * 280);
        });
        const out = $("coin-up");
        const t0 = performance.now();
        const tick = (now) => {
            const u = Math.min(1, (now - t0) / 900);
            if (out) out.textContent = Math.round(coins * u * (2 - u));
            if (u < 1 && out && out.isConnected) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        const bar = $("xp-fill");
        if (!bar) return;
        setTimeout(() => {
            bar.style.transition = "width 0.8s ease-out";
            bar.style.width = (leveled ? 100 : toFrac * 100).toFixed(0) + "%";
            if (leveled) {
                setTimeout(() => {
                    bar.style.transition = "none";
                    bar.style.width = "0%";
                    requestAnimationFrame(() => {
                        bar.style.transition = "width 0.6s ease-out";
                        bar.style.width = (toFrac * 100).toFixed(0) + "%";
                    });
                }, 850);
            }
        }, 150);
    }

    function missionsHtml(list) {
        if (!list || !list.length) return "";
        return '<div class="missions-done">' + list.map((m) =>
            '<div class="mission-row done">' + PL.icon("check", 20) + " <span>" + esc(m.text) + "</span><b>+" + m.reward + " " + PL.icon("coin", 16) + "</b></div>"
        ).join("") + "</div>";
    }

    // Back to the home screen through the circle wipe; `after` runs once you're there
    function goHome(after) {
        PL.fx.wipeTo(() => {
            enterHome();
            if (after) after();
        });
    }

    function enterHome() {
        closeModal();
        PL.fx.clear();
        app.scene = "home";
        app.game = null;
        app.race = null;
        setTouchMode("home");
    }

    // ================= BATTLE GROUNDS =================
    function winsFor(pl, id) {
        if (!pl.wins[id]) pl.wins[id] = [false, false, false, false];
        return pl.wins[id];
    }

    function openBattle(selected) {
        const prof = PL.account.get();
        const pl = prof.penguinLife;
        const sel = selected || pl.biome;
        const b = PL.BIOMES[sel];
        const wins = winsFor(pl, sel);
        const open = PL.MAIN_PATH.concat(PL.FINALS).filter((id) => pl.unlocked.includes(id));
        const tabs = open.length < 2 ? "" : '<div class="tabs">' + open.map((id) =>
            '<button class="tab' + (id === sel ? " active" : "") + '" data-b="' + id + '">' + PL.BIOMES[id].name + ((pl.wins[id] || [])[3] ? " " + PL.icon("trophy", 16) : "") + "</button>"
        ).join("") + "</div>";
        const labels = ["Race 1", "Race 2", "Race 3", PL.icon("crown", 18) + " Champion"];
        const races = labels.map((lab, i) => {
            const can = (i === 0 || wins[i - 1]) && (i < 3 || (wins[0] && wins[1] && wins[2]));
            return '<button class="card pick race' + (wins[i] ? " won" : "") + '" data-i="' + i + '"' + (can ? "" : " disabled") + "><b>" + (can ? "" : PL.icon("lock", 18) + " ") + lab + (wins[i] ? " " + PL.icon("check", 18) : "") + "</b>" +
                "<small>" + (i === 3 ? esc(b.champion.name) : "Opponents ~Lv " + b.ai[i]) + '</small><span class="price">' + b.rewards[i] + " " + PL.icon("coin", 16) + "</span></button>";
        }).join("");

        let finals = "";
        if (pl.finalsOpen) {
            const chosen = PL.FINALS.filter((id) => pl.unlocked.includes(id));
            const canChoose = chosen.length === 0 || chosen.every((id) => pl.finalsBeaten.includes(id));
            if (canChoose && chosen.length < PL.FINALS.length) {
                finals = "<h3>" + PL.icon("plane", 24) + " Pick your next destination</h3><div class='grid finals'>" +
                    PL.FINALS.filter((id) => !chosen.includes(id)).map((id) =>
                        '<button class="card pick fly" data-b="' + id + '"><b>' + PL.BIOMES[id].name + "</b><small>" + PL.BIOMES[id].desc + "</small></button>"
                    ).join("") + "</div>";
            }
        }

        showModal(
            "<h2>" + PL.icon("flag", 30) + " Battle Grounds</h2>" + tabs +
            '<p class="small">' + b.name + (b.desc ? " · " + b.desc : "") + " · Run out of stamina and you lose!</p>" +
            '<div class="grid races">' + races + "</div>" + finals +
            '<div class="row"><button class="btn friend" id="friends">' + PL.icon("friends", 22) + ' Battle a Friend</button></div>', "wide"
        );
        // Picking an area also moves your home there (like travelling in Duck Life)
        bind(".tab", (el) => {
            PL.account.update((p, pl2) => { pl2.biome = el.dataset.b; });
            openBattle(el.dataset.b);
        });
        bind(".race", (el) => startStoryRace(sel, +el.dataset.i));
        bind(".fly", (el) => {
            const id = el.dataset.b;
            PL.account.update((p, pl2) => {
                if (!pl2.unlocked.includes(id)) pl2.unlocked.push(id);
                pl2.biome = id;
            });
            toast("Welcome to " + PL.BIOMES[id].name + "!");
            openBattle(id);
        });
        bind("#friends", openFriends);
    }

    function playerDef() {
        const pl = PL.account.penguin();
        return { id: PL.net.myId || "me", name: pl.name || "You", look: pl.look, lv: PL.account.levels(), isPlayer: true };
    }

    function startStoryRace(biomeId, raceIdx) {
        const b = PL.BIOMES[biomeId];
        startRace({
            biomeId, raceIdx,
            seed: Math.floor(Math.random() * 1e9),
            player: playerDef(),
            opponents: PL.makeOpponents(biomeId, raceIdx),
            title: b.name + " · " + (raceIdx === 3 ? "Champion" : "Race " + (raceIdx + 1))
        }, { kind: "story", biomeId, raceIdx });
    }

    function startSantaRace() {
        startRace({
            biomeId: "northpole", raceIdx: 3,
            seed: 1225,
            player: playerDef(),
            opponents: PL.santaOpponents(),
            title: PL.SANTA.name
        }, { kind: "santa" });
        PL.sfx("jingle");
    }

    function startRace(opts, info) {
        PL.sfx("whoosh");
        PL.fx.wipeTo(() => {
            closeModal();
            PL.fx.clear();
            app.race = new PL.Race(opts);
            app.raceInfo = info;
            app.scene = "race";
            app.phase = "count";
            app.count = 3;
            setTouchMode("race");
        });
    }

    function finishRace() {
        const race = app.race;
        const me = race.me;
        const info = app.raceInfo;
        app.phase = "done";
        const place = race.place(me);
        const won = place === 1 && !me.out;
        let gold = 0;
        let missions = [];
        const notes = [];
        PL.account.update((p, pl) => {
            pl.record.battles++;
            if (won) pl.record.battlesWon++;
            PL.account.addXp(pl, "stamina", 10 * race.b.xpMult);
            if (info.kind === "story") {
                const b = PL.BIOMES[info.biomeId];
                const wins = winsFor(pl, info.biomeId);
                const reward = b.rewards[info.raceIdx];
                if (won) {
                    gold = wins[info.raceIdx] ? Math.round(reward / 3) : reward;
                    if (!wins[info.raceIdx]) {
                        wins[info.raceIdx] = true;
                        if (info.raceIdx < 3) notes.push("Next race unlocked!");
                        if (info.raceIdx === 3) {
                            notes.push("You beat " + b.champion.name + "!");
                            const i = PL.MAIN_PATH.indexOf(info.biomeId);
                            if (i >= 0 && i < PL.MAIN_PATH.length - 1) {
                                const next = PL.MAIN_PATH[i + 1];
                                if (!pl.unlocked.includes(next)) pl.unlocked.push(next);
                                pl.biome = next;
                                notes.push(PL.icon("map", 22) + " " + PL.BIOMES[next].name + " unlocked! Your penguin moved there.");
                            } else if (info.biomeId === "northpole") {
                                pl.finalsOpen = true;
                                notes.push(PL.icon("plane", 22) + " The world is open! Choose Iceland, Greenland, Siberia, Australia or Antarctica in the Battle Grounds.");
                            } else if (b.final) {
                                if (!pl.finalsBeaten.includes(b.id)) pl.finalsBeaten.push(b.id);
                                if (b.reward) {
                                    const slot = PL.HATS[b.reward] ? "hats" : "glasses";
                                    if (!pl.owned[slot].includes(b.reward)) pl.owned[slot].push(b.reward);
                                    notes.push(PL.icon("gift", 22) + " Unlocked: " + (PL.HATS[b.reward] || PL.GLASSES[b.reward]).name + "!");
                                }
                                if (pl.finalsBeaten.length === PL.FINALS.length && !pl.owned.colors.includes("golden")) {
                                    pl.owned.colors.push("golden");
                                    notes.push(PL.icon("star", 22) + " You conquered the whole world! Golden Legend color unlocked!");
                                } else {
                                    notes.push("Pick your next destination in the Battle Grounds.");
                                }
                            }
                        }
                    }
                } else if (place <= 3 && !me.out) {
                    gold = Math.round(reward * (place === 2 ? 0.25 : 0.1));
                }
            } else if (info.kind === "santa") {
                if (won) {
                    gold = pl.santaBeaten ? 100 : PL.SANTA.reward;
                    if (!pl.santaBeaten) {
                        pl.santaBeaten = true;
                        ["santa", "elf"].forEach((h) => { if (!pl.owned.hats.includes(h)) pl.owned.hats.push(h); });
                        notes.push(PL.icon("santa", 22) + " Santa is impressed! You unlocked the Santa Hat and Elf Hat!");
                    }
                }
            } else if (info.kind === "friend") {
                if (won) gold = 25;
            }
            p.gold += gold;
            missions = PL.progress.report(p, pl, { type: "race", place: me.out ? 9 : place, won });
        });
        PL.sfx(won ? "win" : "lose");
        if (won) {
            PL.fx.confetti(110);
            PL.fx.banner("YOU WON!", "#ffca28");
        }
        if (missions.length) setTimeout(() => PL.sfx("mission"), 600);
        const title = me.out ? PL.icon("zzz", 30) + " Out of stamina!" : won ? PL.icon("trophy", 30) + " You won!" : "You finished " + place + PL.nth(place);
        showModal(
            "<h2>" + title + "</h2>" +
            (me.out ? "<p>Your penguin collapsed from exhaustion and automatically loses. Train more to raise your <b>Stamina</b>, and don't sprint the whole way!</p>" : "") +
            (!won && !me.out ? "<p>Keep training and try again! Check which parts of the course slowed you down.</p>" : "") +
            '<div class="podium">' + standings(race) + "</div>" +
            (gold ? "<p class='gold'>" + PL.icon("coin", 20) + " +" + gold + " gold</p>" : "") +
            notes.map((n) => '<p class="levelup">' + n + "</p>").join("") +
            missionsHtml(missions) +
            '<div class="row"><button class="btn primary" id="ok">Continue</button></div>', "", false
        );
        bind("#ok", () => goHome(info.kind === "friend" ? () => openFriends(true) : null));
    }

    function standings(race) {
        const rows = race.racers.slice().sort((a, b) => race.place(a) - race.place(b));
        return rows.map((r) =>
            '<div class="stand' + (r.isPlayer ? " me" : "") + '"><b>' + (r.out ? PL.icon("zzz", 18) : race.place(r) + PL.nth(race.place(r))) + "</b> " + esc(r.name) + (r.remote && r.id !== "host" && !r.id.startsWith("ai") ? " " + PL.icon("friends", 18) : "") + "</div>"
        ).join("");
    }

    // ================= FRIEND BATTLES =================
    const lobby = { players: [], code: null, status: "" };

    function openFriends(keep) {
        if (!keep && !PL.net.connected() && PL.net.role !== "host") lobby.status = "";
        const net = PL.net;
        let body;
        if (!net.role) {
            body = "<p>Race up to 4 friends online! The host shares a room code. Empty spots are filled with AI penguins from the host's biome.</p>" +
                '<div class="row"><button class="btn primary" id="host">Host a room</button></div>' +
                '<div class="row"><input id="code" maxlength="5" placeholder="ROOM CODE" style="text-transform:uppercase"><button class="btn" id="join">Join</button></div>';
        } else if (net.role === "host") {
            body = '<p>Room code: <span class="code">' + (lobby.code || "…") + "</span></p><p class='small'>Tell your friends to open Penguin Life → Battle Grounds → Battle a Friend → Join.</p>" +
                '<div class="lobby">' + lobby.players.map((p) => "<div>" + PL.icon("penguin", 20) + " " + esc(p.name) + (p.id === "host" ? " (you)" : "") + "</div>").join("") + "</div>" +
                '<div class="row"><button class="btn primary" id="start"' + (lobby.players.length < 2 ? " disabled" : "") + ">Start battle</button></div>";
        } else {
            body = "<p>Connected! Waiting for the host to start…</p>" +
                '<div class="lobby">' + lobby.players.map((p) => "<div>" + PL.icon("penguin", 20) + " " + esc(p.name) + "</div>").join("") + "</div>";
        }
        showModal(
            "<h2>" + PL.icon("friends", 30) + " Battle a Friend</h2>" + body +
            (lobby.status ? '<p class="warn">' + esc(lobby.status) + "</p>" : "") +
            (net.role ? '<div class="row"><button class="btn" id="leave">Leave room</button></div>' : "")
        );
        bind("#host", hostRoom);
        bind("#join", () => joinRoom($("code").value.trim().toUpperCase()));
        bind("#start", hostStart);
        bind("#leave", () => {
            PL.net.close();
            lobby.players = [];
            lobby.status = "";
            openBattle();
        });
    }

    function myHello() {
        const d = playerDef();
        return { t: "hello", name: d.name, look: d.look, lv: d.lv };
    }

    function hostRoom() {
        lobby.code = PL.makeRoomCode();
        lobby.status = "Opening room…";
        const d = playerDef();
        lobby.players = [{ id: "host", name: d.name, look: d.look, lv: d.lv }];
        openFriends(true);
        PL.net.host(lobby.code, () => {
            lobby.status = "";
            if (app.modal) openFriends(true);
        }, (err) => {
            lobby.status = err;
            PL.net.close();
            if (app.modal) openFriends(true);
        });
    }

    function joinRoom(code) {
        if (code.length < 4) return;
        lobby.status = "Connecting…";
        openFriends(true);
        PL.net.join(code, () => {
            lobby.status = "";
            PL.net.send(myHello());
            openFriends(true);
        }, (err) => {
            lobby.status = err;
            PL.net.close();
            if (app.modal && app.scene === "home") openFriends(true);
        });
    }

    function broadcastLobby() {
        PL.net.send({ t: "lobby", players: lobby.players.map((p) => ({ id: p.id, name: p.name })) });
    }

    function hostStart() {
        const biomeId = PL.account.penguin().biome;
        const humans = lobby.players.slice(0, 5);
        const ais = PL.makeOpponents(biomeId, 2).slice(0, 5 - humans.length).map((a, i) => Object.assign(a, { id: "ai" + i }));
        const msg = { t: "start", seed: Math.floor(Math.random() * 1e9), biomeId, humans, ais };
        PL.net.send(msg);
        startFriendRace(msg);
    }

    function startFriendRace(msg) {
        const myId = PL.net.myId;
        const isHost = PL.net.role === "host";
        const me = msg.humans.find((h) => h.id === myId) || msg.humans[0];
        const others = msg.humans.filter((h) => h !== me).map((h) => ({ id: h.id, name: h.name, look: h.look, lv: h.lv, remote: true }));
        const ais = msg.ais.map((a) => Object.assign({}, a, { remote: !isHost }));
        startRace({
            biomeId: msg.biomeId, raceIdx: 2, seed: msg.seed,
            player: { id: me.id, name: me.name, look: me.look, lv: me.lv, isPlayer: true },
            opponents: others.concat(ais),
            title: "Friend Battle · " + PL.BIOMES[msg.biomeId].name,
            online: true
        }, { kind: "friend", biomeId: msg.biomeId });
    }

    PL.net.on("msg", (m, from) => {
        const net = PL.net;
        if (net.role === "host") {
            if (m.t === "hello") {
                if (!lobby.players.find((p) => p.id === from) && lobby.players.length < 5) {
                    lobby.players.push({ id: from, name: String(m.name).slice(0, 16), look: m.look, lv: m.lv });
                }
                broadcastLobby();
                if (app.modal && app.scene === "home") openFriends(true);
            } else if (m.t === "pos" && app.race && app.race.opts.online) {
                m.id = from;
                PL.applyRacer(app.race, m);
            }
        } else {
            if (m.t === "lobby") {
                lobby.players = m.players;
                if (app.modal && app.scene === "home") openFriends(true);
            } else if (m.t === "full") {
                lobby.status = "That room is full.";
                net.close();
                if (app.modal) openFriends(true);
            } else if (m.t === "start") {
                startFriendRace(m);
            } else if (m.t === "state" && app.race && app.race.opts.online) {
                m.list.forEach((s) => PL.applyRacer(app.race, s));
            }
        }
    });
    PL.net.on("leave", (id) => {
        if (PL.net.role === "host") {
            lobby.players = lobby.players.filter((p) => p.id !== id);
            broadcastLobby();
            if (app.race && app.race.opts.online) {
                const r = app.race.racers.find((x) => x.id === id);
                if (r) r.out = true;
            }
            if (app.modal && app.scene === "home") openFriends(true);
        } else {
            lobby.status = "The host left the room.";
            PL.net.close();
            if (app.race && app.race.opts.online) app.race.racers.forEach((r) => { if (r.remote) r.out = true; });
            if (app.modal && app.scene === "home") openFriends(true);
        }
    });

    function netTick(now) {
        const race = app.race;
        if (!race || !race.opts.online || now - app.lastNet < 66) return;
        app.lastNet = now;
        if (PL.net.role === "host") {
            PL.net.send({ t: "state", list: race.racers.map(PL.packRacer) });
        } else {
            PL.net.send(Object.assign({ t: "pos" }, PL.packRacer(race.me)));
        }
    }

    // ================= CUSTOMIZE =================
    let customTab = "colors";
    function openCustom() {
        const prof = PL.account.get();
        const pl = prof.penguinLife;
        const lists = { colors: PL.COLORS, hats: PL.HATS, scarves: PL.SCARVES, glasses: PL.GLASSES };
        const lookKey = { colors: "color", hats: "hat", scarves: "scarf", glasses: "glasses" };
        const list = lists[customTab];
        const items = Object.keys(list).filter((id) => list[id].cost !== -1 || pl.owned[customTab].includes(id) || list[id].secret).map((id) => {
            const it = list[id];
            const owned = pl.owned[customTab].includes(id);
            const on = pl.look[lookKey[customTab]] === id;
            const locked = it.cost === -1 && !owned;
            const tag = on ? "Wearing" : owned ? "Owned" : locked ? PL.icon("lock", 16) + " Secret" : it.cost + " " + PL.icon("coin", 16);
            const disabled = on || locked || (!owned && prof.gold < it.cost);
            return '<button class="card pick item' + (on ? " on" : "") + '" data-id="' + id + '"' + (disabled ? " disabled" : "") + (locked ? ' title="' + esc(it.secret || "") + '"' : "") +
                '><canvas class="mini" data-id="' + id + '" width="90" height="100"></canvas><b>' + it.name + '</b><span class="price">' + tag + "</span></button>";
        }).join("");
        showModal(
            "<h2>" + PL.icon("palette", 30) + " Customize</h2>" +
            '<canvas id="pv" width="160" height="170" class="preview"></canvas>' +
            '<div class="tabs">' + ["colors", "hats", "scarves", "glasses"].map((k) => '<button class="tab' + (k === customTab ? " active" : "") + '" data-t="' + k + '">' + k[0].toUpperCase() + k.slice(1) + "</button>").join("") + "</div>" +
            '<div class="grid items">' + items + "</div>" +
            '<p class="small">' + PL.icon("coin", 18) + " " + prof.gold + " gold</p>", "wide"
        );
        penguinPreview("pv", pl.look, 1.7);
        document.querySelectorAll("canvas.mini").forEach((cv) => {
            const look = Object.assign({}, pl.look);
            look[lookKey[customTab]] = cv.dataset.id;
            PL.drawPenguin(cv.getContext("2d"), 45, 92, 0.95, { look });
        });
        bind(".tab", (el) => {
            customTab = el.dataset.t;
            openCustom();
        });
        bind(".item", (el) => {
            const id = el.dataset.id;
            const it = list[id];
            const owned = PL.account.penguin().owned[customTab].includes(id);
            if (!owned) {
                if (PL.account.get().gold < it.cost) return;
                PL.sfx("coin");
            }
            PL.account.update((p, pl2) => {
                if (!owned) {
                    p.gold -= it.cost;
                    pl2.owned[customTab].push(id);
                }
                pl2.look[lookKey[customTab]] = id;
            });
            openCustom();
        });
    }

    // ================= STATS =================
    function openStats() {
        const prof = PL.account.get();
        const pl = prof.penguinLife;
        const rows = PL.SKILLS.map((s) => {
            const st = pl.stats[s.id];
            const frac = st.lv >= PL.MAX_LEVEL ? 1 : st.xp / PL.xpNeeded(st.lv);
            return '<div class="statrow"><span>' + PL.icon(s.id, 20) + " " + s.name + '</span><div class="xp-bar"><i style="width:' + (frac * 100).toFixed(0) + "%;background:" + s.color + '"></i></div><b>Lv ' + st.lv + "</b></div>";
        }).join("");
        showModal(
            '<h2 class="clickable" id="rename" title="Rename">' + esc(pl.name || "Your penguin") + " " + PL.icon("pencil", 24) + "</h2>" +
            '<canvas id="pv" width="160" height="150" class="preview"></canvas>' +
            '<div class="statlist">' + rows + "</div>" +
            '<p class="small">Battles won: ' + pl.record.battlesWon + " / " + pl.record.battles + " · Trainings: " + pl.record.trainings + "</p>" +
            '<p class="small">Account: <b class="clickable" id="uname" title="Change username">' + esc(prof.username) + " " + PL.icon("pencil", 16) + "</b> · shared with <a href=\"../mace-pvp/\">Spear-Mace PVP</a></p>" +
            '<div class="row"><button class="btn small" id="acct-open">' + (window.GameAccounts && window.GameAccounts.current() ? "Account settings" : "Make an account / Log in") + "</button></div>"
        );
        bind("#acct-open", () => openAccount());
        bind("#rename", () => askPenguinName(false));
        bind("#uname", () => {
            const v = prompt("New username (shared with Mace PVP):", prof.username);
            if (v === null) return;
            const err = PL.account.setUsername(v);
            if (err) toast(err);
            openStats();
        });
    }

    // ================= ACCOUNT =================
    // Make an account, log in, switch players, and move to another device with
    // a transfer code. Accounts are shared with Spear-Mace PVP (shared/accounts.js);
    // after any change the page reloads so everything picks up the right save.
    function openAccount(view, opts) {
        const A = window.GameAccounts;
        if (!A) {
            showModal("<h2>Account</h2><p>Accounts aren't available in this copy of the game.</p>");
            return;
        }
        opts = opts || {};
        const cur = A.current();
        view = view || (cur ? "me" : "guest");
        const others = A.list().filter((a) => !cur || a.key !== cur.key);
        const chips = (list) => (list.length ? '<div class="row">' + list.map((a) => '<button class="btn small chip" data-u="' + esc(a.username) + '">' + PL.icon("penguin", 16) + " " + esc(a.username) + "</button>").join("") + "</div>" : "");
        const err = '<p class="warn" id="acct-err"></p>';
        const back = '<button class="btn" id="acct-back">Back</button>';
        let html = "";
        if (view === "guest") {
            html = "<h2>" + PL.icon("penguin", 30) + " Account</h2>" +
                "<p>You're playing as a <b>guest</b>. Make an account to keep your penguin safe, give everyone on this computer their own penguin, and move to another device.</p>" +
                '<div class="row"><button class="btn primary big" id="acct-signup">Make an account</button></div>' +
                '<div class="row"><button class="btn" id="acct-login">Log in</button><button class="btn" id="acct-import">Use a transfer code</button></div>' +
                (others.length ? '<p class="small">Accounts on this device:</p>' + chips(others) : "") +
                '<p class="small">Your account works in Spear-Mace PVP too.</p>';
        } else if (view === "me") {
            html = "<h2>" + PL.icon("penguin", 30) + " " + esc(cur.username) + "</h2>" +
                "<p>You're logged in. Your progress saves to this account by itself.</p>" +
                '<div class="row"><button class="btn primary" id="acct-export">Move to another device</button></div>' +
                '<div class="row"><button class="btn" id="acct-login">Switch player</button><button class="btn" id="acct-signup">New account</button><button class="btn" id="acct-logout">Log out</button></div>' +
                (others.length ? '<p class="small">Other accounts on this device:</p>' + chips(others) : "");
        } else if (view === "signup") {
            const guestName = !cur ? PL.account.get().username : "";
            html = "<h2>Make an account</h2>" +
                '<label>Username</label><input id="acct-name" maxlength="16" autocomplete="username" value="' + esc(opts.name || (guestName && guestName !== "Steve" ? guestName : "")) + '">' +
                '<label>Password</label><input id="acct-pass" type="password" maxlength="64" autocomplete="new-password">' +
                '<label>Password again</label><input id="acct-pass2" type="password" maxlength="64" autocomplete="new-password">' +
                (!cur ? '<label class="check"><input type="checkbox" id="acct-keep" checked> Keep the progress I have now</label>' : '<p class="small">The new account starts fresh.</p>') +
                err + '<div class="row">' + back + '<button class="btn primary" id="acct-go">Create account</button></div>' +
                "<p class=\"small\">Pick a password you'll remember. Only a scrambled copy is saved, on this device.</p>";
        } else if (view === "login") {
            html = "<h2>Log in</h2>" + chips(others) +
                '<label>Username</label><input id="acct-name" maxlength="16" autocomplete="username" value="' + esc(opts.name || "") + '">' +
                '<label>Password</label><input id="acct-pass" type="password" maxlength="64" autocomplete="current-password">' +
                err + '<div class="row">' + back + '<button class="btn primary" id="acct-go">Log in</button></div>' +
                (cur ? "" : '<p class="small">Your guest progress is kept for when you log out.</p>');
        } else if (view === "export") {
            html = "<h2>Move to another device</h2>" +
                "<p>Copy this code. On the other computer, open Penguin Life (or Mace PVP), go to <b>Account</b>, choose <b>Use a transfer code</b>, paste it and type your password.</p>" +
                '<textarea id="acct-code" readonly rows="5">Making your code...</textarea>' + err +
                '<div class="row">' + back + '<button class="btn primary" id="acct-copy">Copy code</button></div>' +
                '<p class="small">The code only works with your password. After moving, each device keeps its own progress.</p>';
        } else if (view === "import") {
            html = "<h2>Use a transfer code</h2>" +
                '<textarea id="acct-code" rows="5" placeholder="Paste the code here"></textarea>' +
                '<label>Password for that account</label><input id="acct-pass" type="password" maxlength="64" autocomplete="current-password">' +
                err + '<div class="row">' + back + '<button class="btn primary" id="acct-go">Add account</button></div>';
        }
        showModal(html, "acct");
        const say = (t) => {
            const e = $("acct-err");
            if (e) e.textContent = t || "";
        };
        const busy = (on) => {
            const b = $("acct-go");
            if (b) b.disabled = on;
        };
        bind("#acct-signup", () => openAccount("signup"));
        bind("#acct-login", () => openAccount("login"));
        bind("#acct-import", () => openAccount("import"));
        bind("#acct-export", () => openAccount("export"));
        bind("#acct-back", () => openAccount());
        bind(".chip", (el) => openAccount("login", { name: el.dataset.u }));
        bind("#acct-logout", () => {
            if (!confirm("Log out of " + cur.username + "? Your progress stays saved in the account.")) return;
            A.logOut();
            location.reload();
        });
        if (view === "signup") {
            bind("#acct-go", async () => {
                const name = $("acct-name").value, p1 = $("acct-pass").value, p2 = $("acct-pass2").value;
                const e = A.checkName(name) || A.checkPassword(p1) || (p1 !== p2 ? "The two passwords don't match." : null);
                if (e) return say(e);
                busy(true);
                say("");
                const r = await A.signUp(name, p1, !!($("acct-keep") && $("acct-keep").checked));
                busy(false);
                if (!r.ok) return say(r.error);
                location.reload();
            });
        } else if (view === "login") {
            bind("#acct-go", async () => {
                busy(true);
                say("");
                const r = await A.logIn($("acct-name").value, $("acct-pass").value);
                busy(false);
                if (!r.ok) return say(r.error);
                location.reload();
            });
        } else if (view === "export") {
            A.exportCode().then((r) => {
                if (r.ok) $("acct-code").value = r.code;
                else say(r.error);
            });
            bind("#acct-copy", () => {
                const ta = $("acct-code");
                ta.select();
                const done = () => toast("Code copied!");
                if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done, () => document.execCommand("copy") && done());
                else if (document.execCommand("copy")) done();
            });
        } else if (view === "import") {
            const go = async (replace) => {
                busy(true);
                say("");
                const r = await A.importCode($("acct-code").value, $("acct-pass").value, replace);
                busy(false);
                if (r.needConfirm) {
                    if (confirm("There's already an account called " + r.username + " on this device. Replace it with the one from the code?")) return go(true);
                    return;
                }
                if (!r.ok) return say(r.error);
                location.reload();
            };
            bind("#acct-go", () => go(false));
        }
        // Enter submits; start typing in the first empty box
        document.querySelectorAll("#modal-card input").forEach((el) => el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && $("acct-go")) $("acct-go").click();
        }));
        const boxes = Array.from(document.querySelectorAll("#modal-card input:not([type=checkbox]), #modal-card textarea:not([readonly])"));
        const first = boxes.find((el) => !el.value) || boxes[0];
        if (first) setTimeout(() => first.focus(), 30);
    }

    // ================= DAILY REWARD =================
    function openDaily() {
        const pl = PL.account.get().penguinLife;
        const s = PL.progress.dailyStatus(pl);
        const pos = s.day > 0 ? ((s.day - 1) % 7) + 1 : 0; // today's spot in the week
        const days = PL.DAILY_REWARDS.map((g, i) => {
            const d = i + 1;
            const claimed = s.available ? d < pos : d <= pos;
            const today = s.available && d === pos;
            return '<div class="day' + (claimed ? " claimed" : "") + (today ? " today" : "") + '"><small>Day ' + d + "</small>" +
                PL.icon(d === 7 ? "chest" : "coin", 30) + "<b>" + g + "</b>" + (claimed ? PL.icon("check", 18, "tick") : "") + "</div>";
        }).join("");
        const reward = s.available ? PL.DAILY_REWARDS[pos - 1] : 0;
        showModal(
            "<h2>" + PL.icon("chest", 30) + " Daily Reward</h2>" +
            "<p>" + (s.available
                ? "Come back every day to grow your streak. Day 7 also fills up your energy!"
                : "You've already claimed today. Come back tomorrow for Day " + ((pos % 7) + 1) + "!") + "</p>" +
            '<div class="days">' + days + "</div>" +
            (s.available ? '<div class="row"><button class="btn primary big" id="claim">Claim ' + reward + " gold!</button></div>" : ""),
            "wide"
        );
        bind("#claim", claimDaily);
    }

    function claimDaily() {
        let res = null;
        PL.account.update((p, pl) => { res = PL.progress.claimDaily(p, pl); });
        if (!res) return;
        closeModal();
        PL.sfx("chest");
        PL.fx.confetti(80);
        PL.fx.banner("+" + res.gold + " GOLD", "#ffca28", "Day " + res.day + " streak!" + (res.refill ? " Energy refilled!" : ""));
        for (let i = 0; i < 14; i++) setTimeout(() => PL.fx.flyCoin(W / 2 + PL.rand(-80, 80), H / 2 + PL.rand(-30, 40), 34, 34), i * 60);
    }

    function openDailyIfReady() {
        if (PL.progress.dailyStatus(PL.account.get().penguinLife).available) openDaily();
    }

    // ================= MISSIONS =================
    function openMissions() {
        const pl = PL.account.get().penguinLife;
        const rows = pl.missions.map((m) => {
            const pct = Math.min(100, (m.have / m.n) * 100).toFixed(0);
            return '<div class="mission-row"><span>' + esc(PL.progress.missionText(m)) + "</span>" +
                '<div class="xp-bar"><i style="width:' + pct + '%;background:#5cb83c"></i></div>' +
                "<b>" + Math.min(m.have, m.n) + "/" + m.n + "</b><b class=\"rw\">+" + m.reward + " " + PL.icon("coin", 16) + "</b></div>";
        }).join("");
        showModal(
            "<h2>" + PL.icon("missions", 30) + " Missions</h2>" +
            '<p class="small">Finish missions to earn gold. Each time you finish one, a new one appears.</p>' +
            '<div class="mission-list">' + rows + "</div>" +
            '<p class="small">Missions finished: <b>' + (pl.missionsDone || 0) + "</b> · Best combo ever: <b>" + (pl.bestCombo || 0) + "</b></p>"
        );
    }

    // ================= SECRET =================
    function openSecret() {
        const pl = PL.account.penguin();
        showModal(
            "<h2>" + PL.icon("santa", 30) + " Ho ho ho!</h2>" +
            "<p>You found a glowing present hidden in the snow… and out pops <b>Santa Claus</b> with three of his fastest elves!</p>" +
            "<p>\"Think your penguin is fast? Race my sleigh team!\"</p>" +
            "<p class='small'>Santa and the elves are around level " + PL.SANTA.racers[0].level + ". " + (pl.santaBeaten ? "You've already beaten Santa once." : "Win to unlock secret hats and " + PL.SANTA.reward + " gold!") + "</p>" +
            '<div class="row"><button class="btn primary" id="go">Race Santa!</button></div>'
        );
        bind("#go", startSantaRace);
    }

    // ================= HOME SCENE =================
    function nearStation() {
        if (biome().id === "northpole" && Math.abs(app.hx - SECRET_X) < 50) return { id: "secret", verb: "Open the glowing present" };
        return STATIONS.find((s) => Math.abs(s.x - app.hx) < 80) || null;
    }

    function openStation(id) {
        PL.sfx("click");
        if (id === "feed") openFeed();
        else if (id === "battle") openBattle();
        else if (id === "custom") openCustom();
        else if (id === "secret") openSecret();
        else startTraining(id);
    }

    function updateHome(dt) {
        const I = PL.input;
        app.happyT = Math.max(0, app.happyT - dt);
        updateNpcs(dt);
        let dir = 0;
        if (I.down("left")) dir -= 1;
        if (I.down("right")) dir += 1;
        if (dir) app.target = null;
        if (app.target !== null) {
            const d = app.target - app.hx;
            if (Math.abs(d) < 6) {
                app.target = null;
                if (app.openOnArrive) {
                    const id = app.openOnArrive;
                    app.openOnArrive = null;
                    openStation(id);
                }
            } else {
                dir = Math.sign(d);
            }
        }
        app.walking = dir !== 0;
        if (dir) {
            app.facing = dir;
            app.hx = PL.clamp(app.hx + dir * 280 * dt, 40, WORLD_W - 60);
        }
        const target = PL.clamp(app.hx - W / 2, 0, WORLD_W - W);
        app.camX = PL.lerp(app.camX, target, Math.min(1, dt * 5));
        if (I.hit("action")) {
            const st = nearStation();
            if (st) openStation(st.id);
        }
    }

    function sign(x, y, text, sub) {
        PL.drawSign(ctx, x, y, GY, text, sub);
    }

    // Small helpers so the buildings read like the rest of the cartoon art
    function box(x, y, w, h, fill, r) {
        PL.roundRect(ctx, x, y, w, h, r || 3);
        PL.fo(ctx, fill, 3);
    }

    function drawStation(st, x, b, t) {
        const pl = PL.account.penguin();
        const best = pl.best && pl.best[st.id] ? " · Best " + pl.best[st.id] + PL.progress.UNITS[st.id] : "";
        const lvl = pl.stats[st.id] ? "Lv " + pl.stats[st.id].lv + best : null;
        switch (st.id) {
            case "feed": {
                // Fish market stall with a striped awning
                box(x - 82, GY - 168, 10, 168, "#a1683f");
                box(x + 72, GY - 168, 10, 168, "#a1683f");
                box(x - 88, GY - 74, 176, 74, "#c88a52", 4);
                ctx.fillStyle = "#b07440";
                for (let i = 0; i < 3; i++) ctx.fillRect(x - 84, GY - 56 + i * 18, 168, 3);
                box(x - 94, GY - 82, 188, 12, "#e0a46c", 4);
                // Ice tray with fish
                box(x - 70, GY - 98, 140, 18, "#e3f2fd", 4);
                PL.drawFish(ctx, x - 40, GY - 96, 0.85, 1, "#90a4ae", 0);
                PL.drawFish(ctx, x, GY - 98, 0.85, -1, "#ffb74d", 0);
                PL.drawFish(ctx, x + 40, GY - 96, 0.85, 1, "#ef9a9a", 0);
                for (let i = 0; i < 7; i++) {
                    ctx.beginPath();
                    const ax = x - 98 + i * 28;
                    ctx.moveTo(ax, GY - 182);
                    ctx.lineTo(ax + 28, GY - 182);
                    ctx.lineTo(ax + 28, GY - 152);
                    ctx.quadraticCurveTo(ax + 14, GY - 140, ax, GY - 152);
                    ctx.closePath();
                    PL.fo(ctx, i % 2 ? "#ffffff" : "#29a3e6", 3);
                }
                sign(x, GY - 214, "FEED", "Energy " + Math.round(pl.energy));
                break;
            }
            case "swim": {
                // Pool sunk into the ground with a diving board
                box(x - 130, GY - 8, 260, 12, "#e0e6ea", 4);
                PL.drawWater(ctx, b, x - 118, GY + 4, 236, 64, t, x);
                ctx.strokeStyle = PL.OUT;
                ctx.lineWidth = 3;
                ctx.strokeRect(x - 118, GY + 4, 236, 64);
                PL.drawPredator(ctx, b.predator, x + 80 + Math.sin(t) * 20, GY + 40, 0.28, t);
                box(x - 160, GY - 44, 80, 9, "#ffffff", 4);
                box(x - 160, GY - 44, 10, 44, "#90a4ae");
                sign(x + 40, GY - 120, "SWIMMING", lvl);
                break;
            }
            case "waddle": {
                // Running track with a checkered start arch
                box(x - 135, GY - 2, 270, 18, "#e0794a", 4);
                ctx.fillStyle = "#fff";
                for (let i = 0; i < 6; i++) ctx.fillRect(x - 122 + i * 45, GY + 5, 24, 4);
                box(x - 96, GY - 150, 12, 150, "#90a4ae");
                box(x + 84, GY - 150, 12, 150, "#90a4ae");
                box(x - 100, GY - 166, 200, 22, "#ffffff", 4);
                for (let i = 0; i < 10; i++) {
                    ctx.fillStyle = i % 2 ? "#222" : "#fff";
                    ctx.fillRect(x - 97 + i * 19.4, GY - 163 + (i % 2) * 8, 19.4, 8);
                    ctx.fillStyle = i % 2 ? "#fff" : "#222";
                    ctx.fillRect(x - 97 + i * 19.4, GY - 163 + ((i + 1) % 2) * 8, 19.4, 8);
                }
                PL.drawObstacle(ctx, b.obstacle, x + 40, GY, 0.8);
                sign(x - 30, GY - 72, "WADDLING", lvl);
                break;
            }
            case "climb": {
                PL.polyP(ctx, [x - 72, GY, x - 56, GY - 252, x + 50, GY - 268, x + 76, GY]);
                PL.fo(ctx, b.wall, 3);
                const holds = ["#e53935", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"];
                for (let i = 0; i < 14; i++) {
                    PL.circP(ctx, x - 44 + PL.hash(i) * 88, GY - 22 - PL.hash(i + 20) * 220, 7);
                    PL.fo(ctx, holds[i % 5], 2.5);
                }
                ctx.strokeStyle = PL.OUT;
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.moveTo(x + 10, GY - 264);
                ctx.lineTo(x + 10, GY);
                ctx.stroke();
                ctx.strokeStyle = "#f2d29b";
                ctx.lineWidth = 3;
                ctx.stroke();
                sign(x + 125, GY - 100, "CLIMBING", lvl);
                break;
            }
            case "jump": {
                for (let k = 1; k <= 5; k++) PL.drawHurdle(ctx, b, x - 130 + k * 44, GY, k, 22, 0, false);
                for (let k = 1; k <= 5; k++) PL.hudText(ctx, String(k), x - 130 + k * 44, GY - k * 22 - 20, { size: 16, align: "center", color: "#ffeb3b" });
                sign(x + 130, GY - 110, "JUMPING", lvl);
                break;
            }
            case "slide": {
                // Ice slide: a tower with a ladder and a curving chute down to the ground
                box(x - 112, GY - 150, 12, 150, "#a1683f", 2);
                box(x - 64, GY - 150, 12, 150, "#a1683f", 2);
                ctx.fillStyle = "#c88a52";
                for (let i = 1; i < 7; i++) ctx.fillRect(x - 100, GY - i * 21, 36, 4);
                box(x - 118, GY - 160, 72, 12, "#c88a52", 4);
                ctx.fillStyle = "#b3e5fc";
                ctx.beginPath();
                ctx.moveTo(x - 52, GY - 160);
                ctx.quadraticCurveTo(x + 20, GY - 150, x + 50, GY - 60);
                ctx.quadraticCurveTo(x + 70, GY - 10, x + 120, GY - 6);
                ctx.lineTo(x + 120, GY + 4);
                ctx.quadraticCurveTo(x + 62, GY + 2, x + 38, GY - 56);
                ctx.quadraticCurveTo(x + 10, GY - 136, x - 52, GY - 146);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255,0.8)";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x - 48, GY - 156);
                ctx.quadraticCurveTo(x + 18, GY - 146, x + 46, GY - 58);
                ctx.stroke();
                // A penguin zooming down now and then
                const ph = (t * 0.45) % 1;
                if (ph < 0.5) {
                    const u = ph / 0.5;
                    const px = PL.lerp(x - 40, x + 130, u);
                    const py = u < 0.6 ? PL.lerp(GY - 160, GY - 30, u / 0.6) : GY - 12;
                    PL.drawPenguin(ctx, px, py, 0.5, { look: { color: "littleblue" }, pose: "slide", t, tilt: u < 0.6 ? 0.7 : 0, face: "happy" });
                }
                sign(x + 20, GY - 196, "SLIDING", lvl);
                break;
            }
            case "battle": {
                // Stadium stands full of cheering penguins
                PL.polyP(ctx, [x - 175, GY, x - 135, GY - 125, x + 135, GY - 125, x + 175, GY]);
                PL.fo(ctx, "#b0bec5", 3);
                ctx.fillStyle = "#90a4ae";
                for (let r = 0; r < 4; r++) ctx.fillRect(x - 160 + r * 10, GY - 30 - r * 28, 320 - r * 20, 6);
                const cols = ["#e53935", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"];
                for (let i = 0; i < 5; i++) {
                    const fx = x - 120 + i * 60;
                    box(fx - 2, GY - 182, 5, 58, "#78909c", 2);
                    PL.polyP(ctx, [fx + 3, GY - 182, fx + 32 + Math.sin(t * 4 + i) * 4, GY - 173, fx + 3, GY - 164]);
                    PL.fo(ctx, cols[i], 2.5);
                }
                for (let i = 0; i < 12; i++) {
                    const cxp = x - 125 + i * 23, cyp = GY - 44 - (i % 3) * 28 - Math.abs(Math.sin(t * 5 + i)) * 3;
                    PL.ellP(ctx, cxp, cyp, 7, 10);
                    PL.fo(ctx, "#263238", 2);
                    ctx.fillStyle = "#fff";
                    PL.ell(ctx, cxp + 2, cyp + 2, 4, 6);
                }
                sign(x, GY - 216, "BATTLE GROUNDS", biome().name);
                break;
            }
            case "custom": {
                // Igloo wardrobe
                ctx.beginPath();
                ctx.arc(x, GY, 98, Math.PI, 0);
                ctx.closePath();
                PL.fo(ctx, "#f5f9fc", 3);
                ctx.strokeStyle = "#c5d7e6";
                ctx.lineWidth = 2;
                for (let r = 1; r < 4; r++) {
                    const yy = GY - r * 24;
                    const half = Math.sqrt(98 * 98 - (r * 24) ** 2) - 3;
                    ctx.beginPath();
                    ctx.moveTo(x - half, yy);
                    ctx.lineTo(x + half, yy);
                    ctx.stroke();
                }
                ctx.beginPath();
                ctx.arc(x, GY, 34, Math.PI, 0);
                ctx.closePath();
                PL.fo(ctx, "#37474f", 3);
                ctx.fillStyle = "#e91e63";
                PL.star(ctx, x + 62, GY - 112, 11, 5, 5);
                ctx.strokeStyle = PL.OUT;
                ctx.lineWidth = 2.5;
                ctx.stroke();
                sign(x, GY - 140, "CUSTOMIZE");
                break;
            }
        }
    }

    // Other penguins wandering around the home path. They hop and say hi as you pass.
    const NPCS = [];
    const NPC_LOOKS = [
        { color: "adelie", hat: "beanie", scarf: "none", glasses: "none" },
        { color: "littleblue", hat: "none", scarf: "red", glasses: "none" },
        { color: "emperor", hat: "none", scarf: "none", glasses: "sunglasses" },
        { color: "rockhopper", hat: "flower", scarf: "none", glasses: "none" }
    ];
    const NPC_HI = ["Hi!", "Go train!", "Nice hat!", "Waddle on!", "Fish?", "Race you!"];
    function npcs() {
        if (!NPCS.length) {
            [480, 1330, 2100, 3040].forEach((x, i) => NPCS.push({ x, home: x, dir: i % 2 ? -1 : 1, wait: PL.rand(0, 2), hop: 0, seed: i * 1.7, look: NPC_LOOKS[i] }));
        }
        return NPCS;
    }
    function updateNpcs(dt) {
        for (const n of npcs()) {
            n.hop = Math.max(0, n.hop - dt);
            if (n.wait > 0) n.wait -= dt;
            else {
                n.x += n.dir * 55 * dt;
                if (Math.abs(n.x - n.home) > 130) n.dir = Math.sign(n.home - n.x);
                if (Math.random() < dt * 0.3) {
                    n.wait = PL.rand(0.8, 2.6);
                    n.dir = Math.random() < 0.5 ? -1 : 1;
                }
            }
            const near = Math.abs(app.hx - n.x) < 70;
            if (near && !n.greeted) {
                n.greeted = true;
                n.hop = 0.5;
                PL.fx.text(NPC_HI[Math.floor(Math.random() * NPC_HI.length)], n.x - app.camX, GY - 96, { size: 16, color: "#fff8e1", life: 1.2, rise: 30 });
            }
            if (Math.abs(app.hx - n.x) > 240) n.greeted = false;
        }
    }
    function drawNpcs(cx) {
        for (const n of npcs()) {
            const sx = n.x - cx;
            if (sx < -60 || sx > W + 60) continue;
            const hopY = n.hop > 0 ? Math.sin(((0.5 - n.hop) / 0.5) * Math.PI) * 26 : 0;
            ctx.fillStyle = "rgba(0,0,0,0.15)";
            PL.ell(ctx, sx, GY + 3, 20, 5);
            PL.drawPenguin(ctx, sx, GY - hopY, 0.82, { look: n.look, walk: n.wait <= 0 && n.hop <= 0, facing: n.hop > 0 ? Math.sign(app.hx - n.x) || 1 : n.dir, t: app.t + n.seed, seed: n.seed, face: n.hop > 0 ? "happy" : "normal", pose: n.hop > 0 ? "cheer" : "stand" });
        }
    }

    // Birds, butterflies and snow so the world feels alive
    function drawAmbient(b, cx, t) {
        if (["zoo", "australia", "iceland", "greenland"].includes(b.id)) {
            ctx.strokeStyle = "#455a64";
            ctx.lineWidth = 2.5;
            ctx.lineCap = "round";
            for (let i = 0; i < 4; i++) {
                const x = ((t * (34 + i * 7) + i * 330) % (W + 160)) - 80;
                const y = 70 + i * 26 + Math.sin(t * 1.3 + i) * 10;
                const f = Math.sin(t * 9 + i * 2);
                ctx.beginPath();
                ctx.moveTo(x - 10, y - f * 6);
                ctx.quadraticCurveTo(x - 4, y - 2, x, y);
                ctx.quadraticCurveTo(x + 4, y - 2, x + 10, y - f * 6);
                ctx.stroke();
            }
        }
        if (b.id === "zoo" || b.id === "australia") {
            const cols = ["#ff80ab", "#fff176", "#80deea", "#ffab91"];
            for (let i = 0; i < 5; i++) {
                const sx = 300 + i * 700 + Math.sin(t * 0.6 + i) * 90 - cx;
                if (sx < -20 || sx > W + 20) continue;
                const y = GY - 46 - Math.abs(Math.sin(t * 1.7 + i)) * 34;
                const w = Math.abs(Math.sin(t * 14 + i));
                ctx.fillStyle = cols[i % 4];
                PL.ell(ctx, sx - 4 * w, y, 5 * w + 0.5, 6, -0.3);
                PL.ell(ctx, sx + 4 * w, y, 5 * w + 0.5, 6, 0.3);
                ctx.fillStyle = "#3e2723";
                PL.ell(ctx, sx, y, 1.2, 4);
            }
        }
        if (["arctic", "greenland", "antarctica"].includes(b.id)) {
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            for (let i = 0; i < 45; i++) {
                const x = (((PL.hash(i) * W + t * 14 - cx * 0.5) % W) + W) % W;
                const y = (PL.hash(i + 50) * H + t * 30) % H;
                PL.circ(ctx, x, y, 1.6 + PL.hash(i + 9) * 1.4);
            }
        }
    }

    function drawHome() {
        const b = biome();
        const t = app.t;
        const cx = app.camX;
        const mood = PL.homeMood(b);
        PL.drawBackdrop(ctx, b, cx, GY, t, mood);
        PL.drawGround(ctx, b, 0, GY, W, H - GY, cx);
        drawAmbient(b, cx, t);

        for (const st of STATIONS) {
            const sx = st.x - cx;
            if (sx < -260 || sx > W + 260) continue;
            drawStation(st, sx, b, t);
        }
        // Secret present at the North Pole
        if (b.id === "northpole") {
            const sx = SECRET_X - cx;
            if (sx > -60 && sx < W + 60) {
                PL.roundRect(ctx, sx - 14, GY - 26, 28, 26, 3);
                PL.fo(ctx, "#c62828", 3);
                ctx.fillStyle = "#ffd54f";
                ctx.fillRect(sx - 3, GY - 25, 6, 24);
                ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4);
                ctx.fillStyle = "#fff59d";
                PL.star(ctx, sx + 16, GY - 36, 6, 2.5, 4);
                PL.star(ctx, sx - 18, GY - 20, 4, 2, 4);
                ctx.globalAlpha = 1;
            }
        }

        drawNpcs(cx);

        // Penguin
        const px = app.hx - cx;
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        PL.ell(ctx, px, GY + 4, 26, 6);
        PL.drawPenguin(ctx, px, GY + (app.walking ? 0 : Math.sin(t * 3) * 0.6), 1.1, { look: PL.account.penguin().look, walk: app.walking, facing: app.facing, t, face: app.happyT > 0 ? "happy" : "normal", pose: app.happyT > 0 ? "cheer" : "stand" });
        PL.hudText(ctx, PL.account.penguin().name || "", px, GY - 90, { size: 14, align: "center" });

        PL.drawWeather(ctx, mood, t, cx);
        const st = !app.modal && nearStation();
        if (st) {
            PL.hudText(ctx, (isTouch() ? "Tap ● to " : "SPACE: ") + st.verb, W / 2, H - 30, { size: 20, align: "center", box: "#fff4dc", stroke: false, color: "#3b2a1e" });
        }
        drawHomeHud();
        drawTooltip();
    }

    canvas.addEventListener("click", (e) => {
        if (app.scene === "title") {
            startFromTitle();
            return;
        }
        if (app.scene !== "home" || app.modal) return;
        const r = canvas.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * W;
        if (hudClick(x, ((e.clientY - r.top) / r.height) * H)) return;
        const wx = x + app.camX;
        if (biome().id === "northpole" && Math.abs(wx - SECRET_X) < 40) {
            app.target = SECRET_X;
            app.openOnArrive = "secret";
            return;
        }
        const st = STATIONS.find((s) => Math.abs(s.x - wx) < 120);
        if (st) {
            app.target = st.x;
            app.openOnArrive = st.id;
        } else {
            app.target = PL.clamp(wx, 40, WORLD_W - 60);
            app.openOnArrive = null;
        }
    });

    // ================= TITLE SCREEN =================
    const PARADE = [
        { color: "classic", hat: "party", scarf: "none", glasses: "none" },
        { color: "littleblue", hat: "beanie", scarf: "blue", glasses: "none" },
        { color: "emperor", hat: "crown", scarf: "none", glasses: "none" }
    ];
    function drawTitle() {
        const b = biome();
        const t = app.t;
        const scroll = t * 40;
        const mood = PL.homeMood(b);
        PL.drawBackdrop(ctx, b, scroll, GY, t, mood);
        PL.drawGround(ctx, b, 0, GY, W, H - GY, scroll);
        drawAmbient(b, scroll, t);
        // A little parade waddling past
        for (let i = 0; i < 3; i++) {
            const x = ((t * 70 + i * 360) % (W + 240)) - 120;
            ctx.fillStyle = "rgba(0,0,0,0.15)";
            PL.ell(ctx, x, GY + 3, 18, 4);
            PL.drawPenguin(ctx, x, GY, 0.75, { look: PARADE[i], walk: true, t: t + i, seed: i });
        }
        // Your penguin, front and center
        const cheer = Math.sin(t * 1.6) > 0.7;
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        PL.ell(ctx, W / 2, GY + 4, 40, 8);
        PL.drawPenguin(ctx, W / 2, GY - (cheer ? Math.abs(Math.sin(t * 8)) * 16 : 0), 1.9, { look: PL.account.penguin().look, t, pose: cheer ? "cheer" : "stand", face: cheer ? "happy" : "normal" });

        PL.drawWeather(ctx, mood, t, scroll);
        // Bouncing logo, letter by letter
        const word = "PENGUIN LIFE";
        ctx.font = "800 86px 'Baloo 2', 'Trebuchet MS', sans-serif";
        const widths = [...word].map((ch) => ctx.measureText(ch).width);
        let x = W / 2 - widths.reduce((a, c) => a + c, 0) / 2;
        [...word].forEach((ch, i) => {
            const y = 120 + Math.sin(t * 3 + i * 0.45) * 8;
            PL.hudText(ctx, ch, x + widths[i] / 2, y, { size: 86, align: "center", color: i < 7 ? "#ffffff" : "#ffd54f" });
            x += widths[i];
        });
        PL.hudText(ctx, "Train it · Feed it · Race the world", W / 2, 186, { size: 22, align: "center", color: "#fff8e1" });
        if (Math.floor(t * 2) % 2 === 0) {
            PL.hudText(ctx, (isTouch() ? "Tap" : "Click or press SPACE") + " to play", W / 2, H - 46, { size: 24, align: "center", box: "#fff4dc", stroke: false, color: "#3b2a1e" });
        }
        const who = window.GameAccounts && window.GameAccounts.current();
        PL.hudText(ctx, who ? "Playing as " + who.username : "Playing as a guest", 20, H - 22, { size: 15, color: "#fff8e1" });
        if (PL.progress.dailyStatus(PL.account.cached().penguinLife).available) {
            PL.drawIcon(ctx, "chest", W - 150, H - 46, 34);
            PL.hudText(ctx, "Daily reward!", W - 128, H - 46, { size: 16, color: "#ffe082" });
        }
    }

    function startFromTitle() {
        if (app.scene !== "title" || PL.fx.wipe) return;
        PL.sfx("go");
        PL.fx.wipeTo(() => {
            enterHome();
            const pl = PL.account.penguin();
            if (!pl.name) askPenguinName(true);
            else setTimeout(openDailyIfReady, 350);
        });
    }

    // ================= TOUCH CONTROLS =================
    function isTouch() {
        return window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    }
    const TOUCH_SETS = {
        home: ["left", "right", "action"],
        swim: ["up", "down"],
        waddle: ["up", "down", "action"],
        climb: ["action"],
        jump: ["1", "2", "3", "4", "5"],
        slide: ["action"],
        race: ["up", "down", "sprint", "action", "1", "2", "3", "4", "5"]
    };
    const TOUCH_LABEL = { left: "◀", right: "▶", up: "▲", down: "▼", action: "●", sprint: "»", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5" };
    function setTouchMode(mode) {
        const el = $("touch");
        if (!isTouch()) {
            el.innerHTML = "";
            return;
        }
        el.innerHTML = TOUCH_SETS[mode].map((k) => '<button data-k="' + k + '" class="tbtn' + (/\d/.test(k) ? " num" : "") + '">' + TOUCH_LABEL[k] + "</button>").join("");
        el.querySelectorAll(".tbtn").forEach((b) => {
            const k = b.dataset.k;
            b.addEventListener("pointerdown", (e) => { e.preventDefault(); PL.input.press(k); });
            ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => PL.input.release(k)));
        });
    }

    // ================= TOAST =================
    let toastTimer = null;
    function toast(text) {
        const el = $("toast");
        el.textContent = text;
        el.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
    }

    // ================= MAIN LOOP =================
    function drawCountdown() {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(0, 0, W, H);
        const n = Math.ceil(app.count);
        PL.hudText(ctx, n > 0 ? String(n) : "GO!", W / 2, H / 2 - 20, { size: 90, align: "center", color: "#ffeb3b" });
        const hint = app.scene === "training" ? app.game.hint : "WADDLE: SPACE hops · → sprints (uses stamina!)";
        PL.hudText(ctx, hint, W / 2, H / 2 + 60, { size: 18, align: "center" });
    }

    let last = performance.now();
    let lastBeep = 4;
    // One frame of game logic and drawing (frame() below schedules the next one)
    function step(now) {
        // Clamp to 0..50 ms so a stalled or out-of-order clock can't run time backwards
        const realDt = PL.clamp((now - last) / 1000, 0, 0.05);
        last = Math.max(last, now);
        app.t += realDt;
        PL.fx.update(realDt);
        // Hit-stop: freeze the action for a split second on big hits
        const dt = PL.fx.stopT > 0 ? 0 : realDt;
        const off = PL.fx.offset();
        ctx.save();
        ctx.translate(off[0], off[1]);

        if (app.scene === "title") {
            if (!app.modal && (PL.input.hit("action") || PL.input.hit("up"))) startFromTitle();
            drawTitle();
        } else if (app.scene === "home") {
            if (!app.modal) updateHome(realDt);
            drawHome();
        } else {
            const thing = app.scene === "training" ? app.game : app.race;
            if (app.phase === "count") {
                app.count -= realDt;
                if (Math.ceil(app.count) !== lastBeep) {
                    lastBeep = Math.ceil(app.count);
                    PL.sfx(lastBeep > 0 ? "beep" : "go");
                }
                if (app.count <= 0) app.phase = "play";
                thing.draw(ctx);
                drawCountdown();
            } else if (app.phase === "play") {
                if (PL.input.hit("esc") && app.scene === "training") thing.over = true;
                if (PL.input.hit("esc") && app.scene === "race" && !app.race.opts.online) app.race.me.out = true;
                if (dt > 0) thing.update(dt);
                thing.draw(ctx);
                if (app.scene === "race") netTick(now);
                if (thing.over) {
                    if (app.scene === "training") finishTraining();
                    else finishRace();
                }
            } else {
                // Keep sending our final state so friends see us finish
                if (app.scene === "race") netTick(now);
                thing.draw(ctx);
            }
        }
        PL.fx.draw(ctx);
        ctx.restore();
        PL.fx.drawWipe(ctx);
        if (app.modal) {
            const pv = document.getElementById("pv");
            if (pv) penguinPreview("pv", PL.account.penguin().look, pv.width > 150 ? 1.7 : 1.6);
        }
        PL.input.endFrame();
    }

    function frame(now) {
        step(now);
        requestAnimationFrame(frame);
    }

    // ================= BOOT =================
    $("modal").addEventListener("click", (e) => {
        if (e.target.id === "modal" && app.closable) closeModal();
    });
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && app.modal && app.closable) closeModal();
    });

    // Make sure missions and the daily streak exist (and are saved) before drawing them
    PL.account.update((p, pl) => PL.progress.ensure(pl));
    setTouchMode("home");
    requestAnimationFrame(frame);

    // Handy for testing from the console
    PL.app = app;
    // step(now) runs a single frame by hand (useful for testing while the tab is in the background)
    PL.debug = { step, startTraining, beginTraining, startStoryRace, startSantaRace, goHome, enterHome, startFromTitle, openDaily, openMissions, app: () => app };
})(window.PL);
