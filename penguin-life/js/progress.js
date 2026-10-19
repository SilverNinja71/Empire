// ==========================================
// PENGUIN LIFE - Progress hooks
// Missions (always three to work on), a daily reward with a streak,
// personal bests and 1-3 star ratings for every training run.
// All of it is saved in the shared profile under penguinLife.
// ==========================================
(function (PL) {
    // Score needed for 1, 2 and 3 stars in each training
    const STAR_GOALS = {
        swim: [300, 700, 1200],
        waddle: [400, 900, 1500],
        climb: [60, 150, 280],
        jump: [6, 14, 24],
        slide: [250, 900, 1800]
    };
    const UNITS = { swim: "m", waddle: "m", climb: "m", jump: " walls", slide: "m" };

    // Daily reward for day 1..7 of a streak (day 7 repeats after that)
    PL.DAILY_REWARDS = [30, 45, 60, 80, 100, 130, 250];

    // Mission types. "run" missions need the number in a single run;
    // "count" missions add up over time.
    const MISSIONS = [
        { id: "swim", text: "Swim {n} m in one run", kind: "run", n: [300, 500, 800, 1200], reward: 50 },
        { id: "waddle", text: "Waddle {n} m in one run", kind: "run", n: [300, 600, 1000, 1500], reward: 50 },
        { id: "climb", text: "Climb {n} m in one run", kind: "run", n: [40, 90, 150, 230], reward: 50 },
        { id: "jump", text: "Clear {n} walls in one run", kind: "run", n: [5, 9, 14, 20], reward: 50 },
        { id: "slide", text: "Slide {n} m in one run", kind: "run", n: [200, 500, 900, 1400], reward: 50 },
        { id: "combo", text: "Get a {n} combo", kind: "run", n: [6, 10, 16, 25], reward: 60 },
        { id: "coins", text: "Grab {n} coins in one training", kind: "run", n: [8, 15, 25, 40], reward: 60 },
        { id: "stars", text: "Get 3 stars in a training", kind: "run", n: [3, 3, 3, 3], reward: 80 },
        { id: "trainings", text: "Finish {n} trainings", kind: "count", n: [2, 3, 5, 7], reward: 45 },
        { id: "feed", text: "Feed your penguin {n} times", kind: "count", n: [1, 2, 3, 4], reward: 30 },
        { id: "top3", text: "Finish top 3 in {n} battles", kind: "count", n: [1, 2, 2, 3], reward: 80 },
        { id: "win", text: "Win a battle", kind: "count", n: [1, 1, 1, 1], reward: 100 }
    ];

    function today(offsetDays) {
        const d = new Date();
        if (offsetDays) d.setDate(d.getDate() + offsetDays);
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }

    // Harder missions as the penguin gets stronger
    function tierFor(pl) {
        const lv = PL.SKILLS.reduce((s, k) => s + pl.stats[k.id].lv, 0) / PL.SKILLS.length;
        return PL.clamp(Math.floor(lv / 8), 0, 3);
    }

    function newMission(pl, avoid) {
        const pool = MISSIONS.filter((m) => !avoid.includes(m.id));
        const def = pool[Math.floor(Math.random() * pool.length)];
        const tier = tierFor(pl);
        const biomeTier = (PL.BIOMES[pl.biome] || PL.BIOMES.zoo).tier;
        return {
            id: def.id,
            n: def.n[tier],
            have: 0,
            reward: Math.round((def.reward + tier * 25) * (1 + biomeTier * 0.5))
        };
    }

    const P = {
        STAR_GOALS,
        UNITS,
        MISSIONS,

        // Make sure all the progress fields exist on an older save
        ensure(pl) {
            if (!pl.best) pl.best = {};
            if (!pl.bestCombo) pl.bestCombo = 0;
            if (!pl.daily) pl.daily = { last: "", streak: 0 };
            if (!Array.isArray(pl.missions)) pl.missions = [];
            // Drop missions for things that no longer exist (like the old Hunting)
            pl.missions = pl.missions.filter((m) => MISSIONS.some((d) => d.id === m.id));
            if (!pl.missionsDone) pl.missionsDone = 0;
            while (pl.missions.length < 3) pl.missions.push(newMission(pl, pl.missions.map((m) => m.id)));
            return pl;
        },

        missionText(m) {
            const def = MISSIONS.find((d) => d.id === m.id);
            return def ? def.text.replace("{n}", m.n) : m.id;
        },

        stars(stat, value) {
            const g = STAR_GOALS[stat];
            if (!g) return 0;
            return g.filter((v) => value >= v).length;
        },

        // Record a run; returns { isNew, prev }
        recordBest(pl, stat, value) {
            const prev = pl.best[stat] || 0;
            if (value > prev) pl.best[stat] = value;
            return { isNew: value > prev && prev > 0, first: prev === 0 && value > 0, prev };
        },

        // Apply an event to the missions. Pays out finished ones and replaces them.
        // event: { type: "training", stat, value, combo, coins, stars }
        //        { type: "race", place, won }  |  { type: "feed" }
        report(p, pl, e) {
            P.ensure(pl);
            const done = [];
            for (const m of pl.missions) {
                const def = MISSIONS.find((d) => d.id === m.id);
                if (!def) continue;
                let v = null;
                if (e.type === "training") {
                    if (def.id === e.stat) v = e.value;
                    else if (def.id === "combo") v = e.combo;
                    else if (def.id === "coins") v = e.coins;
                    else if (def.id === "stars") v = e.stars;
                    else if (def.id === "trainings") v = 1;
                } else if (e.type === "race") {
                    if (def.id === "top3" && e.place <= 3) v = 1;
                    if (def.id === "win" && e.won) v = 1;
                } else if (e.type === "feed" && def.id === "feed") {
                    v = 1;
                }
                if (v === null) continue;
                if (def.kind === "count") m.have += v;
                else m.have = Math.max(m.have, v);
                if (m.have >= m.n) {
                    m.complete = true;
                    done.push({ text: P.missionText(m), reward: m.reward });
                    p.gold += m.reward;
                    pl.missionsDone++;
                }
            }
            if (done.length) {
                // Replace finished missions with new ones (not the same kind straight away)
                const finished = pl.missions.filter((m) => m.complete).map((m) => m.id);
                const keep = pl.missions.filter((m) => !m.complete);
                while (keep.length < 3) keep.push(newMission(pl, keep.map((m) => m.id).concat(finished)));
                pl.missions = keep;
            }
            return done;
        },

        // { available, day } where day is the streak day you'd get (1..7)
        dailyStatus(pl) {
            P.ensure(pl);
            const d = pl.daily;
            if (d.last === today()) return { available: false, day: d.streak };
            const day = d.last === today(-1) ? d.streak + 1 : 1;
            return { available: true, day };
        },

        claimDaily(p, pl) {
            const s = P.dailyStatus(pl);
            if (!s.available) return null;
            // The week of rewards repeats; every 7th day also fills your penguin up
            const slot = (s.day - 1) % 7;
            const gold = PL.DAILY_REWARDS[slot];
            pl.daily = { last: today(), streak: s.day };
            p.gold += gold;
            if (slot === 6) pl.energy = 100;
            return { gold, day: s.day, refill: slot === 6 };
        }
    };

    PL.progress = P;
})(window.PL);
