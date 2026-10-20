// =====================================================================
//  PENGUIN LEAGUE — core: utilities, game data, save file, audio
// =====================================================================
import * as THREE from 'three';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
const lerpAngle = (a, b, t) => { let d = (b - a + Math.PI) % (Math.PI * 2); if (d < 0) d += Math.PI * 2; return a + (d - Math.PI) * t; };
const fmtClock = (s) => { s = Math.max(0, Math.ceil(s - 1e-6)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtUp = (s) => { s = Math.max(0, Math.floor(s)); return `+${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const V3 = THREE.Vector3, Q = THREE.Quaternion;
const UP = new V3(0, 1, 0);
const G = 6.5;            // gravity, m/s² (650 uu/s² in the original physics)
const DT = 1 / 120;       // physics tick
const TEAM_HEX = [0x2f8cff, 0xff8a1f];
const TEAM_CSS = ['#2f8cff', '#ff8a1f'];
const TEAM_LABEL = ['BLUE', 'ORANGE'];

const FISH_SVG = '<svg class="fish-ico" viewBox="0 0 36 24" aria-hidden="true"><g stroke="#1b1d3a" stroke-width="2" stroke-linejoin="round"><path d="M25.5 12C28 8.5 30 4.6 34.2 3.4 33.3 7 32.6 9.6 33.2 12 32.6 14.4 33.3 17 34.2 20.6 30 19.4 28 15.5 25.5 12Z" fill="url(#plFishFin) #ff8a1f"/><path d="M11.5 5.8C13 1.8 19 1 22.6 5.6Z" fill="url(#plFishFin) #ff8a1f"/><path d="M14.5 18.6C15.2 21.6 18.6 22 20.4 18.4Z" fill="url(#plFishFin) #ff8a1f"/><path d="M2.4 12.6C2.4 7.4 8 4.2 14.6 4.2 20.8 4.2 24.8 8 27.2 12 24.8 16 20.8 19.8 14.6 19.8 8 19.8 2.4 17.6 2.4 12.6Z" fill="url(#plFishBody) #ffc21a"/></g><path d="M10.6 7.6Q13.6 12 10.6 16.6M15.4 8.4Q17.6 12 15.4 15.8M19.6 9.4Q21.2 12 19.6 14.8" fill="none" stroke="#e2780a" stroke-width="1.4" stroke-linecap="round"/><ellipse cx="14.6" cy="7" rx="5.6" ry="1.4" fill="#fff" opacity=".8"/><circle cx="6.6" cy="10.6" r="2.7" fill="#fff" stroke="#1b1d3a" stroke-width="1.3"/><circle cx="6.1" cy="10.9" r="1.55" fill="#1b1d3a"/><circle cx="6.7" cy="10.1" r=".65" fill="#fff"/><path d="M3.6 14.6Q5 15.7 6.6 14.9" fill="none" stroke="#1b1d3a" stroke-width="1.2" stroke-linecap="round"/><ellipse cx="9.6" cy="14.4" rx="1.5" ry=".9" fill="#ff5fa8" opacity=".55"/></svg>';

// ----------------------------------------------------------- game data
const MODES = {
  '1v1': { n: 1, label: '1v1', name: 'Duel', desc: 'Just you and one bot. Every touch matters.' },
  '2v2': { n: 2, label: '2v2', name: 'Doubles', desc: 'You and a bot teammate. Rotate, pass, score.' },
  '5v5': { n: 5, label: '5v5', name: 'Mayhem', desc: 'Ten penguins on a bigger rink. Pure chaos.' },
};

const UPGRADES = [
  { id: 'speed', name: 'Belly Slide', desc: 'Faster top speed on the ice', color: '#63ccff', eff: (l) => `+${l * 2}% top speed` },
  { id: 'thrust', name: 'Jetpack Thrust', desc: 'Stronger boost acceleration', color: '#ffb062', eff: (l) => `+${l * 3}% boost power` },
  { id: 'tank', name: 'Fish Tank', desc: 'Carry more boost fuel', color: '#ffd23f', eff: (l) => `${100 + l * 10} max boost` },
  { id: 'flip', name: 'Flipper Hops', desc: 'Higher jumps and double jumps', color: '#97ee72', eff: (l) => `+${l * 4}% jump` },
  { id: 'kick', name: 'Belly Bonk', desc: 'Harder hits on the ball', color: '#ff8cc2', eff: (l) => `+${l * 5}% hit power` },
  { id: 'grip', name: 'Ice Skates', desc: 'Tighter turns and air control', color: '#ae8bff', eff: (l) => `+${l * 4}% turning` },
];
const UPG_COST = [150, 350, 700, 1200, 2000];

const HATS = [
  { id: 'none', name: 'No Hat', cost: 0 },
  { id: 'beanie', name: 'Team Beanie', cost: 120 },
  { id: 'party', name: 'Party Cone', cost: 200 },
  { id: 'cone', name: 'Traffic Cone', cost: 300 },
  { id: 'tophat', name: 'Top Hat', cost: 350 },
  { id: 'propeller', name: 'Propeller Cap', cost: 450 },
  { id: 'chef', name: 'Chef Hat', cost: 500 },
  { id: 'viking', name: 'Viking Helm', cost: 650 },
  { id: 'crown', name: 'Royal Crown', cost: 1200 },
  { id: 'halo', name: 'Halo', cost: 0, god: true },
];
const SKINS = [
  { id: 'classic', name: 'Classic', body: 0x2b3050, belly: 0xf8fbff, cost: 0 },
  { id: 'emperor', name: 'Emperor', body: 0x3d5180, belly: 0xfff0c4, cost: 150 },
  { id: 'bubblegum', name: 'Bubblegum', body: 0xff6fb4, belly: 0xfff0f7, cost: 250 },
  { id: 'mint', name: 'Mint Chip', body: 0x2fc9a5, belly: 0xf2fff9, cost: 250 },
  { id: 'sunset', name: 'Sunset', body: 0xff7a3d, belly: 0xfff3e0, cost: 300 },
  { id: 'ghost', name: 'Snow Ghost', body: 0xcfe0ff, belly: 0xffffff, cost: 500 },
  { id: 'galaxy', name: 'Galaxy', body: 0x5a3fd6, belly: 0xe9e3ff, cost: 650 },
  { id: 'gold', name: 'Solid Gold', body: 0xffc21a, belly: 0xfff6d1, cost: 1500 },
];
const TRAILS = [
  { id: 'puff', name: 'Snow Puffs', cost: 0, color: '#ffffff' },
  { id: 'bubbles', name: 'Bubbles', cost: 200, color: '#9ff0ff' },
  { id: 'sparkle', name: 'Sparkles', cost: 300, color: '#ffe066' },
  { id: 'fire', name: 'Fire', cost: 500, color: '#ff6a2b' },
  { id: 'rainbow', name: 'Rainbow', cost: 900, color: 'linear-gradient(90deg,#ff5fa8,#ffd23f,#72dc4e,#2f8cff,#8d5bff)' },
];

const BOT_NAMES = ['Waddles', 'Pebble', 'Noot', 'Flapjack', 'Frosty', 'Skipper', 'Puddles', 'Chilly', 'Iceberg', 'Snowcone',
  'Biscuit', 'Blizzard', 'Sardine', 'Krill Bill', 'Gloop', 'Slushie', 'Captain Floe', 'Sir Slides', 'Belly Bob', 'Toboggan',
  'Dr. Fish', 'Squawk', 'Glacier', 'Marshmallow', 'Cobbler', 'Popsicle', 'Nugget', 'Sleet', 'Kelp', 'Drift'];

// ----------------------------------------------------------- save file (per-viewer, browser storage)
const SAVE_KEY = 'penguin-league-save-v1';
const DEFAULT_SAVE = {
  fish: 200,
  upgrades: { speed: 0, thrust: 0, tank: 0, flip: 0, kick: 0, grip: 0 },
  owned: { hat: ['none'], skin: ['classic'], trail: ['puff'] },
  equip: { hat: 'none', skin: 'classic', trail: 'puff' },
  settings: { ballCam: true, fov: 110, camDist: 1, volume: 0.7, quality: 'high', hints: true, v2: true },
  career: { played: 0, wins: 0, goals: 0, godWins: 0 },
  last: { mode: '1v1', opp: 'normal', mate: 'normal', len: 300, fair: false },
};
function deepMerge(base, src) {
  for (const k in src) {
    const v = src[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) deepMerge(base[k], v);
    else if (k in base) base[k] = v;
  }
  return base;
}
function loadSave() {
  const fresh = JSON.parse(JSON.stringify(DEFAULT_SAVE));
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) return deepMerge(fresh, JSON.parse(raw)); } catch (e) { /* storage blocked */ }
  return fresh;
}
const save = loadSave();
if (!save.settings.v2) { if (save.settings.fov === 100) save.settings.fov = 110; save.settings.v2 = true; }
if (save.settings.fov > 110) save.settings.fov = 110;   // Rocket League's maximum
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } }

// ----------------------------------------------------------- audio (synthesised, starts after first click)
// Cartoon penguin sound set: bubbles and glugs instead of coin dings, rubbery
// ball boinks, slide whistles, kazoo fanfares, foghorns and squawks.
const Sfx = (() => {
  let ctx = null, master = null, noiseBuf = null, boostG = null, slideG = null, slideF = null, crowdG = null;
  const ok = () => !!(ctx && master);
  function init() {
    if (/mute/.test(location.hash)) return;   // testing: #mute keeps the page silent
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = save.settings.volume; master.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const loop = (type, freq, q) => {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start(); return [g, f];
    };
    [boostG] = loop('bandpass', 900, 0.6);
    // jetpack rumble under the hiss
    const rum = ctx.createOscillator(); rum.type = 'sawtooth'; rum.frequency.value = 52;
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 170;
    const rg = ctx.createGain(); rg.gain.value = 0.7; rum.connect(rlp); rlp.connect(rg); rg.connect(boostG); rum.start();
    [slideG, slideF] = loop('lowpass', 300, 0.5);
    [crowdG] = loop('bandpass', 650, 0.35);
  }
  // one oscillator voice: pitch path, vibrato, filter, envelope
  function voice(o) {
    if (!ok()) return;
    const t = ctx.currentTime + (o.delay || 0), dur = o.dur, vol = o.vol ?? 0.2, atk = o.atk ?? 0.008;
    const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.path) for (const [dt, f] of o.path) osc.frequency.exponentialRampToValueAtTime(f, t + dt);
    if (o.detune) osc.detune.value = o.detune;
    if (o.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1];
      l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05);
    }
    let node = osc;
    if (o.filt) {
      const f = ctx.createBiquadFilter(); f.type = o.filt[0]; f.frequency.setValueAtTime(o.filt[1], t); f.Q.value = o.filt[2] ?? 1;
      if (o.filt[3]) f.frequency.exponentialRampToValueAtTime(o.filt[3], t + dur);
      node.connect(f); node = f;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + atk);
    if (o.hold) g.gain.setValueAtTime(vol, t + atk + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g); g.connect(master); osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(dur, vol = 0.2, f = 1000, type = 'bandpass', q = 1, delay = 0, fTo = null) {
    if (!ok()) return; const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (fTo) fl.frequency.exponentialRampToValueAtTime(fTo, t + dur); fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  // water bubble: a sine that shoots upward in pitch
  const bubble = (f, d = 0, v = 0.15) => voice({ f, path: [[0.055, f * 2.7]], dur: 0.085, vol: v, delay: d, atk: 0.004 });
  // nasal penguin honk: buzzy saw through two formants with a fast wobble
  const squawk = (p = 1, d = 0, v = 0.11, len = 0.22) => {
    for (const [ff, q, gv] of [[1150, 4, 1], [2600, 6, 0.45]]) {
      voice({ type: 'sawtooth', f: 520 * p, path: [[len * 0.3, 760 * p], [len, 430 * p]], dur: len, vol: v * gv, delay: d, vib: [28, 40 * p], filt: ['bandpass', ff, q], atk: 0.02 });
    }
  };
  const kazoo = (notes, step, d, v) => notes.forEach((n, i) => {
    const f = 440 * Math.pow(2, (n - 69) / 12);
    voice({ type: 'sawtooth', f, dur: step * 1.15, vol: v, delay: d + i * step, vib: [6.5, f * 0.014], filt: ['bandpass', 1300, 1.6], atk: 0.015, hold: step * 0.55 });
  });
  const wood = (f, d = 0, v = 0.24) => { voice({ f, dur: 0.13, vol: v, delay: d, atk: 0.002 }); voice({ f: f * 3.93, dur: 0.05, vol: v * 0.4, delay: d, atk: 0.002 }); };
  return {
    init,
    setVolume(v) { if (master) master.gain.value = v; },
    // rubbery beach-ball "boink", with a whoosh on big hits
    hit(p) {
      const k = clamp(p / 35, 0.08, 1);
      voice({ f: 300 + 120 * k, path: [[0.03, 520 + 220 * k], [0.21, 92]], dur: 0.22, vol: 0.16 + 0.38 * k, atk: 0.003 });
      voice({ type: 'square', f: 180 + 60 * k, path: [[0.12, 70]], dur: 0.12, vol: 0.04 + 0.1 * k, filt: ['lowpass', 900, 1] });
      noise(0.05, 0.07 + 0.25 * k, 2600, 'highpass', 0.7);
      if (k > 0.55) noise(0.28, 0.1 * k, 500, 'bandpass', 1.2, 0.02, 3200);
    },
    bounce(p) { const k = clamp(p / 25, 0.05, 1); voice({ f: 190 + 60 * k, path: [[0.02, 310], [0.16, 105]], dur: 0.16, vol: 0.04 + 0.18 * k, atk: 0.003 }); },
    jump() { voice({ f: 380, path: [[0.13, 920]], dur: 0.16, vol: 0.09, vib: [18, 28] }); },            // slide-whistle hop
    flip() { noise(0.3, 0.09, 700, 'bandpass', 2, 0, 3200); voice({ f: 950, path: [[0.22, 480]], dur: 0.24, vol: 0.045 }); },
    land(p) { noise(0.1, clamp(p / 12, 0.02, 0.15), 260, 'lowpass', 0.8, 0, 110); },                     // soft belly flump
    pickup(big) {
      if (big) { bubble(240, 0, 0.16); bubble(320, 0.07, 0.16); bubble(400, 0.14, 0.16); voice({ type: 'triangle', f: 150, path: [[0.08, 215], [0.22, 110]], dur: 0.24, vol: 0.13, delay: 0.17 }); } // glug-glug-gulp
      else bubble(300 + Math.random() * 90, 0, 0.13);
    },
    beep(go) {
      if (go) for (const dt of [0, 9]) voice({ type: 'sawtooth', f: 320, path: [[0.04, 470], [0.5, 445]], dur: 0.5, vol: 0.08, detune: dt, filt: ['bandpass', 1400, 3], atk: 0.01, hold: 0.28 }); // bike horn
      else wood(640);
    },
    goal() {
      voice({ type: 'sawtooth', f: 98, dur: 1.7, vol: 0.16, filt: ['lowpass', 480, 1], atk: 0.08, hold: 1.0 });   // foghorn
      voice({ type: 'sawtooth', f: 147, dur: 1.7, vol: 0.09, filt: ['lowpass', 520, 1], atk: 0.08, hold: 1.0 });
      kazoo([72, 72, 76, 79, 76, 79, 84], 0.12, 0.4, 0.08);
      squawk(1, 0.15); squawk(1.25, 0.55, 0.09); squawk(0.85, 0.95, 0.09);
      noise(2.8, 0.3, 750, 'bandpass', 0.4);
    },
    demo() { noise(0.6, 0.38, 900, 'lowpass', 0.6, 0, 100); voice({ f: 1400, path: [[0.45, 150]], dur: 0.5, vol: 0.09, vib: [12, 25] }); squawk(1.4, 0.06, 0.1, 0.18); },
    whistle() { voice({ f: 2600, dur: 0.75, vol: 0.08, vib: [34, 150], atk: 0.01, hold: 0.45 }); },              // pea-whistle trill
    click() { voice({ f: 950, path: [[0.06, 240]], dur: 0.08, vol: 0.11, atk: 0.003 }); },                        // water-drop plop
    buy() { bubble(280, 0, 0.13); bubble(390, 0.06, 0.13); squawk(1.25, 0.12, 0.1, 0.2); },
    deny() { voice({ type: 'sawtooth', f: 200, path: [[0.26, 135]], dur: 0.28, vol: 0.08, filt: ['bandpass', 900, 3], vib: [20, 14] }); },
    loops(boost, speed, crowd) {
      if (!ok()) return; const t = ctx.currentTime;
      boostG.gain.setTargetAtTime(boost ? 0.15 : 0, t, 0.04);
      slideG.gain.setTargetAtTime(clamp(speed / 23, 0, 1) * 0.035, t, 0.12);
      slideF.frequency.setTargetAtTime(220 + speed * 45, t, 0.12);
      crowdG.gain.setTargetAtTime(crowd, t, 0.35);
    },
  };
})();
