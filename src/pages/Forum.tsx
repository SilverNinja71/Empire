import { useMemo, useState } from 'react';
import { ArrowBigDown, ArrowBigUp, BookOpen, Bug, ChevronLeft, MessageCircle, MessagesSquare, Package, Pin, Plus, Send, Sparkles, Trash2 } from 'lucide-react';
import { BOARDS } from '../data/forumSeed';
import { useAllGames, useStore } from '../lib/store';
import { href, navigate, useRoute } from '../lib/router';
import { renderMarkdown } from '../lib/markdown';
import { timeAgo } from '../lib/util';
import { useAccount } from '../lib/account';
import type { ForumPost, ForumThread } from '../lib/types';
import { Page } from '../components/ui';

const ICONS = { MessagesSquare, Sparkles, Package, BookOpen, Bug } as const;

/** Badges you've earned on Empire: Developer (added a game), Creator (published a studio world), Indie Pioneer (wrote a devlog). */
export function useMyBadges(): string[] {
  const localGames = useStore((s) => s.localGames);
  const threads = useStore((s) => s.threads);
  const [acc] = useAccount();
  const b: string[] = [];
  if (localGames.some((g) => g.origin === 'local')) b.push('Developer');
  if (localGames.some((g) => g.origin === 'studio')) b.push('Creator');
  if (threads.some((t) => t.board === 'devlogs' && t.posts[0].author === acc.username)) b.push('Pioneer');
  return b;
}

const BADGE_NAMES: Record<string, string> = { Pioneer: 'Indie Pioneer' };

function Author({ p }: { p: ForumPost }) {
  return (
    <span className="author">
      <b>{p.author}</b>
      {p.badges.map((b) => <span key={b} className={'ubadge ' + b}>{BADGE_NAMES[b] ?? b}</span>)}
      <span>· {timeAgo(p.createdAt)}</span>
    </span>
  );
}

function Vote({ thread, post }: { thread: ForumThread; post: ForumPost }) {
  const vote = useStore((s) => s.vote);
  return (
    <div className="vote" onClick={(e) => e.stopPropagation()}>
      <button className={post.myVote === 1 ? 'up' : ''} aria-label="Upvote" onClick={() => vote(thread.id, post.id, 1)}><ArrowBigUp size={22} fill={post.myVote === 1 ? 'currentColor' : 'none'} /></button>
      <span>{post.votes}</span>
      <button className={post.myVote === -1 ? 'down' : ''} aria-label="Downvote" onClick={() => vote(thread.id, post.id, -1)}><ArrowBigDown size={22} fill={post.myVote === -1 ? 'currentColor' : 'none'} /></button>
    </div>
  );
}

function Markdown({ src }: { src: string }) {
  const html = useMemo(() => renderMarkdown(src), [src]);
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Composer({ onSend, placeholder, cta, minRows = 6 }: { onSend: (body: string) => void; placeholder: string; cta: string; minRows?: number }) {
  const [body, setBody] = useState('');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  return (
    <div>
      <div className="composer-tabs">
        <button className={'btn small' + (tab === 'write' ? ' active' : '')} onClick={() => setTab('write')}>Write</button>
        <button className={'btn small' + (tab === 'preview' ? ' active' : '')} onClick={() => setTab('preview')}>Preview</button>
        <span className="muted" style={{ fontSize: 12, marginLeft: 'auto', alignSelf: 'center' }}>Markdown: **bold**, `code`, ```code blocks```, and links to images or videos on their own line</span>
      </div>
      {tab === 'write' ? (
        <textarea className="input" rows={minRows} value={body} placeholder={placeholder} onChange={(e) => setBody(e.target.value)} />
      ) : (
        <div className="panel" style={{ padding: 14, minHeight: 120 }}>{body.trim() ? <Markdown src={body} /> : <span className="muted">Nothing to preview yet.</span>}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button className="btn primary" disabled={!body.trim()} onClick={() => { onSend(body.trim()); setBody(''); setTab('write'); }}><Send size={15} /> {cta}</button>
      </div>
    </div>
  );
}

const LOCAL_NOTE = 'Posts are saved in this browser only, until Empire gets an online database.';

function Boards() {
  const threads = useStore((s) => s.threads);
  const latest = threads.slice().sort((a, b) => b.posts[b.posts.length - 1].createdAt - a.posts[a.posts.length - 1].createdAt).slice(0, 6);
  return (
    <Page k="forum">
      <div className="page-head">
        <div>
          <h1>Community Forum</h1>
          <p>{LOCAL_NOTE}</p>
        </div>
        <button className="btn primary" onClick={() => navigate('/forum/new')}><Plus size={16} /> New thread</button>
      </div>
      <div className="boards">
        {BOARDS.map((b) => {
          const Icon = ICONS[b.icon];
          const list = threads.filter((t) => t.board === b.id);
          return (
            <a key={b.id} className="panel board" href={href(`/forum/${b.id}`)} style={{ color: 'inherit', textDecoration: 'none' }}>
              <h3><Icon size={18} style={{ color: 'var(--accent-2)' }} /> {b.name}</h3>
              <span className="muted" style={{ fontSize: 14 }}>{b.desc}</span>
              <span className="muted" style={{ fontSize: 12 }}>{list.length} thread{list.length === 1 ? '' : 's'} · {list.reduce((n, t) => n + t.posts.length, 0)} posts</span>
            </a>
          );
        })}
      </div>
      <div className="section-title"><h2>Latest activity</h2></div>
      <ThreadList threads={latest} />
    </Page>
  );
}

function ThreadList({ threads }: { threads: ForumThread[] }) {
  if (!threads.length) return <div className="panel empty">No threads here yet. Start one!</div>;
  return (
    <div className="panel" style={{ overflow: 'hidden' }}>
      {threads.map((t) => {
        const op = t.posts[0];
        const board = BOARDS.find((b) => b.id === t.board);
        return (
          <div key={t.id} className="thread-row" onClick={() => navigate(`/forum/thread/${t.id}`)} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/forum/thread/${t.id}`)}>
            <Vote thread={t} post={op} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {t.pinned && <Pin size={14} className="pinned" style={{ verticalAlign: -1, marginRight: 4 }} />}
                {t.title}
              </div>
              <Author p={op} />
              <span className="muted" style={{ fontSize: 12 }}> · {board?.name}</span>
            </div>
            <span className="muted" style={{ fontSize: 13, display: 'flex', gap: 4, alignItems: 'center' }}><MessageCircle size={14} /> {t.posts.length - 1}</span>
          </div>
        );
      })}
    </div>
  );
}

function Board({ id }: { id: string }) {
  const threads = useStore((s) => s.threads);
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const board = BOARDS.find((b) => b.id === id);
  if (!board) return <Page k="board-x"><div className="empty">No board called “{id}”.</div></Page>;
  const list = threads.filter((t) => t.board === id).sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    return sort === 'top' ? b.posts[0].votes - a.posts[0].votes : b.createdAt - a.createdAt;
  });
  return (
    <Page k={'board-' + id}>
      <a href={href('/forum')} className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 10 }}><ChevronLeft size={16} /> All boards</a>
      <div className="page-head">
        <div>
          <h1>{board.name}</h1>
          <p>{board.desc}</p>
        </div>
        <div className="toolbar">
          <div className="tabs">
            <button className={sort === 'top' ? 'on' : ''} onClick={() => setSort('top')}>Top</button>
            <button className={sort === 'new' ? 'on' : ''} onClick={() => setSort('new')}>New</button>
          </div>
          <button className="btn primary" onClick={() => navigate(`/forum/new?board=${id}`)}><Plus size={16} /> New thread</button>
        </div>
      </div>
      <ThreadList threads={list} />
    </Page>
  );
}

function Thread({ id }: { id: string }) {
  const t = useStore((s) => s.threads.find((x) => x.id === id));
  const reply = useStore((s) => s.reply);
  const deleteThread = useStore((s) => s.deleteThread);
  const [acc] = useAccount();
  const badges = useMyBadges();
  const games = useAllGames();
  if (!t) return <Page k="thread-x"><div className="empty">That thread doesn’t exist (it may have been deleted).</div></Page>;
  const board = BOARDS.find((b) => b.id === t.board);
  const game = t.gameId ? games.find((g) => g.id === t.gameId) : undefined;
  const mine = t.posts[0].author === acc.username && !t.pinned;
  return (
    <Page k={'thread-' + id}>
      <a href={href(`/forum/${t.board}`)} className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 10 }}><ChevronLeft size={16} /> {board?.name}</a>
      <div className="page-head">
        <div>
          <h1>{t.pinned && <Pin size={22} className="pinned" style={{ verticalAlign: -2, marginRight: 6 }} />}{t.title}</h1>
          {game && <p>About <a href={href(`/game/${game.id}`)}>{game.title}</a></p>}
        </div>
        {mine && <button className="btn danger small" onClick={() => { deleteThread(t.id); navigate(`/forum/${t.board}`); }}><Trash2 size={14} /> Delete thread</button>}
      </div>
      <div className="panel">
        {t.posts.map((p) => (
          <div key={p.id} className="post">
            <Vote thread={t} post={p} />
            <div style={{ minWidth: 0 }}>
              <Author p={p} />
              <div style={{ marginTop: 8 }}><Markdown src={p.body} /></div>
            </div>
          </div>
        ))}
      </div>
      <div className="panel" style={{ padding: 18, marginTop: 16 }}>
        <h3 style={{ marginBottom: 10 }}>Reply as {acc.username}</h3>
        <Composer cta="Post reply" placeholder="Write a reply…" minRows={4} onSend={(body) => reply(t.id, body, acc.username, badges)} />
      </div>
    </Page>
  );
}

function NewThread() {
  const { query } = useRoute();
  const games = useAllGames();
  const createThread = useStore((s) => s.createThread);
  const [acc] = useAccount();
  const badges = useMyBadges();
  const [board, setBoard] = useState(query.get('board') || 'general');
  const [title, setTitle] = useState('');
  const [gameId, setGameId] = useState(query.get('game') || '');
  return (
    <Page k="new-thread">
      <a href={href('/forum')} className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 10 }}><ChevronLeft size={16} /> Forum</a>
      <div className="page-head"><div><h1>New thread</h1><p>Posting as <b>{acc.username}</b>. {LOCAL_NOTE}</p></div></div>
      <div className="panel" style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div className="form-grid">
          <label className="field">Board
            <select className="input" value={board} onChange={(e) => setBoard(e.target.value)}>
              {BOARDS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="field">About a game <span className="hint">(optional)</span>
            <select className="input" value={gameId} onChange={(e) => setGameId(e.target.value)}>
              <option value="">None</option>
              {games.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </label>
          <label className="field full">Title
            <input className="input" value={title} maxLength={120} placeholder="What’s it about?" onChange={(e) => setTitle(e.target.value)} />
          </label>
        </div>
        <Composer
          cta="Post thread"
          placeholder="Say more… Paste a picture or video link on its own line to show it."
          onSend={(body) => {
            if (!title.trim()) return;
            const id = createThread({ board, title: title.trim(), body, author: acc.username, badges, gameId: gameId || undefined });
            navigate(`/forum/thread/${id}`);
          }}
        />
        {!title.trim() && <span className="muted" style={{ fontSize: 12 }}>Add a title to post.</span>}
      </div>
    </Page>
  );
}

export function Forum() {
  const { parts } = useRoute();
  if (parts[1] === 'thread' && parts[2]) return <Thread id={parts[2]} />;
  if (parts[1] === 'new') return <NewThread />;
  if (parts[1]) return <Board id={parts[1]} />;
  return <Boards />;
}
