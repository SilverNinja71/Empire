import { useMemo, useState } from 'react';
import { Clock, Flame, Gem, SlidersHorizontal, Sparkles, TrendingUp, X } from 'lucide-react';
import type { Game } from '../lib/types';
import { ENGINES } from '../lib/types';
import { useAllGames, useCatalog, useStore } from '../lib/store';
import { navigate, useRoute } from '../lib/router';
import { HeroCarousel } from '../components/HeroCarousel';
import { GameCard } from '../components/GameCard';
import { Page } from '../components/ui';

type Sort = 'popular' | 'new' | 'trending' | 'gems';
const SORTS: { id: Sort; label: string; icon: typeof Flame; hint: string }[] = [
  { id: 'popular', label: 'Popular', icon: Flame, hint: 'The site’s picks, in order' },
  { id: 'new', label: 'New', icon: Clock, hint: 'Newest releases first' },
  { id: 'trending', label: 'Trending', icon: TrendingUp, hint: 'Recently updated, and what you’ve been playing' },
  { id: 'gems', label: 'Community Gems', icon: Gem, hint: 'Games added by players and made in the studio' },
];

const time = (s?: string) => (s ? Date.parse(s) || 0 : 0);

export function Store() {
  const games = useAllGames();
  const status = useCatalog((s) => s.status);
  const error = useCatalog((s) => s.error);
  const playCount = useStore((s) => s.playCount);
  const played = useStore((s) => s.played);
  const ratings = useStore((s) => s.ratings);
  const openModal = useStore((s) => s.openModal);
  const { query } = useRoute();
  const sort = (query.get('sort') as Sort) || 'popular';
  const tag = query.get('tag');
  const q = query.get('q') || '';
  const [showFilters, setShowFilters] = useState(false);
  const [engines, setEngines] = useState<string[]>([]);
  const [mode, setMode] = useState<'' | 'singleplayer' | 'multiplayer'>('');
  const [minRating, setMinRating] = useState(0);
  const [platform, setPlatform] = useState<'' | 'desktop' | 'mobile'>('');

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(query);
    if (v) p.set(k, v);
    else p.delete(k);
    const s = p.toString();
    navigate('/' + (s ? '?' + s : ''));
  };

  const allTags = useMemo(() => Array.from(new Set(games.flatMap((g) => g.tags))).sort(), [games]);
  const featured = useMemo(() => games.filter((g) => g.featured).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)), [games]);

  const list = useMemo(() => {
    let l: Game[] = games.slice();
    if (sort === 'gems') l = l.filter((g) => g.origin !== 'catalog');
    if (tag) l = l.filter((g) => g.tags.includes(tag));
    if (q) {
      const s = q.toLowerCase();
      l = l.filter((g) => [g.title, g.description, g.author, ...g.tags].some((x) => x.toLowerCase().includes(s)));
    }
    if (engines.length) l = l.filter((g) => engines.includes(g.origin === 'studio' ? 'Studio' : g.engine));
    if (mode) l = l.filter((g) => g.modes.includes(mode));
    if (minRating) l = l.filter((g) => (ratings[g.id] || 0) >= minRating);
    if (platform) l = l.filter((g) => g.platforms.includes(platform));
    const added = (g: Game) => g.addedAt || time(g.released);
    if (sort === 'popular') l.sort((a, b) => (a.rank ?? 1000 - (playCount[a.id] || 0)) - (b.rank ?? 1000 - (playCount[b.id] || 0)));
    if (sort === 'new' || sort === 'gems') l.sort((a, b) => added(b) - added(a));
    if (sort === 'trending') {
      const score = (g: Game) => (time(g.updated) || added(g)) / 864e5 + (playCount[g.id] || 0) * 2 + (played[g.id] ? (played[g.id] - Date.now()) / 864e5 + 14 : 0);
      l.sort((a, b) => score(b) - score(a));
    }
    return l;
  }, [games, sort, tag, q, engines, mode, minRating, platform, ratings, playCount, played]);

  const activeFilters = engines.length + (mode ? 1 : 0) + (minRating ? 1 : 0) + (platform ? 1 : 0);
  const clear = () => { setEngines([]); setMode(''); setMinRating(0); setPlatform(''); };
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <Page k="store">
      {!tag && !q && sort !== 'gems' && <HeroCarousel games={featured.length ? featured : games.slice(0, 5)} />}

      <div className="section-title">
        <div>
          <h2>{q ? `Results for “${q}”` : tag ? tag : SORTS.find((s) => s.id === sort)!.label}</h2>
          <div className="muted" style={{ fontSize: 13 }}>{SORTS.find((s) => s.id === sort)!.hint}</div>
        </div>
        <div className="toolbar">
          <div className="tabs" role="tablist">
            {SORTS.map((s) => (
              <button key={s.id} role="tab" aria-selected={sort === s.id} className={sort === s.id ? 'on' : ''} onClick={() => setParam('sort', s.id === 'popular' ? null : s.id)}>
                <s.icon size={14} /> {s.label}
              </button>
            ))}
          </div>
          <button className={'btn' + (showFilters || activeFilters ? ' active' : '')} onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal size={16} /> Filters{activeFilters ? ` (${activeFilters})` : ''}
          </button>
        </div>
      </div>

      {(tag || q) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {tag && <button className="chip on" onClick={() => setParam('tag', null)}>{tag} <X size={13} /></button>}
          {q && <button className="chip on" onClick={() => setParam('q', null)}>“{q}” <X size={13} /></button>}
        </div>
      )}

      {showFilters && (
        <div className="panel filters">
          <div className="row">
            <b>Genre</b>
            {allTags.map((t) => (
              <button key={t} className={'chip' + (tag === t ? ' on' : '')} onClick={() => setParam('tag', tag === t ? null : t)}>{t}</button>
            ))}
          </div>
          <div className="row">
            <b>Engine</b>
            {[...ENGINES, 'Studio'].map((e) => (
              <button key={e} className={'chip' + (engines.includes(e) ? ' on' : '')} onClick={() => setEngines(toggle(engines, e))}>{e === 'ThreeJS' ? 'WebGL / Three.js' : e === 'Studio' ? 'Empire Studio' : e}</button>
            ))}
          </div>
          <div className="row">
            <b>Players</b>
            {(['', 'singleplayer', 'multiplayer'] as const).map((m) => (
              <button key={m} className={'chip' + (mode === m ? ' on' : '')} onClick={() => setMode(m)}>{m === '' ? 'Any' : m === 'singleplayer' ? 'Single-player' : 'Multiplayer'}</button>
            ))}
          </div>
          <div className="row">
            <b>Your rating</b>
            {[0, 3, 4, 5].map((r) => (
              <button key={r} className={'chip' + (minRating === r ? ' on' : '')} onClick={() => setMinRating(r)}>{r === 0 ? 'Any' : `${r}★ and up`}</button>
            ))}
          </div>
          <div className="row">
            <b>Platform</b>
            {(['', 'desktop', 'mobile'] as const).map((p) => (
              <button key={p} className={'chip' + (platform === p ? ' on' : '')} onClick={() => setPlatform(p)}>{p === '' ? 'Any' : p === 'desktop' ? 'Desktop' : 'Phone & tablet'}</button>
            ))}
            {activeFilters > 0 && <button className="btn small ghost" onClick={clear}><X size={14} /> Clear filters</button>}
          </div>
        </div>
      )}

      {status === 'loading' && <div className="empty">Loading games…</div>}
      {status === 'error' && <div className="empty bad">Couldn’t load the game list ({error}).</div>}
      {status === 'ready' && list.length === 0 && (
        <div className="panel empty">
          {sort === 'gems' ? (
            <>
              <p>No community games yet. Be the first!</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn primary" onClick={() => openModal('make')}><Sparkles size={16} /> Make your own game</button>
                <button className="btn" onClick={() => openModal('add')}>Add a game</button>
              </div>
            </>
          ) : (
            <p>No games match. Try fewer filters.</p>
          )}
        </div>
      )}
      <div className="grid">
        {list.map((g, i) => <GameCard key={g.id} game={g} index={i} />)}
      </div>
    </Page>
  );
}
