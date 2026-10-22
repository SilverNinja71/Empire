import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Info, Monitor, Play, Smartphone, Users } from 'lucide-react';
import type { Game } from '../lib/types';
import { useStore } from '../lib/store';
import { navigate } from '../lib/router';
import { playGame } from '../lib/play';
import { Cover } from './Cover';
import { Stars } from './ui';
import { CardDeco } from './CardDeco';

export const engineLabel = (g: Game) => (g.origin === 'studio' ? 'Empire Studio' : g.engine === 'ThreeJS' ? 'WebGL · Three.js' : g.engine);

export function EngineBadge({ g }: { g: Game }) {
  return <span className={'badge engine-' + (g.origin === 'studio' ? 'Studio' : g.engine)}>{engineLabel(g)}</span>;
}

export function GameCard({ game, index = 0 }: { game: Game; index?: number }) {
  const [hover, setHover] = useState(false);
  const wished = useStore((s) => s.wishlist.includes(game.id));
  const rating = useStore((s) => s.ratings[game.id] || 0);
  const toggleWish = useStore((s) => s.toggleWish);
  const rate = useStore((s) => s.rate);
  const shots = game.screenshots.length ? game.screenshots : [];
  const isNew = game.released ? Date.now() - Date.parse(game.released) < 1000 * 60 * 60 * 24 * 14 : game.origin !== 'catalog';

  return (
    <motion.div className="card-slot" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 12) * 0.04 }}>
      <motion.article
        className="card"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHover(false)}
        onClick={() => navigate(`/game/${game.id}`)}
        animate={{ scale: hover ? 1.04 : 1, y: hover ? -6 : 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && navigate(`/game/${game.id}`)}
        aria-label={game.title}
      >
        <CardDeco index={index} />
        <div className="cover">
          <div className="art"><Cover game={game} showTitle={!game.cover} titleSize={20} /></div>
          <div className="tl">
            <span className="badge free">Free</span>
            {isNew && <span className="badge accent">New</span>}
          </div>
          <div className="tr">
            <button className={'wish' + (wished ? ' on' : '')} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'} onClick={(e) => { e.stopPropagation(); toggleWish(game); }}>
              <Heart size={16} fill={wished ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
        <div className="body">
          <h3>{game.title}</h3>
          <div className="tags">{game.tags.slice(0, 4).map((t) => <span key={t}>{t}</span>)}</div>
          <div className="meta">
            <Stars value={rating} onRate={(n) => rate(game, n)} size={14} />
            <EngineBadge g={game} />
          </div>
        </div>
        <AnimatePresence initial={false}>
          {hover && (
            <motion.div className="more" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}>
              {shots.length > 0 && (
                <div className="shots">
                  {shots.slice(0, 3).map((s, i) => (
                    <div key={s}><Cover game={game} src={s} variant={i + 1} showTitle={false} /></div>
                  ))}
                </div>
              )}
              <p>{game.description.length > 140 ? game.description.slice(0, 137) + '…' : game.description}</p>
              <div className="muted" style={{ fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span>by <b style={{ color: 'var(--text)' }}>{game.author}</b></span>
                {game.modes.includes('multiplayer') && <span><Users size={12} /> Multiplayer</span>}
                {game.platforms.includes('mobile') ? <span><Smartphone size={12} /> Touch</span> : <span><Monitor size={12} /> Desktop</span>}
              </div>
              <div className="actions">
                <button className="btn play small" onClick={(e) => { e.stopPropagation(); playGame(game); }}><Play size={14} fill="currentColor" /> Play</button>
                <button className="btn small" onClick={(e) => { e.stopPropagation(); navigate(`/game/${game.id}`); }}><Info size={14} /> Details</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>
    </motion.div>
  );
}
