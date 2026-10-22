import React, { Suspense, lazy, useEffect } from 'react';
import { Activity, Library as LibraryIcon, MessagesSquare, Sparkles, Store as StoreIcon } from 'lucide-react';
import { useCatalog, useStore } from './lib/store';
import { href, useRoute } from './lib/router';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Toasts } from './components/ui';
import { AccountModal } from './components/AccountModal';
import { MakeGameModal } from './components/MakeGameModal';
import { ThemeBackdrop } from './components/ThemeBackdrop';
import { ThemeStudioModal } from './components/ThemeStudioModal';
import { useThemeDef } from './lib/useTheme';
import { applyTokens, THEMES } from './lib/themes';
import { useUnlocks } from './lib/unlocks';
import { startAuth } from './lib/auth';
import { Store } from './pages/Store';
import { GamePage } from './pages/GamePage';
import { Forum } from './pages/Forum';
import { ActivityPage, Library } from './pages/Library';

// The heavy parts (Three.js studio, the add-game window) load only when opened.
// If Empire was updated while this tab was open, the old part files are gone:
// reload once to get the new version instead of showing a blank page.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyPart<T extends React.ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().then((m) => {
      sessionStorage.removeItem('empire:reloaded');
      return m;
    }, (e) => {
      if (!sessionStorage.getItem('empire:reloaded')) {
        sessionStorage.setItem('empire:reloaded', '1');
        window.location.reload();
      }
      throw e;
    }),
  );
}
const AddGameModal = lazyPart(() => import('./addgame/AddGameModal'));
const Studio3D = lazyPart(() => import('./studio/Studio3D'));
const Studio2D = lazyPart(() => import('./studio/Studio2D'));
const PlayStudio = lazyPart(() => import('./studio/PlayStudio'));

function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="empty" style={{ paddingTop: 120 }}>{label}</div>;
}

export function App() {
  const theme = useStore((s) => s.theme);
  const custom = useStore((s) => s.customTheme);
  const active = useThemeDef();
  const unlocks = useUnlocks();
  const modal = useStore((s) => s.modal);
  const load = useCatalog((s) => s.load);
  const { parts } = useRoute();
  const top = parts[0] ?? '';

  useEffect(() => { load(); startAuth(); }, [load]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = active.id;
    root.dataset.deco = active.deco;
    applyTokens(root, active.tokens, active.borderWidth);
  }, [theme, custom]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Tell people when a milestone theme unlocks
    const st = useStore.getState();
    THEMES.filter((t) => t.unlock && unlocks[t.unlock.id].done && !st.unlocksSeen.includes(t.id)).forEach((t) => {
      st.markUnlockSeen(t.id);
      st.notify(`New theme unlocked: ${t.name}! Pick it from the theme menu.`);
      st.toast(`🎨 Theme unlocked: ${t.name}`);
    });
  }, [unlocks]);
  useEffect(() => {
    if (top === 'theme-studio') useStore.getState().openModal('theme');
  }, [top]);
  useEffect(() => {
    // Trophies earned in a game show up as notifications here
    const on = (e: Event) => {
      const fresh = (e as CustomEvent<{ name: string }[]>).detail || [];
      fresh.forEach((t) => {
        useStore.getState().notify(`Trophy unlocked: ${t.name}`, '#/library');
        useStore.getState().log('trophy', `Earned the ${t.name} trophy`, { href: '#/library' });
      });
    };
    window.addEventListener('gametrophies', on);
    return () => window.removeEventListener('gametrophies', on);
  }, []);
  useEffect(() => {
    const main = document.querySelector('.main');
    if (main) main.scrollTop = 0;
  }, [parts.join('/')]);

  // The studio and studio games take over the whole window
  if (top === 'studio' || top === 'play') {
    return (
      <>
        <Suspense fallback={<Loading label="Opening the studio…" />}>
          {top === 'play' ? <PlayStudio id={parts[1]} /> : parts[1] === '2d' ? <Studio2D projectId={parts[2]} /> : <Studio3D projectId={parts[2]} />}
        </Suspense>
        <Toasts />
      </>
    );
  }

  let page;
  if (top === 'game' && parts[1]) page = <GamePage id={parts[1]} />;
  else if (top === 'forum') page = <Forum />;
  else if (top === 'library') page = <Library />;
  else if (top === 'activity') page = <ActivityPage />;
  else page = <Store />;

  const tab = (to: string, on: boolean, Icon: typeof StoreIcon, label: string) => (
    <a href={href(to)} className={on ? 'on' : ''}><Icon size={20} />{label}</a>
  );

  return (
    <>
    <ThemeBackdrop deco={active.deco} />
    <div className="app">
      <Header />
      <Sidebar />
      <main className="main" id="main">{page}</main>
      <nav className="mobile-nav" aria-label="Main">
        {tab('/', top === '' || top === 'game', StoreIcon, 'Store')}
        {tab('/forum', top === 'forum', MessagesSquare, 'Forum')}
        <a href="#" onClick={(e) => { e.preventDefault(); useStore.getState().openModal('make'); }}><Sparkles size={20} />Make</a>
        {tab('/library', top === 'library', LibraryIcon, 'Library')}
        {tab('/activity', top === 'activity', Activity, 'Activity')}
      </nav>
      <Suspense fallback={null}>{modal === 'add' && <AddGameModal />}</Suspense>
      <MakeGameModal />
      <AccountModal />
      <ThemeStudioModal />
      <Toasts />
    </div>
    </>
  );
}
