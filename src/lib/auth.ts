import { create } from 'zustand';
import type { Auth, User } from 'firebase/auth';
import { firebaseConfig, firebaseReady } from './firebaseConfig';
import { accounts } from './account';

/**
 * "Sign in with Google / Microsoft / GitHub" through Firebase Authentication.
 * After Firebase confirms who you are, the shared game account (shared/accounts.js) switches
 * to your account, so your name and progress are the same in Empire and every game.
 */
export type ProviderId = 'google' | 'microsoft' | 'github';

export const PROVIDERS: { id: ProviderId; label: string; firebaseId: string }[] = [
  { id: 'google', label: 'Google', firebaseId: 'google.com' },
  { id: 'microsoft', label: 'Microsoft', firebaseId: 'microsoft.com' },
  { id: 'github', label: 'GitHub', firebaseId: 'github.com' },
];

interface AuthUser {
  name: string;
  photo: string | null;
  provider: string;
}

export const useAuth = create<{ user: AuthUser | null; ready: boolean }>(() => ({ user: null, ready: !firebaseReady }));

let authPromise: Promise<{ auth: Auth; mod: typeof import('firebase/auth') }> | null = null;

/** Load Firebase only when it's needed (it's a big download). */
function getAuthLib() {
  if (!firebaseReady) return Promise.reject(new Error('Sign-in with Google, Microsoft and GitHub isn’t set up yet.'));
  authPromise ??= (async () => {
    const [{ initializeApp }, mod] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
    const app = initializeApp(firebaseConfig);
    const auth = mod.getAuth(app);
    await mod.setPersistence(auth, mod.browserLocalPersistence);
    mod.onAuthStateChanged(auth, (u) => {
      useAuth.setState({ user: u ? describe(u) : null, ready: true });
      if (u) linkGameAccount(u, false);
    });
    // Coming back from a redirect sign-in (used when popups are blocked)
    mod.getRedirectResult(auth).catch(() => undefined);
    return { auth, mod };
  })();
  return authPromise;
}

function describe(u: User): AuthUser {
  const p = u.providerData[0]?.providerId ?? 'firebase';
  return { name: u.displayName || u.email?.split('@')[0] || 'Player', photo: u.photoURL, provider: p };
}

/** Switch the shared game account to this person's account (make it the first time). */
function linkGameAccount(u: User, keepProgress: boolean) {
  const api = accounts();
  if (!api?.signInExternal) return;
  const cur = api.current();
  const key = `ext:firebase:${u.uid}`;
  // Don't override someone who deliberately logged in to another account in a game
  if (cur && cur.key !== key && !keepProgress) return;
  const via = PROVIDERS.find((p) => p.firebaseId === u.providerData[0]?.providerId)?.label ?? 'Empire';
  api.signInExternal({ provider: 'firebase', uid: u.uid, via, name: u.displayName || u.email?.split('@')[0] || '' }, keepProgress);
  window.dispatchEvent(new Event('storage'));
}

/** Start Firebase in the background if it's set up, so a returning user is recognized. */
export function startAuth() {
  if (firebaseReady) getAuthLib().catch(() => useAuth.setState({ ready: true }));
}

const MESSAGES: Record<string, string> = {
  'auth/popup-closed-by-user': 'The sign-in window was closed before finishing.',
  'auth/cancelled-popup-request': 'The sign-in window was closed before finishing.',
  'auth/account-exists-with-different-credential': 'You already signed in to Empire with a different service using this email. Use that one.',
  'auth/unauthorized-domain': 'This website isn’t on the sign-in allow list yet (Firebase → Authentication → Settings → Authorized domains).',
  'auth/operation-not-allowed': 'That sign-in option is switched off in Firebase (Authentication → Sign-in method).',
  'auth/network-request-failed': 'No connection to the sign-in service. Check your internet and try again.',
};

export async function signInWith(id: ProviderId): Promise<{ ok: boolean; error?: string; name?: string }> {
  try {
    const { auth, mod } = await getAuthLib();
    const provider =
      id === 'google' ? new mod.GoogleAuthProvider() :
      id === 'github' ? new mod.GithubAuthProvider() :
      new mod.OAuthProvider('microsoft.com');
    if (id === 'microsoft') (provider as InstanceType<typeof mod.OAuthProvider>).setCustomParameters({ prompt: 'select_account' });
    if (id === 'google') (provider as InstanceType<typeof mod.GoogleAuthProvider>).setCustomParameters({ prompt: 'select_account' });
    try {
      const res = await mod.signInWithPopup(auth, provider);
      linkGameAccount(res.user, true);
      return { ok: true, name: describe(res.user).name };
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-environment') {
        await mod.signInWithRedirect(auth, provider); // the page leaves and comes back signed in
        return { ok: true };
      }
      throw e;
    }
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    return { ok: false, error: MESSAGES[code] ?? (e as Error).message ?? 'Sign-in didn’t work. Try again.' };
  }
}

/** Sign out of the sign-in service and the game account. */
export async function signOutEverywhere() {
  accounts()?.logOut();
  window.dispatchEvent(new Event('storage'));
  if (!firebaseReady) return;
  try {
    const { auth, mod } = await getAuthLib();
    await mod.signOut(auth);
  } catch {
    /* already signed out */
  }
}
