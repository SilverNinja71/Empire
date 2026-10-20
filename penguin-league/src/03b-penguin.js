// =====================================================================
//  PENGUINS — hats, player penguin model, name tags, per-frame view, boost trails
// =====================================================================
// ----------------------------------------------------------- geometry helpers (everything baked at real size so outlines stay even)
const pgEu = new THREE.Euler(), pgQt = new Q(), pgPv = new V3(), pgSv = new V3();
function pgXf(p, r, s) {
  pgPv.set(...(p || [0, 0, 0])); pgQt.setFromEuler(pgEu.set(...(r || [0, 0, 0])));
  if (typeof s === 'number') pgSv.setScalar(s); else pgSv.set(...(s || [1, 1, 1]));
  return new THREE.Matrix4().compose(pgPv, pgQt, pgSv);
}
// merge [geo | [geo, pos|Matrix4, rot, scale]] into one indexed geometry (position/normal/uv)
function pgMerge(parts) {
  const gs = parts.map((e) => {
    if (e.isBufferGeometry) return [e, false];
    const m = e[1] && e[1].isMatrix4 ? e[1] : pgXf(e[1], e[2], e[3]);
    return [e[0].clone().applyMatrix4(m), m.determinant() < 0];
  });
  let nv = 0, ni = 0;
  for (const [g] of gs) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
  let vo = 0, io = 0;
  for (const [g, flip] of gs) {
    const c = g.attributes.position.count;
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    const n = g.index ? g.index.count : c, ix = (i) => (g.index ? g.index.array[i] : i) + vo;
    for (let i = 0; i < n; i += 3) { idx[io++] = ix(i); idx[io++] = ix(flip ? i + 2 : i + 1); idx[io++] = ix(flip ? i + 1 : i + 2); }
    vo += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
// recompute normals and average them across coincident vertices (UV seams, poles) so shading and outline hulls stay closed
function pgSmooth(g) {
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4);
    let a = map.get(k); if (!a) map.set(k, (a = [])); a.push(i);
  }
  for (const a of map.values()) {
    if (a.length < 2) continue;
    let x = 0, y = 0, z = 0;
    for (const i of a) { x += n.getX(i); y += n.getY(i); z += n.getZ(i); }
    const l = Math.hypot(x, y, z) || 1;
    for (const i of a) n.setXYZ(i, x / l, y / l, z / l);
  }
  return g;
}
// weld by position (extrusions) -> smooth indexed geometry
function pgWeld(g) {
  const p = g.attributes.position, map = new Map(), pos = [], re = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
    let j = map.get(k); if (j === undefined) { j = pos.length / 3; map.set(k, j); pos.push(x, y, z); }
    re.push(j);
  }
  const src = g.index ? Array.from(g.index.array) : re.map((_, i) => i);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setIndex(src.map((i) => re[i]));
  out.computeVertexNormals();
  return out;
}
// deformed sphere: f(v) receives the unit direction and sets the surface point (sphere UVs kept for painting)
function pgBlob(ws, hs, f) {
  const g = new THREE.SphereGeometry(1, ws, hs), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { pgPv.set(p.getX(i), p.getY(i), p.getZ(i)); f(pgPv); p.setXYZ(i, pgPv.x, pgPv.y, pgPv.z); }
  return pgSmooth(g);
}
const pgEll = (rx, ry, rz, ws = 20, hs = 14) => pgBlob(ws, hs, (v) => v.set(v.x * rx, v.y * ry, v.z * rz));
// lathe around +Y from [r, y] points; optionally resampled evenly by arc length so v-texture rows map to real height
function pgLathe(pts, segs = 32, n = 0) {
  let P = pts.map(([x, y]) => new THREE.Vector2(x, y));
  if (n) {
    const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
    const out = [];
    for (let k = 0; k < n; k++) {
      const d = L[L.length - 1] * k / (n - 1); let i = 1; while (i < L.length - 1 && L[i] < d) i++;
      out.push(new THREE.Vector2().lerpVectors(P[i - 1], P[i], clamp((d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]), 0, 1)));
    }
    P = out;
  }
  return pgSmooth(new THREE.LatheGeometry(P, segs));
}
// pin every uv of g to one texel (lets a small part share a painted material)
function pgUV(g, u, v) { const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, u, v); return g; }
function pgMirrorX(g) { return pgMerge([[g, [0, 0, 0], [0, 0, 0], [-1, 1, 1]]]); }
// bend a +Y-aligned geometry into an arc of radius R curving toward +X (horns)
function pgBend(g, R) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), a = y / R, r = R - x; p.setXY(i, R - r * Math.cos(a), r * Math.sin(a)); }
  return pgSmooth(g);
}
// fluffy pompom: a cluster of balls
function pgFluff(r) {
  const b = new THREE.SphereGeometry(1, 14, 10), parts = [[b, [0, 0, 0], 0, r * 0.78]];
  for (let i = 0; i < 9; i++) {
    const y = 1 - (i + 0.5) / 9 * 2, rr = Math.sqrt(1 - y * y), a = i * 2.4;
    parts.push([b, [Math.cos(a) * rr * r * 0.5, y * r * 0.5, Math.sin(a) * rr * r * 0.5], 0, r * 0.5]);
  }
  return pgMerge(parts);
}

// ----------------------------------------------------------- procedural textures (cached)
const pgSS = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const pgMix = (a, b, t) => {
  const r = (a >> 16 & 255) + ((b >> 16 & 255) - (a >> 16 & 255)) * t, g = (a >> 8 & 255) + ((b >> 8 & 255) - (a >> 8 & 255)) * t, c = (a & 255) + ((b & 255) - (a & 255)) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(c);
};
const pgN3 = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
const pgAng = (x, y, z, c) => Math.acos(clamp(x * c[0] + y * c[1] + z * c[2], -1, 1));
const pgIn = (x, y, z, c, cr) => x * c[0] + y * c[1] + z * c[2] > cr; // within the angular radius whose cosine is cr
const pgHash = (a, b, c) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };
// per-pixel painter with ss x ss supersampling; fn(u, v, i, j) -> 0xRRGGBB (v = 0 at the canvas top; i, j = sample column / row)
function pgPix(w, h, ss, fn) {
  return canvasTex(w, h, (g) => {
    const img = g.createImageData(w, h), d = img.data, n = ss * ss;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let r = 0, gg = 0, b = 0;
      for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) { const c = fn((x + (i + 0.5) / ss) / w, (y + (j + 0.5) / ss) / h, x * ss + i, y * ss + j); r += c >> 16 & 255; gg += c >> 8 & 255; b += c & 255; }
      const k = (y * w + x) * 4; d[k] = r / n; d[k + 1] = gg / n; d[k + 2] = b / n; d[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}
// equirect painter for SphereGeometry UVs: fn(dx, dy, dz) gets the unit direction of the sample
function pgSph(w, h, ss, fn) {
  const W = w * ss, R = h * ss, cp = new Float32Array(W), sp = new Float32Array(W), ct = new Float32Array(R), st = new Float32Array(R);
  for (let i = 0; i < W; i++) { const a = (i + 0.5) / W * Math.PI * 2; cp[i] = -Math.cos(a); sp[i] = Math.sin(a); }
  for (let j = 0; j < R; j++) { const a = (j + 0.5) / R * Math.PI; ct[j] = Math.cos(a); st[j] = Math.sin(a); }
  return pgPix(w, h, ss, (u, v, i, j) => fn(cp[i] * st[j], ct[j], sp[i] * st[j]));
}
const pgCache = new Map();
const pgOnce = (key, make) => { let v = pgCache.get(key); if (v === undefined) { v = make(); pgCache.set(key, v); } return v; };
// shared star field (galaxy skin): sparse dots in a 3D grid on the unit sphere
function pgStar(x, y, z, dens) {
  const S = 7, cx = Math.floor(x * S), cy = Math.floor(y * S), cz = Math.floor(z * S), h = pgHash(cx, cy, cz);
  if (h > dens) return 0;
  const sx = (cx + 0.3 + 0.4 * pgHash(cx + 7, cy, cz)) / S, sy = (cy + 0.3 + 0.4 * pgHash(cx, cy + 7, cz)) / S, sz = (cz + 0.3 + 0.4 * pgHash(cx, cy, cz + 7)) / S;
  const d = Math.hypot(x - sx, y - sy, z - sz), r = 0.02 + 0.018 * pgHash(cz, cx, cy);
  return d < r ? (h < 0.12 ? 0xffd6f0 : h < 0.25 ? 0xb8f4ff : 0xffffff) : 0;
}
// skin colour at a body/head direction (non-belly region)
function pgSkinCol(skin, x, y, z) {
  if (skin.id === 'galaxy') {
    const n = Math.sin(x * 4.2 + y * 2.3 + 1.3) * Math.cos(z * 3.1 - y * 1.7) + 0.35 * Math.sin(x * 9 - z * 7);
    const c = n > 0.25 ? pgMix(skin.body, 0xd94fd0, pgSS(0.25, 1.0, n) * 0.75) : pgMix(skin.body, 0x241a6e, pgSS(0.25, -0.8, n) * 0.7);
    return pgStar(x, y, z, 0.55) || c;
  }
  if (skin.id === 'gold') { // toon chrome: pale sky-lit top, dark horizon band, warm bounce below, crisp glints
    let c = y > -0.05 ? pgMix(skin.body, 0xfff3b8, pgSS(0.15, 0.9, y)) : pgMix(0xc27800, 0xf0a10c, pgSS(-0.25, -0.95, y));
    if (y > -0.05 && y < 0.12) c = pgMix(c, 0xd99000, pgSS(0.12, 0.0, y) * 0.8);
    const st = x * 0.55 + z * 0.3 + y * 0.78;
    if ((st > 0.62 && st < 0.7) || (st > 0.76 && st < 0.79)) c = pgMix(c, 0xfffdf0, 0.85);
    return c;
  }
  if (skin.id === 'ghost') {
    const c = pgMix(skin.body, 0xf4f9ff, pgSS(-0.2, 0.9, y) * 0.55), w = Math.sin(x * 7 + z * 5 + Math.sin(y * 6) * 1.6);
    return w > 0.86 ? pgMix(c, 0xffffff, 0.7) : c;
  }
  return skin.body;
}
const pgBellyLine = (z) => -0.2 + 0.72 * pgSS(0.15, 0.97, z) - 0.1 * pgSS(-0.35, -0.95, z);
function pgBodyTex(skin) {
  return pgOnce('body' + skin.id, () => pgSph(512, 256, 2, (x, y, z) => {
    for (const bz of [0.035, -0.47]) if (Math.abs(z - bz) < 0.065 && y > -0.62) return Math.abs(z - bz) > 0.052 ? 0x5d6496 : 0x3a3f66; // harness belts
    if (y < pgBellyLine(z)) return skin.id === 'emperor' ? pgMix(skin.belly, 0xffd27a, pgSS(0.6, 0.95, z) * pgSS(-0.3, 0.3, y)) : skin.belly;
    return pgSkinCol(skin, x, y, z);
  }));
}
const PG_FACE = [pgN3(-0.42, 0.2, 0.88), pgN3(0.42, 0.2, 0.88), pgN3(0, -0.6, 0.8)];
const PG_EAR = [pgN3(-0.92, -0.18, 0.25), pgN3(0.92, -0.18, 0.25)];
const PG_CHEEK = [pgN3(-0.6, -0.2, 0.77), pgN3(0.6, -0.2, 0.77)];
const pgIsFace = (x, y, z) => pgIn(x, y, z, PG_FACE[0], 0.8776) || pgIn(x, y, z, PG_FACE[1], 0.8776) || pgIn(x, y, z, PG_FACE[2], 0.7109);
function pgHeadTex(skin) {
  return pgOnce('head' + skin.id, () => pgSph(512, 256, 2, (x, y, z) => {
    if (pgIn(x, y, z, PG_CHEEK[0], 0.9888) || pgIn(x, y, z, PG_CHEEK[1], 0.9888)) return 0xff86b6;
    if (Math.abs(x) < 0.085 - Math.max(0, -0.3 - y) * 0.6 && y < -0.17 && y > -0.33 && z > 0.9) return y < -0.27 ? 0xff6f91 : 0x7a1f3f; // mouth behind the jaw
    if (pgIsFace(x, y, z)) return skin.belly;
    if (skin.id === 'emperor' && (pgIn(x, y, z, PG_EAR[0], 0.9) || pgIn(x, y, z, PG_EAR[1], 0.9))) return pgMix(0xff9f1c, 0xffd86b, pgSS(-0.5, 0.2, y)); // golden ear patches
    return pgSkinCol(skin, x, y, z);
  }));
}
const PG_IRIS = pgN3(0, -0.06, 1), PG_HL = [pgN3(0.3, 0.34, 1), pgN3(-0.24, -0.3, 1)];
// glossy eye: big iris with a lighter lower crescent, pupil, two highlights (four-point star glints when excited)
const pgStarHL = (x, y, z, c, r) => { if (z < 0.5) return false; const dx = Math.abs(x / z - c[0] / c[2]), dy = Math.abs(y / z - c[1] / c[2]); return Math.sqrt(dx) + Math.sqrt(dy) < Math.sqrt(r); };
const pgEyeTex = (ex) => pgOnce('eye' + ex, () => pgSph(256, 128, 3, (x, y, z) => {
  if (ex ? pgStarHL(x, y, z, PG_HL[0], 0.36) || pgStarHL(x, y, z, PG_HL[1], 0.16) : pgAng(x, y, z, PG_HL[0]) < 0.17 || pgAng(x, y, z, PG_HL[1]) < 0.085) return 0xffffff;
  const d = pgAng(x, y, z, PG_IRIS);
  if (d < (ex ? 0.38 : 0.32)) return 0x0b0c1e;
  if (d < 0.56) return pgMix(0x1c2356, 0x4a8cf0, pgSS(0.05, -0.4, y) * (d > 0.5 ? 0.3 : 1));
  if (d < 0.62) return 0x14163a;
  return 0xf6f9ff;
}));
const pgStarTex = (part, dens) => pgOnce('star' + part + dens, () => pgSph(512, 256, 2, (x, y, z) => {
  if (part === 'body' ? y < pgBellyLine(z) || Math.abs(z - 0.035) < 0.065 || Math.abs(z + 0.47) < 0.065 : pgIsFace(x, y, z)) return 0;
  return pgStar(x, y, z, dens);
}));
function pgShine(m, metal, rough) { if ('metalness' in m) { m.metalness = metal; m.roughness = rough; } return m; }
// skin materials: body/head carry the painted belly + face mask; special skins get glow / sparkle / sheen
function pgSkinMat(skin, part) {
  return pgOnce('mat' + part + skin.id, () => {
    const m = toon(0xffffff, { map: part === 'body' ? pgBodyTex(skin) : pgHeadTex(skin) });
    if ((skin.id === 'galaxy' || skin.id === 'gold') && 'emissiveMap' in m) { m.emissiveMap = pgStarTex(part, skin.id === 'gold' ? 0.12 : 0.55); m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 0.9; }
    if (skin.id === 'ghost' && 'emissive' in m) { m.emissive = new THREE.Color(0x6f8fd8); m.emissiveIntensity = 0.32; }
    if (skin.id === 'gold') pgShine(m, 0.45, 0.28);
    return m;
  });
}
// build the skin textures in the background after load so a match start doesn't hitch
function pgWarm(i = 0) { if (i >= SKINS.length) { pgTexMat('eye1', () => pgEyeTex(1)); return; } pgSkinMat(SKINS[i], 'body'); pgSkinMat(SKINS[i], 'head'); setTimeout(() => pgWarm(i + 1), 80); }
setTimeout(() => pgWarm(), 1200);
// flipper: skin on top, belly colour underneath
const pgFlipMat = (skin) => pgOnce('flip' + skin.id, () => {
  const m = toon(0xffffff, { map: pgSph(128, 64, 2, (x, y, z) => (y < -0.25 ? skin.belly : pgSkinCol(skin, x, y, z))) });
  if (skin.id === 'ghost' && 'emissive' in m) { m.emissive = new THREE.Color(0x6f8fd8); m.emissiveIntensity = 0.32; }
  if (skin.id === 'gold') pgShine(m, 0.45, 0.28);
  return m;
});
const pgGoldMat = () => pgOnce('goldmat', () => pgShine(toon(0xffc21a, {}), 0.5, 0.3));
const pgTexMat = (key, draw) => pgOnce('tm' + key, () => toon(0xffffff, { map: draw() }));
const pgGlowTex = () => pgOnce('glow', () => canvasTex(128, 128, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
}));

// ----------------------------------------------------------- penguin geometry (shared by every penguin)
// body: chubby egg lying along +Z, belly bottom at y = -0.32
function pgBodyPos(v) { const t = 1 + 0.12 * v.z; v.set(v.x * 0.45 * t, v.y * (v.y > 0 ? 0.36 : 0.32) * t, v.z * (v.z > 0 ? 0.62 : 0.84)); }
const PG_HEAD = [0.38, 0.35, 0.34], PG_HEADP = [0, 0.3, 0.54];
// point + outward normal on the head ellipsoid along direction d, pushed in by inset
function pgOnHead(d, inset) {
  const [a, b, c] = PG_HEAD, [x, y, z] = pgN3(...d), t = 1 / Math.hypot(x / a, y / b, z / c);
  const n = new V3(x * t / (a * a), y * t / (b * b), z * t / (c * c)).normalize();
  return { p: new V3(x * t, y * t, z * t).addScaledVector(n, -inset), n };
}
const PG_BAND = 0.375; // rocket band position along the rocket
let pgG = null;
function pgGeo() {
  if (pgG) return pgG;
  const G = (pgG = {}), PI = Math.PI;
  const tail = pgUV(pgBlob(20, 12, (v) => v.set(v.x * 0.15 * (1 - 0.35 * Math.max(0, -v.z)), v.y * 0.045, v.z * 0.13 - 0.05 * v.z * v.z)), 0.75, 0.747);
  G.body = pgMerge([pgBlob(56, 36, pgBodyPos), [tail, [0, 0, -0.8], [-0.25, 0, 0]]]);
  G.head = pgBlob(48, 32, (v) => v.set(v.x * PG_HEAD[0], v.y * PG_HEAD[1], v.z * PG_HEAD[2]));
  G.eyeXf = [-1, 1].map((s) => { const e = pgOnHead([s * 0.37, 0.13, 0.92], 0.052); return { p: e.p, q: new Q().setFromUnitVectors(new V3(0, 0, 1), e.n.clone().add(new V3(-s * 0.08, 0, 0.55)).normalize()) }; });
  const eyeBall = new THREE.SphereGeometry(0.118, 32, 24);
  G.eyes = pgMerge(G.eyeXf.map((e) => [eyeBall, new THREE.Matrix4().compose(e.p, e.q, new V3(1, 1.13, 1))]));
  const lid = [[0, 0]]; for (let i = 8; i >= 0; i--) { const a = i / 8 * PI / 2; lid.push([Math.sin(a) * 0.13, Math.cos(a) * 0.13]); }
  G.lid = pgLathe(lid, 28);
  // chunky beak: rounded upper bill + smaller jaw
  const bill = [[0, -0.06], [0.04, -0.055], [0.07, -0.02], [0.09, 0.022], [0.083, 0.064], [0.058, 0.104], [0.03, 0.138], [0.009, 0.156], [0, 0.16]];
  G.beak = pgMerge([[pgLathe(bill, 24), [0, 0, 0], [PI / 2, 0, 0], [1.08, 1, 0.78]]]);
  G.jaw = pgMerge([[pgLathe(bill, 20), [0, 0, 0], [PI / 2 + 0.08, 0, 0], [0.9, 0.7, 0.5]]]);
  // flipper: rounded paddle, base at the shoulder pivot, tip curling back and down
  G.flipR = pgBlob(28, 16, (v) => {
    const x = v.x, k = Math.max(0, x);
    v.set(0.24 + x * 0.27, v.y * 0.055 * (1 - 0.3 * k) - 0.05 * k * k, v.z * (0.105 + 0.03 * x) - 0.07 * k * k);
  });
  G.flipL = pgMirrorX(G.flipR);
  // webbed foot with three toes, extends along -Z from the ankle
  const toe = pgEll(0.043, 0.03, 0.066, 14, 10);
  G.foot = pgMerge([[pgEll(0.1, 0.034, 0.115, 20, 12), [0, 0, -0.1]], [toe, [-0.068, 0, -0.19], [0, 0.42, 0]], [toe, [0, 0.004, -0.22]], [toe, [0.068, 0, -0.19], [0, -0.42, 0]]]);
  // scarf ring (knit, striped) + two-segment flapping tail
  G.scarf = new THREE.TorusGeometry(0.295, 0.076, 14, 48);
  G.scarfSeg = pgMerge([[new THREE.CapsuleGeometry(0.062, 0.15, 6, 14), [0, 0, -0.13], [-PI / 2, 0, 0], [1, 1, 0.4]]]);
  // rocket pack (pack-local: tail at z = 0, nose toward +Z): painted rocket, band + rivets, swept fins, flared nozzle with glowing throat
  const RK = 1.12;
  G.rocket = pgMerge([[pgLathe([[0, 0], [0.125, 0], [0.152, 0.035], [0.172, 0.11], [0.178, 0.3], [0.172, 0.44], [0.152, 0.55], [0.112, 0.64], [0.06, 0.708], [0, 0.735]], 40, 30), [0, 0, 0], [PI / 2, 0, 0], [RK, 1.04, RK]]]);
  const rivet = new THREE.SphereGeometry(0.019, 10, 8), steel = [[pgLathe([[0, 0], [0.1, 0], [0.105, 0.03], [0.122, 0.07], [0.146, 0.11], [0.139, 0.126], [0.118, 0.113], [0.095, 0.066], [0, 0.06]], 32), [0, 0, 0.025], [-PI / 2, 0, 0], RK]];
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) * PI / 4; steel.push([rivet, [Math.cos(a) * 0.207 * RK, Math.sin(a) * 0.207 * RK, PG_BAND]]); }
  steel.push([new THREE.TorusGeometry(0.182 * RK, 0.032, 10, 40), [0, 0, PG_BAND]]);
  G.steel = pgMerge(steel);
  G.glow = pgMerge([[pgEll(0.09 * RK, 0.09 * RK, 0.014, 20, 10), [0, 0, -0.045]]]);
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.quadraticCurveTo(0.17, 0.02, 0.27, 0.18); fin.lineTo(0.34, 0.18); fin.lineTo(0.32, 0); fin.lineTo(0, 0);
  const finG = pgWeld(new THREE.ExtrudeGeometry(fin, { depth: 0.024, bevelEnabled: true, bevelThickness: 0.013, bevelSize: 0.013, bevelSegments: 2, curveSegments: 8 }).translate(0, 0, -0.012));
  const finM = new THREE.Matrix4().makeBasis(new V3(0, 0, -1), new V3(0, 1, 0), new V3(1, 0, 0)).setPosition(0, 0.145, 0.31), fins = [];
  for (const a of [0, PI / 2 + 0.25, -PI / 2 - 0.25]) fins.push([finG, new THREE.Matrix4().makeRotationZ(a).multiply(finM)]);
  G.fins = pgMerge(fins);
  // flame: rounded teardrop pointing -Z (outer glow + hot core)
  const fl = [[0, -0.03], [0.09, 0], [0.128, 0.06], [0.134, 0.13], [0.116, 0.22], [0.082, 0.32], [0.044, 0.42], [0.013, 0.5], [0, 0.53]];
  G.flame = pgMerge([[pgLathe(fl, 22), [0, 0, 0], [-PI / 2, 0, 0], [1, 1.25, 1]]]);
  G.flameCore = pgMerge([[pgLathe(fl, 16), [0, 0, 0.01], [-PI / 2, 0, 0], [0.6, 0.75, 0.6]]]);
  return G;
}

// ----------------------------------------------------------- hats
let pgH = null;
const pgPick = (list) => list.map((e) => (e.length === 1 ? e[0] : e));
function pgHatGeo() {
  if (pgH) return pgH;
  const H = (pgH = {}), PI = Math.PI;
  H.pom = pgFluff(0.085);
  H.pomS = pgFluff(0.06);
  H.dome = pgLathe([[0, -0.05], [0.315, -0.05], [0.318, 0.02], [0.3, 0.1], [0.255, 0.18], [0.18, 0.24], [0.09, 0.272], [0, 0.28]], 40, 22);
  H.cuff = pgLathe([[0.29, -0.09], [0.33, -0.085], [0.347, -0.05], [0.349, -0.01], [0.337, 0.03], [0.305, 0.042], [0.288, 0.0], [0.29, -0.09]], 44);
  H.party = pgLathe([[0, 0], [0.175, 0], [0.17, 0.03], [0.02, 0.44], [0, 0.452]], 32, 20);
  H.frill = pgMerge([[new THREE.TorusGeometry(0.172, 0.034, 10, 32), [0, 0.02, 0], [PI / 2, 0, 0]]]);
  const sq = new THREE.Shape(); sq.moveTo(-0.15, -0.22); sq.lineTo(0.15, -0.22); sq.quadraticCurveTo(0.22, -0.22, 0.22, -0.15); sq.lineTo(0.22, 0.15); sq.quadraticCurveTo(0.22, 0.22, 0.15, 0.22);
  sq.lineTo(-0.15, 0.22); sq.quadraticCurveTo(-0.22, 0.22, -0.22, 0.15); sq.lineTo(-0.22, -0.15); sq.quadraticCurveTo(-0.22, -0.22, -0.15, -0.22);
  H.coneBase = pgMerge([[pgWeld(new THREE.ExtrudeGeometry(sq, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.016, bevelSize: 0.016, bevelSegments: 2, curveSegments: 6 })), [0, 0, 0], [-PI / 2, 0, 0]]]);
  H.cone = pgLathe([[0, 0.02], [0.165, 0.02], [0.16, 0.06], [0.04, 0.46], [0.025, 0.478], [0, 0.482]], 32, 24);
  H.crownTop = pgLathe([[0, 0], [0.2, 0], [0.197, 0.16], [0.206, 0.31], [0.216, 0.37], [0.205, 0.392], [0.1, 0.396], [0, 0.396]], 36);
  H.brim = pgLathe([[0.19, 0], [0.3, -0.006], [0.345, 0.012], [0.362, 0.05], [0.347, 0.058], [0.31, 0.03], [0.19, 0.036], [0.19, 0]], 44);
  H.tophat = pgMerge([H.crownTop, H.brim]);
  H.hband = pgLathe([[0.19, 0.035], [0.216, 0.035], [0.219, 0.105], [0.19, 0.105], [0.19, 0.035]], 36);
  H.buckle = pgEll(0.045, 0.04, 0.016, 12, 8);
  H.cap = pgMerge([pgLathe([[0, -0.05], [0.31, -0.05], [0.316, 0.01], [0.29, 0.09], [0.22, 0.16], [0.12, 0.2], [0, 0.212]], 40, 18), [pgUV(pgEll(0.17, 0.022, 0.12, 20, 10), 0.3, 0.5), [0, -0.035, 0.27], [0.18, 0, 0]]]);
  const blade = pgEll(0.15, 0.013, 0.048, 16, 8), bl = [];
  for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3; bl.push([blade, [Math.cos(a) * 0.15, 0, -Math.sin(a) * 0.15], [0.28, a, 0]]); }
  H.blades = pgMerge(bl);
  H.hub = pgMerge([pgEll(0.042, 0.035, 0.042), [new THREE.CapsuleGeometry(0.022, 0.07, 4, 10), [0, -0.06, 0]]]);
  const pleat = new THREE.LatheGeometry([[0, 0], [0.245, 0], [0.252, 0.05], [0.25, 0.17], [0, 0.17]].map(([x, y]) => new THREE.Vector2(x, y)), 48), pp = pleat.attributes.position;
  for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), z = pp.getZ(i), r = Math.hypot(x, z); if (r > 0.2) { const k = 1 + 0.035 * Math.cos(Math.atan2(x, z) * 12); pp.setX(i, x * k); pp.setZ(i, z * k); } }
  const puff = new THREE.SphereGeometry(1, 18, 12), top = [[pgSmooth(pleat)], [pgLathe([[0, 0.14], [0.24, 0.14], [0.3, 0.19], [0.325, 0.26], [0.3, 0.34], [0.22, 0.4], [0.11, 0.43], [0, 0.44]], 36)], [puff, [0, 0.43, 0], 0, 0.15]];
  for (let i = 0; i < 6; i++) { const a = i * PI / 3; top.push([puff, [Math.cos(a) * 0.2, 0.34, Math.sin(a) * 0.2], 0, 0.125]); }
  H.chef = pgMerge(pgPick(top));
  H.helm = pgLathe([[0, -0.04], [0.318, -0.04], [0.322, 0.03], [0.3, 0.11], [0.25, 0.19], [0.17, 0.25], [0.08, 0.282], [0, 0.288]], 40);
  const vr = [[pgLathe([[0.3, -0.085], [0.338, -0.08], [0.345, -0.04], [0.338, 0.005], [0.31, 0.012], [0.298, -0.085]], 44)]];
  const stud = new THREE.SphereGeometry(0.022, 10, 8);
  for (let i = 0; i < 10; i++) { const a = i * PI / 5 + PI / 10; vr.push([stud, [Math.sin(a) * 0.345, -0.038, Math.cos(a) * 0.345]]); }
  vr.push([new THREE.CapsuleGeometry(0.03, 0.08, 4, 10), [0, -0.1, 0.335], [0.12, 0, 0]]);
  H.vband = pgMerge(pgPick(vr));
  const horn = pgBend(pgLathe([[0, 0], [0.072, 0], [0.068, 0.08], [0.052, 0.18], [0.03, 0.27], [0.012, 0.32], [0, 0.33]], 18), 0.24);
  H.horns = pgMerge([[horn, [-0.27, 0.07, 0], [0, 0, 1.15]], [horn, [0.27, 0.07, 0], [0, 0, -1.15], [-1, 1, 1]]]);
  const spike = pgLathe([[0, 0], [0.055, 0], [0.042, 0.06], [0.016, 0.12], [0, 0.13]], 14);
  const cr = [[pgLathe([[0.21, -0.03], [0.245, -0.03], [0.252, 0.0], [0.252, 0.1], [0.246, 0.122], [0.21, 0.122], [0.21, -0.03]], 44)]];
  const ball = new THREE.SphereGeometry(0.03, 12, 8);
  for (let i = 0; i < 5; i++) { const a = i * PI * 2 / 5; cr.push([spike, [Math.sin(a) * 0.232, 0.11, Math.cos(a) * 0.232], [Math.cos(a) * 0.14, 0, -Math.sin(a) * 0.14]]); cr.push([ball, [Math.sin(a) * 0.25, 0.245, Math.cos(a) * 0.25]]); }
  H.crown = pgMerge(pgPick(cr));
  H.velvet = pgLathe([[0, 0], [0.195, 0], [0.195, 0.09], [0.16, 0.155], [0.085, 0.192], [0, 0.2]], 32); // stays inside the band (no coplanar walls)
  H.gem = pgEll(0.042, 0.042, 0.02, 12, 8);
  H.gems = pgMerge([-1, 1].map((s) => [H.gem, [Math.sin(s * 1.26) * 0.252, 0.046, Math.cos(s * 1.26) * 0.252], [0, s * 1.26, 0]]));
  H.halo = new THREE.TorusGeometry(0.21, 0.036, 12, 40);
  return H;
}
// hat textures
const pgKnitMat = (c) => pgTexMat('knit' + c, () => pgPix(256, 64, 2, (u, v) => {
  const vv = 1 - v; let col = c;
  if (vv > 0.6 && vv < 0.68) col = 0xffffff; // stripe just above the cuff
  col = pgMix(col, 0x1b1d3a, 0.1 * pgSS(0.25, 0.5, Math.abs((u * 24) % 1 - 0.5)));
  return col;
}));
const pgRibMat = () => pgTexMat('rib', () => pgPix(256, 16, 2, (u) => pgMix(0xf6f9ff, 0xd6e1f3, pgSS(0.15, 0.45, Math.abs((u * 28) % 1 - 0.5)))));
const pgPartyMat = () => pgTexMat('party', () => pgPix(256, 256, 2, (u, v) => {
  const s = (u * 3 + (1 - v) * 4) % 1;
  const dx = (u * 12) % 1 - 0.5, dy = ((1 - v) * 9) % 1 - 0.5;
  if (s > 0.55 && dx * dx + dy * dy < 0.06) return 0xffffff;
  return s < 0.5 ? 0xff5fa8 : 0xffd23f;
}));
const pgConeMat = () => pgTexMat('cone', () => pgPix(64, 256, 2, (u, v) => { const h = 1 - v; return (h > 0.4 && h < 0.52) || (h > 0.66 && h < 0.75) ? 0xf7f9ff : 0xff7a1a; }));
const pgGoreMat = () => pgTexMat('gore', () => pgPix(256, 64, 2, (u) => {
  const cols = [0xff5fa8, 0xffd23f, 0x2f8cff, 0x72dc4e], k = (u * 4 + 0.125) % 4, f = k % 1;
  return f < 0.04 || f > 0.96 ? 0xffffff : cols[Math.floor(k) % 4];
}));
// rocket skin: team colour, white nose + stripe, portholes on the flanks, fish decal on top (lathe uv: u around from the belly, v tail->nose)
const pgRocketMat = (c) => pgOnce('rocket' + c, () => {
  const m = toon(0xffffff, { map: canvasTex(512, 256, (g, w, h) => {
    const ink = '#1b1d3a', W = '#f6f9ff';
    g.fillStyle = '#' + c.toString(16).padStart(6, '0'); g.fillRect(0, 0, w, h);
    g.fillStyle = W; g.fillRect(0, 0, w, 50); g.fillRect(0, 186, w, 16);
    g.fillStyle = ink; g.fillRect(0, 50, w, 4);
    const P = 270, U = 410; // texels per metre along / around the rocket
    for (const u of [0.25, 0.75]) {
      g.beginPath(); g.ellipse(u * w, 108, 0.05 * U, 0.05 * P, 0, 0, Math.PI * 2); g.fillStyle = W; g.fill(); g.lineWidth = 4; g.strokeStyle = ink; g.stroke();
      g.beginPath(); g.ellipse(u * w, 108, 0.033 * U, 0.033 * P, 0, 0, Math.PI * 2); g.fillStyle = '#7fd8ff'; g.fill(); g.lineWidth = 3; g.stroke();
      g.beginPath(); g.ellipse(u * w - 6, 103, 5, 4, 0, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    }
    g.save(); g.translate(w / 2, 140); g.scale(U, P);
    g.beginPath(); g.moveTo(0, -0.1); g.quadraticCurveTo(0.065, -0.03, 0.012, 0.045); g.lineTo(0.05, 0.095); g.quadraticCurveTo(0, 0.075, -0.05, 0.095); g.lineTo(-0.012, 0.045); g.quadraticCurveTo(-0.065, -0.03, 0, -0.1);
    g.restore(); g.fillStyle = W; g.fill(); g.lineWidth = 4; g.lineJoin = 'round'; g.strokeStyle = ink; g.stroke();
    g.beginPath(); g.arc(w / 2, 125, 4.5, 0, Math.PI * 2); g.fillStyle = ink; g.fill();
  }) });
  return c === 0xffc21a ? pgShine(m, 0.45, 0.3) : m;
});
const pgScarfMat = (c) => pgTexMat('scarf' + c, () => pgPix(256, 16, 2, (u) => { const f = (u * 9) % 1; return f < 0.32 ? 0xffffff : (f < 0.38 || f > 0.94 ? pgMix(c, 0x1b1d3a, 0.15) : c); }));
const pgTailMat = (c) => pgTexMat('tail' + c, () => pgPix(16, 128, 2, (u, v) => ((v * 3) % 1 < 0.3 ? 0xffffff : c)));

function buildHat(id, teamColor) {
  const g = new THREE.Group();
  if (!id || id === 'none') return g;
  const H = pgHatGeo(), O = 0.022;
  switch (id) {
    case 'beanie':
      g.add(mk(H.dome, null, { mat: pgKnitMat(teamColor), o: O }));
      g.add(mk(H.cuff, null, { mat: pgRibMat(), o: O }));
      g.add(mk(H.pom, 0xf6f9ff, { p: [0, 0.3, 0], o: 0.018 }));
      break;
    case 'party': {
      const p = new THREE.Group(); p.position.set(0.03, 0.06, -0.01); p.rotation.set(-0.12, 0, -0.16); g.add(p);
      p.add(mk(H.party, null, { mat: pgPartyMat(), o: O }));
      p.add(mk(H.frill, 0xffd23f, { o: 0.016, cast: false }));
      p.add(mk(H.pomS, 0x8fe8ff, { p: [0, 0.47, 0], o: 0.016 }));
      break;
    }
    case 'cone': {
      const p = new THREE.Group(); p.position.set(0.02, 0.07, 0); p.rotation.set(-0.08, 0.2, -0.14); g.add(p);
      p.add(mk(H.coneBase, 0xf2650f, { o: O }));
      p.add(mk(H.cone, null, { mat: pgConeMat(), o: O }));
      break;
    }
    case 'tophat': {
      const p = new THREE.Group(); p.position.set(0, 0.05, 0); p.rotation.set(-0.06, 0, 0.1); g.add(p);
      p.add(mk(H.tophat, 0x2b2e4f, { o: O }));
      p.add(mk(H.hband, 0xff5fa8, { o: 0.014, cast: false }));
      p.add(mk(H.buckle, 0xffd23f, { p: [0, 0.07, 0.222], o: 0.012, cast: false }));
      break;
    }
    case 'propeller': {
      g.add(mk(H.cap, null, { mat: pgGoreMat(), o: O }));
      const rotor = new THREE.Group(); rotor.position.set(0, 0.31, 0);
      rotor.add(mk(H.blades, 0x2f8cff, { o: 0.014 }));
      rotor.add(mk(H.hub, 0xff5fa8, { o: 0.014 }));
      g.add(rotor); g.userData.spin = rotor;
      break;
    }
    case 'chef':
      g.add(mk(H.chef, 0xf3f6fc, { p: [0, -0.04, 0], o: O }));
      break;
    case 'viking':
      g.add(mk(H.helm, null, { mat: pgOnce('helmmat', () => pgShine(toon(0xb4c0da, {}), 0.4, 0.35)), o: O }));
      g.add(mk(H.vband, null, { mat: pgGoldMat(), o: 0.018 }));
      g.add(mk(H.horns, 0xfff0cf, { o: O }));
      break;
    case 'crown': {
      const p = new THREE.Group(); p.position.set(0, 0.04, 0); p.rotation.set(-0.05, 0, 0.12); g.add(p);
      p.add(mk(H.velvet, 0xd7265d, { o: 0.016 }));
      p.add(mk(H.crown, null, { mat: pgGoldMat(), o: 0.018 }));
      p.add(mk(H.gem, 0xff5fa8, { p: [0, 0.046, 0.252], o: 0.01, cast: false }));
      p.add(mk(H.gems, 0x2fd0ff, { o: 0.01, cast: false }));
      break;
    }
    case 'halo': {
      // halo bobs around y = 0.32 (the showroom animates that value too); the offset group sets the real height
      const off = new THREE.Group(); off.position.y = -0.06; g.add(off);
      const h = new THREE.Group(); h.position.y = 0.32; h.rotation.x = -0.1;
      const ringMat = pgOnce('halomat', () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe680).multiplyScalar(1.9) }));
      h.add(mk(H.halo, null, { mat: ringMat, r: [Math.PI / 2, 0, 0], cast: false, o: 0.014 }));
      const glow = new THREE.Sprite(pgOnce('halosprite', () => new THREE.SpriteMaterial({ map: pgGlowTex(), color: 0xc8a0ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.75 })));
      glow.scale.set(0.8, 0.42, 1); glow.renderOrder = 4; h.add(glow);
      off.add(h); g.userData.halo = h; g.userData.haloY = 0.32;
      break;
    }
    default: break;
  }
  return g;
}

// ----------------------------------------------------------- penguin model (local +Z = forward, belly-down slide pose)
function buildPenguin(team, cos, opts = {}) {
  const skin = SKINS.find((s) => s.id === cos.skin) || SKINS[0];
  const teamC = TEAM_HEX[team], G = pgGeo();
  const root = new THREE.Group();
  const tilt = new THREE.Group(); root.add(tilt);
  tilt.add(mk(G.body, null, { mat: pgSkinMat(skin, 'body'), o: 0.03 }));
  // head: painted face mask + cheeks, glossy eyes with blinking lids, chunky beak
  const head = new THREE.Group(); head.position.set(...PG_HEADP); head.rotation.order = 'YXZ'; tilt.add(head);
  head.add(mk(G.head, null, { mat: pgSkinMat(skin, 'head'), o: 0.03 }));
  const eyeMesh = mk(G.eyes, null, { mat: pgTexMat('eye0', () => pgEyeTex(0)), o: 0.014, cast: false }); head.add(eyeMesh);
  const eyes = [], lids = [], lidMat = toon(skin.belly);
  for (const e of G.eyeXf) {
    const eye = new THREE.Group(); eye.position.copy(e.p); eye.quaternion.copy(e.q); eye.scale.set(1, 1.13, 1); head.add(eye);
    const lid = mk(G.lid, null, { mat: lidMat, cast: false, o: 0.012 }); lid.rotation.x = -1.3; lid.visible = false; eye.add(lid);
    eyes.push(eye); lids.push(lid);
  }
  const b = pgOnHead([0, -0.16, 1], 0.028);
  const beak = new THREE.Group(); beak.position.copy(b.p); beak.rotation.x = -0.12; head.add(beak);
  beak.add(mk(G.beak, 0xffa21f, { p: [0, 0.012, 0], o: 0.02 }));
  const jaw = new THREE.Group(); jaw.position.set(0, -0.022, -0.01); beak.add(jaw);
  jaw.add(mk(G.jaw, 0xff8a12, { o: 0.018, cast: false }));
  const hatAnchor = new THREE.Group(); hatAnchor.position.set(0, 0.235, -0.015); hatAnchor.rotation.x = -0.12; hatAnchor.scale.set(1.08, 1, 1); head.add(hatAnchor);
  const hat = buildHat(cos.hat, teamC); hatAnchor.add(hat);
  // flippers (pivot rotation.z animates the flap; the child holds the swept-back rest pose)
  const flippers = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.35, 0.02, 0.2); tilt.add(piv);
    piv.add(mk(s < 0 ? G.flipL : G.flipR, null, { mat: pgFlipMat(skin), r: [0, s * 0.38, s * -0.1], o: 0.024 }));
    flippers.push(piv);
  }
  // feet trail behind, soles up
  const feet = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Group(); f.position.set(s * 0.13, -0.14, -0.66); f.rotation.set(0.35, s * -0.22, 0); tilt.add(f);
    f.add(mk(G.foot, 0xff9d1f, { o: 0.02 }));
    feet.push(f);
  }
  // scarf: striped ring around the neck + two-segment tail flapping in the wind
  tilt.add(mk(G.scarf, null, { mat: pgScarfMat(teamC), p: [0, 0.2, 0.38], r: [-0.85, 0, 0], o: 0.022 }));
  const scarfTail = new THREE.Group(); scarfTail.position.set(0.25, 0.27, 0.33); scarfTail.rotation.set(0.25, 0.45, 0); tilt.add(scarfTail);
  const tailMat = pgTailMat(teamC);
  scarfTail.add(mk(G.scarfSeg, null, { mat: tailMat, o: 0.018 }));
  const scarf2 = new THREE.Group(); scarf2.position.z = -0.25; scarfTail.add(scarf2);
  scarf2.add(mk(G.scarfSeg, null, { mat: tailMat, o: 0.018 }));
  scarfTail.userData.seg2 = scarf2;
  // rocket jetpack (team colour, gold when opts.gold): steel band + rivets, flared nozzle with a glowing throat, swept fins
  const pack = new THREE.Group(); pack.position.set(0, 0.4, -0.6); pack.rotation.x = -0.12; tilt.add(pack);
  pack.add(mk(G.rocket, null, { mat: pgRocketMat(opts.gold ? 0xffc21a : teamC), o: 0.026 }));
  pack.add(mk(G.steel, opts.gold ? 0xffe9a8 : 0xc3cce6, { o: 0.018 }));
  pack.add(mk(G.fins, opts.gold ? 0xff5fa8 : 0xffd23f, { o: 0.018 }));
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x6a2f3e });
  pack.add(mk(G.glow, null, { mat: glowMat, cast: false }));
  // flames[0] = outer flame, flames[1] = hot core (each flickers on its own)
  const flameMat = new THREE.MeshBasicMaterial({ color: pgFlameA, transparent: true, opacity: 0.85, depthWrite: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff3c4).multiplyScalar(2.4), transparent: true, depthWrite: false });
  const flames = [];
  for (const [geo, mat, ro] of [[G.flame, flameMat, 3], [G.flameCore, coreMat, 4]]) {
    const f = new THREE.Group(); f.position.z = -0.1;
    const fm = new THREE.Mesh(geo, mat); fm.renderOrder = ro; fm.castShadow = false;
    f.add(fm); f.visible = false; pack.add(f); flames.push(f);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: pgGlowTex(), color: 0xffa84a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  glow.position.z = -0.28; glow.scale.set(1, 1, 1); glow.renderOrder = 4; glow.visible = false; pack.add(glow);
  const outlines = [];
  root.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial) o.castShadow = false; if (o.isMesh && o.parent && o.parent.isMesh) outlines.push(o); });
  return { root, tilt, head, eyes, eyeMesh, lids, beak, jaw, flippers, feet, flames, hat, scarfTail, flameMat, coreMat, glowMat, glow, pack, outlines };
}

// ----------------------------------------------------------- name tags (sticker pill: team colour, difficulty badge, crisp text)
function pgDrawTag(g, w, h, c, lvl) {
  const F = '"Lilita One", "Arial Black", sans-serif', ink = '#1b1d3a';
  g.clearRect(0, 0, w, h);
  const name = c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name;
  g.font = `88px ${F}`;
  const bw = lvl ? 112 : 0, tw = Math.min(w - 24, g.measureText(name).width + 84 + bw), th = 124, x0 = (w - tw) / 2, y0 = 30, r = th / 2;
  const pill = (x, y, ww, hh, rr) => { g.beginPath(); g.roundRect(x, y, ww, hh, rr); };
  const tri = (dy) => { g.beginPath(); g.moveTo(w / 2 - 30, y0 + th - 6 + dy); g.lineTo(w / 2 + 30, y0 + th - 6 + dy); g.lineTo(w / 2, y0 + th + 34 + dy); g.closePath(); };
  g.lineJoin = 'round';
  // drop shadow + pointer
  g.fillStyle = 'rgba(27,29,58,.32)'; pill(x0, y0 + 12, tw, th, r); g.fill();
  tri(0); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 6; g.strokeStyle = ink; g.stroke();
  // white sticker border, ink rim, team fill, gloss
  pill(x0, y0, tw, th, r); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 6; g.strokeStyle = ink; g.stroke();
  tri(-10); g.fillStyle = TEAM_CSS[c.team]; g.fill();
  pill(x0 + 11, y0 + 11, tw - 22, th - 22, r - 11); g.fillStyle = TEAM_CSS[c.team]; g.fill();
  g.save(); g.clip(); g.fillStyle = 'rgba(255,255,255,.26)'; pill(x0 + 26, y0 + 17, tw - 52, 34, 17); g.fill();
  g.fillStyle = 'rgba(27,29,58,.14)'; g.fillRect(x0, y0 + th - 40, tw, 40); g.restore();
  let tx = w / 2;
  if (lvl) {
    const bx = x0 + 11 + 52, by = y0 + th / 2;
    g.beginPath(); g.arc(bx, by, 46, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 5; g.strokeStyle = ink; g.stroke();
    g.beginPath(); g.arc(bx, by, 37, 0, Math.PI * 2); g.fillStyle = lvl.color; g.fill();
    g.beginPath(); g.arc(bx, by - 12, 24, Math.PI * 1.1, Math.PI * 1.9); g.lineWidth = 7; g.strokeStyle = 'rgba(255,255,255,.45)'; g.stroke();
    g.font = `50px ${F}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = ink; g.strokeText(lvl.label[0], bx, by + 3); g.fillStyle = '#fff'; g.fillText(lvl.label[0], bx, by + 3);
    tx += bw / 2;
  }
  g.font = `88px ${F}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 16; g.strokeStyle = ink; g.strokeText(name, tx, y0 + th / 2 + 5); g.fillStyle = '#fff'; g.fillText(name, tx, y0 + th / 2 + 5);
}
function makeNameTag(c) {
  const lvl = c.level ? LEVELS[c.level] : null;
  const tex = canvasTex(1024, 256, (g, w, h) => pgDrawTag(g, w, h, c, lvl));
  tex.anisotropy = 8;
  // redraw once the display font is ready (a match can start before it has loaded)
  if (document.fonts && !document.fonts.check('88px "Lilita One"')) document.fonts.load('88px "Lilita One"').then(() => { pgDrawTag(tex.image.getContext('2d'), 1024, 256, c, lvl); tex.needsUpdate = true; }).catch(() => {});
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(2, 0.5, 1); sp.renderOrder = 5;
  return sp;
}

// ----------------------------------------------------------- duty badges (STRIKER / GOALIE / SWEEPER over a bot's name tag)
const PG_DUTY = { striker: ['STRIKER', '#ff5fa8'], goalie: ['GOALIE', '#ffd23f'], sweeper: ['SWEEPER', '#72dc4e'] };
function pgDrawBadge(g, w, h, duty) {
  const F = '"Lilita One", "Arial Black", sans-serif', ink = '#1b1d3a', [label, col] = PG_DUTY[duty];
  g.clearRect(0, 0, w, h);
  g.font = `62px ${F}`;
  const tw = Math.min(w - 12, g.measureText(label).width + 112), x0 = (w - tw) / 2, y0 = 14, th = 96;
  g.lineJoin = 'round';
  g.beginPath(); g.roundRect(x0, y0, tw, th, th / 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 6; g.strokeStyle = ink; g.stroke();
  g.beginPath(); g.roundRect(x0 + 9, y0 + 9, tw - 18, th - 18, (th - 18) / 2); g.fillStyle = col; g.fill();
  // icon: a star for strikers, a shield for the keepers
  g.save(); g.translate(x0 + 52, y0 + th / 2); g.beginPath();
  if (duty === 'striker') { for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 12 : 28; g.lineTo(Math.cos(a) * r, Math.sin(a) * r + 2); } g.closePath(); }
  else { g.moveTo(0, -26); g.lineTo(22, -17); g.quadraticCurveTo(22, 14, 0, 28); g.quadraticCurveTo(-22, 14, -22, -17); g.closePath(); }
  g.fillStyle = '#fff'; g.fill(); g.lineWidth = 5; g.strokeStyle = ink; g.stroke(); g.restore();
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.lineWidth = 12; g.strokeStyle = ink; g.strokeText(label, x0 + 88, y0 + th / 2 + 4); g.fillStyle = '#fff'; g.fillText(label, x0 + 88, y0 + th / 2 + 4);
}
const pgBadgeTex = {};
function pgBadge(duty) {
  let t = pgBadgeTex[duty];
  if (t) return t;
  t = pgBadgeTex[duty] = canvasTex(512, 128, (g, w, h) => pgDrawBadge(g, w, h, duty));
  t.anisotropy = 8;
  if (document.fonts && !document.fonts.check('62px "Lilita One"')) document.fonts.load('62px "Lilita One"').then(() => { pgDrawBadge(t.image.getContext('2d'), 512, 128, duty); t.needsUpdate = true; }).catch(() => {});
  return t;
}
// charge ring: an arc under the penguin that fills while a charged shot winds up (pulses violet once it's ready)
const pgChargeGeo = (() => { const g = new THREE.RingGeometry(0.72, 0.95, 48, 1); g.rotateX(-Math.PI / 2); return g; })();
function pgChargeRing() {
  const m = new THREE.Mesh(pgChargeGeo, new THREE.ShaderMaterial({
    uniforms: { uP: { value: 0 }, uR: { value: 0 }, uT: { value: 0 } },
    vertexShader: 'varying vec2 vL; void main(){ vL = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uP, uR, uT; varying vec2 vL;
void main(){
  float a = fract(atan(vL.x, -vL.y) / 6.2831853 + 0.5), on = step(a, uP);
  vec3 c = mix(vec3(0.55, 0.9, 1.0), vec3(0.78, 0.6, 1.0), uR) * (1.5 + uR * (0.7 + 0.5 * sin(uT * 18.0)));
  gl_FragColor = vec4(c, mix(0.16, 0.95, on));
  #include <colorspace_fragment>
}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  m.renderOrder = 3; m.visible = false; m.frustumCulled = false;
  return m;
}

// ----------------------------------------------------------- penguin view
const _vp = new V3(), _vq = new Q(), _vl = new V3(), _vm = new THREE.Matrix4();
const pgGlowIdle = new THREE.Color(0x6a2f3e), pgGlowHot = new THREE.Color(0xffe08a).multiplyScalar(2.2);
const pgFlameA = new THREE.Color(0xff9a2e).multiplyScalar(1.5), pgFlameS = new THREE.Color(0xff5fa8).multiplyScalar(1.6);
class PenguinView {
  constructor(car) {
    this.car = car;
    this.m = buildPenguin(car.team, car.cos, { gold: car.gold });
    scene.add(this.m.root);
    this.tag = makeNameTag(car); scene.add(this.tag);
    this.badge = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); this.badge.renderOrder = 5; this.badge.visible = false; scene.add(this.badge);
    this.cring = pgChargeRing(); scene.add(this.cring);
    this.t = rand(0, 10); this.blinkT = rand(1, 4); this.squash = 0; this.lean = 0; this.trailAcc = 0; this.headYaw = 0; this.headPitch = 0; this.flap = 0;
    this.amp = 0.1; this.base = 0; this.jawA = 0; this.glowK = 0; this.det = 0; this.wind = 0; this.dbl = false; this.far = false; this.excite = false; this.duty = null;
  }
  dispose() {
    const m = this.m;
    scene.remove(m.root); scene.remove(this.tag); this.tag.material.map.dispose(); this.tag.material.dispose();
    scene.remove(this.badge); this.badge.material.dispose(); scene.remove(this.cring); this.cring.material.dispose();
    m.flameMat.dispose(); m.coreMat.dispose(); m.glowMat.dispose(); m.glow.material.dispose();
  }
  update(dt, alpha, ballP, showTag) {
    const c = this.car, m = this.m;
    if (c.demolished) { m.root.visible = false; this.tag.visible = false; this.badge.visible = false; this.cring.visible = false; return; }
    m.root.visible = true;
    m.root.position.lerpVectors(c.pp, c.p, alpha);
    m.root.quaternion.slerpQuaternions(c.pq, c.q, alpha);
    this.t += dt;
    // far away the ink outlines would be sub-pixel and shimmer: drop them (with hysteresis)
    const lod = save.settings.quality === 'high' ? 26 : 19, far = m.root.position.distanceToSquared(camera.position) > (this.far ? lod * lod : (lod + 3) * (lod + 3));
    if (far !== this.far) { this.far = far; for (const o of m.outlines) o.visible = !far; }
    const fs = c.v.dot(c.fwd), afs = Math.min(Math.abs(fs), 20), spd = c.v.length(), air = !c.onGround, boost = c.boosting, sup = c.supersonic;
    // lean into turns
    const leanT = c.onGround ? clamp(-c.ctrl.steer * Math.min(1, Math.abs(fs) / 12), -1, 1) * 0.09 : 0;
    this.lean = damp(this.lean, leanT, 10, dt);
    m.tilt.rotation.z = this.lean;
    // land squash: one smooth ease back (no wobble), scaled about the belly so it stays on the ice; gentle breathing at rest
    if (c.justLanded) { this.squash = Math.max(this.squash, clamp(c.landImpact / 14, 0, 0.13)); c.justLanded = false; if (c === M.player && c.landImpact > 2) Sfx.land(c.landImpact); }
    this.squash = damp(this.squash, 0, 11, dt);
    const sq = this.squash, br = c.onGround && spd < 2 ? Math.sin(this.t * 2.4) * 0.012 : 0, sy = 1 - sq + br;
    m.tilt.scale.set(1 + sq * 0.45 - br * 0.4, sy, 1 + sq * 0.2);
    m.tilt.position.y = 0.32 * (sy - 1);
    // flippers: flap hard in the air, beat while boosting, tucked back with a small wiggle while sliding
    this.flap += dt * (air ? 19 : (boost ? 15 : 5 + afs * 0.25));
    this.amp = damp(this.amp, air ? 0.62 : (boost ? 0.36 : 0.1), 8, dt);
    this.base = damp(this.base, air ? 0.22 : (boost ? 0.08 : -0.06 - afs * 0.006), 6, dt);
    const fl = Math.sin(this.flap) * this.amp;
    m.flippers[0].rotation.z = -this.base - fl - this.lean * 1.4;
    m.flippers[1].rotation.z = this.base + fl - this.lean * 1.4;
    // feet: flutter kick (fast when boosting, lazy in the air)
    const kick = air ? 0.18 : (boost ? 0.32 : 0.12 + afs * 0.006), kr = air ? 6 : (boost ? 16 : 9);
    m.feet[0].rotation.x = 0.35 + Math.sin(this.t * kr + 1.6) * kick; m.feet[1].rotation.x = 0.35 + Math.sin(this.t * kr) * kick;
    // scarf tail streams back and flutters with speed
    this.wind = damp(this.wind, clamp(spd / 14, 0, 1), 4, dt);
    const w = this.wind, st = m.scarfTail, s2 = st.userData.seg2;
    st.rotation.set(0.25 - w * 0.2 + Math.sin(this.t * 11) * 0.12 * (0.3 + w), 0.45 + Math.sin(this.t * 7.3) * 0.1 + w * 0.15, Math.sin(this.t * 13) * 0.18 * w);
    s2.rotation.set(Math.sin(this.t * 11 - 1.4) * 0.35 * (0.3 + w), Math.sin(this.t * 7.3 - 1.1) * 0.25, 0);
    // expression: determined squint while boosting, wide eyes + open beak when flying fast
    const excite = sup || (air && spd > 12);
    this.det = damp(this.det, boost && !excite ? 1 : 0, 8, dt);
    this.jawA = damp(this.jawA, excite ? 0.42 : (boost ? 0.12 : 0), 10, dt);
    m.jaw.rotation.x = this.jawA;
    if (excite !== this.excite) { this.excite = excite; m.eyeMesh.material = pgTexMat(excite ? 'eye1' : 'eye0', () => pgEyeTex(excite ? 1 : 0)); }
    // blink (sometimes a double blink); lids hide when fully open
    this.blinkT -= dt;
    if (this.blinkT < -0.13) { this.blinkT = this.dbl ? 0.12 : rand(1.8, 4.8); this.dbl = !this.dbl && Math.random() < 0.2; }
    const bl = this.blinkT < 0 ? Math.sin(-this.blinkT / 0.13 * Math.PI) : 0;
    const open = -1.3 + this.det * 0.95 - (excite ? 0.15 : 0), la = open + (1.3 - open) * bl;
    for (let i = 0; i < 2; i++) { const lid = m.lids[i]; lid.visible = la > -1.0; lid.rotation.x = la; lid.rotation.z = (i ? 0.32 : -0.32) * this.det; }
    // head looks at the ball (yaw + a little pitch)
    _vl.copy(ballP).sub(m.root.position).applyQuaternion(_vq.copy(m.root.quaternion).invert());
    this.headYaw = damp(this.headYaw, clamp(Math.atan2(_vl.x, _vl.z), -0.75, 0.75), 8, dt);
    this.headPitch = damp(this.headPitch, clamp(Math.atan2(_vl.y - 0.3, Math.hypot(_vl.x, _vl.z)), -0.25, 0.35), 6, dt);
    m.head.rotation.y = this.headYaw; m.head.rotation.x = -this.headPitch; m.head.rotation.z = -this.lean * 0.6;
    const hat = m.hat.userData;
    if (hat.spin) hat.spin.rotation.y += dt * (9 + Math.abs(fs) * 1.2);
    if (hat.halo) { hat.halo.position.y = hat.haloY + Math.sin(this.t * 3) * 0.03; hat.halo.rotation.y += dt * 0.8; }
    // jetpack: throat glow ramps, flames flicker (hot pink afterburner when supersonic)
    this.glowK = damp(this.glowK, boost ? 1 : 0, 14, dt);
    m.glowMat.color.copy(pgGlowIdle).lerp(pgGlowHot, this.glowK);
    m.glow.visible = this.glowK > 0.05;
    if (m.glow.visible) { const k = (0.75 + Math.random() * 0.25) * this.glowK * (sup ? 1.25 : 1); m.glow.scale.set(k, k, 1); }
    m.flameMat.color.copy(sup ? pgFlameS : pgFlameA);
    for (const f of m.flames) {
      f.visible = boost;
      if (boost) { const k = 0.88 + Math.random() * 0.24; f.scale.set(k * (0.92 + Math.random() * 0.16), k * (0.92 + Math.random() * 0.16), k * (sup ? 1.5 : 1) * (0.85 + Math.random() * 0.3)); }
    }
    if (boost) {
      this.trailAcc += dt * (save.settings.quality === 'high' ? 70 : 42);
      m.root.updateMatrixWorld();
      while (this.trailAcc > 1) {
        this.trailAcc -= 1;
        _vp.set(rand(-0.05, 0.05), rand(-0.05, 0.05), -0.5).applyMatrix4(m.flames[0].matrixWorld);
        spawnTrail(c, _vp);
      }
    }
    if (sup && Math.random() < dt * 30) {
      m.root.updateMatrixWorld();
      _vp.set(rand(-0.75, 0.75), rand(-0.1, 0.35), -0.6).applyMatrix4(m.root.matrixWorld);
      FX.puff(_vp.x, _vp.y, _vp.z, 0, 0, 0, 0.1, 0.02, 0.3, 0xffffff, 0, 0);
    }
    if (c.onGround && Math.abs(fs) > 6 && Math.random() < dt * Math.abs(fs) * 0.8) {
      m.root.updateMatrixWorld();
      _vp.set(rand(-0.35, 0.35), -0.28, -0.65).applyMatrix4(m.root.matrixWorld);
      FX.puff(_vp.x, _vp.y, _vp.z, rand(-1, 1), rand(0.5, 1.5), rand(-1, 1), 0.08, 0.22, 0.45, 0xf2f9ff, -2, 2);
    }
    // charged shot winding up: ring under the belly (everyone sees the bots charge too)
    const cr = this.cring;
    cr.visible = c.charge > 0.01;
    if (cr.visible) {
      _vl.set(0, 1, 0).applyQuaternion(m.root.quaternion);
      cr.position.copy(m.root.position).addScaledVector(_vl, -RIDE_H + 0.05); cr.quaternion.copy(m.root.quaternion);
      cr.scale.setScalar(1 + 0.06 * Math.sin(this.t * 12));
      const u = cr.material.uniforms; u.uP.value = c.charge; u.uR.value = c.charge >= CHARGE_MIN ? 1 : 0; u.uT.value = this.t;
    }
    // ice-crystal speed burst: frosty glints stream off the penguin
    if (c.burstT > 0 && Math.random() < dt * 45) {
      m.root.updateMatrixWorld();
      _vp.set(rand(-0.45, 0.45), rand(0.1, 0.9), -0.55).applyMatrix4(m.root.matrixWorld);
      FX.spark(_vp.x, _vp.y, _vp.z, -c.v.x * 0.15, 0.6, -c.v.z * 0.15, rand(0.22, 0.38), 0.45, Math.random() < 0.5 ? 0xc8f6ff : 0x5fdcff, 0, 2.5);
    }
    this.tag.visible = showTag;
    const duty = showTag && c.isBot && c.duty && PG_DUTY[c.duty] ? c.duty : null;
    if (duty !== this.duty) { this.duty = duty; if (duty) { this.badge.material.map = pgBadge(duty); this.badge.material.needsUpdate = true; } }
    this.badge.visible = !!duty;
    if (showTag) {
      this.tag.position.copy(m.root.position); this.tag.position.y += 1.5;
      const k = clamp(this.tag.position.distanceTo(camera.position) / 14, 1, 2.4);
      this.tag.scale.set(2 * k, 0.5 * k, 1);
      if (duty) { this.badge.position.copy(this.tag.position); this.badge.position.y += 0.4 * k; this.badge.scale.set(1.06 * k, 0.265 * k, 1); }
    }
  }
}
// boost trails: each TRAILS id has its own size / motion / colour signature
const _trailCol = new THREE.Color();
let pgHue = 0;
function spawnTrail(c, p) {
  const id = c.cos.trail, r = Math.random();
  const vx = -c.fwd.x * 3 + c.v.x * 0.25 + rand(-0.6, 0.6), vy = -c.fwd.y * 3 + c.v.y * 0.25 + rand(-0.3, 0.6), vz = -c.fwd.z * 3 + c.v.z * 0.25 + rand(-0.6, 0.6);
  if (c.isBot && id === 'puff') { FX.puff(p.x, p.y, p.z, vx, vy, vz, 0.16, 0.42, 0.5, r < 0.5 ? 0xffffff : (c.team ? 0xffd0a6 : 0xc4e2ff), 0.4, 2.5); return; }
  switch (id) {
    case 'bubbles': // round bubbles that drift up and linger
      if (r < 0.6) FX.puff(p.x, p.y, p.z, vx * 0.5 + rand(-0.8, 0.8), vy * 0.5 + 1.4, vz * 0.5 + rand(-0.8, 0.8), rand(0.05, 0.1), rand(0.1, 0.2), rand(0.9, 1.3), r < 0.25 ? 0xd8fbff : (r < 0.45 ? 0x9ff0ff : 0xa8d8ff), 2.2, 2.2, 'bubble');
      break;
    case 'sparkle': // bright twinkles that shrink away, with the odd big glint
      FX.puff(p.x, p.y, p.z, vx + rand(-1.5, 1.5), vy + rand(-1, 1.5), vz + rand(-1.5, 1.5), r < 0.12 ? 0.24 : rand(0.07, 0.13), 0, rand(0.35, 0.6), r < 0.45 ? 0xffe066 : (r < 0.8 ? 0xffffff : 0xffb8e0), -1, 1.5);
      break;
    case 'fire': // licks of flame rising off the nozzle, plus a little smoke
      FX.puff(p.x, p.y, p.z, vx, vy + 1, vz, rand(0.16, 0.26), 0.04, rand(0.3, 0.45), r < 0.35 ? 0xffd23f : (r < 0.75 ? 0xff7a1f : 0xff3d2b), 2.5, 2);
      if (r < 0.1) FX.puff(p.x, p.y + 0.1, p.z, vx * 0.5, vy * 0.5 + 1, vz * 0.5, 0.1, 0.28, 0.7, 0x9a94b4, 1, 2.5, 'smoke');
      break;
    case 'rainbow': // tight colour-cycling ribbon
      pgHue = (pgHue + 0.023) % 1; _trailCol.setHSL(pgHue, 0.95, 0.6);
      FX.puff(p.x, p.y, p.z, vx * 0.4, vy * 0.4, vz * 0.4, 0.2, 0.3, 0.75, _trailCol.getHex(), 0, 1.2);
      break;
    default: // snow puffs
      FX.puff(p.x, p.y, p.z, vx, vy, vz, 0.15, 0.46, 0.55, r < 0.65 ? 0xffffff : 0xd6f1ff, 0.4, 2.5);
  }
}
