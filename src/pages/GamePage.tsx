import { useState } from 'react';
import { Copy, Download, ExternalLink, GitBranch, Heart, MessagesSquare, Play, Trash2, Users } from 'lucide-react';
import { useAllGames, useCatalog, useStore } from '../lib/store';
import { navigate, href } from '../lib/router';
import { playGame } from '../lib/play';
import { toXml } from '../lib/xml';
import { downloadText, resolveUrl } from '../lib/util';
import { Cover } from '../components/Cover';
import { EngineBadge, GameCard, engineLabel } from '../components/GameCard';
import { Page, Stars } from '../components/ui';

export function GamePage({ id }: { id: string }) {
  const games = useAllGames();
  const status = useCatalog((s) => s.status);
  const g = games.find((x) => x.id === id);
  const wished = useStore((s) => s.wishlist.includes(id));
  const rating = useStore((s) => s.ratings[id] || 0);
  const lastPlayed = useStore((s) => s.played[id]);
  const plays = useStore((s) => s.playCount[id] || 0);
  const allThreads = useStore((s) => s.threads);
  const threads = allThreads.filter((t) => t.gameId === id);
  const { toggleWish, rate, removeLocalGame, toast } = useStore.getState();
  const [showXml, setShowXml] = useState(false);

  if (!g) return <Page k={'game-' + id}><div className="empty">{status === 'loading' ? 'Loading…' : 'That game isn’t in the store.'}</div></Page>;
  const xml = toXml(g);
  const related = games.filter((x) => x.id !== g.id && x.tags.some((t) => g.tags.includes(t))).slice(0, 4);

  return (
    <Page k={'game-' + id}>
      <div className="game-hero">
        <Cover game={g} showTitle={false} />
        <div className="shade" />
        <div className="info">
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <span className="badge free">Free</span>
              <EngineBadge g={g} />
              {g.modes.includes('multiplayer') && <span className="badge"><Users size={11} /> Multiplayer</span>}
              {g.origin === 'local' && <span className="badge">Added in this browser</span>}
            </div>
            <h1>{g.title}</h1>
            <div style={{ opacity: 0.85, marginTop: 6 }}>by {g.author}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn play big" onClick={() => playGame(g)}><Play size={18} fill="currentColor" /> Play</button>
            <button className={'btn big' + (wished ? ' active' : '')} onClick={() => toggleWish(g)}><Heart size={18} fill={wished ? 'currentColor' : 'none'} /> {wished ? 'Wishlisted' : 'Wishlist'}</button>
          </div>
        </div>
      </div>

      <div className="game-layout">
        <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
          <section className="panel">
            <h2 style={{ fontSize: 20, marginBottom: 10 }}>About this game</h2>
            <p style={{ margin: 0, fontSize: 16 }}>{g.description || 'No description yet.'}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
              {g.tags.map((t) => <a key={t} className="chip" href={href(`/?tag=${encodeURIComponent(t)}`)} style={{ textDecoration: 'none', color: 'inherit' }}>{t}</a>)}
            </div>
          </section>
          {g.screenshots.length > 0 && (
            <section className="panel">
              <h2 style={{ fontSize: 20, marginBottom: 12 }}>Screenshots</h2>
              <div className="shot-row">
                {g.screenshots.map((s, i) => <div key={s}><Cover game={g} src={s} variant={i + 1} showTitle={false} /></div>)}
              </div>
            </section>
          )}
          <section className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 20 }}>Discussions</h2>
              <button className="btn small" onClick={() => navigate(`/forum/new?board=showcase&game=${g.id}`)}><MessagesSquare size={14} /> Start a thread</button>
            </div>
            {threads.length === 0 ? (
              <p className="muted" style={{ margin: '10px 0 0' }}>No threads about {g.title} yet.</p>
            ) : (
              <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
                {threads.map((t) => <li key={t.id}><a href={href(`/forum/thread/${t.id}`)}>{t.title}</a> <span className="muted">({t.posts.length - 1} replies)</span></li>)}
              </ul>
            )}
          </section>
          <section className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 20 }}>Empire XML</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn small" onClick={() => setShowXml(!showXml)}>{showXml ? 'Hide' : 'Show'}</button>
                <button className="btn small" onClick={() => { navigator.clipboard?.writeText(xml); toast('XML copied'); }}><Copy size={14} /> Copy</button>
                <button className="btn small" onClick={() => downloadText(`${g.id}.xml`, xml)}><Download size={14} /> Download</button>
              </div>
            </div>
            {showXml && <pre className="code" style={{ marginTop: 12 }}>{xml}</pre>}
          </section>
        </div>
        <aside style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
          <section className="panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <b>Your rating</b>
              <Stars value={rating} onRate={(n) => rate(g, n)} size={20} />
            </div>
            <dl className="kv">
              <dt>Developer</dt><dd>{g.author}</dd>
              <dt>Engine</dt><dd>{engineLabel(g)}</dd>
              <dt>Version</dt><dd>{g.version}</dd>
              {g.players && (<><dt>Players</dt><dd>{g.players}</dd></>)}
              <dt>Modes</dt><dd>{g.modes.map((m) => (m === 'singleplayer' ? 'Single-player' : 'Multiplayer')).join(', ')}</dd>
              <dt>Platforms</dt><dd>{g.platforms.map((p) => (p === 'desktop' ? 'Desktop' : 'Phone & tablet')).join(', ')}</dd>
              {g.released && (<><dt>Released</dt><dd>{new Date(g.released).toLocaleDateString()}</dd></>)}
              {g.controls && (<><dt>Controls</dt><dd>{g.controls}</dd></>)}
              {g.minSpecs && (<><dt>Needs</dt><dd>{g.minSpecs}</dd></>)}
              <dt>You played</dt><dd>{plays ? `${plays} time${plays > 1 ? 's' : ''}, last ${new Date(lastPlayed).toLocaleDateString()}` : 'Not yet'}</dd>
            </dl>
            <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
              {g.repository && <a className="btn" href={g.repository} target="_blank" rel="noopener noreferrer"><GitBranch size={16} /> Source code</a>}
              {g.type !== 'studio' && <a className="btn" href={resolveUrl(g.sourceUrl)} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Open in a new tab</a>}
              {g.origin !== 'catalog' && (
                <button className="btn danger" onClick={() => { removeLocalGame(g.id); toast(`Removed ${g.title}`); navigate('/'); }}><Trash2 size={16} /> Remove from this browser</button>
              )}
            </div>
          </section>
          {related.length > 0 && (
            <section>
              <h3 style={{ marginBottom: 12 }}>More like this</h3>
              <div style={{ display: 'grid', gap: 14 }}>
                {related.slice(0, 2).map((r) => <GameCard key={r.id} game={r} />)}
              </div>
            </section>
          )}
        </aside>
      </div>
    </Page>
  );
}
