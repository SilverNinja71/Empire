import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Bell, Library, Lock, LogIn, LogOut, Menu, MessagesSquare, Paintbrush, Palette, Plus, Search, Store, Trophy, User } from 'lucide-react';
import { useAllGames, useStore } from '../lib/store';
import { href, navigate, useRoute } from '../lib/router';
import { accounts, useAccount } from '../lib/account';
import { THEMES, THEME_BY_ID, type ThemeDef } from '../lib/themes';
import { useThemeDef } from '../lib/useTheme';
import { useUnlocks } from '../lib/unlocks';
import { EmpireLogo } from './EmpireLogo';
import { timeAgo } from '../lib/util';
import { Cover } from './Cover';

const NAV = [
  { to: '/', match: ['', 'store', 'game'], label: 'Store / Discover', icon: Store },
  { to: '/forum', match: ['forum'], label: 'Community Forum', icon: MessagesSquare },
  { to: '/library', match: ['library'], label: 'Library', icon: Library },
  { to: '/activity', match: ['activity'], label: 'Activity', icon: Activity },
];

function useClickAway(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', on);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', on);
      document.removeEventListener('keydown', key);
    };
  }, [open, close]);
  return ref;
}

function Popover({ open, children, width }: { open: boolean; children: ReactNode; width?: number }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="popover" style={width ? { width } : undefined} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

type Hit = { kind: 'game' | 'tag' | 'dev' | 'thread'; label: string; sub?: string; go: string; gameId?: string };

function SearchBox() {
  const games = useAllGames();
  const threads = useStore((s) => s.threads);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'all' | 'game' | 'tag' | 'dev' | 'thread'>('all');
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(0);
  const ref = useClickAway(open, () => setOpen(false));

  const hits = useMemo<Hit[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const out: Hit[] = [];
    if (cat === 'all' || cat === 'game')
      games.filter((g) => g.title.toLowerCase().includes(s) || g.description.toLowerCase().includes(s)).slice(0, 6)
        .forEach((g) => out.push({ kind: 'game', label: g.title, sub: g.tags.slice(0, 3).join(' · '), go: `/game/${g.id}`, gameId: g.id }));
    if (cat === 'all' || cat === 'tag') {
      const tags = Array.from(new Set(games.flatMap((g) => g.tags))).filter((t) => t.toLowerCase().includes(s)).slice(0, 5);
      tags.forEach((t) => out.push({ kind: 'tag', label: t, sub: `${games.filter((g) => g.tags.includes(t)).length} games`, go: `/?tag=${encodeURIComponent(t)}` }));
    }
    if (cat === 'all' || cat === 'dev') {
      const devs = Array.from(new Set(games.map((g) => g.author))).filter((a) => a.toLowerCase().includes(s)).slice(0, 4);
      devs.forEach((a) => out.push({ kind: 'dev', label: a, sub: `${games.filter((g) => g.author === a).length} games`, go: `/?q=${encodeURIComponent(a)}` }));
    }
    if (cat === 'all' || cat === 'thread')
      threads.filter((t) => t.title.toLowerCase().includes(s)).slice(0, 4).forEach((t) => out.push({ kind: 'thread', label: t.title, sub: 'Forum', go: `/forum/thread/${t.id}` }));
    return out;
  }, [q, cat, games, threads]);

  const go = (h?: Hit) => {
    if (h) navigate(h.go);
    else if (q.trim()) navigate(`/?q=${encodeURIComponent(q.trim())}`);
    setOpen(false);
  };
  const groups: [Hit['kind'], string][] = [['game', 'Games'], ['tag', 'Tags'], ['dev', 'Developers'], ['thread', 'Forum threads']];

  return (
    <div className="search" ref={ref}>
      <div className="box">
        <Search size={16} className="muted" />
        <input
          value={q}
          placeholder="Search games, tags, developers…"
          aria-label="Search"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setHl(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHl((h) => Math.min(hits.length - 1, h + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(0, h - 1)); }
            else if (e.key === 'Enter') go(hits[hl]);
          }}
        />
        <select value={cat} onChange={(e) => setCat(e.target.value as typeof cat)} aria-label="Search in">
          <option value="all">All</option>
          <option value="game">Games</option>
          <option value="tag">Tags</option>
          <option value="dev">Developers</option>
          <option value="thread">Forum</option>
        </select>
      </div>
      {open && q.trim() && (
        <div className="dropdown">
          {hits.length === 0 && <div className="empty" style={{ padding: 16 }}>Nothing matches “{q}”. Press Enter to search the store.</div>}
          {groups.map(([kind, name]) => {
            const list = hits.filter((h) => h.kind === kind);
            if (!list.length) return null;
            return (
              <div key={kind}>
                <div className="group">{name}</div>
                {list.map((h) => {
                  const g = h.gameId ? games.find((x) => x.id === h.gameId) : undefined;
                  const idx = hits.indexOf(h);
                  return (
                    <button key={h.kind + h.label} className={'item' + (idx === hl ? ' hl' : '')} onMouseEnter={() => setHl(idx)} onClick={() => go(h)}>
                      {g && (
                        <span className="thumb" style={{ position: 'relative' }}>
                          <Cover game={g} showTitle={false} />
                        </span>
                      )}
                      <span>
                        <b><Highlight text={h.label} q={q.trim()} /></b>
                        {h.sub && <div className="muted" style={{ fontSize: 12 }}>{h.sub}</div>}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ThemeSwitcher() {
  const theme = useStore((s) => s.theme);
  const custom = useStore((s) => s.customTheme);
  const setTheme = useStore((s) => s.setTheme);
  const openModal = useStore((s) => s.openModal);
  const unlocks = useUnlocks();
  const active = useThemeDef();
  const [open, setOpen] = useState(false);
  const ref = useClickAway(open, () => setOpen(false));
  const cur = THEME_BY_ID[active.id];
  const groups: [ThemeDef['group'], string][] = [['featured', 'Featured'], ['fan', 'Fan themes'], ['classic', 'Classic'], ['unlock', 'Unlockable']];
  return (
    <div className="pop-wrap" ref={ref}>
      <button className="btn small" onClick={() => setOpen(!open)} aria-label="Change theme" title={`Theme: ${active.name}`} style={{ borderRadius: 999, height: 38 }}>
        <span className="swatch" style={{ width: 18, height: 18, borderRadius: '50%', background: cur?.swatch ?? active.tokens.accent }} />
        <Palette size={16} />
      </button>
      <Popover open={open} width={400}>
        <div className="theme-pop">
          {groups.map(([g, label]) => (
            <div key={g}>
              <div className="theme-group">{label}</div>
              {THEMES.filter((t) => t.group === g).map((t) => {
                const lock = t.unlock && !unlocks[t.unlock.id].done ? unlocks[t.unlock.id] : null;
                return (
                  <button
                    key={t.id}
                    className={'theme-opt' + (t.id === theme ? ' on' : '') + (lock ? ' locked' : '')}
                    disabled={!!lock}
                    onClick={() => { setTheme(t.id); setOpen(false); }}
                    title={lock ? t.unlock!.how : t.desc}
                  >
                    <span className="swatch" style={{ background: t.swatch }} />
                    <span style={{ minWidth: 0 }}>
                      <b>{t.name}</b>
                      <div className="muted" style={{ fontSize: 12 }}>{lock ? t.unlock!.how : t.desc}</div>
                    </span>
                    {lock && <span className="lock"><Lock size={13} /><br />{lock.progress}</span>}
                  </button>
                );
              })}
            </div>
          ))}
          {custom && (
            <>
              <div className="theme-group">Yours</div>
              <button className={'theme-opt' + (theme === 'custom' ? ' on' : '')} onClick={() => { setTheme('custom'); setOpen(false); }}>
                <span className="swatch" style={{ background: custom.bgMode === 'solid' || custom.bgMode === 'image' ? custom.bgColor : `linear-gradient(135deg, ${custom.bgColor}, ${custom.bgColor2})` }} />
                <span><b>{custom.name}</b><div className="muted" style={{ fontSize: 12 }}>Made in the Theme Studio</div></span>
              </button>
            </>
          )}
          <button className="btn primary theme-studio-link" onClick={() => { setOpen(false); openModal('theme'); }}><Paintbrush size={15} /> Build your own theme</button>
        </div>
      </Popover>
    </div>
  );
}

function Notifications() {
  const notices = useStore((s) => s.notices);
  const read = useStore((s) => s.readNotices);
  const [open, setOpen] = useState(false);
  const ref = useClickAway(open, () => setOpen(false));
  const unread = notices.filter((n) => !n.read).length;
  return (
    <div className="pop-wrap" ref={ref}>
      <button className="btn icon ghost" style={{ position: 'relative' }} aria-label={`Notifications${unread ? ` (${unread} new)` : ''}`} onClick={() => { setOpen(!open); if (!open) setTimeout(read, 1500); }}>
        <Bell size={18} />
        {unread > 0 && <span className="dot">{unread}</span>}
      </button>
      <Popover open={open} width={330}>
        <h4>Notifications</h4>
        {notices.length === 0 && <div className="empty" style={{ padding: 16 }}>Nothing yet.</div>}
        <div style={{ display: 'grid', gap: 2, maxHeight: 360, overflow: 'auto' }}>
          {notices.slice(0, 20).map((n) => (
            <a key={n.id} href={n.href} className={'notif' + (n.read ? '' : ' unread')} style={{ color: 'inherit', textDecoration: 'none' }} onClick={() => setOpen(false)}>
              <span className="tl-ico" style={{ width: 28, height: 28 }}><Bell size={14} /></span>
              <span>
                <div style={{ fontSize: 13 }}>{n.text}</div>
                <small>{timeAgo(n.at)}</small>
              </span>
            </a>
          ))}
        </div>
      </Popover>
    </div>
  );
}

function ProfileMenu() {
  const [acc, refresh] = useAccount();
  const openModal = useStore((s) => s.openModal);
  const [open, setOpen] = useState(false);
  const ref = useClickAway(open, () => setOpen(false));
  return (
    <div className="pop-wrap" ref={ref}>
      <button className="avatar" onClick={() => setOpen(!open)} aria-label="Your profile" title={acc.username}>
        {acc.username.slice(0, 1).toUpperCase()}
      </button>
      <Popover open={open} width={280}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '4px 6px 12px' }}>
          <span className="avatar" style={{ width: 44, height: 44, fontSize: 18 }}>{acc.username.slice(0, 1).toUpperCase()}</span>
          <div>
            <b>{acc.username}</b>
            <div className="muted" style={{ fontSize: 12 }}>{acc.signedIn ? (acc.title ? acc.title.title || acc.title.name : 'Signed in') : 'Playing as a guest'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 6px 10px' }}>
          <span className="badge">Level {acc.level}</span>
          <span className="badge"><Trophy size={12} /> {acc.trophies.length} trophies</span>
        </div>
        <a className="side-link" href={href('/library')} onClick={() => setOpen(false)}><User size={16} /> Profile & library</a>
        {acc.signedIn ? (
          <button className="side-link" onClick={() => { accounts()?.logOut(); refresh(); setOpen(false); }}><LogOut size={16} /> Log out</button>
        ) : (
          <button className="side-link" onClick={() => { openModal('account'); setOpen(false); }}><LogIn size={16} /> Sign in or make an account</button>
        )}
      </Popover>
    </div>
  );
}

function HeaderLogo() {
  const { logo } = useThemeDef();
  return (
    <a className="brand" href={href('/')} aria-label="Empire home">
      <EmpireLogo fontColor={logo} size={30} />
    </a>
  );
}

export function Header() {
  const { parts } = useRoute();
  const [acc] = useAccount();
  const openModal = useStore((s) => s.openModal);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebar = useStore((s) => s.setSidebar);
  const top = parts[0] ?? '';
  return (
    <header className="topbar">
      <button className="btn icon ghost hamburger" aria-label="Menu" onClick={() => setSidebar(!sidebarOpen)}>
        <Menu size={20} />
      </button>
      <nav className="nav" aria-label="Main">
        {NAV.map((n) => (
          <a key={n.to} href={href(n.to)} className={n.match.includes(top) ? 'on' : ''} title={n.label}>
            <n.icon size={17} />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
      <SearchBox />
      <div className="spacer" />
      <div className="right">
        <button className="btn primary" onClick={() => openModal('add')}>
          <Plus size={17} />
          <span className="add-game-label">Add a Game</span>
        </button>
        <ThemeSwitcher />
        <Notifications />
        <a className="wallet" href={href('/library')} title={`Level ${acc.level} · ${acc.trophies.length} trophies`} style={{ color: 'inherit', textDecoration: 'none' }}>
          <span className="lvl"><Trophy size={14} /> Lv {acc.level}</span>
        </a>
        <ProfileMenu />
        <HeaderLogo />
      </div>
    </header>
  );
}
