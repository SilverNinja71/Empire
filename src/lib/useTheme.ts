import { useStore } from './store';
import { DEFAULT_CUSTOM, DEFAULT_THEME, THEME_BY_ID, customToTokens, type Deco, type Tokens } from './themes';

export interface ActiveTheme {
  id: string;
  name: string;
  deco: Deco;
  logo: string;
  tokens: Tokens;
  borderWidth: number;
}

/** The theme in use right now: a built-in one, or the custom theme from the Theme Studio. */
export function useThemeDef(): ActiveTheme {
  const id = useStore((s) => s.theme);
  const custom = useStore((s) => s.customTheme);
  if (id === 'custom') {
    const c = custom ?? DEFAULT_CUSTOM;
    return { id: 'custom', name: c.name, deco: 'custom', logo: c.logoColor, tokens: customToTokens(c), borderWidth: c.borderWidth };
  }
  const t = THEME_BY_ID[id] ?? THEME_BY_ID[DEFAULT_THEME];
  return { id: t.id, name: t.name, deco: t.deco, logo: t.logo, tokens: t.tokens, borderWidth: 1 };
}
