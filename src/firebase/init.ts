// One place that starts every Firebase service the app uses.
//  - App Check: proves requests come from our real app (required by Firebase AI Logic).
//  - Auth: anonymous sign-in, so Firestore rules can require a signed-in user.
//  - AI Logic: the hybrid on-device / cloud Gemini SDK.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import { getAuth, signInAnonymously, type User } from 'firebase/auth';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import { appCheckDebugToken, firebaseConfig, isFirebaseConfigured, missingConfigKeys, recaptchaSiteKey } from './config';

export interface FirebaseServices {
  app: FirebaseApp;
  /** null until a reCAPTCHA v3 site key is configured (App Check not enforced yet). */
  appCheck: AppCheck | null;
  ai: AI;
  /** Resolves once the anonymous sign-in finished. */
  user: Promise<User>;
}

let services: FirebaseServices | null = null;

export function isLocalhost(): boolean {
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

export function getFirebase(): FirebaseServices {
  if (services) return services;
  if (!isFirebaseConfigured()) {
    throw new Error(`Firebase is not configured. Missing: ${missingConfigKeys().join(', ')}`);
  }

  const app = initializeApp(firebaseConfig);

  // On localhost, reCAPTCHA cannot attest the page, so App Check uses a debug token.
  // That token must be registered in Firebase console → App Check → Manage debug tokens.
  // This switch must be set BEFORE initializeAppCheck().
  if (isLocalhost()) {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken || true;
  }

  const appCheck = recaptchaSiteKey
    ? initializeAppCheck(app, { provider: new ReCaptchaV3Provider(recaptchaSiteKey), isTokenAutoRefreshEnabled: true })
    : null;
  if (!appCheck) console.warn('[CheckVisa] App Check is off: set VITE_RECAPTCHA_SITE_KEY.');

  // Gemini Developer API backend = free tier on the Spark plan.
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  const user = signInAnonymously(getAuth(app)).then((credential) => credential.user);

  services = { app, appCheck, ai, user };
  return services;
}
