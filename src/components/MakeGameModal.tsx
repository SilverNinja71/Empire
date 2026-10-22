import { Box, Grid3x3, Pencil } from 'lucide-react';
import { useStore } from '../lib/store';
import { navigate } from '../lib/router';
import { timeAgo } from '../lib/util';
import { Modal } from './ui';

function PixelArt() {
  // A tiny pixel landscape for the 2D card
  const rows = [
    'sssssssssssssssssssssssssssssss',
    'sssssssssscccsssssssssssssssss',
    'ssssssssscccccssssssssyyssssss',
    'sssssssssssssssssssssyyyysssss',
    'ssssssssssssssssssssssyyssssss',
    'sssssssttsssssssssssssssssssss',
    'sssssstttssssssssssttssssssss',
    'ssssstttttssssssssttttsssssss',
    'sssssssbssssssssssssbssssssss',
    'gggggggbgggggggggggggbggggggg',
    'ggggggggggggppggggggggggggggg',
    'ggggggggggppppgggcggggggggggg',
    'gggggggppppggggggggggggwwwwgg',
    'ggggppppgggggggggggggwwwwwwgg',
    'ddddddddddddddddddddddddddddd',
  ];
  const col: Record<string, string> = { s: '#5ec8ff', c: '#ffffff', y: '#ffd84a', t: '#2f9e44', b: '#7a4b23', g: '#5fd35f', p: '#c9a26b', w: '#2563eb', d: '#7a4b23' };
  return (
    <svg viewBox="0 0 31 15" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} shapeRendering="crispEdges">
      {rows.flatMap((r, y) => r.split('').map((ch, x) => <rect key={x + ':' + y} x={x} y={y} width={1.02} height={1.02} fill={col[ch] ?? '#5ec8ff'} />))}
    </svg>
  );
}

function WorldArt() {
  const lines = Array.from({ length: 14 }, (_, i) => i);
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="sky3d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1e1b4b" /><stop offset="1" stopColor="#7c5cff" /></linearGradient>
        <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#0e7490" /></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#sky3d)" />
      <path d="M0 210 Q 90 120 170 190 T 300 150 T 400 180 V300 H0Z" fill="url(#hill)" opacity="0.9" />
      {lines.map((i) => <path key={'h' + i} d={`M0 ${200 + i * 9} Q 200 ${180 + i * 9} 400 ${200 + i * 9}`} stroke="#fff" strokeOpacity={0.18} fill="none" />)}
      {lines.map((i) => <line key={'v' + i} x1={200 + (i - 7) * 12} y1={190} x2={200 + (i - 7) * 60} y2={300} stroke="#fff" strokeOpacity={0.15} />)}
      <g fill="#14532d"><path d="M90 175 l14 -40 l14 40z" /><path d="M110 182 l12 -32 l12 32z" /><path d="M300 150 l14 -44 l14 44z" /></g>
      <circle cx="320" cy="70" r="26" fill="#fde68a" opacity="0.9" />
    </svg>
  );
}

export function MakeGameModal() {
  const open = useStore((s) => s.modal === 'make');
  const projects = useStore((s) => s.projects);
  const close = () => useStore.getState().openModal(null);
  const go = (to: string) => {
    close();
    navigate(to);
  };
  return (
    <Modal open={open} onClose={close} title="✨ Make Your Own Game" width={820}>
      <p className="muted" style={{ marginTop: 0 }}>Pick a style. You can test-play any time, and publish it to the Empire store when it’s ready.</p>
      <div className="mode-cards">
        <button className="mode-card" onClick={() => go('/studio/2d')}>
          <div className="bgart"><PixelArt /></div>
          <div className="shade" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(0,0,0,.75),transparent 60%)' }} />
          <div className="label">
            <h3><Grid3x3 size={22} style={{ verticalAlign: -3 }} /> 2D Pixel Adventure</h3>
            <p>Paint a tile map with grass, water, walls, coins and a goal flag, then walk it with the arrow keys.</p>
          </div>
        </button>
        <button className="mode-card" onClick={() => go('/studio/3d')}>
          <div className="bgart"><WorldArt /></div>
          <div className="shade" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(0,0,0,.75),transparent 60%)' }} />
          <div className="label">
            <h3><Box size={22} style={{ verticalAlign: -3 }} /> 3D World Builder</h3>
            <p>Sculpt hills and valleys, plant forests and rocks, pick a look (realistic, PS1, cel-shaded or voxel) and run around in it.</p>
          </div>
        </button>
      </div>
      {projects.length > 0 && (
        <>
          <h3 style={{ margin: '22px 0 10px', fontSize: 16 }}>Keep working on…</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {projects.slice(0, 5).map((p) => (
              <button key={p.id} className="side-link" onClick={() => go(`/studio/${p.data.kind}/${p.id}`)}>
                <Pencil size={15} /> {p.name} <span className="count">{p.data.kind.toUpperCase()} · {timeAgo(p.updated)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
