import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ArrowLeft, Pencil, RotateCw } from 'lucide-react';
import type { Map2D, World3D } from '../lib/types';
import { useStore } from '../lib/store';
import { href, navigate } from '../lib/router';
import { buildGeometry } from './terrain';
import { WorldScene } from './World';
import { Player } from './Player';
import { Play2D } from './Studio2D';
import './studio.css';

/** Plays a game made in the studio (opened from the store with #/play/<game id>). */
export default function PlayStudio({ id }: { id?: string }) {
  const game = useStore((s) => s.localGames.find((g) => g.id === id));
  const project = useStore((s) => s.projects.find((p) => p.publishedId === id));
  const back = useCallback(() => navigate(id ? `/game/${id}` : '/'), [id]);

  if (!game || !project) {
    return (
      <div className="studio" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="panel" style={{ padding: 24, textAlign: 'center', maxWidth: 420 }}>
          <h2>Can’t find that world</h2>
          <p className="muted">Studio games are saved in the browser they were made in. This one isn’t here.</p>
          <a className="btn" href={href('/')}>Back to the store</a>
        </div>
      </div>
    );
  }

  return (
    <div className="studio" style={{ gridTemplateColumns: '1fr', gridTemplateRows: '56px minmax(0,1fr)' }}>
      <header className="studio-top">
        <button className="btn ghost small" onClick={back}><ArrowLeft size={16} /> {game.title}</button>
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 12 }}>by {game.author}</span>
        <a className="btn small" href={href(`/studio/${project.data.kind}/${project.id}`)}><Pencil size={14} /> Edit</a>
      </header>
      <div className="studio-canvas">
        {project.data.kind === '2d' ? <Play2D map={project.data as Map2D} onExit={back} /> : <Play3D world={project.data as World3D} onExit={back} />}
      </div>
    </div>
  );
}

function Play3D({ world, onExit }: { world: World3D; onExit: () => void }) {
  const geometry = useMemo(() => buildGeometry(world), [world]);
  const [run, setRun] = useState(0);
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [goal, setGoal] = useState<number | null>(null);
  const [t0, setT0] = useState(() => performance.now());
  const [fp, setFp] = useState(false);
  const coins = world.objects.filter((o) => o.type === 'coin');
  const flags = world.objects.filter((o) => o.type === 'flag');
  const ps1 = world.style === 'ps1';
  const again = () => { setCollected(new Set()); setGoal(null); setT0(performance.now()); setRun((r) => r + 1); };
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit(); if (e.code === 'KeyV') setFp((f) => !f); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onExit]);
  return (
    <div style={{ position: 'absolute', inset: 0 }} className={ps1 ? 'pixelated' : ''}>
      <Canvas key={run} shadows={world.style === 'realistic'} dpr={ps1 ? 0.3 : [1, 2]} camera={{ position: [0, 10, 20], fov: 55 }} style={ps1 ? { imageRendering: 'pixelated' } : undefined}>
        <Suspense fallback={null}>
          <WorldScene world={world} geometry={geometry} version={0} objects={world.objects} hidden={collected}>
            <Player
              world={world}
              objects={world.objects}
              collected={collected}
              firstPerson={fp}
              onCollect={(id) => setCollected((c) => new Set(c).add(id))}
              onGoal={() => setGoal((g) => g ?? (performance.now() - t0) / 1000)}
            />
          </WorldScene>
        </Suspense>
      </Canvas>
      <div className="play-hud">
        <div className="panel hud-box">
          {coins.length > 0 && <span>🪙 {collected.size} / {coins.length}</span>}
          {flags.length > 0 && <span>🏁 {goal != null ? `Reached in ${goal.toFixed(1)} s` : 'Find the flag'}</span>}
          <span className="muted">WASD move · Space jump · Shift run · drag to look · V camera · Esc exit</span>
        </div>
        {goal != null && (
          <div className="win panel">
            <h2>{coins.length && collected.size === coins.length ? 'Perfect run! 🎉' : 'You made it! 🏁'}</h2>
            <p>{coins.length ? `${collected.size} of ${coins.length} coins · ` : ''}{goal.toFixed(1)} seconds</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn play" onClick={again}><RotateCw size={15} /> Again</button>
              <button className="btn" onClick={onExit}>Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
