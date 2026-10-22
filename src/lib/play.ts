import type { Game, ThemeId } from './types';
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

export const THEMES: { id: ThemeId; name: string; desc: string; swatch: string }[] = [
  { id: 'obsidian', name: 'Dark Obsidian', desc: 'Deep black with violet light', swatch: 'linear-gradient(135deg,#0a0c11 40%,#7c5cff 75%,#22d3ee)' },
  { id: 'neon', name: 'Neon Cyber', desc: 'Magenta and cyan glow', swatch: 'linear-gradient(135deg,#07020f 35%,#ff2bd6 70%,#00f0ff)' },
  { id: 'retro', name: 'Retro 90s', desc: 'Grey bevels, pixel titles', swatch: 'linear-gradient(135deg,#008080 50%,#c0c0c0 50%)' },
  { id: 'frosted', name: 'Frosted Glass', desc: 'See-through panels on color', swatch: 'linear-gradient(135deg,#4f46e5,#db2777,#0891b2)' },
  { id: 'steam', name: 'Classic Steam', desc: 'Blue-grey, green Play buttons', swatch: 'linear-gradient(135deg,#171a21 40%,#2a475e 70%,#66c0f4)' },
];
