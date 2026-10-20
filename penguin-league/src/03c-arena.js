// =====================================================================
//  ARENA — walls, floor, goals, stands, floodlights, fish boost pads
// =====================================================================
// ----------------------------------------------------------- arena
let arenaGroup = null, padViews = [];
function perimeter() {
  const pts = [], hx = A.hx, hz = A.hz, rc = A.rc, gw = A.gw;
  const ex = hx - rc, ez = hz - rc;
  const lin = (a, b, n, out) => { for (let i = 0; i < n; i++) out.push(a + (b - a) * i / n); };
  const xs = []; lin(ex, gw, 4, xs); lin(gw, -gw, 10, xs); lin(-gw, -ex, 4, xs);
  const zs = []; lin(ez, -ez, 22, zs);
  const arc = (cx, cz, a0) => { for (let i = 0; i < 9; i++) { const t = (a0 + 90 * i / 9) * Math.PI / 180; pts.push({ x: cx + rc * Math.cos(t), z: cz + rc * Math.sin(t), nx: Math.cos(t), nz: Math.sin(t) }); } };
  for (const x of xs) pts.push({ x, z: hz, nx: 0, nz: 1 });
  arc(-ex, ez, 90);
  for (const z of zs) pts.push({ x: -hx, z, nx: -1, nz: 0 });
  arc(-ex, -ez, 180);
  for (const x of xs) pts.push({ x: -x, z: -hz, nx: 0, nz: -1 });
  arc(ex, -ez, 270);
  for (const z of zs) pts.push({ x: hx, z: -z, nx: 1, nz: 0 });
  arc(ex, ez, 0);
  return pts;
}
// sweep a profile [{c (outward offset), y, nc, ny}] around the perimeter
function sweep(perim, prof, colorFn, skipFn) {
  const pos = [], nor = [], col = [], idx = [];
  const P = perim.length, J = prof.length;
  const cc = new THREE.Color();
  for (let j = 0; j < J; j++) {
    const pr = prof[j];
    for (let i = 0; i < P; i++) {
      const pt = perim[i];
      const x = pt.x + pt.nx * pr.c, z = pt.z + pt.nz * pr.c;
      pos.push(x, pr.y, z);
      nor.push(pt.nx * pr.nc, pr.ny, pt.nz * pr.nc);
      colorFn(cc, x, pr.y, z, i, j); col.push(cc.r, cc.g, cc.b);
    }
  }
  for (let j = 0; j < J - 1; j++) for (let i = 0; i < P; i++) {
    const i2 = (i + 1) % P;
    const a = j * P + i, b = j * P + i2, c = (j + 1) * P + i2, d = (j + 1) * P + i;
    if (skipFn) {
      const mx = (pos[a * 3] + pos[b * 3] + pos[c * 3] + pos[d * 3]) / 4, my = (pos[a * 3 + 1] + pos[c * 3 + 1]) / 2, mz = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2] + pos[d * 3 + 2]) / 4;
      if (skipFn(mx, my, mz)) continue;
    }
    idx.push(a, b, c, a, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}
function rrShape(hw, hd, r) {
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hd); s.lineTo(hw - r, -hd); s.absarc(hw - r, -hd + r, r, -Math.PI / 2, 0, false);
  s.lineTo(hw, hd - r); s.absarc(hw - r, hd - r, r, 0, Math.PI / 2, false);
  s.lineTo(-hw + r, hd); s.absarc(-hw + r, hd - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-hw, -hd + r); s.absarc(-hw + r, -hd + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

// ----------------------------------------------------------- arena helpers
const arenaFX = { t: { value: 0 }, led: null, ledOn: 0, glow: [], halo: null, haloSize: 0, flags: null, trash: [] };
const ARENA_FONT = '"Lilita One", "Arial Black", sans-serif';
const ARENA_INK = '#1b1d3a';
const arenaHi = () => save.settings.quality !== 'low';
const arenaShade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
// canvas texture with mipmaps + anisotropy; `font` textures redraw once the display font has loaded
function arenaTex(w, h, draw, wrap, font) {
  const t = canvasTex(w, h, draw);
  t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (font && document.fonts && !document.fonts.check('40px "Lilita One"')) {
    document.fonts.load('40px "Lilita One"').then((f) => {
      if (!f.length) return;
      const g = t.image.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.shadowBlur = 0; g.clearRect(0, 0, w, h);
      draw(g, w, h); t.needsUpdate = true;
    }).catch(() => {});
  }
  return t;
}
// text centred at x,y; size in current canvas units (U = internal font upscale for metre-unit canvases)
function arenaText(g, txt, x, y, size, fill, ink, maxW, U = 1) {
  g.save(); g.translate(x, y); g.scale(1 / U, 1 / U);
  g.font = `${Math.round(size * U)}px ${ARENA_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = g.measureText(txt).width;
  if (maxW && w > maxW * U) g.scale(maxW * U / w, 1);
  if (ink) { g.lineJoin = 'round'; g.strokeStyle = ink; g.lineWidth = size * U * 0.22; g.strokeText(txt, 0, 0); }
  g.fillStyle = fill; g.fillText(txt, 0, 0);
  g.restore();
  return Math.min(w / U, maxW || 1e9);
}
// side-view cartoon fish facing +x, about 1.4 units long
function arenaFishIcon(g, x, y, s, body, fin, lw = 0.09) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = lw; g.strokeStyle = ARENA_INK;
  g.fillStyle = fin;
  g.beginPath(); g.moveTo(-0.3, 0); g.quadraticCurveTo(-0.55, -0.12, -0.72, -0.34); g.quadraticCurveTo(-0.6, 0, -0.72, 0.34); g.quadraticCurveTo(-0.55, 0.12, -0.3, 0); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-0.2, -0.22); g.quadraticCurveTo(-0.05, -0.5, 0.16, -0.27); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = body; g.beginPath(); g.ellipse(0.04, 0, 0.42, 0.3, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(0.02, -0.14, 0.24, 0.07, -0.1, 0, Math.PI * 2); g.fill();
  g.fillStyle = fin; g.beginPath(); g.ellipse(-0.02, 0.1, 0.13, 0.07, 0.5, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0.22, -0.06, 0.11, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = ARENA_INK; g.beginPath(); g.arc(0.25, -0.05, 0.06, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0.27, -0.08, 0.022, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(0.34, 0.07, 0.07, 0.3, 1.7); g.stroke();
  g.restore();
}
function arenaFlake(g, x, y, r, col, lw) {
  g.save(); g.translate(x, y); g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0);
    for (const s of [-1, 1]) { g.moveTo(s * r * 0.55, 0); g.lineTo(s * r * 0.8, r * 0.22); g.moveTo(s * r * 0.55, 0); g.lineTo(s * r * 0.8, -r * 0.22); }
    g.stroke();
  }
  g.restore();
}
function arenaStar(g, x, y, r, fill, ink, lw) {
  g.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.48 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fillStyle = fill; g.fill(); if (ink) { g.lineJoin = 'round'; g.strokeStyle = ink; g.lineWidth = lw; g.stroke(); }
}
// cumulative perimeter length at outward offset c (P+1 entries, closing segment included)
function arenaCum(perim, c) {
  const P = perim.length, L = [0];
  for (let i = 1; i <= P; i++) { const a = perim[i - 1], b = perim[i % P]; L.push(L[i - 1] + Math.hypot(b.x + b.nx * c - a.x - a.nx * c, b.z + b.nz * c - a.z - a.nz * c)); }
  return L;
}
// point + outward normal at arc length s along the perimeter (wall line)
function arenaAt(perim, cum, s) {
  const P = perim.length, L = cum[P];
  s = ((s % L) + L) % L;
  let i = 0; while (i < P - 1 && cum[i + 1] <= s) i++;
  const a = perim[i], b = perim[(i + 1) % P], t = (s - cum[i]) / Math.max(1e-6, cum[i + 1] - cum[i]);
  const nx = a.nx + (b.nx - a.nx) * t, nz = a.nz + (b.nz - a.nz) * t, nl = Math.hypot(nx, nz) || 1;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, nx: nx / nl, nz: nz / nl };
}
// u coordinates along a run of perimeter columns at offset c, in units of `unit` metres
function arenaUs(perim, cols, c, unit) {
  const us = [0];
  for (let k = 1; k < cols.length; k++) { const a = perim[cols[k - 1]], b = perim[cols[k]]; us.push(us[k - 1] + Math.hypot(b.x + b.nx * c - a.x - a.nx * c, b.z + b.nz * c - a.z - a.nz * c) / unit); }
  return us;
}
// sweep a profile [{c, y, v, brk}] along perimeter columns with uvs; normals follow the profile,
// a row flagged brk ends a run (hard edge); skip(mx,my,mz) drops faces
function arenaSweep(perim, prof, cols, us, skip) {
  const pos = [], nor = [], uv = [], idx = [], C = cols.length, J = prof.length;
  for (let j = 0; j < J; j++) {
    const pr = prof[j];
    const a = j > 0 && !prof[j - 1].brk ? prof[j - 1] : pr, b = j < J - 1 && !pr.brk ? prof[j + 1] : pr;
    const tc = b.c - a.c, ty = b.y - a.y, l = Math.hypot(tc, ty) || 1, nc = -ty / l, ny = tc / l;
    for (let k = 0; k < C; k++) {
      const pt = perim[cols[k]];
      pos.push(pt.x + pt.nx * pr.c, pr.y, pt.z + pt.nz * pr.c);
      nor.push(pt.nx * nc, ny, pt.nz * nc); uv.push(us[k], pr.v);
    }
  }
  for (let j = 0; j < J - 1; j++) {
    if (prof[j].brk) continue;
    for (let k = 0; k < C - 1; k++) {
      const a = j * C + k, b = a + 1, c = a + C + 1, d = a + C;
      if (skip && skip((pos[a * 3] + pos[c * 3]) / 2, (pos[a * 3 + 1] + pos[c * 3 + 1]) / 2, (pos[a * 3 + 2] + pos[c * 3 + 2]) / 2)) continue;
      idx.push(a, b, c, a, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}
// merge [geometry, matrix, color | fn(out, x, y, z)] parts into one geometry with vertex colours
function arenaMerge(parts) {
  let nv = 0; const idx = [];
  for (const [g] of parts) nv += g.attributes.position.count;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const v = new V3(), nm = new THREE.Matrix3(), c = new THREE.Color();
  let o = 0;
  for (const [g, m, color] of parts) {
    const Pa = g.attributes.position, Na = g.attributes.normal, fn = typeof color === 'function';
    nm.getNormalMatrix(m); if (!fn) c.set(color);
    for (let i = 0; i < Pa.count; i++) {
      v.fromBufferAttribute(Pa, i).applyMatrix4(m); pos[(o + i) * 3] = v.x; pos[(o + i) * 3 + 1] = v.y; pos[(o + i) * 3 + 2] = v.z;
      if (fn) color(c, v.x, v.y, v.z);
      col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b;
      v.fromBufferAttribute(Na, i).applyMatrix3(nm).normalize(); nor[(o + i) * 3] = v.x; nor[(o + i) * 3 + 1] = v.y; nor[(o + i) * 3 + 2] = v.z;
    }
    const flip = m.determinant() < 0, n = g.index ? g.index.count : Pa.count, ix = (k) => (g.index ? g.index.getX(k) : k) + o;
    for (let k = 0; k < n; k += 3) { if (flip) idx.push(ix(k), ix(k + 2), ix(k + 1)); else idx.push(ix(k), ix(k + 1), ix(k + 2)); }
    o += Pa.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}
const arenaBlob = new THREE.SphereGeometry(1, 12, 8), arenaLump = new THREE.SphereGeometry(1, 10, 6);
const arenaM4 = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(new V3(x, y, z), new Q().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(sx, sy, sz));

// ----------------------------------------------------------- textures
function floorTexture() {
  const N = arenaHi() ? 2048 : 1024, FX = A.hx, FZ = A.hz + A.gd + 0.4;
  const t = arenaTex(N, N, (g) => arenaDrawFloor(g, N, FX, FZ), false, true);
  t.userData.FX = FX; t.userData.FZ = FZ;
  return t;
}
function arenaDrawFloor(g, N, FX, FZ) {
  const s = A.s, hx = A.hx, hz = A.hz, r = A.r, rc = A.rc, gw = A.gw, gd = A.gd;
  const kx = N / (2 * FX), kz = N / (2 * FZ);
  const world = () => g.setTransform(-kx, 0, 0, -kz, N / 2, N / 2);   // draw in world metres (x, z)
  const rnd = ((seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(97);
  // ice base: team tint at each end, cool centre
  g.setTransform(1, 0, 0, 1, 0, 0);
  const zr = (z) => (FZ - z) / (2 * FZ);
  const base = g.createLinearGradient(0, 0, 0, N);
  base.addColorStop(zr(hz + gd), '#f3995c'); base.addColorStop(zr(hz * 0.8), '#f4ab80'); base.addColorStop(zr(hz * 0.12), '#edbea6'); base.addColorStop(0.5, '#c8d8ec');
  base.addColorStop(zr(-hz * 0.12), '#9ccaf2'); base.addColorStop(zr(-hz * 0.8), '#74b2ef'); base.addColorStop(zr(-hz - gd), '#5c9de8');
  g.fillStyle = base; g.fillRect(0, 0, N, N);
  world();
  // broad glossy sheen bands, soft polish blotches and swirls
  for (let i = 0; i < 7; i++) {
    const x = (rnd() * 2 - 1) * hx, w = 3 + rnd() * 6, gr = g.createLinearGradient(x - w, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${0.06 + rnd() * 0.06})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.save(); g.translate(x, 0); g.transform(1, 0, 0.55, 1, 0, 0); g.translate(-x, 0); g.fillStyle = gr; g.fillRect(x - w, -FZ, 2 * w, 2 * FZ); g.restore();
  }
  for (let i = 0; i < 70; i++) {
    const x = (rnd() * 2 - 1) * hx, z = (rnd() * 2 - 1) * hz, rr = 3 + rnd() * 8;
    const gr = g.createRadialGradient(x, z, 0, x, z, rr);
    gr.addColorStop(0, rnd() < 0.6 ? 'rgba(255,255,255,0.13)' : 'rgba(40,110,190,0.07)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x - rr, z - rr, rr * 2, rr * 2);
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < 46; i++) {
    const x = (rnd() * 2 - 1) * hx * 0.9, z = (rnd() * 2 - 1) * hz * 0.9, rr = 4 + rnd() * 12, a = rnd() * 6.3;
    g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 0.1 + rnd() * 0.08;
    g.beginPath(); g.arc(x, z, rr, a, a + 0.5 + rnd() * 1.2); g.stroke();
  }
  // frozen-in bubbles and frost specks
  for (let i = 0; i < 1400; i++) {
    const x = (rnd() * 2 - 1) * hx, z = (rnd() * 2 - 1) * (hz + gd), rr = 0.05 + rnd() * 0.12;
    g.fillStyle = rnd() < 0.75 ? 'rgba(255,255,255,0.4)' : 'rgba(60,120,190,0.14)'; g.beginPath(); g.arc(x, z, rr, 0, Math.PI * 2); g.fill();
  }
  // frost cracks
  for (let i = 0; i < 30; i++) {
    let x = (rnd() * 2 - 1) * (hx - 5), z = (rnd() * 2 - 1) * (hz - 5);
    if (Math.hypot(x, z) < 8 * s) continue;
    const pts = [[x, z]], br = []; let a = rnd() * 6.3;
    for (let k = 0; k < 7 + rnd() * 6; k++) { a += (rnd() - 0.5) * 1.2; x += Math.cos(a) * (0.5 + rnd()); z += Math.sin(a) * (0.5 + rnd()); pts.push([x, z]); }
    for (let b = 2; b < pts.length - 1; b += 3) { const ba = rnd() * 6.3, bl = 0.6 + rnd() * 1.2; br.push([pts[b][0], pts[b][1], pts[b][0] + Math.cos(ba) * bl, pts[b][1] + Math.sin(ba) * bl]); }
    const draw = (w, c, o) => {
      g.strokeStyle = c; g.lineWidth = w; g.beginPath(); pts.forEach(([px, pz], k) => (k ? g.lineTo(px + o, pz + o) : g.moveTo(px + o, pz + o)));
      for (const [ax, az, bx, bz] of br) { g.moveTo(ax + o, az + o); g.lineTo(bx + o, bz + o); }
      g.stroke();
    };
    draw(0.16, 'rgba(40,90,160,0.13)', 0.05);
    draw(0.08, 'rgba(255,255,255,0.5)', 0);
  }
  // big faint snowflake stencils
  for (const [x, z] of [[-24, -16], [24, 16], [22, -34], [-22, 34]]) arenaFlake(g, x * s, z * s, 4.2 * s, 'rgba(255,255,255,0.16)', 0.42);
  // goal-end team areas
  for (const sg of [-1, 1]) {
    const c = sg > 0 ? '255,138,31' : '47,140,255', z0 = sg * (hz - r - 1.6), bw = gw + 5.5 * s, bd = 11 * s;
    const gr = g.createLinearGradient(0, z0, 0, z0 - sg * bd);
    gr.addColorStop(0, `rgba(${c},0.2)`); gr.addColorStop(1, `rgba(${c},0.05)`);
    g.fillStyle = gr; g.fillRect(-bw, Math.min(z0, z0 - sg * bd), 2 * bw, bd);
    // goal interior: deeper tint with a soft net-shadow grid
    g.fillStyle = `rgba(${c},0.42)`; g.fillRect(-gw, sg > 0 ? hz : -hz - gd, 2 * gw, gd);
    g.strokeStyle = 'rgba(27,29,58,0.13)'; g.lineWidth = 0.1; g.beginPath();
    for (let x = -gw; x <= gw + 0.01; x += 0.7) { g.moveTo(x, sg * hz); g.lineTo(x, sg * (hz + gd)); }
    for (let z = 0; z <= gd; z += 0.7) { g.moveTo(-gw, sg * (hz + z)); g.lineTo(gw, sg * (hz + z)); }
    g.stroke();
  }
  // snow drifting in at the foot of the walls (painted, the ramp itself is snow)
  const edge = perimeter().map((pt) => ({ x: pt.x - pt.nx * r, z: pt.z - pt.nz * r, nx: pt.nx, nz: pt.nz, m: Math.abs(pt.z) > hz - 1 && Math.abs(pt.x) < gw - 0.01 }));
  const edgePath = () => {
    g.beginPath();
    edge.forEach((p, i) => { const q = edge[(i + 1) % edge.length]; if (p.m || q.m) return; g.moveTo(p.x, p.z); g.lineTo(q.x, q.z); });
  };
  for (let k = 8; k >= 1; k--) { edgePath(); g.strokeStyle = `rgba(240,248,255,${0.07 + (8 - k) * 0.012})`; g.lineWidth = k * 0.5; g.stroke(); }
  let acc = 0;
  edge.forEach((p, i) => {
    const q = edge[(i + 1) % edge.length]; if (p.m || q.m) return;
    const len = Math.hypot(q.x - p.x, q.z - p.z);
    for (; acc < len; acc += 0.9 + rnd() * 0.9) {
      const t = acc / len, x = p.x + (q.x - p.x) * t, z = p.z + (q.z - p.z) * t, rr = 0.35 + rnd() * 0.45;
      g.fillStyle = 'rgba(70,120,190,0.16)'; g.beginPath(); g.arc(x - p.nx * 0.25, z - p.nz * 0.25, rr, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(246,251,255,0.92)'; g.beginPath(); g.arc(x - p.nx * 0.1, z - p.nz * 0.1, rr, 0, Math.PI * 2); g.fill();
    }
    acc -= len;
  });
  // field markings: white with a soft ink edge
  const line = (path, w = 0.42) => {
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = 'rgba(27,29,58,0.22)'; g.lineWidth = w + 0.3; path(); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = w; path(); g.stroke();
  };
  const bi = r + 1.6, ix = hx - bi, iz = hz - bi, ir = rc - bi;
  line(() => {
    g.beginPath(); g.moveTo(gw, iz); g.lineTo(ix - ir, iz); g.arc(ix - ir, iz - ir, ir, Math.PI / 2, 0, true); g.lineTo(ix, -iz + ir);
    g.arc(ix - ir, -iz + ir, ir, 0, -Math.PI / 2, true); g.lineTo(gw, -iz); g.moveTo(-gw, -iz); g.lineTo(-ix + ir, -iz);
    g.arc(-ix + ir, -iz + ir, ir, -Math.PI / 2, -Math.PI, true); g.lineTo(-ix, iz - ir); g.arc(-ix + ir, iz - ir, ir, Math.PI, Math.PI / 2, true); g.lineTo(-gw, iz);
    for (const sg of [-1, 1]) for (const sx of [-1, 1]) { g.moveTo(sx * gw, sg * iz); g.lineTo(sx * gw, sg * (hz - r)); }
  });
  line(() => { g.beginPath(); g.moveTo(-ix, 0); g.lineTo(ix, 0); });
  line(() => { g.beginPath(); g.arc(0, 0, 9.2 * s, 0, Math.PI * 2); });
  for (const sg of [-1, 1]) {
    const bw = gw + 5.5 * s, bd = 11 * s, aw = gw + 1.8, ad = 4.5 * s;
    line(() => { g.beginPath(); g.moveTo(-bw, sg * iz); g.lineTo(-bw, sg * (iz - bd)); g.lineTo(bw, sg * (iz - bd)); g.lineTo(bw, sg * iz); });
    line(() => { g.beginPath(); g.moveTo(-aw, sg * iz); g.lineTo(-aw, sg * (iz - ad)); g.lineTo(aw, sg * (iz - ad)); g.lineTo(aw, sg * iz); });
    line(() => { g.beginPath(); g.arc(0, sg * (iz - bd), 5 * s, sg > 0 ? Math.PI : 0, sg > 0 ? Math.PI * 2 : Math.PI, false); });
    // goal line in team colour
    g.fillStyle = '#ffffff'; g.fillRect(-gw, sg * hz - 0.4, 2 * gw, 0.8);
    g.fillStyle = sg > 0 ? '#ff8a1f' : '#2f8cff'; g.fillRect(-gw, sg * hz - 0.26, 2 * gw, 0.52);
  }
  for (const [x, z] of KICKOFF) for (const sg of [-1, 1]) {
    g.fillStyle = 'rgba(27,29,58,0.22)'; g.beginPath(); g.arc(sg * x * s, sg * z * s, 0.62, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(sg * x * s, sg * z * s, 0.45, 0, Math.PI * 2); g.fill();
  }
  // centre badge, upright when seen from the blue end
  g.setTransform(kx, 0, 0, kz, N / 2, N / 2);
  arenaBadge(g, 6.2 * s);
  g.setTransform(1, 0, 0, 1, 0, 0);
}
// penguin-face badge (metres, centred, y down)
function arenaBadge(g, R) {
  const ink = ARENA_INK, circ = (x, y, rr) => { g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); };
  g.fillStyle = 'rgba(27,29,58,0.25)'; circ(0.3, 0.4, R + 0.1); g.fill();
  g.fillStyle = '#ffd23f'; circ(0, 0, R); g.fill(); g.lineWidth = 0.3; g.strokeStyle = ink; g.stroke();
  // ring lettering
  const rt = R * 0.87, fs = R * 0.19;
  const arcText = (txt, top) => {
    const n = txt.length, da = 0.255;
    for (let i = 0; i < n; i++) {
      const a = top ? -Math.PI / 2 + (i - (n - 1) / 2) * da : Math.PI / 2 - (i - (n - 1) / 2) * da;
      g.save(); g.translate(Math.cos(a) * rt, Math.sin(a) * rt); g.rotate(top ? a + Math.PI / 2 : a - Math.PI / 2);
      arenaText(g, txt[i], 0, 0, fs, ink, null, 0, 60); g.restore();
    }
  };
  arcText('PENGUIN', true); arcText('LEAGUE', false);
  for (const sx of [-1, 1]) arenaStar(g, sx * rt, 0, R * 0.08, ink);
  // team-split inner disc
  const Ri = R * 0.74;
  g.save(); circ(0, 0, Ri); g.clip();
  g.fillStyle = '#ff8a1f'; g.fillRect(-Ri, -Ri, 2 * Ri, Ri);
  g.fillStyle = '#2f8cff'; g.fillRect(-Ri, 0, 2 * Ri, Ri);
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(-Ri, -0.12, 2 * Ri, 0.24);
  g.restore();
  circ(0, 0, Ri); g.lineWidth = 0.26; g.strokeStyle = ink; g.stroke();
  // penguin face
  const h = Ri * 0.8;
  g.fillStyle = '#2b3050'; circ(0, 0.05 * h, h); g.fill(); g.lineWidth = 0.26; g.stroke();
  g.fillStyle = '#ffffff'; g.beginPath();
  g.ellipse(-h * 0.33, 0.02 * h, h * 0.42, h * 0.5, 0.15, 0, Math.PI * 2); g.ellipse(h * 0.33, 0.02 * h, h * 0.42, h * 0.5, -0.15, 0, Math.PI * 2);
  g.fill(); g.beginPath(); g.ellipse(0, h * 0.32, h * 0.55, h * 0.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,95,168,0.55)'; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * h * 0.52, h * 0.3, h * 0.15, h * 0.09, 0, 0, Math.PI * 2); g.fill(); }
  for (const sx of [-1, 1]) {
    g.fillStyle = ink; g.beginPath(); g.ellipse(sx * h * 0.3, -h * 0.02, h * 0.11, h * 0.15, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; circ(sx * h * 0.3 + h * 0.04, -h * 0.08, h * 0.045); g.fill();
  }
  g.fillStyle = '#ffa41b'; g.strokeStyle = ink; g.lineWidth = 0.16; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(-h * 0.2, h * 0.2); g.quadraticCurveTo(0, h * 0.12, h * 0.2, h * 0.2); g.quadraticCurveTo(h * 0.04, h * 0.5, 0, h * 0.5); g.quadraticCurveTo(-h * 0.04, h * 0.5, -h * 0.2, h * 0.2); g.fill(); g.stroke();
}
function netTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = '#ffffff'; g.lineWidth = 6;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); }
  });
}
// rope net: diamond mesh, 2.4 m per tile, tiles seamlessly
function arenaNetTex() {
  return arenaTex(512, 512, (g, w) => {
    g.clearRect(0, 0, w, w); g.lineCap = 'round';
    const lines = (lw, c) => {
      g.strokeStyle = c; g.lineWidth = lw; g.beginPath();
      for (let k = -4; k <= 8; k++) { g.moveTo(k * 128, 0); g.lineTo(k * 128 + w, w); g.moveTo(k * 128, w); g.lineTo(k * 128 + w, 0); }
      g.stroke();
    };
    lines(17, 'rgba(27,29,58,0.45)'); lines(10, '#f4f9ff');
    g.fillStyle = '#ffffff';
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) for (const o of [0, 64]) { g.beginPath(); g.arc(i * 128 + o, j * 128 + o, 8, 0, Math.PI * 2); g.fill(); }
  }, true);
}
// goal interior padding
function arenaGoalTex(team) {
  const c = team ? ['#b2560f', '#8c430b', '#d06a18'] : ['#1f5fb8', '#174a91', '#2b74d6'];
  return arenaTex(256, 256, (g, w) => {
    g.fillStyle = c[1]; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const gr = g.createLinearGradient(0, j * 128, 0, j * 128 + 128); gr.addColorStop(0, c[2]); gr.addColorStop(1, c[0]);
      g.fillStyle = gr; g.beginPath(); g.roundRect(i * 128 + 6, j * 128 + 6, 116, 116, 26); g.fill();
    }
  }, true);
}
// lower wall: snow ramp, padded team panels, white trim; one tile = 2 panels wide
function arenaWallTex(team, rampLen, vLen, panH, pw) {
  const W = 1024, H = 1024, Lp = rampLen + vLen, kx = W / (2 * pw), ky = H / Lp;
  const C = team ? ['#ff8a1f', '#ffb066', '#e06d10', '#a54a07'] : ['#2f8cff', '#7ab9ff', '#2170dc', '#174b9c'];
  return arenaTex(W, H, (g) => {
    g.setTransform(kx, 0, 0, ky, 0, 0);   // metres: x along the wall, y down from the top rail
    const rnd = ((seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(team ? 11 : 7);
    const yPan = vLen - panH;
    g.fillStyle = '#e9f1fa'; g.fillRect(0, 0, 2 * pw, yPan);
    g.fillStyle = C[0]; g.fillRect(0, yPan * 0.38, 2 * pw, 0.16);
    g.fillStyle = C[3]; g.fillRect(0, yPan - 0.02, 2 * pw, panH + 0.4);
    for (let k = 0; k < 2; k++) {
      const x0 = k * pw + 0.08, w = pw - 0.16, y0 = yPan + 0.08, h = panH + 0.2;
      const cg = g.createLinearGradient(0, y0, 0, y0 + h); cg.addColorStop(0, C[1]); cg.addColorStop(0.28, C[0]); cg.addColorStop(1, C[2]);
      g.fillStyle = cg; g.beginPath(); g.roundRect(x0, y0, w, h, 0.5); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.roundRect(x0 + 0.35, y0 + 0.12, w - 0.7, 0.2, 0.1); g.fill();
      // sticker: white disc with a fish or a snowflake
      const cx = x0 + w / 2, cy = y0 + panH * 0.5, sr = Math.min(0.62, panH * 0.3);
      g.fillStyle = 'rgba(27,29,58,0.25)'; g.beginPath(); g.arc(cx + 0.06, cy + 0.08, sr, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f7fbff'; g.beginPath(); g.arc(cx, cy, sr, 0, Math.PI * 2); g.fill(); g.lineWidth = 0.07; g.strokeStyle = ARENA_INK; g.stroke();
      if (k === 0) arenaFishIcon(g, cx + 0.04, cy, sr * 1.15, '#ffb703', '#ff7a1a');
      else arenaFlake(g, cx, cy, sr * 0.68, C[2], 0.11);
    }
    // snow ramp with a lumpy drift edge spilling over the panel bottoms
    const sg = g.createLinearGradient(0, vLen, 0, Lp); sg.addColorStop(0, '#d8e9f8'); sg.addColorStop(0.5, '#e6f1fb'); sg.addColorStop(1, '#eef6fd');
    g.fillStyle = sg; g.fillRect(0, vLen, 2 * pw, rampLen);
    const n = Math.round(2 * pw / 0.75), bumps = [];
    for (let i = 0; i < n; i++) bumps.push([(i + 0.5) * 2 * pw / n + (rnd() - 0.5) * 0.25, 0.26 + rnd() * 0.2]);
    for (const [col, oy] of [['rgba(23,52,110,0.22)', 0.1], ['#dceaf8', 0]]) {
      g.fillStyle = col; g.beginPath();
      for (const [x, rr] of bumps) for (const o of [-2 * pw, 0, 2 * pw]) { g.moveTo(x + o + rr, vLen + 0.05 + oy); g.arc(x + o, vLen + 0.05 + oy, rr, 0, Math.PI * 2); }
      g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (const [x, rr] of bumps) { g.beginPath(); g.ellipse(x - rr * 0.25, vLen - rr * 0.35, rr * 0.35, rr * 0.18, -0.3, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(120,165,215,0.18)';
    for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(rnd() * 2 * pw, vLen + 0.6 + rnd() * (rampLen - 0.8), 0.3 + rnd() * 0.5, 0.05, 0, 0, Math.PI * 2); g.fill(); }
  }, true);
}
// LED ribbon: top half = ticker, bottom half = goal celebration; ink border rows feed the frame lips
function arenaLedTex() {
  const W = 2048, H = 256;
  return arenaTex(W, H, (g) => {
    g.fillStyle = ARENA_INK; g.fillRect(0, 0, W, H);
    for (const [y0, goal] of [[0, false], [128, true]]) {
      const gr = g.createLinearGradient(0, y0 + 10, 0, y0 + 118);
      gr.addColorStop(0, '#181d48'); gr.addColorStop(0.5, '#262e6e'); gr.addColorStop(1, '#181d48');
      g.fillStyle = gr; g.fillRect(0, y0 + 10, W, 108);
      g.save(); g.beginPath(); g.rect(0, y0 + 10, W, 108); g.clip();
      const cy = y0 + 64;
      g.shadowBlur = 16;
      if (!goal) {
        const items = [
          [150, (x) => { g.shadowColor = '#ffb703'; arenaFishIcon(g, x + 75, cy, 82, '#ffb703', '#ff7a1a', 0.07); }],
          [560, (x) => { g.shadowColor = '#ffd23f'; arenaText(g, 'PENGUIN LEAGUE', x + 280, cy + 5, 78, '#ffd23f', null, 560); }],
          [90, (x) => { g.shadowColor = '#8fe3ff'; arenaFlake(g, x + 45, cy, 34, '#8fe3ff', 7); }],
          [210, (x) => { g.shadowColor = '#2f8cff'; g.fillStyle = '#2f8cff'; g.beginPath(); g.roundRect(x, cy - 38, 210, 76, 38); g.fill(); arenaText(g, 'BLUE', x + 105, cy + 4, 58, '#ffffff', null, 180); }],
          [80, (x) => { g.shadowColor = '#ffffff'; arenaText(g, 'VS', x + 40, cy + 4, 50, '#ffffff'); }],
          [270, (x) => { g.shadowColor = '#ff8a1f'; g.fillStyle = '#ff8a1f'; g.beginPath(); g.roundRect(x, cy - 38, 270, 76, 38); g.fill(); arenaText(g, 'ORANGE', x + 135, cy + 4, 58, '#ffffff', null, 240); }],
          [90, (x) => { g.shadowColor = '#ff5fa8'; arenaStar(g, x + 45, cy, 36, '#ff5fa8'); }],
          [440, (x) => { g.shadowColor = '#ff5fa8'; arenaText(g, 'FISH = BOOST!', x + 220, cy + 5, 70, '#ff8cc4', null, 440); }],
        ];
        const tot = items.reduce((a, it) => a + it[0], 0), gap = (W - tot) / items.length;
        let x = gap / 2;
        for (const [w, fn] of items) { fn(x); x += w + gap; }
      } else {
        const cols = ['#ffd23f', '#ff5fa8', '#59d8ff', '#ffffff'];
        for (let k = 0; k < 6; k++) {
          const x = (k + 0.5) * W / 6;
          g.shadowColor = cols[k % 4]; arenaText(g, 'GOAL!', x, cy + 6, 92, cols[k % 4]);
          g.shadowColor = '#ffd23f'; arenaStar(g, x + W / 12, cy, 22, '#ffd23f');
        }
      }
      g.restore();
    }
  }, true, true);
}
// upper glass: frosty bottom edge, faint tint, two cartoon shine streaks per panel
function arenaGlassTex(gLen, cLen, pw) {
  const W = 512, H = 512, GL = gLen + cLen, kx = W / pw, ky = H / GL;
  const t = arenaTex(W, H, (g) => {
    g.clearRect(0, 0, W, H);
    g.setTransform(kx, 0, 0, ky, 0, 0);   // metres: x across the panel, y down from the ceiling edge
    const gr = g.createLinearGradient(0, 0, 0, GL);
    gr.addColorStop(0, 'rgba(214,236,255,0.18)'); gr.addColorStop(cLen / GL, 'rgba(220,240,255,0.06)'); gr.addColorStop(1, 'rgba(225,242,255,0.035)');
    g.fillStyle = gr; g.fillRect(0, 0, pw, GL);
    const streak = (x, w, a) => {
      const y0 = cLen + 2.2, y1 = GL - 2.2, sl = 3.2;
      const sg = g.createLinearGradient(x, 0, x + w, 0); sg.addColorStop(0, `rgba(255,255,255,0)`); sg.addColorStop(0.5, `rgba(255,255,255,${a})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sg; g.beginPath(); g.moveTo(x + sl, y0); g.lineTo(x + sl + w, y0); g.lineTo(x + w, y1); g.lineTo(x, y1); g.closePath(); g.fill();
    };
    streak(pw * 0.2, 0.9, 0.09); streak(pw * 0.2 + 1.2, 0.35, 0.07);
    // frost along the rail with a scalloped edge
    const fg = g.createLinearGradient(0, GL - 1.1, 0, GL);
    fg.addColorStop(0, 'rgba(235,246,255,0.25)'); fg.addColorStop(1, 'rgba(235,246,255,0.62)');
    g.fillStyle = fg; g.beginPath(); g.moveTo(0, GL);
    const n = Math.max(2, Math.round(pw / 0.7));
    for (let i = 0; i <= n; i++) { const x = i * pw / n; g.lineTo(x, GL - 0.75 - (i % 2 ? 0.18 : 0)); }
    g.lineTo(pw, GL); g.closePath(); g.fill();
  }, true);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
// aisles: one every ~13 m of wall line, radial through the bowl
const ARENA_AISLE_W = 1.4, arenaAisleN = (L) => Math.max(8, Math.round(L / 13));
// (x, z) -> true when the point lies in a stand aisle (offered to the crowd so nobody sits on the stairs)
function arenaAisleFn(perim, cum) {
  const L = cum[cum.length - 1], n = arenaAisleN(L), as = [];
  for (let k = 0; k < n; k++) as.push(arenaAt(perim, cum, k * L / n));
  return (x, z) => as.some((a) => { const dx = x - a.x, dz = z - a.z; return dx * a.nx + dz * a.nz > 0 && Math.abs(dx * a.nz - dz * a.nx) < ARENA_AISLE_W / 2 + 0.25; });
}
// stands: seat sections, aisles, parapet; u = whole perimeter, v = profile
function arenaStandTex(perim, cum, segs, Ls) {
  const hi = arenaHi(), W = hi ? 4096 : 2048, Hc = hi ? 1024 : 512, L = cum[cum.length - 1];
  const kx = W / L, ky = Hc / Ls, nS = arenaAisleN(L), sp = L / nS, aw = ARENA_AISLE_W;
  const side = ['#ff5fa8', '#ffd23f', '#35c6f0', '#f2f6fb', '#ff5fa8', '#7fd3ff'];
  const t = arenaTex(W, Hc, (g) => {
    g.setTransform(kx, 0, 0, ky, 0, 0);   // metres: x = arc length along the wall, y = profile arc length
    let a = 0;
    for (const s of segs) {
      s.a0 = a; s.a1 = a + s.len; a = s.a1;
      g.fillStyle = { front: '#2b3050', cap: '#f4f8fc', pback: '#2b3050', tread: '#c6d3e6', riser: '#7d92b6', walk: '#c6d3e6' }[s.type];
      g.fillRect(0, s.a0, L, s.len + 0.05);
    }
    const f = segs[0]; g.fillStyle = '#ffd23f'; g.fillRect(0, f.a1 - 0.55, L, 0.22);
    for (let k = 0; k < nS; k++) {
      const sa = k * sp + aw / 2, sb = (k + 1) * sp - aw / 2, q = arenaAt(perim, cum, (sa + sb) / 2);
      const end = Math.abs(q.z) > A.hz - A.rc * 0.45;
      const col = end ? (q.z < 0 ? ['#2f8cff', '#5fa9ff'][k % 2] : ['#ff8a1f', '#ffa850'][k % 2]) : side[k % side.length];
      const dark = arenaShade(col, 0.72), n = Math.max(1, Math.floor((sb - sa) / 0.62)), w = (sb - sa) / n;
      for (const s of segs) {
        if (s.type === 'tread') { g.fillStyle = dark; for (let i = 0; i < n; i++) g.fillRect(sa + i * w + 0.06, s.a0 + s.len * 0.52, w - 0.12, s.len * 0.4); }
        else if (s.type === 'riser') {
          g.fillStyle = col; for (let i = 0; i < n; i++) g.fillRect(sa + i * w + 0.06, s.a0, w - 0.12, s.len * 0.74);
          g.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < n; i++) g.fillRect(sa + i * w + 0.06, s.a0 + s.len * 0.6, w - 0.12, s.len * 0.12);
        }
      }
    }
    for (let k = 0; k <= nS; k++) {
      const x0 = k * sp - aw / 2;
      for (const s of segs) if (s.type === 'tread' || s.type === 'riser' || s.type === 'walk') {
        g.fillStyle = '#e3eaf4'; g.fillRect(x0, s.a0, aw, s.len);
        g.fillStyle = '#b3c2d8'; g.fillRect(x0, s.a0 + s.len * 0.5 - 0.04, aw, 0.08);
        if (s.type === 'tread') { g.fillStyle = '#ffd23f'; g.fillRect(x0, s.a0, aw, 0.12); g.fillRect(x0, s.a0 + s.len * 0.5, aw, 0.1); }
      }
    }
  });
  return t;
}
// banners along the top of the stands (inner face = top 3/4, cap + outer facade = bottom 1/4)
function arenaBannerTex() {
  const W = 2048, H = 512;
  return arenaTex(W, H, (g) => {
    g.fillStyle = '#dce8f5'; g.fillRect(0, 0, W, 384);
    g.fillStyle = '#c9d8ea'; for (let x = 0; x < W; x += 128) g.fillRect(x, 0, 6, 384);
    const B = [['GO BLUE!', '#2f8cff', '#ffffff'], ['PENGUIN LEAGUE', '#2b3050', '#ffd23f'], ['ORANGE CRUSH!', '#ff8a1f', '#ffffff'], ['FISH = BOOST', '#ff5fa8', '#ffffff']];
    B.forEach(([txt, bg, fg], k) => {
      const x = k * 512 + 24, y = 42, w = 464, h = 250;
      g.fillStyle = 'rgba(27,29,58,0.3)'; g.beginPath(); g.roundRect(x + 10, y + 12, w, h, 34); g.fill();
      g.fillStyle = bg; g.beginPath(); g.roundRect(x, y, w, h, 34); g.fill(); g.lineWidth = 12; g.strokeStyle = ARENA_INK; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.roundRect(x + 24, y + 16, w - 48, 40, 20); g.fill();
      if (k === 3) { arenaFishIcon(g, x + 96, y + h / 2, 92, '#ffd23f', '#ff8a1f', 0.08); arenaText(g, txt, x + 290, y + h / 2 + 8, 76, fg, ARENA_INK, 300); }
      else arenaText(g, txt, x + w / 2, y + h / 2 + 8, k === 1 ? 76 : 98, fg, ARENA_INK, w - 50);
    });
    g.fillStyle = '#f4f8fc'; g.fillRect(0, 384, W, 26);
    g.fillStyle = '#c7d5e8'; g.fillRect(0, 410, W, 102);
    g.fillStyle = '#b3c4dc'; for (let x = 0; x < W; x += 64) g.fillRect(x, 410, 22, 102);
  }, true, true);
}
function arenaFlagTex() {
  return arenaTex(128, 64, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#d9dde6'; g.fillRect(0, 0, 10, 64); g.fillRect(0, 54, 128, 10);
    arenaFishIcon(g, 70, 30, 34, '#eef0f5', '#e3e6ee', 0.06);
  });
}
function arenaGlowTex() {
  return arenaTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
}
function arenaSparkTex() {
  return arenaTex(64, 64, (g) => {
    g.fillStyle = '#ffffff'; g.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? 7 : 30; g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr); }
    g.closePath(); g.fill();
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 14); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
}

// ----------------------------------------------------------- build
function buildArena() {
  if (arenaGroup) {
    scene.remove(arenaGroup);
    const keep = [arenaBlob, arenaLump, ...Object.values(GEO)];
    arenaGroup.traverse((o) => { if (o.geometry && !keep.includes(o.geometry)) o.geometry.dispose(); });
  }
  for (const x of arenaFX.trash) x.dispose();
  arenaFX.trash = []; arenaFX.glow = [];
  for (const pv of padViews) scene.remove(pv.g);
  padViews = [];
  const grp = new THREE.Group(); arenaGroup = grp; scene.add(grp);
  const own = (x) => { arenaFX.trash.push(x); return x; };
  const perim = perimeter(), P = perim.length;
  const r = A.r, H = A.H, SEAM = Math.max(7.3, A.gh + 1.1), hi = arenaHi();
  const cum0 = arenaCum(perim, 0), L = cum0[P];
  const colsAll = [...perim.keys(), 0];

  // ---- floor: one polished-ice mesh that also covers the goal boxes (no stacked decals)
  const ftex = own(floorTexture()), FX = ftex.userData.FX, FZ = ftex.userData.FZ;
  const mouth = (q) => Math.abs(q.z) > A.hz - 1 && Math.abs(q.x) < A.gw - 0.01;
  const fpts = [];
  perim.forEach((pt, i) => {
    if (mouth(pt)) return;
    const x = pt.x - pt.nx * r, z = pt.z - pt.nz * r;
    fpts.push(new THREE.Vector2(x, -z));
    if (mouth(perim[(i + 1) % P])) { const ez = Math.sign(z) * (A.hz + A.gd); fpts.push(new THREE.Vector2(x, -ez), new THREE.Vector2(-x, -ez)); }
  });
  const fgeo = new THREE.ShapeGeometry(new THREE.Shape(fpts));
  fgeo.rotateX(-Math.PI / 2);
  const fp = fgeo.attributes.position, fuv = fgeo.attributes.uv;
  for (let i = 0; i < fp.count; i++) fuv.setXY(i, (FX - fp.getX(i)) / (2 * FX), (fp.getZ(i) + FZ) / (2 * FZ));
  const fmat = own(toon(0xffffff, { map: ftex }));
  if ('roughness' in fmat) { fmat.roughness = 0.3; fmat.metalness = 0; }
  // keep the crisp sun glint but tame sky reflections, so the far ice keeps its team colour
  const fobc = fmat.onBeforeCompile;
  fmat.onBeforeCompile = (sh, rd) => { fobc.call(fmat, sh, rd); sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n\treflectedLight.indirectSpecular *= 0.5;'); };
  const floor = new THREE.Mesh(fgeo, fmat);
  floor.receiveShadow = true; grp.add(floor);

  // ---- lower wall: snow ramp + padded team panels, split at the halfway line (blue -Z, orange +Z)
  const zi = perim.map((pt, i) => (Math.abs(pt.z) < 1e-6 ? i : -1)).filter((i) => i >= 0);
  const iL = zi.find((i) => perim[i].x < 0), iR = zi.find((i) => perim[i].x > 0);
  const run = (a, b) => { const c = []; for (let i = a; ; i = (i + 1) % P) { c.push(i); if (i === b) break; } return c; };
  const nPair = Math.max(1, Math.round(L / 2 / 12.8)), pw = L / 2 / (2 * nPair);
  const rampLen = Math.PI * r / 2, vLen = SEAM - r, Lp = rampLen + vLen;
  const ledY0 = SEAM - 1.5, ledY1 = SEAM - 0.2;
  const wprof = [];
  for (let k = 0; k <= 8; k++) { const ph = (Math.PI / 2) * (1 - k / 8); wprof.push({ c: -r + r * Math.cos(ph), y: r - r * Math.sin(ph), v: rampLen * k / 8 / Lp }); }
  wprof.push({ c: 0, y: A.gh, v: (rampLen + A.gh - r) / Lp }, { c: 0, y: SEAM, v: 1 });
  const skipGoal = (x, y, z) => Math.abs(z) > A.hz - r - 0.05 && Math.abs(x) < A.gw && y < A.gh;
  for (const [team, cols] of [[0, run(iL, iR)], [1, run(iR, iL)]]) {
    const geo = arenaSweep(perim, wprof, cols, arenaUs(perim, cols, 0, 2 * pw), skipGoal);
    const tex = own(arenaWallTex(team, rampLen, vLen, ledY0 - r, pw)); tex.wrapT = THREE.ClampToEdgeWrapping;
    const wall = new THREE.Mesh(geo, own(toon(0xffffff, { map: tex })));
    wall.receiveShadow = true; grp.add(wall);
  }
  // bright curb where the ice meets the wall ramp, so the edge of the rink reads clearly (open at the goal mouths)
  const curbRuns = [[]];
  for (const pt of perim) {
    if (Math.abs(pt.z) > A.hz - 0.01 && Math.abs(pt.x) < A.gw + 0.4) { if (curbRuns[curbRuns.length - 1].length) curbRuns.push([]); continue; }
    curbRuns[curbRuns.length - 1].push(new V3(pt.x - pt.nx * (r - 0.18), 0.15, pt.z - pt.nz * (r - 0.18)));
  }
  if (curbRuns.length > 1 && curbRuns[curbRuns.length - 1].length) curbRuns[0] = curbRuns.pop().concat(curbRuns[0]);
  for (const cr of curbRuns) if (cr.length > 1) grp.add(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cr, false), cr.length * 4, 0.26, 10, false), 0xffd23f, { o: 0.055, cast: false }));
  // LED ribbon around the top of the wall (proud of the wall by 0.14 m, ink frame lips)
  const ledTex = own(arenaLedTex()); arenaFX.led = ledTex;
  const ledRep = Math.max(1, Math.round(L / 24.7)), lv = (px) => 0.5 + px / 256;
  const lprof = [
    { c: 0.03, y: ledY0 - 0.08, v: lv(3) }, { c: -0.14, y: ledY0, v: lv(8), brk: true },
    { c: -0.14, y: ledY0, v: lv(11) }, { c: -0.14, y: ledY1, v: lv(117), brk: true },
    { c: -0.14, y: ledY1, v: lv(120) }, { c: 0.03, y: ledY1 + 0.08, v: lv(125) },
  ];
  const led = new THREE.Mesh(arenaSweep(perim, lprof, colsAll, arenaUs(perim, colsAll, 0, L / ledRep), (x, y, z) => Math.abs(z) > A.hz - 1 && Math.abs(x) < A.gw),
    own(new THREE.MeshBasicMaterial({ map: ledTex, color: new THREE.Color(1.25, 1.25, 1.25) })));
  grp.add(led);
  // top rail with snow lumps
  const railPts = perim.map((pt) => new V3(pt.x - pt.nx * 0.05, SEAM, pt.z - pt.nz * 0.05));
  grp.add(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts, true), 460, 0.32, 10, true), 0xffd23f, { o: 0.05, cast: false }));
  const lumps = [], rr0 = ((seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(5);
  for (let s = 0; s < L; s += 0.75 + rr0() * 0.7) {
    if (rr0() < 0.18) continue;
    const q = arenaAt(perim, cum0, s), off = 0.05 + (rr0() - 0.5) * 0.12;
    lumps.push([q.x - q.nx * off, SEAM + 0.22 + rr0() * 0.05, q.z - q.nz * off, Math.atan2(-q.nz, q.nx) + Math.PI / 2, 0.38 + rr0() * 0.4, 0.18 + rr0() * 0.12]);
  }
  const snowI = new THREE.InstancedMesh(arenaLump, toon(0xf2f8ff), lumps.length);
  const m4 = new THREE.Matrix4(), q4 = new Q(), v4 = new V3(), s4 = new V3();
  lumps.forEach((l, i) => { snowI.setMatrixAt(i, m4.compose(v4.set(l[0], l[1], l[2]), q4.setFromAxisAngle(UP, l[3]), s4.set(l[4], l[5], 0.36))); });
  grp.add(snowI);

  // ---- upper glass (frosty, transparent, drawn before other transparents) + chunky frame behind it
  const gLen = H - r - SEAM, cLen = Math.PI * r / 2, GL = gLen + cLen;
  const gprof = [{ c: 0, y: SEAM, v: 0 }, { c: 0, y: H - r, v: gLen / GL }];
  for (let k = 1; k <= 8; k++) { const ph = (Math.PI / 2) * (k / 8); gprof.push({ c: -r + r * Math.cos(ph), y: H - r + r * Math.sin(ph), v: (gLen + cLen * k / 8) / GL }); }
  const gus = arenaUs(perim, colsAll, 0, pw).map((u) => u - cum0[iL] / pw);
  const glass = new THREE.Mesh(arenaSweep(perim, gprof, colsAll, gus),
    own(new THREE.MeshBasicMaterial({ map: own(arenaGlassTex(gLen, cLen, pw)), transparent: true, depthWrite: false })));
  glass.renderOrder = -1; grp.add(glass);
  const mo = 0.2, mpath = [new V3(mo, SEAM, 0), new V3(mo, (SEAM + H - r) / 2, 0), new V3(mo, H - r, 0)];
  for (let k = 1; k <= 6; k++) { const ph = (Math.PI / 2) * (k / 6); mpath.push(new V3(-r + (r + mo) * Math.cos(ph), H - r + (r + mo) * Math.sin(ph), 0)); }
  const mgeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mpath, false, 'centripetal'), 28, 0.115, 6, false);
  const frame = [];
  for (let k = 0; k < 4 * nPair; k++) { const q = arenaAt(perim, cum0, cum0[iL] + k * pw); frame.push([mgeo, arenaM4(q.x, 0, q.z, 0, Math.atan2(-q.nz, q.nx)), 0xeef5fd]); }
  for (const [c, y, rad] of [[0.2, H - r, 0.13], [-r, H + 0.16, 0.2]]) frame.push([new THREE.TubeGeometry(new THREE.CatmullRomCurve3(perim.map((pt) => new V3(pt.x + pt.nx * c, y, pt.z + pt.nz * c)), true), 400, rad, 6, true), new THREE.Matrix4(), 0xeef5fd]);
  grp.add(new THREE.Mesh(arenaMerge(frame), own(toon(0xffffff, { vertexColors: true }))));

  // ---- goals
  const netTex = own(arenaNetTex());
  for (const s of [-1, 1]) {
    const team = s > 0 ? 1 : 0, tc = TEAM_HEX[team], gw = A.gw, gh = A.gh, gd = A.gd;
    const Z = (c) => s * (A.hz + c);
    // frame: one chunky rounded tube that hugs the cut ramp, runs up the posts and across the bar
    const fx = gw + 0.3, top = gh + 0.3, cR = 1.15, fr = [], st = [], so = 0.36;
    const add = (x, c, y, nc, ny) => { fr.push(new V3(x, y, Z(c))); st.push(new V3(x, y + ny * so, Z(c + nc * so))); };
    const side = (sx, up) => {
      const seq = [];
      seq.push([sx * fx, -r - 0.25, -0.55, -0.5, 0.85]);
      for (let k = 0; k <= 8; k++) { const ph = (Math.PI / 2) * (1 - k / 8); seq.push([sx * fx, -r + r * Math.cos(ph), r - r * Math.sin(ph), -Math.cos(ph), Math.sin(ph)]); }
      for (let k = 1; k <= 4; k++) seq.push([sx * fx, 0, r + (top - cR - r) * k / 4, -1, 0]);
      for (let k = 1; k <= 5; k++) { const a = (Math.PI / 2) * (k / 6); seq.push([sx * (fx - cR + cR * Math.cos(a)), 0, top - cR + cR * Math.sin(a), -1, 0]); }
      return up ? seq : seq.reverse();
    };
    for (const p of side(-1, true)) add(...p);
    for (let k = 0; k <= 8; k++) add(-(fx - cR) + 2 * (fx - cR) * k / 8, 0, top, -1, 0);
    for (const p of side(1, false)) add(...p);
    const fcurve = new THREE.CatmullRomCurve3(fr, false, 'centripetal'), scurve = new THREE.CatmullRomCurve3(st, false, 'centripetal');
    const fmesh = mk(new THREE.TubeGeometry(fcurve, 320, 0.42, 14, false), tc, { o: 0.05 });
    fmesh.receiveShadow = true; grp.add(fmesh);
    const lightCol = new THREE.Color(team ? 0xffc78a : 0x9fd6ff).multiplyScalar(2.2);   // HDR: blooms
    const stripMat = own(new THREE.MeshBasicMaterial({ color: lightCol.clone() }));
    arenaFX.glow.push({ mat: stripMat, base: lightCol });
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(scurve, 320, 0.13, 8, false), stripMat));
    // light bar inside along the back top edge
    const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 2 * gw - 1.2, 4, 10), stripMat);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, gh - 0.45, Z(gd - 0.35)); grp.add(bar);
    // interior: padded backing (pushed back with polygonOffset) and a rope net 0.15 m in front of it
    const plane = (w, h, x, y, z, rx, ry, uvs) => { const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / uvs, uv.getY(i) * h / uvs); g.applyMatrix4(arenaM4(x, y, z, rx, ry)); return g; };
    const box = (ins, uvs) => [
      plane(2 * gw, gh, 0, gh / 2, Z(gd - ins), 0, s > 0 ? Math.PI : 0, uvs),
      plane(gd, gh, -gw + ins, gh / 2, Z(gd / 2), 0, Math.PI / 2, uvs),
      plane(gd, gh, gw - ins, gh / 2, Z(gd / 2), 0, -Math.PI / 2, uvs),
      plane(2 * gw, gd, 0, gh - ins, Z(gd / 2), Math.PI / 2, 0, uvs),
    ];
    const join = (gs) => { const parts = gs.map((g) => [g, new THREE.Matrix4(), 0xffffff]); const m = arenaMerge(parts); const uv = []; for (const g of gs) uv.push(...g.attributes.uv.array); m.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return m; };
    const back = new THREE.Mesh(join(box(0, 2.6)), own(toon(0xffffff, { map: own(arenaGoalTex(team)), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 })));
    back.receiveShadow = true; grp.add(back);
    const net = new THREE.Mesh(join(box(0.15, 2.4)), own(new THREE.MeshBasicMaterial({ map: netTex, color: 0xe6eef8, transparent: true, depthWrite: false, side: THREE.DoubleSide })));
    net.renderOrder = 1; grp.add(net);
    // ramp cut faces at the posts
    for (const sx of [-1, 1]) {
      const sh = new THREE.Shape(); sh.moveTo(0, 0);
      for (let k = 0; k <= 8; k++) { const ph = (Math.PI / 2) * (k / 8); sh.lineTo(-r + r * Math.sin(ph), r - r * Math.cos(ph)); }
      sh.lineTo(0, 0);
      const cap = new THREE.Mesh(new THREE.ShapeGeometry(sh), own(toon(team ? 0xe9711a : 0x2a78e0, { side: THREE.DoubleSide })));
      cap.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; cap.position.set(sx * gw, 0, Z(0)); grp.add(cap);
    }
  }

  // ---- stands: parapet, stepped seating bowl, walkway; banner wall + flags on top
  const c0 = 0.6, D = 2.6, RS = 1.5, NT = 9, yT0 = SEAM + 1.2;
  const segs = [];
  const seg = (ca, ya, cb, yb, type) => segs.push({ ca, ya, cb, yb, type, len: Math.hypot(cb - ca, yb - ya) });
  seg(c0, SEAM - 0.4, c0, yT0 + 0.6, 'front');   // starts above the goal boxes
  seg(c0, yT0 + 0.6, c0 + 0.5, yT0 + 0.6, 'cap'); seg(c0 + 0.5, yT0 + 0.6, c0 + 0.5, yT0, 'pback');
  let cc = c0 + 0.5;
  const rows = [];
  for (let t = 0; t < NT; t++) {
    const y = yT0 + RS * t;
    rows.push({ off: cc + D / 2, y, depth: D });
    seg(cc, y, cc + D, y, 'tread'); seg(cc + D, y, cc + D, y + RS, 'riser'); cc += D;
  }
  const yTop = yT0 + RS * NT; seg(cc, yTop, cc + 1.6, yTop, 'walk'); cc += 1.6;
  const Ls = segs.reduce((a, sg) => a + sg.len, 0);
  const sprof = []; let acc = 0;
  for (const sg of segs) { sprof.push({ c: sg.ca, y: sg.ya, v: 1 - acc / Ls }); acc += sg.len; sprof.push({ c: sg.cb, y: sg.yb, v: 1 - acc / Ls, brk: true }); }
  const stex = own(arenaStandTex(perim, cum0, segs, Ls));
  const stands = new THREE.Mesh(arenaSweep(perim, sprof, colsAll, cum0.map((x) => x / L)), own(toon(0xffffff, { map: stex })));
  stands.receiveShadow = true; grp.add(stands);
  // chunky handrail on posts along the parapet
  const rc0 = c0 + 0.25, ry = yT0 + 1.15, cumP = arenaCum(perim, rc0), nPost = Math.round(cumP[P] / 3.2);
  const rail = [[new THREE.TubeGeometry(new THREE.CatmullRomCurve3(perim.map((pt) => new V3(pt.x + pt.nx * rc0, ry, pt.z + pt.nz * rc0)), true), 400, 0.13, 8, true), new THREE.Matrix4(), 0xffd23f]];
  const postGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.6, 8);
  for (let k = 0; k < nPost; k++) { const q = arenaAt(perim, cumP, k * cumP[P] / nPost); rail.push([postGeo, arenaM4(q.x + q.nx * rc0, ry - 0.3, q.z + q.nz * rc0), 0xf2f6fb]); }
  grp.add(new THREE.Mesh(arenaMerge(rail), own(toon(0xffffff, { vertexColors: true }))));
  const cumB = arenaCum(perim, cc), LB = cumB[P], nB = Math.max(1, Math.round(LB / 22.5)), wallH = 4.2;
  const bprof = [
    { c: cc, y: yTop - 0.05, v: 0.25 }, { c: cc, y: yTop + wallH, v: 1, brk: true },
    { c: cc, y: yTop + wallH, v: 0.24 }, { c: cc + 0.8, y: yTop + wallH, v: 0.2, brk: true },
    { c: cc + 0.8, y: yTop + wallH, v: 0.19 }, { c: cc + 0.8, y: -1, v: 0.01 },
  ];
  const btex = own(arenaBannerTex()); btex.wrapT = THREE.ClampToEdgeWrapping;
  grp.add(new THREE.Mesh(arenaSweep(perim, bprof, colsAll, arenaUs(perim, colsAll, cc, LB / nB)), own(toon(0xffffff, { map: btex }))));
  buildCrowd(grp, perim, { seam: SEAM, rows, aisle: arenaAisleFn(perim, cum0) });
  // flags on poles along the top of the banner wall
  const nF = Math.max(8, Math.round(LB / 15)), fW = 2.8, fH = 1.7, poleH = 4.4;
  const flagGeo = new THREE.PlaneGeometry(fW, fH, 12, 4); flagGeo.translate(fW / 2, poleH - fH / 2 - 0.1, 0);
  const flagMat = own(toon(0xffffff, { map: own(arenaFlagTex()), side: THREE.DoubleSide }));
  const prevOBC = flagMat.onBeforeCompile;
  flagMat.onBeforeCompile = (sh, rd) => {
    if (prevOBC) prevOBC.call(flagMat, sh, rd);
    sh.uniforms.uFlagT = arenaFX.t;
    sh.vertexShader = 'uniform float uFlagT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float fw = clamp(position.x / ${fW.toFixed(2)}, 0.0, 1.0);
      float fph = uFlagT * 5.0 - position.x * 1.7 + float(gl_InstanceID) * 1.37;
      transformed.z += sin(fph) * 0.32 * fw;
      transformed.y += cos(fph * 0.7) * 0.08 * fw;`);
  };
  const flags = new THREE.InstancedMesh(flagGeo, flagMat, nF);
  const poleGeo = arenaMerge([[new THREE.CylinderGeometry(0.13, 0.17, poleH, 8), arenaM4(0, poleH / 2, 0), 0xe8eef6], [arenaBlob, arenaM4(0, poleH + 0.1, 0, 0, 0, 0, 0.3), 0xffd23f]]);
  const poles = new THREE.InstancedMesh(poleGeo, own(toon(0xffffff, { vertexColors: true })), nF);
  const fcols = [0xff5fa8, 0xffd23f, 0x35c6f0];
  for (let k = 0; k < nF; k++) {
    const q = arenaAt(perim, cumB, (k + 0.5) * LB / nF), cx = cc + 0.4;
    m4.compose(v4.set(q.x + q.nx * cx, yTop + wallH, q.z + q.nz * cx), q4.setFromAxisAngle(UP, Math.atan2(-q.nz, q.nx) + Math.PI / 2), s4.set(1, 1, 1));
    flags.setMatrixAt(k, m4); poles.setMatrixAt(k, m4);
    const endC = Math.abs(q.z) > A.hz * 0.55 ? (q.z < 0 ? 0x2f8cff : 0xff8a1f) : fcols[k % 3];
    flags.setColorAt(k, new THREE.Color(k % 2 ? endC : (q.z < 0 ? 0x2f8cff : 0xff8a1f)));
  }
  grp.add(flags, poles);
  arenaFX.flags = flags;

  // ---- floodlight towers (merged): tapered column, team bands, pink lamp panel, glowing lamps
  const tparts = [], lparts = [], halos = [];
  const colGeo = new THREE.CylinderGeometry(0.75, 1.35, 36, 16), bandGeo = new THREE.CylinderGeometry(1, 1, 1.1, 16), plinth = new THREE.CylinderGeometry(3, 3.5, 2.2, 20);
  const panelGeo = new THREE.ExtrudeGeometry(rrShape(5.4, 3.2, 1.5), { depth: 1, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 3, curveSegments: 8 }); panelGeo.translate(0, 0, -0.5);
  const lampGeo = new THREE.CylinderGeometry(1, 1, 0.5, 20); lampGeo.rotateX(Math.PI / 2);
  const o3 = new THREE.Object3D(), lv3 = new V3();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = sx * (A.hx + 26), z = sz * (A.hz + 26), tcol = sz < 0 ? 0x2f8cff : 0xff8a1f;
    tparts.push([plinth, arenaM4(x, 0, z), 0xdbe6f3], [colGeo, arenaM4(x, 19, z), 0xf3f7fc]);
    for (const by of [9, 18, 27]) { const rb = 1.35 - 0.6 * (by - 1) / 36 + 0.14; tparts.push([bandGeo, arenaM4(x, by, z, 0, 0, 0, rb, 1, rb), tcol]); }
    tparts.push([GEO.sphereLo, arenaM4(x, 37.4, z, 0, 0, 0, 1.3), 0xf3f7fc]);
    o3.position.set(x, 39.6, z); o3.lookAt(0, 6, 0); o3.updateMatrix();
    const hm = o3.matrix.clone();
    tparts.push([panelGeo, hm, 0xff5fa8], [GEO.sphereLo, hm.clone().multiply(arenaM4(0, 3.75, 0, 0, 0, 0, 0.7)), 0xffd23f]);
    for (const ly of [-1.45, 1.45]) for (const lx of [-3.3, 0, 3.3]) {
      tparts.push([lampGeo, hm.clone().multiply(arenaM4(lx, ly, 0.85, 0, 0, 0, 1.22, 1.22, 1)), INK]);
      lparts.push([lampGeo, hm.clone().multiply(arenaM4(lx, ly, 1.0)), 0xfff6d2]);
      halos.push(lv3.set(lx, ly, 1.6).applyMatrix4(hm).toArray());
    }
  }
  const towers = mk(arenaMerge(tparts), own(toon(0xffffff, { vertexColors: true })), { o: 0.14, cast: false });
  grp.add(towers);
  grp.add(new THREE.Mesh(arenaMerge(lparts), own(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.9, 1.9, 1.9) }))));
  const hgeo = new THREE.BufferGeometry(); hgeo.setAttribute('position', new THREE.Float32BufferAttribute(halos.flat(), 3));
  const hmat = own(new THREE.PointsMaterial({ map: own(arenaGlowTex()), color: new THREE.Color(0xfff1c0).multiplyScalar(0.6), size: 7, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  arenaFX.halo = new THREE.Points(hgeo, hmat); arenaFX.halo.renderOrder = 2; grp.add(arenaFX.halo);

  // ---- boost pads
  M.pads.forEach((p, i) => padViews.push(makePadView(p, i)));
  fitShadow();
}
// LED scroll, flag wave, glow pulses (also while paused, uses real time)
FRAME_HOOKS.push((gdt, rdt) => {
  const F = arenaFX; F.t.value += rdt;
  const ex = M.excite || 0;
  if (F.led) { F.led.offset.x = (F.led.offset.x + rdt * 0.14) % 1; F.led.offset.y = ex > 0.45 ? -0.5 : 0; }
  for (const gl of F.glow) gl.mat.color.copy(gl.base).multiplyScalar(0.92 + 0.08 * Math.sin(F.t.value * 3) + ex * 0.6 * (0.5 + 0.5 * Math.sin(F.t.value * 14)));
  if (F.halo) { F.halo.visible = arenaHi(); F.halo.material.size = 7 * (0.94 + 0.06 * Math.sin(F.t.value * 2.3)); }
});

// ----------------------------------------------------------- boost pads: big ice crystals + small fish
// chunky cartoon fish (nose -X, back +Y): lathe teardrop body, blob fins, big eyes; vertex coloured
function arenaFishGeo(body, belly, fin) {
  const prof = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; prof.push(new THREE.Vector2(Math.max(0.002, 0.4 * Math.sin(Math.PI * Math.pow(t, 1.35))), -0.55 + 1.15 * t)); }
  const lathe = new THREE.LatheGeometry(prof, 16);
  const cb = new THREE.Color(body), cl = new THREE.Color(belly);
  const bodyCol = (o, x, y) => { o.copy(cb).lerp(cl, clamp((-y + 0.02) / 0.22, 0, 1)); };
  const S = arenaBlob;
  const parts = [
    [lathe, arenaM4(0, 0, 0, 0, 0, Math.PI / 2, 1, 1, 0.84), bodyCol],
    [S, arenaM4(0.72, 0.17, 0, 0, 0, 0.75, 0.3, 0.12, 0.065), fin],
    [S, arenaM4(0.72, -0.17, 0, 0, 0, -0.75, 0.3, 0.12, 0.065), fin],
    [S, arenaM4(0.06, 0.34, 0, 0, 0, -0.35, 0.26, 0.13, 0.055), fin],
    [S, arenaM4(-0.02, -0.33, 0, 0, 0, 0.35, 0.14, 0.07, 0.045), fin],
  ];
  for (const sz of [-1, 1]) {
    parts.push(
      [S, arenaM4(0.02, -0.1, sz * 0.29, sz * 0.35, sz * 0.6, 0, 0.18, 0.08, 0.045), fin],
      [S, arenaM4(-0.29, 0.09, sz * 0.235, 0, 0, 0, 0.15), 0xffffff],
      [S, arenaM4(-0.34, 0.1, sz * 0.335, 0, 0, 0, 0.085), INK],
      [S, arenaM4(-0.38, 0.14, sz * 0.395, 0, 0, 0, 0.03), 0xffffff],
    );
  }
  parts.push([S, arenaM4(-0.6, -0.04, 0, 0, 0, 0, 0.055, 0.06, 0.1), 0xff5fa8]);
  return arenaMerge(parts);
}
const fishGeo = arenaFishGeo(0xff7a1a, 0xffe2b8, 0xffd23f);
// glowing ice-crystal cluster (centred on its middle): a tall hexagonal spire, four tilted side crystals and two
// shards at the foot; deep teal at the base through bright cyan to near-white tips, flat shaded for crisp facets
function arenaCrystalGeo() {
  const prism = new THREE.CylinderGeometry(0.82, 1, 1, 6); prism.translate(0, 0.5, 0);
  const tip = new THREE.ConeGeometry(0.82, 1, 6); tip.translate(0, 0.5, 0);
  const lo = new THREE.Color(0x1d7fc4), mid = new THREE.Color(0x5fe0ff), hi = new THREE.Color(0xf2fdff);
  const col = (o, x, y) => { const t = clamp((y + 0.75) / 1.55, 0, 1); if (t < 0.55) o.copy(lo).lerp(mid, t / 0.55); else o.copy(mid).lerp(hi, (t - 0.55) / 0.45); };
  const spire = (x, z, h, r, rx, rz, ry = 0) => {
    const m = arenaM4(x, -0.72, z, rx, 0, rz).multiply(arenaM4(0, 0, 0, 0, ry, 0));   // spin about its own axis, then tilt
    return [[prism, m.clone().multiply(arenaM4(0, 0, 0, 0, 0, 0, r, h, r)), col], [tip, m.clone().multiply(arenaM4(0, h, 0, 0, 0, 0, r, r * 1.7, r)), col]];
  };
  const parts = [...spire(0, 0, 0.95, 0.24, 0, 0, 0.3)];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4, x = Math.cos(a) * 0.2, z = Math.sin(a) * 0.2;
    parts.push(...spire(x, z, 0.42 + (i % 2) * 0.14, 0.13 + (i % 2) * 0.02, Math.sin(a) * 0.5, -Math.cos(a) * 0.5, a));
  }
  parts.push(...spire(0.34, -0.12, 0.16, 0.08, 0.2, -0.9, 1), ...spire(-0.3, 0.2, 0.12, 0.07, -0.3, 0.8, 2));
  return arenaMerge(parts);
}
const arenaCrystal = arenaCrystalGeo();
let arenaPads = null;
// shared instanced visuals for every pad (a handful of draw calls in total)
function arenaPadSys() {
  if (arenaPads) return arenaPads;
  const N = 64, grp = new THREE.Group(); scene.add(grp);
  const glowTex = arenaGlowTex();
  const arcMat = (on) => new THREE.ShaderMaterial({
    uniforms: { cOn: { value: new THREE.Color(on).multiplyScalar(1.7) }, cOff: { value: new THREE.Color(0x5d7397) }, uT: arenaFX.t },
    vertexShader: `attribute float aProg; varying float vP; varying vec2 vL;
      void main(){ vP = aProg; vL = position.xz; vec4 p = vec4(position, 1.0);
      #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      #endif
      gl_Position = projectionMatrix * modelViewMatrix * p; }`,
    fragmentShader: `uniform vec3 cOn; uniform vec3 cOff; uniform float uT; varying float vP; varying vec2 vL;
      void main(){ float a = fract(atan(vL.x, -vL.y) / 6.2831853 + 0.5);
        vec3 c = vP > 0.999 ? cOn * (0.85 + 0.15 * sin(uT * 5.0)) : (a < vP ? mix(cOff, cOn * 0.6, 0.75) : cOff);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
  });
  const kind = (big) => {
    const R = big ? 1.75 : 0.85, top = big ? 0.27 : 0.14;
    const prof = big
      ? [[0, -0.08], [R, -0.08], [R, 0.06], [R - 0.05, 0.12], [R * 0.82, 0.13], [R * 0.82, 0.22], [R * 0.8, 0.27], [0, 0.27]]
      : [[0, -0.08], [R, -0.08], [R, 0.06], [R - 0.06, 0.13], [R - 0.14, 0.14], [0, 0.14]];
    const lathe = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 32);
    const rim = new THREE.TorusGeometry(big ? R * 0.8 : R * 0.86, big ? 0.12 : 0.085, 8, 40); rim.rotateX(Math.PI / 2);
    const baseGeo = arenaMerge([[lathe, new THREE.Matrix4(), (o, x, y) => o.setHex(y > top - 0.02 ? 0xe4f2ff : big && y > 0.1 ? 0x8fe6ff : 0x8fbbe6)], [rim, arenaM4(0, top, 0), big ? 0x5fdcff : 0xffffff]]);
    const ringGeo = new THREE.RingGeometry(R * (big ? 0.36 : 0.42), R * (big ? 0.66 : 0.7), 48, 1); ringGeo.rotateX(-Math.PI / 2); ringGeo.translate(0, top + 0.025, 0);
    const prog = new THREE.InstancedBufferAttribute(new Float32Array(N).fill(1), 1); ringGeo.setAttribute('aProg', prog);
    const glowGeo = new THREE.PlaneGeometry(1, 1); glowGeo.rotateX(-Math.PI / 2);
    // big pads: a glowing (emissive, bloom-friendly) faceted ice crystal; small pads: a fish
    const crysMat = toon(0xffffff, { vertexColors: true, flatShading: true, roughness: 0.16, envMapIntensity: 0.9, emissive: 0x27b4ec, emissiveIntensity: 0.62 });
    const K = {
      R, top, prog, hover: big ? 1.25 : 0.6, fs: big ? 1.25 : 0.62,
      base: new THREE.InstancedMesh(baseGeo, toon(0xffffff, { vertexColors: true }), N),
      baseOl: new THREE.InstancedMesh(baseGeo, outlineMat(0.035), N),
      ring: new THREE.InstancedMesh(ringGeo, arcMat(big ? 0x46dcff : 0xffd23f), N),
      fish: new THREE.InstancedMesh(big ? arenaCrystal : fishGeo, big ? crysMat : toon(0xffffff, { vertexColors: true }), N),
      fishOl: new THREE.InstancedMesh(big ? arenaCrystal : fishGeo, outlineMat(0.045), N),
      glow: new THREE.InstancedMesh(glowGeo, new THREE.MeshBasicMaterial({ map: glowTex, color: big ? 0x3fd2ff : 0xffc640, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), N),
    };
    K.base.receiveShadow = true; K.fish.castShadow = true;
    K.all = [K.base, K.baseOl, K.ring, K.fish, K.fishOl, K.glow];
    return K;
  };
  const S = { grp, small: kind(false), big: kind(true) };
  // big pads: soft icy light column + rising sparkles
  const beamGeo = new THREE.CylinderGeometry(1, 0.75, 1, 24, 1, true); beamGeo.translate(0, 0.5, 0);
  S.beam = new THREE.InstancedMesh(beamGeo, new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(0x52dcff) }, uT: arenaFX.t },
    vertexShader: `varying float vY; varying float vF;
      void main(){ vY = uv.y; vec4 p = vec4(position, 1.0); vec3 n = normal;
      #ifdef USE_INSTANCING
      p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
      #endif
      vec4 mv = modelViewMatrix * p; vF = abs(dot(normalize(normalMatrix * n), normalize(-mv.xyz)));
      gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 c; uniform float uT; varying float vY; varying float vF;
      void main(){ float a = pow(1.0 - vY, 1.7) * pow(vF, 1.5) * (0.26 + 0.06 * sin(uT * 4.0 + vY * 6.0));
        gl_FragColor = vec4(c * a, a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }), N);
  S.sparkN = 8;
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * S.sparkN * 3).fill(-50), 3));
  S.spark = new THREE.Points(spGeo, new THREE.PointsMaterial({ map: arenaSparkTex(), color: new THREE.Color(0xc8f6ff).multiplyScalar(2), size: 0.55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  S.t = 0;
  for (const m of [...S.small.all, ...S.big.all, S.beam, S.spark]) { m.frustumCulled = false; if (m.isInstancedMesh) m.count = 0; grp.add(m); }
  S.beam.renderOrder = 2; S.spark.renderOrder = 3;
  arenaPads = S;
  return S;
}
const _apM = new THREE.Matrix4(), _apZ = new THREE.Matrix4().makeScale(0, 0, 0), _apQ = new Q(), _apE = new THREE.Euler(), _apP = new V3(), _apS = new V3();
function makePadView(p, i) {
  const S = arenaPadSys(), k = M.pads.indexOf(p);
  const slot = k >= 0 ? M.pads.slice(0, k).filter((q) => q.big === p.big).length : typeof i === 'number' ? i : padViews.length;
  const g = new THREE.Group(); g.position.set(p.x, 0, p.z); scene.add(g);
  const fish = new THREE.Object3D(), disc = new THREE.Object3D(); g.add(fish, disc);
  const K = p.big ? S.big : S.small;
  _apM.makeTranslation(p.x, 0, p.z);
  for (const m of [K.base, K.baseOl, K.ring]) m.setMatrixAt(slot, _apM);
  for (const m of [K.fish, K.fishOl, K.glow]) m.setMatrixAt(slot, _apZ);
  if (p.big) S.beam.setMatrixAt(slot, _apZ);
  for (const m of [...K.all, S.beam]) m.instanceMatrix.needsUpdate = true;
  return { g, p, fish, disc, t: rand(0, 6), slot, on: p.active, pop: 1, out: 0 };
}
function updatePadViews(dt) {
  const S = arenaPads; if (!S) return;
  const hi = arenaHi(), sp = S.spark.geometry.attributes.position;
  let nS = 0, nB = 0;
  for (const v of padViews) { if (v.p.big) nB = Math.max(nB, v.slot + 1); else nS = Math.max(nS, v.slot + 1); }
  for (const m of S.small.all) m.count = nS;
  for (const m of S.big.all) m.count = nB;
  S.beam.count = nB;
  S.t += dt;
  S.beam.visible = S.spark.visible = hi; S.small.glow.visible = S.big.glow.visible = hi;
  for (const v of padViews) {
    const p = v.p, K = p.big ? S.big : S.small, i = v.slot;
    v.t += dt;
    if (p.active && !v.on) v.pop = 0;
    if (!p.active && v.on) v.out = 1;
    v.on = p.active; v.pop = Math.min(1, v.pop + dt * 2.6); v.out = Math.max(0, v.out - dt * 5);
    const e = v.pop - 1, pop = 1 + 2.7 * e * e * e + 1.7 * e * e;   // ease-out-back
    // fish: spin, bob, little swim wiggle; crystals: slow turn and a gentle float. Both pop in on respawn and
    // shrink away when taken
    let fs = 0, fy = K.hover + Math.sin(v.t * 2.6) * (p.big ? 0.13 : 0.06);
    if (p.active) fs = K.fs * Math.max(0.001, pop);
    else if (v.out > 0) { fs = K.fs * v.out; fy += (1 - v.out) * 0.8; }
    v.fish.visible = fs > 0;
    const wig = p.big ? 0.2 : 1;
    v.fish.position.set(0, fy, 0); v.fish.rotation.set(Math.sin(v.t * 6) * 0.1 * wig, v.t * (p.big ? 0.8 : 1.9) + (1 - v.out) * (p.active ? 0 : 6), Math.sin(v.t * 3.1) * 0.12 * wig, 'YXZ'); v.fish.scale.setScalar(Math.max(fs, 1e-4));
    if (fs > 0) {
      _apM.compose(_apP.set(p.x, fy, p.z), _apQ.setFromEuler(v.fish.rotation), _apS.setScalar(fs));
      K.fish.setMatrixAt(i, _apM); K.fishOl.setMatrixAt(i, _apM);
    } else { K.fish.setMatrixAt(i, _apZ); K.fishOl.setMatrixAt(i, _apZ); }
    // glowing ring doubles as the recharge dial
    K.prog.array[i] = p.active ? 1 : clamp(1 - p.t / (p.big ? 10 : 4), 0, 0.998);
    const gs = p.active ? K.R * (p.big ? 3.4 : 2.2) * (0.94 + 0.06 * Math.sin(v.t * 4)) : 0;
    K.glow.setMatrixAt(i, gs > 0 ? _apM.compose(_apP.set(p.x, 0.03, p.z), _apQ.identity(), _apS.set(gs, 1, gs)) : _apZ);
    if (p.big) {
      S.beam.setMatrixAt(i, p.active ? _apM.compose(_apP.set(p.x, K.top, p.z), _apQ.identity(), _apS.set(1.15 * pop, 5.5, 1.15 * pop)) : _apZ);
      for (let k = 0; k < S.sparkN; k++) {
        const ph = (v.t * 0.45 + k / S.sparkN) % 1, a = k * 2.4 + v.t * 1.2, rr = 0.7 + 0.5 * Math.sin(k * 1.7);
        sp.setXYZ(i * S.sparkN + k, p.x + Math.cos(a) * rr, p.active ? 0.5 + ph * 3.2 : -50, p.z + Math.sin(a) * rr);
      }
    }
  }
  for (const m of [...S.small.all, ...S.big.all, S.beam]) m.instanceMatrix.needsUpdate = true;
  S.small.prog.needsUpdate = S.big.prog.needsUpdate = true;
  sp.needsUpdate = true;
}
