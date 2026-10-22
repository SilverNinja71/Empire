import type { Game } from './types';
import { useStore } from './store';
import { resolveUrl } from './util';

/** Open a game: studio worlds play inside Empire, everything else opens its own page. */
export function playGame(g: Game) {
  useStore.getState().markPlayed(g);
  if (g.type === 'studio') {
    window.location.hash = g.sourceUrl.startsWith('#') ? g.sourceUrl : '#/play/' + g.id;
    return;
  }
  window.location.href = resolveUrl(g.sourceUrl);
}
