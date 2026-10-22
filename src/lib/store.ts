import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ActivityItem, ActivityKind, ForumThread, Game, Notice, StudioProject, ThemeId } from './types';
import { parseCatalog } from './xml';
import { uid } from './util';
import { SEED_THREADS } from '../data/forumSeed';

/**
 * Everything Empire remembers lives in this browser's storage (key "empire:v1").
 * GitHub Pages has no server, so forum posts and added games stay on this device
 * until Empire is connected to an online database.
 */
type Modal = null | 'add' | 'make' | 'account';

interface Toast {
  id: string;
  text: string;
}

interface State {
  theme: ThemeId;
  wishlist: string[];
  played: Record<string, number>; // game id -> last played
  playCount: Record<string, number>;
  ratings: Record<string, number>;
  localGames: Game[];
  threads: ForumThread[];
  activity: ActivityItem[];
  notices: Notice[];
  projects: StudioProject[];
  welcomed: boolean;

  // not saved
  modal: Modal;
  sidebarOpen: boolean;
  toasts: Toast[];

  setTheme(t: ThemeId): void;
  toggleWish(g: Game): void;
  markPlayed(g: Game): void;
  rate(g: Game, stars: number): void;
  addLocalGame(g: Game): void;
  removeLocalGame(id: string): void;
  createThread(t: { board: string; title: string; body: string; author: string; badges: string[]; gameId?: string }): string;
  reply(threadId: string, body: string, author: string, badges: string[]): void;
  vote(threadId: string, postId: string, dir: 1 | -1): void;
  deleteThread(id: string): void;
  log(kind: ActivityKind, text: string, extra?: { gameId?: string; href?: string }): void;
  notify(text: string, href?: string): void;
  readNotices(): void;
  saveProject(p: StudioProject): void;
  deleteProject(id: string): void;
  openModal(m: Modal): void;
  setSidebar(open: boolean): void;
  toast(text: string): void;
  dropToast(id: string): void;
}

const MAX_ACTIVITY = 200;

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      theme: 'obsidian',
      wishlist: [],
      played: {},
      playCount: {},
      ratings: {},
      localGames: [],
      threads: SEED_THREADS,
      activity: [],
      notices: [
        { id: 'welcome', text: 'Welcome to Empire! Your games, trophies and achievements from every SilverNinja game show up here.', href: '#/library', at: Date.now(), read: false },
      ],
      projects: [],
      welcomed: false,
      modal: null,
      sidebarOpen: false,
      toasts: [],

      setTheme: (theme) => set({ theme }),
      toggleWish: (g) => {
        const on = get().wishlist.includes(g.id);
        set({ wishlist: on ? get().wishlist.filter((x) => x !== g.id) : [...get().wishlist, g.id] });
        if (!on) get().log('wishlist', `Wishlisted ${g.title}`, { gameId: g.id });
        get().toast(on ? `Removed ${g.title} from your wishlist` : `Added ${g.title} to your wishlist`);
      },
      markPlayed: (g) => {
        set({ played: { ...get().played, [g.id]: Date.now() }, playCount: { ...get().playCount, [g.id]: (get().playCount[g.id] || 0) + 1 } });
        get().log('played', `Played ${g.title}`, { gameId: g.id });
      },
      rate: (g, stars) => {
        set({ ratings: { ...get().ratings, [g.id]: stars } });
        get().log('rated', `Rated ${g.title} ${stars} star${stars === 1 ? '' : 's'}`, { gameId: g.id });
      },
      addLocalGame: (g) => {
        set({ localGames: [g, ...get().localGames.filter((x) => x.id !== g.id)] });
      },
      removeLocalGame: (id) => set({ localGames: get().localGames.filter((x) => x.id !== id) }),
      createThread: ({ board, title, body, author, badges, gameId }) => {
        const id = uid('t_');
        const now = Date.now();
        const thread: ForumThread = { id, board, title, gameId, createdAt: now, posts: [{ id: uid('p_'), author, badges, body, createdAt: now, votes: 1, myVote: 1 }] };
        set({ threads: [thread, ...get().threads] });
        get().log('posted', `Started a thread: ${title}`, { href: `#/forum/thread/${id}` });
        return id;
      },
      reply: (threadId, body, author, badges) => {
        set({
          threads: get().threads.map((t) =>
            t.id === threadId ? { ...t, posts: [...t.posts, { id: uid('p_'), author, badges, body, createdAt: Date.now(), votes: 1, myVote: 1 }] } : t,
          ),
        });
        const t = get().threads.find((x) => x.id === threadId);
        get().log('replied', `Replied in ${t?.title ?? 'a thread'}`, { href: `#/forum/thread/${threadId}` });
      },
      vote: (threadId, postId, dir) =>
        set({
          threads: get().threads.map((t) =>
            t.id !== threadId
              ? t
              : {
                  ...t,
                  posts: t.posts.map((p) => {
                    if (p.id !== postId) return p;
                    const prev = p.myVote ?? 0;
                    const next = prev === dir ? 0 : dir;
                    return { ...p, myVote: next, votes: p.votes - prev + next };
                  }),
                },
          ),
        }),
      deleteThread: (id) => set({ threads: get().threads.filter((t) => t.id !== id) }),
      log: (kind, text, extra) => set({ activity: [{ id: uid('a_'), kind, text, at: Date.now(), ...extra }, ...get().activity].slice(0, MAX_ACTIVITY) }),
      notify: (text, href) => set({ notices: [{ id: uid('n_'), text, href, at: Date.now(), read: false }, ...get().notices].slice(0, 50) }),
      readNotices: () => set({ notices: get().notices.map((n) => ({ ...n, read: true })) }),
      saveProject: (p) => set({ projects: [p, ...get().projects.filter((x) => x.id !== p.id)] }),
      deleteProject: (id) => set({ projects: get().projects.filter((x) => x.id !== id) }),
      openModal: (modal) => set({ modal, sidebarOpen: false }),
      setSidebar: (sidebarOpen) => set({ sidebarOpen }),
      toast: (text) => {
        const id = uid();
        set({ toasts: [...get().toasts, { id, text }].slice(-3) });
        window.setTimeout(() => get().dropToast(id), 3200);
      },
      dropToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
    }),
    {
      name: 'empire:v1',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ modal: _m, sidebarOpen: _s, toasts: _t, ...keep }) => keep,
    },
  ),
);

/** The shared catalog (public/games.xml), loaded once. */
interface CatalogState {
  games: Game[];
  status: 'loading' | 'ready' | 'error';
  error?: string;
  load(): Promise<void>;
}

export const useCatalog = create<CatalogState>()((set, get) => ({
  games: [],
  status: 'loading',
  async load() {
    if (get().status === 'ready') return;
    try {
      const res = await fetch(import.meta.env.BASE_URL + 'games.xml', { cache: 'no-cache' });
      if (!res.ok) throw new Error('games.xml: ' + res.status);
      set({ games: parseCatalog(await res.text()), status: 'ready' });
    } catch (e) {
      set({ status: 'error', error: (e as Error).message });
    }
  },
}));

/** Catalog games plus the ones added or made in this browser. */
export function useAllGames(): Game[] {
  const catalog = useCatalog((s) => s.games);
  const local = useStore((s) => s.localGames);
  const ids = new Set(catalog.map((g) => g.id));
  return [...catalog, ...local.filter((g) => !ids.has(g.id))];
}
