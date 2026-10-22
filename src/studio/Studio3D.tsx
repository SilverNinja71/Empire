import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, TransformControls } from '@react-three/drei';
import {
  ArrowLeft, Brush, ChevronsDown, ChevronsUp, Copy, Eraser, Expand, Hand, Layers, Move, MousePointer2, Play, Redo2, Rocket, RotateCw, Save, Scaling, Square, Trash2, Undo2, Waves, X,
} from 'lucide-react';
import type { RenderStyle, StudioObject, World3D } from '../lib/types';
import { useStore } from '../lib/store';
import { href } from '../lib/router';
import { uid } from '../lib/util';
import { ASSET, ASSETS, CATEGORIES } from './assets';
import { brush, buildGeometry, extend, heightAt, MAX_SEGMENTS, newWorld, packHeights, type BrushMode } from './terrain';
import { SCENE_LOOK, WorldScene } from './World';
import { Player } from './Player';
import { PublishDialog } from './PublishDialog';
import './studio.css';

type Tool = 'sculpt' | 'place' | 'select';
type TMode = 'translate' | 'rotate' | 'scale';
interface Snapshot { heights: Float32Array; segments: number; size: number; objects: StudioObject[]; water: number | null }

const MODES: { id: BrushMode; label: string; icon: typeof ChevronsUp; hint: string }[] = [
  { id: 'raise', label: 'Elevate / Bulge', icon: ChevronsUp, hint: 'Pull the ground up into hills' },
  { id: 'lower', label: 'Lower / Dig', icon: ChevronsDown, hint: 'Push it down into valleys and lakes' },
  { id: 'smooth', label: 'Smooth', icon: Waves, hint: 'Soften bumps and sharp edges' },
  { id: 'flatten', label: 'Flatten', icon: Square, hint: 'Level everything to where you started the stroke' },
];

const round = (v: number) => Math.round(v * 100) / 100;

/** Runs the sculpt brush every frame while the mouse is held down, and draws the brush ring on the ground. */
function SculptRing({ active, hover, apply, radius, visible, heightFn }: {
  active: React.MutableRefObject<boolean>;
  hover: React.MutableRefObject<THREE.Vector3 | null>;
  apply: (dt: number) => void;
  radius: number;
  visible: boolean;
  heightFn: (x: number, z: number) => number;
}) {
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(65 * 3), 3));
    const m = new THREE.LineBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true, opacity: 0.9 });
    const l = new THREE.Line(g, m);
    l.renderOrder = 999;
    return l;
  }, []);
  useFrame((_, dt) => {
    if (active.current && hover.current) apply(Math.min(dt, 0.05));
    const p = hover.current;
    line.visible = visible && !!p;
    if (!p) return;
    const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const x = p.x + Math.cos(a) * radius, z = p.z + Math.sin(a) * radius;
      pos.setXYZ(i, x, heightFn(x, z) + 0.08, z);
    }
    pos.needsUpdate = true;
    (line.material as THREE.LineBasicMaterial).color.set(active.current ? '#facc15' : '#ffffff');
  });
  return <primitive object={line} />;
}

/** Grabs the renderer so Publish can take a cover screenshot. */
function GLGrab({ onGL }: { onGL: (gl: THREE.WebGLRenderer, cam: THREE.Camera, scene: THREE.Scene) => void }) {
  const { gl, camera, scene } = useThree();
  useEffect(() => onGL(gl, camera, scene), [gl, camera, scene, onGL]);
  return null;
}

export default function Studio3D({ projectId }: { projectId?: string }) {
  const existing = useStore((s) => (projectId ? s.projects.find((p) => p.id === projectId && p.data.kind === '3d') : undefined));
  const saveProject = useStore((s) => s.saveProject);
  const toast = useStore((s) => s.toast);
  const [pid] = useState(() => existing?.id ?? uid('w_'));
  const [name, setName] = useState(existing?.name ?? 'My World');
  const [publishedId, setPublishedId] = useState(existing?.publishedId);
  const [world, setWorld] = useState<World3D>(() => {
    if (existing) return existing.data as World3D;
    const w = newWorld();
    w.objects = [{ id: uid('o_'), type: 'spawn', position: [0, 0, 8], rotation: [0, 0, 0], scale: [1, 1, 1] }];
    return w;
  });
  const hRef = useRef<Float32Array>(Float32Array.from(world.heights));
  const live = (): World3D => ({ ...world, heights: hRef.current as unknown as number[] });
  const geoRef = useRef<THREE.BufferGeometry>(buildGeometry(live()));
  const [version, setVersion] = useState(0);

  const [tool, setTool] = useState<Tool>('sculpt');
  const [mode, setMode] = useState<BrushMode>('raise');
  const [radius, setRadius] = useState(5);
  const [strength, setStrength] = useState(3);
  const [asset, setAsset] = useState('pine');
  const [cat, setCat] = useState<string>(CATEGORIES[0]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tmode, setTMode] = useState<TMode>('translate');
  const [selObj, setSelObj] = useState<THREE.Group | null>(null);
  const [playing, setPlaying] = useState(false);
  const [firstPerson, setFirstPerson] = useState(false);
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [goal, setGoal] = useState<null | number>(null);
  const [startAt, setStartAt] = useState(0);
  const [saved, setSaved] = useState<'saved' | 'saving' | 'unsaved'>(existing ? 'saved' : 'unsaved');
  const [publishOpen, setPublishOpen] = useState(false);
  const [dirty, setDirty] = useState(existing ? 0 : 1);
  const [help, setHelp] = useState(!existing);

  const stroke = useRef(false);
  const hover = useRef<THREE.Vector3 | null>(null);
  const flatTarget = useRef(0);
  const objRefs = useRef(new Map<string, THREE.Group>());
  const glRef = useRef<{ gl: THREE.WebGLRenderer; cam: THREE.Camera; scene: THREE.Scene } | null>(null);
  const editorCam = useRef<THREE.Vector3 | null>(null);
  const undo = useRef<Snapshot[]>([]);
  const redo = useRef<Snapshot[]>([]);
  const lastVoxel = useRef(0);

  const H = useCallback((x: number, z: number) => heightAt(hRef.current, world.segments, world.size, x, z), [world.segments, world.size]);
  const touch = () => { setDirty((d) => d + 1); setSaved('unsaved'); };

  const snap = (): Snapshot => ({ heights: hRef.current.slice(), segments: world.segments, size: world.size, objects: world.objects, water: world.water });
  const pushUndo = () => {
    undo.current.push(snap());
    if (undo.current.length > 30) undo.current.shift();
    redo.current = [];
  };
  const restore = (s: Snapshot) => {
    hRef.current = s.heights.slice();
    const w = { ...world, segments: s.segments, size: s.size, objects: s.objects, water: s.water };
    geoRef.current = buildGeometry({ ...w, heights: hRef.current as unknown as number[] }, s.segments === world.segments ? geoRef.current : undefined);
    setWorld(w);
    setVersion((v) => v + 1);
    setSelected(null);
    touch();
  };
  const doUndo = () => { const s = undo.current.pop(); if (s) { redo.current.push(snap()); restore(s); } };
  const doRedo = () => { const s = redo.current.pop(); if (s) { undo.current.push(snap()); restore(s); } };

  // Sculpting: change the heights, then refresh the mesh
  const applyBrush = useCallback((dt: number) => {
    const p = hover.current;
    if (!p) return;
    if (brush(hRef.current, world.segments, world.size, p.x, p.z, radius, strength, mode, dt, flatTarget.current)) {
      buildGeometry(live(), geoRef.current);
      const now = performance.now();
      if (world.style === 'voxel' && now - lastVoxel.current > 90) { lastVoxel.current = now; setVersion((v) => v + 1); }
    }
  }, [world, radius, strength, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Objects follow the ground after sculpting
  const settleObjects = () => {
    setWorld((w) => ({ ...w, objects: w.objects.map((o) => ({ ...o, position: [o.position[0], round(heightAt(hRef.current, w.segments, w.size, o.position[0], o.position[2])), o.position[2]] as [number, number, number] })) }));
  };

  const place = (x: number, z: number) => {
    const def = ASSET[asset];
    const lim = world.size / 2 - 1;
    const add: StudioObject[] = [];
    const mk = (type: string, px: number, pz: number, scale = 1): StudioObject => {
      const cx = Math.max(-lim, Math.min(lim, px)), cz = Math.max(-lim, Math.min(lim, pz));
      const spinType = !['house', 'fence', 'bridge', 'path', 'cliff', 'tower', 'spawn', 'flag'].includes(type);
      return { id: uid('o_'), type, position: [round(cx), round(H(cx, cz)), round(cz)], rotation: [0, spinType ? round(Math.random() * Math.PI * 2) : 0, 0], scale: [scale, scale, scale] };
    };
    pushUndo();
    if (def.pack) {
      for (let i = 0; i < def.pack.count; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * def.pack.spread;
        add.push(mk(def.pack.of[Math.floor(Math.random() * def.pack.of.length)], x + Math.cos(a) * r, z + Math.sin(a) * r, round(0.8 + Math.random() * 0.45)));
      }
    } else {
      if (asset === 'pond') {
        flatTarget.current = H(x, z) - 0.3;
        for (let i = 0; i < 6; i++) brush(hRef.current, world.segments, world.size, x, z, 3.8, 6, 'flatten', 0.2, flatTarget.current);
        buildGeometry(live(), geoRef.current);
        setVersion((v) => v + 1);
      }
      add.push(mk(asset, x, z));
    }
    setWorld((w) => ({ ...w, objects: [...(asset === 'spawn' ? w.objects.filter((o) => o.type !== 'spawn') : w.objects), ...add] }));
    if (!def.pack) setSelected(null);
    touch();
  };

  const terrain = {
    onPointerMove: (e: ThreeEvent<PointerEvent>) => { hover.current = e.point.clone(); },
    onPointerLeave: () => { if (!stroke.current) hover.current = null; },
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      if (playing || e.button !== 0) return;
      hover.current = e.point.clone();
      if (tool === 'sculpt') {
        e.stopPropagation();
        pushUndo();
        flatTarget.current = H(e.point.x, e.point.z);
        stroke.current = true;
        setHelp(false);
      }
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      if (playing) return;
      if (tool === 'place' && e.button === 0 && e.delta < 6) { place(e.point.x, e.point.z); setHelp(false); }
      if (tool === 'select' && e.delta < 6 && !e.intersections.some((i) => i.object.parent && i.object !== e.object && isObject(i.object))) setSelected(null);
    },
  };
  const isObject = (o: THREE.Object3D) => {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if ([...objRefs.current.values()].includes(p as THREE.Group)) return true;
    return false;
  };

  // End a sculpt stroke wherever the mouse is let go
  useEffect(() => {
    const up = () => {
      if (!stroke.current) return;
      stroke.current = false;
      setVersion((v) => v + 1);
      settleObjects();
      touch();
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }); // re-bind each render so it sees the current world

  useEffect(() => { setSelObj(selected ? objRefs.current.get(selected) ?? null : null); }, [selected, world.objects]);

  const commitTransform = () => {
    if (!selected || !selObj) return;
    const p = selObj.position, r = selObj.rotation, s = selObj.scale;
    setWorld((w) => ({ ...w, objects: w.objects.map((o) => (o.id === selected ? { ...o, position: [round(p.x), round(p.y), round(p.z)], rotation: [round(r.x), round(r.y), round(r.z)], scale: [round(s.x), round(s.y), round(s.z)] } : o)) }));
    touch();
  };
  const removeSelected = () => {
    if (!selected) return;
    pushUndo();
    setWorld((w) => ({ ...w, objects: w.objects.filter((o) => o.id !== selected) }));
    setSelected(null);
    touch();
  };
  const duplicate = () => {
    const o = world.objects.find((x) => x.id === selected);
    if (!o) return;
    pushUndo();
    const nx = o.position[0] + 2, nz = o.position[2] + 1;
    const copy: StudioObject = { ...o, id: uid('o_'), position: [nx, round(H(nx, nz)), nz] };
    setWorld((w) => ({ ...w, objects: [...w.objects, copy] }));
    setSelected(copy.id);
    touch();
  };
  const dropToGround = () => {
    const o = world.objects.find((x) => x.id === selected);
    if (!o) return;
    pushUndo();
    setWorld((w) => ({ ...w, objects: w.objects.map((x) => (x.id === o.id ? { ...x, position: [x.position[0], round(H(x.position[0], x.position[2])), x.position[2]] } : x)) }));
    touch();
  };

  const setStyle = (style: RenderStyle) => {
    const w = { ...world, style };
    setWorld(w);
    buildGeometry({ ...w, heights: hRef.current as unknown as number[] }, geoRef.current);
    setVersion((v) => v + 1);
    touch();
  };
  const setWater = (water: number | null) => {
    const w = { ...world, water };
    setWorld(w);
    buildGeometry({ ...w, heights: hRef.current as unknown as number[] }, geoRef.current);
    setVersion((v) => v + 1);
    touch();
  };
  const extendMap = () => {
    if (world.segments >= MAX_SEGMENTS) return toast('The map is as big as it gets.');
    pushUndo();
    const w = extend({ ...world, heights: Array.from(hRef.current) });
    hRef.current = Float32Array.from(w.heights);
    geoRef.current = buildGeometry(w);
    setWorld({ ...w, heights: [] });
    setVersion((v) => v + 1);
    touch();
    toast(`Map is now ${Math.round(w.size)} × ${Math.round(w.size)}`);
  };

  // Autosave
  const save = useCallback(() => {
    setSaved('saving');
    saveProject({ id: pid, name: name.trim() || 'My World', updated: Date.now(), publishedId, data: { ...world, heights: packHeights(hRef.current) } });
    if (!window.location.hash.includes(pid)) window.history.replaceState(null, '', '#/studio/3d/' + pid);
    setSaved('saved');
  }, [pid, name, publishedId, world, saveProject, projectId]);
  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(save, 1200);
    return () => window.clearTimeout(t);
  }, [dirty, name, save]);

  const startPlay = () => {
    setSelected(null);
    setCollected(new Set());
    setGoal(null);
    setStartAt(performance.now());
    if (glRef.current) editorCam.current = glRef.current.cam.position.clone();
    setPlaying(true);
    setHelp(false);
  };
  const stopPlay = () => {
    setPlaying(false);
    if (glRef.current && editorCam.current) {
      glRef.current.cam.position.copy(editorCam.current);
      glRef.current.cam.lookAt(0, 0, 0);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea,select')) return;
      if (playing) {
        if (e.key === 'Escape') stopPlay();
        if (e.code === 'KeyV') setFirstPerson((f) => !f);
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); toast('Saved'); return; }
      if (e.key === '1') setTool('sculpt');
      if (e.key === '2') setTool('place');
      if (e.key === '3') setTool('select');
      if (selected) {
        if (e.key === 'g' || e.key === 'w') setTMode('translate');
        if (e.key === 'r' || e.key === 'e') setTMode('rotate');
        if (e.key === 's') setTMode('scale');
        if (e.key === 'Delete' || e.key === 'Backspace') removeSelected();
        if (e.key === 'd' && e.shiftKey) duplicate();
        if (e.key === 'Escape') setSelected(null);
      }
      if (tool === 'sculpt' && e.key === '[') setRadius((r) => Math.max(1, r - 1));
      if (tool === 'sculpt' && e.key === ']') setRadius((r) => Math.min(20, r + 1));
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  const coins = world.objects.filter((o) => o.type === 'coin');
  const flags = world.objects.filter((o) => o.type === 'flag');
  const sel = world.objects.find((o) => o.id === selected);
  const look = SCENE_LOOK[world.style];
  const elapsed = goal ?? 0;
  const ps1 = world.style === 'ps1';
  const onGL = useCallback((gl: THREE.WebGLRenderer, cam: THREE.Camera, scene: THREE.Scene) => { glRef.current = { gl, cam, scene }; }, []);
  // Draw a fresh frame first: a resize (like leaving Test Play) clears the picture until the next frame
  const capture = () => {
    const r = glRef.current;
    if (!r) return null;
    r.gl.render(r.scene, r.cam);
    return r.gl.domElement.toDataURL('image/jpeg', 0.9);
  };

  return (
    <div className="studio">
      <header className="studio-top">
        <a className="btn ghost small" href={href('/library')}><ArrowLeft size={16} /> Empire</a>
        <input className="input studio-name" value={name} maxLength={40} onChange={(e) => { setName(e.target.value); touch(); }} aria-label="World name" />
        <div className="tabs studio-styles" role="radiogroup" aria-label="Look">
          {(Object.keys(SCENE_LOOK) as RenderStyle[]).map((s) => (
            <button key={s} className={world.style === s ? 'on' : ''} title={SCENE_LOOK[s].desc} onClick={() => setStyle(s)}>{SCENE_LOOK[s].label}</button>
          ))}
        </div>
        <div className="spacer" />
        <button className="btn icon small ghost" title="Undo (Ctrl+Z)" onClick={doUndo} disabled={playing}><Undo2 size={16} /></button>
        <button className="btn icon small ghost" title="Redo (Ctrl+Shift+Z)" onClick={doRedo} disabled={playing}><Redo2 size={16} /></button>
        <span className="muted save-state">{saved === 'saved' ? <><Save size={13} /> Saved</> : saved === 'saving' ? 'Saving…' : 'Not saved yet'}</span>
        {playing ? (
          <button className="btn" onClick={stopPlay}><X size={16} /> Stop</button>
        ) : (
          <button className="btn play" onClick={startPlay}><Play size={16} fill="currentColor" /> Test Play</button>
        )}
        <button className="btn primary" onClick={() => { save(); setPublishOpen(true); }} disabled={playing}><Rocket size={16} /> {publishedId ? 'Update' : 'Publish to Empire'}</button>
      </header>

      {!playing && (
        <nav className="studio-rail" aria-label="Tools">
          <button className={tool === 'sculpt' ? 'on' : ''} onClick={() => setTool('sculpt')} title="Sculpt (1)"><Brush size={20} /><span>Sculpt</span></button>
          <button className={tool === 'place' ? 'on' : ''} onClick={() => setTool('place')} title="Place (2)"><Layers size={20} /><span>Place</span></button>
          <button className={tool === 'select' ? 'on' : ''} onClick={() => setTool('select')} title="Select & move (3)"><MousePointer2 size={20} /><span>Select</span></button>
        </nav>
      )}

      <div className={'studio-canvas' + (ps1 ? ' pixelated' : '')}>
        <Canvas
          key={ps1 ? 'lowres' : 'hires'}
          shadows={world.style === 'realistic'}
          dpr={ps1 ? 0.3 : [1, 2]}
          gl={{ preserveDrawingBuffer: true, antialias: !ps1 }}
          camera={{ position: [34, 30, 34], fov: 50, near: 0.1, far: 1000 }}
          onPointerMissed={() => tool === 'select' && setSelected(null)}
        >
          <GLGrab onGL={onGL} />
          <Suspense fallback={null}>
            <WorldScene
              world={{ ...world, heights: hRef.current as unknown as number[] }}
              geometry={geoRef.current}
              version={version}
              terrain={terrain}
              objects={world.objects}
              hidden={playing ? collected : undefined}
              objectRefs={objRefs}
              showGrid={!playing && world.style !== 'voxel'}
              onObjectClick={(id, e) => {
                if (playing || tool !== 'select' || e.delta > 6) return;
                e.stopPropagation();
                setSelected(id);
              }}
            >
              {!playing && <SculptRing active={stroke} hover={hover} apply={applyBrush} radius={tool === 'sculpt' ? radius : 1} visible={tool !== 'select'} heightFn={H} />}
              {playing && (
                <Player
                  world={{ ...world, heights: hRef.current as unknown as number[] }}
                  objects={world.objects}
                  collected={collected}
                  firstPerson={firstPerson}
                  onCollect={(id) => setCollected((c) => new Set(c).add(id))}
                  onGoal={() => setGoal((g) => { if (g == null) useStore.getState().completeLevel(); return g ?? (performance.now() - startAt) / 1000; })}
                />
              )}
            </WorldScene>
            {!playing && (
              <OrbitControls
                makeDefault
                target={[0, 0, 0]}
                maxPolarAngle={Math.PI / 2.05}
                minDistance={4}
                maxDistance={world.size * 2.2}
                mouseButtons={{ LEFT: (tool === 'select' ? THREE.MOUSE.ROTATE : -1) as THREE.MOUSE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }}
                touches={{ ONE: (tool === 'select' ? THREE.TOUCH.ROTATE : -1) as THREE.TOUCH, TWO: THREE.TOUCH.DOLLY_ROTATE }}
              />
            )}
            {!playing && selObj && (
              <TransformControls object={selObj} mode={tmode} size={0.8} onMouseDown={pushUndo} onMouseUp={commitTransform} />
            )}
          </Suspense>
        </Canvas>

        {help && !playing && (
          <div className="studio-hint">
            <b>Welcome to the World Builder!</b>
            <span>Click and hold on the ground to raise a hill. Right-drag to look around, scroll to zoom.</span>
            <span>Then pick <b>Place</b> to add trees, rocks, coins and a goal flag, and press <b>Test Play</b>.</span>
            <button className="btn small" onClick={() => setHelp(false)}>Got it</button>
          </div>
        )}
        {!playing && !help && (
          <div className="studio-tip muted">
            {tool === 'sculpt' && 'Hold left mouse to sculpt · [ ] change brush size · right-drag to orbit · scroll to zoom · middle-drag to pan'}
            {tool === 'place' && `Click the ground to place: ${ASSET[asset].name} · right-drag to orbit`}
            {tool === 'select' && 'Click an object to select it · drag the arrows to move · G move, R rotate, S scale · Delete removes'}
          </div>
        )}
        {playing && (
          <div className="play-hud">
            <div className="panel hud-box">
              {coins.length > 0 && <span>🪙 {collected.size} / {coins.length}</span>}
              {flags.length > 0 && <span>🏁 {goal != null ? `Reached in ${elapsed.toFixed(1)} s` : 'Find the flag'}</span>}
              <span className="muted">WASD move · Space jump · Shift run · drag to look · V {firstPerson ? 'third' : 'first'}-person · Esc stop</span>
            </div>
            {goal != null && (
              <div className="win panel">
                <h2>{coins.length && collected.size === coins.length ? 'Perfect run! 🎉' : 'You made it! 🏁'}</h2>
                <p>{coins.length ? `${collected.size} of ${coins.length} coins · ` : ''}{elapsed.toFixed(1)} seconds</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button className="btn play" onClick={startPlay}><RotateCw size={15} /> Again</button>
                  <button className="btn" onClick={stopPlay}>Back to editing</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!playing && (
        <aside className="studio-panel">
          {tool === 'sculpt' && (
            <>
              <h3>Sculpt</h3>
              <div className="mode-grid">
                {MODES.map((m) => (
                  <button key={m.id} className={'mode-btn' + (mode === m.id ? ' on' : '')} onClick={() => setMode(m.id)} title={m.hint}>
                    <m.icon size={18} /> {m.label}
                  </button>
                ))}
              </div>
              <p className="muted small">{MODES.find((m) => m.id === mode)!.hint}</p>
              <label className="slider">Brush radius <b>{radius}</b>
                <input type="range" min={1} max={20} step={0.5} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
              </label>
              <label className="slider">Brush strength <b>{strength}</b>
                <input type="range" min={0.5} max={10} step={0.5} value={strength} onChange={(e) => setStrength(Number(e.target.value))} />
              </label>
              <h3>Map</h3>
              <p className="muted small">{Math.round(world.size)} × {Math.round(world.size)} units · {world.segments + 1}² points</p>
              <button className="btn" style={{ width: '100%' }} onClick={extendMap} disabled={world.segments >= MAX_SEGMENTS}><Expand size={16} /> Extend map outward</button>
              <h3>Water</h3>
              {world.water == null ? (
                <button className="btn" style={{ width: '100%' }} onClick={() => setWater(0.4)}><Waves size={16} /> Add water</button>
              ) : (
                <>
                  <label className="slider">Water level <b>{world.water.toFixed(1)}</b>
                    <input type="range" min={-6} max={12} step={0.1} value={world.water} onChange={(e) => setWater(Number(e.target.value))} />
                  </label>
                  <button className="btn small ghost" onClick={() => setWater(null)}><Eraser size={14} /> Remove water</button>
                </>
              )}
              <h3>Reset</h3>
              <button className="btn small danger" onClick={() => { pushUndo(); hRef.current.fill(0); buildGeometry(live(), geoRef.current); setVersion((v) => v + 1); settleObjects(); touch(); }}><Eraser size={14} /> Flatten everything</button>
            </>
          )}
          {tool === 'place' && (
            <>
              <h3>Asset library</h3>
              <div className="cat-tabs">
                {CATEGORIES.map((c) => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}
              </div>
              <div className="asset-grid">
                {ASSETS.filter((a) => a.cat === cat).map((a) => (
                  <button key={a.id} className={'asset' + (asset === a.id ? ' on' : '')} onClick={() => setAsset(a.id)}>
                    <span className="emo">{a.emoji}</span>
                    {a.name}
                  </button>
                ))}
              </div>
              <p className="muted small">
                {ASSET[asset].pack ? `Scatters ${ASSET[asset].pack!.count} pieces around where you click.` : asset === 'spawn' ? 'Where the player starts. Only one per world.' : asset === 'coin' ? 'Players collect these in Test Play.' : asset === 'flag' ? 'Reaching it finishes the level.' : asset === 'pond' ? 'Flattens a little dip and fills it with water.' : 'Lands on the ground wherever you click.'}
              </p>
              <h3>In this world</h3>
              <p className="muted small">{world.objects.length} objects · {coins.length} coins · {flags.length ? 'goal flag placed' : 'no goal flag yet'}</p>
            </>
          )}
          {tool === 'select' && (
            <>
              <h3>Select & transform</h3>
              {!sel ? (
                <p className="muted small">Click an object in the world to select it.</p>
              ) : (
                <>
                  <p><b>{ASSET[sel.type]?.emoji} {ASSET[sel.type]?.name ?? sel.type}</b></p>
                  <div className="tabs" style={{ width: '100%' }}>
                    <button className={tmode === 'translate' ? 'on' : ''} onClick={() => setTMode('translate')}><Move size={14} /> Move</button>
                    <button className={tmode === 'rotate' ? 'on' : ''} onClick={() => setTMode('rotate')}><RotateCw size={14} /> Rotate</button>
                    <button className={tmode === 'scale' ? 'on' : ''} onClick={() => setTMode('scale')}><Scaling size={14} /> Scale</button>
                  </div>
                  <dl className="kv small" style={{ marginTop: 12 }}>
                    <dt>Position</dt><dd className="mono">{sel.position.map((v) => v.toFixed(1)).join(', ')}</dd>
                    <dt>Turn</dt><dd className="mono">{Math.round((sel.rotation[1] * 180) / Math.PI)}°</dd>
                    <dt>Size</dt><dd className="mono">{sel.scale[0].toFixed(2)}×</dd>
                  </dl>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <button className="btn" onClick={dropToGround}><Hand size={15} /> Drop to ground</button>
                    <button className="btn" onClick={duplicate}><Copy size={15} /> Duplicate (Shift+D)</button>
                    <button className="btn danger" onClick={removeSelected}><Trash2 size={15} /> Delete</button>
                  </div>
                </>
              )}
            </>
          )}
          <div className="style-note">
            <b>{look.label}</b> <span className="muted small">{look.desc}</span>
          </div>
        </aside>
      )}

      {publishOpen && (
        <PublishDialog
          kind="3d"
          projectName={name}
          publishedId={publishedId}
          projectId={pid}
          capture={capture}
          onClose={() => setPublishOpen(false)}
          onPublished={(id) => {
            setPublishedId(id);
            saveProject({ id: pid, name: name.trim() || 'My World', updated: Date.now(), publishedId: id, data: { ...world, heights: packHeights(hRef.current) } });
          }}
        />
      )}
    </div>
  );
}
