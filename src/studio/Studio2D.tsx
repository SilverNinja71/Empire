import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Expand, Eraser, PaintBucket, Paintbrush, Play, Redo2, Rocket, RotateCw, Save, Undo2, X } from 'lucide-react';
import type { Map2D } from '../lib/types';
import { useStore } from '../lib/store';
import { href } from '../lib/router';
import { uid } from '../lib/util';
import { PublishDialog } from './PublishDialog';
import './studio.css';

/** 16×16 pixel tiles. solid = you can't walk through it. */
export const TILES: { id: string; name: string; solid?: boolean; kind?: 'coin' | 'spike' | 'start' | 'flag' }[] = [
  { id: 'grass', name: 'Grass' },
  { id: 'path', name: 'Path' },
  { id: 'sand', name: 'Sand' },
  { id: 'flowers', name: 'Flowers' },
  { id: 'water', name: 'Water', solid: true },
  { id: 'wall', name: 'Wall', solid: true },
  { id: 'tree', name: 'Tree', solid: true },
  { id: 'rock', name: 'Rock', solid: true },
  { id: 'coin', name: 'Coin', kind: 'coin' },
  { id: 'spike', name: 'Spikes', kind: 'spike' },
  { id: 'start', name: 'Start', kind: 'start' },
  { id: 'flag', name: 'Goal flag', kind: 'flag' },
];
const TILE = Object.fromEntries(TILES.map((t) => [t.id, t]));
const T = 16;

function rnd(x: number, y: number, k = 0) {
  const s = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Draw one tile, pixel by pixel. `t` animates water and coins. */
export function drawTile(g: CanvasRenderingContext2D, id: string, px: number, py: number, cx: number, cy: number, t = 0) {
  const P = (x: number, y: number, c: string, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(px + x, py + y, w, h); };
  const ground = (base: string, dots: string[]) => {
    P(0, 0, base, T, T);
    for (let i = 0; i < 10; i++) P(Math.floor(rnd(cx, cy, i) * 16), Math.floor(rnd(cx, cy, i + 20) * 16), dots[i % dots.length]);
  };
  switch (id) {
    case 'grass': ground('#5fbf4a', ['#4ea83c', '#74d15c', '#4ea83c']); break;
    case 'path': ground('#d2b48c', ['#c19e72', '#e0c7a4']); break;
    case 'sand': ground('#f0d98c', ['#e2c672', '#f8e8b0']); break;
    case 'flowers':
      ground('#5fbf4a', ['#4ea83c', '#74d15c']);
      [[3, 4, '#f472b6'], [10, 3, '#facc15'], [6, 11, '#a78bfa'], [12, 12, '#ffffff']].forEach(([x, y, c]) => { P(Number(x), Number(y), String(c), 2, 2); P(Number(x), Number(y) + 2, '#2f7d32', 1, 2); });
      break;
    case 'water': {
      P(0, 0, '#2563eb', T, T);
      for (let i = 0; i < 4; i++) {
        const y = (i * 4 + Math.floor(t * 4 + cx)) % 16;
        P(Math.floor(rnd(cx, cy, i) * 10), y, '#60a5fa', 5, 1);
      }
      break;
    }
    case 'wall':
      P(0, 0, '#8b8f99', T, T);
      for (let r = 0; r < 4; r++) {
        P(0, r * 4, '#6b6f78', T, 1);
        const off = r % 2 ? 4 : 0;
        for (let c = 0; c < 3; c++) P((off + c * 8) % 16, r * 4, '#6b6f78', 1, 4);
      }
      break;
    case 'tree':
      ground('#5fbf4a', ['#4ea83c']);
      P(7, 11, '#7a4b23', 2, 4);
      P(3, 2, '#2f7d32', 10, 9); P(2, 4, '#2f7d32', 12, 5); P(5, 1, '#3f9d42', 6, 2); P(4, 3, '#3f9d42', 3, 3);
      break;
    case 'rock':
      ground('#5fbf4a', ['#4ea83c']);
      P(3, 5, '#7d7d7d', 10, 8); P(4, 4, '#9a9a9a', 7, 3); P(2, 8, '#6b6b6b', 12, 5); P(5, 5, '#b5b5b5', 2, 2);
      break;
    case 'coin': {
      ground('#5fbf4a', ['#4ea83c']);
      const b = Math.round(Math.sin(t * 4 + cx) * 1);
      P(5, 4 + b, '#facc15', 6, 8); P(4, 5 + b, '#facc15', 8, 6); P(6, 5 + b, '#fde68a', 2, 5); P(9, 6 + b, '#d97706', 1, 4);
      break;
    }
    case 'spike':
      ground('#d2b48c', ['#c19e72']);
      for (let i = 0; i < 4; i++) { P(1 + i * 4, 10, '#9ca3af', 3, 4); P(2 + i * 4, 7, '#d1d5db', 1, 3); }
      break;
    case 'start':
      ground('#5fbf4a', ['#4ea83c']);
      P(3, 3, '#22d3ee', 10, 1); P(3, 12, '#22d3ee', 10, 1); P(3, 3, '#22d3ee', 1, 10); P(12, 3, '#22d3ee', 1, 10);
      break;
    case 'flag':
      ground('#5fbf4a', ['#4ea83c']);
      P(4, 2, '#e5e7eb', 1, 13); P(5, 2, '#ef4444', 7, 5); P(5, 4, '#b91c1c', 7, 1);
      break;
    default: P(0, 0, '#ff00ff', T, T);
  }
}

/** The player sprite: a little penguin facing `dir` (0 down, 1 left, 2 right, 3 up). */
function drawPenguin(g: CanvasRenderingContext2D, px: number, py: number, dir: number, step: number) {
  const P = (x: number, y: number, c: string, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(Math.round(px + x), Math.round(py + y), w, h); };
  const bob = step % 2 ? 1 : 0;
  P(4, 3 + bob, '#1f2a36', 8, 11); P(3, 5 + bob, '#1f2a36', 10, 8);
  if (dir !== 3) P(5, 6 + bob, '#ffffff', 6, 7);
  if (dir === 0) { P(6, 5 + bob, '#ffffff', 1, 1); P(9, 5 + bob, '#ffffff', 1, 1); P(7, 7 + bob, '#f7a21b', 2, 1); }
  if (dir === 1) { P(5, 5 + bob, '#ffffff', 1, 1); P(3, 7 + bob, '#f7a21b', 2, 1); }
  if (dir === 2) { P(10, 5 + bob, '#ffffff', 1, 1); P(11, 7 + bob, '#f7a21b', 2, 1); }
  P(4, 14, '#f7a21b', 3, 1 + (step % 2)); P(9, 14, '#f7a21b', 3, 2 - (step % 2));
}

export function newMap(): Map2D {
  const w = 24, h = 16;
  const tiles = new Array(w * h).fill('grass');
  for (let x = 0; x < w; x++) { tiles[x] = 'tree'; tiles[(h - 1) * w + x] = 'tree'; }
  for (let y = 0; y < h; y++) { tiles[y * w] = 'tree'; tiles[y * w + w - 1] = 'tree'; }
  tiles[8 * w + 3] = 'start';
  tiles[8 * w + 20] = 'flag';
  return { kind: '2d', w, h, tiles };
}

function renderMap(g: CanvasRenderingContext2D, m: Map2D, t: number, skip?: Set<number>) {
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const i = y * m.w + x;
    drawTile(g, skip?.has(i) ? 'grass' : m.tiles[i], x * T, y * T, x, y, t);
  }
}

/** Test Play for a 2D map: arrow keys or WASD, collect coins, avoid spikes, reach the flag. */
export function Play2D({ map, onExit }: { map: Map2D; onExit?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const total0 = map.tiles.filter((t) => t === 'coin').length;
  const [hud, setHud] = useState({ coins: 0, total: total0, won: false, time: 0, deaths: 0 });
  const [run, setRun] = useState(0);
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext('2d')!;
    const startIdx = Math.max(0, map.tiles.indexOf('start'));
    const sx = (startIdx % map.w) * T, sy = Math.floor(startIdx / map.w) * T;
    const p = { x: sx, y: sy, dir: 0, step: 0, dist: 0 };
    const got = new Set<number>();
    const total = map.tiles.filter((t) => t === 'coin').length;
    const keys = new Set<string>();
    let won = false, deaths = 0, flash = 0, raf = 0, last = performance.now();
    const t0 = performance.now();
    const solidAt = (x: number, y: number) => {
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
      return !!TILE[map.tiles[ty * map.w + tx]]?.solid;
    };
    const hits = (x: number, y: number) => solidAt(x + 3, y + 8) || solidAt(x + 12, y + 8) || solidAt(x + 3, y + 15) || solidAt(x + 12, y + 15);
    const down = (e: KeyboardEvent) => {
      keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (e.code === 'Escape') onExit?.();
    };
    const up = (e: KeyboardEvent) => keys.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!won) {
        const sp = 70 * dt;
        let dx = 0, dy = 0;
        if (keys.has('ArrowLeft') || keys.has('KeyA')) { dx -= sp; p.dir = 1; }
        if (keys.has('ArrowRight') || keys.has('KeyD')) { dx += sp; p.dir = 2; }
        if (keys.has('ArrowUp') || keys.has('KeyW')) { dy -= sp; p.dir = 3; }
        if (keys.has('ArrowDown') || keys.has('KeyS')) { dy += sp; p.dir = 0; }
        if (dx && !hits(p.x + dx, p.y)) p.x += dx;
        if (dy && !hits(p.x, p.y + dy)) p.y += dy;
        if (dx || dy) { p.dist += Math.abs(dx) + Math.abs(dy); p.step = Math.floor(p.dist / 6); }
        const ti = Math.floor((p.y + 11) / T) * map.w + Math.floor((p.x + 8) / T);
        const tile = map.tiles[ti];
        if (tile === 'coin' && !got.has(ti)) got.add(ti);
        if (tile === 'spike') { p.x = sx; p.y = sy; deaths++; flash = 0.3; }
        if (tile === 'flag') won = true;
      }
      flash = Math.max(0, flash - dt);
      renderMap(g, map, now / 1000, got);
      drawPenguin(g, p.x, p.y, p.dir, p.step);
      if (flash) { g.fillStyle = `rgba(255,0,0,${flash})`; g.fillRect(0, 0, c.width, c.height); }
      setHud((h) => {
        const time = won ? h.time : (now - t0) / 1000;
        return h.coins === got.size && h.won === won && h.deaths === deaths && Math.floor(h.time * 10) === Math.floor(time * 10) ? h : { coins: got.size, total, won, time, deaths };
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    c.focus();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [map, run, onExit]);
  return (
    <div className="px-wrap" style={{ position: 'relative' }}>
      <canvas ref={ref} className="px-canvas" width={map.w * T} height={map.h * T} style={{ width: map.w * T * 3, maxWidth: '100%' }} tabIndex={0} aria-label="Game" />
      <div className="play-hud">
        <div className="panel hud-box">
          {hud.total > 0 && <span>🪙 {hud.coins} / {hud.total}</span>}
          <span>⏱ {hud.time.toFixed(1)} s</span>
          {hud.deaths > 0 && <span>💥 {hud.deaths}</span>}
          <span className="muted">Arrow keys or WASD · Esc to stop</span>
        </div>
        {hud.won && (
          <div className="win panel">
            <h2>{hud.total && hud.coins === hud.total ? 'Perfect run! 🎉' : 'You made it! 🏁'}</h2>
            <p>{hud.total ? `${hud.coins} of ${hud.total} coins · ` : ''}{hud.time.toFixed(1)} seconds</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn play" onClick={() => { setHud({ coins: 0, total: total0, won: false, time: 0, deaths: 0 }); setRun((r) => r + 1); }}><RotateCw size={15} /> Again</button>
              {onExit && <button className="btn" onClick={onExit}>Back</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TileSwatch({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const g = ref.current!.getContext('2d')!; drawTile(g, id, 0, 0, 3, 5, 0); }, [id]);
  return <canvas ref={ref} width={16} height={16} />;
}

export default function Studio2D({ projectId }: { projectId?: string }) {
  const existing = useStore((s) => (projectId ? s.projects.find((p) => p.id === projectId && p.data.kind === '2d') : undefined));
  const saveProject = useStore((s) => s.saveProject);
  const toast = useStore((s) => s.toast);
  const [pid] = useState(() => existing?.id ?? uid('m_'));
  const [name, setName] = useState(existing?.name ?? 'My Adventure');
  const [publishedId, setPublishedId] = useState(existing?.publishedId);
  const [map, setMap] = useState<Map2D>(() => (existing?.data as Map2D) ?? newMap());
  const [tile, setTile] = useState('wall');
  const [tool, setTool] = useState<'paint' | 'fill'>('paint');
  const [playing, setPlaying] = useState(false);
  const [saved, setSaved] = useState(existing ? 'saved' : 'unsaved');
  const [dirty, setDirty] = useState(existing ? 0 : 1);
  const [publishOpen, setPublishOpen] = useState(false);
  const ref = useRef<HTMLCanvasElement>(null);
  const undo = useRef<Map2D[]>([]);
  const redo = useRef<Map2D[]>([]);
  const painting = useRef(false);

  useEffect(() => {
    if (playing) return;
    const g = ref.current?.getContext('2d');
    if (g) renderMap(g, map, 0);
  }, [map, playing]);

  const touch = () => { setDirty((d) => d + 1); setSaved('unsaved'); };
  const save = useCallback(() => {
    saveProject({ id: pid, name: name.trim() || 'My Adventure', updated: Date.now(), publishedId, data: map });
    if (!window.location.hash.includes(pid)) window.history.replaceState(null, '', '#/studio/2d/' + pid);
    setSaved('saved');
  }, [pid, name, publishedId, map, saveProject, projectId]);
  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(save, 1000);
    return () => window.clearTimeout(t);
  }, [dirty, save]);

  const cellAt = (e: React.PointerEvent) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * map.w);
    const y = Math.floor(((e.clientY - r.top) / r.height) * map.h);
    return x < 0 || y < 0 || x >= map.w || y >= map.h ? -1 : y * map.w + x;
  };
  const paint = (i: number) => {
    if (i < 0 || map.tiles[i] === tile) return;
    setMap((m) => {
      const tiles = m.tiles.slice();
      if (tile === 'start' || tile === 'flag') for (let k = 0; k < tiles.length; k++) if (tiles[k] === tile) tiles[k] = 'grass';
      tiles[i] = tile;
      return { ...m, tiles };
    });
    touch();
  };
  const fill = (i: number) => {
    if (i < 0) return;
    const from = map.tiles[i];
    if (from === tile) return;
    const tiles = map.tiles.slice();
    const stack = [i];
    while (stack.length) {
      const k = stack.pop()!;
      if (tiles[k] !== from) continue;
      tiles[k] = tile;
      const x = k % map.w, y = Math.floor(k / map.w);
      if (x > 0) stack.push(k - 1);
      if (x < map.w - 1) stack.push(k + 1);
      if (y > 0) stack.push(k - map.w);
      if (y < map.h - 1) stack.push(k + map.w);
    }
    setMap({ ...map, tiles });
    touch();
  };
  const pushUndo = () => { undo.current.push(map); if (undo.current.length > 40) undo.current.shift(); redo.current = []; };
  const doUndo = () => { const m = undo.current.pop(); if (m) { redo.current.push(map); setMap(m); touch(); } };
  const doRedo = () => { const m = redo.current.pop(); if (m) { undo.current.push(map); setMap(m); touch(); } };
  const grow = () => {
    if (map.w >= 64) return toast('The map is as big as it gets.');
    pushUndo();
    const w = map.w + 4, h = Math.min(48, map.h + 2);
    const tiles = new Array(w * h).fill('grass');
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) tiles[(y + 1) * w + x + 2] = map.tiles[y * map.w + x];
    setMap({ kind: '2d', w, h, tiles });
    touch();
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (playing || (e.target as HTMLElement)?.closest?.('input,textarea')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); toast('Saved'); }
      if (e.key === 'b') setTool('paint');
      if (e.key === 'f') setTool('fill');
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  const coins = map.tiles.filter((t) => t === 'coin').length;
  const exitPlay = useCallback(() => setPlaying(false), []);

  return (
    <div className="studio">
      <header className="studio-top">
        <a className="btn ghost small" href={href('/library')}><ArrowLeft size={16} /> Empire</a>
        <input className="input studio-name" value={name} maxLength={40} onChange={(e) => { setName(e.target.value); touch(); }} aria-label="Map name" />
        <span className="badge">2D Pixel Adventure</span>
        <div className="spacer" />
        <button className="btn icon small ghost" title="Undo (Ctrl+Z)" onClick={doUndo} disabled={playing}><Undo2 size={16} /></button>
        <button className="btn icon small ghost" title="Redo" onClick={doRedo} disabled={playing}><Redo2 size={16} /></button>
        <span className="muted save-state">{saved === 'saved' ? <><Save size={13} /> Saved</> : 'Not saved yet'}</span>
        {playing ? (
          <button className="btn" onClick={() => setPlaying(false)}><X size={16} /> Stop</button>
        ) : (
          <button className="btn play" onClick={() => setPlaying(true)}><Play size={16} fill="currentColor" /> Test Play</button>
        )}
        <button className="btn primary" onClick={() => { save(); setPublishOpen(true); }} disabled={playing}><Rocket size={16} /> {publishedId ? 'Update' : 'Publish to Empire'}</button>
      </header>
      {!playing && (
        <nav className="studio-rail" aria-label="Tools">
          <button className={tool === 'paint' ? 'on' : ''} onClick={() => setTool('paint')} title="Paint (B)"><Paintbrush size={20} /><span>Paint</span></button>
          <button className={tool === 'fill' ? 'on' : ''} onClick={() => setTool('fill')} title="Fill (F)"><PaintBucket size={20} /><span>Fill</span></button>
        </nav>
      )}
      <div className="studio-canvas">
        {playing ? (
          <Play2D map={map} onExit={exitPlay} />
        ) : (
          <div className="px-wrap">
            <canvas
              ref={ref}
              className="px-canvas"
              width={map.w * T}
              height={map.h * T}
              style={{ width: map.w * T * 3 }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                pushUndo();
                const i = cellAt(e);
                if (tool === 'fill') fill(i);
                else { painting.current = true; paint(i); }
              }}
              onPointerMove={(e) => painting.current && paint(cellAt(e))}
              onPointerUp={() => { painting.current = false; }}
            />
          </div>
        )}
        {!playing && <div className="studio-tip muted">Pick a tile on the right, then click or drag on the map · F fill · Ctrl+Z undo</div>}
      </div>
      {!playing && (
        <aside className="studio-panel">
          <h3>Tiles</h3>
          <div className="tile-grid">
            {TILES.map((t) => (
              <button key={t.id} className={'tile-btn' + (tile === t.id ? ' on' : '')} onClick={() => setTile(t.id)}>
                <TileSwatch id={t.id} />
                {t.name}
              </button>
            ))}
          </div>
          <p className="muted small">
            {TILE[tile].solid ? 'Blocks the player.' : TILE[tile].kind === 'coin' ? 'Collect them all for a perfect run.' : TILE[tile].kind === 'spike' ? 'Sends the player back to the start.' : TILE[tile].kind === 'start' ? 'Where the player begins (only one).' : TILE[tile].kind === 'flag' ? 'Reach it to win (only one).' : 'You can walk on it.'}
          </p>
          <h3>Map</h3>
          <p className="muted small">{map.w} × {map.h} tiles · {coins} coin{coins === 1 ? '' : 's'}</p>
          <button className="btn" onClick={grow}><Expand size={15} /> Make the map bigger</button>
          <button className="btn small danger" onClick={() => { pushUndo(); setMap(newMap()); touch(); }}><Eraser size={14} /> Start over</button>
        </aside>
      )}
      {publishOpen && (
        <PublishDialog
          kind="2d"
          projectName={name}
          projectId={pid}
          publishedId={publishedId}
          capture={() => ref.current?.toDataURL('image/png') ?? null}
          onClose={() => setPublishOpen(false)}
          onPublished={(id) => {
            setPublishedId(id);
            saveProject({ id: pid, name: name.trim() || 'My Adventure', updated: Date.now(), publishedId: id, data: map });
          }}
        />
      )}
    </div>
  );
}
