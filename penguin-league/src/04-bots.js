// =====================================================================
//  BOTS — every bot drives a stock penguin through the same control
//  struct a human uses (throttle, steer, pitch, roll, jump, boost, slide).
//  Difficulty only changes how well they play: how late they see the ball,
//  how far ahead they predict, how precise their aim is, and which
//  mechanics they know (flips, jump shots, aerials, rotations, kickoffs).
// =====================================================================
const LEVELS = {
  easy: {
    key: 'easy', label: 'Easy', color: '#72dc4e', blurb: 'Chases the ball, rarely boosts, never leaves the ground.',
    react: 0.38, aim: 0.55, whiff: 1.5, horizon: 1.0, boost: 0.25, jumpShot: 0, aerialH: 0, dodge: 0.12, rotate: 0,
    kickBoost: false, kickFlip: false, recover: 0.4, think: 7, cap: 0.85, pads: 0, demo: 0, shadow: false, flipSpeed: false, hesitate: 0.8, charge: 0,
    reward: 1, skill: [1, 1, 0, 1, 1],
  },
  normal: {
    key: 'normal', label: 'Normal', color: '#ffd23f', blurb: 'Reads bounces, flips into shots, tries low aerials.',
    react: 0.2, aim: 0.15, whiff: 0.55, horizon: 2.4, boost: 0.7, jumpShot: 0.4, aerialH: 5.5, dodge: 0.5, rotate: 1,
    kickBoost: true, kickFlip: false, recover: 0.75, think: 15, cap: 1, pads: 0.4, demo: 0, shadow: false, flipSpeed: false, hesitate: 0.2, charge: 0.3,
    reward: 1.6, skill: [3, 3, 2, 3, 3],
  },
  hard: {
    key: 'hard', label: 'Hard', color: '#ff8a1f', blurb: 'Rotates with teammates, shadows defence, flips kickoffs.',
    react: 0.15, aim: 0.09, whiff: 0.35, horizon: 3.2, boost: 0.9, jumpShot: 0.7, aerialH: 9, dodge: 0.75, rotate: 2,
    kickBoost: true, kickFlip: true, recover: 0.9, think: 24, cap: 1, pads: 0.8, demo: 0.03, shadow: true, flipSpeed: false, hesitate: 0.04, charge: 0.55,
    reward: 2.4, skill: [4, 4, 4, 4, 4],
  },
  god: {
    key: 'god', label: 'God', color: '#8d5bff', blurb: 'Near-instant reads, full aerials, speed flips, demos.',
    react: 0.035, aim: 0.012, whiff: 0, horizon: 4.5, boost: 1, jumpShot: 1, aerialH: 19, dodge: 1, rotate: 2,
    kickBoost: true, kickFlip: true, recover: 1.3, think: 60, cap: 1, pads: 1, demo: 0.1, shadow: true, flipSpeed: true, hesitate: 0, charge: 0.8,
    reward: 4, skill: [5, 5, 5, 5, 5],
  },
};
const LEVEL_ORDER = ['easy', 'normal', 'hard', 'god'];
const SKILL_NAMES = ['Reaction', 'Aim', 'Aerials', 'Teamwork', 'Boost use'];

// ----------------------------------------------------------- ball prediction (per perception delay)
const PRED_N = 300; // 5 s at 60 Hz
function makePred() { const s = []; for (let i = 0; i < PRED_N; i++) s.push({ t: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }); return { s, n: 0, t0: 0 }; }
const _pb = { p: new V3(), v: new V3(), w: new V3() };
function computePred(pred, p, v, w, t0, horizon) {
  _pb.p.copy(p); _pb.v.copy(v); _pb.w.copy(w);
  const n = Math.min(PRED_N, Math.ceil(horizon * 60));
  for (let i = 0; i < n; i++) {
    stepBallPhys(_pb, 1 / 120); stepBallPhys(_pb, 1 / 120);
    const o = pred.s[i]; o.t = t0 + (i + 1) / 60; o.x = _pb.p.x; o.y = _pb.p.y; o.z = _pb.p.z; o.vx = _pb.v.x; o.vy = _pb.v.y; o.vz = _pb.v.z;
    if (Math.abs(_pb.p.z) > A.hz + BALL_R) { pred.n = i + 1; pred.t0 = t0; return; }
  }
  pred.n = n; pred.t0 = t0;
}
function sliceAt(pred, t) {
  if (!pred || pred.n === 0) return null;
  const i = Math.round((t - pred.t0) * 60) - 1;
  if (i < 0) return pred.s[0];
  if (i >= pred.n) return pred.s[pred.n - 1];
  return pred.s[i];
}

// ----------------------------------------------------------- shared helpers
const _aim = { x: 0, z: 1 };
// horizontal direction the bot wants the ball to travel after the touch
function aimFor(team, bx, bz, cx, cz, clear, out) {
  const oz = team === 0 ? A.hz : -A.hz, own = -oz;
  let ax = bx - cx, az = bz - cz; const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
  let sx, sz;
  if (clear) { sx = bx; sz = bz - own; }
  else { const tx = clamp(bx * 0.35, -(A.gw - 2.4), A.gw - 2.4); sx = tx - bx; sz = oz - bz; }
  const sl = Math.hypot(sx, sz) || 1; sx /= sl; sz /= sl;
  const cosc = sx * ax + sz * az;
  const w = clamp(cosc * 1.6 + 0.75, 0, 1);
  let mx = sx * w + ax * (1 - w), mz = sz * w + az * (1 - w);
  const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
  const gx = -bx, gz = own - bz, gl = Math.hypot(gx, gz) || 1;
  if ((mx * gx + mz * gz) / gl > 0.25) {        // never steer the ball at our own net
    let px = -gz / gl, pz = gx / gl;
    if (px * ax + pz * az < 0) { px = -px; pz = -pz; }
    mx = px; mz = pz;
  }
  out.x = mx; out.z = mz;
}
// air steering for the stabilised air control: point the nose along fwdT (pitch within the
// air limits) and turn toward its heading; the physics keeps the penguin upright
function orientTo(c, fwdT, upT, gain, k) {
  const hl = Math.hypot(fwdT.x, fwdT.z), up = Math.atan2(fwdT.y, hl);
  k.pitch = up >= 0 ? -clamp(up / AIR_NOSE_UP, 0, 1) : clamp(-up / AIR_NOSE_DOWN, 0, 1);
  if (hl > 0.05 && c.airInit) {
    let dh = Math.atan2(fwdT.x, fwdT.z) - c.airYaw; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    k.steer = clamp(-dh * 3 * gain, -1, 1);
  } else k.steer = 0;
  k.roll = 0; k.slide = false;
}
function localDir(c, x, y, z, out) { _qi.copy(c.q).invert(); return out.set(x - c.p.x, y - c.p.y, z - c.p.z).applyQuaternion(_qi); }

// height gained by a full-hold jump after t seconds (car centre), used for jump-shot timing
function jumpHeightAt(t, jump) {
  const hold = Math.min(t, 0.2), a = 14.58 * (jump / 2.92) - G;
  let y = jump * hold + 0.5 * a * hold * hold;
  if (t > 0.2) { const v = jump + a * 0.2, tt = t - 0.2; y += v * tt - 0.5 * G * tt * tt; }
  return y;
}
// fastest speed whose turning circle still fits radius r
function speedForRadius(r) { let v = 1; while (v < VMAX && 1 / curvature(v + 0.5) <= r) v += 0.5; return v; }
function jumpTimeFor(h, jump) { for (let t = 0.02; t < 1.0; t += 0.02) if (jumpHeightAt(t, jump) >= h) return t; return -1; }

// ----------------------------------------------------------- maneuvers
class DodgeMan {
  // jump (hold), wait, then flip in a direction (or toward the ball)
  constructor(o) { this.t = 0; this.hold = o.hold ?? 0.06; this.wait = o.wait ?? 0.06; this.f = o.f ?? 1; this.r = o.r ?? 0; this.aimBall = !!o.aimBall; this.aimAt = o.aimAt || null; this.boost = !!o.boost; this.dodged = false; this.dt2 = 0; this.noFlip = !!o.noFlip; }
  step(bot, dt, M) {
    const c = bot.car, k = c.ctrl; this.t += dt;
    k.throttle = 1; k.slide = false; k.roll = 0;
    k.boost = this.boost && c.boost > 0 && this.t < this.hold + this.wait + 0.1;
    if (this.t <= this.hold) { k.jump = true; k.pitch = 0; k.steer = 0; return false; }
    if (!this.dodged) {
      k.jump = false;
      if (this.t < this.hold + this.wait) {
        // keep the nose level while waiting
        if (!c.onGround) orientTo(c, _vl.set(c.fwd.x, 0, c.fwd.z).lengthSq() > 0.01 ? _vl.set(c.fwd.x, 0, c.fwd.z) : c.fwd, UP, 0.6, k);
        k.boost = this.boost && c.boost > 0;
        return false;
      }
      if (c.onGround || this.noFlip) return c.onGround || this.t > 1.4;
      let f = this.f, r = this.r;
      if (this.aimBall || this.aimAt) { const ax = this.aimAt ? this.aimAt[0] : M.ball.p.x, az = this.aimAt ? this.aimAt[1] : M.ball.p.z; localDir(c, ax, M.ball.p.y, az, _vl); const l = Math.hypot(_vl.x, _vl.z) || 1; f = _vl.z / l; r = -_vl.x / l; }
      this.f = f; this.r = r;
      k.jump = true; k.pitch = f; k.steer = r; this.dodged = true; return false;
    }
    this.dt2 += dt; k.jump = false; k.pitch = 0; k.steer = 0;
    return this.dt2 > DIVE_T + 0.05 || (c.onGround && this.dt2 > 0.15);
  }
}
const _ae = new V3(), _ad = new V3(), _at = new V3(), _au = new V3();
class AerialMan {
  constructor(tHit) { this.t = 0; this.tHit = tHit; this.dodged = false; this.dj = false; }
  step(bot, dt, M) {
    const c = bot.car, k = c.ctrl, L = bot.L; this.t += dt;
    k.throttle = 0; k.slide = false; k.roll = 0;
    const s = sliceAt(M.preds[L.key], this.tHit);
    const T = this.tHit - M.t;
    if (!s || T < -0.25 || this.t > 3.6 || (c.onGround && this.t > 0.35)) return true;
    if (bot.lastTouchSeen !== M.touchSerial && this.t > 0.3 && M.lastTouch && M.lastTouch !== c) {
      // ball got hit by someone else mid-flight: re-plan from the new prediction
      const s2 = sliceAt(M.preds[L.key], this.tHit);
      if (!s2 || Math.hypot(s2.x - s.x, s2.y - s.y, s2.z - s.z) > 4) return true;
    }
    aimFor(c.team, s.x, s.z, c.p.x, c.p.z, bot.clearing, _aim);
    _at.set(s.x - _aim.x * BALL_R * 0.85, s.y - 0.3, s.z - _aim.z * BALL_R * 0.85);
    k.jump = false;
    if (this.t < 0.2) { k.jump = true; }
    else if (L.key === 'god' && !this.dj && _at.y - c.p.y > 5 && this.t >= 0.25) { k.jump = true; k.pitch = 0; k.steer = 0; k.roll = 0; this.dj = true; k.boost = c.boost > 0; return false; }
    const Tc = Math.max(T, 0.06);
    _ae.set(_at.x - c.p.x - c.v.x * Tc, _at.y - c.p.y - c.v.y * Tc + 0.5 * G * Tc * Tc, _at.z - c.p.z - c.v.z * Tc);
    const need = 2 * _ae.length() / (Tc * Tc);
    _ad.copy(_ae).normalize();
    _au.copy(UP).addScaledVector(_ad, -_ad.y); if (_au.lengthSq() < 0.01) _au.copy(c.up);
    if (this.t < 0.2) { k.pitch = 0; k.steer = 0; if (this.t > 0.06) orientTo(c, _ad, _au, 0.8, k); k.pitch *= 0.6; }
    else orientTo(c, _ad, _au, 1.1 * L.recover, k);
    const align = c.fwd.dot(_ad);
    k.boost = c.boost > 0 && ((align > 0.75 && need > 1.0) || (align > 0.94 && need > 0.35));
    const dist = Math.hypot(s.x - c.p.x, s.y - c.p.y, s.z - c.p.z);
    if (!this.dodged && L.dodge >= 0.85 && T < 0.14 && dist < BALL_R + 1.8 && !c.doubleJumped && c.airT < 1.2) {
      localDir(c, s.x, s.y, s.z, _vl); const l = Math.hypot(_vl.x, _vl.z) || 1;
      k.jump = true; k.pitch = _vl.z / l; k.steer = -_vl.x / l; k.boost = false; this.dodged = true;
    }
    return false;
  }
}

// ----------------------------------------------------------- bot brain
class Bot {
  constructor(car, level) {
    this.car = car; this.L = LEVELS[level];
    this.thinkT = rand(0, 0.1); this.tgt = new V3(); this.want = 0; this.allowBoost = false; this.boostOk = true;
    this.faceBall = false; this.man = null; this.role = 'attack'; this.ic = { found: false, t: 0, bx: 0, by: 0, bz: 0, hx: 0, hz: 0, ax: 0, az: 1, aerial: false };
    this.reach = new Float32Array(101); this.noiseA = 0; this.noiseT = 0; this.whiff = 0; this.stuckT = 0; this.unstuckUntil = 0;
    this.aggr = rand(0.45, 1); this.hesitateT = 0; this.dodgePlan = false; this.lastIcT = -1; this.nextFlip = 0; this.clearing = false;
    this.demoUntil = 0; this.demoTarget = null; this.turtleTog = 0; this.lastTouchSeen = 0; this.icTouch = -1; this.chargePlan = false;
  }
  update(dt, M) {
    const c = this.car, k = c.ctrl;
    if (c.demolished) { k.throttle = 0; k.steer = 0; k.pitch = 0; k.roll = 0; k.jump = false; k.boost = false; k.slide = false; this.man = null; return; }
    if (M.state === 'countdown') { k.throttle = 0; k.steer = 0; k.boost = false; k.jump = false; this.man = null; return; }
    if (this.man) { if (!this.man.step(this, dt, M)) return; this.man = null; }
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = (1 / this.L.think) * rand(0.8, 1.2); this.decide(M); }
    this.execute(dt, M);
  }

  // ---------- planning
  buildReach() {
    const c = this.car, L = this.L, tab = this.reach;
    let v = Math.max(0, c.v.dot(c.fwd)), d = 0, b = L.boost >= 0.5 ? c.boost : 0;
    const S = c.stats; tab[0] = 0;
    for (let i = 1; i <= 100; i++) {
      let a = throttleAccel(v, S.maxThrottle) * L.cap;
      if (b > 0) { a += S.boostAccel; b -= 33.3 * 0.05; }
      v = Math.min(b > 0 ? S.maxBoostSpeed : Math.max(v, S.maxThrottle * L.cap), v + a * 0.05); d += v * 0.05; tab[i] = d;
    }
  }
  etaDist(dist) {
    const tab = this.reach; if (dist <= 0) return 0;
    if (dist > tab[100]) return 5 + (dist - tab[100]) / 20;
    let lo = 0, hi = 100; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tab[m] < dist) lo = m; else hi = m; }
    return (lo + (dist - tab[lo]) / ((tab[hi] - tab[lo]) || 1)) * 0.05;
  }
  findIntercept(M, pred, clear) {
    const c = this.car, L = this.L, ic = this.ic;
    ic.found = false;
    this.buildReach();
    const groundMax = 1.8, gH = L.jumpShot > 0 ? 3.9 : groundMax;
    const tMax = M.t + L.horizon;
    const fl = Math.hypot(c.fwd.x, c.fwd.z) || 1;
    const ca = Math.cos(this.noiseA), sa = Math.sin(this.noiseA);
    for (let i = 0; i < pred.n; i++) {
      const s = pred.s[i];
      if (s.t < M.t + 0.03) continue;
      if (s.t > tMax) break;
      if (Math.abs(s.z) > A.hz - 0.4) continue;
      const tRel = s.t - M.t;
      const air = s.y > gH;
      if (air && s.y > L.aerialH) continue;
      aimFor(c.team, s.x, s.z, c.p.x, c.p.z, clear, _aim);
      const axn = _aim.x * ca - _aim.z * sa, azn = _aim.x * sa + _aim.z * ca;
      const off = BALL_R + 0.8;
      const hx = s.x - axn * off, hz = s.z - azn * off;
      const dx = hx - c.p.x, dz = hz - c.p.z;
      let dist = Math.hypot(dx, dz);
      if (!c.onGround) dist += Math.max(0, c.p.y - 1);
      const ang = Math.acos(clamp((c.fwd.x * dx + c.fwd.z * dz) / (fl * (dist || 1)), -1, 1));
      if (air) {
        if (!c.onGround || tRel < 0.65 || ang > 0.9) continue;
        const T = tRel;
        const ex = s.x - axn * BALL_R * 0.85 - c.p.x - c.v.x * T, ey = s.y - c.p.y - (c.v.y + 4.6) * T + 0.5 * G * T * T, ez = s.z - azn * BALL_R * 0.85 - c.p.z - c.v.z * T;
        const aReq = 2 * Math.hypot(ex, ey, ez) / (T * T);
        if (aReq > c.stats.boostAccel * 0.84 || aReq < 2.6) continue;
        if (c.boost < Math.min(T, 2.6) * 33.3 * 0.6 + 4) continue;
        Object.assign(ic, { found: true, aerial: true, t: s.t, bx: s.x, by: s.y, bz: s.z, hx, hz, ax: axn, az: azn });
        return ic;
      }
      if (s.y > groundMax && !(ang < 0.4 && tRel > 0.3)) continue;   // bouncing ball: only if lined up for a jump shot
      const eta = this.etaDist(dist) + ang * 0.42 + (s.y > groundMax ? 0.1 : 0);
      if (eta <= tRel + 0.02) {
        Object.assign(ic, { found: true, aerial: false, t: s.t, bx: s.x, by: s.y, bz: s.z, hx, hz, ax: axn, az: azn });
        return ic;
      }
    }
    return null;
  }
  ownGoalThreat(pred, M) {
    const own = this.car.team === 0 ? -1 : 1;
    for (let i = 0; i < pred.n; i += 3) { const s = pred.s[i]; if (s.t < M.t) continue; if (s.z * own > A.hz + BALL_R * 0.5) return s.t - M.t; }
    return -1;
  }
  isGoalSide(x, z) { return this.car.team === 0 ? this.car.p.z < z - 1 : this.car.p.z > z + 1; }
  oppEta(M, bx, bz) {
    let best = 99;
    for (const o of M.cars) { if (o.team === this.car.team || o.demolished) continue; const d = Math.hypot(o.p.x - bx, o.p.z - bz); best = Math.min(best, d / Math.max(9, o.v.length())); }
    return best;
  }
  decide(M) {
    const c = this.car, L = this.L;
    const pred = M.preds[L.key];
    this.boostOk = Math.random() < L.boost;
    this.faceBall = false; this.clearing = false;
    if (M.t > this.noiseT) { this.noiseT = M.t + rand(0.5, 1.3); this.noiseA = (Math.random() * 2 - 1) * L.aim; this.whiff = (Math.random() * 2 - 1) * L.whiff; }
    if (M.kickoff) { this.decideKickoff(M); return; }
    let role = c.role;   // dealt by the team coach from this penguin's duty (striker / goalie / sweeper / flex)
    const duty = c.duty || 'flex';
    const b0 = sliceAt(pred, M.t + 0.35) || M.ball.p;
    const dBall = Math.hypot(b0.x - c.p.x, b0.z - c.p.z);
    if (L.rotate === 0) {
      // easy bots never learned positions: alone they just chase, on a team they keep their duty only loosely
      if (duty === 'flex') role = (this.aggr > 0.6 || this.closestMate(M) === c) ? 'attack' : 'support';
      else if (role !== 'attack' && this.aggr > 0.8 && dBall < 14) role = 'attack';
    }
    const threat = this.ownGoalThreat(pred, M);
    if (threat >= 0 && threat < 3.4 && role !== 'wing') {
      // a shot is coming: the keeper (or a lone penguin, or whoever is closest on the goal side) goes for the
      // save; everyone else drops back to cover instead of chasing the same ball
      if (duty === 'goalie' || duty === 'flex' || this.closestGoalSide(M, b0) === c) role = 'save';
      else role = duty === 'sweeper' ? 'sweep' : 'retreat';
    }
    if (role !== 'attack' && role !== 'save' && dBall < 9 && (b0.y ?? 1) < 3 && this.isGoalSide(b0.x, b0.z) && !inCorner(b0)) {
      // free ball right in front of us: take it, unless the lead striker will get there first
      const lead = M.coach[c.team];
      if (!lead || lead === c || lead.demolished || Math.hypot(b0.x - lead.p.x, b0.z - lead.p.z) > dBall + 5) role = 'attack';
    }
    if (role === 'attack' && L.shadow && M.mode !== '5v5') {
      const myD = Math.hypot(b0.x - c.p.x, b0.z - c.p.z) / Math.max(9, c.v.length());
      const opp = this.oppEta(M, b0.x, b0.z);
      const ownHalf = (c.team === 0 ? -1 : 1) * b0.z > -8;
      if (ownHalf && opp + 0.8 < myD) role = this.isGoalSide(b0.x, b0.z) ? 'shadow' : 'retreat';
    }
    if (L.demo > 0 && M.t > this.demoUntil && role === 'support' && Math.random() < L.demo / L.think * 4 && c.boost > 40) {
      let best = null, bd = 30;
      for (const o of M.cars) { if (o.team === c.team || o.demolished) continue; const d = c.p.distanceTo(o.p); localDir(c, o.p.x, o.p.y, o.p.z, _vl); if (d < bd && _vl.z > 0 && Math.abs(Math.atan2(_vl.x, _vl.z)) < 0.35) { bd = d; best = o; } }
      if (best) { this.demoTarget = best; this.demoUntil = M.t + 2; }
    }
    if (this.demoTarget && M.t < this.demoUntil && role !== 'save' && !this.demoTarget.demolished) {
      const o = this.demoTarget; this.tgt.set(o.p.x + o.v.x * 0.5, 0, o.p.z + o.v.z * 0.5); this.want = VMAX; this.allowBoost = true; this.role = 'demo'; this.ic.found = false; return;
    }
    this.demoTarget = null;
    this.role = role;
    switch (role) {
      case 'attack': this.planAttack(M, pred, false); break;
      case 'save': this.planAttack(M, pred, true); break;
      case 'support': this.planSupport(M, pred); break;
      case 'defend': this.planDefend(M, pred); break;
      case 'keeper': this.planKeeper(M, pred); break;
      case 'sweep': this.planSweep(M, pred); break;
      case 'wing': this.planWing(M, pred); break;
      case 'shadow': this.planShadow(M, pred); break;
      default: this.planRetreat(M, pred);
    }
  }
  closestMate(M) {
    let best = null, bd = 1e9;
    for (const o of M.cars) { if (o.team !== this.car.team || o.demolished) continue; const d = o.p.distanceToSquared(M.ball.p); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  // the teammate best placed to make a save: on the goal side of the ball and nearest to it
  closestGoalSide(M, b) {
    const team = this.car.team; let best = null, bd = 1e9;
    for (const o of M.cars) {
      if (o.team !== team || o.demolished || !(team === 0 ? o.p.z < b.z - 1 : o.p.z > b.z + 1)) continue;
      const d = Math.hypot(o.p.x - b.x, o.p.z - b.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  planAttack(M, pred, clear) {
    const c = this.car;
    this.clearing = clear;
    const ic = this.findIntercept(M, pred, clear);
    if (!ic) {
      const s = sliceAt(pred, M.t + Math.min(1.2, this.L.horizon)) || M.ball.p;
      aimFor(c.team, s.x, s.z, c.p.x, c.p.z, clear, _aim);
      this.tgt.set(s.x - _aim.x * 2.5, 0, s.z - _aim.z * 2.5); this.want = VMAX; this.allowBoost = true; return;
    }
    if (Math.abs(ic.t - this.lastIcT) > 0.3 || this.icTouch !== M.touchSerial) { this.dodgePlan = Math.random() < this.L.dodge; this.chargePlan = Math.random() < this.L.charge; this.lastIcT = ic.t; this.icTouch = M.touchSerial; }
    if (ic.aerial) { if (c.onGround && !this.man) { this.man = new AerialMan(ic.t); this.lastTouchSeen = M.touchSerial; c.ctrl.charge = false; } return; }
    const tRel = Math.max(0.05, ic.t - M.t);
    // far away: drive for a point behind the ball on the shot line to get lined up.
    // close in: offset-hit, i.e. pick which side of the ball to strike so the contact
    // normal points along the shot even when the approach angle is off.
    const dBx = ic.bx - c.p.x, dBz = ic.bz - c.p.z, dB = Math.hypot(dBx, dBz) || 1;
    const ux = dBx / dB, uz = dBz / dB;
    const alpha = clamp(Math.atan2(uz * ic.ax - ux * ic.az, ux * ic.ax + uz * ic.az), -0.95, 0.95);
    const e = (BALL_R + 0.55) * Math.sin(alpha) * 0.65;
    const nearX = ic.bx - uz * e, nearZ = ic.bz + ux * e;
    const off = clamp(dB * 0.45, 0, 11);
    const farX = ic.bx - ic.ax * off, farZ = ic.bz - ic.az * off;
    const wFar = clamp((dB - 9) / 10, 0, 1);
    const tx = clamp(lerp(nearX, farX, wFar) - uz * this.whiff, -A.hx + 3, A.hx - 3), tz = clamp(lerp(nearZ, farZ, wFar) + ux * this.whiff, -A.hz + 3, A.hz - 3);
    this.tgt.set(tx, 0, tz);
    const path = Math.hypot(tx - c.p.x, tz - c.p.z) + Math.hypot(ic.bx - tx, ic.bz - tz);
    this.want = clamp(path / tRel, 0, VMAX);
    if (dB < 7) this.want = Math.max(this.want, Math.min(VMAX, c.v.length()));
    this.allowBoost = true;
  }
  setPos(x, z, face) {
    const c = this.car;
    x = clamp(x, -A.hx + 5, A.hx - 5); z = clamp(z, -A.hz + 4, A.hz - 4);
    this.tgt.set(x, 0, z);
    const d = Math.hypot(x - c.p.x, z - c.p.z);
    this.want = d > 25 ? VMAX : d > 10 ? 18 : d * 1.5;
    this.allowBoost = d > 28;
    this.faceBall = face;
    this.ic.found = false;
    // grab fish on the way when low on boost
    if (c.boost < 45 && Math.random() < this.L.pads) {
      let best = null, bc = 14;
      for (const p of M.pads) {
        if (!p.active && !(this.L.key === 'god' && p.t < 1)) continue;
        const cost = Math.hypot(p.x - c.p.x, p.z - c.p.z) + Math.hypot(x - p.x, z - p.z) - d - (p.big ? 7 : 0);
        if (cost < bc) { bc = cost; best = p; }
      }
      if (best) { this.tgt.set(best.x, 0, best.z); this.want = VMAX; this.allowBoost = false; this.faceBall = false; }
    }
  }
  planSupport(M, pred) {
    const c = this.car, dir = c.team === 0 ? 1 : -1;
    const b = sliceAt(pred, M.t + 0.6) || M.ball.p;
    const backD = M.mode === '5v5' ? A.hz * 0.35 : A.hz * 0.5;
    let z = b.z - dir * backD; if (dir > 0) z = Math.max(z, -A.hz + 9); else z = Math.min(z, A.hz - 9);
    this.setPos(b.x * 0.45, z, true);
  }
  planDefend(M, pred) {
    const c = this.car, own = c.team === 0 ? -A.hz : A.hz, dir = c.team === 0 ? 1 : -1;
    const b = sliceAt(pred, M.t + 0.5) || M.ball.p;
    const deep = Math.abs(b.z - own) < A.hz * 0.6;
    const x = deep ? -Math.sign(b.x || 1) * (A.gw - 2.5) : clamp(b.x * 0.25, -A.gw + 1.5, A.gw - 1.5);
    this.setPos(x, own + dir * (deep ? 3.5 : 7), true);
  }
  // 2v2 goalie/sweeper: sweeps behind the striker while play is up-field, drops onto the goal line as it comes back
  planKeeper(M, pred) {
    const c = this.car, own = c.team === 0 ? -A.hz : A.hz, dir = c.team === 0 ? 1 : -1;
    const b = sliceAt(pred, M.t + 0.5) || M.ball.p;
    const depth = Math.abs(b.z - own) / (2 * A.hz);   // 0 = on our goal line, 1 = on theirs
    if (depth < 0.42) { this.planDefend(M, pred); return; }
    const k = clamp(0.62 - depth * 0.25, 0.4, 0.55);   // how far back from the ball toward our goal
    const z = b.z + (own - b.z) * k;
    this.setPos(b.x * (1 - k) * 0.8, dir > 0 ? Math.min(z, -3) : Math.max(z, 3), true);
  }
  // 5v5 sweeper: holds the middle of our half on the ball side, ready to clear whatever gets past the strikers
  planSweep(M, pred) {
    const c = this.car, own = c.team === 0 ? -A.hz : A.hz, dir = c.team === 0 ? 1 : -1;
    const b = sliceAt(pred, M.t + 0.5) || M.ball.p;
    const z = b.z + (own - b.z) * 0.5;
    this.setPos(b.x * 0.45, dir > 0 ? clamp(z, own + 12, -4) : clamp(z, 4, own - 12), true);
  }
  planWing(M, pred) {
    const c = this.car, dir = c.team === 0 ? 1 : -1;
    const b = sliceAt(pred, M.t + 0.6) || M.ball.p;
    const side = (c.wingIndex || 0) % 2 ? 1 : -1;
    // wings are outlets: they never drop deeper than the middle of our half, so they don't crowd a defensive corner
    let z = clamp(b.z - dir * A.hz * 0.2, -A.hz + 10, A.hz - 10);
    z = dir > 0 ? Math.max(z, -A.hz * 0.4) : Math.min(z, A.hz * 0.4);
    this.setPos(side * A.hx * 0.58 + b.x * 0.2, z, true);
  }
  planShadow(M, pred) {
    const c = this.car, own = c.team === 0 ? -A.hz : A.hz;
    const b = sliceAt(pred, M.t + 0.4) || M.ball.p;
    const gx = -b.x, gz = own - b.z, gl = Math.hypot(gx, gz) || 1;
    const d = Math.min(11, gl - 3);
    this.setPos(b.x + gx / gl * d, b.z + gz / gl * d, true);
    this.want = clamp(Math.hypot(this.tgt.x - c.p.x, this.tgt.z - c.p.z) * 1.6, 0, VMAX);
  }
  planRetreat(M) {
    const c = this.car, own = c.team === 0 ? -A.hz : A.hz, dir = c.team === 0 ? 1 : -1;
    const b = M.ball.p;
    this.setPos(-Math.sign(b.x || 1) * (A.gw - 1.5), own + dir * 4, true);
    this.want = VMAX; this.allowBoost = Math.abs(c.p.z - own) > 25;
  }
  decideKickoff(M) {
    const c = this.car, L = this.L;
    const taker = M.kickTaker[c.team];
    this.ic.found = false;
    if (taker === c) {
      if (M.t - M.kickStart < this.hesitateT) { this.tgt.copy(c.p).addScaledVector(c.fwd, 6); this.tgt.y = 0; this.want = 0; this.allowBoost = false; return; }
      const side = c.p.x >= 0 ? 1 : -1;
      this.tgt.set(side * 0.3, 0, c.team === 0 ? -0.9 : 0.9);
      this.want = VMAX; this.allowBoost = L.kickBoost; this.boostOk = L.kickBoost;
    } else {
      const own = c.team === 0 ? -A.hz : A.hz, dir = c.team === 0 ? 1 : -1;
      const mates = M.cars.filter((o) => o.team === c.team && o !== taker);
      const idx = mates.indexOf(c);
      if (idx === 0 && L.rotate > 0) {
        // second penguin grabs the nearest corner fish
        let best = null, bd = 1e9;
        for (const p of M.pads) if (p.big && p.z * dir < 0 && p.active) { const d = Math.hypot(p.x - c.p.x, p.z - c.p.z); if (d < bd) { bd = d; best = p; } }
        if (best) { this.tgt.set(best.x, 0, best.z); this.want = VMAX; this.allowBoost = false; return; }
      }
      if (M.mode === '5v5' && idx >= 1) { const side = idx % 2 ? 1 : -1; this.tgt.set(side * A.hx * 0.45, 0, own + dir * A.hz * 0.45); this.want = 16; this.allowBoost = false; return; }
      this.tgt.set(0, 0, own + dir * 4); this.want = 16; this.allowBoost = false; this.faceBall = true;
    }
  }

  // ---------- acting
  execute(dt, M) {
    const c = this.car, k = c.ctrl, L = this.L;
    k.jump = false; k.roll = 0; k.slide = false; k.pitch = 0; k.charge = false;
    if (!c.onGround) {
      if (c.touchingBad) { this.turtleTog += dt; k.jump = (this.turtleTog % 0.4) < 0.08; k.throttle = 0; k.steer = 0; return; }
      this.recover(M); return;
    }
    // stuck against something: back up and turn
    const fs = c.v.dot(c.fwd);
    if (M.t < this.unstuckUntil) { k.throttle = -1; k.steer = this.unstuckSteer; k.boost = false; return; }
    if (Math.abs(fs) < 1.2 && k.throttle > 0.5 && !M.kickoff) { this.stuckT += dt; if (this.stuckT > 1.1) { this.unstuckUntil = M.t + 0.8; this.unstuckSteer = Math.random() < 0.5 ? -1 : 1; this.stuckT = 0; } }
    else this.stuckT = 0;
    // on a wall high above the ball: steer back down
    let tx = this.tgt.x, ty = this.tgt.y, tz = this.tgt.z;
    if (c.n.y < 0.5 && c.p.y > 3.5 && !(this.ic.found && this.ic.by > c.p.y - 2)) { tx = c.p.x - c.n.x * 4; ty = 0; tz = c.p.z - c.n.z * 4; }
    // arrived at a positioning spot: turn to face the ball and wait
    const dist = Math.hypot(tx - c.p.x, tz - c.p.z);
    if (this.faceBall && dist < 4) {
      localDir(c, M.ball.p.x, M.ball.p.y, M.ball.p.z, _vl);
      const ang = Math.atan2(-_vl.x, _vl.z);
      if (Math.abs(ang) > 0.45) { k.throttle = 0.45; k.steer = Math.sign(ang); }
      else { k.throttle = fs > 1 ? -0.4 : 0; k.steer = clamp(ang * 2, -1, 1); }
      k.boost = false; return;
    }
    this.drive(tx, ty, tz, this.want, this.allowBoost && this.boostOk);
    // kickoff flip
    if (M.kickoff && M.kickTaker[c.team] === c && !this.man) {
      const db = Math.hypot(c.p.x, c.p.z), sp = c.v.length();
      if (L.kickFlip && sp > 14 && db < sp * 0.3 + 1.6) { this.man = new DodgeMan({ hold: 0.04, wait: 0.04, aimBall: true, boost: true }); return; }
      if (!L.kickFlip && L.kickBoost && db < 3.6 && Math.random() < L.dodge) { this.man = new DodgeMan({ hold: 0.05, wait: 0.05, aimBall: true }); return; }
    }
    // shots: flip into low balls, jump at bouncing ones
    const ic = this.ic;
    if (ic.found && !ic.aerial && !this.man) {
      const tRel = ic.t - M.t;
      const s = sliceAt(M.preds[L.key], M.t + 0.02) || M.ball.p;
      const bd = Math.hypot(s.x - c.p.x, s.z - c.p.z);
      localDir(c, ic.bx, ic.by, ic.bz, _vl);
      const facing = Math.abs(Math.atan2(-_vl.x, _vl.z));
      // charged shot: wind up over the last stretch before a shot on goal (never on clearances); the charge
      // carries into a dive or jump shot started below, and the steer at contact decides the curve
      if (this.chargePlan && !this.clearing && tRel > 0 && tRel < CHARGE_T + 0.3 && facing < 0.7) k.charge = true;
      if (ic.by < 2.1) {
        if (this.dodgePlan && tRel < 0.3 && tRel > 0.04 && facing < 0.45 && Math.abs(_vl.x) < 1.1 && _vl.z > 0 && bd < 4.5 + c.v.length() * 0.12) { this.man = new DodgeMan({ hold: 0.04, wait: Math.max(0.02, tRel - 0.16), aimBall: true }); return; }
      } else if (L.jumpShot > 0 && ic.by < 4.2 && facing < 0.5) {
        const need = ic.by - 0.55 - RIDE_H;
        const jt = jumpTimeFor(need, c.stats.jump);
        if (jt > 0 && tRel <= jt + 0.02 && tRel > jt - 0.12 && Math.random() < L.jumpShot + 0.2) {
          this.man = new DodgeMan({ hold: Math.min(0.2, jt), wait: Math.max(0.02, jt - 0.2 - 0.04), aimBall: true, noFlip: !this.dodgePlan });
          return;
        }
      }
    }
    // speed flip on long straight drives with no boost
    if (L.flipSpeed && !this.man && M.t > this.nextFlip && c.boost < 12 && fs > 12.5 && fs < 23 && dist > 34) {
      localDir(c, tx, ty, tz, _vl);
      if (Math.abs(Math.atan2(-_vl.x, _vl.z)) < 0.06) { this.man = new DodgeMan({ hold: 0.05, wait: 0.06, f: 1, r: 0 }); this.nextFlip = M.t + 1.8; }
    }
  }
  drive(tx, ty, tz, want, boostOk) {
    const c = this.car, k = c.ctrl, L = this.L;
    localDir(c, tx, ty, tz, _vl);
    const ang = Math.atan2(-_vl.x, _vl.z);
    const fs = c.v.dot(c.fwd);
    const yawR = -c.w.dot(c.up);
    k.steer = clamp(ang * 4.5 - yawR * 0.18, -1, 1);
    k.slide = L.rotate >= 1 && Math.abs(ang) > 1.45 && fs > 8;
    // don't arrive faster than we can turn: compare the arc to the target with our turning circle
    if (L.rotate >= 1 && _vl.z > 0) {
      const r = (_vl.x * _vl.x + _vl.z * _vl.z) / (2 * Math.abs(_vl.x) + 1e-6);
      if (r < 40) want = Math.min(want, speedForRadius(r * 0.92));
    }
    let thr;
    if (want > fs + 0.6) thr = 1;
    else if (want < fs - 2.5) thr = fs > 3 ? -1 : 0;
    else thr = clamp((want - fs) * 0.6 + 0.15, -1, 1);
    if (Math.abs(ang) > 1.25 && fs > 15) thr = Math.min(thr, 0.1);
    k.throttle = thr * L.cap;
    k.boost = boostOk && c.boost > 0 && Math.abs(ang) < 0.3 && want > fs + 1.5 && (want > 15.5 || Math.hypot(_vl.x, _vl.z) > 30);
  }
  recover(M) {
    const c = this.car, k = c.ctrl;
    _at.copy(c.v).multiplyScalar(0.45).add(c.p);
    const d = arenaD(_at.x, _at.y, _at.z);
    if (d < 4) arenaN(_at.x, _at.y, _at.z, _au); else _au.set(0, 1, 0);
    if (_au.y < -0.3) _au.set(0, 1, 0);
    _ad.copy(c.v).addScaledVector(_au, -c.v.dot(_au));
    if (_ad.lengthSq() < 1) {
      _ad.set(this.tgt.x - c.p.x, 0, this.tgt.z - c.p.z).addScaledVector(_au, -_ad.dot(_au));
      if (_ad.lengthSq() < 0.01) _ad.copy(c.fwd).addScaledVector(_au, -c.fwd.dot(_au));
    }
    orientTo(c, _ad, _au, this.L.recover, k);
    k.boost = false; k.jump = false; k.throttle = 1;
  }
}

// ----------------------------------------------------------- team coach: duties (striker vs goalie/sweeper) + roles
// Duties give each team a shape: the deepest penguin keeps goal (in 4+ a side the next one sweeps) and everyone else
// is a striker; a lone penguin is 'flex'. Duties are dealt at kickoff and only swap with hysteresis, and humans are
// slotted in by where they actually are. Each coach tick the best-placed striker gets 'attack' and the other strikers
// hold the flanks or support, so a team never piles into one corner. Runs at 10 Hz without allocating.
const DUTY_GAP = 2.5, DUTY_SWAP = 14, _team = [], _ord = [];
const inCorner = (b) => Math.abs(b.x) > A.hx - 11 && Math.abs(b.z) > A.hz - 16;
const dutyDepth = (c, own) => (c.demolished ? 0 : Math.abs(c.p.z - own));   // respawning penguins come back at their own goal
// the holder of `job` got dragged up-field while a teammate sits much deeper: they swap jobs
function dutySwap(M, team, own, job) {
  let keep = null;
  for (const c of _team) if (c.duty === job) { keep = c; break; }
  if (!keep) return false;
  let deep = null, dd = dutyDepth(keep, own) - DUTY_SWAP;
  for (const c of _team) {
    if (c === keep || c.demolished || (job === 'sweeper' && c.duty === 'goalie')) continue;
    const d = dutyDepth(c, own); if (d < dd) { dd = d; deep = c; }
  }
  if (!deep) return false;
  keep.duty = deep.duty; deep.duty = job; M.dutyT[team] = M.t;
  return true;
}
function assignDuties(M, team, own) {
  const n = _team.length;
  let fresh = false;
  for (const c of _team) if (!c.duty || c.duty === 'flex') { fresh = true; break; }
  if (fresh) {
    _ord.length = 0;   // deepest first (insertion sort into a reused array)
    for (const c of _team) { let i = _ord.length; _ord.push(c); while (i > 0 && dutyDepth(_ord[i - 1], own) > dutyDepth(c, own)) { _ord[i] = _ord[i - 1]; i--; } _ord[i] = c; }
    for (let i = 0; i < n; i++) _ord[i].duty = i === 0 ? 'goalie' : i === 1 && n >= 4 ? 'sweeper' : 'striker';
    M.dutyT[team] = M.t;
    return;
  }
  if (M.t - M.dutyT[team] < DUTY_GAP) return;
  if (!dutySwap(M, team, own, 'goalie') && n >= 4) dutySwap(M, team, own, 'sweeper');
}
function coachUpdate(M) {
  for (let team = 0; team < 2; team++) {
    _team.length = 0;
    for (const c of M.cars) if (c.team === team) _team.push(c);
    const n = _team.length;
    if (!n) continue;
    const own = team === 0 ? -A.hz : A.hz;
    if (n === 1) _team[0].duty = 'flex'; else assignDuties(M, team, own);
    const pk = M.teamLevel[team] || 'normal';
    const b = sliceAt(M.preds[pk], M.t + 0.5) || M.ball.p;
    // lead striker: the best-placed attacker; the sweeper only steps up if every striker is respawning
    let best = null, bestS = 1e9, alt = null, altS = 1e9;
    for (const c of _team) {
      if (c.demolished) continue;
      const dx = b.x - c.p.x, dz = b.z - c.p.z, d = Math.hypot(dx, dz) || 1;
      const toward = (c.v.x * dx + c.v.z * dz) / d;
      let s = d / Math.max(10, 10 + toward * 0.5);
      const goalSide = team === 0 ? c.p.z < b.z + 2 : c.p.z > b.z - 2;
      if (!goalSide) s += 1.2;
      s += (1 - (c.fwd.x * dx + c.fwd.z * dz) / d) * 0.35;
      if (c.boost < 15) s += 0.2;
      if (!c.isBot) s -= 0.4;
      if (c === M.coach[team]) s -= 0.35;
      if (!c.onGround && c.p.y > 3 && !(c.bot && c.bot.man)) s += 0.5;
      c._cs = s;
      if (c.duty === 'striker' || c.duty === 'flex') { if (s < bestS) { bestS = s; best = c; } }
      else if (c.duty === 'sweeper' && s < altS) { altS = s; alt = c; }
    }
    if (!best) best = alt;
    M.coach[team] = best;
    let wing = 0;
    for (const c of _team) {
      if (c === best) c.role = 'attack';
      else if (c.duty === 'goalie') c.role = n >= 4 ? 'defend' : 'keeper';
      else if (c.duty === 'sweeper') c.role = 'sweep';
      else if (n >= 4) { c.role = 'wing'; c.wingIndex = wing++; }
      else c.role = 'support';
    }
  }
}
