import { useMemo } from 'react';
import { Flame, Gem, Heart, LayoutGrid, Sparkles, Tag } from 'lucide-react';
import { useAllGames, useStore } from '../lib/store';
import { href, useRoute } from '../lib/router';

const GENRES = ['Action', 'Adventure', 'Arcade', 'Casual', 'Fighting', 'Puzzle', 'Racing', 'Sports', 'Strategy', 'Simulation'];

export function Sidebar() {
  const games = useAllGames();
  const wishlist = useStore((s) => s.wishlist);
  const playCount = useStore((s) => s.playCount);
  const open = useStore((s) => s.sidebarOpen);
  const setSidebar = useStore((s) => s.setSidebar);
  const openModal = useStore((s) => s.openModal);
  const { parts, query } = useRoute();
  const onStore = (parts[0] ?? '') === '';
  const activeTag = onStore ? query.get('tag') : null;

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    games.forEach((g) => g.tags.forEach((t) => m.set(t, (m.get(t) || 0) + 1)));
    return m;
  }, [games]);
  const categories = GENRES.filter((g) => counts.has(g));
  const otherTags = Array.from(counts.keys()).filter((t) => !GENRES.includes(t)).sort();

  // Trending genres: what you've been playing, weighted by how often
  const trending = useMemo(() => {
    const m = new Map<string, number>();
    games.forEach((g) => {
      const w = 1 + (playCount[g.id] || 0) * 2;
      g.tags.filter((t) => GENRES.includes(t)).forEach((t) => m.set(t, (m.get(t) || 0) + w));
    });
    const list = Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = list[0]?.[1] || 1;
    return list.map(([t, v]) => ({ t, pct: Math.round((v / max) * 100) }));
  }, [games, playCount]);

  const wished = wishlist.map((id) => games.find((g) => g.id === id)).filter(Boolean).slice(0, 5);
  const close = () => setSidebar(false);

  return (
    <>
      <div className={'scrim' + (open ? ' open' : '')} onClick={close} />
      <aside className={'sidebar' + (open ? ' open' : '')} aria-label="Browse">
        <div className="scroll" onClick={(e) => (e.target as HTMLElement).closest('a') && close()}>
          <h3>Browse</h3>
          <a className={'side-link' + (onStore && !activeTag && !query.get('sort') ? ' on' : '')} href={href('/')}><LayoutGrid size={16} /> All games <span className="count">{games.length}</span></a>
          <a className={'side-link' + (onStore && query.get('sort') === 'gems' ? ' on' : '')} href={href('/?sort=gems')}><Gem size={16} /> Community Gems <span className="count">{games.filter((g) => g.origin !== 'catalog').length}</span></a>

          <h3>Categories</h3>
          {categories.map((c) => (
            <a key={c} className={'side-link' + (activeTag === c ? ' on' : '')} href={href(`/?tag=${encodeURIComponent(c)}`)}>
              <Tag size={15} /> {c} <span className="count">{counts.get(c)}</span>
            </a>
          ))}

          <h3>Tags</h3>
          <div className="tag-cloud">
            {otherTags.map((t) => (
              <a key={t} className={'chip' + (activeTag === t ? ' on' : '')} href={href(`/?tag=${encodeURIComponent(t)}`)} style={{ textDecoration: 'none', color: 'inherit' }}>{t}</a>
            ))}
          </div>

          <h3>Top Wishlisted</h3>
          {wished.length ? (
            wished.map((g) => (
              <a key={g!.id} className="side-link" href={href(`/game/${g!.id}`)}><Heart size={15} fill="currentColor" style={{ color: '#fb7185' }} /> {g!.title}</a>
            ))
          ) : (
            <p className="muted" style={{ fontSize: 13, padding: '0 10px', margin: 0 }}>Tap the heart on a game to keep it here.</p>
          )}

          <h3>Trending Genres</h3>
          <div style={{ display: 'grid', gap: 10, padding: '0 10px' }}>
            {trending.map(({ t, pct }) => (
              <a key={t} href={href(`/?tag=${encodeURIComponent(t)}`)} style={{ color: 'inherit', textDecoration: 'none', fontSize: 13 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between' }}><span><Flame size={13} style={{ verticalAlign: -2, color: 'var(--warn)' }} /> {t}</span></span>
                <div className="bar"><span style={{ width: pct + '%' }} /></div>
              </a>
            ))}
          </div>
        </div>
        <button className="make-game" onClick={() => openModal('make')}>
          <Sparkles size={20} /> Make Your Own Game
        </button>
      </aside>
    </>
  );
}
