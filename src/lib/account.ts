import { useEffect, useState } from 'react';
import { readLS } from './util';

/** The shared site account from public/shared/accounts.js (the same file every game loads). */
export interface Trophy {
  id: string;
  game: string;
  name: string;
  title: string;
  desc: string;
  color: string;
  earned: number;
}

interface Result {
  ok: boolean;
  error?: string;
  username?: string;
}

interface GameAccountsAPI {
  current(): { username: string; key: string; provider?: string | null } | null;
  signInExternal?(info: { provider: string; uid: string; name: string; via?: string }, keepProgress: boolean): Result;
  list(): { key: string; username: string; updated: number }[];
  signUp(name: string, password: string, keepProgress: boolean): Promise<Result>;
  logIn(name: string, password: string): Promise<Result>;
  logOut(): Result;
  trophies: {
    catalog(): Trophy[];
    earned(): Trophy[];
    title(): Trophy | null;
    equip(id: string | null): boolean;
    badgeHTML(id: string, size?: number, dim?: boolean): string;
  };
}

declare global {
  interface Window {
    GameAccounts?: GameAccountsAPI;
  }
}

export const accounts = (): GameAccountsAPI | undefined => window.GameAccounts;

interface Profile {
  username?: string;
  level?: number;
  xp?: number;
  stats?: { matches?: number; wins?: number };
}

export interface AccountState {
  signedIn: boolean;
  provider: string | null;
  username: string;
  level: number;
  trophies: Trophy[];
  catalog: Trophy[];
  title: Trophy | null;
  matches: number;
  wins: number;
}

function snapshot(): AccountState {
  const api = accounts();
  const p = readLS<Profile | null>('spear_mace_user_profile', null);
  const cur = api?.current() ?? null;
  const trophies = api?.trophies.earned() ?? [];
  return {
    signedIn: !!cur,
    provider: cur?.provider ?? null,
    username: cur?.username || p?.username || 'Guest',
    level: Math.max(1, Number(p?.level) || 1),
    trophies,
    catalog: api?.trophies.catalog() ?? [],
    title: api?.trophies.title() ?? null,
    matches: Number(p?.stats?.matches) || 0,
    wins: Number(p?.stats?.wins) || 0,
  };
}

const same = (a: AccountState, b: AccountState) =>
  a.signedIn === b.signedIn && a.username === b.username && a.level === b.level &&
  a.trophies.length === b.trophies.length && a.title?.id === b.title?.id && a.matches === b.matches;

/** Live view of the shared account: updates when a game (in any tab) changes it. */
export function useAccount(): [AccountState, () => void] {
  const [state, setState] = useState(snapshot);
  useEffect(() => {
    const refresh = () => setState((prev) => {
      const next = snapshot();
      return same(prev, next) ? prev : next;
    });
    window.addEventListener('storage', refresh);
    window.addEventListener('gametrophies', refresh);
    window.addEventListener('focus', refresh);
    const t = window.setInterval(refresh, 4000);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('gametrophies', refresh);
      window.removeEventListener('focus', refresh);
      window.clearInterval(t);
    };
  }, []);
  return [state, () => setState(snapshot())];
}
