import { useState } from 'react';
import type { Game } from '../lib/types';
import { GAME_ICONS } from '../data/icons';

/** Turn a games.xml path ("covers/x.jpg") into a real address; keep full URLs and data URLs as they are. */
export function assetUrl(p?: string): string | undefined {
  if (!p) return undefined;
  if (/^(data:|https?:|blob:|\/)/.test(p)) return p;
  return import.meta.env.BASE_URL + p.replace(/^\.\//, '');
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A picture for the game: its screenshot if there is one, otherwise art made from its colors and icon. */
export function Cover({ game, src, variant = 0, showTitle = true, titleSize = 22 }: { game: Game; src?: string; variant?: number; showTitle?: boolean; titleSize?: number }) {
  const url = assetUrl(src ?? game.cover);
  const [broken, setBroken] = useState(false);
  if (url && !broken) return <img className="art-img" src={url} alt="" loading="lazy" draggable={false} onError={() => setBroken(true)} />;
  return <GeneratedArt game={game} variant={variant} showTitle={showTitle} titleSize={titleSize} />;
}

export function GeneratedArt({ game, variant = 0, showTitle = true, titleSize = 22 }: { game: Game; variant?: number; showTitle?: boolean; titleSize?: number }) {
  const h = hash(game.id + ':' + variant);
  const hue = h % 360;
  const [a, b] = game.palette ?? [`hsl(${hue} 70% 32%)`, `hsl(${(hue + 50) % 360} 80% 58%)`];
  const angle = 100 + (h % 120);
  const icon = game.icon && GAME_ICONS[game.icon];
  const rings = Array.from({ length: 5 }, (_, i) => i);
  return (
    <div className="art-gen" style={{ background: `linear-gradient(${angle}deg, ${a}, ${b})` }}>
      <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }} aria-hidden>
        {rings.map((i) => (
          <circle key={i} cx={(h >>> (i * 3)) % 400} cy={(h >>> (i * 2 + 5)) % 225} r={30 + ((h >>> i) % 90)} fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={2 + (i % 3)} />
        ))}
        <path d={`M0 ${170 + (h % 30)} Q 100 ${130 + (h % 50)} 200 ${165} T 400 ${150 + (h % 40)} V225 H0Z`} fill="#000" fillOpacity={0.25} />
      </svg>
      {icon ? (
        <svg className="ico" viewBox="0 0 32 32" dangerouslySetInnerHTML={{ __html: icon }} aria-hidden />
      ) : (
        <div style={{ fontSize: 64, fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff', opacity: 0.9, zIndex: 2 }}>{game.title.slice(0, 1)}</div>
      )}
      {showTitle && <div className="t" style={{ fontSize: titleSize }}>{game.title}</div>}
    </div>
  );
}
