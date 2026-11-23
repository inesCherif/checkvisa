// Maintainer page (#/admin, not in the menu): sign in with Google, then copy the bundled,
// schema-validated dataset into Firestore. Firestore rules only accept writes from the
// maintainer's UID, so anyone else who opens this page gets "permission denied".

import { useEffect, useState } from 'react';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { getFirebase } from '../firebase/init';
import { publishLibrary } from '../firebase/library';
import { bundledLibrary } from '../core/data/library';
import { Card } from './shared';

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<string>('');
  const lib = bundledLibrary();

  useEffect(() => onAuthStateChanged(getAuth(getFirebase().app), setUser), []);

  const isGoogle = user?.providerData.some((p) => p.providerId === 'google.com') ?? false;

  async function signIn() {
    setStatus('');
    try {
      await signInWithPopup(getAuth(getFirebase().app), new GoogleAuthProvider());
    } catch (e) {
      setStatus(`Sign-in failed: ${(e as Error).message}`);
    }
  }

  async function publish() {
    setStatus('Publishing…');
    try {
      const n = await publishLibrary(getFirebase().app, lib);
      setStatus(`Published ${n} documents (dataset ${lib.version}).`);
    } catch (e) {
      setStatus(`Publish failed: ${(e as Error).message}`);
    }
  }

  return (
    <Card className="space-y-4">
      <h1 className="text-5xl leading-[0.95] font-medium tracking-[-0.03em] text-gray-900 sm:text-6xl">Maintainer</h1>
      <p className="text-sm text-gray-600">
        Copies the bundled dataset ({lib.sources.length} sources, {lib.facts.length} facts, {lib.stats.length} statistics files,
        version {lib.version}) into Firestore, so every visitor gets updated rules without a new deploy.
      </p>
      {isGoogle ? (
        <>
          <p className="text-sm">
            Signed in as <b>{user?.email}</b>
            <br />
            <span className="text-xs text-gray-500">UID (goes in firestore.rules): </span>
            <code className="select-all text-xs">{user?.uid}</code>
          </p>
          <div className="flex gap-2">
            <button onClick={publish} className="bg-stamp px-4 py-2 text-sm font-semibold text-white hover:bg-stamp-dark">
              Publish dataset to Firestore
            </button>
            <button onClick={() => signOut(getAuth(getFirebase().app))} className="border border-gray-300 px-4 py-2 text-sm">
              Sign out
            </button>
          </div>
        </>
      ) : (
        <button onClick={signIn} className="bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
          Sign in with Google
        </button>
      )}
      {status && <p className="text-sm text-gray-800">{status}</p>}
    </Card>
  );
}
