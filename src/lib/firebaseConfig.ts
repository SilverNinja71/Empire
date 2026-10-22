/**
 * Empire's Firebase project (used only for "Sign in with Google / Microsoft / GitHub").
 * Paste the values from: Firebase console → Project settings → General → Your apps → SDK setup and configuration → Config.
 * These values are meant to be public (they identify the project; they are not passwords).
 * While apiKey is empty, the sign-in buttons stay switched off.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyB_3d-B8zVRhVd1x6KW8TqhAOceCK_xWwE',
  authDomain: 'empire-dd4d0.firebaseapp.com',
  projectId: 'empire-dd4d0',
  appId: '1:838843149871:web:e1fd31f8646ba7fe4060da',
};

export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain);
