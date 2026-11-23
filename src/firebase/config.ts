// Firebase web configuration, read from Vite env variables (.env.local, never committed).
// The web config is public by design once deployed, but we keep it out of the repo
// so the repository contains no project keys at all.

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? '',
};

export const recaptchaSiteKey = env.VITE_RECAPTCHA_SITE_KEY ?? '';
export const appCheckDebugToken = env.VITE_APPCHECK_DEBUG_TOKEN ?? '';

const REQUIRED: Array<[string, string]> = [
  ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
];

/** Names of required env variables that are still empty. */
export function missingConfigKeys(): string[] {
  return REQUIRED.filter(([, value]) => !value).map(([name]) => name);
}

export function isFirebaseConfigured(): boolean {
  return missingConfigKeys().length === 0;
}
