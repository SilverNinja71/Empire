// =====================================================================
//  ONLINE — matches with friends: rooms, invite links, lobby, host-run matches
// =====================================================================
// Browsers connect straight to each other (WebRTC, through PeerJS). The host's computer runs the real match
// exactly like an offline one. Friends send their controls every frame and get ~30 updates a second of where
// every penguin and the ball are, which they draw NET_DELAY_MS behind so motion stays smooth. Goals,
// demolitions, saves and big hits travel as events, so every screen shows its own banners and effects.
const NET_PREFIX = 'penguin-league-room-';
const NET_MAX_GUESTS = 3;            // 4 players in a room
const NET_SNAP_MS = 1000 / 30;       // host -> friends update rate
const NET_DELAY_MS = 100;            // friends draw this far behind the newest update (hides network jitter)
const NET_STATS_MS = 1000;           // scoreboard numbers
const NET_JOIN_TRIES = 8;            // an invite link keeps knocking for ~20 s while the host opens the room
const NET_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

const Online = (() => {
  const st = {
    role: null, peer: null, conns: new Map(), code: '', status: '', myId: null, timer: 0, maxTries: 1,
    players: [], mode: '2v2', len: 180, bots: 'normal', together: false, inMatch: false, typed: '',
  };
  const ev = [];        // host: events since the last update
  const snaps = [];     // friend: updates waiting to be drawn
  let off = null, lastSnap = 0, lastStats = 0, prevState = '';
  const _qa = new Q(), _qb = new Q(), _nv = new V3();
  const sendIn = { t: 'in', th: 0, st: 0, pi: 0, j: 0, jn: 0, b: 0, s: 0, c: 0 };
  const inCtrl = { throttle: 0, steer: 0, pitch: 0, roll: 0, jump: false, boost: false, slide: false, charge: false };

  // ---------- names, codes, sanitising what friends send
  function myName() {
    if (save.netName) return save.netName;
    try {
      const p = JSON.parse(localStorage.getItem('spear_mace_user_profile') || 'null');   // the account shared with the other games
      if (p && p.username) return cleanName(p.username);
    } catch (e) { /* storage blocked */ }
    return 'Penguin';
  }
  const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Penguin';
  const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
  function cleanCos(c) {
    c = c || {};
    return {
      hat: HATS.some((h) => h.id === c.hat) ? c.hat : 'none',
      skin: SKINS.some((h) => h.id === c.skin) ? c.skin : 'classic',
      trail: TRAILS.some((h) => h.id === c.trail) ? c.trail : 'puff',
    };
  }
  function makeCode() { let s = ''; for (let i = 0; i < 5; i++) s += NET_LETTERS[(Math.random() * NET_LETTERS.length) | 0]; return s; }
  const inviteUrl = () => location.origin + location.pathname + '?room=' + st.code;
  const rerender = () => { if (UI.cur === 'online') UI.show('online'); };

  // ---------- connections
  function send(m, to) { for (const [id, c] of st.conns) if (c.open && (!to || to === id)) { try { c.send(m); } catch (e) { /* closing */ } } }
  function attach(conn) {
    conn.on('open', () => {
      st.conns.set(conn.peer, conn); clearTimeout(st.timer);
      if (st.role === 'guest') { conn.send({ t: 'hello', name: myName(), cos: { ...save.equip } }); st.status = ''; rerender(); }
    });
    conn.on('data', (m) => onMsg(m, conn.peer));
    conn.on('close', () => onClose(conn.peer));
    conn.on('error', () => onClose(conn.peer));
  }
  function host() {
    if (typeof window.Peer !== 'function') { st.status = "Online play couldn't load. Check your internet connection and refresh."; rerender(); return; }
    leave(true);
    st.role = 'host'; st.myId = 'host'; st.code = makeCode(); st.status = 'Opening your room…';
    st.players = [{ id: 'host', name: myName(), cos: { ...save.equip } }];
    const peer = st.peer = new window.Peer(NET_PREFIX + st.code);
    peer.on('open', () => { if (st.peer === peer) { st.status = ''; rerender(); } });
    peer.on('connection', (conn) => {
      if (st.conns.size >= NET_MAX_GUESTS) { conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); }); return; }
      attach(conn);
    });
    peer.on('error', (e) => {
      if (st.peer !== peer) return;
      if (e.type === 'unavailable-id') { host(); return; }   // that code is taken: pick another
      st.status = 'Connection problem (' + e.type + '). Try again.'; rerender();
    });
    rerender();
  }
  function join(code, tries) {
    code = cleanCode(code);
    if (code.length !== 5) { st.status = 'Room codes are 5 letters.'; rerender(); return; }
    if (typeof window.Peer !== 'function') { st.status = "Online play couldn't load. Check your internet connection and refresh."; rerender(); return; }
    leave(true);
    st.role = 'guest'; st.code = code; st.typed = code;
    st.status = tries ? `Waiting for room ${code} to open…` : `Joining room ${code}…`;
    const peer = st.peer = new window.Peer();
    peer.on('open', (id) => {
      if (st.peer !== peer) return;
      st.myId = id;
      attach(peer.connect(NET_PREFIX + code, { reliable: true, serialization: 'json' }));
      st.timer = setTimeout(() => retryOrFail(code, tries, "Couldn't reach that room."), 10000);
    });
    peer.on('error', (e) => {
      if (st.peer !== peer) return;
      if (e.type === 'peer-unavailable') retryOrFail(code, tries, `No room called ${code} is open. Check the code with your friend.`);
      else { st.status = 'Connection problem (' + e.type + '). Try again.'; rerender(); }
    });
    rerender();
  }
  function retryOrFail(code, tries, msg) {
    if (st.role !== 'guest' || st.code !== code || st.conns.size) return;
    if (tries + 1 < st.maxTries) {
      st.status = `Waiting for room ${code} to open…`;
      setTimeout(() => { if (st.role === 'guest' && st.code === code && !st.conns.size) join(code, tries + 1); }, 2500);
    } else { leave(true); st.status = msg; }
    rerender();
  }
  function leave(keepStatus) {
    st.role = null;   // first, so the close handlers below know this was on purpose
    clearTimeout(st.timer);
    for (const c of st.conns.values()) { try { c.close(); } catch (e) { /* already closed */ } }
    st.conns.clear();
    if (st.peer) { try { st.peer.destroy(); } catch (e) { /* already gone */ } }
    st.peer = null; st.players = []; st.inMatch = false; st.myId = null;
    snaps.length = 0; ev.length = 0; off = null;
    if (!keepStatus) st.status = '';
  }
  function onClose(id) {
    if (!st.conns.has(id)) return;
    st.conns.delete(id);
    if (st.role === 'host') {
      const p = st.players.find((x) => x.id === id);
      st.players = st.players.filter((x) => x.id !== id);
      const car = M.online && M.cars.find((c) => c.remote === id);
      if (car) {
        // a friend left mid-match: a bot takes over their penguin
        car.remote = null; car.isBot = true; car.level = st.bots; car.bot = new Bot(car, st.bots);
        feed(`${tn(car)} left · a bot took over`);
      } else if (p) toast('', `${p.name} left`);
      lobbyOut(); rerender();
    } else if (st.role === 'guest') {
      const wasPlaying = M.online && M.state !== 'over';
      leave(true); st.status = 'The host closed the room.';
      if (wasPlaying) { banner('HOST LEFT', 'The match is over', 'pink', 2.2); setTimeout(() => { $('#hud').hidden = true; startDemo(); UI.show('online'); }, 2200); }
      else rerender();
    }
  }

  // ---------- messages
  function onMsg(m, from) {
    if (!m || typeof m !== 'object') return;
    if (st.role === 'host') {
      if (m.t === 'hello') {
        const p = { id: from, name: cleanName(m.name), cos: cleanCos(m.cos) };
        const i = st.players.findIndex((x) => x.id === from);
        if (i >= 0) st.players[i] = p; else st.players.push(p);
        if (i < 0) toast('', `${p.name} joined`);
        lobbyOut(); rerender();
      } else if (m.t === 'in') {
        const car = M.online && M.cars.find((c) => c.remote === from);
        if (!car) return;
        if (!car.net) { car.netJn = m.jn | 0; car.netJq = 0; car.netJout = false; }   // presses from before the match don't count
        car.net = m;
      }
      return;
    }
    if (st.role !== 'guest') return;
    if (m.t === 's') {
      const now = performance.now(), est = now - m.ts;
      // clock offset to the host (+ the trip): the fastest message wins, drifting slowly so a changed route adapts
      off = off === null || est < off ? est : off + (est - off) * 0.002;
      snaps.push({ ts: m.ts, m, fired: false });
      // a stalled tab (hidden, slow frame) still gets its goals and demolitions, just late
      if (snaps.length > 40) { const old = snaps.shift(); if (!old.fired) { old.fired = true; fire(old.m.ev); } }
    } else if (m.t === 'lobby') {
      st.players = Array.isArray(m.players) ? m.players.map((p) => ({ id: p.id, name: cleanName(p.name), team: p.team })) : [];
      st.mode = MODES[m.mode] ? m.mode : '2v2'; st.len = m.len; st.bots = LEVELS[m.bots] ? m.bots : 'normal'; st.together = !!m.together; st.inMatch = !!m.inMatch;
      rerender();
    } else if (m.t === 'start') begin(m.cfg);
    else if (m.t === 'stats') applyStats(m.s);
    else if (m.t === 'back') backToLobby();
    else if (m.t === 'full') { leave(true); st.status = 'That room is full (4 players at most).'; rerender(); }
  }
  // who plays on which team: friends alternate blue / orange, or all on blue in "together" mode
  function teamsFor(players) { return players.map((p, i) => (st.together ? 0 : i % 2)); }
  function fits() {
    const n = MODES[st.mode].n, t = teamsFor(st.players);
    return [0, 1].every((k) => t.filter((x) => x === k).length <= n);
  }
  function lobbyOut() {
    if (st.role !== 'host') return;
    const t = teamsFor(st.players);
    send({ t: 'lobby', players: st.players.map((p, i) => ({ id: p.id, name: p.name, team: t[i] })), mode: st.mode, len: st.len, bots: st.bots, together: st.together, inMatch: st.inMatch });
  }

  // ---------- starting a match
  function start() {
    if (st.role !== 'host' || st.players.length < 2 || !fits()) return;
    const n = MODES[st.mode].n, t = teamsFor(st.players), names = shuffle(BOT_NAMES);
    const roster = [];
    let ni = 0;
    for (const team of [0, 1]) {
      const humans = st.players.filter((p, i) => t[i] === team);
      for (let i = 0; i < n; i++) {
        const h = humans[i];
        if (h) roster.push({ human: true, id: h.id, name: h.name, cos: h.cos, team });
        else roster.push({ human: false, name: names[ni++ % names.length], level: st.bots, team, cos: { hat: pick(['none', 'beanie', 'tophat', 'propeller', 'party']), skin: pick(SKINS).id, trail: 'puff' } });
      }
    }
    const cfg = { mode: st.mode, opp: st.bots, mate: st.bots, len: st.len, fair: true, online: true, roster };
    send({ t: 'start', cfg });
    begin(cfg);
  }
  function begin(cfg) {
    if (!cfg || !Array.isArray(cfg.roster) || !MODES[cfg.mode]) return;
    st.inMatch = true; snaps.length = 0; ev.length = 0; off = null; prevState = ''; lastSnap = lastStats = 0;
    for (const s of cfg.roster) { s.name = cleanName(s.name); s.cos = cleanCos(s.cos); s.team = s.team ? 1 : 0; if (!s.human) s.level = LEVELS[s.level] ? s.level : 'normal'; }
    UI.show(null);
    startMatch({ ...cfg, me: st.myId, guest: st.role === 'guest' });
    $('#hud').hidden = false;
    if (st.role === 'host') lobbyOut();
  }
  function backToLobby() {
    st.inMatch = false;
    if (st.role === 'host') { send({ t: 'back' }); lobbyOut(); }
    $('#hud').hidden = true; $('#scoreboard').hidden = true;
    startDemo(); UI.show('online');
  }

  // ---------- host side, every physics tick: friends' penguins use the controls they sent
  function applyInputs() {
    for (const c of M.cars) {
      const R = c.remote && c.net;
      if (!R) continue;
      const k = c.ctrl;
      k.throttle = clamp(+R.th || 0, -1, 1); k.steer = clamp(+R.st || 0, -1, 1); k.pitch = clamp(+R.pi || 0, -1, 1); k.roll = 0;
      // jump presses are counted on the friend's side, so a tap between two of their updates still jumps once
      const jn = R.jn | 0;
      if (jn > c.netJn) { c.netJq = Math.min(3, c.netJq + jn - c.netJn); c.netJn = jn; }
      if (c.netJq > 0) { if (c.netJout) c.netJout = false; else { c.netJq--; c.netJout = true; } }
      else c.netJout = !!R.j;
      k.jump = c.netJout; k.boost = !!R.b; k.slide = !!R.s; k.charge = !!R.c;
    }
  }
  // host side, every frame after the physics: an update for the friends ~30 times a second
  const r3 = (x) => Math.round(x * 1000) / 1000;
  function hostFrame() {
    if (st.role !== 'host') { ev.length = 0; return; }
    for (const c of M.cars) if (c.justLanded) { c.netLand = (c.netLand | 0) + 1; c.netImp = c.landImpact; }   // landings, for the squash
    if (!st.conns.size) { ev.length = 0; return; }
    const now = performance.now();
    if (now - lastStats > NET_STATS_MS) { lastStats = now; sendStats(); }
    if (now - lastSnap < NET_SNAP_MS - 2) return;
    lastSnap = now;
    const b = M.ball;
    const cars = M.cars.map((c) => [
      r3(c.p.x), r3(c.p.y), r3(c.p.z), r3(c.q.x), r3(c.q.y), r3(c.q.z), r3(c.q.w), r3(c.v.x), r3(c.v.y), r3(c.v.z),
      Math.round(c.boost),
      (c.onGround ? 1 : 0) | (c.demolished ? 2 : 0) | (c.supersonic ? 4 : 0) | (c.boosting ? 8 : 0) | (c.burstT > 0 ? 16 : 0) | (c.ctrl.slide ? 32 : 0),
      Math.round(c.charge * 100), Math.round(c.ctrl.steer * 100), c.netLand | 0, Math.round((c.netImp || 0) * 10),
    ]);
    send({
      t: 's', ts: now, st: M.state, sT: r3(M.stateT), cl: r3(M.clock), ot: r3(M.otTime), ov: M.overtime ? 1 : 0, sc: M.score, bh: M.ballHidden ? 1 : 0,
      b: [r3(b.p.x), r3(b.p.y), r3(b.p.z), r3(b.v.x), r3(b.v.y), r3(b.v.z), r3(b.w.x), r3(b.w.y), r3(b.w.z)],
      c: cars, pd: M.pads.map((p) => (p.active ? 0 : Math.ceil(p.t * 10))), ev: ev.splice(0),
    });
  }
  function sendStats() {
    if (st.role !== 'host') return;
    send({ t: 'stats', s: M.cars.map((c) => [c.stat.score, c.stat.goals, c.stat.assists, c.stat.saves, c.stat.shots, c.stat.demos, c.stat.touches]) });
  }
  function applyStats(s) {
    if (!Array.isArray(s)) return;
    M.cars.forEach((c, i) => {
      const a = s[i]; if (!Array.isArray(a)) return;
      [c.stat.score, c.stat.goals, c.stat.assists, c.stat.saves, c.stat.shots, c.stat.demos, c.stat.touches] = a.map((x) => x | 0);
    });
  }

  // ---------- friend side, every frame: send my controls, draw the host's match NET_DELAY_MS behind
  function sendInput() {
    const menu = UI.cur === 'pause';
    gatherInput(inCtrl);
    sendIn.th = menu ? 0 : Math.round(inCtrl.throttle * 100) / 100; sendIn.st = menu ? 0 : Math.round(inCtrl.steer * 100) / 100;
    sendIn.pi = menu ? 0 : Math.round(inCtrl.pitch * 100) / 100;
    sendIn.j = !menu && inCtrl.jump ? 1 : 0; sendIn.jn = PRESSES.jump; sendIn.b = !menu && inCtrl.boost ? 1 : 0;
    sendIn.s = !menu && inCtrl.slide ? 1 : 0; sendIn.c = !menu && inCtrl.charge ? 1 : 0;
    send(sendIn);
  }
  function guestFrame(dt) {
    if (M.state !== 'over') sendInput();
    if (M.slowmo > 0) M.slowmo -= dt;
    if (!snaps.length || off === null) return;
    const rt = performance.now() - off - NET_DELAY_MS;
    if (rt < snaps[0].ts) return;   // still filling the buffer
    // events happen when their update is drawn, so a goal banner lines up with the ball crossing the line
    for (const s of snaps) { if (s.ts > rt) break; if (!s.fired) { s.fired = true; fire(s.m.ev); } }
    while (snaps.length > 2 && snaps[1].ts <= rt) snaps.shift();
    const A0 = snaps[0], B0 = snaps[1] || A0;
    const a = A0.m, bm = B0.m, k = B0 === A0 ? 1 : clamp((rt - A0.ts) / (B0.ts - A0.ts), 0, 1);
    // match state
    M.state = a.st; M.stateT = +a.sT || 0; M.clock = +a.cl || 0; M.otTime = +a.ot || 0; M.overtime = !!a.ov;
    if (Array.isArray(a.sc)) { M.score[0] = a.sc[0] | 0; M.score[1] = a.sc[1] | 0; }
    M.ballHidden = !!a.bh;
    if (M.state === 'countdown' && prevState !== 'countdown') { endHighlight(); M.lastCount = 4; }   // kickoff
    if (M.state === 'countdown') {
      const cnt = Math.ceil(M.stateT);
      if (cnt < M.lastCount && cnt > 0) { banner(String(cnt), M.overtime ? 'Overtime · next goal wins' : '', 'yellow', 0.9); Sfx.beep(false); }
      M.lastCount = cnt;
    } else if (M.state === 'play' && prevState === 'countdown') { banner('GO!', '', 'yellow', 0.7); Sfx.beep(true); }
    prevState = M.state;
    // penguins
    const n = Math.min(M.cars.length, a.c.length, bm.c.length);
    for (let i = 0; i < n; i++) {
      const c = M.cars[i], ca = a.c[i], cb = bm.c[i];
      c.p.set(lerp(ca[0], cb[0], k), lerp(ca[1], cb[1], k), lerp(ca[2], cb[2], k));
      _qa.set(ca[3], ca[4], ca[5], ca[6]); _qb.set(cb[3], cb[4], cb[5], cb[6]);
      c.q.slerpQuaternions(_qa.normalize(), _qb.normalize(), k);
      c.v.set(lerp(ca[7], cb[7], k), lerp(ca[8], cb[8], k), lerp(ca[9], cb[9], k));
      c.pp.copy(c.p); c.pq.copy(c.q); updateBasis(c);
      const f = ca[11];
      c.boost = ca[10]; c.onGround = !!(f & 1); c.demolished = !!(f & 2); c.supersonic = !!(f & 4); c.boosting = !!(f & 8);
      c.burstT = f & 16 ? 1 : 0; c.ctrl.slide = !!(f & 32); c.charge = ca[12] / 100; c.ctrl.steer = ca[13] / 100;
      if (c.netLand === undefined) c.netLand = ca[14];
      else if (ca[14] !== c.netLand) { c.netLand = ca[14]; c.justLanded = true; c.landImpact = ca[15] / 10; }
    }
    // ball
    const B = M.ball, ba = a.b, bb = bm.b;
    B.p.set(lerp(ba[0], bb[0], k), lerp(ba[1], bb[1], k), lerp(ba[2], bb[2], k)); B.pp.copy(B.p);
    B.v.set(ba[3], ba[4], ba[5]); B.w.set(ba[6], ba[7], ba[8]);
    // fish pads and crystals
    if (Array.isArray(a.pd)) for (let i = 0; i < M.pads.length && i < a.pd.length; i++) { const v = a.pd[i] | 0; M.pads[i].active = v === 0; M.pads[i].t = v / 10; }
  }
  function fire(list) {
    if (!Array.isArray(list)) return;
    const car = (i) => (i >= 0 && i < M.cars.length ? M.cars[i] : null);
    for (const e of list) {
      if (!Array.isArray(e)) continue;
      const a = car(e[1]), b = car(e[2]);
      switch (e[0]) {
        case 'goal': goalFx(e[1] ? 1 : 0, b, car(e[3])); break;
        case 'demo': if (a && b) demoFx(a, b); break;
        case 'touch': if (a) touchFx(a, +e[2] || 0, +e[3] || 0, !!e[4], _nv.set(+e[5] || 0, +e[6] || 0, +e[7] || 0)); break;
        case 'save': if (a) saveFx(a, M.ball.p); break;
        case 'score': if (a && a === M.player) toast(`+${e[2] | 0}`, String(e[3] || '')); break;
        case 'pick': if (b && M.pads[e[1]]) M.onPickup(b, M.pads[e[1]]); break;
        case 'ce': if (a) carEventFx(a, e[2] ? 'flip' : 'jump'); break;
        case 'ot': otFx(); break;
        case 'end': M.state = 'over'; endFx(); break;
      }
    }
  }

  // ---------- the "Play with friends" screen
  function render(root) {
    const hostLobby = st.role === 'host', guestLobby = st.role === 'guest' && st.conns.size > 0;
    const status = st.status ? `<p class="net-status" role="status">${esc(st.status)}</p>` : '';
    let body = '', dock = '';
    if (!hostLobby && !guestLobby) {
      body = `
        <section class="sect"><h3>Your name</h3><input id="net-name" class="net-input" maxlength="16" value="${esc(myName())}" autocomplete="off" spellcheck="false"></section>
        <section class="sect"><h3>Host a room</h3>
          <p class="note">Make a room, then send the invite link to your friends. Up to 4 players; bots fill any empty spots.</p>
          <button class="btn big green" data-net="host" type="button">CREATE ROOM</button></section>
        <section class="sect"><h3>Join a friend</h3>
          <p class="note">Type your friend's 5-letter room code, or just open the invite link they sent you.</p>
          <div class="net-join"><input id="net-code" class="net-input code" maxlength="5" placeholder="ABCDE" value="${esc(st.typed)}" autocomplete="off" spellcheck="false"><button class="btn blue" data-net="join" type="button">JOIN</button></div></section>`;
    } else {
      const t = hostLobby ? teamsFor(st.players) : st.players.map((p) => p.team);
      const team = (k) => `<div class="net-team t${k}"><h4>${TEAM_LABEL[k]}</h4>${st.players.map((p, i) => (t[i] === k ? `<div class="net-p${p.id === st.myId ? ' me' : ''}">${esc(p.name)}${p.id === 'host' ? ' <span class="tag">HOST</span>' : ''}${p.id === st.myId ? ' <span class="tag you">YOU</span>' : ''}</div>` : '')).join('')}<div class="net-p bot">+ bots fill the rest</div></div>`;
      const chip = (attr, val, on, label) => `<button class="chip" data-net="${attr}" data-v="${val}" ${on ? 'aria-pressed="true"' : 'aria-pressed="false"'} ${hostLobby ? '' : 'disabled'} type="button">${label}</button>`;
      body = `
        <section class="sect net-room"><h3>Room code</h3><div class="net-code">${esc(st.code)}</div>
          ${hostLobby ? `<div class="net-join"><input class="net-input link" id="net-link" readonly value="${esc(inviteUrl())}"><button class="btn green" data-net="copy" type="button">COPY INVITE LINK</button></div>
          <p class="note">Send the link to your friends: opening it joins this room. Keep this tab open while you play; the match runs on your computer.</p>` : '<p class="note">You\'re in! The host picks the mode and starts the match.</p>'}</section>
        <section class="sect"><h3>Players (${st.players.length}/4)</h3><div class="net-teams">${team(0)}${team(1)}</div></section>
        <section class="sect"><h3>Mode</h3><div class="chips">${Object.keys(MODES).map((m) => chip('mode', m, st.mode === m, `${MODES[m].label} · ${MODES[m].name}`)).join('')}</div></section>
        <section class="sect"><h3>Teams</h3><div class="chips">${chip('together', 0, !st.together, 'Friends vs friends')}${chip('together', 1, st.together, 'All together vs bots')}</div></section>
        <section class="sect"><h3>Bots</h3><div class="chips">${LEVEL_ORDER.map((k) => chip('bots', k, st.bots === k, LEVELS[k].label)).join('')}</div></section>
        <section class="sect"><h3>Match length</h3><div class="chips">${[[120, '2 min'], [180, '3 min'], [300, '5 min']].map(([s, l]) => chip('len', s, st.len === s, l)).join('')}</div></section>`;
      const need = st.players.length < 2 ? 'Waiting for a friend to join…' : !fits() ? `Too many players on a team for ${MODES[st.mode].label}: pick a bigger mode.` : '';
      dock = hostLobby
        ? `<div class="dock"><span class="reward-line">${need ? esc(need) : `${st.players.length} players · ${FISH_SVG} fish for everyone`}</span><button class="btn big green" data-net="start" ${need ? 'disabled' : ''} type="button">START</button></div>`
        : `<div class="dock"><span class="reward-line">${st.inMatch ? 'A match is on: you\'ll play in the next one.' : 'Waiting for the host to start…'}</span></div>`;
    }
    root.innerHTML = `
      <div class="topbar"><button class="btn white sm" data-net="back" type="button">← ${hostLobby || guestLobby ? 'Leave room' : 'Back'}</button><h2>Play with friends</h2><div class="grow"></div></div>
      <div class="setup">${status}${body}</div>${dock}`;
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-net]');
    if (!t || t.disabled) return;
    const a = t.dataset.net, v = t.dataset.v;
    Sfx.click && Sfx.click();
    if (a === 'host') { host(); return; }
    if (a === 'join') { st.maxTries = 2; join($('#net-code') ? $('#net-code').value : st.typed, 0); return; }
    if (a === 'back') { leave(); UI.show('title'); return; }
    if (a === 'lobby') { backToLobby(); return; }
    if (a === 'copy') {
      const url = inviteUrl(), done = () => { st.status = 'Invite link copied! Paste it to your friends.'; rerender(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => { const i = $('#net-link'); if (i) i.select(); });
      else { const i = $('#net-link'); if (i) i.select(); }
      return;
    }
    if (a === 'start') { start(); return; }
    if (st.role !== 'host') return;
    if (a === 'mode' && MODES[v]) st.mode = v;
    else if (a === 'together') st.together = v === '1';
    else if (a === 'bots' && LEVELS[v]) st.bots = v;
    else if (a === 'len') st.len = +v || 180;
    else return;
    lobbyOut(); rerender();
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'net-name') { save.netName = cleanName(e.target.value); persist(); }
    else if (e.target.id === 'net-code') { const c = cleanCode(e.target.value); if (c !== e.target.value) e.target.value = c; st.typed = c; }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'net-code') { st.maxTries = 2; join(e.target.value, 0); } });

  // ?room=CODE in the address (an invite link) joins that room straight away
  function boot() {
    const m = /[?&]room=([A-Za-z]{5})\b/.exec(location.search);
    if (!m) return;
    st.maxTries = NET_JOIN_TRIES;
    UI.show('online');
    join(m[1], 0);
  }
  const resultButtons = () => `<button class="btn green" data-net="lobby" type="button">Back to lobby</button>`;
  return {
    ev, boot, render, leave, applyInputs, hostFrame, guestFrame, sendStats, resultButtons,
    get role() { return st.role; },
  };
})();
