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
            return a ? { username: a.username, key: s.active } : null;
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

    window.GameAccounts = API;
})();
