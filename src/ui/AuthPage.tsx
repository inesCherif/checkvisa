import { useState, type FormEvent } from 'react';
import { authMessage, resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from '../firebase/auth';
import { isFirebaseConfigured } from '../firebase/config';
import { IconArrow } from './icons';

const field = 'block w-full border-0 border-b-2 border-gray-300 bg-transparent py-2 text-xl text-gray-900 transition-colors focus:border-ink focus:outline-none';

export default function AuthPage({ mode }: { mode: 'signin' | 'signup' }) {
  const up = mode === 'signup';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    setInfo(undefined);
    try {
      await fn();
      location.hash = '#/account';
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void run(() => (up ? signUpWithEmail(name, email, password) : signInWithEmail(email, password)));
  }

  async function forgot() {
    if (!email) return setError('Type your email first, then ask for a reset link.');
    try {
      await resetPassword(email);
      setError(undefined);
      setInfo(`A reset link is on its way to ${email}.`);
    } catch (e) {
      setError(authMessage(e));
    }
  }

  return (
    <div className="grid gap-14 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-24">
      <div>
        <h1 className="text-5xl leading-[0.95] font-medium tracking-[-0.03em] sm:text-7xl">
          {up ? 'Save your checklist, not your papers.' : 'Welcome back.'}
        </h1>
        <p className="mt-6 max-w-lg text-xl text-gray-600">
          An account keeps two things so you can continue on another device: your trip answers and the items you ticked. Your passport, statements and
          payslips are never stored, with or without an account.
        </p>
        <dl className="mt-12 grid max-w-lg grid-cols-2 gap-8">
          <div>
            <dt className="text-gray-500">Saved</dt>
            <dd className="mt-1 text-lg text-gray-900">Destination, dates, purpose, ticks</dd>
          </div>
          <div>
            <dt className="text-gray-500">Never saved</dt>
            <dd className="mt-1 text-lg text-gray-900">Documents, what Gemini Nano read, results</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white p-8 sm:p-10">
        <button
          type="button"
          disabled={busy || !isFirebaseConfigured()}
          onClick={() => run(signInWithGoogle)}
          className="flex w-full items-center justify-center gap-3 bg-gray-900 px-5 py-3.5 text-lg font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
          </svg>
          Continue with Google
        </button>

        <p className="my-8 text-center text-gray-500">or with your email</p>

        <form onSubmit={submit} className="grid gap-7">
          {up && (
            <label>
              <span className="text-[15px] text-gray-500">First name (optional)</span>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
            </label>
          )}
          <label>
            <span className="text-[15px] text-gray-500">Email</span>
            <input className={field} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label>
            <span className="text-[15px] text-gray-500">Password{up ? ', at least 6 characters' : ''}</span>
            <input
              className={field}
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={up ? 'new-password' : 'current-password'}
            />
          </label>
          {error && <p className="bg-red-50 px-4 py-3 text-red-800">{error}</p>}
          {info && <p className="bg-emerald-50 px-4 py-3 text-gray-900">{info}</p>}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 bg-stamp px-5 py-3.5 text-lg font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {busy ? 'One moment…' : up ? 'Create my account' : 'Sign in'} <IconArrow size={18} />
          </button>
        </form>

        <div className="mt-8 flex flex-wrap justify-between gap-3 text-gray-500">
          {up ? (
            <a href="#/signin" className="underline underline-offset-4 hover:text-gray-900">
              I already have an account
            </a>
          ) : (
            <>
              <a href="#/signup" className="underline underline-offset-4 hover:text-gray-900">
                Create an account
              </a>
              <button type="button" onClick={forgot} className="underline underline-offset-4 hover:text-gray-900">
                Forgot my password
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
