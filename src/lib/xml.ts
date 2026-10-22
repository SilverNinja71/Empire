import { DEPLOY_TYPES, ENGINES, type DeployType, type Engine, type Game, type Mode, type Platform } from './types';
import { isHttpUrl, slug } from './util';

/**
 * The Empire game format:
 *
 * <empireGame version="1.0">
 *   <metadata> title, author, version, engine (Unity | Godot | ThreeJS | Custom), description </metadata>
 *   <deployment> type (webgl | html5 | iframe | studio), sourceUrl, repository </deployment>
 *   <tags> <tag>…</tag> </tags>
 *   <media> cover, screenshot… </media>              (optional)
 *   <details> modes, platforms, players, controls,   (optional)
 *             minSpecs, released, updated, rank, featured, icon, palette </details>
 * </empireGame>
 *
 * games.xml wraps several of them in <empireCatalog>.
 */

export interface Issue {
  level: 'error' | 'warning';
  message: string;
}

export interface ParseResult {
  game: Game | null;
  issues: Issue[];
}

const text = (el: Element | null | undefined, sel: string) => el?.querySelector(sel)?.textContent?.trim() ?? '';

function parseXml(src: string): { doc: Document | null; error: string | null } {
  const doc = new DOMParser().parseFromString(src, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) {
    // Browsers put a human message (with line and column) inside <parsererror>
    const msg = (err.textContent || 'The XML could not be read.')
      .replace(/\s+/g, ' ')
      .replace(/Below is a rendering of the page.*$/i, '')
      .replace(/^This page contains the following errors:\s*/i, '')
      .trim();
    return { doc: null, error: msg.slice(0, 240) };
  }
  return { doc, error: null };
}

/** Read one <empireGame> element. */
export function readGame(el: Element, origin: Game['origin'] = 'catalog'): ParseResult {
  const issues: Issue[] = [];
  const err = (message: string) => issues.push({ level: 'error', message });
  const warn = (message: string) => issues.push({ level: 'warning', message });

  if (el.tagName !== 'empireGame') err(`The top element must be <empireGame>, not <${el.tagName}>.`);
  const ver = el.getAttribute('version');
  if (!ver) warn('<empireGame> has no version attribute (use version="1.0").');
  else if (ver !== '1.0') warn(`Schema version ${ver} is newer than this reader (1.0). Some fields may be ignored.`);

  const meta = el.querySelector(':scope > metadata');
  const dep = el.querySelector(':scope > deployment');
  if (!meta) err('Missing <metadata>.');
  if (!dep) err('Missing <deployment>.');

  const title = text(meta, 'title');
  const author = text(meta, 'author');
  const version = text(meta, 'version') || '0.1.0';
  const engineRaw = text(meta, 'engine');
  const description = text(meta, 'description');
  if (meta && !title) err('<metadata> needs a <title>.');
  if (meta && !author) err('<metadata> needs an <author>.');
  if (meta && !text(meta, 'version')) warn('No <version> given, so 0.1.0 is assumed.');
  else if (meta && !/^\d+(\.\d+){0,3}([-+][\w.]+)?$/.test(version)) warn(`Version "${version}" doesn't look like 1.2.3.`);
  const engine = (ENGINES.find((e) => e.toLowerCase() === engineRaw.toLowerCase()) ?? 'Custom') as Engine;
  if (meta && !engineRaw) warn('No <engine> given, so Custom is assumed.');
  else if (meta && !ENGINES.some((e) => e.toLowerCase() === engineRaw.toLowerCase())) err(`<engine> must be one of ${ENGINES.join(', ')} (got "${engineRaw}").`);
  if (meta && !description) warn('<description> is empty. A sentence or two helps players pick your game.');

  const typeRaw = (text(dep, 'type') || 'webgl').toLowerCase();
  const type = (DEPLOY_TYPES.includes(typeRaw as DeployType) ? typeRaw : 'webgl') as DeployType;
  if (dep && !DEPLOY_TYPES.includes(typeRaw as DeployType)) err(`<type> must be one of ${DEPLOY_TYPES.join(', ')} (got "${typeRaw}").`);
  const sourceUrl = text(dep, 'sourceUrl');
  const repository = text(dep, 'repository');
  if (dep && !sourceUrl) err('<deployment> needs a <sourceUrl>: the address that launches the game.');
  else if (dep && type !== 'studio' && !isHttpUrl(sourceUrl) && !sourceUrl.startsWith('../') && !sourceUrl.startsWith('/')) err(`<sourceUrl> "${sourceUrl}" isn't a web address (it should start with https://).`);
  else if (dep && sourceUrl.startsWith('http://')) warn('<sourceUrl> uses http://. Most browsers block http:// games inside an https:// site, so use https://.');
  if (repository && !isHttpUrl(repository)) err(`<repository> "${repository}" isn't a web address.`);

  const tags = Array.from(el.querySelectorAll(':scope > tags > tag')).map((t) => t.textContent?.trim() ?? '').filter(Boolean);
  if (!tags.length) warn('No <tags>. Tags like 3D, Action or Puzzle put your game in the right shelves.');

  const media = el.querySelector(':scope > media');
  const det = el.querySelector(':scope > details');
  const list = (s: string) => s.split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const modes = list(text(det, 'modes')).filter((m): m is Mode => m === 'singleplayer' || m === 'multiplayer');
  const platforms = list(text(det, 'platforms')).filter((p): p is Platform => p === 'desktop' || p === 'mobile');
  const pal = list(text(det, 'palette'));

  const game: Game = {
    id: el.getAttribute('id') || slug(title || 'game'),
    title: title || 'Untitled game',
    author: author || 'Unknown',
    version,
    engine,
    description,
    type,
    sourceUrl,
    repository: repository || undefined,
    tags,
    cover: text(media, 'cover') || undefined,
    screenshots: Array.from(media?.querySelectorAll('screenshot') ?? []).map((s) => s.textContent?.trim() ?? '').filter(Boolean),
    modes: modes.length ? modes : ['singleplayer'],
    platforms: platforms.length ? platforms : ['desktop'],
    players: text(det, 'players') || undefined,
    controls: text(det, 'controls') || undefined,
    minSpecs: text(det, 'minSpecs') || undefined,
    released: text(det, 'released') || undefined,
    updated: text(det, 'updated') || undefined,
    rank: Number(text(det, 'rank')) || undefined,
    featured: text(det, 'featured') === 'true',
    icon: text(det, 'icon') || undefined,
    palette: pal.length >= 2 ? [pal[0], pal[1]] : undefined,
    origin,
  };
  return { game: issues.some((i) => i.level === 'error') ? null : game, issues };
}

/** Check pasted or uploaded XML for one game. */
export function validateGameXml(src: string): ParseResult {
  if (!src.trim()) return { game: null, issues: [{ level: 'error', message: 'The XML is empty.' }] };
  const { doc, error } = parseXml(src);
  if (!doc) return { game: null, issues: [{ level: 'error', message: 'XML syntax: ' + error }] };
  const root = doc.documentElement;
  if (root.tagName === 'empireCatalog') {
    const first = root.querySelector('empireGame');
    if (!first) return { game: null, issues: [{ level: 'error', message: '<empireCatalog> has no <empireGame> inside.' }] };
    const r = readGame(first, 'local');
    r.issues.unshift({ level: 'warning', message: 'This is a whole catalog. Only the first game was read.' });
    return r;
  }
  return readGame(root, 'local');
}

/** Read games.xml. Broken entries are skipped (and reported in the console). */
export function parseCatalog(src: string): Game[] {
  const { doc, error } = parseXml(src);
  if (!doc) throw new Error('games.xml: ' + error);
  const out: Game[] = [];
  doc.querySelectorAll('empireGame').forEach((el) => {
    const r = readGame(el, 'catalog');
    if (r.game) out.push(r.game);
    else console.warn('games.xml: skipped a game', r.issues);
  });
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Write a game back out as <empireGame> XML. */
export function toXml(g: Partial<Game>, opts: { media?: boolean } = {}): string {
  const line = (tag: string, v?: string, pad = '    ') => (v ? `${pad}<${tag}>${esc(v)}</${tag}>\n` : '');
  let s = `<empireGame version="1.0"${g.id ? ` id="${esc(g.id)}"` : ''}>\n`;
  s += '  <metadata>\n';
  s += line('title', g.title || 'Untitled game');
  s += line('author', g.author || 'Unknown');
  s += line('version', g.version || '0.1.0');
  s += `    <engine>${esc(g.engine || 'Custom')}</engine> <!-- Unity | Godot | ThreeJS | Custom -->\n`;
  s += line('description', g.description);
  s += '  </metadata>\n  <deployment>\n';
  s += line('type', g.type || 'webgl');
  s += line('sourceUrl', g.sourceUrl);
  s += line('repository', g.repository);
  s += '  </deployment>\n  <tags>\n';
  for (const t of g.tags ?? []) s += line('tag', t);
  s += '  </tags>\n';
  const shots = (g.screenshots ?? []).filter((x) => !x.startsWith('data:'));
  const cover = g.cover && !g.cover.startsWith('data:') ? g.cover : '';
  if (opts.media !== false && (cover || shots.length)) {
    s += '  <media>\n' + line('cover', cover);
    for (const x of shots) s += line('screenshot', x);
    s += '  </media>\n';
  }
  const det =
    line('modes', g.modes?.join(',')) + line('platforms', g.platforms?.join(',')) + line('players', g.players) +
    line('controls', g.controls) + line('minSpecs', g.minSpecs) + line('released', g.released);
  if (det) s += '  <details>\n' + det + '  </details>\n';
  return s + '</empireGame>\n';
}
