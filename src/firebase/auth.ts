// Accounts. Everyone starts as an anonymous user (needed for Firestore rules and App Check).
// Signing up *upgrades* that anonymous user, so trip answers and ticks are kept.
// An account only ever stores the trip answers and the checklist ticks (see userData.ts).

import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { getFirebase } from './init';

const auth = () => getAuth(getFirebase().app);
const code = (e: unknown) => (e as { code?: string }).code ?? '';

export function watchUser(cb: (u: User | null) => void): () => void {
  return onAuthStateChanged(auth(), cb);
}

export const isAccount = (u: User | null): u is User => !!u && !u.isAnonymous;

export async function signInWithGoogle(): Promise<User> {
  const a = auth();
  const provider = new GoogleAuthProvider();
  const current = a.currentUser;
  if (current?.isAnonymous) {
    try {
      return (await linkWithPopup(current, provider)).user;
    } catch (e) {
      // This Google account already has a CheckVisa account: just sign in to it.
      // Reuse the credential from the error — a second popup here is no longer
      // tied to the user's click, so the browser blocks it (auth/popup-blocked).
      if (code(e) !== 'auth/credential-already-in-use') throw e;
      const cred = GoogleAuthProvider.credentialFromError(e as Parameters<typeof GoogleAuthProvider.credentialFromError>[0]);
      if (cred) return (await signInWithCredential(a, cred)).user;
      throw e;
    }
  }
  return (await signInWithPopup(a, provider)).user;
}

export async function signUpWithEmail(name: string, email: string, password: string): Promise<User> {
  const a = auth();
  const current = a.currentUser;
  const user = current?.isAnonymous
    ? (await linkWithCredential(current, EmailAuthProvider.credential(email, password))).user
    : (await createUserWithEmailAndPassword(a, email, password)).user;
  if (name.trim()) await updateProfile(user, { displayName: name.trim() });
  return user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  return (await signInWithEmailAndPassword(auth(), email, password)).user;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth(), email);
}

/** Sign out, then continue as a fresh anonymous visitor. */
export async function logOut(): Promise<void> {
  const a = auth();
  await signOut(a);
  await signInAnonymously(a);
}

/** Human wording for the Firebase errors people actually hit. */
export function authMessage(e: unknown): string {
  switch (code(e)) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password do not match an account.';
    case 'auth/email-already-in-use':
    case 'auth/credential-already-in-use':
      return 'An account already uses this email. Sign in instead.';
    case 'auth/weak-password':
      return 'Choose a password of at least 6 characters.';
    case 'auth/invalid-email':
      return 'This email address does not look right.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'The Google window was closed before signing in.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google window. Allow pop-ups for this site and try again.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not switched on yet.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Check your internet and try again.';
    default:
      return e instanceof Error ? e.message : String(e);
  }
}
