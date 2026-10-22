/**
 * Every Empire theme is a set of design tokens (colors, fonts, corners) plus a "deco" key
 * that picks the animated background scenery and the card decorations (theme-decorations.css).
 */
export type Deco = 'sunset' | 'mario' | 'october' | 'onepiece' | 'ghibli' | 'jjk' | 'snow' | 'gold' | 'gameboy' | 'none' | 'custom';
export type UnlockId = 'penguin' | 'publisher' | 'pixel';

export interface Tokens {
  bg: string;
  bgImage: string;
  panel: string;
  panel2: string;
  panel3: string;
  border: string;
  borderStrong: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  accentContrast: string;
  play: string;
  playContrast: string;
  glow: string;
  shadow: string;
  radius: string;
  radiusSm: string;
  fontBody: string;
  fontDisplay: string;
  panelFilter: string;
  headerBg: string;
  bevel: string;
  scheme: 'dark' | 'light';
}

export interface ThemeDef {
  id: string;
  name: string;
  desc: string;
  group: 'featured' | 'fan' | 'classic' | 'unlock';
  swatch: string;
  logo: string; // Empire wordmark letter color
  deco: Deco;
  tokens: Tokens;
  unlock?: { id: UnlockId; how: string };
}

const F = {
  inter: '"Inter", system-ui, sans-serif',
  baloo: '"Baloo 2", "Inter", system-ui, sans-serif',
  pixel: '"Press Start 2P", monospace',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  mochiy: '"Mochiy Pop One", "Baloo 2", sans-serif',
  pirata: '"Pirata One", "Baloo 2", serif',
  zen: '"Zen Maru Gothic", "Inter", sans-serif',
  dela: '"Dela Gothic One", "Inter", sans-serif',
  cinzel: '"Cinzel", Georgia, serif',
};

const dark = (t: Partial<Tokens>): Tokens => ({
  bg: '#0a0c11',
  bgImage: 'none',
  panel: '#12151d',
  panel2: '#181c26',
  panel3: '#202533',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.14)',
  text: '#e9ecf3',
  muted: '#8b94a7',
  accent: '#7c5cff',
  accent2: '#22d3ee',
  accentContrast: '#ffffff',
  play: '#22c55e',
  playContrast: '#052e12',
  glow: '0 0 24px rgba(124,92,255,0.45)',
  shadow: '0 10px 30px rgba(0,0,0,0.45)',
  radius: '14px',
  radiusSm: '9px',
  fontBody: F.inter,
  fontDisplay: F.baloo,
  panelFilter: 'none',
  headerBg: 'rgba(10,12,17,0.82)',
  bevel: 'none',
  scheme: 'dark',
  ...t,
});

export const THEMES: ThemeDef[] = [
  {
    id: 'sunset', name: 'Golden Ridge Sunset', desc: 'Amber sky over layered pine ridges', group: 'featured', deco: 'sunset', logo: '#fff3dc',
    swatch: 'linear-gradient(180deg,#ffae19 0%,#ff9000 35%,#c85a2b 55%,#5a1b1b 75%,#140508 100%)',
    tokens: dark({
      bg: '#140508', panel: 'rgba(31,10,14,0.9)', panel2: '#2a0f13', panel3: '#3b1114',
      border: 'rgba(255,174,25,0.16)', borderStrong: 'rgba(255,144,0,0.45)', text: '#fff1dc', muted: '#d9a98a',
      accent: '#ff9000', accent2: '#ffd24d', accentContrast: '#1f0a0e', play: '#ffae19', playContrast: '#2a0b05',
      glow: '0 0 22px rgba(255,174,25,0.55)', shadow: '0 14px 34px rgba(20,5,8,0.65)', panelFilter: 'blur(6px)',
      headerBg: 'rgba(31,10,14,0.72)',
    }),
  },
  {
    id: 'mario', name: 'Retro Plumber World', desc: 'Blue sky, grass blocks, pipes and ? blocks', group: 'fan', deco: 'mario', logo: '#e52521',
    swatch: 'linear-gradient(180deg,#5c94fc 0 60%,#43b047 60% 70%,#b0682a 70%)',
    tokens: dark({
      bg: '#5c94fc', panel: '#fbf3d5', panel2: '#f3e6b8', panel3: '#ead69a', border: '#2b1b0e', borderStrong: '#000000',
      text: '#2b1b0e', muted: '#6b4a2b', accent: '#e52521', accent2: '#fbd000', accentContrast: '#ffffff', play: '#43b047', playContrast: '#ffffff',
      glow: '0 0 0 3px #000', shadow: '4px 4px 0 #000', radius: '0px', radiusSm: '0px', fontDisplay: F.pixel, headerBg: '#fbf3d5', scheme: 'light',
    }),
  },
  {
    id: 'anime-october', name: 'Spirit Lantern October', desc: 'Harvest moon, spirit wisps, falling maple leaves', group: 'fan', deco: 'october', logo: '#ffe7d6',
    swatch: 'radial-gradient(circle at 70% 30%,#ffd9a0 0 12%,transparent 13%),linear-gradient(160deg,#18122B,#3a2a63 60%,#FF7B54)',
    tokens: dark({
      bg: '#18122B', panel: 'rgba(36,26,62,0.9)', panel2: '#2e2150', panel3: '#3a2a63', border: 'rgba(139,92,246,0.28)', borderStrong: 'rgba(255,123,84,0.55)',
      text: '#f6f0ff', muted: '#b6a8d6', accent: '#FF7B54', accent2: '#8B5CF6', accentContrast: '#18122B', play: '#FF7B54', playContrast: '#18122B',
      glow: '0 0 22px rgba(255,123,84,0.55)', radius: '16px', radiusSm: '10px', fontDisplay: F.mochiy, headerBg: 'rgba(24,18,43,0.8)', panelFilter: 'blur(4px)',
    }),
  },
  {
    id: 'one-piece', name: 'Grand Line Pirates', desc: 'Sea charts, parchment and wanted posters', group: 'fan', deco: 'onepiece', logo: '#0f4c81',
    swatch: 'linear-gradient(135deg,#0f4c81 0 45%,#f5e6c8 45% 80%,#dc2626 80%)',
    tokens: dark({
      bg: '#0f4c81', panel: '#f5e6c8', panel2: '#ecd8b0', panel3: '#e2c992', border: '#b08850', borderStrong: '#6b4423',
      text: '#3b2410', muted: '#7a5a36', accent: '#dc2626', accent2: '#f7c844', accentContrast: '#ffffff', play: '#f7c844', playContrast: '#3b2410',
      glow: '0 0 0 2px #6b4423, 0 0 18px rgba(247,200,68,0.6)', shadow: '0 10px 24px rgba(4,25,45,0.5)', radius: '6px', radiusSm: '4px',
      fontDisplay: F.pirata, headerBg: 'rgba(245,230,200,0.95)', scheme: 'light',
    }),
  },
  {
    id: 'ghibli', name: 'Meadow Spirits', desc: 'Watercolor clouds, rolling hills, soot sprites', group: 'fan', deco: 'ghibli', logo: '#7f4f24',
    swatch: 'linear-gradient(180deg,#8ecae6 0 55%,#a3c585 55% 75%,#588157 75%)',
    tokens: dark({
      bg: '#8ecae6', panel: 'rgba(254,250,224,0.93)', panel2: '#f3efd0', panel3: '#e7e2bf', border: 'rgba(88,129,87,0.35)', borderStrong: '#588157',
      text: '#3d3021', muted: '#7a6a52', accent: '#588157', accent2: '#bc6c25', accentContrast: '#ffffff', play: '#588157', playContrast: '#ffffff',
      glow: '0 0 20px rgba(254,250,224,0.9)', shadow: '0 12px 28px rgba(40,70,60,0.25)', radius: '22px', radiusSm: '14px',
      fontDisplay: F.zen, fontBody: F.zen, headerBg: 'rgba(254,250,224,0.85)', panelFilter: 'blur(3px)', scheme: 'light',
    }),
  },
  {
    id: 'jjk', name: 'Cursed Domain', desc: 'Void black, cursed energy flames, talismans', group: 'fan', deco: 'jjk', logo: '#ffffff',
    swatch: 'linear-gradient(135deg,#07070a 40%,#7209b7 65%,#00f5d4 80%,#e63946)',
    tokens: dark({
      bg: '#07070a', panel: '#0f0f16', panel2: '#161622', panel3: '#1f1f30', border: 'rgba(0,245,212,0.2)', borderStrong: 'rgba(230,57,70,0.6)',
      text: '#ecebf5', muted: '#8c8aa8', accent: '#00f5d4', accent2: '#e63946', accentContrast: '#04120f', play: '#e63946', playContrast: '#ffffff',
      glow: '0 0 18px rgba(0,245,212,0.6), 0 0 36px rgba(114,9,183,0.4)', radius: '2px', radiusSm: '2px', fontDisplay: F.dela, headerBg: 'rgba(7,7,10,0.85)',
    }),
  },
  {
    id: 'obsidian', name: 'Dark Obsidian', desc: 'Deep black with violet light', group: 'classic', deco: 'none', logo: '#ffffff',
    swatch: 'linear-gradient(135deg,#0a0c11 40%,#7c5cff 75%,#22d3ee)',
    tokens: dark({ bgImage: 'radial-gradient(1200px 600px at 80% -10%, rgba(124,92,255,0.14), transparent 60%), radial-gradient(900px 500px at -10% 110%, rgba(34,211,238,0.08), transparent 60%)' }),
  },
  {
    id: 'neon', name: 'Neon Cyber', desc: 'Magenta and cyan glow', group: 'classic', deco: 'none', logo: '#ffffff',
    swatch: 'linear-gradient(135deg,#07020f 35%,#ff2bd6 70%,#00f0ff)',
    tokens: dark({
      bg: '#07020f',
      bgImage: 'linear-gradient(rgba(255,43,214,0.06) 1px, transparent 1px) 0 0/40px 40px, linear-gradient(90deg, rgba(0,240,255,0.05) 1px, transparent 1px) 0 0/40px 40px, radial-gradient(900px 500px at 50% -20%, rgba(255,43,214,0.25), transparent 70%)',
      panel: '#10061f', panel2: '#170a2c', panel3: '#22103e', border: 'rgba(255,43,214,0.18)', borderStrong: 'rgba(0,240,255,0.45)', text: '#f6e9ff', muted: '#a98fc7',
      accent: '#ff2bd6', accent2: '#00f0ff', accentContrast: '#12001a', play: '#00f0ff', playContrast: '#00151a', glow: '0 0 18px rgba(255,43,214,0.7), 0 0 40px rgba(0,240,255,0.25)',
      shadow: '0 0 0 1px rgba(255,43,214,0.15), 0 12px 40px rgba(0,0,0,0.6)', radius: '4px', radiusSm: '3px', fontDisplay: F.mono, headerBg: 'rgba(7,2,15,0.85)',
    }),
  },
  {
    id: 'retro', name: 'Retro 90s', desc: 'Grey bevels, pixel titles', group: 'classic', deco: 'none', logo: '#000080',
    swatch: 'linear-gradient(135deg,#008080 50%,#c0c0c0 50%)',
    tokens: dark({
      bg: '#008080', panel: '#c0c0c0', panel2: '#d4d0c8', panel3: '#e4e1da', border: '#808080', borderStrong: '#000000', text: '#000000', muted: '#404040',
      accent: '#000080', accent2: '#800080', play: '#008000', playContrast: '#ffffff', glow: 'none', shadow: '2px 2px 0 #000000', radius: '0px', radiusSm: '0px',
      fontBody: '"Inter", Tahoma, sans-serif', fontDisplay: F.pixel, headerBg: '#c0c0c0', bevel: 'inset -2px -2px 0 #808080, inset 2px 2px 0 #ffffff', scheme: 'light',
    }),
  },
  {
    id: 'frosted', name: 'Frosted Glass', desc: 'See-through panels on color', group: 'classic', deco: 'none', logo: '#ffffff',
    swatch: 'linear-gradient(135deg,#4f46e5,#db2777,#0891b2)',
    tokens: dark({
      bg: '#1b1f3b',
      bgImage: 'radial-gradient(800px 600px at 10% 10%, #4f46e5 0%, transparent 60%), radial-gradient(700px 600px at 90% 20%, #db2777 0%, transparent 60%), radial-gradient(800px 700px at 50% 100%, #0891b2 0%, transparent 60%)',
      panel: 'rgba(255,255,255,0.1)', panel2: 'rgba(255,255,255,0.14)', panel3: 'rgba(255,255,255,0.2)', border: 'rgba(255,255,255,0.22)', borderStrong: 'rgba(255,255,255,0.45)',
      text: '#ffffff', muted: 'rgba(255,255,255,0.72)', accent: '#ffffff', accent2: '#fde68a', accentContrast: '#1b1f3b', play: '#ffffff', playContrast: '#312e81',
      glow: '0 0 30px rgba(255,255,255,0.35)', shadow: '0 20px 50px rgba(15,10,60,0.35)', radius: '20px', radiusSm: '12px',
      panelFilter: 'blur(18px) saturate(140%)', headerBg: 'rgba(255,255,255,0.1)',
    }),
  },
  {
    id: 'steam', name: 'Classic Steam', desc: 'Blue-grey, green Play buttons', group: 'classic', deco: 'none', logo: '#c7d5e0',
    swatch: 'linear-gradient(135deg,#171a21 40%,#2a475e 70%,#66c0f4)',
    tokens: dark({
      bg: '#1b2838', bgImage: 'linear-gradient(180deg, #171a21 0%, #1b2838 320px)', panel: '#16202d', panel2: '#213246', panel3: '#2a475e',
      border: 'rgba(102,192,244,0.12)', borderStrong: 'rgba(102,192,244,0.4)', text: '#c7d5e0', muted: '#8f98a0', accent: '#66c0f4', accent2: '#a4d007',
      accentContrast: '#0b141d', play: '#75b022', playContrast: '#0e1a03', glow: '0 0 16px rgba(102,192,244,0.35)', shadow: '0 8px 24px rgba(0,0,0,0.5)',
      radius: '3px', radiusSm: '2px', fontDisplay: F.inter, headerBg: '#171a21',
    }),
  },
  {
    id: 'penguin-champion', name: 'Penguin Champion', desc: 'Arctic rink neon, frost glass, falling snow', group: 'unlock', deco: 'snow', logo: '#e0f7ff',
    swatch: 'linear-gradient(135deg,#06283d,#0e7490 55%,#a5f3fc)',
    unlock: { id: 'penguin', how: 'Win a Penguin League match (or play 3)' },
    tokens: dark({
      bg: '#06283d', bgImage: 'radial-gradient(900px 500px at 50% -10%, rgba(56,189,248,0.35), transparent 70%), linear-gradient(180deg, #06283d, #0b1f33)',
      panel: 'rgba(255,255,255,0.09)', panel2: 'rgba(255,255,255,0.15)', panel3: 'rgba(255,255,255,0.22)', border: 'rgba(173,232,244,0.35)', borderStrong: '#7dd3fc',
      text: '#f0fbff', muted: '#a5cde0', accent: '#38bdf8', accent2: '#a5f3fc', accentContrast: '#04202f', play: '#22d3ee', playContrast: '#04202f',
      glow: '0 0 20px rgba(56,189,248,0.7), 0 0 40px rgba(165,243,252,0.3)', radius: '18px', radiusSm: '12px', panelFilter: 'blur(16px) saturate(140%)',
      headerBg: 'rgba(6,40,61,0.6)',
    }),
  },
  {
    id: 'master-publisher', name: 'Master Publisher', desc: 'Holographic gold foil for top creators', group: 'unlock', deco: 'gold', logo: '#ffe08a',
    swatch: 'linear-gradient(135deg,#0d0b07 30%,#facc15 55%,#f472b6 75%,#60a5fa)',
    unlock: { id: 'publisher', how: 'Add 3 games with Add a Game' },
    tokens: dark({
      bg: '#0d0b07', bgImage: 'radial-gradient(1000px 500px at 20% -10%, rgba(250,204,21,0.18), transparent 60%), radial-gradient(800px 500px at 100% 100%, rgba(244,114,182,0.12), transparent 60%)',
      panel: '#17130b', panel2: '#211a0e', panel3: '#2d2312', border: 'rgba(250,204,21,0.25)', borderStrong: '#facc15', text: '#fff8e1', muted: '#cdb98a',
      accent: '#facc15', accent2: '#f472b6', accentContrast: '#1a1405', play: '#facc15', playContrast: '#1a1405', glow: '0 0 22px rgba(250,204,21,0.55)',
      radius: '12px', radiusSm: '8px', fontDisplay: F.cinzel, headerBg: 'rgba(13,11,7,0.85)',
    }),
  },
  {
    id: 'pixel-veteran', name: 'Pixel Veteran', desc: 'Four shades of handheld green', group: 'unlock', deco: 'gameboy', logo: '#0f380f',
    swatch: 'linear-gradient(135deg,#0f380f 25%,#306230 25% 50%,#8bac0f 50% 75%,#9bbc0f 75%)',
    unlock: { id: 'pixel', how: 'Finish a level in the Studio (reach the goal flag)' },
    tokens: dark({
      bg: '#0f380f', bgImage: 'linear-gradient(rgba(155,188,15,0.07) 2px, transparent 2px) 0 0/8px 8px, linear-gradient(90deg, rgba(155,188,15,0.07) 2px, transparent 2px) 0 0/8px 8px',
      panel: '#9bbc0f', panel2: '#8bac0f', panel3: '#7a9a0d', border: '#306230', borderStrong: '#0f380f', text: '#0f380f', muted: '#306230',
      accent: '#306230', accent2: '#0f380f', accentContrast: '#9bbc0f', play: '#306230', playContrast: '#9bbc0f', glow: '0 0 0 3px #0f380f', shadow: '4px 4px 0 #0f380f',
      radius: '0px', radiusSm: '0px', fontDisplay: F.pixel, headerBg: '#8bac0f', scheme: 'light',
    }),
  },
];

export const THEME_BY_ID: Record<string, ThemeDef> = Object.fromEntries(THEMES.map((t) => [t.id, t]));
export const DEFAULT_THEME = 'sunset';

// ---------- Custom themes (Theme Studio) ----------

export const FONT_CHOICES: { label: string; value: string }[] = [
  { label: 'Inter (clean)', value: F.inter },
  { label: 'Baloo 2 (round)', value: F.baloo },
  { label: 'Press Start 2P (pixel)', value: F.pixel },
  { label: 'JetBrains Mono (code)', value: F.mono },
  { label: 'Mochiy Pop One (anime)', value: F.mochiy },
  { label: 'Pirata One (pirate)', value: F.pirata },
  { label: 'Zen Maru Gothic (soft)', value: F.zen },
  { label: 'Dela Gothic One (bold)', value: F.dela },
  { label: 'Cinzel (classic)', value: F.cinzel },
];

export interface CustomTheme {
  version: 1;
  name: string;
  bgMode: 'solid' | 'linear' | 'radial' | 'image';
  bgColor: string;
  bgColor2: string;
  bgAngle: number;
  bgImageUrl: string;
  cardColor: string;
  cardOpacity: number; // 0..1
  borderWidth: number; // px
  borderColor: string;
  radius: number; // px
  blur: number; // px
  headerFont: string;
  baseFont: string;
  textColor: string;
  accent: string;
  logoColor: string;
  scheme: 'dark' | 'light';
}

export const DEFAULT_CUSTOM: CustomTheme = {
  version: 1, name: 'My Theme', bgMode: 'linear', bgColor: '#1e1b4b', bgColor2: '#7c2d12', bgAngle: 160, bgImageUrl: '',
  cardColor: '#111827', cardOpacity: 0.85, borderWidth: 1, borderColor: '#f59e0b', radius: 16, blur: 8,
  headerFont: F.baloo, baseFont: F.inter, textColor: '#f9fafb', accent: '#f59e0b', logoColor: '#ffffff', scheme: 'dark',
};

const HEX = /^#[0-9a-f]{6}$/i;
const clampN = (v: unknown, a: number, b: number, d: number) => (typeof v === 'number' && isFinite(v) ? Math.min(b, Math.max(a, v)) : d);

/** Accept only well-formed values from an imported theme file. Anything odd falls back to the default. */
export function sanitizeCustom(raw: unknown): CustomTheme {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_CUSTOM;
  const color = (k: keyof CustomTheme) => (typeof r[k] === 'string' && HEX.test(r[k] as string) ? (r[k] as string) : (d[k] as string));
  const font = (k: 'headerFont' | 'baseFont') => (FONT_CHOICES.some((f) => f.value === r[k]) ? (r[k] as string) : d[k]);
  let url = typeof r.bgImageUrl === 'string' ? r.bgImageUrl.trim() : '';
  if (!/^https:\/\/[^\s"'()\\]+$/i.test(url)) url = '';
  return {
    version: 1,
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 40) : d.name,
    bgMode: (['solid', 'linear', 'radial', 'image'] as const).includes(r.bgMode as never) ? (r.bgMode as CustomTheme['bgMode']) : d.bgMode,
    bgColor: color('bgColor'),
    bgColor2: color('bgColor2'),
    bgAngle: clampN(r.bgAngle, 0, 360, d.bgAngle),
    bgImageUrl: url,
    cardColor: color('cardColor'),
    cardOpacity: clampN(r.cardOpacity, 0.2, 1, d.cardOpacity),
    borderWidth: clampN(r.borderWidth, 0, 6, d.borderWidth),
    borderColor: color('borderColor'),
    radius: clampN(r.radius, 0, 32, d.radius),
    blur: clampN(r.blur, 0, 30, d.blur),
    headerFont: font('headerFont'),
    baseFont: font('baseFont'),
    textColor: color('textColor'),
    accent: color('accent'),
    logoColor: color('logoColor'),
    scheme: r.scheme === 'light' ? 'light' : 'dark',
  };
}

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Turn a custom theme into the same tokens the built-in themes use. */
export function customToTokens(c: CustomTheme): Tokens {
  const bgImage =
    c.bgMode === 'linear' ? `linear-gradient(${c.bgAngle}deg, ${c.bgColor}, ${c.bgColor2})` :
    c.bgMode === 'radial' ? `radial-gradient(circle at 50% 30%, ${c.bgColor2}, ${c.bgColor} 70%)` :
    c.bgMode === 'image' && c.bgImageUrl ? `linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.25)), url("${c.bgImageUrl}") center/cover fixed` : 'none';
  const light = c.scheme === 'light';
  return dark({
    bg: c.bgColor,
    bgImage,
    panel: rgba(c.cardColor, c.cardOpacity),
    panel2: rgba(c.cardColor, Math.min(1, c.cardOpacity + 0.08)),
    panel3: rgba(c.cardColor, Math.min(1, c.cardOpacity + 0.16)),
    border: c.borderWidth ? rgba(c.borderColor, 0.45) : 'transparent',
    borderStrong: c.borderColor,
    text: c.textColor,
    muted: rgba(c.textColor, 0.68),
    accent: c.accent,
    accent2: c.borderColor,
    accentContrast: light ? '#ffffff' : '#111111',
    play: c.accent,
    playContrast: light ? '#ffffff' : '#111111',
    glow: `0 0 20px ${rgba(c.accent, 0.5)}`,
    radius: c.radius + 'px',
    radiusSm: Math.round(c.radius * 0.6) + 'px',
    fontBody: c.baseFont,
    fontDisplay: c.headerFont,
    panelFilter: c.blur ? `blur(${c.blur}px)` : 'none',
    headerBg: rgba(c.cardColor, Math.min(0.95, c.cardOpacity + 0.05)),
    scheme: c.scheme,
  });
}

/** Write a theme's tokens onto the page (the CSS reads them as variables). */
export function applyTokens(el: HTMLElement, t: Tokens, borderWidth = 1) {
  const s = el.style;
  const set = (k: string, v: string) => s.setProperty(k, v);
  set('--bg', t.bg);
  set('--bg-image', t.bgImage);
  set('--panel', t.panel);
  set('--panel-2', t.panel2);
  set('--panel-3', t.panel3);
  set('--border', t.border);
  set('--border-strong', t.borderStrong);
  set('--text', t.text);
  set('--muted', t.muted);
  set('--accent', t.accent);
  set('--accent-2', t.accent2);
  set('--accent-contrast', t.accentContrast);
  set('--play', t.play);
  set('--play-contrast', t.playContrast);
  set('--glow', t.glow);
  set('--shadow', t.shadow);
  set('--radius', t.radius);
  set('--radius-sm', t.radiusSm);
  set('--font-body', t.fontBody);
  set('--font-display', t.fontDisplay);
  set('--panel-filter', t.panelFilter);
  set('--header-bg', t.headerBg);
  set('--bevel', t.bevel);
  set('--border-w', borderWidth + 'px');
  // The names from the design brief, for anyone writing new CSS
  set('--bg-app', t.bg);
  set('--bg-card', t.panel);
  set('--text-primary', t.text);
  set('--border-card', t.borderStrong);
  set('--font-family', t.fontBody);
  s.colorScheme = t.scheme;
}
