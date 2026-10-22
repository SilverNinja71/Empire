import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, CircleAlert, CircleCheck, Copy, Download, FileCode, GitBranch, Globe, ImagePlus, Link as LinkIcon, Play, RotateCw, Upload, X } from 'lucide-react';
import type { DeployType, Engine, Game, Mode, Platform } from '../lib/types';
import { ENGINES } from '../lib/types';
import { useAllGames, useStore } from '../lib/store';
import { useAccount } from '../lib/account';
import { navigate } from '../lib/router';
import { toXml, validateGameXml, type Issue } from '../lib/xml';
import { downloadText, isHttpUrl, shrinkImage, slug } from '../lib/util';
import { Modal } from '../components/ui';
import { Cover } from '../components/Cover';

type Source = 'git' | 'xml' | 'link';
type Kind = 'unity' | 'godot' | 'itch' | 'firebase' | 'webgl';

const KINDS: { id: Kind; label: string; engine: Engine; type: DeployType; hint: string }[] = [
  { id: 'unity', label: 'Unity WebGL build', engine: 'Unity', type: 'webgl', hint: 'The index.html of a Unity WebGL build' },
  { id: 'godot', label: 'Godot HTML5 export', engine: 'Godot', type: 'html5', hint: 'The .html file Godot exported' },
  { id: 'itch', label: 'itch.io embed', engine: 'Custom', type: 'iframe', hint: 'From itch.io: Distribute → Embed game → copy the src link' },
  { id: 'firebase', label: 'Firebase Hosting', engine: 'Custom', type: 'iframe', hint: 'Direct URL to a Firebase-hosted game (e.g. https://your-project.web.app or .firebaseapp.com)' },
  { id: 'webgl', label: 'Custom WebGL / HTML5', engine: 'ThreeJS', type: 'webgl', hint: 'Any page that runs the game' },
];

interface Draft {
  title: string;
  author: string;
  version: string;
  engine: Engine;
  type: DeployType;
  description: string;
  sourceUrl: string;
  repository: string;
  tags: string[];
  modes: Mode[];
  platforms: Platform[];
  cover?: string;
  screenshots: string[];
  minSpecs: string;
  controls: string;
}

/** github.com/owner/repo → owner and repo (GitLab too) */
export function parseRepo(url: string): { host: 'github' | 'gitlab'; owner: string; repo: string } | null {
  const m = url.trim().match(/^(?:https?:\/\/)?(?:www\.)?(github\.com|gitlab\.com)\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?(?:[#?].*)?$/i);
  if (!m) return null;
  return { host: m[1].toLowerCase().startsWith('github') ? 'github' : 'gitlab', owner: m[2], repo: m[3] };
}

/** The GitHub/GitLab Pages address a repo publishes to */
export function pagesUrl(r: NonNullable<ReturnType<typeof parseRepo>>) {
  const owner = r.owner.toLowerCase();
  if (r.host === 'github') return r.repo.toLowerCase() === `${owner}.github.io` ? `https://${owner}.github.io/` : `https://${owner}.github.io/${r.repo}/`;
  return `https://${owner}.gitlab.io/${r.repo}/`;
}

/** Firebase Hosting serves sites at <project>.web.app and <project>.firebaseapp.com */
export const isFirebaseUrl = (url: string) => /^https?:\/\/[a-z0-9-]+\.(web\.app|firebaseapp\.com)(?::\d+)?(?:[/?#]|$)/i.test(url.trim());

/** Sandbox for the test window. Firebase games may open sign-in popups (Firebase Auth), so they also get allow-popups. */
export const sandboxFor = (url: string) =>
  'allow-scripts allow-same-origin allow-pointer-lock allow-forms' + (isFirebaseUrl(url) ? ' allow-popups allow-popups-to-escape-sandbox' : '');

const titleCase = (s: string) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function IssueList({ issues, okText }: { issues: Issue[]; okText: string }) {
  if (!issues.length) return <div className="ok" style={{ display: 'flex', gap: 8, fontSize: 13 }}><CircleCheck size={16} /> {okText}</div>;
  return (
    <div className="check-list">
      {issues.map((i, k) => (
        <div key={k} className={i.level === 'error' ? 'bad' : 'warn'}>
          {i.level === 'error' ? <CircleAlert size={15} style={{ flex: 'none', marginTop: 2 }} /> : <AlertTriangle size={15} style={{ flex: 'none', marginTop: 2 }} />}
          <span>{i.message}</span>
        </div>
      ))}
    </div>
  );
}

export default function AddGameModal() {
  const [acc] = useAccount();
  const games = useAllGames();
  const { addLocalGame, log, notify, toast, openModal } = useStore.getState();
  const close = () => openModal(null);

  const [step, setStep] = useState(0);
  const [source, setSource] = useState<Source>('git');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [kind, setKind] = useState<Kind>('webgl');
  const [linkUrl, setLinkUrl] = useState('');
  const [xmlText, setXmlText] = useState('');
  const [xmlName, setXmlName] = useState('');
  const [note, setNote] = useState('');
  const [over, setOver] = useState(false);
  const [d, setD] = useState<Draft>({
    title: '', author: acc.username === 'Guest' ? '' : acc.username, version: '0.1.0', engine: 'ThreeJS', type: 'webgl', description: '',
    sourceUrl: '', repository: '', tags: [], modes: ['singleplayer'], platforms: ['desktop'], screenshots: [], minSpecs: '', controls: '',
  });
  const [tagInput, setTagInput] = useState('');
  const [editedXml, setEditedXml] = useState<string | null>(null);
  const [sandbox, setSandbox] = useState<'idle' | 'loading' | 'loaded'>('idle');
  const [sandboxKey, setSandboxKey] = useState(0);
  const [tested, setTested] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  const repo = parseRepo(repoUrl);
  const xmlCheck = useMemo(() => (xmlText ? validateGameXml(xmlText) : null), [xmlText]);

  // Step 1 → fill the draft from the chosen source
  const applySource = () => {
    if (source === 'git' && repo) {
      set({
        repository: `https://${repo.host === 'github' ? 'github.com' : 'gitlab.com'}/${repo.owner}/${repo.repo}`,
        sourceUrl: d.sourceUrl || pagesUrl(repo),
        title: d.title || titleCase(repo.repo),
        author: d.author || repo.owner,
      });
    }
    if (source === 'link') {
      const k = KINDS.find((x) => x.id === kind)!;
      set({ sourceUrl: linkUrl.trim(), engine: k.engine, type: k.type });
    }
    if (source === 'xml' && xmlCheck?.game) {
      const g = xmlCheck.game;
      set({
        title: g.title, author: g.author, version: g.version, engine: g.engine, type: g.type, description: g.description, sourceUrl: g.sourceUrl,
        repository: g.repository ?? '', tags: g.tags, modes: g.modes, platforms: g.platforms, cover: g.cover, screenshots: g.screenshots,
        minSpecs: g.minSpecs ?? '', controls: g.controls ?? '',
      });
    }
    setStep(1);
  };

  // GitHub's public API fills in a public repo's description and topics
  const fetchRepoInfo = async () => {
    if (!repo || repo.host !== 'github') return;
    setNote('Looking up the repo…');
    try {
      const r = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}`);
      if (!r.ok) throw new Error(r.status === 404 ? 'Repo not found (is it public?)' : 'GitHub said ' + r.status);
      const j = await r.json();
      set({
        title: d.title || titleCase(String(j.name)),
        description: d.description || j.description || '',
        tags: d.tags.length ? d.tags : (j.topics || []).slice(0, 6).map((t: string) => titleCase(t)),
        sourceUrl: j.homepage && isHttpUrl(j.homepage) ? j.homepage : d.sourceUrl || pagesUrl(repo),
        author: d.author || j.owner?.login || repo.owner,
      });
      if (j.default_branch && branch === 'main') setBranch(j.default_branch);
      setNote(`Found “${j.full_name}”${j.has_pages ? ', with GitHub Pages turned on' : '. GitHub Pages looks off, so the launch link may not work yet'}.`);
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  const readXmlFile = async (f: File) => {
    if (f.size > 512 * 1024) return setNote('That file is bigger than 512 KB. It doesn’t look like game details.');
    setXmlName(f.name);
    setXmlText(await f.text());
  };

  const id = useMemo(() => {
    const base = slug(d.title || 'my-game');
    const taken = new Set(games.filter((g) => g.origin !== 'local').map((g) => g.id));
    let out = base;
    for (let n = 2; taken.has(out); n++) out = `${base}-${n}`;
    return out;
  }, [d.title, games]);

  const draftGame: Game = { id, ...d, repository: d.repository || undefined, minSpecs: d.minSpecs || undefined, controls: d.controls || undefined, origin: 'local', addedAt: Date.now() };
  const generatedXml = toXml(draftGame);
  const xml = editedXml ?? generatedXml;
  const finalCheck = useMemo(() => validateGameXml(xml), [xml]);

  // Editing the XML by hand updates the details when it's valid
  useEffect(() => {
    if (editedXml == null || !finalCheck.game) return;
    const g = finalCheck.game;
    setD((x) => ({ ...x, title: g.title, author: g.author, version: g.version, engine: g.engine, type: g.type, description: g.description, sourceUrl: g.sourceUrl, repository: g.repository ?? '', tags: g.tags, modes: g.modes, platforms: g.platforms, minSpecs: g.minSpecs ?? '', controls: g.controls ?? '' }));
  }, [editedXml, finalCheck.game]);

  const step1Ok = source === 'git' ? !!repo : source === 'link' ? isHttpUrl(linkUrl.trim()) : !!xmlCheck?.game;
  const step2Issues: string[] = [];
  if (!d.title.trim()) step2Issues.push('Give it a title.');
  if (!d.author.trim()) step2Issues.push('Who made it?');
  if (!isHttpUrl(d.sourceUrl) && !d.sourceUrl.startsWith('../')) step2Issues.push('The launch link must be a web address (https://…).');
  const canTest = isHttpUrl(d.sourceUrl) || d.sourceUrl.startsWith('../');

  const publish = () => {
    if (!finalCheck.game) return;
    const g: Game = { ...finalCheck.game, id, cover: d.cover, screenshots: d.screenshots, origin: 'local', addedAt: Date.now() };
    addLocalGame(g);
    log('added', `Added ${g.title} to Empire`, { gameId: g.id });
    notify(`${g.title} is in your store. To share it with everyone, add its XML to games.xml.`, `#/game/${g.id}`);
    toast(`${g.title} added!`);
    close();
    navigate(`/game/${g.id}`);
  };

  const addTag = (t: string) => {
    const v = t.trim().replace(/,$/, '');
    if (v && !d.tags.includes(v) && d.tags.length < 8) set({ tags: [...d.tags, v] });
    setTagInput('');
  };
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const STEPS = ['Source', 'Details & media', 'Check & preview'];

  const footer = (
    <>
      <button className="btn ghost" onClick={() => (step ? setStep(step - 1) : close())}>{step ? 'Back' : 'Cancel'}</button>
      {step === 0 && <button className="btn primary" disabled={!step1Ok} onClick={applySource}>Next</button>}
      {step === 1 && <button className="btn primary" disabled={step2Issues.length > 0} onClick={() => { setEditedXml(null); setStep(2); }}>Next: check it</button>}
      {step === 2 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!tested && <span className="muted" style={{ fontSize: 12 }}>Tip: launch the test first</span>}
          <button className="btn play" disabled={!finalCheck.game} onClick={publish}><Check size={16} /> Add to Empire</button>
        </div>
      )}
    </>
  );

  return (
    <Modal
      open
      onClose={close}
      title="Add a Game"
      width={900}
      footer={footer}
      steps={
        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s} className={(i === step ? 'on' : '') + (i < step ? ' done' : '')}><span>{i < step ? <Check size={14} /> : i + 1}</span>{s}</div>
          ))}
        </div>
      }
    >
      {step === 0 && (
        <>
          <div className="source-tabs">
            <button className={source === 'git' ? 'on' : ''} onClick={() => setSource('git')}>
              <b><GitBranch size={18} /> Git repository</b>
              <small>A GitHub or GitLab repo that publishes the game</small>
            </button>
            <button className={source === 'xml' ? 'on' : ''} onClick={() => setSource('xml')}>
              <b><FileCode size={18} /> XML upload</b>
              <small>An Empire .xml file with the game’s details</small>
            </button>
            <button className={source === 'link' ? 'on' : ''} onClick={() => setSource('link')}>
              <b><Globe size={18} /> Web build link</b>
              <small>Unity WebGL, Godot HTML5, itch.io or any web page</small>
            </button>
          </div>

          {source === 'git' && (
            <div className="form-grid">
              <label className="field full">Repository address
                <input className="input" placeholder="https://github.com/you/your-game" value={repoUrl} onChange={(e) => { setRepoUrl(e.target.value); setNote(''); }} />
                {repoUrl && !repo && <span className="bad" style={{ fontWeight: 400 }}>That doesn’t look like a github.com or gitlab.com repo address.</span>}
              </label>
              <label className="field">Branch or tag
                <input className="input" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
                <span className="hint">The one your Pages site publishes from</span>
              </label>
              <label className="field">Launch link
                <input className="input" value={repo ? d.sourceUrl || pagesUrl(repo) : ''} disabled={!repo} onChange={(e) => set({ sourceUrl: e.target.value })} />
                <span className="hint">Guessed from the repo; change it if the game lives somewhere else</span>
              </label>
              {repo?.host === 'github' && (
                <div className="full" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn small" onClick={fetchRepoInfo}><RotateCw size={14} /> Fill in from GitHub</button>
                  <span className="muted" style={{ fontSize: 13 }}>{note || 'Reads the public repo’s description and topics.'}</span>
                </div>
              )}
            </div>
          )}

          {source === 'xml' && (
            <div style={{ display: 'grid', gap: 12 }}>
              <div
                className={'drop' + (over ? ' over' : '')}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) readXmlFile(f); }}
              >
                <Upload size={28} />
                <div style={{ marginTop: 8 }}><b>Drop an .xml file here</b> or click to pick one</div>
                {xmlName && <div style={{ marginTop: 6 }}>Loaded <b>{xmlName}</b></div>}
                <input ref={fileRef} type="file" accept=".xml,application/xml,text/xml" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) readXmlFile(f); e.target.value = ''; }} />
              </div>
              {note && <span className="warn" style={{ fontSize: 13 }}>{note}</span>}
              <label className="field">…or paste it
                <textarea className="input mono" rows={8} value={xmlText} onChange={(e) => { setXmlText(e.target.value); setXmlName(''); }} placeholder={'<empireGame version="1.0">\n  <metadata>…</metadata>\n</empireGame>'} />
              </label>
              {xmlCheck && <IssueList issues={xmlCheck.issues} okText="Looks good: valid Empire XML." />}
            </div>
          )}

          {source === 'link' && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {KINDS.map((k) => <button key={k.id} className={'chip' + (kind === k.id ? ' on' : '')} onClick={() => setKind(k.id)}>{k.label}</button>)}
              </div>
              <label className="field">Address of the game
                <input className="input" placeholder={kind === 'itch' ? 'https://itch.io/embed-upload/1234567' : kind === 'firebase' ? 'https://your-project.web.app' : 'https://cdn.example.com/games/my-game/index.html'} value={linkUrl} onChange={(e) => { setLinkUrl(e.target.value); if (isFirebaseUrl(e.target.value)) setKind('firebase'); }} />
                <span className="hint">{KINDS.find((k) => k.id === kind)!.hint}</span>
                {linkUrl && !isHttpUrl(linkUrl.trim()) && <span className="bad" style={{ fontWeight: 400 }}>Use a full web address starting with https://</span>}
                {isFirebaseUrl(linkUrl) && <span className="ok" style={{ fontWeight: 400, display: 'flex', gap: 6, alignItems: 'center' }}><CircleCheck size={14} /> Firebase Hosting detected: the test window allows its sign-in popups.</span>}
                {kind === 'firebase' && linkUrl && isHttpUrl(linkUrl.trim()) && !isFirebaseUrl(linkUrl) && <span className="warn" style={{ fontWeight: 400 }}>This doesn’t look like a Firebase address (…web.app or …firebaseapp.com). It will still work if it’s a web game.</span>}
              </label>
            </div>
          )}
        </>
      )}

      {step === 1 && (
        <div className="form-grid">
          <label className="field">Title
            <input className="input" value={d.title} maxLength={60} onChange={(e) => set({ title: e.target.value })} />
          </label>
          <label className="field">Developer
            <input className="input" value={d.author} maxLength={40} onChange={(e) => set({ author: e.target.value })} />
          </label>
          <label className="field full">Description
            <textarea className="input" rows={3} maxLength={400} value={d.description} placeholder="One or two sentences: what do you do in this game?" onChange={(e) => set({ description: e.target.value })} />
          </label>
          <label className="field">Engine
            <select className="input" value={d.engine} onChange={(e) => set({ engine: e.target.value as Engine })}>
              {ENGINES.map((e) => <option key={e} value={e}>{e === 'ThreeJS' ? 'Three.js / WebGL' : e}</option>)}
            </select>
          </label>
          <label className="field">Release version
            <input className="input" value={d.version} onChange={(e) => set({ version: e.target.value })} placeholder="1.0.0" />
          </label>
          <label className="field full">Launch link
            <input className="input" value={d.sourceUrl} onChange={(e) => set({ sourceUrl: e.target.value })} />
            {isFirebaseUrl(d.sourceUrl) && <span className="hint">Firebase Hosting</span>}
          </label>
          <div className="field full">Genre tags <span className="hint">(press Enter after each; up to 8)</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {d.tags.map((t) => <button key={t} className="chip on" onClick={() => set({ tags: d.tags.filter((x) => x !== t) })}>{t} <X size={12} /></button>)}
              <input className="input" style={{ width: 200, height: 32 }} value={tagInput} placeholder="Action, 3D, Puzzle…" onChange={(e) => (e.target.value.endsWith(',') ? addTag(e.target.value) : setTagInput(e.target.value))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Action', 'Adventure', 'Puzzle', 'Racing', 'Sports', 'Strategy', '2D', '3D', 'Multiplayer'].filter((t) => !d.tags.includes(t)).map((t) => (
                <button key={t} className="chip" style={{ height: 26, fontSize: 12 }} onClick={() => addTag(t)}>+ {t}</button>
              ))}
            </div>
          </div>
          <div className="field">Players
            <div style={{ display: 'flex', gap: 6 }}>
              {(['singleplayer', 'multiplayer'] as Mode[]).map((m) => <button key={m} className={'chip' + (d.modes.includes(m) ? ' on' : '')} onClick={() => { const n = toggle(d.modes, m); if (n.length) set({ modes: n }); }}>{m === 'singleplayer' ? 'Single-player' : 'Multiplayer'}</button>)}
            </div>
          </div>
          <div className="field">Works on
            <div style={{ display: 'flex', gap: 6 }}>
              {(['desktop', 'mobile'] as Platform[]).map((p) => <button key={p} className={'chip' + (d.platforms.includes(p) ? ' on' : '')} onClick={() => { const n = toggle(d.platforms, p); if (n.length) set({ platforms: n }); }}>{p === 'desktop' ? 'Desktop' : 'Phone & tablet'}</button>)}
            </div>
          </div>
          <label className="field">Minimum specs <span className="hint">(optional)</span>
            <input className="input" value={d.minSpecs} placeholder="Any laptop from 2018, WebGL 2" onChange={(e) => set({ minSpecs: e.target.value })} />
          </label>
          <label className="field">Controls <span className="hint">(optional)</span>
            <input className="input" value={d.controls} placeholder="WASD to move, Space to jump" onChange={(e) => set({ controls: e.target.value })} />
          </label>
          <div className="field full">Cover banner & screenshots <span className="hint">(pictures are shrunk and kept in this browser)</span>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <MediaSlot label="Cover" game={draftGame} src={d.cover} onPick={(src) => set({ cover: src })} />
              {[0, 1, 2].map((i) => (
                <MediaSlot key={i} label={`Shot ${i + 1}`} game={draftGame} src={d.screenshots[i]} onPick={(src) => { const s = d.screenshots.slice(); if (src) s[i] = src; else s.splice(i, 1); set({ screenshots: s.filter(Boolean) }); }} />
              ))}
            </div>
          </div>
          {step2Issues.length > 0 && <div className="full warn" style={{ fontSize: 13 }}>{step2Issues.join(' ')}</div>}
        </div>
      )}

      {step === 2 && (
        <div className="form-grid" style={{ gap: 18 }}>
          <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b>Empire XML</b>
              <div style={{ display: 'flex', gap: 6 }}>
                {editedXml != null && <button className="btn small ghost" onClick={() => setEditedXml(null)}>Reset</button>}
                <button className="btn small" onClick={() => { navigator.clipboard?.writeText(xml); toast('XML copied'); }}><Copy size={13} /> Copy</button>
                <button className="btn small" onClick={() => downloadText(`${id}.xml`, xml)}><Download size={13} /> .xml</button>
              </div>
            </div>
            <textarea className="input mono" rows={16} style={{ fontSize: 12 }} value={xml} spellCheck={false} onChange={(e) => setEditedXml(e.target.value)} aria-label="Game XML" />
            <IssueList issues={finalCheck.issues} okText="Valid Empire XML. Ready to add." />
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              “Add to Empire” keeps the game in this browser. To put it in the store for everyone, paste this XML into <code>games.xml</code> in the Empire repo.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
            <b>Test it before posting</b>
            <div className="sandbox">
              {sandbox === 'idle' ? (
                <div className="idle">
                  <div>
                    <p style={{ marginTop: 0 }}>Runs the game here, in a sandbox, so you can check it starts.</p>
                    <button className="btn play" disabled={!canTest} onClick={() => { setSandbox('loading'); setTested(true); }}><Play size={15} fill="currentColor" /> Launch test</button>
                  </div>
                </div>
              ) : (
                <iframe
                  key={sandboxKey}
                  src={d.sourceUrl}
                  title="Game test"
                  sandbox={sandboxFor(d.sourceUrl)}
                  allow="fullscreen; gamepad; autoplay"
                  onLoad={() => setSandbox('loaded')}
                />
              )}
            </div>
            {sandbox !== 'idle' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <span className={sandbox === 'loaded' ? 'ok' : 'muted'}>{sandbox === 'loaded' ? 'The page loaded. Does the game show and respond?' : 'Loading…'}</span>
                <button className="btn small" style={{ marginLeft: 'auto' }} onClick={() => { setSandbox('loading'); setSandboxKey((k) => k + 1); }}><RotateCw size={13} /> Reload</button>
                <a className="btn small" href={d.sourceUrl} target="_blank" rel="noopener noreferrer"><LinkIcon size={13} /> Open</a>
              </div>
            )}
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>A blank or “refused to connect” box means that site blocks being shown inside other pages. It can still work when opened directly.</p>
            <div style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <Cover game={draftGame} />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function MediaSlot({ label, src, game, onPick }: { label: string; src?: string; game: Game; onPick: (src: string | undefined) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  return (
    <div style={{ width: 150 }}>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        style={{ position: 'relative', width: 150, aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', border: '1px dashed var(--border-strong)', background: 'var(--panel-2)', cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center' }}
        aria-label={`Pick ${label}`}
      >
        {src ? <Cover game={game} src={src} showTitle={false} /> : <span className="muted" style={{ display: 'grid', placeItems: 'center', gap: 2, fontSize: 12 }}><ImagePlus size={18} />{label}</span>}
      </button>
      {src && <button className="btn small ghost" style={{ width: '100%' }} onClick={() => onPick(undefined)}>Remove</button>}
      {err && <div className="bad" style={{ fontSize: 11 }}>{err}</div>}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            setErr('');
            onPick(await shrinkImage(f, label === 'Cover' ? 960 : 640));
          } catch (x) {
            setErr((x as Error).message);
          }
        }}
      />
    </div>
  );
}
