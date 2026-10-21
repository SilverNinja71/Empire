// =====================================================================
//  UI — title, match setup, garage (upgrades), locker (cosmetics),
//  how to play, settings, pause, results
// =====================================================================
function diffIcon(key) {
  const acc = {
    easy: '<path d="M14 9 Q18 2 22 8 Q25 3 28 9" fill="#fff6c4" stroke="#1b1d3a" stroke-width="2"/>',
    normal: '',
    hard: '<rect x="7" y="13" width="32" height="6" rx="2" fill="#ff5fa8" stroke="#1b1d3a" stroke-width="2"/><path d="M38 15 l7 -3 l-1 7 z" fill="#ff5fa8" stroke="#1b1d3a" stroke-width="2"/>',
    god: '<ellipse cx="23" cy="5" rx="12" ry="3.5" fill="none" stroke="#ffd23f" stroke-width="3"/><path d="M12 15 L15 7 L19 12 L23 5 L27 12 L31 7 L34 15 Z" fill="#ffd23f" stroke="#1b1d3a" stroke-width="2" stroke-linejoin="round"/>',
  }[key];
  const body = key === 'easy' ? '#9aa3c7' : '#2b3050';
  return `<svg viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="27" r="16" fill="${body}" stroke="#1b1d3a" stroke-width="2.5"/><ellipse cx="17.5" cy="29" rx="6" ry="7.5" fill="#fff"/><ellipse cx="28.5" cy="29" rx="6" ry="7.5" fill="#fff"/><circle cx="18" cy="27" r="2.6" fill="#1b1d3a"/><circle cx="28" cy="27" r="2.6" fill="#1b1d3a"/><path d="M19 33 L27 33 L23 39 Z" fill="#ffa41b" stroke="#1b1d3a" stroke-width="1.6" stroke-linejoin="round"/>${acc}</svg>`;
}
const UPG_ICONS = {
  speed: '<path d="M4 18 L14 10 L4 2 M14 18 L24 10 L14 2" fill="none" stroke="#1b1d3a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" transform="translate(1 5)"/>',
  thrust: '<path d="M10 3 h10 v14 h-10 z M8 17 h14 l-3 5 h-8 z" fill="#fff" stroke="#1b1d3a" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 22 q3 7 6 0" fill="#ff6a2b" stroke="#1b1d3a" stroke-width="2"/>',
  tank: '<path d="M3 15 Q11 5 20 11 L27 6 L25 15 L27 24 L20 19 Q11 25 3 15Z" fill="#fff" stroke="#1b1d3a" stroke-width="2.5" stroke-linejoin="round"/><circle cx="9" cy="13.5" r="1.8" fill="#1b1d3a"/>',
  flip: '<path d="M5 24 Q15 -6 25 24" fill="none" stroke="#1b1d3a" stroke-width="3.5" stroke-linecap="round"/><path d="M21 19 l4 5 l3 -6" fill="none" stroke="#1b1d3a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  kick: '<path d="M15 2 l3 8 l8 1 l-6 6 l2 9 l-7 -5 l-7 5 l2 -9 l-6 -6 l8 -1 z" fill="#fff" stroke="#1b1d3a" stroke-width="2.5" stroke-linejoin="round"/>',
  grip: '<path d="M4 20 h20 M7 20 v-12 h10 l4 6 v6" fill="none" stroke="#1b1d3a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 25 h26" stroke="#1b1d3a" stroke-width="3" stroke-linecap="round"/>',
};
function hatIcon(id) {
  const s = (d) => `<svg viewBox="0 0 40 40" aria-hidden="true">${d}</svg>`;
  const st = 'stroke="#1b1d3a" stroke-width="2.5" stroke-linejoin="round"';
  switch (id) {
    case 'none': return s(`<circle cx="20" cy="20" r="11" fill="none" ${st}/><path d="M12 28 L28 12" ${st}/>`);
    case 'beanie': return s(`<path d="M8 28 Q8 10 20 10 Q32 10 32 28 Z" fill="#2f8cff" ${st}/><rect x="6" y="26" width="28" height="6" rx="3" fill="#fff" ${st}/><circle cx="20" cy="8" r="4" fill="#fff" ${st}/>`);
    case 'party': return s(`<path d="M10 33 L20 5 L30 33 Z" fill="#ff5fa8" ${st}/><circle cx="20" cy="5" r="3.5" fill="#ffd23f" ${st}/>`);
    case 'cone': return s(`<path d="M12 31 L20 6 L28 31 Z" fill="#ff7a1a" ${st}/><path d="M15 21 h10" stroke="#fff" stroke-width="4"/><rect x="7" y="30" width="26" height="4" rx="2" fill="#ff7a1a" ${st}/>`);
    case 'tophat': return s(`<rect x="12" y="7" width="16" height="22" rx="2" fill="#22243d" ${st}/><rect x="5" y="28" width="30" height="5" rx="2.5" fill="#22243d" ${st}/><rect x="12" y="23" width="16" height="4" fill="#ff5fa8"/>`);
    case 'propeller': return s(`<path d="M8 30 Q8 16 20 16 Q32 16 32 30 Z" fill="#ff5fa8" ${st}/><path d="M20 16 V9" ${st}/><path d="M7 8 h26" stroke="#ffd23f" stroke-width="5" stroke-linecap="round"/><path d="M7 8 h26" stroke="#1b1d3a" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>`);
    case 'chef': return s(`<rect x="12" y="20" width="16" height="12" fill="#fff" ${st}/><circle cx="13" cy="16" r="6" fill="#fff" ${st}/><circle cx="27" cy="16" r="6" fill="#fff" ${st}/><circle cx="20" cy="12" r="7" fill="#fff" ${st}/>`);
    case 'viking': return s(`<path d="M9 30 Q9 14 20 14 Q31 14 31 30 Z" fill="#b8c2d8" ${st}/><path d="M9 22 Q2 18 4 8 Q9 15 12 17" fill="#fff6dc" ${st}/><path d="M31 22 Q38 18 36 8 Q31 15 28 17" fill="#fff6dc" ${st}/>`);
    case 'crown': return s(`<path d="M7 30 L9 12 L15 20 L20 9 L25 20 L31 12 L33 30 Z" fill="#ffc21a" ${st}/><circle cx="20" cy="25" r="2.5" fill="#ff5fa8"/>`);
    case 'halo': return s(`<ellipse cx="20" cy="20" rx="14" ry="6" fill="none" stroke="#ffd23f" stroke-width="5"/><ellipse cx="20" cy="20" rx="14" ry="6" fill="none" stroke="#1b1d3a" stroke-width="1.5"/>`);
    default: return s('');
  }
}

// ---------- title art: snow cap over PENGUIN, peeking mascot, icicles under LEAGUE
const UI_PFACE = '<svg class="pface" viewBox="0 0 40 40" aria-hidden="true"><g stroke="#1b1d3a" stroke-width="3" stroke-linejoin="round"><circle cx="20" cy="21" r="16.5" fill="#2b3050"/><path d="M20 15C15 9 6 13 7 23 8 31 14 35 20 35 26 35 32 31 33 23 34 13 25 9 20 15Z" fill="#fff"/><path d="M16 24Q20 21.5 24 24Q22 29 20 29Q18 29 16 24Z" fill="#ffa41b" stroke-width="2"/></g><ellipse cx="15" cy="20" rx="2.4" ry="3" fill="#1b1d3a"/><ellipse cx="25" cy="20" rx="2.4" ry="3" fill="#1b1d3a"/><circle cx="15.8" cy="18.9" r=".9" fill="#fff"/><circle cx="25.8" cy="18.9" r=".9" fill="#fff"/><ellipse cx="11" cy="26" rx="2.4" ry="1.4" fill="#ff5fa8" opacity=".65"/><ellipse cx="29" cy="26" rx="2.4" ry="1.4" fill="#ff5fa8" opacity=".65"/></svg>';
const UI_LOGO_CAP = '<svg class="cap" viewBox="0 0 400 36" preserveAspectRatio="none" aria-hidden="true"><path d="M6 22C2 12 14 6 26 9C34 1 54 0 64 6C76-1 98 0 108 7C120 1 140 2 150 8C164 0 186 1 196 7C210 0 232 2 240 8C254 1 276 0 286 7C298 1 320 2 330 8C344 1 366 2 374 9C388 7 398 14 394 22C390 27 380 26 372 26C364 26 362 34 354 34C346 34 346 26 336 26L290 26C282 26 282 31 276 31C270 31 270 26 262 26L214 26C206 26 206 36 198 36C190 36 190 26 182 26L130 26C122 26 122 32 116 32C110 32 110 26 102 26L60 26C52 26 52 35 45 35C38 35 38 26 30 26C18 27 8 28 6 22Z" fill="#fff" stroke="#1b1d3a" stroke-width="4.5" stroke-linejoin="round"/><path d="M30 13Q40 8 52 10M120 11Q132 6 142 9M212 10Q222 5 232 8M300 11Q312 6 322 9" fill="none" stroke="#d6efff" stroke-width="3.5" stroke-linecap="round"/></svg>';
const UI_LOGO_ICE = '<svg class="drip" viewBox="0 0 356.5 34" preserveAspectRatio="none" aria-hidden="true"><path d="M12 0L38 0Q30.72 17.6 27 30Q25 33 23 30Q19.28 17.6 12 0ZM72 0L88 0Q83.52 11 82 18Q80 21 78 18Q76.48 11 72 0ZM105 0L123 0Q117.96 14.3 116 24Q114 27 112 24Q110.04 14.3 105 0ZM191 0L215 0Q208.28 17.05 205 29Q203 32 201 29Q197.72 17.05 191 0ZM262 0L278 0Q273.52 11.55 272 19Q270 22 268 19Q266.48 11.55 262 0ZM319 0L341 0Q334.84 15.95 332 27Q330 30 328 27Q325.16 15.95 319 0Z" fill="#dcf4ff" stroke="#1b1d3a" stroke-width="4" stroke-linejoin="round"/><path d="M20.3 13L22.9 21M198.7 13L201 21M326 13L328.2 19" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>';
const UI_MASCOT = '<svg class="mascot" viewBox="0 0 100 96" aria-hidden="true"><g stroke="#1b1d3a" stroke-width="4.5" stroke-linejoin="round"><path d="M44 18C38 6 46 0 50 10C52 0 62 2 56 16Z" fill="#2b3050"/><path d="M13 84C8 44 28 15 50 15C72 15 92 44 87 84Z" fill="#2b3050"/><path d="M50 42C40 30 20 36 22 57C24 74 38 82 50 82C62 82 76 74 78 57C80 36 60 30 50 42Z" fill="#fff"/><path d="M43 62Q50 57.5 57 62Q53 71 50 71Q47 71 43 62Z" fill="#ffa41b" stroke-width="3.5"/></g><ellipse cx="40" cy="54" rx="5" ry="6.5" fill="#1b1d3a"/><ellipse cx="60" cy="54" rx="5" ry="6.5" fill="#1b1d3a"/><circle cx="41.8" cy="51.4" r="2" fill="#fff"/><circle cx="61.8" cy="51.4" r="2" fill="#fff"/><ellipse cx="31" cy="66" rx="5" ry="3" fill="#ff5fa8" opacity=".6"/><ellipse cx="69" cy="66" rx="5" ry="3" fill="#ff5fa8" opacity=".6"/><path d="M28 21Q36 15 44 17" fill="none" stroke="#5b6494" stroke-width="3" stroke-linecap="round"/><path d="M-2 100C-2 84 8 76 20 80C28 72 42 73 50 80C58 72 72 72 80 79C92 74 102 84 102 100Z" fill="#fff"/><path d="M-2 92C-1 83 9 77 20 80C28 72 42 73 50 80C58 72 72 72 80 79C92 74 101 82 102 92" fill="none" stroke="#1b1d3a" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><g fill="#2b3050" stroke="#1b1d3a" stroke-width="4" stroke-linejoin="round"><path d="M12 82C8 74 12 66 20 68C26 70 27 78 23 84Z"/><path d="M88 82C92 74 88 66 80 68C74 70 73 78 77 84Z"/></g></svg>';

const UI = (() => {
  const screens = ['title', 'play', 'online', 'garage', 'locker', 'howto', 'settings', 'results', 'pause'];
  let cur = null, lockerTab = 'hat', resetArmed = false;
  // purchase confirm state: nothing is bought on the first click
  let lockerSel = null, upgSel = null, armedAt = 0, notice = '', bump = false;
  const el = (id) => $('#scr-' + id);
  const fishPill = () => `<div class="pill${bump ? ' bump' : ''}" title="Fish (currency)">${FISH_SVG}<span>${save.fish.toLocaleString()}</span></div>`;
  const back = (label = 'Back') => `<button class="btn white sm" data-go="title" type="button">← ${label}</button>`;
  const lockerList = () => (lockerTab === 'hat' ? HATS : lockerTab === 'skin' ? SKINS : TRAILS);
  function clearPending() { lockerSel = upgSel = null; notice = ''; }
  // show an unbought item on the showroom penguin without touching the save
  function previewShowroom() {
    if (!lockerSel) { refreshShowroomPenguin(); return; }
    const real = save.equip;
    save.equip = { ...real, [lockerTab]: lockerSel };
    try { refreshShowroomPenguin(); } finally { save.equip = real; }
  }
  // re-render a screen keeping its scroll positions (and the panel's)
  function rerender(id) {
    const s = el(id), p = s.querySelector('.panel'), st = s.scrollTop, pt = p ? p.scrollTop : 0;
    render[id]();
    s.scrollTop = st; const np = s.querySelector('.panel'); if (np) np.scrollTop = pt;
    bump = false;
  }
  function show(id) {
    if (cur !== id) clearPending();
    cur = id;
    for (const s of screens) el(s).hidden = s !== id;
    const bg = $('#menu-bg');
    bg.hidden = id === 'pause' || id === null;
    bg.classList.toggle('light', id === 'garage' || id === 'locker');
    bg.classList.toggle('lowq', save.settings.quality === 'low');
    $('#menu').style.pointerEvents = id ? '' : 'none';
    if (id && render[id]) render[id]();
    if (id === 'garage' || id === 'locker') refreshShowroomPenguin();
  }
  const sel = (on) => `aria-pressed="${on ? 'true' : 'false'}"`;
  const rangePct = (v, a, b) => `${(clamp((v - a) / (b - a), 0, 1) * 100).toFixed(1)}%`;
  const fishAmt = (n) => `${FISH_SVG}<span>${n.toLocaleString()}</span>`;
  const swatch = (tab, it) => {
    if (tab === 'hat') return `<span class="sw" style="background:radial-gradient(circle at 40% 30%,#fff,#d6efff)">${hatIcon(it.id)}</span>`;
    if (tab === 'skin') { const h = (n) => '#' + n.toString(16).padStart(6, '0'); return `<span class="sw" style="background:${h(it.body)}"><svg viewBox="0 0 40 40"><ellipse cx="20" cy="24" rx="10" ry="12" fill="${h(it.belly)}" stroke="#1b1d3a" stroke-width="2"/></svg></span>`; }
    return `<span class="sw" style="background:${it.color}"></span>`;
  };
  const render = {
    title() {
      const c = save.career;
      el('title').innerHTML = `
        <div class="topbar"><div class="grow"></div>${fishPill()}</div>
        <div class="title-mid">
          <h1 class="logo" aria-label="Penguin League"><span class="l1">PENGUIN${UI_LOGO_CAP}${UI_MASCOT}</span><span class="l2">LEAGUE${UI_LOGO_ICE}</span></h1>
          <p class="tagline">Belly-slide soccer with jetpacks</p>
        </div>
        <nav class="title-actions">
          <button class="btn big" data-go="play" type="button">${UI_PFACE}PLAY</button>
          <button class="btn blue friends-btn" data-go="online" type="button">PLAY WITH FRIENDS</button>
          <div class="row">
            <button class="btn blue" data-go="garage" type="button">Garage</button>
            <button class="btn pink" data-go="locker" type="button">Locker</button>
            <button class="btn green" data-go="howto" type="button">How to play</button>
            <button class="btn white" data-go="settings" type="button">Settings</button>
          </div>
          <div class="career">
            <span class="stat"><b>${c.played}</b>matches</span><span class="stat"><b>${c.wins}</b>wins</span>
            <span class="stat"><b>${c.goals}</b>goals</span><span class="stat"><b>${c.godWins}</b>God bots beaten</span>
          </div>
        </nav>`;
    },
    online() { Online.render(el('online')); },
    play() {
      const L = save.last;
      const modeCard = (m) => { const d = MODES[m]; const dots = (cls) => `<span class="dot ${cls}"></span>`.repeat(d.n); return `<button class="opt" data-mode="${m}" ${sel(L.mode === m)} type="button"><span class="t">${d.label} · ${d.name}</span><span class="teams">${dots('b')} vs ${dots('o')}</span><span class="s">${d.desc}</span></button>`; };
      const diffCard = (k) => {
        const lv = LEVELS[k];
        return `<button class="opt" data-opp="${k}" ${sel(L.opp === k)} type="button">
          <span class="diff-head">${diffIcon(k)}<span><span class="t">${lv.label}</span><br><span class="tag" style="background:${lv.color}">×${lv.reward} fish</span></span></span>
          <span class="s">${lv.blurb}</span>
          <span class="bars">${SKILL_NAMES.map((n, i) => `<span>${n}</span><span class="pips" style="--c:${lv.color}">${[1, 2, 3, 4, 5].map((p) => `<i class="${p <= lv.skill[i] ? 'on' : ''}"></i>`).join('')}</span>`).join('')}</span>
        </button>`;
      };
      const mult = LEVELS[L.opp].reward * (L.fair ? 1.25 : 1) * (L.mode === '5v5' ? 1.1 : 1);
      el('play').innerHTML = `
        <div class="topbar">${back()}<h2>Match setup</h2><div class="grow"></div>${fishPill()}</div>
        <div class="setup">
          <section class="sect"><h3>Mode</h3><div class="grid modes">${Object.keys(MODES).map(modeCard).join('')}</div></section>
          <section class="sect"><h3>Opponent bots</h3>
            <p class="note">Every bot drives a stock penguin with your exact physics and controls. No speed or boost cheats: harder bots only read the play better.</p>
            <div class="grid diffs">${LEVEL_ORDER.map(diffCard).join('')}</div></section>
          <section class="sect"><h3>Teammate bots</h3>
            <div class="chips">${LEVEL_ORDER.map((k) => `<button class="chip" data-mate="${k}" ${sel(L.mate === k)} ${L.mode === '1v1' ? 'disabled' : ''} type="button">${LEVELS[k].label}</button>`).join('')}</div>
            ${L.mode === '1v1' ? '<p class="note" style="margin-top:8px">No teammates in a duel.</p>' : ''}</section>
          <section class="sect"><h3>Match length</h3>
            <div class="chips">${[[120, '2 min'], [180, '3 min'], [300, '5 min']].map(([s, t]) => `<button class="chip" data-len="${s}" ${sel(L.len === s)} type="button">${t}</button>`).join('')}</div></section>
          <section class="sect"><h3>Fair play</h3>
            <button class="switch" role="switch" data-fair aria-checked="${L.fair}" type="button"><span class="knob"></span><span class="lbl"><b>Stock penguin for me too</b>Turn off your garage upgrades for a straight skill test. Pays 25% more fish.</span></button></section>
        </div>
        <div class="dock">
          <span class="reward-line">${FISH_SVG} Reward ×${mult.toFixed(2).replace(/\.?0+$/, '')}</span>
          <button class="btn big green" data-start type="button">START</button>
        </div>`;
    },
    garage() {
      const u = save.upgrades;
      const g0 = upgSel && UPGRADES.find((g) => g.id === upgSel);
      let confirm = '';
      if (g0 && u[g0.id] < 5) {
        const lvl = u[g0.id], cost = UPG_COST[lvl], short = cost - save.fish;
        confirm = `<div class="confirm" role="group" aria-label="Confirm upgrade">
          <span class="cf-ico" style="background:${g0.color}"><svg viewBox="0 0 30 30">${UPG_ICONS[g0.id]}</svg></span>
          <span class="cf-txt" aria-live="polite"><b>Upgrade ${esc(g0.name)} to level ${lvl + 1} for ${cost.toLocaleString()} fish?</b>${short > 0 ? `<span class="warn">You need ${short.toLocaleString()} more fish.</span> Play a match to catch some!` : `${g0.eff(lvl + 1)} · you'll have ${(save.fish - cost).toLocaleString()} fish left`}</span>
          <span class="cf-act"><button class="btn white sm" data-cancel type="button">Cancel</button>${short > 0 ? '<button class="btn white" type="button" disabled>Not enough fish</button>' : `<button class="btn green" data-upg-buy="${g0.id}" type="button">Buy · ${fishAmt(cost)}</button>`}</span>
        </div>`;
      }
      el('garage').innerHTML = `
        <div class="topbar">${back()}<h2>Garage</h2><div class="grow"></div>${fishPill()}</div>
        <div class="split"><div></div>
          <div class="panel">
            <p class="panel-note">${notice ? `<span class="notice">${esc(notice)}</span>` : ''}Upgrades apply to your penguin only. Bots always play on a stock penguin, so these give you an edge without changing how the bots behave. Max out Jetpack Thrust to turn your jetpack gold.</p>
            ${UPGRADES.map((g) => {
              const lvl = u[g.id], maxed = lvl >= 5, cost = UPG_COST[lvl], on = upgSel === g.id;
              return `<div class="upg${on ? ' sel' : ''}">
                <span class="ico" style="background:${g.color}"><svg viewBox="0 0 30 30">${UPG_ICONS[g.id]}</svg></span>
                <span><span class="nm">${g.name}</span><br><span class="ds">${g.desc}</span></span>
                <span class="buy">${maxed ? '<span class="tag" style="background:var(--lime)">MAXED</span>' : `<button class="btn sm ${on ? '' : save.fish >= cost ? 'green' : 'white'}" data-upg="${g.id}" ${sel(on)} aria-label="Upgrade ${esc(g.name)}, ${cost} fish" type="button">${fishAmt(cost)}</button>`}</span>
                <span class="lv"><span class="pips" style="--c:${g.color}">${[1, 2, 3, 4, 5].map((p) => `<i class="${p <= lvl ? 'on' : ''}"></i>`).join('')}</span><span class="eff">${lvl ? g.eff(lvl) : 'Stock'}</span></span>
              </div>`;
            }).join('')}
            ${confirm}
          </div></div>`;
    },
    locker() {
      const list = lockerList();
      const it0 = lockerSel && list.find((x) => x.id === lockerSel);
      let confirm = '';
      if (it0) {
        const short = it0.cost - save.fish;
        const what = lockerTab === 'trail' ? 'Shows up when you boost.' : 'Previewing on your penguin.';
        confirm = `<div class="confirm" role="group" aria-label="Confirm purchase">
          ${swatch(lockerTab, it0)}
          <span class="cf-txt" aria-live="polite"><b>${esc(it0.name)}</b>${it0.god ? `<span class="warn">Beat a God bot to unlock it.</span> ${what}` : short > 0 ? `<span class="warn">You need ${short.toLocaleString()} more fish.</span> Play a match to catch some! ${what}` : `${what} Costs ${it0.cost.toLocaleString()} fish, you have ${save.fish.toLocaleString()}.`}</span>
          <span class="cf-act"><button class="btn white sm" data-cancel type="button">Cancel</button>${it0.god ? '' : short > 0 ? '<button class="btn white" type="button" disabled>Not enough fish</button>' : `<button class="btn green" data-buy="${it0.id}" type="button">Buy ${esc(it0.name)} · ${fishAmt(it0.cost)}</button>`}</span>
        </div>`;
      }
      el('locker').innerHTML = `
        <div class="topbar">${back()}<h2>Locker</h2><div class="grow"></div>${fishPill()}</div>
        <div class="split"><div></div>
          <div class="panel">
            <div class="tabs">${[['hat', 'Hats'], ['skin', 'Feathers'], ['trail', 'Boost trails']].map(([k, t]) => `<button class="chip" data-tab="${k}" ${sel(lockerTab === k)} type="button">${t}</button>`).join('')}</div>
            <p class="panel-note">${notice ? `<span class="notice">${esc(notice)}</span>` : ''}Cosmetics only. Tap one to try it on; you only pay when you press Buy.</p>
            <div class="items">${list.map((it) => {
              const owned = save.owned[lockerTab].includes(it.id), eq = save.equip[lockerTab] === it.id;
              const locked = it.god && !owned;
              return `<button class="item${lockerSel === it.id ? ' sel' : ''}" data-item="${it.id}" ${sel(eq)} type="button">${swatch(lockerTab, it)}<span class="nm">${it.name}</span>
                ${eq ? '<span class="tag" style="background:var(--lime)">EQUIPPED</span>' : owned ? '<span class="pr">Owned · tap to wear</span>' : locked ? '<span class="lock">Beat a God bot to unlock</span>' : `<span class="pr${save.fish < it.cost ? ' short' : ''}">${fishAmt(it.cost)}</span>`}</button>`;
            }).join('')}</div>
            ${confirm}
          </div></div>`;
    },
    howto() {
      el('howto').innerHTML = `
        <div class="topbar">${back()}<h2>How to play</h2></div>
        <div class="sheet">
          <div class="card"><h3>Keyboard + mouse</h3><div class="keys">
            <div><kbd>W</kbd><kbd>S</kbd> slide forward / reverse · tilt your nose in the air</div>
            <div><kbd>A</kbd><kbd>D</kbd> steer · turn in the air</div>
            <div><kbd>Space</kbd> or <kbd>Right click</kbd> jump · press again to double jump</div>
            <div><kbd>Shift</kbd> or <kbd>Left click</kbd> jetpack boost</div>
            <div><kbd>F</kbd> hold to charge a power shot · steer with <kbd>A</kbd><kbd>D</kbd> as you hit it to curve it</div>
            <div><kbd>X</kbd> powerslide</div>
            <div><kbd>C</kbd> ball cam on / off</div>
            <div><kbd>Tab</kbd> scoreboard · <kbd>Esc</kbd> or <kbd>P</kbd> pause</div>
          </div></div>
          <div class="card"><h3>Gamepad</h3><div class="keys">
            <div><kbd>RT</kbd> / <kbd>LT</kbd> forward / reverse</div><div><kbd>Left stick</kbd> steer and aim in the air</div>
            <div><kbd>A</kbd> jump</div><div><kbd>B</kbd> boost</div><div><kbd>X</kbd> powerslide</div>
            <div><kbd>RB</kbd> charge a power shot</div><div><kbd>Y</kbd> ball cam</div><div><kbd>Start</kbd> pause</div>
          </div></div>
          <div class="card"><h3>Moves</h3><ul class="tips">
            <li><b>Belly dive:</b> jump, then jump again while holding a direction for a burst of speed and a harder hit. Penguins stay upright in the air: they never roll.</li>
            <li><b>Aerial:</b> jump, tilt your nose up with S, then boost. Steer in the air to meet the ball.</li>
            <li><b>Ice crystals:</b> the six glowing crystals (four corners, two at midfield) fill your tank and give a 1.35× speed burst for 1.5 seconds, then regrow after 10. Small fish give 12 boost and come back after 4 seconds.</li>
            <li><b>Charged shots:</b> hold charge as you close in. Once the meter passes the first notch your next touch hits harder, and the way you're steering at contact curves the ball. You're a little slower while charging.</li>
            <li><b>Curve:</b> glancing hits, hits while turning and charged shots spin the ball so it bends in the air (watch for the icy ribbon). Bots read the curve with the same physics you do.</li>
            <li><b>Team roles:</b> bot teammates and opponents play a duty: <b>Striker</b> goes for the ball, <b>Goalie</b> keeps goal, and in 5v5 a <b>Sweeper</b> covers the middle. They swap duties as the play moves, and the badge over each name shows who is doing what.</li>
            <li><b>Walls:</b> slide straight up the curved walls. Keep your speed or you'll drop off.</li>
            <li><b>Demolitions:</b> hit an opponent at supersonic speed (watch for the speed lines) to send them back to spawn for 3 seconds.</li>
            <li><b>Stuck on your back?</b> Press jump to flop back onto your belly.</li>
            <li><b>Overtime:</b> if it's tied when the clock runs out, the next goal wins.</li>
          </ul></div>
        </div>`;
    },
    settings() {
      const s = save.settings;
      el('settings').innerHTML = `
        <div class="topbar">${back()}<h2>Settings</h2></div>
        <div class="sheet"><div class="card">
          <div class="setrow"><label for="set-ballcam">Ball cam by default<small>Keeps the ball in view. Toggle in a match with C.</small></label><button class="switch" id="set-ballcam" role="switch" aria-checked="${s.ballCam}" type="button"><span class="knob"></span><span class="lbl">${s.ballCam ? 'On' : 'Off'}</span></button></div>
          <div class="setrow"><label for="set-fov">Field of view<small>${s.fov}° horizontal (pros use 110°)</small></label><input id="set-fov" type="range" min="60" max="110" step="1" value="${s.fov}" style="--v:${rangePct(s.fov, 60, 110)}"></div>
          <div class="setrow"><label for="set-dist">Camera distance<small>${Math.round(s.camDist * 100)}%</small></label><input id="set-dist" type="range" min="0.75" max="1.5" step="0.05" value="${s.camDist}" style="--v:${rangePct(s.camDist, 0.75, 1.5)}"></div>
          <div class="setrow"><label for="set-vol">Volume<small>${Math.round(s.volume * 100)}%</small></label><input id="set-vol" type="range" min="0" max="1" step="0.05" value="${s.volume}" style="--v:${rangePct(s.volume, 0, 1)}"></div>
          <div class="setrow"><label for="set-shake">Camera shake<small>${Math.round(s.camShake * 100)}%</small></label><input id="set-shake" type="range" min="0" max="1" step="0.05" value="${s.camShake}" style="--v:${rangePct(s.camShake, 0, 1)}"></div>
          <div class="setrow"><label for="set-motion">Reduced motion<small>No camera shake, goal slow motion, white flash or confetti.</small></label><button class="switch" id="set-motion" role="switch" aria-checked="${s.reducedMotion}" type="button"><span class="knob"></span><span class="lbl">${s.reducedMotion ? 'On' : 'Off'}</span></button></div>
          <div class="setrow"><label>Graphics<small>Auto keeps it smooth by lowering the resolution when needed. Low turns off shadows and effects for older devices.</small></label><div class="chips"><button class="chip" data-q="auto" ${sel(s.quality === 'auto')} type="button">Auto</button><button class="chip" data-q="high" ${sel(s.quality === 'high')} type="button">High</button><button class="chip" data-q="low" ${sel(s.quality === 'low')} type="button">Low</button></div></div>
          <div class="setrow"><label for="set-hints">Control hints<small>Shows the key list for the first seconds of a match.</small></label><button class="switch" id="set-hints" role="switch" aria-checked="${s.hints}" type="button"><span class="knob"></span><span class="lbl">${s.hints ? 'On' : 'Off'}</span></button></div>
          <div class="setrow"><label>Reset progress<small>Clears fish, upgrades, cosmetics and career stats on this device.</small></label><div><button class="btn sm ${resetArmed ? 'pink' : 'white'}" id="set-reset" type="button">${resetArmed ? 'Tap again to erase' : 'Reset save'}</button></div></div>
        </div></div>`;
    },
    pause() {
      el('pause').innerHTML = M.online ? `<div class="card pause-card"><h2>Menu</h2>
        <button class="btn green" data-resume type="button">Back to the match</button>
        <button class="btn white" data-quit type="button">Leave the match</button>
        <p class="panel-note" style="margin:4px 0 0">Online matches keep going while this menu is open.</p></div>` : `<div class="card pause-card"><h2>Paused</h2>
        <button class="btn green" data-resume type="button">Resume</button>
        <button class="btn blue" data-restart type="button">Restart match</button>
        <button class="btn white" data-quit type="button">Quit to menu</button>
        <p class="panel-note" style="margin:4px 0 0">Quitting forfeits the match and pays no fish.</p></div>`;
    },
  };

  // ---------- interactions
  function cancelPending(sfx = true) {
    if (!lockerSel && !upgSel) return false;
    const wasLocker = !!lockerSel; clearPending();
    if (sfx) Sfx.click();
    if (cur === 'locker') { rerender('locker'); if (wasLocker) refreshShowroomPenguin(); }
    else if (cur === 'garage') rerender('garage');
    return true;
  }
  // keep the picked tile/row visible above the confirm bar, then move focus to the bar
  function revealPick() {
    const s = el(cur), p = $('.panel', s), cf = $('.confirm', s), pick = $('.item.sel, .upg.sel', s);
    if (!p || !cf || !pick) return;
    const over = pick.getBoundingClientRect().bottom + 10 - cf.getBoundingClientRect().top;
    if (over > 0) (p.scrollHeight > p.clientHeight + 1 && getComputedStyle(p).overflowY !== 'visible' ? p : s).scrollTop += over;
  }
  const focusConfirm = () => { const s = el(cur), b = $('.confirm [data-buy], .confirm [data-upg-buy]', s) || $('.confirm [data-cancel]', s); if (b) b.focus({ preventScroll: true }); };
  const tooSoon = () => performance.now() - armedAt < 350;   // a double click must never turn into a purchase
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    // clicking anywhere else on the garage/locker screen backs out of a pending purchase
    if ((lockerSel || upgSel) && e.target.closest('.screen') && !e.target.closest('.confirm,[data-item],[data-upg],[data-go],[data-tab]')) {
      cancelPending(); if (!t) return;
    }
    if (!t) return;
    Sfx.init();
    if (t.dataset.go) { Sfx.click(); resetArmed = false; show(t.dataset.go); return; }
    const L = save.last;
    if (t.dataset.mode) { L.mode = t.dataset.mode; persist(); Sfx.click(); render.play(); return; }
    if (t.dataset.opp) { L.opp = t.dataset.opp; persist(); Sfx.click(); render.play(); return; }
    if (t.dataset.mate && !t.disabled) { L.mate = t.dataset.mate; persist(); Sfx.click(); render.play(); return; }
    if (t.dataset.len) { L.len = +t.dataset.len; persist(); Sfx.click(); render.play(); return; }
    if ('fair' in t.dataset) { L.fair = !L.fair; persist(); Sfx.click(); render.play(); return; }
    if ('start' in t.dataset) { Sfx.click(); begin(); return; }
    if ('cancel' in t.dataset) { cancelPending(); return; }
    // garage: first click picks the upgrade and opens the confirm step
    if (t.dataset.upg) {
      const id = t.dataset.upg;
      if (save.upgrades[id] >= 5) return;
      if (upgSel === id) { cancelPending(); return; }
      upgSel = id; notice = ''; armedAt = performance.now();
      if (save.fish >= UPG_COST[save.upgrades[id]]) Sfx.click(); else Sfx.deny();
      rerender('garage'); revealPick(); focusConfirm(); return;
    }
    if (t.dataset.upgBuy) {
      if (tooSoon()) return;
      const id = t.dataset.upgBuy, lvl = save.upgrades[id], cost = UPG_COST[lvl], g = UPGRADES.find((x) => x.id === id);
      if (id !== upgSel || lvl >= 5 || save.fish < cost) { Sfx.deny(); return; }
      save.fish -= cost; save.upgrades[id]++; persist(); Sfx.buy();
      clearPending(); notice = `${g.name} is now level ${lvl + 1}!`; bump = true;
      rerender('garage'); refreshShowroomPenguin(); if (showroom) showroom.spin = 1;
      return;
    }
    if (t.dataset.tab) { if (lockerSel) refreshShowroomPenguin(); clearPending(); lockerTab = t.dataset.tab; Sfx.click(); rerender('locker'); return; }
    // locker: owned items are worn straight away; anything else is only previewed until Buy is pressed
    if (t.dataset.item) {
      const id = t.dataset.item, it = lockerList().find((x) => x.id === id);
      if (!it) return;
      notice = '';
      if (save.owned[lockerTab].includes(id)) {
        lockerSel = null; save.equip[lockerTab] = id; persist(); Sfx.click();
        rerender('locker'); refreshShowroomPenguin(); return;
      }
      if (lockerSel === id) { cancelPending(); return; }
      lockerSel = id; armedAt = performance.now();
      if (it.god || save.fish < it.cost) Sfx.deny(); else Sfx.click();
      rerender('locker'); revealPick(); previewShowroom(); focusConfirm(); return;
    }
    if (t.dataset.buy) {
      if (tooSoon()) return;
      const id = t.dataset.buy, it = lockerList().find((x) => x.id === id);
      if (!it || id !== lockerSel || it.god || save.owned[lockerTab].includes(id) || save.fish < it.cost) { Sfx.deny(); return; }
      save.fish -= it.cost; save.owned[lockerTab].push(id); save.equip[lockerTab] = id; persist(); Sfx.buy();
      clearPending(); notice = `${it.name} is yours!`; bump = true;
      rerender('locker'); refreshShowroomPenguin(); if (showroom) showroom.spin = 1;
      return;
    }
    if (t.id === 'set-ballcam') { save.settings.ballCam = !save.settings.ballCam; persist(); render.settings(); return; }
    if (t.id === 'set-hints') { save.settings.hints = !save.settings.hints; persist(); render.settings(); return; }
    if (t.id === 'set-motion') { save.settings.reducedMotion = !save.settings.reducedMotion; persist(); render.settings(); return; }
    if (t.dataset.q) { save.settings.quality = t.dataset.q; persist(); applyQuality(); $('#menu-bg').classList.toggle('lowq', t.dataset.q === 'low'); render.settings(); return; }
    if (t.id === 'set-reset') {
      if (!resetArmed) { resetArmed = true; render.settings(); return; }
      resetArmed = false;
      const fresh = JSON.parse(JSON.stringify(DEFAULT_SAVE));
      for (const k of Object.keys(fresh)) save[k] = fresh[k];
      persist(); Sfx.deny(); render.settings(); return;
    }
    if ('resume' in t.dataset) { togglePause(); return; }
    if ('restart' in t.dataset) { M.paused = false; show(null); startMatch(M.cfg); $('#hud').hidden = false; return; }
    if ('quit' in t.dataset) { M.paused = false; if (M.online) Online.leave(); toMenu(); return; }
    if ('again' in t.dataset) { show(null); startMatch(M.cfg); $('#hud').hidden = false; return; }
    if ('menu' in t.dataset) { if (M.online) Online.leave(); toMenu(); return; }
  });
  document.addEventListener('input', (e) => {
    const t = e.target, s = save.settings;
    if (t.id === 'set-fov') { s.fov = +t.value; t.previousElementSibling.querySelector('small').textContent = `${s.fov}° horizontal (pros use 110°)`; }
    else if (t.id === 'set-dist') { s.camDist = +t.value; t.previousElementSibling.querySelector('small').textContent = `${Math.round(s.camDist * 100)}%`; }
    else if (t.id === 'set-shake') { s.camShake = +t.value; t.previousElementSibling.querySelector('small').textContent = `${Math.round(s.camShake * 100)}%`; }
    else if (t.id === 'set-vol') { s.volume = +t.value; Sfx.init(); Sfx.setVolume(s.volume); t.previousElementSibling.querySelector('small').textContent = `${Math.round(s.volume * 100)}%`; }
    else return;
    t.style.setProperty('--v', rangePct(+t.value, +t.min, +t.max));
    persist();
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'set-vol') Sfx.click(); });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !inMatch() && cancelPending()) e.preventDefault(); });
  // drag to spin the showroom penguin
  canvas.addEventListener('pointerdown', (e) => { if (showroomOn() && showroom) { showroom.drag = { x: e.clientX, yaw: showroom.yaw }; canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointermove', (e) => { if (showroom && showroom.drag) showroom.yaw = showroom.drag.yaw + (e.clientX - showroom.drag.x) * 0.012; });
  canvas.addEventListener('pointerup', () => { if (showroom) showroom.drag = null; });

  function begin() {
    const L = save.last;
    show(null);
    startMatch({ mode: L.mode, opp: L.opp, mate: L.mode === '1v1' ? L.opp : L.mate, len: L.len, fair: L.fair });
    $('#hud').hidden = false;
    canvas.focus();
  }
  function toMenu() {
    $('#hud').hidden = true; $('#scoreboard').hidden = true;
    startDemo(); show('title');
  }
  function togglePause() {
    if (!inMatch() || M.state === 'over') return;
    // online: the menu opens over the match, which keeps running for everyone
    if (M.online) { clearInput(); if (cur === 'pause') { show(null); canvas.focus(); } else show('pause'); return; }
    M.paused = !M.paused;
    clearInput();
    if (M.paused) show('pause'); else { show(null); canvas.focus(); }
  }
  function results() {
    if (!M.player || M.demo) return;
    const p = M.player, win = myWin(), cfg = M.cfg, L = LEVELS[cfg.opp];
    const parts = [['Match', 25]];
    if (win) parts.push(['Win', 40]);
    if (p.stat.goals) parts.push([`${p.stat.goals} goal${p.stat.goals > 1 ? 's' : ''}`, p.stat.goals * 12]);
    if (p.stat.assists) parts.push(['Assists', p.stat.assists * 6]);
    if (p.stat.saves) parts.push(['Saves', p.stat.saves * 8]);
    if (p.stat.shots) parts.push(['Shots', p.stat.shots * 3]);
    if (p.stat.demos) parts.push(['Demos', p.stat.demos * 4]);
    const base = parts.reduce((a, b) => a + b[1], 0);
    const mult = L.reward * (cfg.fair ? 1.25 : 1) * (cfg.mode === '5v5' ? 1.1 : 1);
    const fish = Math.round(base * mult);
    save.fish += fish;
    save.career.played++; if (win) save.career.wins++; save.career.goals += p.stat.goals;
    let unlocked = false;
    if (win && cfg.opp === 'god') { save.career.godWins++; if (!save.owned.hat.includes('halo')) { save.owned.hat.push('halo'); unlocked = true; } }
    persist();
    $('#hud').hidden = true;
    el('results').innerHTML = `
      <div class="res-banner ${win ? 'win' : 'lose'}">${win ? 'VICTORY!' : 'DEFEAT'}${UI_LOGO_CAP}</div>
      <div class="res-score"><span style="color:#7fd0ff">${M.score[0]}</span><span>–</span><span style="color:#ffb15c">${M.score[1]}</span></div>
      <div class="reward-line">${cfg.online ? `${MODES[cfg.mode].label} online with friends · you were ${TEAM_LABEL[p.team].toLowerCase()}` : `${MODES[cfg.mode].label} vs ${L.label} bots`}${M.overtime ? ' · overtime' : ''}${cfg.fair && !cfg.online ? ' · fair play' : ''}</div>
      <div class="table-wrap">${statsTable()}</div>
      <div class="rewards">${parts.map(([n, v]) => `<span class="pill">${esc(n)} +${v}</span>`).join('')}<span class="pill">×${mult.toFixed(2).replace(/\.?0+$/, '')} bonus</span><span class="pill gold">${FISH_SVG}+${fish}</span></div>
      ${unlocked ? '<div class="reward-line" style="margin-top:12px">You beat a God bot. The Halo is now in your locker.</div>' : ''}
      <div class="res-actions">${cfg.online ? Online.resultButtons() : '<button class="btn green" data-again type="button">Rematch</button><button class="btn blue" data-go="garage" type="button">Garage</button>'}<button class="btn white" data-menu type="button">${cfg.online ? 'Leave room' : 'Main menu'}</button></div>`;
    show('results');
  }
  const showroomOn = () => cur === 'garage' || cur === 'locker';
  return { show, togglePause, results, showroomOn, get cur() { return cur; } };
})();

function startDemo() {
  startMatch({ mode: '2v2', opp: 'hard', mate: 'hard', len: 1e9, demo: true });
}

// ----------------------------------------------------------- boot
async function boot() {
  // no waiting for the web fonts: name tags, badges and arena signs redraw themselves when the fonts arrive
  buildShowroom();
  applyQuality();
  startDemo();
  // compile every shader in the arena now (in the background), so the first kickoff doesn't hitch
  if (renderer.compileAsync) renderer.compileAsync(scene, camera).catch(() => {});
  UI.show('title');
  const ld = $('#loading'); ld.style.transition = 'opacity .5s'; ld.style.opacity = 0; setTimeout(() => { ld.hidden = true; }, 500);
  requestAnimationFrame((t) => { lastFrame = t; frame(t); });
  Online.boot();   // ?room=CODE in the address joins a friend's room straight away
}
addEventListener('resize', resize);
addEventListener('pointerdown', () => Sfx.init());
boot().catch((err) => {
  const ld = $('#loading'); ld.classList.add('err'); ld.hidden = false; ld.style.opacity = 1;
  $('#loading-msg').textContent = 'Penguin League needs WebGL to run. Try another browser or turn on hardware acceleration. (' + (err && err.message ? err.message : err) + ')';
  console.error(err);
});
// debugging handle (read-only use from the console)
window.__penguinLeague = {
  M, A, LEVELS, simTick, startMatch, kickoffReset, save, predictGoal, BALL_R, UI, CAM, scene, camera, renderer, AUTOQ, ballView,
  drawOnce: (dt = 1 / 60) => tick(dt),
  setView: (px, py, pz, lx, ly, lz) => { CAM.override = { pos: new V3(px, py, pz), look: new V3(lx, ly, lz) }; },
  clearView: () => { CAM.override = null; },
};
