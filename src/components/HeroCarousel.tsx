import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Heart, Play, Users } from 'lucide-react';
import type { Game } from '../lib/types';
import { useStore } from '../lib/store';
import { playGame } from '../lib/play';
import { navigate } from '../lib/router';
import { Cover } from './Cover';
import { EngineBadge } from './GameCard';
import { Stars } from './ui';

const MS = 7000;

export function HeroCarousel({ games }: { games: Game[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const wishlist = useStore((s) => s.wishlist);
  const ratings = useStore((s) => s.ratings);
  const toggleWish = useStore((s) => s.toggleWish);
  const n = games.length;

  useEffect(() => {
    if (paused || n < 2) return;
    const t = window.setTimeout(() => setI((x) => (x + 1) % n), MS);
    return () => window.clearTimeout(t);
  }, [i, paused, n]);

  if (!n) return null;
  const g = games[i % n];
  const wished = wishlist.includes(g.id);
  const step = (d: number) => setI((x) => (x + d + n) % n);

  return (
    <section className={'hero' + (paused ? ' paused' : '')} style={{ ['--hero-ms' as string]: MS + 'ms' }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel" aria-label="Featured games">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={g.id} className="slide" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
          <motion.div className="art" initial={{ scale: 1 }} animate={{ scale: 1.08 }} transition={{ duration: MS / 1000 + 1, ease: 'linear' }}>
            <Cover game={g} showTitle={false} />
          </motion.div>
          <div className="shade" />
          <div className="info">
            <motion.div className="badges" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <span className="badge free">Free</span>
              <EngineBadge g={g} />
              {g.modes.includes('multiplayer') && <span className="badge"><Users size={11} /> Multiplayer</span>}
              {g.tags.slice(0, 2).map((t) => <span key={t} className="badge">{t}</span>)}
            </motion.div>
            <motion.h2 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>{g.title}</motion.h2>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>{g.description}</motion.p>
            <motion.div className="actions" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
              <button className="btn play big" onClick={() => playGame(g)}><Play size={18} fill="currentColor" /> Play now</button>
              <button className={'btn big' + (wished ? ' active' : '')} onClick={() => toggleWish(g)}><Heart size={18} fill={wished ? 'currentColor' : 'none'} /> {wished ? 'Wishlisted' : 'Wishlist'}</button>
              <button className="btn big ghost" style={{ color: '#fff' }} onClick={() => navigate(`/game/${g.id}`)}>Details</button>
            </motion.div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,.75)' }}>
              <Stars value={ratings[g.id] || 0} onRate={(v) => useStore.getState().rate(g, v)} size={15} /> {ratings[g.id] ? 'Your rating' : 'Rate it'}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="dots">
        {games.map((x, k) => (
          <button key={x.id + (k === i ? ':on' : '')} className={k === i ? 'on' : ''} aria-label={`Show ${x.title}`} onClick={() => setI(k)} />
        ))}
      </div>
      <div className="thumbs">
        {games.slice(0, 5).map((x, k) => (
          <button key={x.id} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={x.title} style={{ position: 'relative' }}>
            <Cover game={x} showTitle={false} />
          </button>
        ))}
      </div>
      <div className="arrows">
        <button className="btn icon" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft size={18} /></button>
        <button className="btn icon" onClick={() => step(1)} aria-label="Next"><ChevronRight size={18} /></button>
      </div>
    </section>
  );
}
