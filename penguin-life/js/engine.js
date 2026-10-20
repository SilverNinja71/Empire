// ==========================================
// PENGUIN LIFE - Engine helpers
// Math, seeded random, keyboard/touch input and tiny Web Audio sound effects
// ==========================================
window.PL = window.PL || {};

(function (PL) {
    PL.W = 960;
    PL.H = 540;

    PL.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    PL.lerp = (a, b, t) => a + (b - a) * t;
    PL.rand = (a, b) => a + Math.random() * (b - a);
    PL.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Seeded random (mulberry32) so friend battles get the same course on every screen
    PL.makeRng = function (seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };

    // ---------- Input ----------
    const held = new Set();
    const hits = new Set();
    const KEYMAP = {
        ArrowUp: "up", w: "up", W: "up",
        ArrowDown: "down", s: "down", S: "down",
        ArrowLeft: "left", a: "left", A: "left",
        ArrowRight: "right", d: "right", D: "right",
        " ": "action", Enter: "action",
        Shift: "sprint",
        Escape: "esc",
        "1": "1", "2": "2", "3": "3", "4": "4", "5": "5"
    };
    const BLOCK_DEFAULT = new Set(["up", "down", "left", "right", "action"]);

    function typing() {
        const el = document.activeElement;
        return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
    }

    window.addEventListener("keydown", (e) => {
        if (typing()) return;
        const k = KEYMAP[e.key];
        if (!k) return;
        if (!held.has(k)) hits.add(k);
        held.add(k);
        if (BLOCK_DEFAULT.has(k)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => {
        const k = KEYMAP[e.key];
        if (k) held.delete(k);
        // Releasing Shift turns "D" into "d" etc., so clear both spellings
        if (e.key === "Shift") held.delete("sprint");
    });
    window.addEventListener("blur", () => held.clear());

    PL.input = {
        down: (k) => held.has(k),
        hit: (k) => hits.has(k),
        press(k) { if (!held.has(k)) hits.add(k); held.add(k); },
        release(k) { held.delete(k); },
        endFrame() { hits.clear(); },
        clear() { held.clear(); hits.clear(); }
    };

    // ---------- Sound ----------
    let actx = null;
    // Sound starts off; the speaker button turns it on and remembers the choice
    let soundOn = false;
    try { soundOn = localStorage.getItem("penguin_life_sound") === "on"; } catch (e) { /* storage blocked */ }
    PL.sound = { muted: !soundOn };

    function tone(freq, dur, type, slideTo, delay, vol) {
        const t0 = actx.currentTime + (delay || 0);
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = type || "sine";
        o.frequency.setValueAtTime(freq, t0);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
        g.gain.setValueAtTime(vol || 0.12, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g).connect(actx.destination);
        o.start(t0);
        o.stop(t0 + dur + 0.02);
    }

    const SFX = {
        coin: () => { tone(880, 0.06, "square", null, 0, 0.06); tone(1320, 0.1, "square", null, 0.06, 0.06); },
        jump: () => tone(320, 0.18, "square", 720, 0, 0.07),
        splash: () => tone(500, 0.25, "triangle", 90, 0, 0.1),
        hit: () => tone(160, 0.25, "sawtooth", 60, 0, 0.12),
        step: () => tone(200, 0.05, "triangle", null, 0, 0.06),
        click: () => tone(660, 0.05, "square", null, 0, 0.05),
        eat: () => { tone(400, 0.07, "square", 300, 0, 0.07); tone(420, 0.07, "square", 320, 0.1, 0.07); },
        catch: () => { tone(700, 0.08, "square", null, 0, 0.07); tone(1050, 0.12, "square", null, 0.08, 0.07); },
        levelup: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, "square", null, i * 0.09, 0.07)),
        win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, "triangle", null, i * 0.12, 0.1)),
        lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.2, "triangle", null, i * 0.15, 0.1)),
        go: () => tone(880, 0.3, "square", null, 0, 0.08),
        beep: () => tone(440, 0.12, "square", null, 0, 0.07),
        jingle: () => [784, 784, 784, 784, 784, 784, 784, 988, 659, 698, 784].forEach((f, i) => tone(f, 0.12, "triangle", null, i * 0.13, 0.08)),
        combo: () => [659, 880, 1175].forEach((f, i) => tone(f, 0.1, "square", null, i * 0.06, 0.06)),
        power: () => { tone(300, 0.25, "sine", 1200, 0, 0.09); tone(600, 0.2, "triangle", 1800, 0.08, 0.05); },
        shield: () => tone(1200, 0.3, "triangle", 300, 0, 0.09),
        star: () => tone(1046, 0.18, "triangle", 1568, 0, 0.08),
        best: () => [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "square", null, i * 0.1, 0.07)),
        chest: () => { tone(220, 0.15, "square", 440, 0, 0.07); [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.14, "triangle", null, 0.15 + i * 0.08, 0.08)); },
        mission: () => [880, 1109, 1319].forEach((f, i) => tone(f, 0.15, "triangle", null, i * 0.09, 0.08)),
        whoosh: () => tone(900, 0.2, "sawtooth", 200, 0, 0.03),
        // A predator winding up to lunge, and dodging it perfectly
        lunge: () => { tone(140, 0.32, "sawtooth", 260, 0, 0.07); tone(210, 0.32, "square", 380, 0, 0.03); },
        perfect: () => { tone(1568, 0.08, "square", null, 0, 0.06); [784, 1175, 1568, 2093].forEach((f, i) => tone(f, 0.12, "triangle", null, 0.06 + i * 0.05, 0.07)); },
        trophy: () => [659, 784, 988, 1319, 1568].forEach((f, i) => tone(f, 0.16, "triangle", null, i * 0.08, 0.08))
    };

    PL.sfx = function (name) {
        if (PL.sound.muted || !SFX[name]) return;
        try {
            actx = actx || new (window.AudioContext || window.webkitAudioContext)();
            if (actx.state === "suspended") actx.resume();
            SFX[name]();
        } catch (e) { /* audio not available */ }
    };
})(window.PL);
