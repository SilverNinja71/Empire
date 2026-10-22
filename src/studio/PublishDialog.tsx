import { useEffect, useState } from 'react';
import { Copy, Rocket, X } from 'lucide-react';
import type { Game } from '../lib/types';
import { useStore } from '../lib/store';
import { useAccount } from '../lib/account';
import { navigate } from '../lib/router';
import { shrinkImage } from '../lib/util';
import { toXml } from '../lib/xml';
import { Modal } from '../components/ui';
import { Cover } from '../components/Cover';

const SUGGESTED = ['Adventure', 'Exploration', 'Platformer', 'Puzzle', 'Collectathon', 'Relaxing', 'Speedrun'];

/** "Publish to Empire": turn a studio project into a game in the store (kept in this browser). */
export function PublishDialog({ kind, projectName, projectId, publishedId, capture, onClose, onPublished }: {
  kind: '2d' | '3d';
  projectName: string;
  projectId: string;
  publishedId?: string;
  capture: () => string | null;
  onClose: () => void;
  onPublished: (gameId: string) => void;
}) {
  const [acc] = useAccount();
  const localGames = useStore((s) => s.localGames);
  const prev = publishedId ? localGames.find((g) => g.id === publishedId) : undefined;
  const [title, setTitle] = useState(prev?.title ?? projectName);
  const [description, setDescription] = useState(prev?.description ?? '');
  const [tags, setTags] = useState<string[]>(prev?.tags.filter((t) => t !== '2D' && t !== '3D') ?? ['Adventure']);
  const [cover, setCover] = useState<string | undefined>(prev?.cover);
  const id = publishedId ?? 'studio-' + projectId;

  useEffect(() => {
    // Take the picture of what's on screen right now
    const shot = capture();
    if (shot) shrinkImage(shot, 960, 0.82).then(setCover).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const game: Game = {
    id,
    title: title.trim() || 'Untitled world',
    author: acc.username,
    version: prev ? bump(prev.version) : '1.0.0',
    engine: kind === '3d' ? 'ThreeJS' : 'Custom',
    description: description.trim() || (kind === '3d' ? 'A 3D world made in Empire Studio.' : 'A 2D pixel adventure made in Empire Studio.'),
    type: 'studio',
    sourceUrl: '#/play/' + id,
    tags: [kind === '3d' ? '3D' : '2D', ...tags],
    cover,
    screenshots: [],
    modes: ['singleplayer'],
    platforms: kind === '3d' ? ['desktop'] : ['desktop'],
    origin: 'studio',
    addedAt: prev?.addedAt ?? Date.now(),
    released: new Date().toISOString().slice(0, 10),
  };

  const publish = () => {
    const s = useStore.getState();
    s.addLocalGame(game);
    s.log('published', `${prev ? 'Updated' : 'Published'} ${game.title}`, { gameId: id });
    s.notify(`${game.title} is ${prev ? 'updated' : 'live'} in your Empire store, under Community Gems.`, `#/game/${id}`);
    s.toast(prev ? 'Updated!' : 'Published! 🎉');
    onPublished(id);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={prev ? 'Update your game' : 'Publish to Empire'}
      width={720}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => { navigator.clipboard?.writeText(toXml(game)); useStore.getState().toast('XML copied'); }}><Copy size={15} /> Copy XML</button>
            <button className="btn primary" onClick={() => { publish(); }}><Rocket size={15} /> {prev ? 'Update' : 'Publish'}</button>
            {prev && <button className="btn play" onClick={() => { publish(); navigate(`/game/${id}`); }}>Update & view</button>}
          </div>
        </>
      }
    >
      <div className="form-grid">
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <label className="field">Game title
            <input className="input" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">Description
            <textarea className="input" rows={4} maxLength={300} value={description} placeholder="What should players do? Collect all the coins? Find the flag?" onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="field">Tags
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SUGGESTED.map((t) => (
                <button key={t} className={'chip' + (tags.includes(t) ? ' on' : '')} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t].slice(0, 5))}>
                  {t} {tags.includes(t) && <X size={12} />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <b style={{ fontSize: 13 }}>Cover (a picture of your world right now)</b>
          <div style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <Cover game={game} />
          </div>
          <button className="btn small" onClick={() => { const shot = capture(); if (shot) shrinkImage(shot, 960, 0.82).then(setCover); }}>Retake picture</button>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            Published games are kept in this browser and show up in your store under <b>Community Gems</b>. Sharing them with other people needs an online database (coming later).
          </p>
        </div>
      </div>
    </Modal>
  );
}

function bump(v: string) {
  const p = v.split('.').map((x) => Number(x) || 0);
  while (p.length < 3) p.push(0);
  p[2]++;
  return p.slice(0, 3).join('.');
}
