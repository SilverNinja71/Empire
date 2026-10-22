import { useEffect, useState } from 'react';
import { useStore } from './store';
import { readLS } from './util';
import type { UnlockId } from './themes';

export interface UnlockState {
  done: boolean;
  progress: string;
}

/** Milestone themes unlock from things you've done in the games and in Empire. */
export function checkUnlocks(): Record<UnlockId, UnlockState> {
  const s = useStore.getState();
  // Penguin League keeps its own save: career.played and career.wins
  const pl = readLS<{ career?: { played?: number; wins?: number } } | null>('penguin-league-save-v1', null);
  const played = Number(pl?.career?.played) || 0;
  const wins = Number(pl?.career?.wins) || 0;
  const added = s.localGames.filter((g) => g.origin === 'local').length;
  const levels = s.levelsCompleted;
  return {
    penguin: { done: wins >= 1 || played >= 3, progress: wins ? `${wins} win${wins > 1 ? 's' : ''}` : `${Math.min(played, 3)}/3 matches played` },
    publisher: { done: added >= 3, progress: `${Math.min(added, 3)}/3 games added` },
    pixel: { done: levels >= 1, progress: levels ? `${levels} level${levels > 1 ? 's' : ''} finished` : 'No level finished yet' },
  };
}

/** Live unlock state (Penguin League may be played in another tab, so look again every few seconds). */
export function useUnlocks(): Record<UnlockId, UnlockState> {
  const localGames = useStore((s) => s.localGames);
  const levels = useStore((s) => s.levelsCompleted);
  const [state, setState] = useState(checkUnlocks);
  useEffect(() => {
    const refresh = () => setState(checkUnlocks());
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    const t = window.setInterval(refresh, 5000);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
      window.clearInterval(t);
    };
  }, [localGames, levels]);
  return state;
}
