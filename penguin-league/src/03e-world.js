// =====================================================================
//  WORLD — sky, sea, snowy iceberg island, mountains, icebergs, floes, clouds, snowfall
// =====================================================================
// shared uniforms of the world shaders (kept fresh by the frame hook at the bottom)
const worldU = {
  uTime: { value: 0 }, uHi: { value: 1 },
  uSunDir: { value: new V3(0.41, 0.87, 0.27) },
  uHaze: { value: new THREE.Color(0xd3f0ff) },
  uFoot: { value: new THREE.Vector4(40.96, 51.2, 11, 27) },   // rink half-width, half-length, corner radius, stands depth
  uStandH: { value: 22 },
};
(function buildWorld() {
  const SEA_Y = -8, PLAT_Y = -0.6, TAU = Math.PI * 2;
  // seeded random so the scenery is the same on every load
  let seed = 7331;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rr = (a, b) => a + rnd() * (b - a);
  const vec = (hex) => { const c = new THREE.Color(hex); return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`; };
  const wrapA = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
  const h1 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const n1 = (a, k) => { const x = (a / TAU) * k, i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return h1(((i % k) + k) % k) * (1 - u) + h1((((i + 1) % k) + k) % k) * u; };   // periodic around the circle
  // island outline (same formula in GLSL so the surf hugs the shore)
  const LH_A = 1.05;
  const islandR = (a) => { const d = wrapA(a - LH_A); return 166 + 7 * Math.sin(3 * a + 0.6) + 5 * Math.sin(5 * a + 2.1) + 2.5 * Math.sin(9 * a + 4) + 16 * Math.exp(-(d / 0.13) * (d / 0.13)); };
  const bank = (a) => 0.7 + 1.7 * n1(a, 23) * (0.55 + 0.45 * n1(a + 1, 61)) + 1.6 * Math.exp(-((wrapA(a - LH_A) / 0.07) ** 2));
  const drip = (a) => 0.25 + 1.5 * Math.pow(Math.max(0, Math.sin(a * 140 + 3 * Math.sin(a * 11))), 3);
  const GL_NOISE = `
    float wHash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float wNoise(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
      return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x), u.y); }
    float wIslandR(float a){ float d = mod(a - ${LH_A.toFixed(3)} + 3.14159265, 6.28318531) - 3.14159265;
      return 166.0 + 7.0 * sin(3.0 * a + 0.6) + 5.0 * sin(5.0 * a + 2.1) + 2.5 * sin(9.0 * a + 4.0) + 16.0 * exp(-(d / 0.13) * (d / 0.13)); }`;
  const GL_OUT = `
    #include <tonemapping_fragment>
    #include <colorspace_fragment>`;

  // ------------------------------------------------- lit material for scenery: soft wrap light, cool fill, gloss, rim, aerial haze
  const LIT_VS = `
    uniform float uTime;
    varying vec3 vC; varying vec3 vN; varying vec3 vW;
    #ifdef W_BOB
    attribute vec2 aBob;
    #endif
    #ifdef W_MTN
    attribute float aH; varying float vH;
    #endif
    #ifdef W_TINT
    attribute float aTint;
    #endif
    void main(){
      vec4 wp = vec4(position, 1.0); vec3 n = normal;
      #ifdef USE_INSTANCING
      wp = instanceMatrix * wp; n = mat3(instanceMatrix) * n;
      #endif
      wp = modelMatrix * wp; n = mat3(modelMatrix) * n;
      #ifdef W_BOB
      wp.y += sin(uTime * 0.55 + aBob.x) * aBob.y;
      #endif
      vC = vec3(1.0);
      #ifdef USE_COLOR
      vC = color.rgb;
      #endif
      #ifdef USE_INSTANCING_COLOR
      #ifdef W_TINT
      vC = mix(vC, vC * instanceColor, aTint);
      #else
      vC *= instanceColor;
      #endif
      #endif
      #ifdef W_MTN
      vH = aH;
      #endif
      vN = n; vW = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const LIT_FS = `
    uniform float uTime, uHi, uStandH; uniform vec3 uSunDir, uHaze; uniform vec4 uP, uFoot;
    varying vec3 vC; varying vec3 vN; varying vec3 vW;
    #ifdef W_MTN
    varying float vH;
    #endif
    ${GL_NOISE}
    float wRBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    void main(){
      vec3 toCam = cameraPosition - vW; float dist = length(toCam); vec3 V = toCam / dist;
      #ifdef W_FLAT
      vec3 N = normalize(cross(dFdx(vW), dFdy(vW)));
      if (dot(N, V) < 0.0) N = -N;
      #else
      vec3 N = normalize(vN);
      #endif
      vec3 L = normalize(uSunDir);
      vec3 base = vC;
      #ifdef W_MTN
      float fw = fwidth(vH) + 0.002;
      float st = 0.64 - 0.17 * smoothstep(0.45, 0.9, N.y) + (wNoise(vW.xz * 0.012) - 0.5) * 0.2;
      vec3 rock = mix(${vec(0x4a86e8)}, ${vec(0xa8d6ff)}, smoothstep(0.0, 0.62, vH));
      base = mix(rock, ${vec(0xf1f7ff)}, smoothstep(st - fw, st + fw, vH));
      #endif
      float sh = 1.0;
      #ifdef W_SNOW
      vec2 pp = vW.xz;
      float sd = wRBox(pp, uFoot.xy, uFoot.z);
      base *= 1.0 - 0.16 * (1.0 - smoothstep(uFoot.w - 1.0, uFoot.w + 18.0, sd));
      float ss = wRBox(pp + L.xz / max(L.y, 0.25) * uStandH, uFoot.xy, uFoot.z);
      sh = smoothstep(uFoot.w - 2.5, uFoot.w + 2.5, ss);
      base *= 0.95 + 0.05 * wNoise(pp * 0.06);
      #endif
      float nl = dot(N, L);
      float dif = smoothstep(-0.3, 0.9, nl) * mix(0.12, 1.0, sh);
      vec3 amb = mix(${vec(0x5a7db8)}, ${vec(0x94bde6)}, N.y * 0.5 + 0.5);
      vec3 col = base * (amb + ${vec(0xc4b6a0)} * dif);
      col += ${vec(0xfff6e4)} * pow(max(dot(N, normalize(L + V)), 0.0), uP.y) * uP.x * dif;
      col += ${vec(0xc4e8ff)} * pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.2;
      #ifdef W_SNOW
      if (uHi > 0.5) {
        float px = length(fwidth(pp));
        vec2 g = pp / 3.0, c = floor(g), f = fract(g) - 0.5;
        float h = wHash(c + 3.7);
        vec2 dd = (f - (vec2(wHash(c + 17.0), wHash(c + 29.0)) - 0.5) * 0.6) * 3.0;
        float tw = pow(max(sin(uTime * 1.3 + h * 40.0 + V.x * 9.0 + V.z * 7.0), 0.0), 8.0);
        col += (1.0 - smoothstep(0.0, 0.2 + px, abs(dd.x) + abs(dd.y))) * tw * step(0.6, h) * (1.0 - smoothstep(0.08, 0.3, px)) * 1.2 * sh;
      }
      #endif
      #ifdef W_MTN
      col = mix(col, base * 0.97, 0.3);
      #endif
      float hz = smoothstep(uP.z, uP.w, dist) * (1.0 - 0.45 * smoothstep(40.0, 420.0, vW.y));
      col = mix(col, uHaze, hz);
      gl_FragColor = vec4(col, 1.0);
      ${GL_OUT}
    }`;
  const litMat = (defs, spec, shin, h0, h1_) => new THREE.ShaderMaterial({
    defines: defs, vertexColors: true, vertexShader: LIT_VS, fragmentShader: LIT_FS,
    uniforms: { uTime: worldU.uTime, uHi: worldU.uHi, uSunDir: worldU.uSunDir, uHaze: worldU.uHaze, uFoot: worldU.uFoot, uStandH: worldU.uStandH, uP: { value: new THREE.Vector4(spec, shin, h0, h1_) } },
  });

  // ------------------------------------------------- geometry accumulators (merge many parts into one draw call)
  const acc = () => ({ p: [], n: [], c: [], x: [] });
  const _m = new THREE.Matrix4(), _nm = new THREE.Matrix3(), _q = new Q(), _eu = new THREE.Euler(), _v = new V3(), _w = new V3(), _col = new THREE.Color();
  function add(T, geo, color, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0], ex = []) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    _m.compose(_v.set(p[0], p[1], p[2]), _q.setFromEuler(_eu.set(r[0], r[1], r[2], r[3] || 'XYZ')), _w.set(s[0], s[1], s[2])); _nm.getNormalMatrix(_m);
    const P = g.attributes.position, N = g.attributes.normal;
    _col.setHex(color);
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(_m); T.p.push(_v.x, _v.y, _v.z);
      _w.fromBufferAttribute(N, i).applyMatrix3(_nm).normalize(); T.n.push(_w.x, _w.y, _w.z);
      T.c.push(_col.r, _col.g, _col.b);
      for (const e of ex) T.x.push(e);
    }
  }
  const _e1 = new V3(), _e2 = new V3();
  function tri(T, a, b, c, ca, cb, cc, xa, xb, xc) {
    _e1.subVectors(b, a); _e2.subVectors(c, a); _e1.cross(_e2).normalize();
    for (const [v, cl, x] of [[a, ca, xa], [b, cb, xb], [c, cc, xc]]) { T.p.push(v.x, v.y, v.z); T.n.push(_e1.x, _e1.y, _e1.z); T.c.push(cl.r, cl.g, cl.b); for (const e of x) T.x.push(e); }
  }
  function geoOf(T, xName, xSize) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(T.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(T.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(T.c, 3));
    if (xName) g.setAttribute(xName, new THREE.Float32BufferAttribute(T.x.length ? T.x : new Array((T.p.length / 3) * xSize).fill(0), xSize));
    g.computeBoundingSphere(); return g;
  }
  const C = (hex) => new THREE.Color(hex);
  const world = new THREE.Group(); world.name = 'world'; scene.add(world);
  const addMesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = false; m.receiveShadow = false; world.add(m); return m; };

  // ------------------------------------------------- sky dome: vivid gradient, soft sun, stylised cloud bands (always centred on the camera)
  const skyMat = new THREE.ShaderMaterial({
    depthWrite: false,
    uniforms: { uSunDir: worldU.uSunDir, uHaze: worldU.uHaze, uMid: { value: new THREE.Color(0x6cc0ff) }, uZen: { value: new THREE.Color(0x2f7df5) } },
    vertexShader: `varying vec3 vD;
      void main(){ vD = position; gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + position, 1.0); gl_Position.z = gl_Position.w * 0.99999; }`,
    fragmentShader: `uniform vec3 uSunDir, uHaze, uMid, uZen; varying vec3 vD;
      float wH1(float n){ return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
      // one ring of cartoon cloud strips around the horizon: returns (coverage, height within the cloud)
      vec2 wBand(float az, float e, float N, float e0, float th, float sd, float pe, float scal){
        float s = az * N / 6.2831853 + sd;
        float id = mod(floor(s), N), u = fract(s);
        if (wH1(id + sd * 13.0) < 0.28) return vec2(0.0);
        float len = 0.55 + 0.4 * wH1(id * 3.1 + sd);
        float uu = (u - (1.0 - len) * 0.5) / len;
        if (uu <= 0.0 || uu >= 1.0) return vec2(0.0);
        float env = pow(sin(3.14159265 * uu), 0.3);
        float ec = e0 + (wH1(id * 1.7 + sd * 5.0) - 0.5) * th * 1.4;
        float bump = 1.0;
        if (scal > 0.0) { float k = uu * scal, bu = fract(k) * 2.0 - 1.0; bump = sqrt(max(0.0, 1.0 - bu * bu)) * (0.55 + 0.45 * wH1(floor(k) + id * 9.0 + sd)); }
        float top = ec + th * env * (0.45 + 0.55 * bump), bot = ec - th * env * 0.14;
        return vec2(smoothstep(-pe, pe, min(top - e, e - bot)), clamp((e - bot) / max(top - bot, 1e-4), 0.0, 1.0));
      }
      void main(){
        vec3 d = normalize(vD);
        float e = asin(clamp(d.y, -1.0, 1.0)), az = atan(d.z, d.x);
        float pe = max(fwidth(e), 1e-4);
        vec3 c = mix(uHaze, uMid, smoothstep(0.0, 0.32, e));
        c = mix(c, uZen, smoothstep(0.22, 1.25, e));
        c = mix(c, vec3(1.0), 0.22 * (1.0 - smoothstep(0.0, 0.07, abs(e))));
        vec3 L = normalize(uSunDir);
        float sd = max(dot(d, L), 0.0), ang = acos(clamp(dot(d, L), -1.0, 1.0));
        c = mix(c, vec3(1.0, 0.95, 0.78), clamp(pow(sd, 6.0) * 0.22 + pow(sd, 48.0) * 0.45, 0.0, 1.0));
        vec3 cw = vec3(1.0, 0.995, 0.98), cs = vec3(0.74, 0.80, 0.98);
        vec2 b;
        b = wBand(az, e, 6.0, 0.46, 0.035, 8.29, pe, 4.0);  c = mix(c, mix(mix(c, cs, 0.5), cw, smoothstep(0.0, 0.8, b.y)), b.x * 0.55);
        b = wBand(az, e, 8.0, 0.27, 0.04, 5.13, pe, 5.0);   c = mix(c, mix(mix(c, cs, 0.5), cw, smoothstep(0.0, 0.8, b.y)), b.x * 0.7);
        b = wBand(az, e, 11.0, 0.085, 0.032, 2.71, pe, 7.0); c = mix(c, mix(cs, cw, smoothstep(0.0, 0.75, b.y)), b.x * 0.95);
        b = wBand(az, e, 7.0, 0.016, 0.058, 0.37, pe, 9.0);  c = mix(c, mix(cs, cw, smoothstep(0.0, 0.75, b.y)), b.x);
        // sticker sun: disc + pale ring
        c = mix(c, vec3(1.0, 0.97, 0.86), (1.0 - smoothstep(0.072 - pe, 0.072 + pe, ang)) * 0.35);
        c = mix(c, vec3(2.4, 2.25, 1.9), 1.0 - smoothstep(0.045 - pe, 0.045 + pe, ang));
        if (e < 0.0) c = uHaze;
        gl_FragColor = vec4(c, 1.0);
        ${GL_OUT}
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), skyMat);
  skyMat.side = THREE.BackSide; sky.frustumCulled = false; sky.renderOrder = 50; scene.add(sky);   // drawn after the opaque scene so early-z skips hidden sky pixels

  // ------------------------------------------------- sea: animated stylised water with surf rings around the island and every berg
  const BERGS = [];   // [x, z, waterline radius, phase] for the surf
  const seaMat = new THREE.ShaderMaterial({
    uniforms: { uTime: worldU.uTime, uHi: worldU.uHi, uHaze: worldU.uHaze, uBergs: { value: Array.from({ length: 40 }, () => new THREE.Vector4(0, 0, 0, 0)) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform float uTime, uHi; uniform vec3 uHaze; uniform vec4 uBergs[40]; varying vec3 vW;
      ${GL_NOISE}
      // surf: solid foam collar + rings rolling outward; d = metres from the waterline, k = size scale
      float wFoam(float d, float k, float t, float px, float br){
        float core = 1.0 - smoothstep(1.5 * k - px, 1.5 * k + px, d);
        float q = d / (5.5 * k) - t * 0.2;
        float dl = abs(fract(q) - 0.5) * 5.5 * k;
        float lw = 0.55 * k * (1.0 - smoothstep(0.0, 24.0 * k, d));
        float ring = (1.0 - smoothstep(lw - px, lw + px, dl)) * smoothstep(1.5 * k, 3.0 * k, d) * (1.0 - smoothstep(12.0 * k, 24.0 * k, d)) * br;
        return max(core, ring * min(1.0, lw / px));
      }
      void main(){
        vec2 p = vW.xz; float t = uTime;
        vec3 toCam = cameraPosition - vW; float dist = length(toCam); vec3 V = toCam / dist;
        float px = max(length(fwidth(p)), 1e-3);
        float ds = length(p) - wIslandR(atan(p.y, p.x)) - 3.0;
        float wob = (wNoise(p * 0.11 + vec2(t * 0.15, -t * 0.1)) - 0.5) * 2.6;
        float br = smoothstep(0.22, 0.5, wNoise(p * 0.045 + vec2(t * 0.02, -t * 0.015)));
        float sh = 1.0 - smoothstep(0.0, 120.0, ds);
        vec3 col = mix(${vec(0x1a7fdc)}, ${vec(0x2fcbe9)}, sh * sh);
        // gentle swell shading
        float n = wNoise(p * 0.02 + vec2(t * 0.03, t * 0.017)) * 0.62 + wNoise(p * 0.055 + vec2(-t * 0.045, t * 0.035)) * 0.38;
        col *= 0.9 + 0.1 * smoothstep(0.3, 0.6, n);
        // soft lighter swells + sparse clip-art wave arcs that fade in and out
        float sw = wNoise(p * 0.012 + vec2(t * 0.02, -t * 0.012)) * 0.6 + wNoise(p * 0.04 - vec2(t * 0.03, t * 0.02)) * 0.4;
        col = mix(col, col * 1.12 + 0.03, smoothstep(0.58, 0.66, sw) * 0.55);
        {
          vec2 g = (p + vec2(t * 0.6, t * 0.25)) / 26.0, c = floor(g);
          float h = wHash(c + 5.3), life = fract(t * 0.07 + h * 7.0);
          vec2 d = (fract(g) - 0.5 - (vec2(wHash(c + 1.7), wHash(c + 9.1)) - 0.5) * 0.4) * 26.0;
          float r = 3.6 + h * 1.6, ad = abs(length(d - vec2(0.0, r * 0.75)) - r);
          float arc = (1.0 - smoothstep(0.35, 0.35 + px * 1.2, ad)) * smoothstep(0.35, 0.7, (r * 0.75 - d.y) / r);
          arc *= step(0.45, h) * smoothstep(0.0, 0.25, life) * (1.0 - smoothstep(0.65, 1.0, life));
          col = mix(col, ${vec(0xd8f8ff)}, arc * 0.75 * (1.0 - smoothstep(0.3, 0.8, px)));
        }
        float foam = wFoam(ds + wob, 1.0, t, px, br);
        if (uHi > 0.5) {
          for (int i = 0; i < 40; i++) {
            vec4 b = uBergs[i]; if (b.z <= 0.0) continue;
            float k = clamp(b.z / 14.0, 0.35, 1.0);
            foam = max(foam, wFoam(length(p - b.xy) - b.z + wob * k, k, t + b.w, px, br));
          }
          // twinkling sun glints
          vec2 g = p / 7.0, c = floor(g), f = fract(g) - 0.5;
          float h = wHash(c);
          vec2 dd = (f - (vec2(wHash(c + 17.0), wHash(c + 31.0)) - 0.5) * 0.7) * 7.0;
          float tw = max(sin(t * 2.2 + h * 60.0), 0.0); tw *= tw * tw;
          float sp = (1.0 - smoothstep(0.0, 0.55 + px, abs(dd.x) + abs(dd.y))) * tw * step(0.55, h);
          col = mix(col, vec3(1.7, 1.65, 1.5), sp * (1.0 - smoothstep(0.35, 0.9, px)));
        }
        col = mix(col, uHaze, pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0) * 0.5);
        col = mix(col, ${vec(0xf6fcff)}, clamp(foam, 0.0, 1.0) * (1.0 - smoothstep(700.0, 1200.0, dist)));
        col = mix(col, uHaze, smoothstep(260.0, 1350.0, dist));
        gl_FragColor = vec4(col, 1.0);
        ${GL_OUT}
      }`,
  });
  const sea = addMesh(new THREE.CircleGeometry(1450, 128), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.y = SEA_Y;
  sea.renderOrder = 40;   // after the stadium + island: early-z skips the (heavy) water hidden behind the stands

  // ------------------------------------------------- the island: flat snow under the stadium, drifts, frosting lip with drips, faceted ice cliffs
  const snowMat = litMat({ W_SNOW: '' }, 0.12, 14, 320, 2600), iceMat = litMat({ W_FLAT: '', W_BOB: '' }, 0.55, 38, 300, 2600);
  {
    const SEG = 720, prof = [];
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * TAU, R = islandR(a), b = bank(a), dr = drip(a);
      prof.push([[0, PLAT_Y], [70, PLAT_Y], [115, PLAT_Y], [R - 26, PLAT_Y], [R - 17, PLAT_Y + 0.35 * b], [R - 9, PLAT_Y + 0.85 * b], [R - 4, PLAT_Y + b],
        [R - 1.2, PLAT_Y + 0.8 * b], [R + 0.5, PLAT_Y + 0.2 * b - 0.15], [R + 1.15, PLAT_Y - 0.55], [R + 1.05, PLAT_Y - 0.95 - dr], [R + 0.55, PLAT_Y - 1.05 - dr]]);
    }
    const J = prof[0].length;
    const cols = [0xe6f0fb, 0xe6f0fb, 0xe6f0fb, 0xe8f1fc, 0xecf4fd, 0xf0f6ff, 0xf2f8ff, 0xf4f9ff, 0xf4f9ff, 0xeff6ff, 0xe8f2ff, 0xbfe2fb].map(C);
    const pos = [], col = [], idx = [];
    for (let j = 0; j < J; j++) for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * TAU, [r, y] = prof[i][j];
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r); col.push(cols[j].r, cols[j].g, cols[j].b);
    }
    for (let j = 0; j < J - 1; j++) for (let i = 0; i < SEG; i++) {
      const i2 = (i + 1) % SEG, a = j * SEG + i, b = j * SEG + i2, c = (j + 1) * SEG + i2, d = (j + 1) * SEG + i;
      idx.push(a, b, c, a, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    addMesh(g, snowMat).renderOrder = 39;   // mostly under the rink: draw after the stadium so it is depth-rejected
    // ice cliff below the frosting
    const S2 = 160, ring = [[0.55, PLAT_Y - 0.35, 0], [0.9, -2.4, 0.8], [1.7, -4.6, 1.0], [2.5, SEA_Y + 1.6, 1.0], [3.3, SEA_Y - 2.5, 0.8], [6, SEA_Y - 12, 0]];
    const ic = [0xd2f6ff, 0xa4e8ff, 0x72d4f8, 0x4bbcf0, 0x2f93dc, 0x2373c9].map(C);
    const cp = [], cc = [], ci = [];
    for (let j = 0; j < ring.length; j++) for (let i = 0; i < S2; i++) {
      const a = ((i + (j ? (h1(i * 7.3 + j) - 0.5) * 0.5 : 0)) / S2) * TAU, R = islandR(a);
      const [dr, y, jit] = ring[j], rad = R + dr + (h1(i * 3.1 + j * 17.7) - 0.5) * 2 * jit;
      cp.push(Math.cos(a) * rad, y + (h1(i * 5.7 + j * 3.3) - 0.5) * jit, Math.sin(a) * rad);
      cc.push(ic[j].r, ic[j].g, ic[j].b);
    }
    for (let j = 0; j < ring.length - 1; j++) for (let i = 0; i < S2; i++) {
      const i2 = (i + 1) % S2, a = j * S2 + i, b = j * S2 + i2, c = (j + 1) * S2 + i2, d = (j + 1) * S2 + i;
      ci.push(a, b, c, a, c, d);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    cg.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
    cg.setAttribute('aBob', new THREE.Float32BufferAttribute(new Array((cp.length / 3) * 2).fill(0), 2));
    cg.setIndex(ci); cg.computeVertexNormals();
    addMesh(cg, iceMat);
  }

  // ------------------------------------------------- icebergs, ice crystals and the far snowy shores (faceted glossy ice)
  const ice = acc();
  const NO_BOB = [0, 0];
  function berg(x, z, R, H, peaked, ph, amp) {
    const n = 7 + Math.floor(rnd() * 3), rot = rnd() * TAU;
    const rings = peaked ? [[0.92, -7], [1.0, -0.6], [0.96, H * 0.3], [0.74, H * 0.62], [0.42, H * 0.88]]
      : [[0.94, -6], [1.0, -0.6], [1.04, H * 0.42], [0.97, H * 0.84], [1.0, H * 0.9], [0.9, H]];
    const cols = (peaked ? [0x2a86d6, 0x46bdf0, 0x86dcfb, 0xc6f0ff, 0xf4fbff] : [0x2a86d6, 0x46bdf0, 0x8fe0fb, 0xc4eeff, 0xf6fbff, 0xf6fbff]).map(C);
    const cj = [], ca = [];
    for (let i = 0; i < n; i++) { cj.push(rr(0.84, 1.12)); ca.push(rot + ((i + rr(-0.22, 0.22)) / n) * TAU); }
    const pts = rings.map(([k, y], j) => ca.map((a, i) => { const rad = R * k * cj[i] * (j > 1 ? rr(0.95, 1.05) : 1); return new V3(x + Math.cos(a) * rad, SEA_Y + y + (j > 1 ? rr(-0.05, 0.05) * H : 0), z + Math.sin(a) * rad); }));
    const ex = [ph, amp];
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n, a = pts[j][i], b = pts[j][i2], c = pts[j + 1][i2], d = pts[j + 1][i];
      tri(ice, a, c, b, cols[j], cols[j + 1], cols[j], ex, ex, ex); tri(ice, a, d, c, cols[j], cols[j + 1], cols[j + 1], ex, ex, ex);
    }
    const top = pts[pts.length - 1], tc = cols[cols.length - 1];
    const apex = peaked ? new V3(x + rr(-0.15, 0.15) * R, SEA_Y + H * rr(1.15, 1.35), z + rr(-0.15, 0.15) * R) : new V3(x, SEA_Y + H * 1.03, z);
    for (let i = 0; i < n; i++) tri(ice, top[i], apex, top[(i + 1) % n], tc, C(0xffffff), tc, ex, ex, ex);
  }
  // drifting bergs (kept clear of the floes and of each other)
  const spots = [];
  const free = (x, z, r) => spots.every(([sx, sz, sr]) => Math.hypot(x - sx, z - sz) > r + sr + 10);
  const FLOES = [];
  for (let tries = 0; FLOES.length < 8 && tries < 200; tries++) {
    const a = rr(0, TAU), d = rr(195, 320), x = Math.cos(a) * d, z = Math.sin(a) * d, r = rr(6, 10.5);
    if (!free(x, z, r)) continue;
    spots.push([x, z, r]); FLOES.push({ x, z, r, rot: rr(0, TAU), ph: rr(0, TAU), spin: rr(-0.02, 0.02) });
  }
  for (let tries = 0; BERGS.length < 17 && tries < 400; tries++) {
    const a = rr(0, TAU), d = rr(225, 560), x = Math.cos(a) * d, z = Math.sin(a) * d;
    const peaked = rnd() < 0.45, R = peaked ? rr(7, 15) : rr(9, 24), H = peaked ? rr(12, 28) : rr(6, 20);
    if (!free(x, z, R)) continue;
    spots.push([x, z, R]); const ph = rr(0, TAU);
    berg(x, z, R, H, peaked, ph, rr(0.2, 0.4)); BERGS.push([x, z, R * 0.98, ph]);
  }
  // crystal clusters on the island's snow drifts
  const oct = new THREE.OctahedronGeometry(1, 0);
  const crystCols = [0x8fe8ff, 0x6fd8ff, 0xb9c4ff, 0xff9fd2];
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * TAU + rr(-0.15, 0.15);
    if (Math.abs(wrapA(a - LH_A)) < 0.2) continue;
    const R = islandR(a) - rr(5, 8), cx = Math.cos(a) * R, cz = Math.sin(a) * R, cy = PLAT_Y + 0.8 * bank(a) - 0.6;
    const col = crystCols[k % 4];
    for (let m = 0; m < 4; m++) {
      const h = m ? rr(1.4, 2.6) : rr(2.8, 3.6);
      add(ice, oct, col, [cx + rr(-1.4, 1.4), cy + h * 0.6, cz + rr(-1.4, 1.4)], [h * 0.32, h, h * 0.32], [rr(-0.45, 0.45), rr(0, 3), rr(-0.45, 0.45)], NO_BOB);
    }
  }
  // far mountain ranges, each on its own snowy shore
  const mtn = acc();
  function peak(x, z, R, H) {
    const S = 9, K = 6, rot = rnd() * TAU, base = SEA_Y - 22, top = SEA_Y + H;
    const cj = []; for (let i = 0; i < S; i++) cj.push(rr(0.8, 1.15));
    const rows = [];
    for (let k = 0; k < K; k++) {
      const t = k / K, row = [];
      for (let i = 0; i < S; i++) {
        const a = rot + ((i + (k ? rr(-0.18, 0.18) : 0)) / S) * TAU, rad = R * Math.pow(1 - t, 1.3) * cj[i] * (k ? rr(0.86, 1.1) : 1);
        row.push(new V3(x + Math.cos(a) * rad, base + (top - base) * t * (k ? rr(0.95, 1.05) : 1), z + Math.sin(a) * rad));
      }
      rows.push(row);
    }
    const apex = new V3(x + rr(-0.06, 0.06) * R, top, z + rr(-0.06, 0.06) * R);
    const w = C(0xffffff), hh = (v) => [Math.max(0, (v.y - SEA_Y) / H)];
    for (let k = 0; k < K - 1; k++) for (let i = 0; i < S; i++) {
      const i2 = (i + 1) % S, a = rows[k][i], b = rows[k][i2], c = rows[k + 1][i2], d = rows[k + 1][i];
      tri(mtn, a, c, b, w, w, w, hh(a), hh(c), hh(b)); tri(mtn, a, d, c, w, w, w, hh(a), hh(d), hh(c));
    }
    const tp = rows[K - 1];
    for (let i = 0; i < S; i++) tri(mtn, tp[i], apex, tp[(i + 1) % S], w, w, w, hh(tp[i]), hh(apex), hh(tp[(i + 1) % S]));
  }
  const RANGES = 8;
  for (let k = 0; k < RANGES; k++) {
    const a = (k / RANGES) * TAU + rr(-0.2, 0.2), d = rr(780, 960);
    const H = k % 2 ? rr(190, 290) : rr(340, 470), R = H * rr(0.66, 0.82);
    const x = Math.cos(a) * d, z = Math.sin(a) * d, tx = -Math.sin(a), tz = Math.cos(a);
    peak(x, z, R, H);
    const subs = 2 + Math.floor(rnd() * 3);
    for (let s = 0; s < subs; s++) {
      const side = s % 2 ? 1 : -1, off = side * R * rr(0.55, 1.1), out = rr(-0.3, 0.45) * R;
      peak(x + tx * off + Math.cos(a) * out, z + tz * off + Math.sin(a) * out, R * rr(0.55, 0.8), H * rr(0.38, 0.72));
    }
    const land = R * 1.1;
    berg(x, z, land, 12, false, 0, 0); BERGS.push([x, z, land * 0.95, rr(0, 6)]);
  }
  world.add(new THREE.Mesh(geoOf(ice, 'aBob', 2), iceMat));
  addMesh(geoOf(mtn, 'aH', 1), litMat({ W_FLAT: '', W_MTN: '' }, 0.25, 20, 300, 2600));
  BERGS.slice(0, 40).forEach((b, i) => seaMat.uniforms.uBergs.value[i].set(b[0], b[1], b[2], b[3]));

  // ------------------------------------------------- lighthouse, igloos and snowmen (one merged prop mesh)
  const props = acc();
  const SPH = new THREE.SphereGeometry(1, 16, 12), SPH_LO = new THREE.SphereGeometry(1, 10, 8), HEMI = new THREE.SphereGeometry(1, 18, 9, 0, TAU, 0, Math.PI / 2);
  const lhR = islandR(LH_A) - 10, lhx = Math.cos(LH_A) * lhR, lhz = Math.sin(LH_A) * lhR, lhy = PLAT_Y + 0.85 * bank(LH_A);
  add(props, HEMI, 0xf1f7ff, [lhx, lhy - 1.4, lhz], [7.5, 3.4, 7.5]);
  add(props, new THREE.CylinderGeometry(4.2, 4.8, 2.4, 16), 0x8fa6dd, [lhx, lhy + 1.6, lhz]);
  add(props, new THREE.CylinderGeometry(4.45, 4.3, 0.55, 16), 0xf6faff, [lhx, lhy + 2.9, lhz]);
  const LH0 = lhy + 3.1, STR = 3.1;
  for (let k = 0; k < 5; k++) {
    const r0 = 2.9 - k * 0.17, r1 = r0 - 0.17;
    add(props, new THREE.CylinderGeometry(r1, r0, STR, 20, 1, true), k % 2 ? 0xffffff : 0xff4f73, [lhx, LH0 + STR * (k + 0.5), lhz]);
  }
  const LHT = LH0 + STR * 5;
  add(props, new THREE.CylinderGeometry(3.0, 2.4, 0.6, 20), 0x2b3050, [lhx, LHT + 0.3, lhz]);
  add(props, new THREE.CylinderGeometry(1.95, 1.95, 0.35, 20), 0x2b3050, [lhx, LHT + 2.75, lhz]);
  add(props, new THREE.ConeGeometry(2.5, 2.3, 20), 0xff4f73, [lhx, LHT + 4.05, lhz]);
  add(props, SPH, 0xffd23f, [lhx, LHT + 5.4, lhz], [0.5, 0.5, 0.5]);
  const outA = Math.atan2(lhx, lhz);
  add(props, new THREE.BoxGeometry(1.4, 2.2, 0.5), 0x2b3050, [lhx + Math.sin(outA) * 2.75, LH0 + 1.1, lhz + Math.cos(outA) * 2.75], [1, 1, 1], [0, outA, 0]);
  for (const [k, da] of [[1, 0.6], [3, -0.5]]) add(props, new THREE.BoxGeometry(0.8, 1.1, 0.5), 0x2b3050, [lhx + Math.sin(outA + da) * (2.75 - k * 0.17), LH0 + STR * (k + 0.5), lhz + Math.cos(outA + da) * (2.75 - k * 0.17)], [1, 1, 1], [0, outA + da, 0]);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.1, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 0.55) }));
  lantern.position.set(lhx, LHT + 1.55, lhz); world.add(lantern);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float vY; void main(){ gl_FragColor = vec4(vec3(1.0, 0.86, 0.5) * 0.28 * pow(vY, 1.6), 1.0); }',
  });
  const beam = new THREE.Group(); beam.position.copy(lantern.position); world.add(beam);
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.ConeGeometry(5, 46, 20, 1, true), beamMat); b.rotation.z = s * Math.PI / 2; b.position.x = s * 23; b.renderOrder = 6; beam.add(b); }
  // igloo village and snowmen
  const villageA = 2.5;
  const iglooAt = (a, rIn, s) => {
    const R = islandR(a) - rIn, x = Math.cos(a) * R, z = Math.sin(a) * R, face = Math.atan2(-x, -z);
    add(props, HEMI, 0xf3f8ff, [x, PLAT_Y - 0.4, z], [4 * s, 3.5 * s, 4 * s]);
    const fx = Math.sin(face), fz = Math.cos(face);
    add(props, new THREE.CylinderGeometry(1.5 * s, 1.5 * s, 2.6 * s, 14, 1, true, Math.PI / 2, Math.PI), 0xe6f0fc, [x + fx * 4.3 * s, PLAT_Y - 0.4, z + fz * 4.3 * s], [1, 1, 1], [Math.PI / 2, face, 0, 'YXZ']);
    add(props, new THREE.CircleGeometry(1.15 * s, 14, 0, Math.PI), 0x2b3050, [x + fx * 4.9 * s, PLAT_Y - 0.4, z + fz * 4.9 * s], [1, 1, 1], [0, face, 0]);
  };
  iglooAt(villageA - 0.07, 30, 1.0); iglooAt(villageA + 0.03, 31, 1.2); iglooAt(villageA + 0.12, 29, 0.85);
  const snowman = (a, rIn) => {
    const R = islandR(a) - rIn, x = Math.cos(a) * R, z = Math.sin(a) * R, face = Math.atan2(-x, -z), fx = Math.sin(face), fz = Math.cos(face);
    add(props, SPH, 0xf6faff, [x, PLAT_Y + 0.9, z], [1.5, 1.35, 1.5]);
    add(props, SPH, 0xf6faff, [x, PLAT_Y + 3.0, z], [1.1, 1.0, 1.1]);
    add(props, SPH, 0xf6faff, [x, PLAT_Y + 4.55, z], [0.8, 0.78, 0.8]);
    add(props, new THREE.ConeGeometry(0.2, 1.0, 10), 0xff8a1f, [x + fx * 1.15, PLAT_Y + 4.5, z + fz * 1.15], [1, 1, 1], [Math.PI / 2, face, 0, 'YXZ']);
    add(props, new THREE.CylinderGeometry(0.62, 0.62, 0.9, 14), 0x2b3050, [x, PLAT_Y + 5.6, z]);
    add(props, new THREE.CylinderGeometry(0.95, 0.95, 0.12, 14), 0x2b3050, [x, PLAT_Y + 5.15, z]);
    add(props, new THREE.TorusGeometry(0.95, 0.24, 8, 18), 0xff5fa8, [x, PLAT_Y + 3.85, z], [1, 1, 1], [Math.PI / 2, 0, 0]);
    for (const s of [-1, 1]) add(props, SPH, 0x1b1d3a, [x + fx * 0.68 + fz * s * 0.3, PLAT_Y + 4.75, z + fz * 0.68 - fx * s * 0.3], [0.12, 0.12, 0.12]);
  };
  snowman(villageA + 0.2, 32); snowman(0.25, 33); snowman(-1.9, 31);
  addMesh(geoOf(props), litMat({}, 0.35, 30, 320, 2600));

  // ------------------------------------------------- floes with little penguins (instanced, animated on the CPU)
  const floeGeo = (() => {
    const T = acc(), n = 9, cj = [], ca = [];
    for (let i = 0; i < n; i++) { cj.push(rr(0.82, 1.1)); ca.push(((i + rr(-0.25, 0.25)) / n) * TAU); }
    const rows = [[0.94, -1.1], [1.0, 0.25], [0.93, 0.5]].map(([k, y]) => ca.map((a, i) => new V3(Math.cos(a) * k * cj[i], y, Math.sin(a) * k * cj[i])));
    const cols = [0x3aa7e6, 0x9be7ff, 0xf4fbff].map(C), ctr = new V3(0, 0.52, 0);
    for (let j = 0; j < 2; j++) for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n, a = rows[j][i], b = rows[j][i2], c = rows[j + 1][i2], d = rows[j + 1][i];
      tri(T, a, c, b, cols[j], cols[j + 1], cols[j], NO_BOB, NO_BOB, NO_BOB); tri(T, a, d, c, cols[j], cols[j + 1], cols[j + 1], NO_BOB, NO_BOB, NO_BOB);
    }
    for (let i = 0; i < n; i++) tri(T, rows[2][i], ctr, rows[2][(i + 1) % n], cols[2], C(0xffffff), cols[2], NO_BOB, NO_BOB, NO_BOB);
    return geoOf(T, 'aBob', 2);
  })();
  const floes = new THREE.InstancedMesh(floeGeo, iceMat, FLOES.length);
  world.add(floes);
  FLOES.forEach((f) => BERGS.length < 40 && BERGS.push([f.x, f.z, f.r * 0.95, f.ph]));
  BERGS.slice(0, 40).forEach((b, i) => seaMat.uniforms.uBergs.value[i].set(b[0], b[1], b[2], b[3]));
  // penguin: body parts tinted per instance (aTint = 1), belly/beak/feet keep their colour
  const pengGeo = (() => {
    const T = acc(), t1 = [1], t0 = [0];
    add(T, SPH_LO, 0xffffff, [0, 0.74, 0], [0.5, 0.72, 0.46], [0, 0, 0], t1);
    add(T, SPH_LO, 0xf8fbff, [0, 0.68, 0.17], [0.39, 0.56, 0.33], [0, 0, 0], t0);
    add(T, SPH_LO, 0xffffff, [0, 1.47, 0.02], [0.37, 0.35, 0.35], [0, 0, 0], t1);
    add(T, SPH_LO, 0xf8fbff, [0, 1.43, 0.2], [0.25, 0.21, 0.19], [0, 0, 0], t0);
    add(T, new THREE.ConeGeometry(0.1, 0.26, 8), 0xffa41b, [0, 1.38, 0.47], [1, 1, 1], [Math.PI / 2, 0, 0], t0);
    for (const s of [-1, 1]) {
      add(T, SPH_LO, 0xffa41b, [s * 0.18, 0.05, 0.12], [0.16, 0.07, 0.25], [0, 0, 0], t0);
      add(T, SPH_LO, 0xffffff, [s * 0.5, 0.82, 0], [0.1, 0.42, 0.23], [0, 0, s * 0.4], t1);
      add(T, SPH_LO, 0x1b1d3a, [s * 0.11, 1.52, 0.33], [0.055, 0.07, 0.04], [0, 0, 0], t0);
    }
    return geoOf(T, 'aTint', 1);
  })();
  const PENGS = [];
  FLOES.forEach((f, fi) => {
    const n = f.r > 8 ? 3 : 2;
    for (let k = 0; k < n; k++) { const a = (k / n) * TAU + rr(-0.4, 0.4), d = f.r * rr(0.25, 0.55); PENGS.push({ floe: fi, lx: Math.cos(a) * d, lz: Math.sin(a) * d, yaw: rr(0, TAU), ph: rr(0, TAU), s: rr(1.05, 1.3) }); }
  });
  for (let k = 0; k < 6; k++) {
    const a = villageA + rr(-0.12, 0.2), R = islandR(a) - rr(36, 44);
    PENGS.push({ floe: -1, lx: Math.cos(a) * R, lz: Math.sin(a) * R, yaw: rr(0, TAU), ph: rr(0, TAU), s: rr(1.1, 1.4) });
  }
  const pengs = new THREE.InstancedMesh(pengGeo, litMat({ W_TINT: '' }, 0.5, 30, 320, 2600), PENGS.length);
  const skinCols = [0x2b3050, 0x2b3050, 0x2b3050, 0x3d5180, 0xff6fb4, 0x2fc9a5, 0xff7a3d, 0x5a3fd6];
  PENGS.forEach((p, i) => pengs.setColorAt(i, C(skinCols[i % skinCols.length])));
  world.add(pengs);
  const _fo = new THREE.Object3D(), _po = new THREE.Object3D();
  const animFloes = (t) => {
    FLOES.forEach((f, i) => {
      f.y = SEA_Y + Math.sin(t * 0.7 + f.ph) * 0.16; f.a = f.rot + t * f.spin;
      _fo.position.set(f.x, f.y, f.z); _fo.rotation.set(Math.sin(t * 0.5 + f.ph) * 0.025, f.a, Math.cos(t * 0.6 + f.ph) * 0.025); _fo.scale.set(f.r, 1, f.r);
      _fo.updateMatrix(); floes.setMatrixAt(i, _fo.matrix);
    });
    floes.instanceMatrix.needsUpdate = true;
    PENGS.forEach((p, i) => {
      const hop = Math.max(0, Math.sin(t * 5 + p.ph)) * 0.35 * (Math.sin(t * 0.45 + p.ph * 2) > 0.55 ? 1 : 0);
      if (p.floe >= 0) {
        const f = FLOES[p.floe], ca = Math.cos(f.a), sa = Math.sin(f.a);
        _po.position.set(f.x + p.lx * ca + p.lz * sa, f.y + 0.5 + hop, f.z - p.lx * sa + p.lz * ca);
        _po.rotation.set(0, p.yaw + f.a + Math.sin(t * 0.4 + p.ph) * 0.7, Math.sin(t * 2.2 + p.ph) * 0.06);
      } else {
        _po.position.set(p.lx, PLAT_Y + hop, p.lz);
        _po.rotation.set(0, p.yaw + Math.sin(t * 0.4 + p.ph) * 0.7, Math.sin(t * 2.2 + p.ph) * 0.06);
      }
      _po.scale.setScalar(p.s); _po.updateMatrix(); pengs.setMatrixAt(i, _po.matrix);
    });
    pengs.instanceMatrix.needsUpdate = true;
  };
  animFloes(0);

  // ------------------------------------------------- clouds: puffy cartoon clusters (one instanced batch; the game slowly turns the group)
  const puffGeo = new THREE.SphereGeometry(1, 15, 10);
  {
    const p = puffGeo.attributes.position, n = puffGeo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < -0.3) { p.setY(i, -0.3 + (y + 0.3) * 0.18); _v.set(n.getX(i), n.getY(i), n.getZ(i)).lerp(_w.set(0, -1, 0), 0.75).normalize(); n.setXYZ(i, _v.x, _v.y, _v.z); }
    }
  }
  const puffs = [];
  for (let c = 0; c < 24; c++) {
    const a = rr(0, TAU), d = c < 5 ? rr(120, 220) : rr(230, 600), y = c < 5 ? rr(150, 200) : rr(95, 210), S = rr(12, 22);
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d, tx = -Math.sin(a), tz = Math.cos(a);
    const parts = [[0, 0, 0, 1], [-0.95, 0, 0.15, 0.72], [0.92, 0, -0.1, 0.76], [0.25, 0.5, 0.05, 0.66], [-0.45, 0.36, -0.1, 0.56], [0, 0.05, -0.55, 0.62]];
    if (rnd() < 0.7) parts.push([-1.7, 0, 0.05, 0.46], [1.68, 0, 0.1, 0.5]);
    if (rnd() < 0.5) parts.push([0.75, 0.32, 0.25, 0.48]);
    const len = rr(0.9, 1.25);
    for (const [u, v, w, k] of parts) {
      const s = S * k * rr(0.9, 1.1), along = u * S * len;
      puffs.push([cx + tx * along - tz * w * S, y + v * S + 0.44 * s, cz + tz * along + tx * w * S, s]);
    }
  }
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: { uTime: worldU.uTime, uSunDir: worldU.uSunDir, uHaze: worldU.uHaze },
    vertexShader: `uniform float uTime; varying vec3 vN; varying vec3 vW;
      void main(){
        float id = float(gl_InstanceID);
        vec4 wp = modelMatrix * instanceMatrix * vec4(position * (1.0 + 0.035 * sin(uTime * 0.7 + id * 1.37)), 1.0);
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `uniform vec3 uSunDir, uHaze; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(uSunDir);
        float lit = smoothstep(-0.4, 0.8, dot(N, L));
        vec3 col = mix(${vec(0xb3c3f0)}, ${vec(0xfffdf8)}, lit);
        col = mix(col, ${vec(0xc6d2f5)}, smoothstep(-0.1, -0.85, N.y) * 0.6);
        col += ${vec(0xffffff)} * pow(1.0 - max(dot(N, V), 0.0), 2.5) * 0.3;
        col = mix(col, uHaze, smoothstep(300.0, 1400.0, length(vW - cameraPosition)) * 0.6);
        gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
        ${GL_OUT}
      }`,
  });
  const cloud = new THREE.InstancedMesh(puffGeo, cloudMat, puffs.length);
  const mm = new THREE.Matrix4(), qq = new Q(), ss = new V3(), pp = new V3();
  puffs.forEach((c, i) => { pp.set(c[0], c[1], c[2]); ss.setScalar(c[3]); mm.compose(pp, qq, ss); cloud.setMatrixAt(i, mm); });
  cloud.frustumCulled = false;
  const clouds = new THREE.Group(); clouds.add(cloud); scene.add(clouds);
  scene.userData.clouds = clouds;

  // ------------------------------------------------- snow petrels circling over the stadium (wings flap in the shader)
  const birdGeo = (() => {
    const T = acc(), w0 = [0], w1 = [1];
    add(T, SPH_LO, 0xffffff, [0, 0, 0], [0.26, 0.24, 0.75], [0, 0, 0], w0);
    add(T, SPH_LO, 0xffffff, [0, 0.12, 0.62], [0.2, 0.19, 0.22], [0, 0, 0], w0);
    add(T, new THREE.ConeGeometry(0.07, 0.24, 6), 0xffb703, [0, 0.1, 0.9], [1, 1, 1], [Math.PI / 2, 0, 0], w0);
    add(T, SPH_LO, 0xe9f1ff, [0, 0.05, -0.75], [0.3, 0.05, 0.3], [0, 0, 0], w0);
    for (const sx of [-1, 1]) {
      add(T, SPH_LO, 0xf4f8ff, [sx * 0.8, 0.04, 0.05], [0.72, 0.06, 0.3], [0, sx * 0.12, 0], w1);
      add(T, SPH_LO, 0x3d5180, [sx * 1.45, 0.04, -0.02], [0.2, 0.055, 0.2], [0, 0, 0], w1);
    }
    return geoOf(T, 'aWing', 1);
  })();
  const BIRDS = [];
  for (let i = 0; i < 9; i++) BIRDS.push({ r: rr(45, 115), h: rr(34, 62), a: rr(0, TAU), sp: rr(7, 11) * (i % 3 ? 1 : -1), ph: rr(0, TAU), s: rr(1.2, 1.6) });
  const birdMat = new THREE.ShaderMaterial({
    vertexColors: true,
    uniforms: { uTime: worldU.uTime, uSunDir: worldU.uSunDir },
    vertexShader: `uniform float uTime; attribute float aWing; varying vec3 vC; varying vec3 vN;
      void main(){
        float id = float(gl_InstanceID);
        float glide = smoothstep(-0.2, 0.4, sin(uTime * 0.6 + id * 2.1));
        float ang = sin(uTime * 9.0 + id * 1.7) * mix(0.75, 0.12, glide) + mix(0.0, 0.08, glide);
        vec3 p = position, n = normal;
        if (aWing > 0.5) { float s = sign(p.x), ax = abs(p.x); p.x = s * ax * cos(ang); p.y += ax * sin(ang); n.xy = vec2(n.x * cos(ang) - s * n.y * sin(ang), n.y * cos(ang) + s * n.x * sin(ang)); }
        vC = color; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 uSunDir; varying vec3 vC; varying vec3 vN;
      void main(){
        vec3 N = normalize(vN);
        vec3 col = vC * (${vec(0x8fb3e0)} + ${vec(0xc4b6a0)} * smoothstep(-0.3, 0.9, dot(N, normalize(uSunDir))));
        gl_FragColor = vec4(col, 1.0);
        ${GL_OUT}
      }`,
  });
  const birds = new THREE.InstancedMesh(birdGeo, birdMat, BIRDS.length);
  birds.frustumCulled = false; world.add(birds);
  const _bo = new THREE.Object3D();
  const animBirds = (t) => {
    BIRDS.forEach((b, i) => {
      const a = b.a + (t * b.sp) / b.r, dir = Math.sign(b.sp);
      _bo.position.set(Math.cos(a) * b.r, b.h + Math.sin(t * 0.5 + b.ph) * 3, Math.sin(a) * b.r);
      _bo.rotation.set(0, Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir), -dir * 0.3, 'YXZ');
      _bo.scale.setScalar(b.s); _bo.updateMatrix(); birds.setMatrixAt(i, _bo.matrix);
    });
    birds.instanceMatrix.needsUpdate = true;
  };

  // ------------------------------------------------- light snowfall around the camera (wrapped in the shader; high quality only)
  const FLAKES = 700, fp = new Float32Array(FLAKES * 3), fs = new Float32Array(FLAKES);
  for (let i = 0; i < FLAKES; i++) { fp[i * 3] = rnd(); fp[i * 3 + 1] = rnd(); fp[i * 3 + 2] = rnd(); fs[i] = rnd(); }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fg.setAttribute('aSeed', new THREE.BufferAttribute(fs, 1));
  const flakeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: worldU.uTime, uPx: { value: 500 } },
    vertexShader: `uniform float uTime, uPx; attribute float aSeed; varying float vA;
      void main(){
        vec3 B = vec3(70.0, 36.0, 70.0), p = position * B, c = cameraPosition;
        p.y -= uTime * (1.1 + aSeed * 0.9);
        p.x += uTime * 0.7 + sin(uTime * 0.7 + aSeed * 30.0) * 1.3;
        p.z += sin(uTime * 0.5 + aSeed * 17.0) * 1.3;
        p = mod(p - c + B * 0.5, B) + c - B * 0.5;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        vec3 q = abs(p - c) / (B * 0.5);
        vA = (1.0 - smoothstep(0.7, 1.0, max(q.x, max(q.y, q.z)))) * smoothstep(1.5, 4.0, d);
        float sz = uPx * (0.09 + 0.07 * aSeed) / max(d, 0.1);
        if (sz < 1.5) { vA *= sz / 1.5; sz = 1.5; }
        gl_PointSize = min(sz, 9.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA;
      void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float a = (1.0 - smoothstep(0.25, 1.0, dot(q, q))) * vA * 0.9; if (a < 0.01) discard;
        gl_FragColor = vec4(1.0, 1.0, 1.0, a);
        ${GL_OUT}
      }`,
  });
  const snow = new THREE.Points(fg, flakeMat);
  snow.frustumCulled = false; snow.renderOrder = 7; scene.add(snow);

  // snow drifts heaped around the bases of tall arena poles (floodlights stand at y=0, the snow is lower)
  const moundGeo = (() => { const T = acc(); add(T, HEMI, 0xf1f7ff, [0, 0, 0], [2.6, 1.3, 2.6]); add(T, HEMI, 0xf1f7ff, [1.6, 0, 0.9], [1.6, 0.8, 1.6]); return geoOf(T); })();
  const mounds = new THREE.InstancedMesh(moundGeo, snowMat, 12);
  mounds.count = 0; mounds.frustumCulled = false; world.add(mounds);
  // ------------------------------------------------- per-frame: time, sun direction, quality, stadium footprint, floes, lighthouse beam
  let lastArena = null;
  const measureStands = () => {
    let best = 0, bh = 0, nm = 0;
    const bb = new THREE.Box3();
    if (arenaGroup) arenaGroup.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || !o.geometry || (o.parent && o.parent.isMesh)) return;   // skip outline shells
      bb.setFromObject(o);
      if (bb.max.y > 25 && bb.min.y > -2 && bb.min.y < 1.5 && bb.max.x - bb.min.x < 5 && bb.max.z - bb.min.z < 5 && Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x)) > A.hx + 3 && nm < 12) {
        _po.position.set((bb.min.x + bb.max.x) / 2, PLAT_Y - 0.25, (bb.min.z + bb.max.z) / 2); _po.rotation.set(0, Math.atan2(_po.position.x, _po.position.z), 0); _po.scale.setScalar(1);
        _po.updateMatrix(); mounds.setMatrixAt(nm++, _po.matrix);
      }
      if (bb.max.y > 34 || bb.max.y < 10) return;
      const w = Math.max(bb.max.x, -bb.min.x) - A.hx;
      if (w > best) { best = w; bh = bb.max.y; }
    });
    if (best > 4 && best < 70) { worldU.uFoot.value.w = best; worldU.uStandH.value = bh; }
    mounds.count = nm; mounds.instanceMatrix.needsUpdate = true;
  };
  FRAME_HOOKS.push((gameDt, realDt) => {
    const t = (worldU.uTime.value += realDt);
    _v.copy(sun.position).sub(sun.target.position);
    if (_v.lengthSq() > 1e-6) worldU.uSunDir.value.copy(_v.normalize());
    const hi = save.settings.quality !== 'low';
    worldU.uHi.value = hi ? 1 : 0; snow.visible = hi;
    if (hi) flakeMat.uniforms.uPx.value = renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
    if (arenaGroup !== lastArena) { lastArena = arenaGroup; measureStands(); }
    worldU.uFoot.value.x = A.hx; worldU.uFoot.value.y = A.hz; worldU.uFoot.value.z = A.rc;
    beam.rotation.y = t * 0.5;
    animFloes(t); animBirds(t);
  });
})();
