// =====================================================================
//  BALL + EFFECTS — ball view, particles, confetti, comic bursts, shock rings
// =====================================================================
const fxV = new V3(), fxV2 = new V3(), fxQ = new Q(), fxM4 = new THREE.Matrix4(), fxCol = new THREE.Color();
const fxUp = new V3(0, 1, 0), fxXA = new V3(1, 0, 0), fxSun = new V3(0.4, 0.85, 0.3);
const FX_INK = '#1b1d3a';
const FX_OUT = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}';
const fxHi = () => save.settings.quality !== 'low';
const fxStep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// bursts that start inside a goal spray out through the goal mouth so they stay visible: returns the outward z sign or 0
const fxMouth = (p) => (Math.abs(p.z) > A.hz - 0.5 ? -Math.sign(p.z) : 0);
// linear-data canvas texture (channel masks, normal maps)
function fxMaskTex(w, h, draw) { const t = canvasTex(w, h, draw); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; return t; }

// ----------------------------------------------------------- ball view
const FX_GORES = ['#8d5bff', '#ff5fa8', '#ff8a1f', '#ffd23f', '#72dc4e', '#2fc6ff'];
const FX_CAP = 0.14;   // white pole caps, fraction of texture height
const ballTex = canvasTex(1024, 512, (g, w, h) => {
  const n = FX_GORES.length, gw = w / n, cy = h * FX_CAP, S = 15, vy = h * 0.036;
  FX_GORES.forEach((c, i) => {
    g.fillStyle = c; g.fillRect(i * gw, 0, gw + 1, h);
    const gr = g.createLinearGradient(i * gw, 0, (i + 1) * gw, 0);   // soft sheen mid-gore
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(i * gw, 0, gw, h);
  });
  g.fillStyle = '#f4f8ff'; g.fillRect(0, 0, w, cy); g.fillRect(0, h - cy, w, cy);
  g.fillStyle = '#ffd23f'; g.fillRect(0, 0, w, vy); g.fillRect(0, h - vy, w, vy);
  g.fillStyle = FX_INK;
  g.fillRect(0, cy - S / 2, w, S); g.fillRect(0, h - cy - S / 2, w, S);
  g.fillRect(0, vy - 4, w, 8); g.fillRect(0, h - vy - 4, w, 8);
  // gore seams widen towards the caps so they keep a constant width on the sphere
  const hw = (y) => S / 2 / Math.max(0.3, Math.sin(Math.PI * y / h));
  for (let i = 0; i <= n; i++) {
    g.beginPath();
    for (let k = 0; k <= 40; k++) { const y = lerp(cy, h - cy, k / 40); g.lineTo(i * gw - hw(y), y); }
    for (let k = 40; k >= 0; k--) { const y = lerp(cy, h - cy, k / 40); g.lineTo(i * gw + hw(y), y); }
    g.fill();
  }
});
ballTex.anisotropy = 8;
// inflated-vinyl pillow between the seams (tangent-space normal map)
const fxBallNrm = (() => {
  const W = 512, H = 256, n = FX_GORES.length, hgt = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H, e = fxStep(FX_CAP, FX_CAP + 0.1, v) * fxStep(FX_CAP, FX_CAP + 0.1, 1 - v);
    for (let x = 0; x < W; x++) hgt[y * W + x] = Math.pow(Math.sin(Math.PI * (((x + 0.5) / W * n) % 1)), 0.6) * e * 0.07;
  }
  return fxMaskTex(W, H, (g) => {
    const img = g.createImageData(W, H), d = img.data, sy = Math.PI * BALL_R / H;
    for (let y = 0; y < H; y++) {
      const sx = Math.max(0.3, Math.sin(Math.PI * (y + 0.5) / H)) * 2 * Math.PI * BALL_R / W, y0 = Math.max(0, y - 1), y1 = Math.min(H - 1, y + 1);
      for (let x = 0; x < W; x++) {
        const nx = -(hgt[y * W + (x + 1) % W] - hgt[y * W + (x + W - 1) % W]) / (2 * sx), ny = (hgt[y1 * W + x] - hgt[y0 * W + x]) / ((y1 - y0) * sy);
        const l = Math.hypot(nx, ny, 1), o = (y * W + x) * 4;
        d[o] = (nx / l * 0.5 + 0.5) * 255; d[o + 1] = (ny / l * 0.5 + 0.5) * 255; d[o + 2] = (0.5 / l + 0.5) * 255; d[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
})();
const ballView = (() => {
  const geo = new THREE.SphereGeometry(BALL_R, 48, 32);
  const rimCol = { value: new THREE.Color(0xd2f0ff) };
  const rim = (sh) => {
    sh.uniforms.fxRim = rimCol;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 fxRim;')
      .replace('#include <opaque_fragment>', `outgoingLight += fxRim * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.5) * 0.45;
outgoingLight += vec3(0.8) * smoothstep(0.95, 0.982, dot(normal, normalize(vec3(-0.42, 0.62, 0.66))));
#include <opaque_fragment>`);
  };
  // a little self-light keeps the vinyl colours saturated on the shaded side
  const glow = { emissive: 0xffffff, emissiveMap: ballTex, emissiveIntensity: 0.32 };
  const matHi = new THREE.MeshPhysicalMaterial({ map: ballTex, normalMap: fxBallNrm, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.14, ...glow });
  const matLo = new THREE.MeshPhongMaterial({ map: ballTex, shininess: 60, specular: 0x5a5a5a, ...glow });
  matHi.onBeforeCompile = matLo.onBeforeCompile = rim;
  // bold ink outline that thickens with distance so the ball reads from across the rink
  const olMat = new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(INK) } }, side: THREE.BackSide,
    vertexShader: 'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); mv.xyz += normalize(normalMatrix * normal) * (0.055 + min(0.2, -mv.z * 0.0035)); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uC; void main(){ gl_FragColor = vec4(uC, 1.0);\n#include <colorspace_fragment>\n}',
  });
  const mesh = new THREE.Group(), squash = new THREE.Group(), body = new THREE.Mesh(geo, matHi), ol = new THREE.Mesh(geo, olMat);
  body.castShadow = true; body.add(ol); squash.add(body); mesh.add(squash); scene.add(mesh);
  // ground marker: soft contact shadow + slowly turning target ring (decals well above the ice)
  const blobTex = canvasTex(128, 128, (g, w) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 63);
    r.addColorStop(0, 'rgba(27,29,58,0.85)'); r.addColorStop(0.45, 'rgba(27,29,58,0.5)'); r.addColorStop(1, 'rgba(27,29,58,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  const ringTex = canvasTex(256, 256, (g) => {
    g.translate(128, 128); g.lineCap = g.lineJoin = 'round';
    g.strokeStyle = FX_INK; g.lineWidth = 19; g.beginPath(); g.arc(0, 0, 94, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 7; g.setLineDash([24, 17]); g.stroke(); g.setLineDash([]);
    for (let i = 0; i < 4; i++) {
      g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(-15, -121); g.lineTo(15, -121); g.lineTo(0, -101); g.closePath();
      g.strokeStyle = FX_INK; g.lineWidth = 7; g.stroke(); g.fillStyle = '#ffffff'; g.fill();
    }
  });
  ringTex.anisotropy = blobTex.anisotropy = 8;
  const decal = (tex, ro) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = ro; scene.add(m); return m;
  };
  const blob = decal(blobTex, 1), ring = decal(ringTex, 2);
  // ribbons: camera-facing strips through recent ball positions (preallocated, rebuilt in place every frame)
  const ribbonGeo = (n) => {
    const P = new Float32Array(n * 6), T = new Float32Array(n * 6), Sd = new Float32Array(n * 2), Uv = new Float32Array(n * 4), idx = [];
    for (let i = 0; i < n; i++) {
      Sd[i * 2] = -1; Sd[i * 2 + 1] = 1; Uv[i * 4] = Uv[i * 4 + 2] = i / (n - 1); Uv[i * 4 + 3] = 1;
      if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry(), PA = new THREE.BufferAttribute(P, 3), TA = new THREE.BufferAttribute(T, 3);
    PA.setUsage(THREE.DynamicDrawUsage); TA.setUsage(THREE.DynamicDrawUsage);
    g.setIndex(idx); g.setAttribute('position', PA); g.setAttribute('aTan', TA);
    g.setAttribute('aSide', new THREE.BufferAttribute(Sd, 1)); g.setAttribute('uv', new THREE.BufferAttribute(Uv, 2));
    return { g, P, T, PA, TA };
  };
  const RIBBON_VS = `attribute vec3 aTan; attribute float aSide; uniform float uW; varying vec2 vUv;
void main(){
  vec3 p = position, s = cross(aTan, normalize(cameraPosition - p)); float l = length(s);
  s = l > 1e-4 ? s / l : vec3(0.0, 1.0, 0.0);
  p += s * aSide * uW * pow(1.0 - uv.x, 0.6); vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
  // fill a ribbon from a ring-buffer history (newest sample first, the live ball position at the head)
  const fillRibbon = (R, n, hist, head, len, p, v) => {
    const tP = R.P, tT = R.T;
    for (let i = 0; i < n; i++) {
      const j = i === 0 ? -1 : (((head - i + 1) % len) + len) % len * 3, o = i * 6;
      tP[o] = tP[o + 3] = j < 0 ? p.x : hist[j]; tP[o + 1] = tP[o + 4] = j < 0 ? p.y : hist[j + 1]; tP[o + 2] = tP[o + 5] = j < 0 ? p.z : hist[j + 2];
    }
    let px = v.x, py = v.y, pz = v.z;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1) * 6, c = Math.min(n - 1, i + 1) * 6, o = i * 6;
      let tx = tP[a] - tP[c], ty = tP[a + 1] - tP[c + 1], tz = tP[a + 2] - tP[c + 2];
      const l = Math.hypot(tx, ty, tz);
      if (l > 1e-4) { tx /= l; ty /= l; tz /= l; px = tx; py = ty; pz = tz; } else { tx = px; ty = py; tz = pz; }
      tT[o] = tT[o + 3] = tx; tT[o + 1] = tT[o + 4] = ty; tT[o + 2] = tT[o + 5] = tz;
    }
    R.PA.needsUpdate = R.TA.needsUpdate = true;
  };
  // speed ribbon: shown above ~25 m/s
  const TN = 30, TH = TN - 1, hist = new Float32Array(TH * 3), TR = ribbonGeo(TN);
  const tMat = new THREE.ShaderMaterial({
    uniforms: { uOp: { value: 0 }, uW: { value: 0.95 }, uA: { value: new THREE.Color(0xffffff) }, uB: { value: new THREE.Color(0xffd23f) }, uC: { value: new THREE.Color(0xff5fa8) } },
    vertexShader: RIBBON_VS,
    fragmentShader: `uniform float uOp; uniform vec3 uA, uB, uC; varying vec2 vUv;
void main(){
  float x = vUv.x, y = abs(vUv.y * 2.0 - 1.0);
  vec3 col = mix(mix(uA, uB, smoothstep(0.25, 0.5, y)), uC, smoothstep(0.55, 0.8, y));
  gl_FragColor = vec4(col, (1.0 - smoothstep(0.82, 1.0, y)) * pow(1.0 - x, 1.1) * uOp);` + FX_OUT,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const trail = new THREE.Mesh(TR.g, tMat); trail.frustumCulled = false; trail.renderOrder = 3; trail.visible = false; scene.add(trail);
  // curve ribbon: a longer icy streak through the last ~0.8 s of flight while the ball carries real sidespin,
  // so the bend of a curved shot stays visible; twisting stripes scroll with the spin
  const CN = 48, CH = CN - 1, chist = new Float32Array(CH * 3), CR = ribbonGeo(CN);
  const cvMat = new THREE.ShaderMaterial({
    uniforms: { uOp: { value: 0 }, uW: { value: 0.62 }, uT: { value: 0 } },
    vertexShader: RIBBON_VS,
    fragmentShader: `uniform float uOp, uT; varying vec2 vUv;
void main(){
  float x = vUv.x, s = vUv.y * 2.0 - 1.0, y = abs(s);
  float st = 0.5 + 0.5 * sin((x * 30.0 + s * 2.2) * 3.0 - uT);
  vec3 col = mix(vec3(0.82, 0.98, 1.0), vec3(0.2, 0.74, 1.0), smoothstep(0.15, 0.8, y));
  col = mix(col, vec3(1.0), st * 0.4 * (1.0 - y));
  gl_FragColor = vec4(col * 1.3, (1.0 - smoothstep(0.7, 1.0, y)) * pow(1.0 - x, 0.85) * uOp * (0.72 + 0.28 * st));` + FX_OUT,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const curve = new THREE.Mesh(CR.g, cvMat); curve.frustumCulled = false; curve.renderOrder = 3; curve.visible = false; scene.add(curve);
  const rot = new Q(), vPrev = new V3(), lastP = new V3(), sqAx = new V3(0, 1, 0);
  let hi = 0, tAcc = 0, tOp = 0, fresh = true, sqA = 0, sqV = 0, warmB = 2, ci = 0, cAcc = 0, cOp = 0, warmC = 2;
  return {
    mesh,
    update(dt, alpha, b, hidden) {
      mesh.visible = blob.visible = ring.visible = !hidden;
      if (hidden) { trail.visible = curve.visible = false; fresh = true; cOp = 0; return; }
      const want = fxHi() ? matHi : matLo; if (body.material !== want) body.material = want;
      const p = mesh.position; p.lerpVectors(b.pp, b.p, alpha);
      const wl = b.w.length();
      if (wl > 1e-4) { fxQ.setFromAxisAngle(fxV.copy(b.w).multiplyScalar(1 / wl), wl * dt); rot.premultiply(fxQ); }
      const jump = fresh || p.distanceToSquared(lastP) > 64;
      // squash + jelly wobble along the impulse on hard hits / bounces
      if (jump) { vPrev.copy(b.v); sqA = sqV = 0; }
      else if (dt > 0) {
        const dvl = fxV.copy(b.v).sub(vPrev).length();
        if (dvl > 10) { const amt = Math.min(0.16, (dvl - 6) / 80); if (amt > sqA) { sqA = amt; sqV = 0; sqAx.copy(fxV).divideScalar(dvl); squash.quaternion.setFromUnitVectors(fxUp, sqAx); } }
        vPrev.copy(b.v);
        for (let t = dt; t > 1e-6; t -= 1 / 120) { const h = Math.min(t, 1 / 120); sqV += (-300 * sqA - 10 * sqV) * h; sqA += sqV * h; }
      }
      squash.scale.set(1 + sqA * 0.5, 1 - sqA, 1 + sqA * 0.5); squash.position.copy(sqAx).multiplyScalar(-BALL_R * sqA);   // keep the contact side planted
      body.quaternion.copy(squash.quaternion).invert().multiply(rot);
      const hgt = Math.max(0, p.y - BALL_R), k = clamp(1 - hgt / 22, 0.2, 1);
      blob.position.set(p.x, 0.035, p.z); blob.scale.setScalar(BALL_R * (2.4 + hgt * 0.06)); blob.material.opacity = 0.62 * k * k;
      ring.position.set(p.x, 0.05, p.z); ring.scale.setScalar(BALL_R * (2.6 + hgt * 0.06)); ring.rotation.z += dt * 0.8;
      ring.material.opacity = (0.3 + 0.6 * fxStep(0.3, 3, hgt)) * Math.max(k, 0.45);
      // ribbon histories (time-sampled, reset on teleports)
      if (jump) {
        for (let i = 0; i < TH; i++) { hist[i * 3] = p.x; hist[i * 3 + 1] = p.y; hist[i * 3 + 2] = p.z; }
        for (let i = 0; i < CH; i++) { chist[i * 3] = p.x; chist[i * 3 + 1] = p.y; chist[i * 3 + 2] = p.z; }
      }
      lastP.copy(p); fresh = false;
      tAcc += dt;
      if (tAcc >= 1 / 90) { tAcc = Math.min(tAcc - 1 / 90, 1 / 90); hi = (hi + 1) % TH; hist[hi * 3] = p.x; hist[hi * 3 + 1] = p.y; hist[hi * 3 + 2] = p.z; }
      cAcc += dt;
      if (cAcc >= 1 / 60) { cAcc = Math.min(cAcc - 1 / 60, 1 / 60); ci = (ci + 1) % CH; chist[ci * 3] = p.x; chist[ci * 3 + 1] = p.y; chist[ci * 3 + 2] = p.z; }
      // curve ribbon: fades in once the sidespin passes CURVE_SPIN, lingers a moment after it drops
      const spin = Math.abs(b.w.y);
      cOp = damp(cOp, fxStep(CURVE_SPIN, CURVE_SPIN * 2.2, spin) * fxStep(6, 12, b.v.length()), cOp < 0.05 ? 14 : 5, dt);
      curve.visible = cOp > 0.01;
      if (curve.visible) { fillRibbon(CR, CN, chist, ci, CH, p, b.v); cvMat.uniforms.uOp.value = cOp * 0.85; cvMat.uniforms.uT.value += dt * (4 + spin * 2.2); }
      else if (warmC > 0) { warmC--; curve.visible = true; cvMat.uniforms.uOp.value = 0; }
      tOp = damp(tOp, fxStep(24, 38, b.v.length()), 10, dt);
      trail.visible = tOp > 0.01;
      if (!trail.visible) { if (warmB > 0) { warmB--; trail.visible = true; tMat.uniforms.uOp.value = 0; } return; }
      fillRibbon(TR, TN, hist, hi, TH, p, b.v); tMat.uniforms.uOp.value = tOp * 0.9;
    },
  };
})();


// ----------------------------------------------------------- effects
// puff(): soft vinyl smoke balls. Optional 13th arg kind = 'smoke' | 'glow' | 'spark' | 'bubble'; without it a puff that
// shrinks (s1 < s0) glows, s1 = 0 makes a star sparkle and the bubble-trail cyan (0x9ff0ff) makes soap bubbles.
const FX = (() => {
  const quad = new THREE.PlaneGeometry(1, 1);
  const instGeo = (attrs, max) => {
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index; g.setAttribute('position', quad.attributes.position); g.setAttribute('uv', quad.attributes.uv);
    const out = attrs.map((n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, a); return a; });
    g.instanceCount = 0; return [g, ...out];
  };
  // ---- puffs (instanced spheres, compacted every frame) + matching soft outline hull
  const MAXP = 1000;
  const pGeo = new THREE.SphereGeometry(1, 16, 10);
  const pGlow = new THREE.InstancedBufferAttribute(new Float32Array(MAXP), 1); pGlow.setUsage(THREE.DynamicDrawUsage); pGeo.setAttribute('aGlow', pGlow);
  const pMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  pMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow;').replace('#include <opaque_fragment>',
      `float fxR = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.2);
outgoingLight = mix(mix(outgoingLight, diffuseColor.rgb, 0.55) + (vec3(0.1, 0.13, 0.16) + diffuseColor.rgb * 0.25) * fxR, diffuseColor.rgb * (1.3 + fxR * 0.6), step(0.5, vGlow) * step(vGlow, 1.5));
#include <opaque_fragment>`);
  };
  const pMesh = new THREE.InstancedMesh(pGeo, pMat, MAXP);
  pMesh.frustumCulled = false; pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pMesh.setColorAt(0, fxCol.setHex(0xffffff)); pMesh.instanceColor.setUsage(THREE.DynamicDrawUsage); pMesh.count = 0;
  const oMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `attribute float aGlow; varying vec3 vC;
void main(){
  vec3 c = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
  c = instanceColor;
  #endif
  vC = c * vec3(0.42, 0.56, 0.82);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position * (aGlow > 0.5 ? 0.0 : 1.13), 1.0);
}`,
    fragmentShader: 'varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0);' + FX_OUT,
  });
  const oMesh = new THREE.InstancedMesh(pGeo, oMat, MAXP);
  oMesh.instanceMatrix = pMesh.instanceMatrix; oMesh.instanceColor = pMesh.instanceColor; oMesh.frustumCulled = false; oMesh.count = 0;
  scene.add(pMesh, oMesh);
  const P = []; for (let i = 0; i < MAXP; i++) P.push({ on: false, p: new V3(), v: new V3(), life: 0, max: 1, s0: 0.2, s1: 0.5, g: 0, drag: 1, r: 1, gg: 1, b: 1, glow: 0 });
  let pi = 0;
  function puff(x, y, z, vx, vy, vz, s0, s1, life, color, g = 0, drag = 1, kind) {
    if (kind === 'spark' || (!kind && s1 <= 0)) { spark(x, y, z, vx, vy, vz, Math.max(s0, s1) * 3.4, life * 1.2, color, g, drag); return; }
    if (kind === 'bubble' || (!kind && color === 0x9ff0ff && s1 > s0)) { spark(x, y, z, vx, vy, vz, s1 * 2.4, life, color, g, drag, 1); return; }
    const q = P[pi]; pi = (pi + 1) % MAXP;
    q.on = true; q.p.set(x, y, z); q.v.set(vx, vy, vz); q.life = 0; q.max = life; q.s0 = s0; q.s1 = s1; q.g = g; q.drag = drag;
    q.glow = kind === 'glow' || (!kind && s1 < s0) ? 1 : Math.max(s0, s1) < 0.5 ? 2 : 0;
    fxCol.setHex(color); q.r = fxCol.r; q.gg = fxCol.g; q.b = fxCol.b;
  }
  // ---- billboards: four-point star sparkles (white-hot core + soft halo, bloom-friendly) and soap bubbles; size < 0 = bubble
  const MAXS = 600;
  const [sGeo, sPos, sCol] = instGeo(['aP', 'aC'], MAXS);
  const starTex = fxMaskTex(256, 128, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 128); g.globalCompositeOperation = 'lighter'; g.translate(64, 64);
    const halo = g.createRadialGradient(0, 0, 0, 0, 0, 60); halo.addColorStop(0, 'rgb(0,0,255)'); halo.addColorStop(0.3, 'rgb(0,0,120)'); halo.addColorStop(1, 'rgb(0,0,0)');
    g.fillStyle = halo; g.fillRect(-64, -64, 128, 128);
    const star = (R, r) => { g.beginPath(); g.moveTo(0, -R); g.quadraticCurveTo(r, -r, R, 0); g.quadraticCurveTo(r, r, 0, R); g.quadraticCurveTo(-r, r, -R, 0); g.quadraticCurveTo(-r, -r, 0, -R); g.closePath(); };
    star(56, 15); g.fillStyle = 'rgb(255,0,0)'; g.fill();
    star(26, 7); g.fillStyle = 'rgb(0,255,0)'; g.fill();
    // bubble cell: B = tinted film (denser at the rim), R = rim line, G = glossy highlights
    g.translate(128, 0);
    const film = g.createRadialGradient(0, 0, 0, 0, 0, 52); film.addColorStop(0, 'rgb(0,0,40)'); film.addColorStop(0.75, 'rgb(0,0,90)'); film.addColorStop(1, 'rgb(0,0,190)');
    g.fillStyle = film; g.beginPath(); g.arc(0, 0, 52, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgb(255,0,0)'; g.lineWidth = 7; g.stroke();
    g.fillStyle = 'rgb(0,255,0)'; g.beginPath(); g.ellipse(-20, -22, 14, 8, -0.7, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(-35, -4, 4.5, 0, Math.PI * 2); g.fill();
  });
  const sMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: starTex } }, transparent: true, depthWrite: false,
    vertexShader: `attribute vec4 aP; attribute vec4 aC; varying vec2 vUv; varying vec3 vCol; varying float vB;
void main(){
  vec4 mv = viewMatrix * vec4(aP.xyz, 1.0);
  float c = cos(aC.w), s = sin(aC.w);
  mv.xy += mat2(c, s, -s, c) * position.xy * abs(aP.w);
  vB = step(aP.w, 0.0); vUv = vec2((uv.x + vB) * 0.5, uv.y); vCol = aC.rgb; gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying vec3 vCol; varying float vB;
void main(){
  vec4 t = texture2D(uMap, vUv);
  vec3 star = mix(vCol, mix(vCol * 1.35, vec3(1.25), t.g), t.r);
  vec3 bub = mix(mix(vCol, vec3(1.0), 0.35 * t.r), vec3(1.0), t.g);
  gl_FragColor = vB > 0.5 ? vec4(bub, max(max(t.r * 0.85, t.b * 0.75), t.g)) : vec4(star, max(t.r, t.b * 0.5));` + FX_OUT,
  });
  const sMesh = new THREE.Mesh(sGeo, sMat); sMesh.frustumCulled = false; sMesh.renderOrder = 6; scene.add(sMesh);
  const S = []; for (let i = 0; i < MAXS; i++) S.push({ on: false, p: new V3(), v: new V3(), life: 0, max: 1, size: 1, g: 0, drag: 2, r: 1, gg: 1, b: 1, rot: 0, spin: 0, ph: 0, bub: 0 });
  let si = 0;
  function spark(x, y, z, vx, vy, vz, size, life, color, g = 0, drag = 2, bub = 0) {
    const q = S[si]; si = (si + 1) % MAXS;
    q.on = true; q.p.set(x, y, z); q.v.set(vx, vy, vz); q.life = 0; q.max = life; q.size = size; q.g = g; q.drag = drag; q.bub = bub;
    q.rot = bub ? 0 : rand(-0.4, 0.4); q.spin = bub ? 0 : rand(-3, 3); q.ph = rand(0, 6.3);
    fxCol.setHex(color); q.r = fxCol.r; q.gg = fxCol.g; q.b = fxCol.b;
  }
  function sparkBall(pos, n, colors, speed, size, life = 0.9, g = -3) {
    const m = fxMouth(pos);
    for (let k = 0; k < n; k++) {
      const a = rand(0, Math.PI * 2), e = rand(-0.5, 1.3), s = speed * rand(0.45, 1), vz = Math.sin(a) * Math.cos(e) * s;
      spark(pos.x, pos.y, pos.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s, m ? m * (Math.abs(vz) + s * 0.3) : vz, size * rand(0.7, 1.2), life * rand(0.7, 1.2), pick(colors), g, 2.2);
    }
  }
  // ---- confetti: rectangles, squiggles, stars and dots; two-sided, tumbling, fluttering, settling flat on the ice
  const MAXC = 800;
  const [cGeo, cPos, cRot, cCol] = instGeo(['aP', 'aQ', 'aC'], MAXC);
  const confTex = fxMaskTex(256, 256, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.globalCompositeOperation = 'lighter'; g.lineJoin = g.lineCap = 'round';
    const R = 'rgb(255,0,0)', G = 'rgb(0,255,0)';
    const cell = (i, path, border, strokeOnly) => {
      g.save(); g.translate((i % 2) * 128 + 64, (1 - (i >> 1)) * 128 + 64);
      path(); g.strokeStyle = R; g.lineWidth = border; g.stroke(); if (!strokeOnly) { g.fillStyle = R; g.fill(); }
      g.restore();
    };
    const inner = (i, path, w) => { g.save(); g.translate((i % 2) * 128 + 64, (1 - (i >> 1)) * 128 + 64); path(); if (w) { g.strokeStyle = G; g.lineWidth = w; g.stroke(); } else { g.fillStyle = G; g.fill(); } g.restore(); };
    const rect = () => { g.beginPath(); g.roundRect(-24, -44, 48, 88, 8); };
    const wave = () => { g.beginPath(); for (let k = 0; k <= 24; k++) { const x = -40 + k * 80 / 24; g.lineTo(x, Math.sin(k / 24 * Math.PI * 3) * 15); } };
    const star = () => { g.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, r = k % 2 ? 22 : 46; g.lineTo(Math.cos(a) * r, Math.sin(a) * r + 4); } g.closePath(); };
    const dot = () => { g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); };
    cell(0, rect, 14); cell(1, wave, 38, true); cell(2, star, 14); cell(3, dot, 14);
    inner(0, rect); inner(1, wave, 22); inner(2, star); inner(3, dot);
  });
  const cMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: confTex }, uL: { value: fxSun } }, transparent: true, side: THREE.DoubleSide,
    vertexShader: `attribute vec4 aP; attribute vec4 aQ; attribute vec4 aC; uniform vec3 uL; varying vec2 vUv; varying vec3 vCol;
vec3 qrot(vec4 q, vec3 v){ return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
void main(){
  vUv = (uv + vec2(mod(aC.w, 2.0), floor(aC.w * 0.5))) * 0.5;
  vec3 p = qrot(aQ, vec3(position.xy * aP.w, 0.0)) + aP.xyz, n = qrot(aQ, vec3(0.0, 0.0, 1.0));
  vec3 h = normalize(uL + normalize(cameraPosition - p));
  vCol = aC.rgb * (0.66 + 0.46 * abs(dot(n, uL))) + pow(abs(dot(n, h)), 30.0) * 0.55;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
    fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying vec3 vCol;
void main(){
  vec4 t = texture2D(uMap, vUv);
  if (t.r < 0.35) discard;
  gl_FragColor = vec4(vCol * mix(0.58, 1.0, smoothstep(0.3, 0.7, t.g)), smoothstep(0.35, 0.6, t.r));` + FX_OUT,
  });
  const cMesh = new THREE.Mesh(cGeo, cMat); cMesh.frustumCulled = false; scene.add(cMesh);
  const C = []; for (let i = 0; i < MAXC; i++) C.push({ on: false, p: new V3(), v: new V3(), q: new Q(), qt: new Q(), ax: new V3(), spin: 0, life: 0, max: 3, ph: 0, fr: 1, size: 0.5, shape: 0, r: 1, gg: 1, b: 1, land: false, gy: 0.04 });
  let ci = 0;
  function confetti(pos, n, colors, speed = 18) {
    if (save.settings.reducedMotion) return;
    if (!fxHi()) n = Math.ceil(n * 0.6);
    const m = fxMouth(pos);
    for (let k = 0; k < n; k++) {
      const q = C[ci], a = rand(0, Math.PI * 2), e = rand(0.15, 1.25), s = speed * rand(0.35, 1);
      q.on = true; q.land = false; q.p.copy(pos);
      q.v.set(Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 4, Math.sin(a) * Math.cos(e) * s);
      if (m) { q.v.z = m * (Math.abs(q.v.z) + s * 0.4); q.v.x *= 0.7; }
      // big goal bursts: two thirds blast up out of confetti cannons at the goal posts
      if (m && n >= 120 && k % 3) {
        const side = k % 3 === 1 ? -1 : 1;
        q.p.set(side * (A.gw - 0.5), rand(0.4, 1.4), -m * (A.hz - 0.4));
        q.v.set(side * rand(-4, 2), rand(20, 31), m * rand(1.5, 6));
      }
      q.ax.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(); q.spin = rand(5, 14); q.q.setFromAxisAngle(q.ax, rand(0, 6.3));
      q.life = 0; q.max = rand(3, 4.6); q.ph = rand(0, 6.3); q.fr = rand(2.5, 5); q.size = rand(0.5, 0.72); q.shape = (Math.random() * 4) | 0;
      q.gy = 0.035 + (ci % 8) * 0.007;
      fxCol.setHex(pick(colors)); q.r = fxCol.r; q.gg = fxCol.g; q.b = fxCol.b;
      ci = (ci + 1) % MAXC;
    }
  }
  // ---- comic bursts: sticker starburst with white border, ink line, halftone dots and chunky lettering
  const texCache = {};
  const fontOk = () => !document.fonts || document.fonts.check('80px "Lilita One"');
  function drawComic(word, a, b) {
    return canvasTex(512, 512, (g) => {
      let seed = 7; for (let i = 0; i < word.length; i++) seed = (seed * 31 + word.charCodeAt(i)) % 99991;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed % 10000) / 10000; };
      g.translate(256, 256); g.lineJoin = 'round'; g.lineCap = 'round';
      const N = 13, pts = [];
      for (let i = 0; i < N * 2; i++) {
        const ang = i * Math.PI / N - Math.PI / 2 + (rnd() - 0.5) * 0.1, r = i % 2 ? 150 + rnd() * 16 : 196 + rnd() * 36;
        pts.push(Math.cos(ang) * r, Math.sin(ang) * r * 0.84);
      }
      const path = (k, dx = 0, dy = 0) => { g.beginPath(); for (let i = 0; i < pts.length; i += 2) g.lineTo(pts[i] * k + dx, pts[i + 1] * k + dy); g.closePath(); };
      path(1, 9, 14); g.fillStyle = 'rgba(27,29,58,0.32)'; g.fill();
      path(1); g.strokeStyle = '#ffffff'; g.lineWidth = 30; g.stroke();
      g.strokeStyle = FX_INK; g.lineWidth = 11; g.stroke(); g.fillStyle = b; g.fill();
      path(0.74); g.fillStyle = a; g.fill();
      // halftone dots growing towards the rim of the inner burst
      fxCol.setStyle(a); const light = fxCol.r * 0.3 + fxCol.g * 0.6 + fxCol.b * 0.1 > 0.75;
      g.save(); path(0.74); g.clip(); g.fillStyle = light ? 'rgba(27,29,58,0.13)' : 'rgba(255,255,255,0.32)';
      for (let y = -208; y <= 208; y += 15) for (let x = -224; x <= 224; x += 15) {
        const ox = x + ((Math.round(y / 15) & 1) ? 7.5 : 0), d = Math.hypot(ox, y / 0.84) / 175;
        g.beginPath(); g.arc(ox, y, 0.8 + d * d * 5.2, 0, Math.PI * 2); g.fill();
      }
      g.restore();
      path(0.74); g.strokeStyle = FX_INK; g.lineWidth = 6; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 11; g.beginPath(); g.ellipse(0, 0, 122, 100, 0, Math.PI * 1.1, Math.PI * 1.32); g.stroke();
      g.beginPath(); g.arc(Math.cos(Math.PI * 1.4) * 122, Math.sin(Math.PI * 1.4) * 100, 6, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
      // lettering: per-letter bounce + tilt, ink extrude, ink outline, icy gradient fill
      const font = (s) => `${s}px "Lilita One", "Arial Black", sans-serif`;
      g.font = font(120); const fs = Math.min(120, 120 * 330 / g.measureText(word).width); g.font = font(fs);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.rotate(-0.1);
      const L = []; let tot = 0;
      for (let i = 0; i < word.length; i++) { const w = g.measureText(word[i]).width; L.push(w); tot += w; }
      const lay = []; let x = -tot / 2;
      for (let i = 0; i < word.length; i++) { lay.push(x + L[i] / 2, (i & 1 ? -1 : 1) * fs * 0.05 + 6, (rnd() - 0.5) * 0.2); x += L[i]; }
      const each = (fn) => { for (let i = 0; i < word.length; i++) { g.save(); g.translate(lay[i * 3], lay[i * 3 + 1]); g.rotate(lay[i * 3 + 2]); fn(word[i]); g.restore(); } };
      g.strokeStyle = FX_INK; g.fillStyle = FX_INK; g.lineWidth = 18;
      each((ch) => { g.strokeText(ch, 4, 10); g.fillText(ch, 4, 10); });
      each((ch) => { g.strokeText(ch, 0, 0); });
      each((ch) => {
        const gr = g.createLinearGradient(0, -fs * 0.4, 0, fs * 0.4); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#ffffff'); gr.addColorStop(1, '#bfe9ff');
        g.fillStyle = gr; g.fillText(ch, 0, 0);
      });
    });
  }
  function comicTex(word, a, b) {
    const key = word + a + b; let e = texCache[key];
    if (e && !e.ok && fontOk()) { e.t.dispose(); e = null; }
    if (!e) e = texCache[key] = { t: drawComic(word, a, b), ok: fontOk() };
    return e.t;
  }
  if (document.fonts) document.fonts.load('80px "Lilita One"').then(() => {
    for (const w of ['POW!', 'BONK!', 'WHAM!', 'SMACK!']) comicTex(w, '#ffd23f', '#ff5fa8');
    comicTex('SAVE!', '#72dc4e', '#ffffff'); comicTex('GOAL!', '#7fd0ff', '#ffd23f'); comicTex('GOAL!', '#ffb15c', '#ffd23f');
    comicTex('POWER!', '#c8f6ff', '#2fb8ff'); comicTex('CURVE!', '#c8f6ff', '#8d5bff');
    for (const c of TEAM_CSS) comicTex('POOF!', '#ffffff', c);
    if (renderer.initTexture) for (const k in texCache) renderer.initTexture(texCache[k].t);
  }).catch(() => {});
  // spinning sunburst rays behind big bursts (GOAL!)
  const rayTex = canvasTex(256, 256, (g) => {
    g.translate(128, 128);
    const gr = g.createRadialGradient(0, 0, 8, 0, 0, 126);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 127, a, a + Math.PI / 14); g.closePath(); g.fill(); }
  });
  const bursts = [], rays = [];
  const spriteMat = (map) => new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false, fog: false });
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Sprite(spriteMat(rayTex));
    s.visible = false; s.renderOrder = 10; scene.add(s); bursts.push({ s, life: 0, max: 0.9, size: 3, on: false, y: 0, r0: 0, ray: null });
  }
  for (let i = 0; i < 2; i++) { const s = new THREE.Sprite(spriteMat(rayTex)); s.visible = false; s.renderOrder = 9; scene.add(s); rays.push(s); }
  let bi = 0, rai = 0;
  function burst(word, pos, size = 3, a = '#ffd23f', b = '#ff5fa8') {
    const q = bursts[bi]; bi = (bi + 1) % bursts.length;
    if (q.ray && q.ray.userData.owner === q) q.ray.visible = false;
    q.ray = null;
    if (size >= 6) { const r = q.ray = rays[rai]; rai = (rai + 1) % rays.length; r.userData.owner = q; r.visible = true; r.material.color.set(b); r.position.copy(pos); r.scale.setScalar(0.001); }
    q.s.material.map = comicTex(word, a, b); q.s.material.needsUpdate = true; q.r0 = rand(-0.22, 0.22);
    q.s.position.copy(pos); q.y = pos.y; q.size = size; q.life = 0; q.max = 0.8 + size * 0.07; q.on = true; q.s.visible = true; q.s.scale.setScalar(0.001);
    fxCol.setStyle(a); const ca = fxCol.getHex(); fxCol.setStyle(b); const cb = fxCol.getHex();
    sparkBall(pos, Math.round(4 + size * 1.2), [ca, cb, 0xffffff], 4 + size * 1.6, 0.25 + size * 0.05, 0.6, 0);
  }
  // ---- shock: flat gradient ring + fresnel energy bubble
  const ringVS = 'varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const ringFS = `uniform vec3 uCol; uniform float uT, uOp; varying vec2 vUv;
void main(){
  float r = length(vUv), th = mix(0.5, 0.1, uT);
  float a = smoothstep(0.94 - th, 0.94, r) * (1.0 - smoothstep(0.94, 1.0, r));
  vec3 col = mix(uCol, vec3(1.0), smoothstep(0.94 - th * 0.35, 0.95, r));
  gl_FragColor = vec4(col * 1.15, (a * 0.85 + (1.0 - smoothstep(0.0, 0.94, r)) * 0.1) * uOp);` + FX_OUT;
  const bubVS = 'varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
  const bubFS = `uniform vec3 uCol; uniform float uBo; varying vec3 vN, vV;
void main(){
  float f = 1.0 - abs(dot(normalize(vN), vV));
  gl_FragColor = vec4(mix(uCol * 1.2, vec3(1.0), f * f), (pow(f, 2.5) * 0.9 + 0.08) * uBo);` + FX_OUT;
  const ringGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), bubGeo = new THREE.SphereGeometry(1, 32, 18);
  const rings = [];
  for (let i = 0; i < 4; i++) {
    const u = { uCol: { value: new THREE.Color() }, uT: { value: 0 }, uOp: { value: 0 }, uBo: { value: 0 } };
    const m = new THREE.Mesh(ringGeo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: ringVS, fragmentShader: ringFS, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    const bub = new THREE.Mesh(bubGeo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: bubVS, fragmentShader: bubFS, transparent: true, depthWrite: false }));
    m.renderOrder = 4; bub.renderOrder = 5; m.visible = bub.visible = false; scene.add(m, bub);
    rings.push({ m, bub, u, life: 0, max: 0.8, on: false, size: 12 });
  }
  let ri = 0;
  // delayed firework star-bursts for big shocks (goals)
  const fw = []; for (let i = 0; i < 10; i++) fw.push({ on: false, t: 0, p: new V3(), c: 0 });
  function shock(pos, color, size = 14) {
    const q = rings[ri]; ri = (ri + 1) % rings.length;
    q.m.position.copy(pos); q.bub.position.copy(pos); q.u.uCol.value.setHex(color);
    q.life = 0; q.max = 0.65 + size * 0.02; q.on = true; q.size = size; q.m.visible = q.bub.visible = true; q.m.scale.setScalar(0.001); q.bub.scale.setScalar(0.001);
    sparkBall(pos, Math.round(size * (size >= 14 ? 2.4 : 1)), [color, 0xffd23f, 0xffffff], size * 1.4, 0.55, 1.1, -4);
    if (size >= 14) {
      let n = 0;
      for (const f of fw) {
        if (f.on || n >= (fxHi() ? 5 : 2)) continue;
        f.on = true; f.t = 0.2 + n * 0.22 + rand(0, 0.1); f.c = n & 1 ? 0xffd23f : color;
        const m = fxMouth(pos);
        f.p.set(pos.x + rand(-11, 11), Math.max(pos.y, 2) + rand(6, 13), pos.z + (m ? m * rand(4, 14) : rand(-6, 6))); n++;
      }
    }
  }
  let warm = 3;   // draw every FX material on the first frames so shaders compile before the first goal
  // upload only the live part of a particle buffer (the first n values), not all of it
  function upTo(attr, n) { attr.clearUpdateRanges(); attr.addUpdateRange(0, n); attr.needsUpdate = true; }
  function update(dt) {
    fxSun.copy(sun.position).sub(sun.target.position).normalize();
    const hiQ = fxHi(), w = warm > 0;
    if (w) warm--;
    // puffs
    let k = 0;
    const pc = pMesh.instanceColor.array, pg = pGlow.array;
    for (let i = 0; i < MAXP; i++) {
      const q = P[i]; if (!q.on) continue;
      q.life += dt;
      if (q.life >= q.max) { q.on = false; continue; }
      q.v.y += q.g * dt; q.v.multiplyScalar(Math.max(0, 1 - q.drag * dt)); q.p.addScaledVector(q.v, dt);
      const t = q.life / q.max, u = 1 - t;
      let s = lerp(q.s0, q.s1, 1 - u * u);
      if (q.glow !== 1 && t > 0.6) { const f = (t - 0.6) / 0.4; s *= 1 - f * f; }
      s = Math.max(0.0001, s * fxStep(1.0, 3.6, q.p.distanceTo(camera.position)));   // melt away right in front of the lens (own boost trail)
      const sp = q.v.length(), e = Math.min(0.6, sp * 0.045) * u;
      if (e > 0.03) { fxQ.setFromUnitVectors(fxUp, fxV.copy(q.v).divideScalar(sp)); fxV2.set(s * (1 - e * 0.3), s * (1 + e), s * (1 - e * 0.3)); }
      else { fxQ.identity(); fxV2.setScalar(s); }
      fxM4.compose(q.p, fxQ, fxV2); fxM4.toArray(pMesh.instanceMatrix.array, k * 16);
      pc[k * 3] = q.r; pc[k * 3 + 1] = q.gg; pc[k * 3 + 2] = q.b; pg[k] = q.glow; k++;
    }
    pMesh.count = oMesh.count = k; pMesh.visible = k > 0 || w; oMesh.visible = (k > 0 || w) && hiQ;
    if (k) { upTo(pMesh.instanceMatrix, k * 16); upTo(pMesh.instanceColor, k * 3); upTo(pGlow, k); }
    // sparkles
    k = 0;
    const sp4 = sPos.array, sc4 = sCol.array;
    for (let i = 0; i < MAXS; i++) {
      const q = S[i]; if (!q.on) continue;
      q.life += dt;
      if (q.life >= q.max) { q.on = false; continue; }
      q.v.y += q.g * dt; q.v.multiplyScalar(Math.max(0, 1 - q.drag * dt)); q.p.addScaledVector(q.v, dt); q.rot += q.spin * dt;
      const t = q.life / q.max;
      const s = q.bub ? -q.size * (0.45 + 0.55 * Math.sqrt(t)) * (t > 0.9 ? 1 - (t - 0.9) * 8 : 1) * (1 + 0.06 * Math.sin(q.life * 9 + q.ph))
        : q.size * (t < 0.12 ? (t / 0.12) * 1.3 : t < 0.25 ? lerp(1.3, 1, (t - 0.12) / 0.13) : 1) * (t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1) * (0.8 + 0.2 * Math.sin(q.life * 26 + q.ph));
      const o = k * 4;
      sp4[o] = q.p.x; sp4[o + 1] = q.p.y; sp4[o + 2] = q.p.z; sp4[o + 3] = s;
      sc4[o] = q.r; sc4[o + 1] = q.gg; sc4[o + 2] = q.b; sc4[o + 3] = q.rot; k++;
    }
    sGeo.instanceCount = k; sMesh.visible = k > 0 || w;
    if (k) { upTo(sPos, k * 4); upTo(sCol, k * 4); }
    // confetti
    k = 0;
    const cp4 = cPos.array, cq4 = cRot.array, cc4 = cCol.array;
    for (let i = 0; i < MAXC; i++) {
      const q = C[i]; if (!q.on) continue;
      q.life += dt;
      if (q.life >= q.max) { q.on = false; continue; }
      if (!q.land) {
        q.v.y -= 9 * dt; q.v.multiplyScalar(Math.max(0, 1 - 1.7 * dt)); if (q.v.y < -2.6) q.v.y = -2.6;
        const fl = q.v.y < 0 ? 1.3 : 0.3;
        q.p.x += (q.v.x + Math.cos(q.life * q.fr + q.ph) * fl) * dt; q.p.y += q.v.y * dt; q.p.z += (q.v.z + Math.sin(q.life * q.fr * 0.8 + q.ph) * fl) * dt;
        fxQ.setFromAxisAngle(q.ax, q.spin * dt); q.q.premultiply(fxQ);
        if (q.p.y < q.gy) { q.p.y = q.gy; q.land = true; q.qt.setFromAxisAngle(fxUp, rand(0, 6.3)).multiply(fxQ.setFromAxisAngle(fxXA, -Math.PI / 2)); }
      } else q.q.slerp(q.qt, Math.min(1, dt * 14));
      const sz = q.size * (q.life > q.max - 0.5 ? (q.max - q.life) / 0.5 : 1) * Math.min(1, q.life * 8 + 0.2);
      const o = k * 4;
      cp4[o] = q.p.x; cp4[o + 1] = q.p.y; cp4[o + 2] = q.p.z; cp4[o + 3] = sz;
      cq4[o] = q.q.x; cq4[o + 1] = q.q.y; cq4[o + 2] = q.q.z; cq4[o + 3] = q.q.w;
      cc4[o] = q.r; cc4[o + 1] = q.gg; cc4[o + 2] = q.b; cc4[o + 3] = q.shape; k++;
    }
    cGeo.instanceCount = k; cMesh.visible = k > 0 || w;
    if (k) { upTo(cPos, k * 4); upTo(cRot, k * 4); upTo(cCol, k * 4); }
    // comic bursts: pop with overshoot, wobble, drift up, puff out
    if (w) { for (const q of bursts) if (!q.on) q.s.visible = warm > 0; for (const r of rays) if (!r.userData.owner) r.visible = warm > 0; for (const q of rings) if (!q.on) q.m.visible = q.bub.visible = warm > 0; }
    for (let i = 0; i < bursts.length; i++) {
      const q = bursts[i]; if (!q.on) continue;
      q.life += dt; const t = q.life / q.max;
      const ray = q.ray && q.ray.userData.owner === q ? q.ray : null;
      if (t >= 1) { q.on = false; q.s.visible = false; if (ray) ray.visible = false; continue; }
      let pop = t < 0.12 ? (t / 0.12) * 1.28 : t < 0.24 ? lerp(1.28, 0.94, (t - 0.12) / 0.12) : t < 0.34 ? lerp(0.94, 1, (t - 0.24) / 0.1) : 1 + (t - 0.34) * 0.08;
      if (t > 0.82) pop *= 1 + (t - 0.82) * 1.6;
      q.s.scale.setScalar(Math.max(0.001, q.size * pop)); q.s.position.y = q.y + q.life * 0.7;
      q.s.material.rotation = q.r0 + Math.sin(q.life * 10) * 0.07 * (1 - t);
      q.s.material.opacity = t > 0.82 ? 1 - (t - 0.82) / 0.18 : 1;
      if (ray) { ray.position.copy(q.s.position); ray.scale.setScalar(q.size * 2.2 * Math.min(1, pop)); ray.material.rotation = q.life * 0.6; ray.material.opacity = 0.75 * q.s.material.opacity; }
    }
    // shock rings + bubbles
    for (let i = 0; i < rings.length; i++) {
      const q = rings[i]; if (!q.on) continue;
      q.life += dt; const t = q.life / q.max;
      if (t >= 1) { q.on = false; q.m.visible = q.bub.visible = false; continue; }
      const e = 1 - (1 - t) * (1 - t) * (1 - t);
      const tb = Math.min(1, t / 0.55), bo = 1 - tb;
      q.m.scale.setScalar(0.5 + q.size * e); q.bub.scale.setScalar(0.3 + q.size * 0.5 * (1 - bo * bo * bo)); q.bub.visible = tb < 1;
      q.u.uT.value = t; q.u.uOp.value = (1 - t) * (1 - t * 0.5); q.u.uBo.value = bo * bo;
    }
    // goal fireworks
    for (let i = 0; i < fw.length; i++) {
      const f = fw[i]; if (!f.on) continue;
      f.t -= dt; if (f.t > 0) continue;
      f.on = false;
      sparkBall(f.p, hiQ ? 26 : 12, [f.c, 0xffffff, 0xff5fa8], 11, 0.6, 1.2, -5);
      for (let j = 0; j < 6; j++) puff(f.p.x, f.p.y, f.p.z, rand(-5, 5), rand(-3, 5), rand(-5, 5), 0.5, 0.12, 0.5, f.c, 0, 3);
    }
  }
  function clear() {
    for (let i = 0; i < MAXP; i++) P[i].on = false;
    for (let i = 0; i < MAXS; i++) S[i].on = false;
    for (let i = 0; i < MAXC; i++) C[i].on = false;
    for (let i = 0; i < fw.length; i++) fw[i].on = false;
    for (const q of bursts) { q.on = false; q.s.visible = false; }
    for (const r of rays) r.visible = false;
    for (const q of rings) { q.on = false; q.m.visible = q.bub.visible = false; }
    pMesh.count = oMesh.count = sGeo.instanceCount = cGeo.instanceCount = 0;
  }
  return { puff, confetti, burst, shock, update, clear, spark };
})();
function puffBurst(pos, n, color, speed = 6, size = 0.6) {
  const m = fxMouth(pos);
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), e = rand(-0.2, 1.2), s = speed * rand(0.4, 1), vz = Math.sin(a) * Math.cos(e) * s;
    FX.puff(pos.x, pos.y, pos.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s, m ? m * (Math.abs(vz) + s * 0.25) : vz, size * rand(0.6, 1.1), size * rand(1.2, 1.8), rand(0.5, 0.9), color, -2, 3);
  }
  // bright bursts also throw a few glints
  fxCol.setHex(color);
  if (fxCol.r * 0.2126 + fxCol.g * 0.7152 + fxCol.b * 0.0722 > 0.5) {
    // (nG, not m: m is the goal-mouth direction from above, which the glints should fly along too)
    for (let i = 0, nG = Math.ceil(n * 0.3); i < nG; i++) {
      const a = rand(0, Math.PI * 2), e = rand(0, 1.3), s = speed * rand(0.7, 1.3), vz = Math.sin(a) * Math.cos(e) * s;
      FX.spark(pos.x, pos.y, pos.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s, m ? m * Math.abs(vz) : vz, size * rand(0.5, 0.9), rand(0.45, 0.8), color === 0xffffff ? (Math.random() < 0.5 ? 0xfff4b8 : 0xffffff) : color, -3, 2.5);
    }
  }
}
