import { Activity as ActivityIcon, Box, Gamepad2, Heart, LogIn, MessagesSquare, Palette, Pencil, Play, Plus, Rocket, Sparkles, Star, Trash2, Trophy } from 'lucide-react';
import type { ActivityKind } from '../lib/types';
import { useAllGames, useStore } from '../lib/store';
import { accounts, useAccount } from '../lib/account';
import { href, navigate } from '../lib/router';
import { playGame } from '../lib/play';
import { timeAgo } from '../lib/util';
import { Cover } from '../components/Cover';
import { Page } from '../components/ui';

function TrophyShelf() {
  const [acc, refresh] = useAccount();
  const api = accounts();
  if (!api) return <p className="muted">The shared account didn’t load, so trophies can’t be shown.</p>;
  const got = new Set(acc.trophies.map((t) => t.id));
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        {acc.trophies.length} of {acc.catalog.length} earned across every game.{' '}
        {acc.signedIn ? 'Click one you have to wear its title in every game.' : 'Sign in to keep trophies with your account.'}
      </p>
      <div className="trophy-shelf">
        {acc.catalog.map((t) => {
          const have = got.has(t.id);
          const worn = acc.title?.id === t.id;
          return (
            <div
              key={t.id}
              className={(have ? '' : 'off') + (worn ? ' worn' : '')}
              title={t.desc}
              style={{ cursor: have ? 'pointer' : 'default' }}
              onClick={() => { if (have) { api.trophies.equip(worn ? null : t.id); refresh(); } }}
            >
              <span dangerouslySetInnerHTML={{ __html: api.trophies.badgeHTML(t.id, 30, !have) }} />
              <span><b>{t.name}</b><div className="muted" style={{ fontSize: 11 }}>{t.desc}</div></span>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Library() {
  const games = useAllGames();
  const played = useStore((s) => s.played);
  const playCount = useStore((s) => s.playCount);
  const wishlist = useStore((s) => s.wishlist);
  const projects = useStore((s) => s.projects);
  const localGames = useStore((s) => s.localGames);
  const { deleteProject, removeLocalGame, openModal, toggleWish } = useStore.getState();
  const [acc] = useAccount();

  const recent = games.filter((g) => played[g.id]).sort((a, b) => played[b.id] - played[a.id]);
  const wished = wishlist.map((id) => games.find((g) => g.id === id)).filter((g): g is NonNullable<typeof g> => !!g);
  const added = localGames.filter((g) => g.origin === 'local');
  const totalPlays = Object.values(playCount).reduce((a, b) => a + b, 0);

  return (
    <Page k="library">
      <div className="panel" style={{ padding: 20, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="avatar" style={{ width: 72, height: 72, fontSize: 30 }}>{acc.username.slice(0, 1).toUpperCase()}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 30 }}>{acc.username}</h1>
          <div className="muted">{acc.signedIn ? (acc.title ? `Wearing “${acc.title.title || acc.title.name}”` : 'Signed in · one account for every SilverNinja game') : 'Guest · your progress is saved in this browser'}</div>
        </div>
        {!acc.signedIn && <button className="btn primary" onClick={() => openModal('account')}><LogIn size={16} /> Sign in or make an account</button>}
      </div>

      <div className="stat-row" style={{ marginTop: 16 }}>
        <div className="panel stat"><span>Level</span><b>{acc.level}</b></div>
        <div className="panel stat"><span><Trophy size={12} /> Trophies</span><b>{acc.trophies.length}</b></div>
        <div className="panel stat"><span><Gamepad2 size={12} /> Games played</span><b>{recent.length}</b></div>
        <div className="panel stat"><span>Play sessions</span><b>{totalPlays}</b></div>
      </div>

      <div className="section-title"><h2>Recently played</h2></div>
      {recent.length === 0 ? (
        <div className="panel empty">Nothing yet. <a href={href('/')}>Find a game in the store</a>.</div>
      ) : (
        <div className="panel">
          {recent.map((g) => (
            <div key={g.id} className="lib-row">
              <a className="thumb" href={href(`/game/${g.id}`)}><Cover game={g} showTitle={false} /></a>
              <div>
                <b style={{ fontSize: 17 }}>{g.title}</b>
                <div className="muted" style={{ fontSize: 13 }}>Last played {timeAgo(played[g.id])} · {playCount[g.id] || 1} session{(playCount[g.id] || 1) > 1 ? 's' : ''}</div>
              </div>
              <button className="btn play" onClick={() => playGame(g)}><Play size={15} fill="currentColor" /> Play</button>
            </div>
          ))}
        </div>
      )}

      <div className="section-title"><h2>Wishlist</h2></div>
      {wished.length === 0 ? (
        <div className="panel empty">Tap the heart on any game to save it here.</div>
      ) : (
        <div className="panel">
          {wished.map((g) => (
            <div key={g.id} className="lib-row">
              <a className="thumb" href={href(`/game/${g.id}`)}><Cover game={g} showTitle={false} /></a>
              <div><b style={{ fontSize: 17 }}>{g.title}</b><div className="muted" style={{ fontSize: 13 }}>{g.tags.join(' · ')}</div></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => toggleWish(g)}><Heart size={15} /> Remove</button>
                <button className="btn play" onClick={() => playGame(g)}><Play size={15} fill="currentColor" /> Play</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">
        <h2>Your creations</h2>
        <button className="btn primary small" onClick={() => openModal('make')}><Sparkles size={14} /> Make a new game</button>
      </div>
      {projects.length === 0 ? (
        <div className="panel empty">Worlds and maps you build in the studio show up here.</div>
      ) : (
        <div className="panel">
          {projects.map((p) => {
            const pub = p.publishedId ? games.find((g) => g.id === p.publishedId) : undefined;
            return (
              <div key={p.id} className="lib-row">
                <div className="thumb" style={{ display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', color: '#fff' }}>
                  {pub ? <Cover game={pub} showTitle={false} /> : <Box size={34} />}
                </div>
                <div>
                  <b style={{ fontSize: 17 }}>{p.name}</b>
                  <div className="muted" style={{ fontSize: 13 }}>{p.data.kind === '3d' ? '3D world' : '2D pixel map'} · saved {timeAgo(p.updated)}{pub ? ' · published' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn" onClick={() => navigate(`/studio/${p.data.kind}/${p.id}`)}><Pencil size={15} /> Edit</button>
                  {pub && <button className="btn play" onClick={() => playGame(pub)}><Play size={15} fill="currentColor" /> Play</button>}
                  <button className="btn icon danger" aria-label="Delete" onClick={() => { if (confirm(`Delete “${p.name}”? This can't be undone.`)) deleteProject(p.id); }}><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="section-title">
        <h2>Games you added</h2>
        <button className="btn small" onClick={() => openModal('add')}><Plus size={14} /> Add a game</button>
      </div>
      {added.length === 0 ? (
        <div className="panel empty">Games you add with “Add a Game” are kept here.</div>
      ) : (
        <div className="panel">
          {added.map((g) => (
            <div key={g.id} className="lib-row">
              <a className="thumb" href={href(`/game/${g.id}`)}><Cover game={g} showTitle={false} /></a>
              <div><b style={{ fontSize: 17 }}>{g.title}</b><div className="muted" style={{ fontSize: 13 }}>{g.sourceUrl}</div></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn icon danger" aria-label="Remove" onClick={() => removeLocalGame(g.id)}><Trash2 size={15} /></button>
                <button className="btn play" onClick={() => playGame(g)}><Play size={15} fill="currentColor" /> Play</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-title"><h2>Trophies</h2></div>
      <div className="panel" style={{ padding: 18 }}><TrophyShelf /></div>
    </Page>
  );
}

const KIND_ICON: Record<ActivityKind, typeof Play> = {
  played: Play, wishlist: Heart, rated: Star, posted: MessagesSquare, replied: MessagesSquare, added: Plus, published: Rocket, trophy: Trophy, theme: Palette,
};

export function ActivityPage() {
  const activity = useStore((s) => s.activity);
  const [acc] = useAccount();
  const items = [
    ...activity.map((a) => ({ ...a, href: a.href ?? (a.gameId ? `#/game/${a.gameId}` : undefined) })),
    ...acc.trophies.map((t) => ({ id: 'tr-' + t.id, kind: 'trophy' as const, text: `Earned the ${t.name} trophy`, at: t.earned, href: '#/library' })),
  ].sort((a, b) => b.at - a.at);

  const days = new Map<string, typeof items>();
  items.forEach((it) => {
    const d = new Date(it.at).toDateString();
    days.set(d, [...(days.get(d) ?? []), it]);
  });

  return (
    <Page k="activity">
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <p>What you’ve played, rated, posted and built, plus trophies from every game.</p>
        </div>
      </div>
      {items.length === 0 && <div className="panel empty"><ActivityIcon size={28} /><p>Nothing yet. Play a game, rate it or post in the forum and it shows up here.</p></div>}
      {Array.from(days.entries()).map(([day, list]) => (
        <section key={day} style={{ marginBottom: 20 }}>
          <h3 className="muted" style={{ fontFamily: 'var(--font-body)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 8px' }}>
            {day === new Date().toDateString() ? 'Today' : new Date(list[0].at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </h3>
          <div className="panel timeline">
            {list.map((it) => {
              const Icon = KIND_ICON[it.kind];
              return (
                <a key={it.id} className="tl-item" href={it.href} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <span className="tl-ico"><Icon size={16} /></span>
                  <span>{it.text}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{timeAgo(it.at)}</span>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </Page>
  );
}
