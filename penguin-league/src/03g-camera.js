// =====================================================================
//  CAMERA + SHOWROOM — game camera, cinematic menu camera, garage/locker showroom
// =====================================================================
// ----------------------------------------------------------- game camera
const CAM = { pos: new V3(0, 25, -70), yaw: 0, pitch: -0.1, shake: 0, cineA: 0, look: new V3(), lag: 0 };
const CAM_SCALE = 1.33;   // penguin is ~1.33x the size of the classic car, so the classic camera numbers scale by this
const _cp = new V3(), _cb = new V3(), _cd = new V3(), _cn = new V3(), _cl = new V3();
function setFov() {
  const hf = save.settings.fov * Math.PI / 180;
  let vf = 2 * Math.atan(Math.tan(hf / 2) / Math.max(0.5, camera.aspect)) * 180 / Math.PI;
  camera.fov = clamp(vf, 40, 120); camera.updateProjectionMatrix();   // keeps the horizontal FOV like Rocket League
}
function keepInside(p, margin) {
  const d = arenaD(p.x, p.y, p.z);
  if (d < margin) { arenaN(p.x, p.y, p.z, _cn); p.addScaledVector(_cn, margin - d); }
}
function updateCamera(dt, alpha) {
  setFov();
  if (CAM.override) { camera.position.copy(CAM.override.pos); camera.lookAt(CAM.override.look); return; }
  const b = M.ball;
  _cb.lerpVectors(b.pp, b.p, alpha);
  const pl = M.player;
  if (!pl || M.demo || M.state === 'idle') {
    CAM.cineA += dt * 0.08;
    const r = Math.min(A.hx, A.hz) * 0.75;
    _cd.set(_cb.x * 0.4 + Math.sin(CAM.cineA) * r, 13, _cb.z * 0.4 + Math.cos(CAM.cineA) * r);
    keepInside(_cd, 3);
    CAM.pos.lerp(_cd, 1 - Math.exp(-dt * 2));
    CAM.look.lerp(_cb, 1 - Math.exp(-dt * 3));
    camera.position.copy(CAM.pos); camera.lookAt(CAM.look);
    return;
  }
  _cp.lerpVectors(pl.pp, pl.p, alpha);
  const ballCam = save.settings.ballCam && !M.ballHidden;
  let tx, tz;
  if (ballCam) { tx = _cb.x - _cp.x; tz = _cb.z - _cp.z; }
  else {
    const hv = Math.hypot(pl.v.x, pl.v.z);
    if (pl.onGround && hv > 3 && pl.v.dot(pl.fwd) > 0) { tx = pl.v.x; tz = pl.v.z; }
    else { tx = pl.fwd.x; tz = pl.fwd.z; if (Math.hypot(tx, tz) < 0.3) { tx = pl.v.x; tz = pl.v.z; } }
  }
  if (Math.hypot(tx, tz) > 0.05) CAM.yaw = lerpAngle(CAM.yaw, Math.atan2(tx, tz), 1 - Math.exp(-dt * (ballCam ? 10 : 7)));
  // Rocket League pro camera (distance 270, height 100, angle -3°, stiffness 0.45) scaled to the penguin;
  // like RL, a soft camera lets the penguin pull ahead a little at speed
  CAM.lag = damp(CAM.lag, (1 - 0.45) * 0.45 * clamp(Math.max(0, pl.v.dot(pl.fwd)) / VMAX, 0, 1), 3, dt);
  const dist = 2.7 * CAM_SCALE * save.settings.camDist * (1 + CAM.lag), height = 1.0 * CAM_SCALE * (0.6 + 0.4 * save.settings.camDist);
  const sx = Math.sin(CAM.yaw), sz = Math.cos(CAM.yaw);
  _cd.set(_cp.x - sx * dist, _cp.y + height, _cp.z - sz * dist);
  keepInside(_cd, 0.7);
  if (pl.demolished) _cd.copy(CAM.pos);
  CAM.pos.lerp(_cd, 1 - Math.exp(-dt * 22));
  let pitchT = -0.052;   // camera angle -3°
  if (ballCam) {
    const dx = _cb.x - CAM.pos.x, dz = _cb.z - CAM.pos.z, dy = _cb.y - (CAM.pos.y - 0.6);
    pitchT = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.4, 0.62) - 0.06;
  }
  CAM.pitch = damp(CAM.pitch, pitchT, 7, dt);
  _cl.set(CAM.pos.x + sx * Math.cos(CAM.pitch) * 10, CAM.pos.y + Math.sin(CAM.pitch) * 10, CAM.pos.z + sz * Math.cos(CAM.pitch) * 10);
  camera.position.copy(CAM.pos);
  if (CAM.shake > 0) { CAM.shake = Math.max(0, CAM.shake - dt * 1.6); const s = CAM.shake * CAM.shake * 0.6; camera.position.x += rand(-s, s); camera.position.y += rand(-s, s); camera.position.z += rand(-s, s); }
  camera.lookAt(_cl);
}

// ----------------------------------------------------------- showroom (garage + locker)
// A little ice stage: frosty sky dome with slow light rays and twinkling sparkles, a ring of glossy ice crystals,
// soft snowy ground fading into the horizon, an ice-block podium with a snow cap, falling snow and glints.
let showroom = null;
const GFX_SR_DOME_FS = `uniform float uTime; uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 glow; varying vec3 vP;
float srH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 d = normalize(vP); float h = d.y;
  vec3 c = mix(hor, mid, smoothstep(-0.03, 0.13, h));
  c = mix(c, top, smoothstep(0.1, 0.5, h));
  vec3 g = normalize(vec3(-0.12, 0.16, -1.0));
  float cg = max(dot(d, g), 0.0);
  c += glow * pow(cg, 12.0) * 0.28;
  vec3 rx = normalize(cross(g, vec3(0.0, 1.0, 0.0))), ry = cross(rx, g);
  float ang = atan(dot(d, ry), dot(d, rx));
  float ray = 0.5 + 0.5 * sin(ang * 11.0 + uTime * 0.1);
  c += glow * ray * ray * 0.1 * smoothstep(0.5, 0.92, cg) * smoothstep(-0.02, 0.06, h);
  c = min(c, vec3(0.95));
  vec2 uv = vec2(atan(d.x, -d.z) * 9.0, h * 16.0);
  vec2 id = floor(uv), f = fract(uv) - 0.5;
  float r = srH(id);
  if (r > 0.62 && h > 0.05) {
    vec2 o = (vec2(srH(id + 3.1), srH(id + 7.7)) - 0.5) * 0.4;
    vec2 q = (f - o) * vec2(6.4, 3.6);
    vec2 a = abs(q);
    float tw = pow(0.5 + 0.5 * sin(uTime * (1.2 + r * 2.5) + r * 60.0), 2.0);
    float st = smoothstep(0.8, 0.0, a.x) * smoothstep(0.07, 0.0, a.y) + smoothstep(0.8, 0.0, a.y) * smoothstep(0.07, 0.0, a.x);
    st += smoothstep(0.22, 0.0, length(q)) * 1.5;
    c += vec3(1.0, 0.97, 0.88) * st * tw * 1.6;
  }
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
function gfxSrSprite(draw) { return canvasTex(128, 128, (g, w) => { g.clearRect(0, 0, w, w); g.translate(w / 2, w / 2); draw(g, w / 2); }); }
function buildShowroom() {
  const sc = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(34, camera.aspect, 0.1, 140);
  const HOR = 0x9fdbff;
  sc.fog = new THREE.Fog(HOR, 18, 58);
  sc.environment = gfxEnvMap({ top: 0x6cb4f0, hor: 0xbfe6fb, gnd: 0x9fc4e0, sun: [3.5, 6, 5], sunC: 0xfff0d8, sunK: 1.6, blobs: [[-0.6, 0.55, 0.6, 1.1], [0.95, 0.25, 0.25, 0.6], [0.1, 0.45, -1, 0.8], [-0.9, 0.1, -0.3, 0.4]] });
  const uTime = { value: 0 };
  // backdrop dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(70, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime, top: { value: new THREE.Color(0x2a66d8) }, mid: { value: new THREE.Color(0x3f9ff8) }, hor: { value: new THREE.Color(HOR) }, glow: { value: new THREE.Color(0xffffff) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: GFX_SR_DOME_FS,
  }));
  dome.renderOrder = -1; sc.add(dome);
  // lights: soft hemi, warm key with shadow, cool rim from behind
  sc.add(new THREE.HemisphereLight(0xe2f4ff, 0xb9d3ea, 0.25));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.6); key.position.set(3.5, 6, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025;
  Object.assign(key.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 1, far: 20 }); sc.add(key);
  const rim = new THREE.DirectionalLight(0xa6dcff, 0.65); rim.position.set(-4, 3.5, -5); sc.add(rim);
  // snowy ground that melts into the horizon fog
  const groundTex = canvasTex(512, 512, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    [[0, '#ffffff'], [0.045, '#f4fbff'], [0.07, '#c8ecff'], [0.16, '#86cfff'], [0.4, '#7cc8ff'], [1, '#9fdbff']].forEach((c) => gr.addColorStop(c[0], c[1]));
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), toon(0xffffff, { map: groundTex, roughness: 0.55, rim: 0, envMapIntensity: 0.35 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.56; ground.receiveShadow = true; sc.add(ground);
  // distant snowy hills
  const hillMat = toon(0xeaf6ff, { roughness: 0.8, envMapIntensity: 0.35 });
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.36 + rand(-0.08, 0.08), d = rand(20, 30), s = rand(4, 8);
    sc.add(mk(GEO.sphere, null, { mat: hillMat, s: [s * 1.5, s * rand(0.45, 0.7), s], p: [Math.cos(a) * d, -0.8, Math.sin(a) * d], o: 0.09, cast: false }));
  }
  // glossy ice crystals around the back
  const prism = new THREE.CylinderGeometry(0.82, 1, 1, 6); prism.translate(0, 0.5, 0);
  const tipG = new THREE.ConeGeometry(0.82, 1, 6); tipG.translate(0, 0.5, 0);
  const crysMat = {};
  const crystal = (x, z, h, r, col, tx, tz) => {
    const m = crysMat[col] || (crysMat[col] = toon(col, { flatShading: true, roughness: 0.22, envMapIntensity: 0.6, emissive: col, emissiveIntensity: 0.06 }));
    const g = new THREE.Group(); g.position.set(x, -0.62, z); g.rotation.set(tx, rand(0, 1), tz);
    g.add(mk(prism, null, { mat: m, s: [r, h, r], o: 0.045, cast: false }));
    g.add(mk(tipG, null, { mat: m, s: [r, r * 1.5, r], p: [0, h, 0], o: 0.045, cast: false }));
    sc.add(g); return g;
  };
  const glintAt = [];
  [[-3.4, -4.3, 2.9, 0.5, 0x9be6ff, 0.05, 0.22], [-4.5, -5.8, 4.4, 0.72, 0x7fd3ff, 0.02, 0.12], [-2.4, -6.6, 2.1, 0.42, 0xc2f2ff, -0.1, 0.05],
    [-2.6, -3.0, 1.45, 0.34, 0xc4b0ff, 0.12, 0.3], [-1.3, -7.6, 3.2, 0.5, 0x9be6ff, -0.05, -0.1], [-5.6, -2.6, 1.6, 0.36, 0xffb8de, 0.1, 0.4],
    [3.1, -5.2, 3.3, 0.58, 0x8fdcff, 0.04, -0.2], [4.4, -6.8, 5.0, 0.8, 0x7fd3ff, -0.02, -0.1], [2.2, -7.9, 2.4, 0.45, 0xc2f2ff, 0.1, 0.05],
    [2.1, -4.1, 1.6, 0.36, 0xffb8de, 0.08, -0.3], [5.6, -4.2, 2.1, 0.42, 0xc4b0ff, 0.1, -0.35], [0.9, -9.5, 2.6, 0.55, 0x9be6ff, 0, 0]].forEach((c) => {
    const g = crystal(...c); g.updateMatrixWorld();
    glintAt.push(new V3(0, c[2] + c[3] * 1.2, 0).applyMatrix4(g.matrixWorld));
  });
  // podium: faceted ice block, pillowy snow cap with drips, sun-yellow base ring, snow lumps
  const ice = toon(0x6fcdff, { flatShading: true, roughness: 0.2, envMapIntensity: 0.8, emissive: 0x1f7fc4, emissiveIntensity: 0.15 });
  const block = mk(new THREE.CylinderGeometry(1.42, 1.56, 0.56, 10), null, { mat: ice, p: [0, -0.32, 0], o: 0.035 }); block.receiveShadow = true; sc.add(block);
  const capPts = [[1.42, -0.2], [1.56, -0.18], [1.63, -0.12], [1.6, -0.06], [1.48, -0.015], [1.2, 0], [0.6, 0.004], [0.001, 0.004]].map((p) => new THREE.Vector2(p[0], p[1]));
  const snow = toon(0xfbfdff, { roughness: 0.72, envMapIntensity: 0.3 });
  const cap = mk(new THREE.LatheGeometry(capPts, 64), null, { mat: snow, o: 0.035 }); cap.receiveShadow = true; sc.add(cap);
  for (let i = 0; i < 11; i++) {
    const a = i * Math.PI * 2 / 11 + rand(-0.15, 0.15), l = rand(0.14, 0.26);
    sc.add(mk(GEO.sphere, null, { mat: snow, s: [rand(0.1, 0.15), l, 0.1], p: [Math.cos(a) * 1.55, -0.16 - l * 0.35, Math.sin(a) * 1.55], r: [0, -a, 0], cast: false }));
  }
  sc.add(mk(new THREE.TorusGeometry(1.6, 0.12, 14, 72), 0xffd23f, { p: [0, -0.5, 0], r: [Math.PI / 2, 0, 0], o: 0.03, cast: false }));
  const NL = 12, lumps = new THREE.InstancedMesh(GEO.sphere, toon(0xf6faff, { roughness: 0.8, envMapIntensity: 0.3 }), NL);
  const lumpsOl = new THREE.InstancedMesh(GEO.sphere, gfxOutlineW(0.035), NL);
  const mm = new THREE.Matrix4(), qq = new Q(), ss = new V3(), pp = new V3();
  for (let i = 0; i < NL; i++) {
    const a = i * Math.PI * 2 / NL + rand(-0.15, 0.15), d = rand(1.85, 2.3), s = rand(0.18, 0.34);
    pp.set(Math.cos(a) * d, -0.58, Math.sin(a) * d); ss.set(s * 1.3, s * 0.55, s); qq.setFromAxisAngle(UP, rand(0, 3)); mm.compose(pp, qq, ss);
    lumps.setMatrixAt(i, mm); lumpsOl.setMatrixAt(i, mm);
  }
  lumps.receiveShadow = true; sc.add(lumps, lumpsOl);
  // soft contact shadow under the penguin
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.85, 40), new THREE.MeshBasicMaterial({
    map: gfxSrSprite((g, r) => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, 'rgba(27,29,58,.55)'); gr.addColorStop(0.55, 'rgba(27,29,58,.25)'); gr.addColorStop(1, 'rgba(27,29,58,0)'); g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r); }),
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; blob.renderOrder = 1; sc.add(blob);
  // twinkling glints on crystal tips + around the podium
  const starTex = gfxSrSprite((g, r) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.5); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r);
    g.fillStyle = '#fff'; g.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.16 : r * 0.95; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fill();
  });
  for (let i = 0; i < 6; i++) { const a = rand(0, Math.PI * 2); glintAt.push(new V3(Math.cos(a) * 1.5, rand(-0.45, -0.1), Math.sin(a) * 1.5)); }
  const glints = glintAt.map((p, i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: gfxGlow(0xffffff, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.copy(p); sp.renderOrder = 3; sc.add(sp);
    return { sp, ph: rand(0, 6.28), rate: rand(0.9, 1.8), size: i < 12 ? rand(0.5, 0.8) : rand(0.22, 0.34) };
  });
  // falling snow
  const NF = 240, fpos = new Float32Array(NF * 3), flakes = [];
  for (let i = 0; i < NF; i++) flakes.push({ x: rand(-7, 8), y: rand(-0.6, 5.5), z: rand(-9, 4.5), v: rand(0.25, 0.6), ph: rand(0, 6.28) });
  const fgeo = new THREE.BufferGeometry(); fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  const snowPts = new THREE.Points(fgeo, new THREE.PointsMaterial({
    size: 0.075, sizeAttenuation: true, transparent: true, depthWrite: false, color: 0xffffff,
    map: gfxSrSprite((g, r) => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r); }),
  }));
  snowPts.frustumCulled = false; snowPts.renderOrder = 4; sc.add(snowPts);
  const holder = new THREE.Group(); holder.position.y = 0.34; sc.add(holder);
  showroom = { sc, cam, holder, model: null, key, uTime, glints, flakes, fpos, fgeo, blob, yaw: -0.6, spin: 0, drag: null };
  resize();
}
function refreshShowroomPenguin() {
  if (!showroom) return;
  if (showroom.model) showroom.holder.remove(showroom.model.root);
  showroom.model = buildPenguin(0, save.equip, { gold: save.upgrades.thrust >= 5 });
  showroom.model.root.traverse((o) => { if (o.isMesh && !o.material.isShaderMaterial) o.castShadow = true; });
  showroom.holder.add(showroom.model.root);
}
function renderShowroom(dt) {
  const s = showroom; if (!s) return;
  const wide = camera.aspect > 1.15;
  const t = performance.now() / 1000;
  s.uTime.value = t;
  // turntable (s.spin = 1 after a purchase: quick celebratory twirl + hop)
  if (!s.drag) s.yaw += dt * (0.5 + s.spin * 11);
  const hop = s.spin > 0 ? Math.sin((1 - s.spin) * Math.PI) * 0.45 : 0;
  s.spin = Math.max(0, s.spin - dt * 1.4);
  s.holder.rotation.y = s.yaw;
  const m = s.model;
  if (m) {
    const fl = hop > 0 ? 0.7 : 0.3, fs = hop > 0 ? 18 : 5;
    m.flippers[0].rotation.z = -0.15 + Math.sin(t * fs) * fl; m.flippers[1].rotation.z = 0.15 - Math.sin(t * fs) * fl;
    m.root.position.y = (0.5 + 0.5 * Math.sin(t * 2)) * 0.05 + hop;
    if (m.hat.userData.spin) m.hat.userData.spin.rotation.y += dt * 10;
    if (m.hat.userData.halo) m.hat.userData.halo.position.y = 0.32 + Math.sin(t * 3) * 0.03;
    m.head.rotation.y = Math.sin(t * 0.8) * 0.3;
    const lift = m.root.position.y;
    s.blob.scale.setScalar(1 - Math.min(0.5, lift * 1.2)); s.blob.material.opacity = 1 - Math.min(0.7, lift * 1.6);
  }
  for (const g of s.glints) { const k = Math.max(0, Math.sin(t * g.rate + g.ph)); g.sp.scale.setScalar(g.size * k * k * k + 0.0001); g.sp.material.rotation = t * 0.4 + g.ph; }
  const fp = s.fpos;
  s.flakes.forEach((f, i) => {
    f.y -= dt * f.v; f.x += Math.sin(t * 0.9 + f.ph) * dt * 0.18;
    if (f.y < -0.6) { f.y = 5.5; f.x = rand(-7, 8); f.z = rand(-9, 4.5); }
    fp[i * 3] = f.x; fp[i * 3 + 1] = f.y; fp[i * 3 + 2] = f.z;
  });
  s.fgeo.attributes.position.needsUpdate = true;
  s.cam.position.set((wide ? 1.9 : 0) + Math.sin(t * 0.23) * 0.12, (wide ? 1.45 : 1.6) + Math.sin(t * 0.31) * 0.05, wide ? 7.4 : 9 + clamp(1.15 - camera.aspect, 0, 0.7) * 4);
  s.cam.lookAt(wide ? 1.9 : 0, wide ? 0.35 : -0.5, 0);
  gfxOlU.uMaxPx.value = gfxOlU.uMaxPx.base * 1.35;
  gfxRender(s.sc, s.cam);
  gfxOlU.uMaxPx.value = gfxOlU.uMaxPx.base;
}
