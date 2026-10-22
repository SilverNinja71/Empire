import { useEffect, useRef, useState } from 'react';
import { Check, Download, Heart, Play, RotateCcw, Upload } from 'lucide-react';
import { useStore } from '../lib/store';
import { navigate } from '../lib/router';
import { applyTokens, customToTokens, DEFAULT_CUSTOM, FONT_CHOICES, sanitizeCustom, type CustomTheme } from '../lib/themes';
import { downloadText, slug } from '../lib/util';
import { Modal } from './ui';
import { EmpireLogo } from './EmpireLogo';

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="ts-row">{label}<input type="color" value={value} onChange={(e) => onChange(e.target.value)} /></label>
  );
}

function Range({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="ts-row">
      <span>{label} <b className="mono" style={{ fontWeight: 500 }}>{value}{unit}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/** Build your own Empire theme, see it live, save it, or share it as a .json file. */
export function ThemeStudioModal() {
  const open = useStore((s) => s.modal === 'theme');
  const saved = useStore((s) => s.customTheme);
  const [t, setT] = useState<CustomTheme>(saved ?? DEFAULT_CUSTOM);
  const [note, setNote] = useState('');
  const preview = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const set = (p: Partial<CustomTheme>) => setT((x) => ({ ...x, ...p }));

  useEffect(() => { if (open) { setT(saved ?? DEFAULT_CUSTOM); setNote(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // The preview gets the theme's variables on its own box, so the rest of the site doesn't change until you apply
  useEffect(() => { if (open && preview.current) applyTokens(preview.current, customToTokens(t), t.borderWidth); }, [t, open]);

  const close = () => {
    useStore.getState().openModal(null);
    if (window.location.hash.startsWith('#/theme-studio')) navigate('/');
  };
  const apply = () => {
    const clean = sanitizeCustom(t);
    useStore.getState().saveCustomTheme(clean);
    useStore.getState().toast(`Theme “${clean.name}” applied`);
    close();
  };
  const importFile = async (f: File) => {
    try {
      if (f.size > 64 * 1024) throw new Error('That file is too big to be a theme.');
      const data = JSON.parse(await f.text());
      setT(sanitizeCustom(data));
      setNote(`Loaded “${f.name}”. Check the preview, then press Apply.`);
    } catch (e) {
      setNote('Couldn’t read that file: ' + (e instanceof SyntaxError ? 'it isn’t valid JSON.' : (e as Error).message));
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="🎨 Theme Studio"
      width={1120}
      footer={
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => file.current?.click()}><Upload size={15} /> Import .json</button>
            <button className="btn" onClick={() => downloadText(`${slug(t.name)}.empire-theme.json`, JSON.stringify(sanitizeCustom(t), null, 2), 'application/json')}><Download size={15} /> Export .json</button>
            <button className="btn ghost" onClick={() => setT(DEFAULT_CUSTOM)}><RotateCcw size={15} /> Reset</button>
            <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importFile(f); }} />
            {note && <span className="muted" style={{ fontSize: 12 }}>{note}</span>}
          </div>
          <button className="btn primary" onClick={apply}><Check size={16} /> Apply theme</button>
        </>
      }
    >
      <div className="ts-grid">
        <div className="ts-controls">
          <label className="field">Theme name<input className="input" value={t.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} /></label>

          <h4>Background</h4>
          <div className="tabs" style={{ justifySelf: 'start' }}>
            {(['solid', 'linear', 'radial', 'image'] as const).map((m) => (
              <button key={m} className={t.bgMode === m ? 'on' : ''} onClick={() => set({ bgMode: m })}>{m === 'solid' ? 'Solid' : m === 'linear' ? 'Linear' : m === 'radial' ? 'Radial' : 'Wallpaper'}</button>
            ))}
          </div>
          <Color label={t.bgMode === 'solid' || t.bgMode === 'image' ? 'Color' : 'First color'} value={t.bgColor} onChange={(v) => set({ bgColor: v })} />
          {(t.bgMode === 'linear' || t.bgMode === 'radial') && <Color label="Second color" value={t.bgColor2} onChange={(v) => set({ bgColor2: v })} />}
          {t.bgMode === 'linear' && <Range label="Angle" value={t.bgAngle} min={0} max={360} unit="°" onChange={(v) => set({ bgAngle: v })} />}
          {t.bgMode === 'image' && (
            <label className="field">Wallpaper picture address <span className="hint">(https://…jpg or .png)</span>
              <input className="input" value={t.bgImageUrl} placeholder="https://example.com/wallpaper.jpg" onChange={(e) => set({ bgImageUrl: e.target.value.trim() })} />
              {t.bgImageUrl && !/^https:\/\/[^\s"'()\\]+$/i.test(t.bgImageUrl) && <span className="bad" style={{ fontWeight: 400 }}>Use a full https:// address with no spaces or quotes.</span>}
            </label>
          )}

          <h4>Cards</h4>
          <Color label="Card color" value={t.cardColor} onChange={(v) => set({ cardColor: v })} />
          <Range label="See-through" value={Math.round((1 - t.cardOpacity) * 100)} min={0} max={80} unit="%" onChange={(v) => set({ cardOpacity: 1 - v / 100 })} />
          <Range label="Background blur" value={t.blur} min={0} max={30} unit="px" onChange={(v) => set({ blur: v })} />
          <Range label="Border width" value={t.borderWidth} min={0} max={6} unit="px" onChange={(v) => set({ borderWidth: v })} />
          <Color label="Border color" value={t.borderColor} onChange={(v) => set({ borderColor: v })} />
          <Range label={t.radius === 0 ? 'Corners (sharp)' : t.radius >= 28 ? 'Corners (pill)' : 'Corners'} value={t.radius} min={0} max={32} unit="px" onChange={(v) => set({ radius: v })} />

          <h4>Text</h4>
          <label className="ts-row">Heading font
            <select className="input" style={{ width: 190, height: 32 }} value={t.headerFont} onChange={(e) => set({ headerFont: e.target.value })}>
              {FONT_CHOICES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <label className="ts-row">Body font
            <select className="input" style={{ width: 190, height: 32 }} value={t.baseFont} onChange={(e) => set({ baseFont: e.target.value })}>
              {FONT_CHOICES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <Color label="Text color" value={t.textColor} onChange={(v) => set({ textColor: v })} />
          <Color label="Accent (buttons, highlights)" value={t.accent} onChange={(v) => set({ accent: v })} />
          <label className="ts-row">Light or dark page
            <span className="tabs">
              <button className={t.scheme === 'dark' ? 'on' : ''} onClick={() => set({ scheme: 'dark' })}>Dark</button>
              <button className={t.scheme === 'light' ? 'on' : ''} onClick={() => set({ scheme: 'light' })}>Light</button>
            </span>
          </label>

          <h4>Empire logo</h4>
          <Color label="Letter color" value={t.logoColor} onChange={(v) => set({ logoColor: v })} />
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>The orange in the P and the leaf on the i always keep their own colors.</p>
        </div>

        <div className="ts-preview" ref={preview} data-deco="custom">
          <div className="bar">
            <EmpireLogo fontColor={t.logoColor} size={28} />
            <span className="pill on">Store</span>
            <span className="pill">Forum</span>
            <span className="pill">Library</span>
            <span style={{ flex: 1 }} />
            <button className="btn primary small">+ Add a Game</button>
          </div>
          <div className="body">
            <h2 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: 26 }}>Popular this week</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="chip on">All</span><span className="chip">Racing</span><span className="chip">Adventure</span><span className="chip">3D</span>
            </div>
            <article className="card" style={{ position: 'relative' }}>
              <div className="cover" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.borderColor})`, display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 28 }}>
                Sample Game
                <div className="tl" style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4 }}><span className="badge free">Free</span><span className="badge accent">New</span></div>
              </div>
              <div className="body">
                <h3 style={{ fontFamily: 'var(--font-display)' }}>Sample Game</h3>
                <div className="tags"><span>Action</span><span>3D</span><span>Multiplayer</span></div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn play small"><Play size={14} fill="currentColor" /> Play</button>
                  <button className="btn small"><Heart size={14} /> Wishlist</button>
                </div>
              </div>
            </article>
            <div className="panel" style={{ padding: 14, maxWidth: 420 }}>
              <b>A panel</b>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>Forum posts, your library and settings use panels like this one.</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
