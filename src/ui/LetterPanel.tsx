import { useMemo, useState } from 'react';
import type { AI } from 'firebase/ai';
import { coverLetterPrompt, fillPlaceholders, type AssistResult } from '../core/ai/assist';
import type { Dossier } from '../core/rules/dossier';
import type { Trip } from '../core/rules/trip';
import { Card, SourceBadge } from './shared';

export default function LetterPanel({ ai, trip, dossier }: { ai: AI | null; trip: Trip; dossier: Dossier }) {
  const [res, setRes] = useState<AssistResult>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [employer, setEmployer] = useState('');
  const [city, setCity] = useState('Tunis');
  const payload = useMemo(() => coverLetterPrompt(trip), [trip]);

  async function write(onDevice: boolean) {
    if (!ai) return;
    setBusy(true);
    setErr(undefined);
    try {
      const { coverLetter } = await import('../core/ai/assist');
      setRes(await coverLetter(ai, trip, onDevice));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const filled = res
    ? fillPlaceholders(res.text, {
        '[FULL NAME]': dossier.passport?.fullName,
        '[PASSPORT NUMBER]': dossier.passport?.number,
        '[EMPLOYER OR SCHOOL]': employer,
        '[CITY]': city,
      })
    : '';

  return (
    <Card>
      <h2 className="text-lg font-bold text-gray-900">Cover letter</h2>
      <p className="mt-1 text-sm text-gray-600">
        Written by the cloud model from your <strong>trip facts only</strong>. Your name and passport number are filled in here, on
        your device, after the text comes back.
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-sky-700">This is exactly what the cloud will see</summary>
        <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-900 p-3 text-xs text-gray-100">{payload}</pre>
      </details>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Employer or school (stays local)" value={employer} onChange={(e) => setEmployer(e.target.value)} />
        <input className="rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="City (stays local)" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={!ai || busy} onClick={() => write(false)} className="rounded-full bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50">
          {busy ? 'Writing…' : 'Write my cover letter'}
        </button>
        <button disabled={!ai || busy} onClick={() => write(true)} className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          Write it offline (on-device)
        </button>
      </div>
      {!ai && <p className="mt-2 text-xs text-gray-500">Needs the Firebase configuration.</p>}
      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
      {res && (
        <div className="mt-4">
          <SourceBadge source={res.source} />
          <textarea className="mt-2 h-72 w-full rounded-lg border border-gray-300 p-3 font-serif text-sm" value={filled} readOnly />
        </div>
      )}
    </Card>
  );
}
