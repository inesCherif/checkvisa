import { useState } from 'react';
import type { User } from 'firebase/auth';
import { logOut } from '../firebase/auth';
import { deleteUserData } from '../firebase/userData';
import { getFirebase } from '../firebase/init';
import type { Trip } from '../core/rules/trip';

interface Props {
  user: User | null;
  trip: Trip;
  checked: string[];
  syncState: 'idle' | 'saving' | 'saved' | 'error';
}

export default function AccountPage({ user, trip, checked, syncState }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  if (!user || user.isAnonymous) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-5xl leading-[0.95] font-medium tracking-[-0.03em] sm:text-6xl">You are browsing as a guest.</h1>
        <p className="mt-6 text-xl text-gray-600">Everything works without an account. Create one only if you want your checklist on another device.</p>
        <div className="mt-10 flex flex-wrap gap-4">
          <a href="#/signup" className="bg-stamp px-5 py-3.5 text-lg font-semibold text-white">
            Create an account
          </a>
          <a href="#/signin" className="px-5 py-3.5 text-lg text-gray-900 underline underline-offset-4">
            Sign in
          </a>
        </div>
      </div>
    );
  }

  // Exactly what Firestore holds for this account.
  const stored = { trip, checked, updatedAt: '(server time)' };

  async function wipe() {
    setBusy(true);
    try {
      await deleteUserData(getFirebase().app, user!.uid);
      setMsg('Your saved trip and ticks were deleted from the server. They are still in this browser until you sign out.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
      <div>
        <h1 className="text-5xl leading-[0.95] font-medium tracking-[-0.03em] sm:text-6xl">
          {user.displayName ? `Hello, ${user.displayName.split(' ')[0]}.` : 'Your account'}
        </h1>
        <p className="mt-4 text-xl text-gray-600">{user.email}</p>
        <p className="mt-8 text-gray-700">
          {syncState === 'saving' ? 'Saving…' : syncState === 'error' ? 'Could not save. Your changes are kept in this browser.' : 'Your trip and ticks are saved.'}
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <a href="#/trip" className="bg-stamp px-5 py-3.5 text-lg font-semibold text-white">
            Back to my checklist
          </a>
          <button
            type="button"
            onClick={async () => {
              await logOut();
              location.hash = '#/';
            }}
            className="px-5 py-3.5 text-lg text-gray-900 underline underline-offset-4"
          >
            Sign out
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-3xl leading-tight font-medium">Everything we store about you</h2>
        <p className="mt-2 text-gray-500">This is the whole record, as it sits in the database. Nothing else is kept.</p>
        <pre className="mt-6 max-h-[28rem] overflow-auto bg-white p-6 text-sm leading-relaxed text-gray-800">{JSON.stringify(stored, null, 2)}</pre>
        <button
          type="button"
          disabled={busy}
          onClick={wipe}
          className="mt-6 bg-red-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          Delete my saved data
        </button>
        {msg && <p className="mt-4 text-gray-700">{msg}</p>}
      </div>
    </div>
  );
}
