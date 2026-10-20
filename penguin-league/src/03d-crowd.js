// =====================================================================
//  CROWD — little penguin fans in the stands (called from buildArena)
// =====================================================================
const crowdU = { uTime: { value: 0 }, uExcite: { value: 0 } };
// extra inputs driven by the crowd frame hook: smoothed ball position (heads follow it), per-team cheer after a goal,
// the travelling Mexican wave, rink half-size, and world size of one screen pixel per metre of depth (outline width)
const crowdX = {
  uBall: { value: new V3() }, uCheer: { value: new THREE.Vector2(1, 1) }, uWave: { value: 0 }, uWaveA: { value: 0 },
  uRink: { value: new THREE.Vector2(41, 51) }, uPix: { value: 0.002 },
};
// fan rig (local space: feet on y=0, facing +Z): neck pivot, shoulder pivot, eye centre height, hand distance from shoulder
const CROWD_NECK = 0.8, CROWD_SHX = 0.27, CROWD_SHY = 0.64, CROWD_EYE = 1.02, CROWD_HAND = 0.42;
const crowdF = (v) => v.toFixed(3);
// shared vertex animation. aPart: 0 body, 1 head, 2 left flipper, 3 right flipper, 4 feet, 5 right flipper + flag cloth
// (fraction = ripple weight), 6 eyes (head + blink). aFan = (phase, held prop 0 none/1 flag/2 foam finger/3 sign, energy, team)
const CROWD_GLSL = `
uniform float uTime;
uniform float uExcite;
uniform vec3 uBall;
uniform vec2 uCheer;
uniform float uWave;
uniform float uWaveA;
uniform vec2 uRink;
attribute float aPart;
attribute vec4 aFan;
float crHop, crEx, crSad, crBur, crWav, crHp, crNear;
vec3 crLb;
vec2 crRot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
void crowdPrep() {
  float t = uTime, ph = aFan.x, en = aFan.z;
  vec3 ip = vec3(0.0); mat3 im = mat3(1.0);
#ifdef USE_INSTANCING
  ip = instanceMatrix[3].xyz; im = mat3(instanceMatrix);
#endif
  vec3 tb = uBall - ip;
  crLb = tb * im;
  float ch = aFan.w < 0.5 ? uCheer.x : uCheer.y;
  crEx = smoothstep(0.02, 0.5, uExcite * ch);
  crSad = smoothstep(0.02, 0.5, uExcite * (1.0 - ch));
  crNear = 1.0 - smoothstep(12.0, 30.0, length(tb));
  crBur = max(smoothstep(0.6, 0.95, sin(t * (0.23 + 0.2 * en) + ph * 3.7)) * (0.35 + 0.65 * en), crNear * en * 0.7) * (1.0 - crSad);
  float wd = mod(atan(ip.z / uRink.y, ip.x / uRink.x) - uWaveA + 3.14159, 6.28318) - 3.14159;
  crWav = uWave * exp(-wd * wd * 10.0) * (1.0 - crEx);
  crHp = abs(sin(t * (6.0 + 2.5 * en) + ph));
  crHop = crEx * crHp * (0.25 + 0.4 * en) + crBur * 0.05 * abs(sin(t * 8.0 + ph)) + crWav * 0.42;
}
void crowdAnim(inout vec3 p, inout vec3 n) {
  crowdPrep();
  float t = uTime, ph = aFan.x, hold = aFan.y, en = aFan.z;
  float part = floor(aPart + 0.01), cw = aPart - part;
  float sq = 0.025 * sin(t * 2.3 + ph * 1.3) + crEx * 0.13 * (crHp - 0.45) + crWav * 0.12 - crSad * 0.07;
  if (part > 5.5) p.y = ${crowdF(CROWD_EYE)} + (p.y - ${crowdF(CROWD_EYE)}) * (1.0 - 0.9 * step(0.965, fract(t * 0.21 + ph * 0.37)));
  if (part > 4.5 && part < 5.5) p.z += sin(t * (7.0 + 6.0 * crEx) - cw * 8.0 + ph) * cw * (0.07 + 0.05 * crEx);
  if ((part > 0.5 && part < 1.5) || part > 5.5) {
    float yaw = clamp(atan(crLb.x, crLb.z), -1.2, 1.2) * (1.0 - 0.6 * crSad);
    yaw = clamp(yaw + (fract(ph * 1.7) > 0.5 ? 0.9 : -0.9) * smoothstep(0.82, 0.96, sin(t * 0.17 + ph * 5.3)) * (1.0 - crEx), -1.5, 1.5);
    float pit = clamp(-atan(crLb.y, length(crLb.xz)), -0.2, 0.55) * 0.6 + crSad * 0.5 - crEx * 0.3;
    float rol = 0.2 * crEx * sin(t * 9.0 + ph) + 0.06 * sin(t * 1.1 + ph * 2.0);
    vec2 nk = vec2(0.0, ${crowdF(CROWD_NECK)});
    p.xy = crRot(p.xy - nk, rol) + nk; n.xy = crRot(n.xy, rol);
    p.yz = crRot(p.yz - nk.yx, pit) + nk.yx; n.yz = crRot(n.yz, pit);
    p.zx = crRot(p.zx, yaw); n.zx = crRot(n.zx, yaw);
  }
  if ((part > 1.5 && part < 3.5) || (part > 4.5 && part < 5.5)) {
    float s = part < 2.5 ? 1.0 : -1.0;
    float fa = 0.14 + 0.07 * sin(t * 1.9 + ph + s);
    fa = mix(fa, 0.6 + 0.5 * sin(t * 14.0 + ph + s * 1.3), crBur);
    fa = mix(fa, 2.85 + 0.12 * sin(t * 6.0 + ph + s), crWav);
    fa = mix(fa, 2.1 + 0.8 * sin(t * (10.0 + 5.0 * en) + ph + s * 1.7), crEx);
    fa = mix(fa, 0.02, crSad);
    if (s < 0.0 && hold > 0.5) {
      float hb = hold < 1.5 ? 2.4 + 0.4 * sin(t * 3.4 + ph) : (hold < 2.5 ? 2.65 + 0.2 * sin(t * 5.0 + ph) : 2.9 + 0.07 * sin(t * 1.7 + ph));
      float hw = hold < 1.5 ? 2.45 + 0.7 * sin(t * 10.0 + ph) : (hold < 2.5 ? 2.55 + 0.4 * sin(t * 12.0 + ph) : 2.8 + 0.3 * sin(t * 8.0 + ph));
      fa = mix(mix(hb, hw, max(crEx, max(crBur, crWav))), 1.5, crSad * 0.7);
    }
    vec2 sp = vec2(s * ${crowdF(CROWD_SHX)}, ${crowdF(CROWD_SHY)});
    p.xy = crRot(p.xy - sp, s * fa) + sp; n.xy = crRot(n.xy, s * fa);
  }
  if (part < 3.5 || part > 4.5) {
    vec3 k = vec3(1.0 - sq * 0.5, 1.0 + sq, 1.0 - sq * 0.5);
    p *= k; n = normalize(n / k);
    float sw = 0.05 * sin(t * 1.3 + ph * 2.1) + 0.12 * crEx * sin(t * 7.0 + ph);
    p.xy = crRot(p.xy, sw); n.xy = crRot(n.xy, sw);
    float ln = 0.04 + 0.1 * crEx + 0.06 * crSad + 0.05 * crNear;
    p.yz = crRot(p.yz, ln); n.yz = crRot(n.yz, ln);
  }
  if (en > 0.88) { float tw = crEx * 1.3 * sin(t * 5.0 + ph); p.zx = crRot(p.zx, tw); n.zx = crRot(n.zx, tw); }
  p.y += crHop;
}
`;

// ----------------------------------------------------------- materials (built once, shared by every arena build)
let crowdMats = null;
function crowdHook(m, key, fn) {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = function (sh, r) {
    if (prev) prev.call(this, sh, r);
    Object.assign(sh.uniforms, crowdU, crowdX);
    fn(sh);
  };
  m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|crowd-' + key; };
  return m;
}
function crowdFillMat(sign) {
  const m = toon(0xffffff, sign ? { vertexColors: true, map: crowdSignTex() } : { vertexColors: true });
  return crowdHook(m, sign ? 'sign' : 'fill', (sh) => {
    sh.vertexShader = CROWD_GLSL + 'attribute float aTint;\nattribute vec3 aBody;\nattribute vec3 aAcc;\n' + (sign ? 'attribute vec2 aCell;\n' : '') + sh.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 crP = position;\ncrowdAnim(crP, objectNormal);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = crP;')
      .replace('#include <color_vertex>', `#include <color_vertex>
#ifdef USE_COLOR
vColor.rgb *= (aTint > 1.5 && aTint < 2.5) ? aAcc : ((aTint > 0.5 && aTint < 1.5) ? aBody : vec3(1.0));
#endif`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
#ifdef USE_MAP
if (aTint > 2.5) vMapUv = uv * 0.25 + aCell;
#endif`);
  });
}
function crowdOlMat() {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), crowdU, crowdX, { uW: { value: 0.028 }, uC: { value: new THREE.Color(INK) } }),
    vertexShader: CROWD_GLSL + `uniform float uW;
uniform float uPix;
#include <fog_pars_vertex>
void main() {
  vec3 p = position, n = normal;
  crowdAnim(p, n);
  vec4 mvPosition = vec4(p, 1.0);
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition; n = mat3(instanceMatrix) * n;
#endif
  mvPosition = modelViewMatrix * mvPosition;
  float px = -mvPosition.z * uPix;
  mvPosition.xyz += normalize(normalMatrix * n) * clamp(uW, px, px * 2.8);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 uC;
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(uC, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    side: THREE.BackSide, fog: true,
  });
}
function crowdBlobMat() {
  const tex = canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const m = new THREE.MeshBasicMaterial({ color: 0x1d2c5e, map: tex, transparent: true, opacity: 0.36, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return crowdHook(m, 'blob', (sh) => {
    sh.vertexShader = CROWD_GLSL + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ncrowdPrep();\ntransformed.xz /= 1.0 + crHop * 1.8;');
  });
}
// sign atlas: 4x4 cells of 256x128, the last cell is plain white (sticks and board edges sample it)
const CROWD_SIGNS = [['GO BLUE!', 0], ['BLUE CREW', 0], ['I ♥ BLUE', 0], ['GO ORANGE!', 1], ['ORANGE!!', 1], ['I ♥ ORANGE', 1],
  ['NOOT NOOT!', 2], ['I ♥ FISH', 2], ['SLIDE!', 2], ['GOAL!!', 2], ['#1 FAN', 2], ['WADDLE!', 2], ['BONK!', 2], ['HI MOM!', 2], ['FLAP FLAP', 2]];
function crowdDrawSigns(g, w, h) {
  const fun = ['#ff5fa8', '#ffd23f', '#8d5bff', '#2fc9a5'];
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  CROWD_SIGNS.forEach(([txt, tm], i) => {
    const x = (i % 4) * 256, y = ((i / 4) | 0) * 128;
    const bc = tm < 2 ? TEAM_CSS[tm] : fun[i % fun.length];
    g.fillStyle = bc; g.fillRect(x, y, 256, 128);
    g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(x + 13, y + 13, 230, 102, 16); g.fill();
    let fs = 64; g.font = `${fs}px "Lilita One", "Arial Black", sans-serif`;
    const tw = g.measureText(txt).width; if (tw > 206) { fs = Math.floor(fs * 206 / tw); g.font = `${fs}px "Lilita One", "Arial Black", sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = Math.max(4, fs * 0.12); g.strokeStyle = '#1b1d3a';
    if (tm < 2) { g.strokeText(txt, x + 128, y + 66); g.fillStyle = bc; } else g.fillStyle = '#1b1d3a';
    g.fillText(txt, x + 128, y + 66);
  });
}
let crowdSignT = null;
function crowdSignTex() {
  if (crowdSignT) return crowdSignT;
  const t = crowdSignT = canvasTex(1024, 512, crowdDrawSigns);
  if (document.fonts && document.fonts.load) document.fonts.load('64px "Lilita One"').then(() => { crowdDrawSigns(t.image.getContext('2d'), 1024, 512); t.needsUpdate = true; }).catch(() => {});
  return t;
}

// ----------------------------------------------------------- fan geometry templates (merged, vertex coloured)
const crowdTmpM = new THREE.Matrix4(), crowdTmpE = new THREE.Euler(), crowdTmpQ = new Q();
// one piece: unit geo placed at p, rotation r (euler), scale s; flat colour; animation part; tint 0 fixed / 1 body / 2 accessory / 3 sign face
function crowdPc(geo, p, r, s, col, part, tint, ol, uv) {
  const g = geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(uv && k === 'uv')) g.deleteAttribute(k);
  crowdTmpM.compose(new V3(...p), crowdTmpQ.setFromEuler(crowdTmpE.set(r[0], r[1], r[2])), typeof s === 'number' ? new V3(s, s, s) : new V3(...s));
  g.applyMatrix4(crowdTmpM);
  const n = g.attributes.position.count, c = new THREE.Color(col), ca = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(ca, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
  g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1));
  g.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(n).fill(tint), 1));
  if (uv && !g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  g.userData.ol = !!ol;
  return g;
}
// averaged normals so outline shells of hard-edged pieces stay closed
function crowdSmooth(g) {
  g = g.clone();
  const p = g.attributes.position, n = g.attributes.normal, acc = new Map(), keys = [];
  for (let i = 0; i < p.count; i++) {
    const k = `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
    keys.push(k); const a = acc.get(k) || [0, 0, 0]; a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); acc.set(k, a);
  }
  for (let i = 0; i < p.count; i++) { const a = acc.get(keys[i]), l = Math.hypot(a[0], a[1], a[2]) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
  return g;
}
function crowdMerge(list, uv) {
  const names = { position: 3, normal: 3, color: 3, aPart: 1, aTint: 1 };
  if (uv) names.uv = 2;
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
  const out = new THREE.BufferGeometry(), arr = {}, idx = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
  for (const k in names) arr[k] = new Float32Array(nv * names[k]);
  let vo = 0, io = 0;
  for (const g of list) {
    for (const k in names) arr[k].set(g.attributes[k].array, vo * names[k]);
    const gi = g.index.array; for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += g.attributes.position.count; io += gi.length;
  }
  for (const k in names) out.setAttribute(k, new THREE.BufferAttribute(arr[k], names[k]));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
function crowdPair(list, uv) { return { fill: crowdMerge(list, uv), ol: crowdMerge(list.filter((g) => g.userData.ol).map(crowdSmooth), uv) }; }
// cap on the unit sphere around the +Z pole with angular radius rf(azimuth); azimuth 0 = +X, PI/2 = +Y
function crowdPatch(rf, rings, segs) {
  const pos = [0, 0, 1], idx = [];
  for (let i = 1; i <= rings; i++) for (let j = 0; j < segs; j++) {
    const a = j / segs * Math.PI * 2, th = rf(a) * i / rings;
    pos.push(Math.sin(th) * Math.cos(a), Math.sin(th) * Math.sin(a), Math.cos(th));
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + j, 1 + (j + 1) % segs);
  for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = 1 + (i - 1) * segs + j, b = 1 + (i - 1) * segs + (j + 1) % segs, c = a + segs, d = b + segs;
    idx.push(a, c, d, a, d, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.slice(), 3));
  g.setIndex(idx); return g;
}
let crowdT = null;
function crowdTemplates() {
  if (crowdT) return crowdT;
  const S = (w, h, a, b, c, d) => new THREE.SphereGeometry(1, w, h, a, b, c, d);
  const G = {
    s6: S(6, 4), s4: S(4, 2), fl: S(6, 4), hemi: S(9, 3, 0, Math.PI * 2, 0, Math.PI / 2),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 6, 1), torus: new THREE.TorusGeometry(1, 0.28, 4, 11),
    band: new THREE.TorusGeometry(1, 0.16, 3, 11), cloth: new THREE.BoxGeometry(1, 1, 1, 5, 1, 1), box: new THREE.BoxGeometry(1, 1, 1),
  };
  const W = 0xf8fbff, OR = 0xffa41b, HC = [0, 1.0, 0], HS = [0.3, 0.28, 0.28], P = Math.PI;
  // point on the head ellipsoid in direction (yaw, pitch), pushed out by k
  const onHead = (yaw, pit, k) => [HC[0] + Math.sin(yaw) * Math.cos(pit) * HS[0] * k, HC[1] + Math.sin(pit) * HS[1] * k, HC[2] + Math.cos(yaw) * Math.cos(pit) * HS[2] * k];
  // --- the fan (near and far detail): egg body, big head with a white heart-shaped face, bead eyes, beak, cheeks, flippers, feet.
  // The white markings are thin shells hugging the body/head (no intersecting surfaces: crisp edges, no z-fight)
  const fanParts = (lo) => {
    const g = lo
      ? { body: S(8, 5), head: S(9, 6), fl: S(5, 3), foot: S(4, 2), eye: S(4, 2), cone: new THREE.ConeGeometry(1, 1, 4, 1), bs: 10, fs: 14, r: 2 }
      : { body: S(12, 8), head: S(14, 9), fl: S(8, 5), foot: S(8, 4), eye: S(6, 4), cone: new THREE.ConeGeometry(1, 1, 8, 1), bs: 16, fs: 24, r: 3 };
    const belly = crowdPatch((a) => 0.92 - 0.1 * Math.sin(a), g.r, g.bs).rotateX(0.32);
    const face = crowdPatch((a) => 0.74 + 0.1 * Math.sin(a) - 0.2 * Math.exp(-Math.pow((a - Math.PI / 2) / 0.32, 2)), g.r, g.fs).rotateX(0.2);
    const fan = [
      crowdPc(g.body, [0, 0.44, 0], [0, 0, 0], [0.335, 0.4, 0.31], 0xffffff, 0, 1, true),
      crowdPc(belly, [0, 0.44, 0], [0, 0, 0], [0.335 * 1.04, 0.4 * 1.04, 0.31 * 1.04], W, 0, 0),
      crowdPc(g.head, HC, [0, 0, 0], HS, 0xffffff, 1, 1, true),
      crowdPc(face, HC, [0, 0, 0], HS.map((v) => v * 1.04), W, 1, 0),
      crowdPc(g.cone, onHead(0, -0.12, 0.9), [P / 2 - 0.12, 0, 0], [0.055, 0.15, 0.042], OR, 1, 0, !lo),
    ];
    for (const s of [-1, 1]) {
      const e = onHead(s * 0.36, 0.08, 1.0);
      fan.push(crowdPc(g.eye, e, [-0.08, s * 0.36, 0], [0.044, 0.06, 0.032], INK, 6, 0));
      if (!lo) {
        fan.push(crowdPc(G.s4, [e[0] - s * 0.004 + 0.012, e[1] + 0.022, e[2] + 0.026], [0, 0, 0], 0.015, 0xffffff, 6, 0));
        fan.push(crowdPc(G.s4, onHead(s * 0.66, -0.16, 1.02), [0.16, s * 0.66, 0], [0.048, 0.028, 0.024], 0xff8fb1, 1, 0));
      }
      fan.push(crowdPc(g.fl, [s * (CROWD_SHX + 0.045), CROWD_SHY - 0.2, 0.01], [0, 0, s * 0.22], [0.07, 0.235, 0.13], 0xffffff, s > 0 ? 2 : 3, 1, true));
      fan.push(crowdPc(g.foot, [s * 0.12, 0.065, 0.15], [0, s * 0.3, 0], [0.1, 0.045, 0.15], OR, 4, 0, true));
    }
    return fan;
  };
  // --- accessories (separate instanced subsets): team scarf, team beanie
  const scarf = [
    crowdPc(G.torus, [0, 0.79, 0], [P / 2, 0, 0], 0.255, 0xffffff, 0, 2, true),
    crowdPc(G.s6, [0.11, 0.65, 0.24], [-0.25, 0, 0.15], [0.075, 0.15, 0.04], 0xffffff, 0, 2, true),
  ];
  const beanie = [
    crowdPc(G.hemi, [0, 1.12, -0.005], [0, 0, 0], [0.29, 0.2, 0.275], 0xffffff, 1, 2, true),
    crowdPc(G.band, [0, 1.125, -0.005], [P / 2, 0, 0], 0.285, 0xffffff, 1, 0, true),
    crowdPc(G.s6, [0, 1.34, -0.01], [0, 0, 0], 0.075, 0xffffff, 1, 0, true),
  ];
  // --- held props, modelled pointing up from the hand (facing +Z), then moved into the rest pose of the right flipper
  const rest = new THREE.Matrix4().makeTranslation(-CROWD_SHX, CROWD_SHY, 0)
    .multiply(new THREE.Matrix4().makeRotationZ(P)).multiply(new THREE.Matrix4().makeTranslation(0, CROWD_HAND, 0));
  const toRest = (list) => { for (const g of list) g.applyMatrix4(rest); return list; };
  const flagCloth = crowdPc(G.cloth, [-0.38, 0.86, 0], [0, 0, 0], [0.72, 0.46, 0.035], 0xffffff, 5, 2, true);
  const fp = flagCloth.attributes.position, fa = flagCloth.attributes.aPart;
  for (let i = 0; i < fp.count; i++) fa.setX(i, 5 + clamp(-fp.getX(i) / 0.8, 0, 0.95));
  const stripe = crowdPc(G.cloth, [-0.38, 0.86, 0], [0, 0, 0], [0.74, 0.13, 0.055], 0xffffff, 5, 0);
  const sp = stripe.attributes.position, sa = stripe.attributes.aPart;
  for (let i = 0; i < sp.count; i++) sa.setX(i, 5 + clamp(-sp.getX(i) / 0.8, 0, 0.95));
  const flag = toRest([
    crowdPc(G.cyl, [0, 0.5, 0], [0, 0, 0], [0.035, 1.25, 0.035], 0xfff1d6, 3, 0, true),
    crowdPc(G.s6, [0, 1.15, 0], [0, 0, 0], 0.06, 0xffd23f, 3, 0, true),
    flagCloth, stripe,
  ]);
  const finger = toRest([
    crowdPc(G.fl, [0, 0.16, 0], [0, 0, 0], [0.18, 0.19, 0.11], 0xffffff, 3, 2, true),
    crowdPc(G.cyl, [0, 0.43, 0], [0, 0, 0], [0.075, 0.32, 0.075], 0xffffff, 3, 2, true),
    crowdPc(G.s6, [0, 0.59, 0], [0, 0, 0], 0.075, 0xffffff, 3, 2, true),
    crowdPc(G.s6, [-0.17, 0.23, 0.03], [0, 0, 0.7], [0.06, 0.11, 0.06], 0xffffff, 3, 2, true),
    crowdPc(G.cyl, [0, -0.02, 0], [0, 0, 0], [0.13, 0.09, 0.11], 0xffffff, 3, 0, true),
  ]);
  const board = crowdPc(G.box, [0, 0.86, 0], [0, 0, 0], [0.92, 0.5, 0.05], 0xffffff, 3, 0, true, true);
  const bu = board.attributes.uv, bt = board.attributes.aTint;
  for (let i = 0; i < bu.count; i++) { if (i >= 16 && i < 20) bt.setX(i, 3); else bu.setXY(i, 0.875, 0.125); }
  const stick = crowdPc(G.cyl, [0, 0.3, 0], [0, 0, 0], [0.032, 0.72, 0.032], 0xe8c48e, 3, 0, true, true);
  for (let i = 0; i < stick.attributes.uv.count; i++) stick.attributes.uv.setXY(i, 0.875, 0.125);
  const sign = toRest([stick, board]);
  const blob = new THREE.PlaneGeometry(0.95, 0.85).rotateX(-P / 2).translate(0, 0.03, 0.04);
  crowdT = { fan: crowdPair(fanParts(false)), fanLo: crowdPair(fanParts(true)), scarf: crowdPair(scarf), beanie: crowdPair(beanie), flag: crowdPair(flag), finger: crowdPair(finger), sign: crowdPair(sign, true), blob };
  return crowdT;
}

// ----------------------------------------------------------- seating + instancing
let crowdLive = null;
const CROWD_SKIN_W = { classic: 46, emperor: 14, ghost: 5, bubblegum: 7, mint: 6, sunset: 5, galaxy: 8, gold: 3 };
// grp: arena group to add to; perim: arena perimeter samples [{x,z,nx,nz}] (outward normals);
// stands: { seam: wall rail height, rows: [{ off: outward offset of the row centre, y: seat height, depth }] }
function buildCrowd(grp, perim, stands) {
  if (crowdLive) for (const e of crowdLive.meshes) e.mesh.dispose();
  const T = crowdTemplates();
  if (!crowdMats) crowdMats = { fill: crowdFillMat(false), sign: crowdFillMat(true), ol: crowdOlMat(), blob: crowdBlobMat() };
  crowdX.uRink.value.set(A.hx, A.hz);
  // seats: walk each row's offset polyline at a steady spacing, with clumpy empty seats
  const rows = stands.rows, occ = 0.84;
  const rowPts = rows.map((row) => perim.map((p) => ({ x: p.x + p.nx * row.off, z: p.z + p.nz * row.off, nx: p.nx, nz: p.nz })));
  let total = 0;
  for (const pts of rowPts) for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; total += Math.hypot(b.x - a.x, b.z - a.z); }
  const sp = clamp(total * occ / 2300, 1.3, 1.7), seats = [];
  rows.forEach((row, ri) => {
    const pts = rowPts[ri], k1 = rand(0, 6.3), k2 = rand(0, 6.3);
    let s = rand(0, sp), acc = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], L = Math.hypot(b.x - a.x, b.z - a.z);
      while (s < L) {
        const t = s / L, d = (acc + s);
        if (Math.random() < occ + 0.1 * Math.sin(d * 0.09 + k1) + 0.07 * Math.sin(d * 0.31 + k2)) {
          let nx = a.nx + (b.nx - a.nx) * t, nz = a.nz + (b.nz - a.nz) * t; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
          const dj = rand(-0.22, 0.22), sx = a.x + (b.x - a.x) * t + nx * dj, sz = a.z + (b.z - a.z) * t + nz * dj;
          if (!(stands.aisle && stands.aisle(sx, sz))) seats.push({ x: sx, y: row.y, z: sz, nx, nz });   // nobody sits on the stairs
        }
        s += sp * rand(0.88, 1.12);
      }
      s -= L; acc += L;
    }
  });
  const fans = shuffle(seats), N = fans.length, loN = Math.floor(N * 0.5);
  const skinW = SKINS.map((k) => CROWD_SKIN_W[k.id] || 4), skinSum = skinW.reduce((a, b) => a + b, 0);
  const fun = [0xff5fa8, 0xffd23f, 0x8d5bff, 0x2fc9a5], c = new THREE.Color(), white = new THREE.Color(0xffffff);
  const mats = new Float32Array(N * 16), fanA = new Float32Array(N * 4), bodyA = new Float32Array(N * 3), accA = new Float32Array(N * 3);
  const subs = { scarf: [], beanie: [], flag: [], finger: [], sign: [] }, cells = [];
  const m4 = new THREE.Matrix4(), q = new Q(), pv = new V3(), sv = new V3();
  fans.forEach((f, i) => {
    // face inward, drifting toward the rink centre
    const cl = Math.hypot(f.x, f.z) || 1;
    const dx = -f.nx * 0.65 - (f.x / cl) * 0.35, dz = -f.nz * 0.65 - (f.z / cl) * 0.35;
    q.setFromAxisAngle(UP, Math.atan2(dx, dz) + rand(-0.12, 0.12));
    const sc = Math.random() < 0.08 ? rand(0.8, 0.9) : rand(1.0, 1.24);
    m4.compose(pv.set(f.x, f.y, f.z), q, sv.set(sc, sc, sc)).toArray(mats, i * 16);
    // team leaning by end of the rink, body colour from the skins, accessory colour mostly team
    const team = Math.random() < 0.5 - 0.44 * Math.tanh(f.z / (A.hz * 0.4)) ? 0 : 1;
    let r = Math.random() * skinSum, si = 0; while (r > skinW[si] && si < skinW.length - 1) { r -= skinW[si]; si++; }
    c.setHex(SKINS[si].body).multiplyScalar(rand(0.9, 1.07)).toArray(bodyA, i * 3);
    const ar = Math.random();
    c.setHex(ar < 0.9 ? TEAM_HEX[team] : pick(fun)); if (ar > 0.68 && ar < 0.9) c.lerp(white, 0.28);
    c.toArray(accA, i * 3);
    const hr = Math.random(), hold = hr < 0.06 ? 1 : hr < 0.105 ? 2 : hr < 0.16 ? 3 : 0;
    fanA.set([rand(0, 6.283), hold, Math.pow(Math.random(), 0.8), team], i * 4);
    if (Math.random() < 0.38) subs.scarf.push(i);
    if (Math.random() < 0.26) subs.beanie.push(i);
    if (hold === 1) subs.flag.push(i); else if (hold === 2) subs.finger.push(i);
    else if (hold === 3) { subs.sign.push(i); const pool = CROWD_SIGNS.map((s, k) => k).filter((k) => CROWD_SIGNS[k][1] === team || (CROWD_SIGNS[k][1] === 2 && Math.random() < 0.6)); cells[i] = pick(pool); }
  });
  const meshes = [];
  const add = (geo, mat, list, ro) => {
    const n = list.length; if (!n) return null;
    const g = new THREE.BufferGeometry();
    for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]);
    if (geo.index) g.setIndex(geo.index);
    const fa = new Float32Array(n * 4), ba = new Float32Array(n * 3), aa = new Float32Array(n * 3), ca = new Float32Array(n * 2);
    const mesh = new THREE.InstancedMesh(g, mat, n);
    list.forEach((fi, j) => {
      mesh.instanceMatrix.array.set(mats.subarray(fi * 16, fi * 16 + 16), j * 16);
      fa.set(fanA.subarray(fi * 4, fi * 4 + 4), j * 4); ba.set(bodyA.subarray(fi * 3, fi * 3 + 3), j * 3); aa.set(accA.subarray(fi * 3, fi * 3 + 3), j * 3);
      if (cells[fi] !== undefined) ca.set([(cells[fi] % 4) * 0.25, 0.75 - ((cells[fi] / 4) | 0) * 0.25], j * 2);
    });
    g.setAttribute('aFan', new THREE.InstancedBufferAttribute(fa, 4));
    g.setAttribute('aBody', new THREE.InstancedBufferAttribute(ba, 3));
    g.setAttribute('aAcc', new THREE.InstancedBufferAttribute(aa, 3));
    if (mat === crowdMats.sign) g.setAttribute('aCell', new THREE.InstancedBufferAttribute(ca, 2));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
    if (ro) mesh.renderOrder = ro;
    mesh.userData.crowd = true;
    grp.add(mesh);
    let lo = 0; while (lo < n && list[lo] < loN) lo++;
    meshes.push({ mesh, hi: n, lo, blob: mat === crowdMats.blob });
    return mesh;
  };
  const all = fans.map((f, i) => i);
  const pair = (tpl, list, sign) => [add(tpl.fill, sign ? crowdMats.sign : crowdMats.fill, list), add(tpl.ol, crowdMats.ol, list)];
  // the fans themselves in angular sectors so the parts behind the camera are frustum culled
  const NS = 16, sect = Array.from({ length: NS }, () => []);
  for (const i of all) { const f = fans[i]; sect[Math.floor(((Math.atan2(f.z / A.hz, f.x / A.hx) / (Math.PI * 2)) + 1.0001) * NS) % NS].push(i); }
  const sectors = [];
  for (const list of sect) {
    if (!list.length) continue;
    const box = new THREE.Box3(); for (const i of list) box.expandByPoint(pv.set(fans[i].x, fans[i].y, fans[i].z));
    box.expandByScalar(1.5);
    const sph = box.getBoundingSphere(new THREE.Sphere()); sph.radius += 2;
    const hi = pair(T.fan, list), lo = pair(T.fanLo, list);
    for (const m of hi.concat(lo)) { m.frustumCulled = true; m.boundingSphere = sph; m.geometry.boundingSphere = sph; }
    sectors.push({ box, hi, lo, near: null });
  }
  for (const k of ['scarf', 'beanie', 'flag', 'finger']) pair(T[k], subs[k].sort((a, b) => a - b));
  pair(T.sign, subs.sign.sort((a, b) => a - b), true);
  add(T.blob, crowdMats.blob, all, 1);
  crowdLive = { meshes, sectors, q: null, s0: M.score[0], s1: M.score[1], waveOn: false, waveT: rand(12, 25), waveLeft: 0, n: N };
}
// per frame: quality (half the fans + no contact shadows on low), ball tracking, goal side, outline pixel size, Mexican wave
FRAME_HOOKS.push((dt, rdt) => {
  const L = crowdLive; if (!L) return;
  const q = save.settings.quality;
  if (q !== L.q) { L.q = q; for (const e of L.meshes) { e.mesh.count = q === 'low' ? e.lo : e.hi; if (e.blob) e.mesh.visible = q !== 'low'; } }
  // detail level per sector by camera distance (far fans use the lighter model)
  for (const sc of L.sectors) {
    const near = sc.box.distanceToPoint(camera.position) < 30;
    if (near !== sc.near) { sc.near = near; for (const m of sc.hi) m.visible = near; for (const m of sc.lo) m.visible = !near; }
  }
  if (M.ball) crowdX.uBall.value.lerp(ballView.mesh.position, 1 - Math.exp(-4 * Math.min(0.1, rdt || 0.016)));   // the interpolated ball
  const s0 = M.score[0], s1 = M.score[1];
  if (s0 > L.s0) crowdX.uCheer.value.set(1, 0.15); else if (s1 > L.s1) crowdX.uCheer.value.set(0.15, 1);
  L.s0 = s0; L.s1 = s1;
  if (crowdU.uExcite.value < 0.01) crowdX.uCheer.value.set(1, 1);
  crowdX.uPix.value = 2.3 * Math.tan(camera.fov * Math.PI / 360) / Math.max(200, renderer.domElement.height);
  const ex = crowdU.uExcite.value > 0.05;
  if (ex) L.waveOn = false;
  if (!L.waveOn) { L.waveT -= dt; if (L.waveT <= 0 && !ex) { L.waveOn = true; L.waveLeft = rand(1.2, 1.8) * Math.PI * 2; crowdX.uWaveA.value = rand(0, Math.PI * 2); } }
  else {
    const st = dt * 0.8; crowdX.uWaveA.value = (crowdX.uWaveA.value + st) % (Math.PI * 2); L.waveLeft -= st;
    if (L.waveLeft <= 0) { L.waveOn = false; L.waveT = rand(30, 60); }
  }
  crowdX.uWave.value = damp(crowdX.uWave.value, L.waveOn ? 1 : 0, 2.5, dt);
});
