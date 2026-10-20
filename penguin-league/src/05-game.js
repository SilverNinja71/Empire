// =====================================================================
//  MATCH — kickoffs, goals, clock, stats, input, HUD, main loop
// =====================================================================
const M = {
  cars: [], views: [], ball: new Ball(), pads: [], score: [0, 0], clock: 300, t: 0, state: 'idle', stateT: 0,
  demo: false, mode: '1v1', cfg: null, player: null, kickoff: false, kickStart: 0, kickTaker: [null, null], coach: [null, null],
  preds: {}, hist: [], histI: 0, overtime: false, otTime: 0, clockRun: false, ballHidden: false, touchSerial: 0, lastTouch: null,
  touches: [], tick: 0, slowmo: 0, zeroWait: false, teamLevel: ['normal', 'normal'], paused: false, excite: 0, levels: [], lastCount: 0, dutyT: [-99, -99],
  respawn(c) {
    const [x, z] = pick(RESPAWN);
    const px = (c.team === 0 ? x : -x) * A.s, pz = (c.team === 0 ? z : -z) * A.s;
    c.resetState(); c.place(px, pz, c.team === 0 ? 0 : Math.PI);
    puffBurst(c.p, 10, 0xffffff, 4, 0.5);
  },
  demolish(v, a) {
    if (v.demolished || M.state !== 'play') return;
    v.demolished = true; v.respawnT = 3; v.boost = 0;
    a.stat.demos++; addScore(a, 25, 'DEMOLITION');
    puffBurst(v.p, 22, 0x2b3050, 9, 0.7); puffBurst(v.p, 14, 0xffffff, 7, 0.6);
    FX.confetti(v.p, 40, [0x2b3050, 0xffffff, 0xffa41b], 12);
    FX.burst('POOF!', _gv.copy(v.p).add(UP), 4.2, '#ffffff', TEAM_CSS[a.team]);
    if (!M.demo) feed(`${tn(a)} demolished ${tn(v)}`);
    if (nearPlayer(v.p, 40)) { Sfx.demo(); CAM.shake = Math.max(CAM.shake, v === M.player || a === M.player ? 0.9 : 0.4); }
    if (v === M.player) banner('DEMOLISHED', 'Respawning…', 'pink', 1.6);
  },
  onPickup(c, p) {
    if (!p.big) { if (c === M.player) Sfx.pickup(false); puffBurst(_gv.set(p.x, 0.5, p.z), 4, 0xffe066, 3, 0.25); return; }
    // ice crystal: shatter into icy glints + a frost ring; the speed burst itself is physics
    if (c === M.player) { Sfx.crystal(); CAM.shake = Math.max(CAM.shake, 0.25); }
    puffBurst(_gv.set(p.x, 1.2, p.z), 10, 0xc8f6ff, 4.5, 0.32);
    FX.shock(_gv.set(p.x, 0.35, p.z), 0x5fdcff, 4.5);
  },
  onBump(a, b, s) { if ((a === M.player || b === M.player) && s > 4) Sfx.bounce(s); },
};
for (const k of LEVEL_ORDER) M.preds[k] = makePred();
for (let i = 0; i < 90; i++) M.hist.push({ p: new V3(), v: new V3(), w: new V3() });
const _gv = new V3(), _preP = new V3(), _preV = new V3(), _preW = new V3();
const tn = (c) => `<span class="${c.team ? 'o' : 'b'}">${esc(c.name)}</span>`;
const nearPlayer = (p, d) => !M.player || M.player.p.distanceTo(p) < d;

function addScore(c, pts, label) {
  if (M.demo) return;
  c.stat.score += pts;
  if (c === M.player) toast(`+${pts}`, label);
}

// ----------------------------------------------------------- match setup
function clearMatch() {
  for (const v of M.views) v.dispose();
  M.views = []; M.cars = []; M.player = null;
  FX.clear();
}
function startMatch(cfg) {
  clearMatch();
  M.cfg = cfg; M.demo = !!cfg.demo; M.mode = cfg.mode;
  const kind = cfg.mode === '5v5' ? 'large' : 'standard';
  const rebuild = A.kind !== kind || !arenaGroup;
  setArena(kind);
  M.pads = makePads();
  if (rebuild) buildArena(); else { for (const pv of padViews) scene.remove(pv.g); padViews = M.pads.map(makePadView); }
  const n = MODES[cfg.mode].n;
  const names = shuffle(BOT_NAMES);
  let ni = 0;
  const botCos = (lvl) => {
    const hatPool = { easy: ['none', 'beanie', 'party', 'cone'], normal: ['none', 'beanie', 'tophat', 'propeller', 'chef'], hard: ['viking', 'tophat', 'crown', 'propeller'], god: ['halo'] }[lvl];
    return { hat: pick(hatPool), skin: pick(SKINS).id, trail: 'puff' };
  };
  M.teamLevel = [cfg.mate, cfg.opp];
  for (const team of [0, 1]) {
    for (let i = 0; i < n; i++) {
      let car;
      if (team === 0 && i === 0 && !M.demo) {
        const st = cfg.fair ? { ...STOCK } : statsFromUpgrades(save.upgrades);
        const lv = Object.values(save.upgrades).reduce((a, b) => a + b, 0);
        car = new Penguin(0, 'You', st, { cos: { ...save.equip }, gold: save.upgrades.thrust >= 5 && !cfg.fair, lv });
        M.player = car;
      } else {
        const lvl = team === 0 ? cfg.mate : cfg.opp;
        car = new Penguin(team, names[ni++ % names.length], { ...STOCK }, { bot: true, level: lvl, cos: botCos(lvl) });
        car.bot = new Bot(car, lvl);
      }
      M.cars.push(car);
      M.views.push(new PenguinView(car));
    }
  }
  M.levels = [...new Set(M.cars.filter((c) => c.bot).map((c) => c.level).concat(M.teamLevel))];
  M.score = [0, 0]; M.clock = cfg.len || 300; M.overtime = false; M.otTime = 0; M.zeroWait = false;
  M.touches = []; M.t = 0; M.tick = 0; M.paused = false; M.slowmo = 0; M.excite = 0;
  CAM.yaw = 0; CAM.pos.set(0, 6, -A.hz * 0.7);
  kickoffReset();
  HUD.reset();
}
// goal highlight: slow motion + camera zoom (03g-camera) + letterbox bars, ended before the next phase
const GOAL_TS = 0.35;
function cine(on) { $('#cine').classList.toggle('on', on); }
function endHighlight() { CAM.hl = null; cine(false); }
function kickoffReset() {
  endHighlight();
  // fresh team shape every kickoff: the coach re-deals striker / goalie / sweeper duties from the new spots
  for (const c of M.cars) c.duty = null;
  M.dutyT[0] = M.dutyT[1] = -99;
  const b = M.ball; b.reset(); M.ballHidden = false;
  for (const h of M.hist) { h.p.copy(b.p); h.v.set(0, 0, 0); h.w.set(0, 0, 0); }
  for (const p of M.pads) { p.active = true; p.t = 0; }
  const n = MODES[M.mode].n;
  const idxs = n === 5 ? shuffle([0, 1, 2, 3, 4]) : shuffle([0, 1, 2, 3, 4]).slice(0, n);
  for (const team of [0, 1]) {
    const mem = M.cars.filter((c) => c.team === team);
    mem.forEach((c, i) => {
      const [x, z] = KICKOFF[idxs[i]];
      const px = (team === 0 ? x : -x) * A.s, pz = (team === 0 ? z : -z) * A.s;
      c.resetState(); c.place(px, pz, Math.atan2(-px, -pz));
      c.ctrl.jump = false; c.ctrl.boost = false;
      if (c.bot) { c.bot.man = null; c.bot.hesitateT = rand(0, c.bot.L.hesitate); c.bot.thinkT = 0; }
    });
    const sorted = mem.slice().sort((a, c2) => {
      const da = Math.round(Math.hypot(a.p.x, a.p.z) * 2), db = Math.round(Math.hypot(c2.p.x, c2.p.z) * 2);
      return da !== db ? da - db : (team === 0 ? c2.p.x - a.p.x : a.p.x - c2.p.x);
    });
    M.kickTaker[team] = sorted[0];
  }
  M.state = 'countdown'; M.stateT = M.demo ? 0.8 : 3; M.lastCount = 4;
  M.kickoff = true; M.clockRun = false; M.lastTouch = null; M.touchSerial++;
  updatePreds(true);
}
function updatePreds() {
  for (const key of M.levels) {
    const L = LEVELS[key];
    const back = Math.min(M.hist.length - 1, Math.round(L.react / DT));
    const h = M.hist[(M.histI - back + M.hist.length * 4) % M.hist.length];
    computePred(M.preds[key], h.p, h.v, h.w, M.t - back * DT, L.horizon + 0.7);
  }
}

// ----------------------------------------------------------- simulation tick
function simTick() {
  M.t += DT; M.tick++;
  const b = M.ball;
  if (M.state === 'countdown') {
    M.stateT -= DT;
    for (const c of M.cars) { c.pp.copy(c.p); c.pq.copy(c.q); }
    b.pp.copy(b.p);
    const cnt = Math.ceil(M.stateT);
    if (!M.demo && cnt < M.lastCount && cnt > 0) { banner(String(cnt), M.overtime ? 'Overtime · next goal wins' : '', 'yellow', 0.9); Sfx.beep(false); }
    M.lastCount = cnt;
    if (M.stateT <= 0) {
      M.state = 'play'; M.kickStart = M.t;
      if (!M.demo) { banner('GO!', '', 'yellow', 0.7); Sfx.beep(true); }
    }
    if (M.player) readPlayerInput(M.player);
    return;
  }
  if (M.state === 'over') { for (const c of M.cars) { c.pp.copy(c.p); c.pq.copy(c.q); } b.pp.copy(b.p); return; }
  // perception history + predictions
  M.histI = (M.histI + 1) % M.hist.length;
  M.hist[M.histI].p.copy(b.p); M.hist[M.histI].v.copy(b.v); M.hist[M.histI].w.copy(b.w);
  if (M.tick % 3 === 0) updatePreds();
  if (M.tick % 12 === 0) coachUpdate(M);
  if (M.kickoff && M.t - M.kickStart > 4.5) M.kickoff = false;
  // controls
  if (M.player) readPlayerInput(M.player);
  for (const c of M.cars) if (c.bot) c.bot.update(DT, M);
  for (const c of M.cars) { stepPenguin(c, DT, M); handleCarEvents(c); }
  // ball
  b.pp.copy(b.p);
  if (!M.ballHidden) {
    const imp = stepBallPhys(b, DT);
    if (imp > 3 && nearPlayer(b.p, 45)) Sfx.bounce(imp);
  }
  for (let i = 0; i < M.cars.length; i++) for (let j = i + 1; j < M.cars.length; j++) collideCars(M.cars[i], M.cars[j], M);
  if (!M.ballHidden) {
    for (const c of M.cars) {
      _preP.copy(b.p); _preV.copy(b.v); _preW.copy(b.w);
      const hit = collideBallCar(c, b);
      if (hit && M.state === 'play') onTouch(c, hit);   // the ball stays physical in the net during a goal highlight, but those touches don't count
    }
  }
  updatePads(M, DT);
  // goals
  if (M.state === 'play' && !M.ballHidden) {
    if (b.p.z > A.hz + BALL_R) onGoal(0);
    else if (b.p.z < -(A.hz + BALL_R)) onGoal(1);
  }
  // clock
  if (M.state === 'play') {
    if (!M.clockRun && M.t - M.kickStart > 2.5) M.clockRun = true;
    if (M.clockRun && !M.demo) {
      if (M.overtime) M.otTime += DT;
      else if (M.clock > 0) { M.clock -= DT; if (M.clock <= 0) { M.clock = 0; M.zeroWait = true; } }
    }
    if (M.zeroWait && (b.p.y < BALL_R + 0.25 || arenaD(b.p.x, b.p.y, b.p.z) < BALL_R + 0.1)) {
      M.zeroWait = false;
      if (M.score[0] === M.score[1]) startOvertime(); else endMatch();
    }
  } else if (M.state === 'goal' || M.state === 'otintro') {
    M.stateT -= DT;
    if (M.stateT <= 0) {
      if (M.state === 'goal') { M.ballHidden = true; endHighlight(); }   // highlight over: the ball pops away before the next phase
      if (M.state === 'goal' && (M.overtime || (M.clock <= 0 && M.score[0] !== M.score[1]))) endMatch();
      else if (M.state === 'goal' && M.clock <= 0) startOvertime();
      else kickoffReset();
    }
  }
}
function handleCarEvents(c) {
  if (!c.events.length) return;
  for (const e of c.events) {
    if (c === M.player) { if (e === 'jump') Sfx.jump(); else if (e === 'flip') Sfx.flip(); }
    if (e === 'flip' && nearPlayer(c.p, 30)) puffBurst(c.p, 4, 0xffffff, 2.5, 0.35);
  }
  c.events.length = 0;
}
function onTouch(c, hit) {
  const M_ = M;
  if (M_.t - c.lastTouchT > 0.22) {
    c.stat.touches++;
    M_.touches.push({ car: c, t: M_.t }); if (M_.touches.length > 60) M_.touches.shift();
    M_.touchSerial++; M_.lastTouch = c;
    if (M_.kickoff) { M_.kickoff = false; M_.clockRun = true; }
    if (!M_.demo && M_.state === 'play') {
      const own = c.team === 0 ? -1 : 1;
      const before = predictGoal(_preP, _preV, 2.6, _preW);
      const after = predictGoal(M_.ball.p, M_.ball.v, 4, M_.ball.w);
      if (before === own && after !== own) { c.stat.saves++; addScore(c, 50, 'SAVE'); feed(`${tn(c)} made a save`); FX.burst('SAVE!', _gv.copy(M_.ball.p).add(UP), 3.6, '#72dc4e', '#ffffff'); }
      else if (after === -own && before !== -own) { c.stat.shots++; addScore(c, 20, 'SHOT ON GOAL'); }
    }
  }
  c.lastTouchT = M_.t;
  if (hit.power > 2.5 && nearPlayer(hit.point, 50)) Sfx.hit(hit.power);
  if (hit.charged > 0) {
    // charged shot: frost ring + a POWER! or CURVE! sticker (curve when the shooter was steering at contact)
    const curved = Math.abs(c.ctrl.steer) > 0.3;
    FX.shock(_gv.copy(hit.point), 0x5fdcff, 5 + hit.charged * 5);
    FX.burst(curved ? 'CURVE!' : 'POWER!', _gv.copy(hit.point).addScaledVector(UP, 1.1), 2.6 + hit.charged * 1.2, '#c8f6ff', curved ? '#8d5bff' : '#2fb8ff');
    puffBurst(hit.point, 8, 0xc8f6ff, 6, 0.32);
    if (nearPlayer(hit.point, 50)) Sfx.power(hit.charged);
    if (c === M_.player) CAM.shake = Math.max(CAM.shake, 0.5);
  } else if (hit.power > 17) {
    FX.burst(pick(['POW!', 'BONK!', 'WHAM!', 'SMACK!']), _gv.copy(hit.point).addScaledVector(UP, 0.8), 2.4 + hit.power * 0.04);
    puffBurst(hit.point, 6, 0xffffff, 5, 0.3);
    if (c === M_.player) CAM.shake = Math.max(CAM.shake, 0.35);
  }
}
function onGoal(team) {
  const b = M.ball;
  M.score[team]++;
  let scorer = null, assist = null;
  for (let i = M.touches.length - 1; i >= 0; i--) {
    const t = M.touches[i];
    if (t.car.team !== team) continue;
    scorer = t.car;
    for (let j = i - 1; j >= 0; j--) { const u = M.touches[j]; if (t.t - u.t > 6 || u.car.team !== team) break; if (u.car !== scorer) { assist = u.car; break; } }
    break;
  }
  if (scorer && !M.demo) { scorer.stat.goals++; addScore(scorer, 100, 'GOAL'); }
  if (assist && !M.demo) { assist.stat.assists++; addScore(assist, 50, 'ASSIST'); }
  const col = TEAM_HEX[team];
  FX.confetti(b.p, 260, [col, 0xffd23f, 0xff5fa8, 0xffffff, 0x72dc4e, 0x8d5bff], 22);
  FX.shock(b.p, col, 16); FX.shock(_gv.copy(b.p).add(UP), 0xffffff, 10);
  puffBurst(b.p, 30, 0xffffff, 12, 1.0); puffBurst(b.p, 20, col, 10, 0.9);
  FX.burst('GOAL!', _gv.copy(b.p).addScaledVector(UP, 3), 9, team ? '#ffb15c' : '#7fd0ff', '#ffd23f');
  for (const c of M.cars) {
    if (c.demolished) continue;
    const d = c.p.distanceTo(b.p);
    if (d < 16) { _gv.copy(c.p).sub(b.p).normalize(); c.v.addScaledVector(_gv, (16 - d) * 1.5); c.v.y += (16 - d) * 0.55; c.jumpGrace = 0.2; }
  }
  M.state = 'goal'; M.excite = 1;
  if (M.demo) { M.ballHidden = true; M.stateT = 1.5; }
  else {
    // slow-motion highlight: GOAL_HL.dur real seconds at GOAL_TS speed with the ball still rippling the net
    // while the camera zooms toward it and the scorer, then a short beat and the kickoff reset
    // Reduced motion: no slow motion, no camera swoop, no shake and no white flash, just a short pause
    if (save.settings.reducedMotion) M.stateT = 1.6;
    else {
      M.stateT = GOAL_HL.dur * GOAL_TS + 0.45;
      M.slowmo = GOAL_HL.dur; CAM.shake = 1; flash();
      startHighlight(team, scorer); cine(true);
    }
    Sfx.goal();
    const who = scorer === M.player ? 'You scored!' : scorer ? `${esc(scorer.name)} scores!` : 'Own goal!';
    banner('GOAL!', who + (assist ? ` · assist ${esc(assist.name)}` : ''), team ? 'orange' : 'blue', 1.7);
    feed(scorer ? `${tn(scorer)} scored${assist ? ` (assist ${tn(assist)})` : ''}` : `Own goal for <span class="${team ? 'o' : 'b'}">${TEAM_LABEL[team]}</span>`);
    HUD.bumpScore(team);
  }
}
function startOvertime() {
  M.overtime = true; M.otTime = 0;
  M.state = 'otintro'; M.stateT = 2.4;
  banner('OVERTIME', 'Next goal wins', 'pink', 2.2); Sfx.whistle();
}
function endMatch() {
  endHighlight();
  M.state = 'over'; M.ballHidden = M.ballHidden || false;
  Sfx.whistle();
  const win = M.score[0] > M.score[1];
  banner(win ? 'VICTORY!' : 'DEFEAT', `${M.score[0]} – ${M.score[1]}`, win ? 'yellow' : 'pink', 2.4);
  if (win) FX.confetti(_gv.set(M.player.p.x, 3, M.player.p.z), 200, [0xffd23f, 0xff5fa8, 0x2f8cff, 0xffffff], 16);
  setTimeout(() => UI.results(), 2300);
}

// ----------------------------------------------------------- input
// Buttons are latched: every press is counted the moment it happens (keyboard, mouse and touch events, and the
// gamepad, which is polled on every animation frame), and each physics tick uses the presses up one at a time.
// So a tap that starts and ends between two ticks still gives one tick with the button down, and a fast double
// tap still gives two separate presses (a jump and then a dive).
const KEYS = new Set();
const mouse = { l: false, r: false };
const touch = { jx: 0, jy: 0, jump: false, boost: false, slide: false, charge: false };
const ACTIONS = ['jump', 'boost', 'slide', 'charge'];
const LATCH = { jump: { n: 0, out: false }, boost: { n: 0, out: false }, slide: { n: 0, out: false }, charge: { n: 0, out: false } };
const KEY_ACTION = { Space: 'jump', ShiftLeft: 'boost', ShiftRight: 'boost', KeyX: 'slide', KeyF: 'charge' };
const PAD_ACTION = { 0: 'jump', 1: 'boost', 2: 'slide', 5: 'charge' };   // A, B, X, RB
const playing = () => inMatch() && !M.paused;
function latchPress(a) { if (playing()) LATCH[a].n++; }
function clearInput() {
  KEYS.clear(); mouse.l = mouse.r = false;
  for (const a of ACTIONS) { LATCH[a].n = 0; LATCH[a].out = false; }
}
// one tick's value of a button: queued presses first (with a released tick between two of them), then the held state
function latched(a, held) {
  const L = LATCH[a];
  if (L.n > 0) {
    if (L.out) L.out = false;
    else { L.n--; L.out = true; }
  } else L.out = held;
  return L.out;
}
const inMatch = () => M.state !== 'idle' && !M.demo;
const BLOCK = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT')) return;
  if (inMatch() && BLOCK.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  KEYS.add(e.code);
  if (!inMatch()) return;
  if (KEY_ACTION[e.code]) latchPress(KEY_ACTION[e.code]);
  if (e.code === 'KeyC') toggleBallCam();
  if ((e.code === 'Escape' || e.code === 'KeyP') && M.state !== 'over') UI.togglePause();
  if (e.code === 'Tab') HUD.scoreboard(true);
});
addEventListener('keyup', (e) => { KEYS.delete(e.code); if (e.code === 'Tab') HUD.scoreboard(false); });
// switching to another window or tab pauses a match (and drops any held keys)
function autoPause() { if (inMatch() && !M.paused && M.state !== 'over') UI.togglePause(); }
addEventListener('blur', () => { clearInput(); autoPause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); autoPause(); } });
canvas.addEventListener('mousedown', (e) => {
  if (!inMatch()) return;
  if (e.button === 0) { mouse.l = true; latchPress('boost'); }
  if (e.button === 2) { mouse.r = true; latchPress('jump'); }
  Sfx.init();
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// gamepad: polled once per animation frame (menus and pause included), so Start can both pause and unpause
const PAD = { on: false, axes: [0, 0, 0, 0], btn: new Float32Array(17), prev: new Uint8Array(17) };
function pollPad() {
  let gp = null;
  if (navigator.getGamepads) for (const g of navigator.getGamepads()) if (g && g.connected) { gp = g; break; }
  PAD.on = !!gp;
  if (!gp) { PAD.prev.fill(0); return; }
  for (let i = 0; i < 4; i++) PAD.axes[i] = gp.axes[i] || 0;
  for (let i = 0; i < PAD.btn.length; i++) {
    const b = gp.buttons[i], v = b ? (typeof b === 'object' ? b.value : b) : 0, on = b ? (typeof b === 'object' ? b.pressed : b > 0.5) : false;
    PAD.btn[i] = v;
    if (on && !PAD.prev[i]) {
      if (PAD_ACTION[i]) latchPress(PAD_ACTION[i]);
      if (i === 3 && playing()) toggleBallCam();
      if (i === 9 && inMatch() && M.state !== 'over') UI.togglePause();
    }
    PAD.prev[i] = on ? 1 : 0;
  }
}
const padOn = (i) => PAD.prev[i] === 1;
const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
function readPlayerInput(c) {
  const k = c.ctrl, K = (code) => KEYS.has(code);
  let thr = (K('KeyW') || K('ArrowUp') ? 1 : 0) - (K('KeyS') || K('ArrowDown') ? 1 : 0);
  let st = (K('KeyD') || K('ArrowRight') ? 1 : 0) - (K('KeyA') || K('ArrowLeft') ? 1 : 0);
  const roll = 0;   // rolling is not possible
  let pitch = thr;
  let jump = K('Space') || mouse.r, boost = K('ShiftLeft') || K('ShiftRight') || mouse.l, slide = K('KeyX'), charge = K('KeyF');
  if (PAD.on) {
    st += dz(PAD.axes[0]); pitch += -dz(PAD.axes[1]);
    thr += PAD.btn[7] - PAD.btn[6];
    jump = jump || padOn(0); boost = boost || padOn(1); slide = slide || padOn(2); charge = charge || padOn(5);
  }
  if (touch.jx || touch.jy) { st += touch.jx; thr += clamp(-touch.jy * 1.5, -1, 1); pitch += -touch.jy; }
  jump = jump || touch.jump; boost = boost || touch.boost; slide = slide || touch.slide; charge = charge || touch.charge;
  k.throttle = clamp(thr, -1, 1); k.steer = clamp(st, -1, 1); k.pitch = clamp(pitch, -1, 1); k.roll = clamp(roll, -1, 1);
  k.jump = latched('jump', jump); k.boost = latched('boost', boost); k.slide = latched('slide', slide); k.charge = latched('charge', charge);
}
function toggleBallCam() { save.settings.ballCam = !save.settings.ballCam; persist(); HUD.camChip(); }
// touch controls
(function setupTouch() {
  const joy = $('#joy'), knob = joy.querySelector('i');
  let jid = null, cx = 0, cy = 0;
  joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; joy.setPointerCapture(e.pointerId); move(e); Sfx.init(); });
  const move = (e) => {
    if (e.pointerId !== jid) return;
    let dx = (e.clientX - cx) / 60, dy = (e.clientY - cy) / 60; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    touch.jx = dx; touch.jy = dy; knob.style.transform = `translate(${dx * 44}px, ${dy * 44}px)`;
  };
  joy.addEventListener('pointermove', move);
  const up = (e) => { if (e.pointerId !== jid) return; jid = null; touch.jx = touch.jy = 0; knob.style.transform = ''; };
  joy.addEventListener('pointerup', up); joy.addEventListener('pointercancel', up);
  for (const [id, key] of [['t-jump', 'jump'], ['t-boost', 'boost'], ['t-slide', 'slide'], ['t-shot', 'charge']]) {
    const el = $('#' + id);
    el.addEventListener('pointerdown', (e) => { touch[key] = true; latchPress(key); el.classList.add('on'); el.setPointerCapture(e.pointerId); e.preventDefault(); });
    const off = () => { touch[key] = false; el.classList.remove('on'); };
    el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off);
  }
  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
})();

// ----------------------------------------------------------- HUD
const HUD = (() => {
  const el = $('#hud'), s0 = $('#sb-s0'), s1 = $('#sb-s1'), time = $('#sb-time'), ot = $('#sb-ot');
  const arc = $('#boost-arc'), num = $('#boost-num'), arrow = $('#ball-arrow'), chip = $('#chip-ballcam'), speed = $('#speedlines'), hint = $('#hint'), sb = $('#scoreboard');
  const boostBox = $('#boost'), boostLbl = $('#boost .num small'), chargeEl = $('#charge'), chargeFill = $('#charge i');
  const ARC = 2 * Math.PI * 43 * 0.75;
  let hintT = 0, lastBoost = -1, lastClock = '', lastCharge = -1, lastBurst = null, chargeFull = false;
  // last values written to the page, so the HUD only touches the DOM when something visible changes
  let lastS0 = -1, lastS1 = -1, lastSpeed = -1, lastArrow = '';
  chip.addEventListener('click', () => { toggleBallCam(); chip.blur(); });
  $('#btn-pause').addEventListener('click', () => UI.togglePause());
  const _pv = new V3();
  return {
    reset() {
      $('#feed').innerHTML = ''; $('#toasts').innerHTML = ''; $('#banner').innerHTML = '';
      hintT = save.settings.hints ? 14 : 0; hint.style.opacity = hintT > 0 ? 1 : 0; hint.hidden = hintT <= 0;
      $('#touch').hidden = !document.body.classList.contains('touch');
      this.camChip(); lastBoost = -1; lastClock = ''; lastCharge = -1; lastBurst = null; chargeFull = false;
      lastS0 = lastS1 = lastSpeed = -1; lastArrow = '';
      s0.textContent = '0'; s1.textContent = '0';
    },
    camChip() { chip.setAttribute('aria-pressed', save.settings.ballCam ? 'true' : 'false'); chip.textContent = `BALL CAM ${save.settings.ballCam ? 'ON' : 'OFF'} · C`; },
    bumpScore(team) { const e = team ? s1 : s0; e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); },
    scoreboard(on) {
      if (!inMatch()) { sb.hidden = true; return; }
      sb.hidden = !on; if (on) sb.innerHTML = statsTable();
    },
    update(dt) {
      if (!inMatch()) return;
      if (M.score[0] !== lastS0) { lastS0 = M.score[0]; s0.textContent = lastS0; }
      if (M.score[1] !== lastS1) { lastS1 = M.score[1]; s1.textContent = lastS1; }
      const ct = M.overtime ? fmtUp(M.otTime) : fmtClock(M.clock);
      if (ct !== lastClock) { time.textContent = ct; lastClock = ct; ot.hidden = !M.overtime; }
      const p = M.player;
      const bv = Math.round(p.boost);
      if (bv !== lastBoost) {
        lastBoost = bv; num.textContent = bv;
        arc.setAttribute('stroke-dasharray', `${(ARC * p.boost / p.stats.boostMax).toFixed(1)} 999`);
        arc.setAttribute('stroke', p.boost > 70 ? '#ff8a1f' : p.boost > 30 ? '#ffd23f' : '#ff5fa8');
      }
      const so = p.supersonic && !p.demolished ? 1 : 0;
      if (so !== lastSpeed) { lastSpeed = so; speed.style.opacity = so; }
      // charged-shot meter (ready once it passes CHARGE_MIN) and the crystal speed-burst glow on the boost dial
      const cq = Math.round(p.charge * 50);
      if (cq !== lastCharge) {
        lastCharge = cq; chargeFill.style.transform = `scaleX(${(cq / 50).toFixed(2)})`;
        chargeEl.classList.toggle('on', cq > 0); chargeEl.classList.toggle('ready', p.charge >= CHARGE_MIN); chargeEl.classList.toggle('full', cq >= 50);
      }
      if (cq >= 50 && !chargeFull) Sfx.chargeReady();
      chargeFull = cq >= 50;
      const burst = p.burstT > 0;
      if (burst !== lastBurst) { lastBurst = burst; boostBox.classList.toggle('burst', burst); boostLbl.textContent = burst ? 'BURST' : 'BOOST'; }
      if (hintT > 0) { hintT -= dt; if (hintT <= 0) { hint.style.opacity = 0; setTimeout(() => { hint.hidden = true; }, 700); } }
      // off-screen ball arrow (from the interpolated ball the player sees, not the raw physics state)
      let shown = false;
      if (!M.ballHidden) {
        _pv.copy(ballView.mesh.position).project(camera);
        let x = _pv.x, y = _pv.y;
        const behind = _pv.z > 1;
        if (behind) { x = -x; y = -y; }
        if (behind || Math.abs(x) > 0.96 || Math.abs(y) > 0.94) {
          const a = Math.atan2(y, x), ex = Math.cos(a), ey = Math.sin(a);
          const s = Math.min(0.9 / Math.abs(ex || 1e-3), 0.85 / Math.abs(ey || 1e-3));
          const sx = (ex * s * 0.5 + 0.5) * innerWidth, sy = (-ey * s * 0.5 + 0.5) * innerHeight;
          const tf = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) rotate(${Math.atan2(ex, ey).toFixed(3)}rad)`;
          if (tf !== lastArrow) { lastArrow = tf; arrow.style.transform = tf; }
          shown = true;
        }
      }
      if (shown !== (arrow.style.display === 'block')) arrow.style.display = shown ? 'block' : 'none';
    },
  };
})();
let bannerTimer = 0;
function banner(main, sub, cls = 'yellow', dur = 1.5) {
  const b = $('#banner');
  b.innerHTML = `<span class="main ${cls} pop">${esc(main)}</span>${sub ? `<span class="sub">${sub}</span>` : ''}`;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { b.innerHTML = ''; }, dur * 1000);
}
function toast(pts, label) {
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `${esc(pts)}<span>${esc(label)}</span>`;
  const box = $('#toasts'); box.appendChild(t); setTimeout(() => t.remove(), 1900);
  while (box.children.length > 4) box.firstChild.remove();
}
function feed(html) {
  const box = $('#feed');
  const d = document.createElement('div'); d.className = 'feed-item'; d.innerHTML = html; box.prepend(d);
  setTimeout(() => d.remove(), 5000);
  while (box.children.length > 5) box.lastChild.remove();
}
function flash() { const f = $('#flash'); f.style.transition = 'none'; f.style.opacity = 0.35; requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = 0; }); }
function statsTable() {
  const rows = M.cars.slice().sort((a, b) => a.team - b.team || b.stat.score - a.stat.score);
  const mvp = rows.filter((c) => c.team === (M.score[0] >= M.score[1] ? 0 : 1)).sort((a, b) => b.stat.score - a.stat.score)[0];
  return `<table class="stats"><thead><tr><th>Penguin</th><th>Score</th><th>Goals</th><th>Assists</th><th>Saves</th><th>Shots</th><th>Demos</th></tr></thead><tbody>${rows.map((c) => `<tr class="t${c.team}${c === M.player ? ' me' : ''}"><td>${esc(c.name)}${c.level ? ` <span class="tag" style="background:${LEVELS[c.level].color}">${LEVELS[c.level].label}</span>` : ''}${M.state === 'over' && c === mvp ? '<span class="mvp">MVP</span>' : ''}</td><td>${c.stat.score}</td><td>${c.stat.goals}</td><td>${c.stat.assists}</td><td>${c.stat.saves}</td><td>${c.stat.shots}</td><td>${c.stat.demos}</td></tr>`).join('')}</tbody></table>`;
}

// ----------------------------------------------------------- frame loop
let lastFrame = performance.now(), acc = 0;
const MAX_CATCHUP = 30;   // ticks per frame at most (0.25 s at 120 Hz); below ~4 fps the game slows down rather than freezing
let demoAcc = 0;
const DEMO_FPS = 30;   // the demo match behind the menus only needs to be a moving backdrop
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastFrame) / 1000; lastFrame = now;
  if (dt > 0.25) dt = 0.25; if (dt < 0) dt = 0;
  pollPad();
  if (M.demo && !UI.showroomOn()) {
    demoAcc += dt;
    if (demoAcc < 1 / (DEMO_FPS + 1)) return;
    dt = Math.min(0.25, demoAcc); demoAcc = 0;
  } else {
    demoAcc = 0;
    autoQuality(dt);
  }
  tick(dt);
}
function tick(dt) {
  if (UI.showroomOn()) { renderShowroom(dt); Sfx.loops(false, 0, 0); return; }
  const running = M.state !== 'idle' && !M.paused;
  if (running) {
    let ts = 1;
    if (M.slowmo > 0) { M.slowmo -= dt; ts = GOAL_TS; }
    acc += dt * ts;
    // catch up after a slow frame (up to MAX_CATCHUP ticks, ~0.25 s), then drop the rest instead of spiralling
    let n = 0; while (acc >= DT && n < MAX_CATCHUP) { simTick(); acc -= DT; n++; }
    if (n >= MAX_CATCHUP) acc = 0;
  }
  const alpha = clamp(acc / DT, 0, 1);
  const fdt = running ? dt * (M.slowmo > 0 ? GOAL_TS : 1) : 0;
  for (const v of M.views) v.update(fdt, alpha, M.ball.p, !M.demo && v.car !== M.player);
  ballView.update(fdt, alpha, M.ball, M.ballHidden);
  FX.update(fdt); updatePadViews(fdt);
  M.excite = Math.max(0, M.excite - fdt * 0.3);
  crowdU.uTime.value += fdt; crowdU.uExcite.value = M.excite;
  for (const f of FRAME_HOOKS) f(fdt, dt);
  if (scene.userData.clouds) scene.userData.clouds.rotation.y += dt * 0.003;
  updateCamera(running ? dt : 0.016, alpha);
  HUD.update(dt);
  if (inMatch() && M.player && running) Sfx.loops(M.player.boosting, M.player.onGround ? M.player.v.length() : 0, M.excite * 0.14);
  else Sfx.loops(false, 0, 0);
  renderMain();
}
