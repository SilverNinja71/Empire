// =====================================================================
//  PHYSICS — arena distance field, ball, penguins, collisions, pads
//  Units are metres and seconds, scaled from the classic car-soccer numbers
//  (1 m = 100 uu). Every penguin, human or bot, runs through stepPenguin()
//  with the same control struct; only the stats object can differ.
// =====================================================================

// ----------------------------------------------------------- arena
const A = { kind: '' };
function setArena(kind) {
  const big = kind === 'large';
  const s = big ? 1.3 : 1;
  A.kind = kind; A.s = s;
  A.hx = 40.96 * s; A.hz = 51.2 * s; A.H = big ? 23 : 20.44;
  A.rc = 11 * s;          // corner radius (top view)
  A.r = 3.2;              // floor-to-wall ramp radius
  A.gw = big ? 10.6 : 8.93; A.gh = big ? 7.4 : 6.43; A.gd = 8.8;
  A.gz0 = A.hz - A.r - 1; // goal box starts a little inside the field so the ramp is cut away at the mouth
}
setArena('standard');

// distance from point to the nearest arena surface (positive inside the playable space)
function arenaD(x, y, z) {
  const qx = Math.abs(x) - (A.hx - A.rc), qz = Math.abs(z) - (A.hz - A.rc);
  const mx = qx > 0 ? qx : 0, mz = qz > 0 ? qz : 0;
  const d2 = Math.sqrt(mx * mx + mz * mz) + Math.min(Math.max(qx, qz), 0) - A.rc;
  const hy = A.H * 0.5;
  const dy = Math.abs(y - hy) - hy;
  const wx = d2 + A.r, wy = dy + A.r;
  const ox = wx > 0 ? wx : 0, oy = wy > 0 ? wy : 0;
  let D = A.r - (Math.min(Math.max(wx, wy), 0) + Math.sqrt(ox * ox + oy * oy));
  const az = Math.abs(z);
  if (az > A.gz0 - 3) {
    const cz = (A.gz0 + A.hz + A.gd) * 0.5, ez = (A.hz + A.gd - A.gz0) * 0.5;
    const bx = Math.abs(x) - A.gw, by = Math.abs(y - A.gh * 0.5) - A.gh * 0.5, bz = Math.abs(az - cz) - ez;
    const px = bx > 0 ? bx : 0, py = by > 0 ? by : 0, pz = bz > 0 ? bz : 0;
    const sdb = Math.sqrt(px * px + py * py + pz * pz) + Math.min(Math.max(bx, by, bz), 0);
    if (-sdb > D) D = -sdb;
  }
  return D;
}
function arenaN(x, y, z, out) {
  const e = 0.02;
  out.set(arenaD(x + e, y, z) - arenaD(x - e, y, z), arenaD(x, y + e, z) - arenaD(x, y - e, z), arenaD(x, y, z + e) - arenaD(x, y, z - e));
  const l = out.length();
  if (l < 1e-9) out.set(0, 1, 0); else out.multiplyScalar(1 / l);
  return out;
}

// ----------------------------------------------------------- ball
const BALL_R = 1.15, BALL_MAX = 66, BALL_MASS = 30, CAR_MASS = 180;
// spin: sidespin (about the vertical axis) bends the ball's path sideways (Magnus effect). It comes from glancing
// hits, hits while turning and charged shots, survives bounces, and slowly bleeds away in the air and on the ice.
const MAGNUS_K = 0.035, SPIN_HIT = 0.55, SPIN_MAX = 14, SIDESPIN_AIR_DECAY = 0.45, SIDESPIN_ICE_DECAY = 2.5;
const CURVE_SPIN = 3;   // sidespin (rad/s) above which the curve ribbon shows
// charged shots: hold to wind up (top speed drops a little while charging); the next touch spends the charge for
// extra power plus curve in the direction you steer at contact. Same rules for every penguin, bot or human.
const CHARGE_T = 0.8, CHARGE_FADE = 0.3, CHARGE_MIN = 0.25, CHARGE_CD = 0.6, CHARGE_POWER = 0.55, CHARGE_BASE = 9, CHARGE_SPIN = 9, CHARGE_SLOW = 0.15;
class Ball {
  constructor() { this.p = new V3(); this.v = new V3(); this.w = new V3(); this.pp = new V3(); this.reset(); }
  reset() { this.p.set(0, BALL_R + 0.02, 0); this.v.set(0, 0, 0); this.w.set(0, 0, 0); this.pp.copy(this.p); }
}
const _bn = new V3(), _bt = new V3();
// shared by the real ball and every prediction, so bots predict with the true rules (spin included)
function stepBallPhys(b, dt) {
  b.v.y -= G * dt;
  const drag = 1 - 0.03 * dt; b.v.x *= drag; b.v.y *= drag; b.v.z *= drag;
  // Magnus: (0, w.y, 0) x v pushes the ball sideways, perpendicular to its travel
  if (b.w) { const sy = b.w.y; if (sy > 0.05 || sy < -0.05) { const vx = b.v.x, vz = b.v.z; b.v.x += MAGNUS_K * sy * vz * dt; b.v.z -= MAGNUS_K * sy * vx * dt; } }
  const s2 = b.v.lengthSq(); if (s2 > BALL_MAX * BALL_MAX) b.v.multiplyScalar(BALL_MAX / Math.sqrt(s2));
  b.p.x += b.v.x * dt; b.p.y += b.v.y * dt; b.p.z += b.v.z * dt;
  const D = arenaD(b.p.x, b.p.y, b.p.z);
  if (D >= BALL_R) { if (b.w) { b.w.multiplyScalar(1 - 0.1 * dt); b.w.y *= 1 - SIDESPIN_AIR_DECAY * dt; } return 0; }
  arenaN(b.p.x, b.p.y, b.p.z, _bn);
  b.p.addScaledVector(_bn, BALL_R - D);
  const vn = b.v.dot(_bn);
  let impact = 0;
  if (vn < 0) {
    impact = -vn;
    _bt.copy(b.v).addScaledVector(_bn, -vn);
    b.v.addScaledVector(_bn, impact > 1.5 ? -vn * 1.6 : -vn);  // restitution 0.6, settles when slow
    const tl = _bt.length();
    if (tl > 1e-4) { const fr = Math.min(tl, impact * 0.22); b.v.addScaledVector(_bt, -fr / tl); }
  }
  _bt.copy(b.v).addScaledVector(_bn, -b.v.dot(_bn));
  const tl2 = _bt.length();
  if (tl2 > 1e-4) b.v.addScaledVector(_bt, -Math.min(tl2, 0.4 * dt) / tl2);
  if (b.w) {
    const sy = b.w.y;
    b.w.crossVectors(_bn, b.v).multiplyScalar(1 / BALL_R);
    if (_bn.y > 0.7) b.w.y = sy * Math.max(0, 1 - SIDESPIN_ICE_DECAY * dt);   // rolling on the ice keeps (and slowly loses) its sidespin
  }
  return impact;
}
const _gp = { p: new V3(), v: new V3(), w: new V3() };
// +1 = ball ends up in the +Z (orange) net, -1 = -Z (blue) net, 0 = no goal within the horizon
function predictGoal(p, v, horizon, w) {
  _gp.p.copy(p); _gp.v.copy(v); if (w) _gp.w.copy(w); else _gp.w.set(0, 0, 0);
  const n = Math.ceil(horizon * 60);
  for (let i = 0; i < n; i++) {
    stepBallPhys(_gp, 1 / 60);
    if (Math.abs(_gp.p.z) > A.hz + BALL_R) return _gp.p.z > 0 ? 1 : -1;
  }
  return 0;
}

// ----------------------------------------------------------- penguin stats
// penguins run ~15% quicker than the classic car numbers; turning scales with it so handling stays tight
const SPEED_K = 1.15;
const VMAX = 23 * SPEED_K;
const STOCK = Object.freeze({ maxThrottle: 14.1 * SPEED_K, maxBoostSpeed: VMAX, boostAccel: 9.92 * SPEED_K, boostMax: 100, jump: 2.92, kick: 1, turn: 1, air: 1 });
function statsFromUpgrades(u) {
  return {
    maxThrottle: 14.1 * SPEED_K * (1 + 0.02 * u.speed), maxBoostSpeed: VMAX * (1 + 0.02 * u.speed),
    boostAccel: 9.92 * SPEED_K * (1 + 0.03 * u.thrust), boostMax: 100 + 10 * u.tank,
    jump: 2.92 * (1 + 0.04 * u.flip), kick: 1 + 0.05 * u.kick, turn: 1 + 0.04 * u.grip, air: 1 + 0.03 * u.grip,
  };
}

// ----------------------------------------------------------- penguin body
const RIDE_H = 0.32;
const DIVE_T = 0.4, DIVE_DIP = 1.75;   // belly dive length (s) and dip rate (rad/s): ~20° dip, then level again
const DIVE_KICK = 1.3;
const JUMP_BUFFER = 0.1;               // s: a jump pressed this long before it's allowed (landing, self-righting) fires on the first legal tick                 // extra hit power while diving (replaces the old flip's spin power)
// stabilised air control limits: nose down (W), nose up (S, for aerials), turn rate, easing rate.
// There is no roll: penguins always stay level side to side.
const AIR_NOSE_DOWN = 0.6, AIR_NOSE_UP = 1.35, AIR_YAW_RATE = 3.7, AIR_LEVEL_RATE = 6;
// ice crystal pads: speed burst on top of the refill (top speed and acceleration x BURST_K, easing out at the end)
const BURST_T = 1.5, BURST_K = 1.35, BURST_EASE = 0.45;
const _eu = new THREE.Euler();
const HB = new V3(0.42, 0.3, 0.74), HB_OFF = new V3(0, 0.02, 0.06); // ball hitbox (oriented box)
let nextCarId = 1;
class Penguin {
  constructor(team, name, stats, opts = {}) {
    this.id = nextCarId++; this.team = team; this.name = name; this.stats = stats;
    this.isBot = !!opts.bot; this.level = opts.level || null;
    this.cos = opts.cos || { hat: 'none', skin: 'classic', trail: 'puff' };
    this.gold = !!opts.gold; this.lv = opts.lv || 0;
    this.p = new V3(); this.v = new V3(); this.q = new Q(); this.w = new V3();
    this.pp = new V3(); this.pq = new Q();
    this.fwd = new V3(0, 0, 1); this.up = new V3(0, 1, 0); this.left = new V3(1, 0, 0); this.n = new V3(0, 1, 0);
    this.ctrl = { throttle: 0, steer: 0, pitch: 0, roll: 0, jump: false, boost: false, slide: false, charge: false };
    this.stat = { score: 0, goals: 0, assists: 0, saves: 0, shots: 0, demos: 0, touches: 0 };
    this.events = [];
    this.role = 'attack';
    this.resetState();
  }
  resetState() {
    this.v.set(0, 0, 0); this.w.set(0, 0, 0);
    this.boost = 33.3; this.onGround = true; this.airT = 0; this.jumped = false; this.doubleJumped = false;
    this.jumping = false; this.jumpT = 0; this.jumpGrace = 0; this.flipT = 0; this.rightT = 0; this.turtleT = 0;
    this.prevJump = false; this.jumpBuf = 0; this.hitCd = 0; this.supersonic = false; this.boosting = false; this.touchingBad = false;
    this.demolished = false; this.respawnT = 0; this.landImpact = 0; this.justLanded = false; this.lastTouchT = -10;
    this.charge = 0; this.chargeCd = 0; this.burstT = 0;
  }
  place(x, z, yaw) {
    this.p.set(x, RIDE_H, z); this.q.setFromAxisAngle(UP, yaw); this.pp.copy(this.p); this.pq.copy(this.q);
    updateBasis(this); this.n.set(0, 1, 0);
  }
}
function updateBasis(c) { c.fwd.set(0, 0, 1).applyQuaternion(c.q); c.up.set(0, 1, 0).applyQuaternion(c.q); c.left.set(1, 0, 0).applyQuaternion(c.q); }
function integrateQ(q, w, dt) {
  const ax = w.x * dt * 0.5, ay = w.y * dt * 0.5, az = w.z * dt * 0.5;
  const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
  q.set(qx + ax * qw + ay * qz - az * qy, qy + ay * qw + az * qx - ax * qz, qz + az * qw + ax * qy - ay * qx, qw - ax * qx - ay * qy - az * qz);
  q.normalize();
}
const CURVE = [[0, 0.69], [5, 0.398], [10, 0.235], [15, 0.1375], [17.5, 0.11], [23, 0.088]];
const TURN_K = 1.2;   // turning boost over the classic car curve
function curvature(v) {
  v /= SPEED_K;
  if (v <= 0) return TURN_K * CURVE[0][1];
  for (let i = 1; i < CURVE.length; i++) if (v < CURVE[i][0]) { const a = CURVE[i - 1], b = CURVE[i]; return TURN_K * (a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0])); }
  return TURN_K * 0.088;
}
function throttleAccel(v, max) { const knee = max * 0.993; if (v < knee) return SPEED_K * (16 - 14.4 * (v / knee)); if (v < max) return SPEED_K * 1.6 * (max - v) / (max - knee); return 0; }

const _n = new V3(), _t = new V3(), _a = new V3(), _b = new V3(), _c = new V3(), _wl = new V3();
const _qa = new Q(), _qb = new Q(), _qi = new Q(), _qid = new Q();

function stepPenguin(c, dt, M) {
  c.pp.copy(c.p); c.pq.copy(c.q);
  if (c.demolished) { c.respawnT -= dt; if (c.respawnT <= 0) M.respawn(c); return; }
  const k = c.ctrl, S = c.stats;
  updateBasis(c);
  // crystal speed burst (eases out over its last BURST_EASE s) and the charged-shot wind-up
  if (c.burstT > 0) c.burstT = Math.max(0, c.burstT - dt);
  if (c.chargeCd > 0) c.chargeCd -= dt;
  if (k.charge && c.chargeCd <= 0) c.charge = Math.min(1, c.charge + dt / CHARGE_T);
  else if (c.charge > 0) c.charge = Math.max(0, c.charge - dt / CHARGE_FADE);
  const bm = 1 + (BURST_K - 1) * Math.min(1, c.burstT / BURST_EASE);
  const sm = bm * (k.charge ? 1 - CHARGE_SLOW * c.charge : 1);   // top-speed multiplier
  // a fresh press arms the jump buffer; whatever uses the press clears it
  if (k.jump && !c.prevJump) c.jumpBuf = JUMP_BUFFER; else if (c.jumpBuf > 0) c.jumpBuf -= dt;
  c.prevJump = k.jump;
  const jumpPressed = c.jumpBuf > 0;
  c.hitCd -= dt; c.jumpGrace -= dt;
  const D = arenaD(c.p.x, c.p.y, c.p.z);
  arenaN(c.p.x, c.p.y, c.p.z, _n);
  const upright = c.up.dot(_n);
  const vn0 = c.v.dot(_n);
  const boosting = k.boost && c.boost > 0;
  c.boosting = boosting;
  const grounded = D < RIDE_H + 0.07 && upright > 0.55 && c.jumpGrace <= 0 && vn0 < 1.5;
  if (grounded && !c.onGround) { c.justLanded = true; c.landImpact = Math.max(0, -vn0); }
  c.onGround = grounded;

  if (grounded) {
    c.n.copy(_n);
    c.airT = 0; c.jumped = false; c.doubleJumped = false; c.flipT = 0; c.jumping = false; c.rightT = 0; c.airInit = false;
    _qa.setFromUnitVectors(c.up, _n);
    _qb.copy(_qid).slerp(_qa, Math.min(1, dt * 20));
    c.q.premultiply(_qb).normalize(); updateBasis(c);
    const vn = c.v.dot(_n); if (vn < 0) c.v.addScaledVector(_n, -vn);
    const fs = c.v.dot(c.fwd);
    const thr = boosting ? 1 : k.throttle;
    let acc;
    if (thr * fs < 0 && Math.abs(fs) > 0.3) acc = -Math.sign(fs) * 35 * SPEED_K * Math.abs(thr);          // braking
    else if (Math.abs(thr) > 0.02) acc = Math.sign(thr) * throttleAccel(Math.abs(fs), S.maxThrottle * sm) * bm * Math.abs(thr);
    else acc = -Math.sign(fs) * Math.min(5.25 * SPEED_K, Math.abs(fs) / dt);                                 // coasting
    c.v.addScaledVector(c.fwd, acc * dt);
    if (boosting) c.v.addScaledVector(c.fwd, S.boostAccel * bm * dt);
    const sp = Math.abs(fs);
    const curv = curvature(sp) * S.turn * (k.slide ? 1.45 : 1);
    const yawRate = clamp(-k.steer * curv * fs, -7, 7);
    c.w.copy(_n).multiplyScalar(yawRate);
    const vl = c.v.dot(c.left);
    const grip = k.slide ? 1.4 : 11;
    c.v.addScaledVector(c.left, -vl * (1 - Math.exp(-grip * dt)));
    c.v.y -= G * dt;
    if (!(_n.y < -0.2 && Math.abs(fs) < 6)) c.v.addScaledVector(_n, -3.25 * dt);                  // sticky force
    if (jumpPressed) {
      c.jumpBuf = 0;
      c.v.addScaledVector(c.up, S.jump);
      c.jumping = true; c.jumpT = 0; c.jumped = true; c.jumpGrace = 0.1; c.onGround = false;
      c.events.push('jump');
    }
  } else {
    c.airT += dt;
    if (c.jumping) {
      c.jumpT += dt;
      if (k.jump && c.jumpT < 0.2) c.v.addScaledVector(c.up, 14.58 * (S.jump / 2.92) * dt);
      else c.jumping = false;
    }
    if (jumpPressed && !c.doubleJumped && (!c.jumped || c.airT < 1.25) && c.rightT <= 0 && !c.touchingBad) {
      const df = k.pitch, dr = k.steer;
      const mag = Math.hypot(df, dr);
      c.doubleJumped = true; c.jumping = false; c.jumpBuf = 0;
      if (mag > 0.5) {
        const fx = df / mag, rx = dr / mag;
        _a.copy(c.fwd); _a.y = 0; if (_a.lengthSq() < 1e-4) _a.set(0, 0, 1); _a.normalize();
        _b.set(-_a.z, 0, _a.x);                   // right-hand direction
        c.v.addScaledVector(_a, fx * 5 * SPEED_K).addScaledVector(_b, rx * 5 * SPEED_K);
        if (c.v.y < 0) c.v.y *= 0.2; else c.v.y *= 0.65;   // dives stall the fall
        // belly dive: a lunge with a small dip toward the dive direction, no full-body tumble
        c.flipT = DIVE_T; c.flipF = fx; c.flipR = rx;
        c.events.push('flip');
      } else {
        c.v.addScaledVector(c.up, S.jump);
        c.events.push('jump');
      }
    }
    if (c.flipT > 0) {
      // dip the nose toward a forward/back dive for the first half, come back level for the second half
      // (side dives just lunge sideways: no rolling)
      const dir = c.flipT > DIVE_T * 0.5 ? 1 : -1;
      c.flipT -= dt;
      _wl.set(c.flipF * DIVE_DIP * dir, 0, 0);
      c.w.copy(_wl).applyQuaternion(c.q);
      if (c.flipT <= 0) c.w.set(0, 0, 0);
      c.airInit = false;
    }
    else if (c.rightT > 0) { c.rightT -= dt; c.airInit = false; }
    else {
      // stabilised air control: the penguin stays upright and only tilts to a limited angle,
      // easing back to level when the stick is released (no free spinning)
      if (!c.airInit) {
        let hx = c.fwd.x, hz = c.fwd.z;
        if (Math.hypot(hx, hz) < 0.3) {
          if (Math.hypot(c.v.x, c.v.z) > 1) { hx = c.v.x; hz = c.v.z; }
          else { const s = c.fwd.y > 0 ? -1 : 1; hx = c.up.x * s; hz = c.up.z * s; }
        }
        c.airYaw = Math.atan2(hx, hz); c.airInit = true;
      }
      // A/D turn, W/S tilt the nose; roll inputs are ignored so the penguin never rolls
      c.airYaw -= k.steer * AIR_YAW_RATE * S.air * dt;
      const tp = k.pitch >= 0 ? k.pitch * AIR_NOSE_DOWN : k.pitch * AIR_NOSE_UP;
      _qa.setFromEuler(_eu.set(tp, c.airYaw, 0, 'YXZ'));
      _qb.copy(c.q).slerp(_qa, 1 - Math.exp(-AIR_LEVEL_RATE * dt));
      // angular velocity that carries q to the eased target this tick (keeps ball contacts consistent)
      _qa.copy(_qb).multiply(_qi.copy(c.q).invert());
      if (_qa.w < 0) { _qa.x = -_qa.x; _qa.y = -_qa.y; _qa.z = -_qa.z; _qa.w = -_qa.w; }
      const half = Math.acos(clamp(_qa.w, -1, 1)), sh = Math.sin(half);
      if (sh > 1e-6) c.w.set(_qa.x / sh, _qa.y / sh, _qa.z / sh).multiplyScalar(2 * half / dt); else c.w.set(0, 0, 0);
    }
    if (boosting) c.v.addScaledVector(c.fwd, S.boostAccel * bm * dt);
    c.v.addScaledVector(c.fwd, k.throttle * 0.66 * dt);
    c.v.y -= G * dt;
  }

  const sp2 = c.v.length(), cap = S.maxBoostSpeed * sm; if (sp2 > cap) c.v.multiplyScalar(cap / sp2);
  c.p.addScaledVector(c.v, dt);
  integrateQ(c.q, c.w, dt);
  updateBasis(c);

  // surfaces
  const D2 = arenaD(c.p.x, c.p.y, c.p.z);
  c.touchingBad = false;
  if (D2 < 0.75) {
    arenaN(c.p.x, c.p.y, c.p.z, _n);
    const up2 = c.up.dot(_n);
    const cd = up2 > 0.6 ? RIDE_H : (up2 < -0.6 ? 0.34 : 0.44);
    if (D2 < cd) {
      c.p.addScaledVector(_n, cd - D2);
      const vn = c.v.dot(_n);
      if (vn < 0) c.v.addScaledVector(_n, -vn * (up2 > 0.6 ? 1 : 1.2));
      if (up2 <= 0.55) {
        c.touchingBad = true;
        _t.copy(c.v).addScaledVector(_n, -c.v.dot(_n));
        c.v.addScaledVector(_t, -Math.min(1, 3 * dt));
        if (c.rightT <= 0) c.w.multiplyScalar(Math.max(0, 1 - 4 * dt));
        c.turtleT += dt;
        if ((jumpPressed || c.turtleT > 1.4) && c.rightT <= 0) {
          // stuck on back or side: hop and roll back onto the belly
          c.v.addScaledVector(_n, 3.4);
          _a.crossVectors(c.up, _n);
          let ax = _a.length();
          if (ax < 1e-3) { _a.copy(c.fwd); ax = 1; }
          _a.multiplyScalar(1 / ax);
          const ang = Math.acos(clamp(up2, -1, 1));
          c.w.copy(_a).multiplyScalar(ang / 0.45);
          c.rightT = 0.45; c.turtleT = 0; c.doubleJumped = true; c.airT = 2; c.jumpGrace = 0.05; c.jumpBuf = 0;
        }
      } else c.turtleT = 0;
    } else if (c.onGround && D2 > RIDE_H && D2 < RIDE_H + 0.16) {
      if (c.v.dot(_n) <= 0.3) c.p.addScaledVector(_n, RIDE_H - D2);
    }
  } else c.turtleT = 0;

  if (boosting) c.boost = Math.max(0, c.boost - 33.3 * dt);
  const sp3 = c.v.length();
  if (sp3 >= 22 * SPEED_K) c.supersonic = true; else if (sp3 < 21 * SPEED_K) c.supersonic = false;
}

// ----------------------------------------------------------- penguin vs ball
function hitScale(v) { if (v < 5) return 0.65; if (v < 23) return 0.65 - 0.1 * (v - 5) / 18; return 0.55 - 0.25 * Math.min(1, (v - 23) / 23); }
const HIT = { power: 0, point: new V3(), normal: new V3(), charged: 0 };
function collideBallCar(c, b) {
  if (c.demolished) return null;
  _qi.copy(c.q).invert();
  _a.copy(b.p).sub(c.p).applyQuaternion(_qi).sub(HB_OFF);
  const cx = clamp(_a.x, -HB.x, HB.x), cy = clamp(_a.y, -HB.y, HB.y), cz = clamp(_a.z, -HB.z, HB.z);
  let dx = _a.x - cx, dy = _a.y - cy, dz = _a.z - cz;
  let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist >= BALL_R) return null;
  HIT.charged = 0;
  if (dist < 1e-5) { dx = _a.x; dy = _a.y + 0.01; dz = _a.z; dist = Math.max(1e-5, Math.hypot(dx, dy, dz)); }
  _n.set(dx / dist, dy / dist, dz / dist).applyQuaternion(c.q);
  _c.set(cx, cy, cz).add(HB_OFF).applyQuaternion(c.q).add(c.p);
  const pen = BALL_R - Math.min(dist, BALL_R);
  b.p.addScaledVector(_n, pen * 0.92); c.p.addScaledVector(_n, -pen * 0.08);
  _t.copy(_c).sub(c.p);
  _b.crossVectors(c.w, _t).add(c.v);           // car surface velocity at the contact
  _a.copy(b.v).sub(_b);
  const vn = _a.dot(_n);
  let power = 0;
  if (vn < 0) {
    const j = -(1 + 0.05) * vn / (1 / BALL_MASS + 1 / CAR_MASS);
    b.v.addScaledVector(_n, j / BALL_MASS);
    c.v.addScaledVector(_n, -j / CAR_MASS);
    power = -vn;
    if (c.hitCd <= 0) {
      const rel = Math.min(46, _a.length());
      _t.copy(b.p).sub(c.p); _t.y *= 0.35; _t.normalize();
      const f = _t.dot(c.fwd); _t.addScaledVector(c.fwd, -0.35 * f).normalize();
      // a wound-up charge adds power (and a flat kick so even a slow touch flies) and curves toward the steer side
      const ch = c.charge >= CHARGE_MIN ? c.charge : 0;
      b.v.addScaledVector(_t, rel * hitScale(rel) * c.stats.kick * (c.flipT > 0 ? DIVE_KICK : 1) * (1 + CHARGE_POWER * ch) + CHARGE_BASE * ch);
      if (ch > 0) { b.w.y -= c.ctrl.steer * CHARGE_SPIN * ch; c.charge = 0; c.chargeCd = CHARGE_CD; HIT.charged = ch; }
      c.hitCd = 0.12;
      power = Math.max(power, rel + 12 * ch);
    }
    // friction at the contact spins the ball: glancing hits and turning penguins put sidespin on it
    _t.copy(_a).addScaledVector(_n, -_a.dot(_n));
    b.w.addScaledVector(_c.crossVectors(_n, _t), -SPIN_HIT / BALL_R);
    const wl = b.w.length(); if (wl > SPIN_MAX) b.w.multiplyScalar(SPIN_MAX / wl);
  }
  HIT.power = power; HIT.normal.copy(_n);
  HIT.point.copy(b.p).addScaledVector(_n, -BALL_R);
  return HIT;
}

// ----------------------------------------------------------- penguin vs penguin
const _s1 = new V3(), _s2 = new V3(), _e1 = new V3(), _e2 = new V3(), _cp1 = new V3(), _cp2 = new V3();
function closestSegSeg(p1, q1, p2, q2, c1, c2) {
  const d1x = q1.x - p1.x, d1y = q1.y - p1.y, d1z = q1.z - p1.z;
  const d2x = q2.x - p2.x, d2y = q2.y - p2.y, d2z = q2.z - p2.z;
  const rx = p1.x - p2.x, ry = p1.y - p2.y, rz = p1.z - p2.z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * rx + d2y * ry + d2z * rz;
  const cc = d1x * rx + d1y * ry + d1z * rz, bb = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - bb * bb;
  let s = den > 1e-8 ? clamp((bb * f - cc * e) / den, 0, 1) : 0;
  let t = (bb * s + f) / e;
  if (t < 0) { t = 0; s = clamp(-cc / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((bb - cc) / a, 0, 1); }
  c1.set(p1.x + d1x * s, p1.y + d1y * s, p1.z + d1z * s);
  c2.set(p2.x + d2x * t, p2.y + d2y * t, p2.z + d2z * t);
}
function collideCars(a, b, M) {
  if (a.demolished || b.demolished) return;
  const dx = b.p.x - a.p.x, dy = b.p.y - a.p.y, dz = b.p.z - a.p.z;
  if (dx * dx + dy * dy + dz * dz > 4) return;
  _s1.copy(a.p).addScaledVector(a.fwd, -0.36); _e1.copy(a.p).addScaledVector(a.fwd, 0.36);
  _s2.copy(b.p).addScaledVector(b.fwd, -0.36); _e2.copy(b.p).addScaledVector(b.fwd, 0.36);
  closestSegSeg(_s1, _e1, _s2, _e2, _cp1, _cp2);
  _n.copy(_cp2).sub(_cp1);
  let dist = _n.length();
  const R2 = 0.96;
  if (dist >= R2) return;
  if (dist < 1e-4) { _n.set(dx, dy, dz); dist = _n.length() || 1; }
  _n.multiplyScalar(1 / dist);
  const pen = R2 - Math.min(dist, R2);
  a.p.addScaledVector(_n, -pen * 0.5); b.p.addScaledVector(_n, pen * 0.5);
  const va = a.v.dot(_n), vb = b.v.dot(_n);
  const rel = vb - va;
  if (rel >= 0) return;
  if (a.team !== b.team) {
    if (a.supersonic && a.fwd.dot(_n) > 0.55 && va > 14 * SPEED_K) { M.demolish(b, a); return; }
    if (b.supersonic && b.fwd.dot(_n) < -0.55 && -vb > 14 * SPEED_K) { M.demolish(a, b); return; }
  }
  const j = -rel * 0.5 * 1.3;
  a.v.addScaledVector(_n, -j); b.v.addScaledVector(_n, j);
  // bumps: the faster penguin knocks the other one off its feet
  if (va > 7 && a.fwd.dot(_n) > 0.5) { b.v.addScaledVector(_n, va * 0.3); b.v.y += va * 0.17; b.jumpGrace = 0.15; }
  else if (-vb > 7 && b.fwd.dot(_n) < -0.5) { a.v.addScaledVector(_n, vb * 0.3); a.v.y += -vb * 0.17; a.jumpGrace = 0.15; }
  M.onBump(a, b, Math.abs(rel));
}

// ----------------------------------------------------------- boost pads: 6 ice crystals (4 corners, 2 mid-rink) + small fish
// Crystals fill the tank and give a BURST_K speed burst for BURST_T seconds, then regrow in 10 s; small fish give 12 boost.
const BIG_PADS = [[-30.72, -40.96], [30.72, -40.96], [-35.84, 0], [35.84, 0], [-30.72, 40.96], [30.72, 40.96]];
// 18 small pads: the classic layout with the inner ring and centre-line pads removed for a cleaner, more open field
const SMALL_PADS = [[0, -42.4], [-17.92, -41.84], [17.92, -41.84], [-35.84, -24.84], [35.84, -24.84], [-17.88, -23], [17.88, -23],
  [-20.48, -10.36], [20.48, -10.36], [-20.48, 10.36], [20.48, 10.36],
  [-17.88, 23], [17.88, 23], [-35.84, 24.84], [35.84, 24.84], [-17.92, 41.84], [17.92, 41.84], [0, 42.4]];
function makePads() {
  const pads = [];
  for (const [x, z] of BIG_PADS) pads.push({ x: x * A.s, z: z * A.s, big: true, active: true, t: 0 });
  for (const [x, z] of SMALL_PADS) pads.push({ x: x * A.s, z: z * A.s, big: false, active: true, t: 0 });
  return pads;
}
function updatePads(M, dt) {
  for (const p of M.pads) {
    if (!p.active) { p.t -= dt; if (p.t <= 0) p.active = true; continue; }
    const r = p.big ? 2.08 : 1.44;
    for (const c of M.cars) {
      // crystals are worth taking even on a full tank (the burst); fish only feed a tank with room
      if (c.demolished || c.p.y > 2.2 || (!p.big && c.boost >= c.stats.boostMax - 0.01)) continue;
      const dx = c.p.x - p.x, dz = c.p.z - p.z;
      if (dx * dx + dz * dz < r * r) {
        if (p.big) {
          c.boost = c.stats.boostMax; c.burstT = BURST_T;
          const fs = c.v.dot(c.fwd), room = c.stats.maxBoostSpeed * BURST_K - c.v.length();
          if (fs > 0 && room > 0) c.v.addScaledVector(c.fwd, Math.min(fs * (BURST_K - 1), room));
        } else c.boost = Math.min(c.stats.boostMax, c.boost + 12);
        p.active = false; p.t = p.big ? 10 : 4;
        M.onPickup(c, p);
        break;
      }
    }
  }
}

// kickoff spots (blue side, mirrored for orange) and respawn spots
const KICKOFF = [[-20.48, -25.6], [20.48, -25.6], [-2.56, -38.4], [2.56, -38.4], [0, -46.08]];
const RESPAWN = [[-23.04, -46.08], [23.04, -46.08], [-26.88, -46.08], [26.88, -46.08], [0, -46.08]];
