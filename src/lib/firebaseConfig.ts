/**
 * Empire's Firebase project (used only for "Sign in with Google / Microsoft / GitHub").
 * Paste the values from: Firebase console → Project settings → General → Your apps → SDK setup and configuration → Config.
 * These values are meant to be public (they identify the project; they are not passwords).
 * While apiKey is empty, the sign-in buttons stay switched off.
 */
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
};

export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain);
