import type { Deco } from '../lib/themes';
import { useThemeDef } from '../lib/useTheme';

/** Pixel art from strings: each character is one pixel in the palette. */
function Pixels({ rows, pal, size = 3, className, style }: { rows: string[]; pal: Record<string, string>; size?: number; className?: string; style?: React.CSSProperties }) {
  const w = Math.max(...rows.map((r) => r.length));
  return (
    <svg className={className} style={style} width={w * size} height={rows.length * size} viewBox={`0 0 ${w} ${rows.length}`} shapeRendering="crispEdges" aria-hidden>
      {rows.flatMap((r, y) => r.split('').map((c, x) => (pal[c] ? <rect key={x + ':' + y} x={x} y={y} width={1.02} height={1.02} fill={pal[c]} /> : null)))}
    </svg>
  );
}

const FLOWER = ['...oooo...', '..oyyyyo..', '.oyywwyyo.', '.oyywwyyo.', '..oyyyyo..', '...oooo...', '....gg....', '.gg.gg.gg.', '..gggggg..', '....gg....'];
const MUSHROOM = ['...rrrr...', '.rrwwrrrr.', 'rrwwwrrwwr', 'rrrrrrrwwr', 'rwwrrrrrrr', '.rrrrrrrr.', '..ssssss..', '..sksksk..', '..ssssss..', '...ssss...'];
const PIRANHA = ['.rrrrrr.', 'rrwrrwrr', 'rrrrrrrr', 'wwwwwwww', 'rrrrrrrr', '.rrrrrr.', '...gg...', '..gggg..', '...gg...'];
const PIPE = ['kkkkkkkkkk', 'kGGgggggdk', 'kGGgggggdk', 'kkkkkkkkkk', '.kGggggdk.', '.kGggggdk.', '.kGggggdk.', '.kGggggdk.'];
const PAL = { o: '#f97316', y: '#fde047', w: '#ffffff', g: '#22a33a', r: '#e52521', s: '#f5d6a8', k: '#0b1d0d', G: '#7ee08a', d: '#137a28' };

function MarioDeco({ i }: { i: number }) {
  return (
    <>
      <div className="mario-ground" />
      <Pixels className="mario-item" rows={i % 2 ? MUSHROOM : FLOWER} pal={PAL} size={3} />
      <div className="mario-pipe left">
        <Pixels className="piranha" rows={PIRANHA} pal={PAL} size={3} />
        <Pixels rows={PIPE} pal={PAL} size={3} />
      </div>
      <div className="mario-pipe right"><Pixels rows={PIPE} pal={PAL} size={3} /></div>
    </>
  );
}

function Leaf({ color, className }: { color: string; className: string }) {
  return (
    <svg className={className} viewBox="-14 -14 28 30" width="34" height="36" aria-hidden>
      <path d="M0 -12 L3 -5 L9 -8 L6 -1 L12 1 L5 4 L6 10 L0 6 L-6 10 L-5 4 L-12 1 L-6 -1 L-9 -8 L-3 -5 Z M0 6 L0 14" fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

function SootSprite({ className, delay }: { className: string; delay: number }) {
  return (
    <svg className={className} viewBox="-20 -20 40 40" width="34" height="34" aria-hidden style={{ animationDelay: `${delay}s` }}>
      <g stroke="#111" strokeWidth="1.6">
        {Array.from({ length: 24 }, (_, k) => {
          const a = (k / 24) * Math.PI * 2;
          return <line key={k} x1={Math.cos(a) * 11} y1={Math.sin(a) * 11} x2={Math.cos(a) * 16} y2={Math.sin(a) * 16} />;
        })}
      </g>
      <circle r="12.5" fill="#111" />
      <g className="soot-eyes">
        <circle cx="-4.5" cy="-1" r="4" fill="#fff" /><circle cx="4.5" cy="-1" r="4" fill="#fff" />
        <circle cx="-4" cy="-0.5" r="1.8" fill="#111" /><circle cx="5" cy="-0.5" r="1.8" fill="#111" />
      </g>
    </svg>
  );
}

function Compass() {
  return (
    <svg className="op-compass" viewBox="-20 -20 40 40" width="44" height="44" aria-hidden>
      <circle r="17" fill="#f5e6c8" stroke="#6b4423" strokeWidth="2" />
      <path d="M0 -15 L4 0 L0 4 L-4 0Z" fill="#dc2626" /><path d="M0 15 L4 0 L0 -4 L-4 0Z" fill="#3b2410" />
      <circle r="2" fill="#f7c844" />
    </svg>
  );
}

function Talisman() {
  return (
    <svg className="jjk-talisman" viewBox="0 0 22 60" width="22" height="60" aria-hidden>
      <rect width="22" height="60" fill="#f3ead2" />
      <rect x="2" y="2" width="18" height="56" fill="none" stroke="#e63946" strokeWidth="1.2" />
      <path d="M11 8 v14 M6 14 h10 M7 30 q4 -6 8 0 q-4 6 -8 0 M11 38 v12 M6 44 l10 0" stroke="#111" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="11" cy="52" r="3.4" fill="#e63946" />
    </svg>
  );
}

/** Theme decorations layered on a game card (they never catch clicks). */
export function CardDeco({ index = 0 }: { index?: number }) {
  const { deco } = useThemeDef();
  return <DecoFor deco={deco} index={index} />;
}

export function DecoFor({ deco, index }: { deco: Deco; index: number }) {
  if (deco === 'mario') return <div className="card-deco"><MarioDeco i={index} /></div>;
  if (deco === 'october')
    return (
      <div className="card-deco">
        <Leaf className="oc-leaf tl" color="#FF7B54" />
        <Leaf className="oc-leaf br" color={index % 2 ? '#dc2626' : '#f59e0b'} />
      </div>
    );
  if (deco === 'onepiece')
    return (
      <div className="card-deco">
        <div className="wanted"><b>WANTED</b><span>DEAD OR ALIVE</span></div>
        <Compass />
      </div>
    );
  if (deco === 'ghibli')
    return (
      <div className="card-deco">
        <SootSprite className="soot s1" delay={(index % 4) * 0.7} />
        <SootSprite className="soot s2" delay={(index % 3) * 1.1 + 0.4} />
      </div>
    );
  if (deco === 'jjk') return <div className="card-deco"><Talisman /></div>;
  if (deco === 'gold') return <div className="card-deco"><div className="vip-ribbon">VIP DEV</div></div>;
  if (deco === 'snow') return <div className="card-deco"><span className="frost tl" /><span className="frost br" /></div>;
  return null;
}
