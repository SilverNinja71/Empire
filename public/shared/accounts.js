// ==========================================
// Player accounts, shared by Spear-Mace PVP and Penguin Life
//
// Accounts are kept in this browser. Each one has a username, a password
// (only a salted hash of it is stored) and that player's saved progress.
// The account you're logged in to is simply the normal shared profile
// ("spear_mace_user_profile") that both games already read and write, so
// neither game has to know about the others.
//
// A transfer code moves an account to another computer or browser.
//
// Trophies (GameAccounts.trophies) are milestones from any game on the site,
// worked out from that same shared profile: reach Gold tier in Spear-Mace PVP
// or beat a champion in Penguin Life and you unlock a badge and a title that
// every game can show. They're kept per player in "spear_mace_trophies".
// ==========================================
(function () {
    "use strict";
    const PROFILE_KEY = "spear_mace_user_profile";
    const ACCOUNTS_KEY = "spear_mace_accounts";
    const ITERATIONS = 120000;
    const CODE_PREFIX = "PLACC1:";

    function readJSON(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }
    function writeJSON(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }
    function load() {
        const s = readJSON(ACCOUNTS_KEY);
        return s && s.accounts ? s : { accounts: {}, active: null, guest: null };
    }
    function save(s) {
        writeJSON(ACCOUNTS_KEY, s);
    }
    const keyOf = (name) => String(name || "").trim().toLowerCase();

    function checkName(name) {
        const n = String(name || "").trim();
        if (n.length < 2 || n.length > 16 || !/^[a-zA-Z0-9_ ]+$/.test(n)) return "Usernames are 2-16 letters, numbers, spaces or underscores.";
        return null;
    }
    function checkPassword(p) {
        if (!p || p.length < 4) return "Passwords need at least 4 characters.";
        if (p.length > 64) return "That password is too long (64 characters at most).";
        return null;
    }

    // ---------- Password hashing (PBKDF2 + SHA-256 with a random salt) ----------
    const toHex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
    function randomHex(bytes) {
        const a = new Uint8Array(bytes);
        crypto.getRandomValues(a);
        return toHex(a);
    }
    async function hashPassword(password, salt) {
        if (!(window.crypto && crypto.subtle)) throw new Error("This page can't keep passwords safe here. Open the game from its website (https) or from localhost.");
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: ITERATIONS }, key, 256);
        return toHex(bits);
    }

    // A brand new profile with the fields both games expect
    function freshProfile(username, key) {
        return {
            id: "local_" + randomHex(4),
            username,
            email: null,
            avatarType: "preset",
            avatarVal: "steve",
            avatarUrl: null,
            authProvider: "local",
            accountKey: key,
            level: 1,
            xp: 0,
            gold: 300,
            arenaRP: 250,
            isMinor: false,
            stats: { matches: 0, wins: 0, losses: 0, slamsLanded: 0, dashesLanded: 0, maxSlamDamage: 0, kills: 0, damageDealt: 0, currentStreak: 0, bestStreak: 0 }
        };
    }
    function markProfile(profile, username, key) {
        profile.username = username;
        profile.authProvider = "local";
        profile.accountKey = key;
        if (!profile.id || !String(profile.id).startsWith("local_")) profile.id = "local_" + randomHex(4);
        return profile;
    }
    // Put a profile in place as the one both games play with
    function setActiveProfile(profile) {
        if (profile) writeJSON(PROFILE_KEY, profile);
        else localStorage.removeItem(PROFILE_KEY);
    }
    // Copy what's being played back into the logged-in account (or the guest slot)
    function stash(s) {
        const p = readJSON(PROFILE_KEY);
        if (s.active && s.accounts[s.active]) {
            if (p) {
                s.accounts[s.active].profile = p;
                s.accounts[s.active].updated = Date.now();
            }
        } else {
            s.guest = p;
        }
        return s;
    }
    function fail(error) {
        return { ok: false, error };
    }

    // ---------- Transfer codes ----------
    function b64encode(bytes) {
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    function b64decode(text) {
        const b = text.replace(/-/g, "+").replace(/_/g, "/");
        const bin = atob(b + "===".slice((b.length + 3) % 4));
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }
    async function pipeBytes(bytes, stream) {
        const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
        return new Uint8Array(await out.arrayBuffer());
    }
    async function pack(obj) {
        let bytes = new TextEncoder().encode(JSON.stringify(obj));
        let z = "0";
        if (typeof CompressionStream === "function") {
            bytes = await pipeBytes(bytes, new CompressionStream("deflate-raw"));
            z = "1";
        }
        return CODE_PREFIX + z + b64encode(bytes);
    }
    async function unpack(code) {
        const clean = String(code || "").replace(/\s+/g, "");
        if (!clean.startsWith(CODE_PREFIX)) throw new Error("That doesn't look like a transfer code.");
        const z = clean.charAt(CODE_PREFIX.length);
        let bytes = b64decode(clean.slice(CODE_PREFIX.length + 1));
        if (z === "1") {
            if (typeof DecompressionStream !== "function") throw new Error("This browser is too old to read that code.");
            bytes = await pipeBytes(bytes, new DecompressionStream("deflate-raw"));
        }
        return JSON.parse(new TextDecoder().decode(bytes));
    }

    const API = {
        checkName,
        checkPassword,

        // The logged-in account: { username, key } or null for a guest
        current() {
            const s = load();
            const a = s.active && s.accounts[s.active];
            return a ? { username: a.username, key: s.active, provider: a.external ? a.via || a.external : null } : null;
        },
        // Accounts on this device, most recently used first
        list() {
            const s = load();
            return Object.keys(s.accounts)
                .map((k) => ({ key: k, username: s.accounts[k].username, updated: s.accounts[k].updated || 0 }))
                .sort((a, b) => b.updated - a.updated);
        },

        // New account. keepProgress: start it from what you're playing now as a guest
        async signUp(name, password, keepProgress) {
            const err = checkName(name) || checkPassword(password);
            if (err) return fail(err);
            const username = String(name).trim();
            const key = keyOf(username);
            let s = load();
            if (s.accounts[key]) return fail("There's already an account called " + s.accounts[key].username + " on this device. Log in instead, or pick another name.");
            const salt = randomHex(16);
            let hash;
            try {
                hash = await hashPassword(password, salt);
            } catch (e) {
                return fail(e.message);
            }
            s = load(); // re-read: another tab may have saved meanwhile
            const fromGuest = !s.active;
            const current = readJSON(PROFILE_KEY);
            stash(s);
            let profile;
            if (keepProgress && fromGuest && current) {
                profile = markProfile(current, username, key);
                s.guest = null; // that progress now belongs to the account
            } else profile = freshProfile(username, key);
            const now = Date.now();
            s.accounts[key] = { username, salt, hash, profile, created: now, updated: now };
            s.active = key;
            save(s);
            setActiveProfile(profile);
            return { ok: true, username };
        },

        async logIn(name, password) {
            const key = keyOf(name);
            let s = load();
            const a = s.accounts[key];
            if (!a) return fail("There's no account called " + String(name).trim() + " on this device. Check the spelling, or use a transfer code.");
            let hash;
            try {
                hash = await hashPassword(password || "", a.salt);
            } catch (e) {
                return fail(e.message);
            }
            if (hash !== a.hash) return fail("Wrong password. Try again.");
            s = load();
            if (s.active === key) return { ok: true, username: a.username };
            stash(s);
            s.active = key;
            s.accounts[key].updated = Date.now();
            const profile = s.accounts[key].profile ? markProfile(s.accounts[key].profile, a.username, key) : freshProfile(a.username, key);
            save(s);
            setActiveProfile(profile);
            return { ok: true, username: a.username };
        },

        // Sign in with Google, Microsoft or GitHub (checked by Empire's sign-in service).
        // The account lives in this browser like any other, keyed by the provider's user id,
        // so the same person gets the same account (and progress) every time.
        // keepProgress: when you were playing as a guest, carry that progress into a brand new account.
        signInExternal(info, keepProgress) {
            const provider = String((info && info.provider) || "").replace(/[^a-z.]/gi, "").slice(0, 20);
            const uid = String((info && info.uid) || "").slice(0, 128);
            if (!provider || !uid) return fail("Sign-in didn't say who you are. Try again.");
            const key = "ext:" + provider + ":" + uid;
            const via = String((info && info.via) || provider).replace(/[^a-z]/gi, "").slice(0, 20); // e.g. Google, shown to people
            let username = String((info && info.name) || "").replace(/[^a-zA-Z0-9_ ]/g, "").replace(/\s+/g, " ").trim().slice(0, 16);
            if (username.length < 2) username = "Player " + uid.slice(-4);
            let s = load();
            if (s.active === key && s.accounts[key]) return { ok: true, username: s.accounts[key].username };
            const fromGuest = !s.active;
            const current = readJSON(PROFILE_KEY);
            stash(s);
            const now = Date.now();
            let profile;
            if (s.accounts[key]) {
                const a = s.accounts[key];
                a.updated = now;
                profile = a.profile ? markProfile(a.profile, a.username, key) : freshProfile(a.username, key);
                username = a.username;
                a.via = via;
            } else {
                if (keepProgress && fromGuest && current) {
                    profile = markProfile(current, username, key);
                    s.guest = null; // that progress now belongs to this account
                } else profile = freshProfile(username, key);
                s.accounts[key] = { username, external: provider, via, profile, created: now, updated: now };
            }
            s.active = key;
            save(s);
            setActiveProfile(profile);
            return { ok: true, username };
        },

        // Back to playing as a guest (with the guest progress from before, if any)
        logOut() {
            const s = stash(load());
            const guest = s.guest;
            s.active = null;
            s.guest = null;
            save(s);
            setActiveProfile(guest || null);
            return { ok: true };
        },

        // A code that carries the logged-in account (password hash and progress) to another device
        async exportCode() {
            const s = stash(load());
            const a = s.active && s.accounts[s.active];
            if (!a) return fail("Log in first.");
            if (a.external) return fail("This account signs in with " + (a.via || a.external) + ". Use that button on the other device instead of a transfer code.");
            save(s);
            const code = await pack({ v: 1, username: a.username, salt: a.salt, hash: a.hash, profile: a.profile, updated: a.updated });
            return { ok: true, code };
        },

        // Add an account from a transfer code. Needs that account's password.
        // If it's already on this device, returns { needConfirm } unless replace is true.
        async importCode(code, password, replace) {
            let data;
            try {
                data = await unpack(code);
            } catch (e) {
                return fail(e.message || "That transfer code is broken. Copy the whole thing and try again.");
            }
            if (!data || data.v !== 1 || !data.username || !data.salt || !data.hash) return fail("That transfer code is broken. Copy the whole thing and try again.");
            let hash;
            try {
                hash = await hashPassword(password || "", data.salt);
            } catch (e) {
                return fail(e.message);
            }
            if (hash !== data.hash) return fail("That's not the password for " + data.username + ".");
            const key = keyOf(data.username);
            const s = load();
            if (s.accounts[key] && !replace) return { ok: false, needConfirm: true, username: data.username };
            stash(s);
            const profile = data.profile ? markProfile(data.profile, data.username, key) : freshProfile(data.username, key);
            s.accounts[key] = { username: data.username, salt: data.salt, hash: data.hash, profile, created: Date.now(), updated: Date.now() };
            s.active = key;
            save(s);
            setActiveProfile(profile);
            return { ok: true, username: data.username };
        }
    };

    // ==========================================
    // Cross-game trophies
    // ==========================================
    const TROPHY_KEY = "spear_mace_trophies";
    const life = (p) => p.penguinLife || {};
    const lifeRecord = (p) => life(p).record || {};
    const RP = (p) => Number(p.arenaRP) || 0;
    const WORLD_FINALS = 5; // Iceland, Greenland, Siberia, Australia, Antarctica (PL.FINALS)
    // game: "mace" (Spear-Mace PVP), "life" (Penguin Life) or "all"
    const TROPHIES = [
        { id: "mace_silver", game: "mace", name: "Silver Duelist", desc: "Reach Silver tier in Spear-Mace PVP", color: "#cfd8dc", test: (p) => RP(p) >= 500 },
        { id: "mace_gold", game: "mace", name: "Gold Gladiator", desc: "Reach Gold tier in Spear-Mace PVP", color: "#ffca28", test: (p) => RP(p) >= 1000 },
        { id: "mace_diamond", game: "mace", name: "Diamond Warlord", desc: "Reach Diamond tier in Spear-Mace PVP", color: "#4dd0e1", test: (p) => RP(p) >= 1500 },
        { id: "mace_obsidian", game: "mace", name: "Obsidian Legend", desc: "Reach Obsidian tier in Spear-Mace PVP", color: "#9575cd", test: (p) => RP(p) >= 2000 },
        { id: "mace_streak", game: "mace", name: "Unstoppable", desc: "Win 5 duels in a row in Spear-Mace PVP", color: "#ff7043", test: (p) => ((p.stats && Number(p.stats.bestStreak)) || 0) >= 5 },
        { id: "pl_racer", game: "life", name: "Race Winner", desc: "Win a race in Penguin Life", color: "#66bb6a", test: (p) => (Number(lifeRecord(p).battlesWon) || 0) >= 1 },
        { id: "pl_champion", game: "life", name: "Champion Slayer", desc: "Beat a world champion in Penguin Life", color: "#ffa726", test: (p) => (life(p).finalsBeaten || []).length >= 1 },
        { id: "pl_world", game: "life", name: "World Champion", desc: "Beat every world champion in Penguin Life", color: "#ffd54f", test: (p) => (life(p).finalsBeaten || []).length >= WORLD_FINALS },
        { id: "pl_santa", game: "life", name: "Santa's Rival", desc: "Out-race Santa at the North Pole in Penguin Life", color: "#ef5350", test: (p) => !!life(p).santaBeaten },
        { id: "pl_dodger", game: "life", name: "Untouchable", desc: "Pull off 10 Perfect Dodges in Penguin Life", color: "#fff176", test: (p) => (Number(lifeRecord(p).perfectDodges) || 0) >= 10 },
        { id: "pl_frost", game: "life", name: "Frost Fisher", desc: "Catch 3 Frost Fish in a Penguin Life blizzard", color: "#81d4fa", test: (p) => (Number(lifeRecord(p).frostFish) || 0) >= 3 },
        { id: "two_worlds", game: "all", name: "Two-Game Hero", desc: "Earn a trophy in both Spear-Mace PVP and Penguin Life", color: "#f06292", test: (p, has) => has("mace") && has("life") }
    ];
    const TROPHY_BY_ID = {};
    TROPHIES.forEach((t) => { TROPHY_BY_ID[t.id] = t; });

    // Whose trophies these are: the logged-in account, or the guest profile being played
    function trophyOwner() {
        const s = load();
        if (s.active && s.accounts[s.active]) return "acct:" + s.active;
        const p = readJSON(PROFILE_KEY);
        return p && p.id ? "guest:" + p.id : null;
    }
    function loadTrophies() {
        const t = readJSON(TROPHY_KEY);
        return t && t.players ? t : { v: 1, players: {} };
    }
    function trophySlot(store, owner) {
        if (!store.players[owner]) store.players[owner] = { earned: {}, title: null };
        return store.players[owner];
    }
    const publicTrophy = (t, when) => ({ id: t.id, game: t.game, name: t.name, title: t.name, desc: t.desc, color: t.color, earned: when || 0 });

    // A small medal (SVG markup) in the trophy's color; dim when not earned yet
    function medalSVG(t, size, dim) {
        const c = dim ? "#5b6478" : t.color;
        return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 32 32" aria-hidden="true" style="vertical-align:middle;flex:none">' +
            '<path d="M9 2h6l3 9h-6zM23 2h-6l-3 9h6z" fill="' + (dim ? "#3d4558" : "#e53935") + '" stroke="#2a1c12" stroke-width="1.5" stroke-linejoin="round"/>' +
            '<circle cx="16" cy="20" r="10" fill="' + c + '" stroke="#2a1c12" stroke-width="2"/>' +
            '<path d="M16 14.5l1.7 3.5 3.8.5-2.8 2.6.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.6 3.8-.5z" fill="' + (dim ? "#7a849a" : "#fff8e1") + '" stroke="#2a1c12" stroke-width="1" stroke-linejoin="round"/></svg>';
    }
    function escHTML(text) {
        return String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    }

    // ---------- Unlock toasts (work on any page that loads this file) ----------
    const toastQueue = [];
    let toastBusy = false;
    function showNextToast() {
        if (toastBusy || !toastQueue.length || !document.body) return;
        toastBusy = true;
        const t = toastQueue.shift();
        const el = document.createElement("div");
        el.setAttribute("role", "status");
        el.style.cssText = "position:fixed;left:50%;top:14px;z-index:2147483000;display:flex;align-items:center;gap:12px;max-width:min(92vw,420px);" +
            "padding:10px 16px 10px 12px;border-radius:14px;background:rgba(22,34,79,0.96);color:#f3f6ff;border:3px solid " + t.color + ";" +
            "box-shadow:0 8px 26px rgba(0,0,0,0.45);font:600 15px/1.25 'Baloo 2','Trebuchet MS',sans-serif;pointer-events:none;" +
            "transform:translate(-50%,-140%);transition:transform 0.35s cubic-bezier(.2,1.4,.4,1),opacity 0.35s;opacity:0";
        el.innerHTML = medalSVG(t, 40) + '<div><div style="font-size:12px;letter-spacing:1px;color:' + t.color + '">TROPHY UNLOCKED</div>' +
            '<div style="font-size:18px;font-weight:800">' + escHTML(t.name) + "</div>" +
            '<div style="font-size:13px;color:#a8b4d8">' + escHTML(t.desc) + " · new title!</div></div>";
        document.body.appendChild(el);
        requestAnimationFrame(() => {
            el.style.transform = "translate(-50%,0)";
            el.style.opacity = "1";
        });
        setTimeout(() => {
            el.style.transform = "translate(-50%,-140%)";
            el.style.opacity = "0";
            setTimeout(() => {
                el.remove();
                toastBusy = false;
                showNextToast();
            }, 400);
        }, 3600);
    }

    API.trophies = {
        // Every trophy: { id, game, name, title, desc, color }
        catalog() {
            return TROPHIES.map((t) => publicTrophy(t, 0));
        },
        // The trophies this player has, oldest first: { id, game, name, title, desc, color, earned }
        earned() {
            const owner = trophyOwner();
            if (!owner) return [];
            const slot = loadTrophies().players[owner];
            if (!slot) return [];
            return Object.keys(slot.earned)
                .filter((id) => TROPHY_BY_ID[id])
                .sort((a, b) => slot.earned[a] - slot.earned[b])
                .map((id) => publicTrophy(TROPHY_BY_ID[id], slot.earned[id]));
        },
        has(id) {
            const owner = trophyOwner();
            const slot = owner && loadTrophies().players[owner];
            return !!(slot && slot.earned[id]);
        },
        // Look at the shared profile and award anything new. Returns the new trophies
        // (and shows a toast for each unless opts.quiet). Safe to call any time.
        check(opts) {
            const owner = trophyOwner();
            const p = readJSON(PROFILE_KEY);
            if (!owner || !p) return [];
            const store = loadTrophies();
            const slot = trophySlot(store, owner);
            const fresh = [];
            const hasGame = (game) => TROPHIES.some((t) => t.game === game && slot.earned[t.id]);
            const now = Date.now();
            // Two passes so trophies that need other trophies ("all") see this round's
            for (let pass = 0; pass < 2; pass++) {
                for (const t of TROPHIES) {
                    if (slot.earned[t.id]) continue;
                    let ok = false;
                    try { ok = !!t.test(p, hasGame); } catch (e) { ok = false; }
                    if (!ok) continue;
                    slot.earned[t.id] = now + fresh.length; // keeps the unlock order
                    fresh.push(publicTrophy(t, slot.earned[t.id]));
                }
            }
            if (!fresh.length) return fresh;
            try { localStorage.setItem(TROPHY_KEY, JSON.stringify(store)); } catch (e) { return []; }
            if (!(opts && opts.quiet)) {
                fresh.forEach((t) => toastQueue.push(t));
                showNextToast();
                try { if (window.PL && window.PL.sfx) window.PL.sfx("trophy"); } catch (e) { /* no sound */ }
            }
            try { window.dispatchEvent(new CustomEvent("gametrophies", { detail: fresh })); } catch (e) { /* old browser */ }
            return fresh;
        },
        // The title the player is wearing (a trophy's name), or null
        title() {
            const owner = trophyOwner();
            const slot = owner && loadTrophies().players[owner];
            if (!slot || !slot.title || !slot.earned[slot.title] || !TROPHY_BY_ID[slot.title]) return null;
            return publicTrophy(TROPHY_BY_ID[slot.title], slot.earned[slot.title]);
        },
        // Wear an earned trophy's title (null takes it off). Returns true if it worked.
        equip(id) {
            const owner = trophyOwner();
            if (!owner) return false;
            const store = loadTrophies();
            const slot = trophySlot(store, owner);
            if (id && !slot.earned[id]) return false;
            slot.title = id || null;
            try { localStorage.setItem(TROPHY_KEY, JSON.stringify(store)); } catch (e) { return false; }
            try { window.dispatchEvent(new CustomEvent("gametrophies", { detail: [] })); } catch (e) { /* old browser */ }
            return true;
        },
        // Medal badge markup for a trophy id (dim: not earned yet)
        badgeHTML(id, size, dim) {
            const t = TROPHY_BY_ID[id];
            return t ? medalSVG(t, size || 24, !!dim) : "";
        }
    };

    // Check on load, whenever another tab changes the profile, and every few seconds
    // (so a Gold tier reached in Spear-Mace PVP shows up without touching that game's code)
    function autoCheck() {
        if (document.visibilityState === "hidden") return;
        try { API.trophies.check(); } catch (e) { /* storage blocked */ }
    }
    if (typeof window.addEventListener === "function") {
        window.addEventListener("storage", (e) => {
            if (e.key === PROFILE_KEY || e.key === ACCOUNTS_KEY) setTimeout(autoCheck, 300);
        });
        const start = () => {
            setTimeout(autoCheck, 1500);
            setInterval(autoCheck, 5000);
        };
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
        else start();
    }

    window.GameAccounts = API;
})();
