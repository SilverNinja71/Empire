import { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { useStore } from '../lib/store';
import { accounts } from '../lib/account';
import { Modal } from './ui';

/** Sign in with the same account every SilverNinja game uses (stored in this browser). */
export function AccountModal() {
  const open = useStore((s) => s.modal === 'account');
  const close = () => useStore.getState().openModal(null);
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const api = accounts();
  const known = api?.list() ?? [];

  const submit = async () => {
    if (!api) return;
    setBusy(true);
    setError('');
    const r = tab === 'in' ? await api.logIn(name, pw) : await api.signUp(name, pw, true);
    setBusy(false);
    if (!r.ok) return setError(r.error || 'That didn’t work.');
    setPw('');
    useStore.getState().toast(tab === 'in' ? `Welcome back, ${r.username}!` : `Account made. Welcome, ${r.username}!`);
    window.dispatchEvent(new Event('storage'));
    close();
  };

  return (
    <Modal open={open} onClose={close} title="Your account" width={460}>
      {!api ? (
        <p className="bad">The shared account script didn’t load (shared/accounts.js).</p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: 'grid', gap: 14 }}>
          <div className="tabs" style={{ justifySelf: 'start' }}>
            <button type="button" className={tab === 'in' ? 'on' : ''} onClick={() => setTab('in')}><LogIn size={14} /> Sign in</button>
            <button type="button" className={tab === 'up' ? 'on' : ''} onClick={() => setTab('up')}><UserPlus size={14} /> New account</button>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            One account for Empire and every SilverNinja game: your username, trophies and achievements. It’s kept in this browser; the password is never sent anywhere.
          </p>
          <label className="field">Username
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" list="known-accounts" required />
            <datalist id="known-accounts">{known.map((k) => <option key={k.key} value={k.username} />)}</datalist>
          </label>
          <label className="field">Password
            <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={tab === 'in' ? 'current-password' : 'new-password'} required />
          </label>
          {error && <div className="bad" style={{ fontSize: 14 }}>{error}</div>}
          <button className="btn primary big" disabled={busy}>{busy ? 'One moment…' : tab === 'in' ? 'Sign in' : 'Make my account'}</button>
        </form>
      )}
    </Modal>
  );
}
