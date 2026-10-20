// =====================================================================
//  GFX — renderer, scene, lights, materials, outline helpers, frame render
// =====================================================================
import { EffectComposer as gfxEffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass as gfxRenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass as gfxUnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass as gfxShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const INK = 0x1b1d3a;
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.CustomToneMapping; renderer.toneMappingExposure = 1;
renderer.setClearColor(0x8fd8ff);
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc4ecff, 220, 760);
const camera = new THREE.PerspectiveCamera(75, 1, 0.3, 2200);
camera.position.set(0, 30, -70);

// bright midday: warm sun + cool sky fill (most of the fill comes from the environment map below)
const hemi = new THREE.HemisphereLight(0xe4f4ff, 0xc9def2, 0.38);
const sun = new THREE.DirectionalLight(0xfff0dc, 1.85);
sun.position.set(45, 95, 30);
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
scene.add(hemi, sun, sun.target);
// tight light-space box around the rink (static light, so no shimmer); works for both rink sizes
const _gfxShCam = new THREE.OrthographicCamera(), _gfxShV = new V3();
function fitShadow() {
  sun.target.position.set(0, 0, 0); sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
  _gfxShCam.position.copy(sun.position); _gfxShCam.lookAt(0, 0, 0); _gfxShCam.updateMatrixWorld();
  const inv = _gfxShCam.matrixWorldInverse.copy(_gfxShCam.matrixWorld).invert();
  const ex = A.hx + 2, ez = A.hz + A.gd + 1;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const x of [-ex, ex]) for (const y of [-1, A.H + 2]) for (const z of [-ez, ez]) {
    _gfxShV.set(x, y, z).applyMatrix4(inv);
    x0 = Math.min(x0, _gfxShV.x); x1 = Math.max(x1, _gfxShV.x); y0 = Math.min(y0, _gfxShV.y); y1 = Math.max(y1, _gfxShV.y); z0 = Math.min(z0, _gfxShV.z); z1 = Math.max(z1, _gfxShV.z);
  }
  const sc = sun.shadow.camera;
  sc.left = x0 - 1; sc.right = x1 + 1; sc.bottom = y0 - 1; sc.top = y1 + 1; sc.near = Math.max(0.5, -z1 - 10); sc.far = -z0 + 10; sc.updateProjectionMatrix();
}
const _gfxV2 = new THREE.Vector2();
function applyQuality() {
  const hi = save.settings.quality === 'high';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 1.5 : 1));
  renderer.shadowMap.enabled = hi; sun.castShadow = hi;
  const upd = (o) => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); } };
  scene.traverse(upd);
  if (showroom) { showroom.sc.traverse(upd); if (showroom.key) showroom.key.castShadow = hi; }
  resize();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  gfxComposer.setPixelRatio(renderer.getPixelRatio()); gfxComposer.setSize(w, h);
  renderer.getDrawingBufferSize(_gfxV2);
  gfxOlU.uHalfH.value = _gfxV2.y / 2; gfxOlU.uMaxPx.value = gfxOlU.uMaxPx.base = Math.max(2.5, 4 * _gfxV2.y / 800);
  camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  if (showroom) { showroom.cam.aspect = camera.aspect; showroom.cam.updateProjectionMatrix(); }
}

// ----------------------------------------------------------- stylised lighting ("vinyl toy")
// Global shader-chunk patches, active only for materials that carry the VINYL define (everything made by toon()):
// soft wrapped diffuse, shadows that fade out at the terminator (no self-shadow acne) and a curvature-masked fresnel rim
// (round things get an icy edge glow, big flat surfaces like the rink floor don't).
// Also a hue-preserving tone curve: identity for normal colours, soft shoulder for highlights so whites never clip.
const GFX_TONE_GLSL = `vec3 gfxTone( vec3 c ) {
  c = max( c, 0.0 );
  float m = max( max( c.r, c.g ), c.b );
  if ( m > 0.8 ) {
    float x = ( m - 0.8 ) / 0.2;
    float nm = 0.8 + 0.2 * x / ( 1.0 + x );
    c = mix( c * ( nm / m ), vec3( nm ), clamp( ( m - 1.3 ) * 0.2, 0.0, 0.55 ) );
  }
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  return clamp( mix( vec3( l ), c, 1.1 ), 0.0, 1.0 );
}
`;
(function gfxPatchChunks() {
  const SC = THREE.ShaderChunk;
  const rep = (name, a, b) => { if (SC[name].indexOf(a) < 0) { console.warn('gfx: shader patch skipped', name); return; } SC[name] = SC[name].replace(a, b); };
  rep('lights_physical_pars_fragment', 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );', `#ifdef VINYL
	float vyW = saturate( ( dot( geometryNormal, directLight.direction ) + 0.5 ) / 1.5 );
	reflectedLight.directDiffuse += ( vyW * vyW * ( 3.0 - 2.0 * vyW ) ) * directLight.color * BRDF_Lambert( material.diffuseColor );
	#else
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	#endif`);
  const sh = 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;';
  rep('lights_fragment_begin', sh, `#ifdef VINYL
		directLight.color *= ( directLight.visible && receiveShadow ) ? mix( 1.0, getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ), smoothstep( -0.05, 0.22, dot( geometryNormal, directLight.direction ) ) ) : 1.0;
		#else
		${sh}
		#endif`);
  SC.opaque_fragment = `#if defined( VINYL ) && ! defined( FLAT_SHADED )
	{
		float vyF = pow( 1.0 - saturate( dot( normal, geometryViewDir ) ), 3.2 );
		float vyC = length( fwidth( vNormal ) ) / max( length( fwidth( vViewPosition ) ), 1e-5 );
		vec3 vyCol = mix( vec3( 0.6, 0.86, 1.0 ), diffuseColor.rgb, 0.3 ) * ( 1.0 - 0.55 * max( max( diffuseColor.r, diffuseColor.g ), diffuseColor.b ) );
		outgoingLight += vyCol * vyF * smoothstep( 0.3, 1.1, vyC ) * ( 0.34 * VINYL_RIM );
	}
#endif
` + SC.opaque_fragment;
  // calmer grazing-angle reflections, so far floors/walls don't turn milky
  SC.lights_fragment_end += `
#ifdef VINYL
	reflectedLight.indirectSpecular *= mix( 0.4, 1.0, saturate( dot( geometryNormal, geometryViewDir ) ) );
#endif
`;
  rep('tonemapping_pars_fragment', 'vec3 CustomToneMapping( vec3 color ) { return color; }', GFX_TONE_GLSL + 'vec3 CustomToneMapping( vec3 color ) { return gfxTone( toneMappingExposure * color ); }');
})();

// ----------------------------------------------------------- environment (image based lighting)
// A soft sky-gradient "room" baked to a PMREM: glossy things get a sky/horizon reflection and a couple of soft
// window-like highlights, which is most of the toy-plastic look. o: { top, hor, gnd, sun:[x,y,z], sunC, blobs:[[x,y,z,k]] }
function gfxEnvMap(o) {
  const es = new THREE.Scene();
  const bl = (o.blobs || []).slice(0, 4).map((b) => new THREE.Vector4(b[0], b[1], b[2], b[3]));
  while (bl.length < 4) bl.push(new THREE.Vector4(0, 1, 0, 0));
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(o.top) }, hor: { value: new THREE.Color(o.hor) }, gnd: { value: new THREE.Color(o.gnd) },
      sunD: { value: new V3(...o.sun).normalize() }, sunC: { value: new THREE.Color(o.sunC).multiplyScalar(o.sunK || 1) }, bl: { value: bl } },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 gnd; uniform vec3 sunD; uniform vec3 sunC; uniform vec4 bl[4]; varying vec3 vD;
      void main(){
        vec3 d = normalize(vD); float h = d.y;
        vec3 c = h > 0.0 ? mix(hor, top, pow(smoothstep(0.0, 0.85, h), 0.8)) : mix(hor, gnd, smoothstep(0.0, -0.3, h));
        c += sunC * pow(max(dot(d, sunD), 0.0), 32.0);
        for (int i = 0; i < 4; i++) c += vec3(bl[i].w) * smoothstep(0.88, 0.97, dot(d, normalize(bl[i].xyz)));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const geo = new THREE.SphereGeometry(20, 64, 32);
  es.add(new THREE.Mesh(geo, mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(es, 0.015, 0.1, 100).texture;
  pm.dispose(); geo.dispose(); mat.dispose();
  return tex;
}
const gfxEnv = gfxEnvMap({ top: 0x6fb6f2, hor: 0xd9f1ff, gnd: 0xe3eef8, sun: [45, 95, 30], sunC: 0xfff0d0, sunK: 3, blobs: [[-0.7, 0.45, -0.5, 0.9], [0.8, 0.35, -0.6, 0.7], [-0.3, 0.3, 0.9, 0.7]] });
scene.environment = gfxEnv;

// ----------------------------------------------------------- materials
// legacy 3-band ramp, kept only in case someone still wants a MeshToonMaterial
const toonGrad = (() => {
  const t = new THREE.DataTexture(new Uint8Array([105, 185, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
})();
const _matCache = new Map();
const GFX_MAT = { roughness: 0.42, metalness: 0, envMapIntensity: 0.5 };
function gfxVinyl(m, rim) { m.defines.VINYL = ''; m.defines.VINYL_RIM = (+rim).toFixed(3); return m; }
// the material factory everyone uses: soft glossy "vinyl toy" MeshStandardMaterial.
// extra: any MeshStandardMaterial params (map, vertexColors, side, transparent, opacity, emissive, roughness...)
//        plus rim: 0..2 (fresnel rim strength, default 1; 0 for big flat surfaces is fine but not required)
function toon(color, extra) {
  if (!extra) { let m = _matCache.get(color); if (!m) { m = gfxVinyl(new THREE.MeshStandardMaterial(Object.assign({ color }, GFX_MAT)), 1); _matCache.set(color, m); } return m; }
  const o = Object.assign({ color }, GFX_MAT, extra);
  const rim = o.rim === undefined ? 1 : o.rim;
  delete o.rim; delete o.gradientMap;
  return gfxVinyl(new THREE.MeshStandardMaterial(o), rim);
}
// HDR colour for things that should glow through the bloom (e.g. MeshBasicMaterial({ color: gfxGlow(0xffb02e, 3) }))
function gfxGlow(color, k = 2.5) { return new THREE.Color(color).multiplyScalar(k); }

// ---------------------------------------------------------- outlines (inverted hull)
// Width is capped in screen pixels so near objects never get fat smudgy lines; MSAA keeps far sub-pixel lines stable.
// outlineMat(w): w in the mesh's local units (as before).  gfxOutlineW(w): w in world metres, independent of mesh scale.
const gfxOlU = { uHalfH: { value: 400 }, uMaxPx: { value: 4, base: 4 } };
const OUTLINE_VS = `uniform float w; uniform float uHalfH; uniform float uMaxPx;
#include <fog_pars_vertex>
void main(){
  vec4 p0 = vec4(position, 1.0);
  #ifdef OL_WORLD
    vec3 n = normal;
    #ifdef USE_INSTANCING
      mat3 im = mat3(instanceMatrix);
      n = im * (n / vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2])));
      p0 = instanceMatrix * p0;
    #endif
    vec4 mvPosition = modelViewMatrix * p0;
    vec3 d = normalize(normalMatrix * n) * w;
  #else
    vec4 p1 = vec4(position + normal * w, 1.0);
    #ifdef USE_INSTANCING
      p0 = instanceMatrix * p0; p1 = instanceMatrix * p1;
    #endif
    vec4 mvPosition = modelViewMatrix * p0;
    vec3 d = (modelViewMatrix * p1).xyz - mvPosition.xyz;
  #endif
  float px = length(d) * projectionMatrix[1][1] * uHalfH / max(0.05, -mvPosition.z);
  mvPosition.xyz += d * min(1.0, uMaxPx / max(px, 1e-4));
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const OUTLINE_FS = `uniform vec3 c;
#include <fog_pars_fragment>
void main(){
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
const _olCache = new Map();
function gfxOlMat(w, world) {
  const key = (world ? 'w' : 'l') + Math.round(w * 2000);
  let m = _olCache.get(key);
  if (!m) {
    m = new THREE.ShaderMaterial({
      uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { w: { value: w }, c: { value: new THREE.Color(INK) }, uHalfH: gfxOlU.uHalfH, uMaxPx: gfxOlU.uMaxPx }),
      vertexShader: OUTLINE_VS, fragmentShader: OUTLINE_FS, side: THREE.BackSide, fog: true,
    });
    if (world) m.defines = { OL_WORLD: '' };
    _olCache.set(key, m);
  }
  return m;
}
function outlineMat(w) { return gfxOlMat(w, false); }
function gfxOutlineW(w) { return gfxOlMat(w, true); }
const GEO = {
  sphere: new THREE.SphereGeometry(1, 28, 20),
  sphereLo: new THREE.SphereGeometry(1, 14, 10),
  half: new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
  cylOpen: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true),
  cone: new THREE.ConeGeometry(1, 1, 22),
  torus: new THREE.TorusGeometry(1, 0.28, 12, 32),
  ico: new THREE.IcosahedronGeometry(1, 1),
  box: new THREE.BoxGeometry(1, 1, 1),
};
// mesh helper: o = outline width in world units (uniform even on squashed meshes, x GFX_OL_K for a bolder ink line)
const GFX_OL_K = 1.35;
function mk(geo, color, opt = {}) {
  const mat = opt.mat || (typeof color === 'number' ? toon(color) : color);
  const m = new THREE.Mesh(geo, mat);
  if (opt.s) m.scale.set(...opt.s);
  if (opt.p) m.position.set(...opt.p);
  if (opt.r) m.rotation.set(...opt.r);
  m.castShadow = opt.cast !== false; m.receiveShadow = !!opt.recv;
  if (opt.o) {
    const ol = new THREE.Mesh(geo, gfxOutlineW(opt.o * GFX_OL_K));
    ol.castShadow = false; ol.receiveShadow = false; m.add(ol);
  }
  return m;
}
// per-frame animation callbacks: any file can push fn(gameDt, realDt); gameDt is 0 while paused
const FRAME_HOOKS = [];

// ----------------------------------------------------------- post-processing
// MSAA HDR target -> bloom (only HDR > ~1.2 glows: flames, glints, sparkles, hot speculars) -> tone curve + grade + dither to screen
const gfxRT = new THREE.WebGLRenderTarget(4, 4, { type: renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: 4 });
const gfxComposer = new gfxEffectComposer(renderer, gfxRT);
gfxComposer.renderTarget1.samples = 0;   // only renderTarget2 (the read buffer) is ever rendered into
const gfxPass = new gfxRenderPass(scene, camera);
const gfxBloom = new gfxUnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.25, 1.2);
// soft-knee *subtractive* bright pass: only the energy above the threshold glows, so a white wall at 1.05 stays crisp
gfxBloom.highPassUniforms.smoothWidth.value = 0.2;
gfxBloom.materialHighPassFilter.fragmentShader = `uniform sampler2D tDiffuse; uniform float luminosityThreshold; uniform float smoothWidth; varying vec2 vUv;
  void main(){
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = max(max(c.r, c.g), c.b);
    float s = clamp(l - luminosityThreshold + smoothWidth, 0.0, 2.0 * smoothWidth);
    s = max(s * s / (4.0 * smoothWidth + 1e-4), l - luminosityThreshold);
    gl_FragColor = vec4(c * (s / max(l, 1e-4)), 1.0);
  }`;
gfxBloom.materialHighPassFilter.needsUpdate = true;
const gfxOut = new gfxShaderPass({
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.16 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: GFX_TONE_GLSL.replace('gfxTone', 'gfxToneP') + `uniform sampler2D tDiffuse; uniform float uVig; varying vec2 vUv;
    void main(){
      vec3 c = gfxToneP(texture2D(tDiffuse, vUv).rgb);
      vec2 q = vUv - 0.5; c *= 1.0 - uVig * smoothstep(0.12, 0.5, dot(q, q));
      c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
gfxOut.needsSwap = false; gfxOut.material.toneMapped = false;
gfxComposer.addPass(gfxPass); gfxComposer.addPass(gfxBloom); gfxComposer.addPass(gfxOut);
// renders any scene through the pipeline (low quality: straight to screen, tone curve applied in the materials)
function gfxRender(sc, cam) {
  if (save.settings.quality === 'low') { renderer.render(sc, cam); return; }
  gfxPass.scene = sc; gfxPass.camera = cam;
  gfxComposer.render();
}
// draws the main game scene for one frame
function renderMain() { gfxRender(scene, camera); }
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
}
