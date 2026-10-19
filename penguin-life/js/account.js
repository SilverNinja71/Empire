// ==========================================
// PENGUIN LIFE - Shared account
// Uses the same saved profile as Spear-Mace PVP ("spear_mace_user_profile"),
// so your username, Google sign-in and gold are shared between both games.
// The penguin's progress is stored inside that profile under `penguinLife`.
// ==========================================
(function (PL) {
    const STORAGE_KEY = "spear_mace_user_profile";

    function defaultPenguin() {
        const stats = {};
        PL.SKILLS.forEach((s) => { stats[s.id] = { lv: 1, xp: 0 }; });
        return {
            name: "",
            stats,
            energy: 100,
            biome: "zoo",
            unlocked: ["zoo"],
            wins: {},
            finalsBeaten: [],
            santaBeaten: false,
            look: { color: "classic", hat: "none", scarf: "none", glasses: "none" },
            owned: { colors: ["classic"], hats: ["none"], scarves: ["none"], glasses: ["none"] },
            record: { trainings: 0, battles: 0, battlesWon: 0 }
        };
    }

    // Enough fields that Spear-Mace PVP can open a profile Penguin Life created first
    function defaultProfile() {
        return {
            id: "guest_" + Math.random().toString(36).substring(2, 8),
            username: "Steve",
            email: null,
            avatarType: "preset",
            avatarVal: "steve",
            avatarUrl: null,
            authProvider: "guest",
            level: 1,
            xp: 0,
            gold: 300,
            arenaRP: 250,
            isMinor: false,
            stats: {
                matches: 0, wins: 0, losses: 0, slamsLanded: 0, dashesLanded: 0,
                maxSlamDamage: 0, kills: 0, damageDealt: 0, currentStreak: 0, bestStreak: 0
            }
        };
    }

    function backfill(p) {
        if (p.gold === undefined) p.gold = 300;
        const def = defaultPenguin();
        if (!p.penguinLife) p.penguinLife = def;
        const pl = p.penguinLife;
        // Hunting was replaced by Sliding: keep the levels you earned
        if (pl.stats && pl.stats.hunt) {
            if (!pl.stats.slide) pl.stats.slide = pl.stats.hunt;
            delete pl.stats.hunt;
        }
        if (pl.best && pl.best.hunt !== undefined) delete pl.best.hunt;
        for (const k of Object.keys(def)) if (pl[k] === undefined) pl[k] = def[k];
        PL.SKILLS.forEach((s) => { if (!pl.stats[s.id]) pl.stats[s.id] = { lv: 1, xp: 0 }; });
        for (const k of Object.keys(def.owned)) if (!pl.owned[k]) pl.owned[k] = def.owned[k];
        for (const k of Object.keys(def.look)) if (!pl.look[k]) pl.look[k] = def.look[k];
        return p;
    }

    function readRaw() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    let cache = null;
    const listeners = [];

    PL.account = {
        // Latest profile (re-read from storage so changes from the Mace PVP tab are never lost)
        get() {
            let p = readRaw();
            if (!p) p = defaultProfile();
            cache = backfill(p);
            return cache;
        },
        // Cached copy for drawing every frame
        cached() {
            return cache || this.get();
        },
        penguin() {
            return this.cached().penguinLife;
        },
        // Read-modify-write so we never overwrite what the other game saved
        update(fn) {
            const p = this.get();
            fn(p, p.penguinLife);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
            } catch (e) {
                console.error("Could not save profile:", e);
            }
            cache = p;
            listeners.forEach((cb) => cb(p));
            return p;
        },
        onChange(cb) {
            listeners.push(cb);
        },
        level(stat) {
            return this.penguin().stats[stat].lv;
        },
        levels() {
            const out = {};
            PL.SKILLS.forEach((s) => { out[s.id] = this.penguin().stats[s.id].lv; });
            return out;
        },
        // Adds XP and returns how many levels were gained
        addXp(pl, stat, amount) {
            const s = pl.stats[stat];
            const before = s.lv;
            s.xp += Math.max(0, Math.round(amount));
            while (s.lv < PL.MAX_LEVEL && s.xp >= PL.xpNeeded(s.lv)) {
                s.xp -= PL.xpNeeded(s.lv);
                s.lv++;
            }
            if (s.lv >= PL.MAX_LEVEL) s.xp = 0;
            return s.lv - before;
        },
        setUsername(name) {
            // When you're logged in, your username is your account's name
            if (window.GameAccounts && window.GameAccounts.current()) return "Your username is your account name. Make a new account to use a different one.";
            const trimmed = (name || "").trim();
            if (trimmed.length < 2 || trimmed.length > 16 || !/^[a-zA-Z0-9_ ]+$/.test(trimmed)) {
                return "Use 2-16 letters, numbers, spaces or underscores.";
            }
            this.update((p) => { p.username = trimmed; });
            return null;
        }
    };

    // Another tab (Penguin Life or Mace PVP) saved the profile
    window.addEventListener("storage", (e) => {
        if (e.key !== STORAGE_KEY) return;
        const p = PL.account.get();
        listeners.forEach((cb) => cb(p));
    });
})(window.PL);
