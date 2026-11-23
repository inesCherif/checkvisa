import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { AI } from 'firebase/ai';
import type { Library } from '../core/data/library';
import { runChecks, summarize, type Finding, type Status } from '../core/rules/checks';
import { DOC_LABELS, type DocKind, type Dossier } from '../core/rules/dossier';
import { pretty, today } from '../core/rules/dates';
import type { Rates } from '../core/rules/money';
import { DESTINATIONS, PURPOSES, type Trip } from '../core/rules/trip';
import { DOC_SCHEMAS } from '../core/extract/schemas';
import { sampleDossier } from '../core/sample/sampleDossier';
import { getLedger, subscribe } from '../core/routing/ledger';
import { checkOnDeviceStatus, type OnDeviceStatus } from '../core/ai/onDevice';
import { isFirebaseConfigured } from '../firebase/config';
import { getFirebase } from '../firebase/init';
import { Card, FactChips, SourceBadge, StatusDot } from './shared';
import LetterPanel from './LetterPanel';
import { IconArrow, IconChevron, IconPlay } from './icons';

type Origin = 'on_device' | 'in_cloud' | 'manual' | 'sample';

interface Props {
  trip: Trip;
  setTrip: (t: Trip) => void;
  dossier: Dossier;
  setDossier: (d: Dossier) => void;
  lib: Library;
  rates: Rates;
}

const ORDER: Record<Status, number> = { fail: 0, missing: 1, warn: 2, pass: 3 };

function useAI(): AI | null {
  const [ai] = useState(() => (isFirebaseConfigured() ? getFirebase().ai : null));
  return ai;
}

export default function CheckPage({ trip, setTrip, dossier, setDossier, lib, rates }: Props) {
  const ai = useAI();
  const [origins, setOrigins] = useState<Partial<Record<DocKind, Origin>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [consent, setConsent] = useState(false);
  const [nano, setNano] = useState<OnDeviceStatus>();
  const ledger = useSyncExternalStore(subscribe, getLedger);
  const appDate = today();

  useEffect(() => {
    void checkOnDeviceStatus().then(setNano);
  }, []);

  const kinds = (Object.keys(DOC_LABELS) as DocKind[]).filter(
    (k) => (k !== 'payslips' && k !== 'leave') || trip.status === 'employee',
  ).filter((k) => k !== 'accommodation' || trip.accommodation !== 'host');

  const findings = useMemo(
    () => runChecks(dossier, { trip, lib, applicationDate: appDate, rates }).sort((a, b) => ORDER[a.status] - ORDER[b.status]),
    [dossier, trip, lib, appDate, rates],
  );
  const sum = summarize(findings);
  const cloudCalls = ledger.filter((e) => e.where === 'in_cloud').length;
  const deviceCalls = ledger.filter((e) => e.where === 'on_device').length;

  function setDoc<K extends DocKind>(kind: K, facts: Dossier[K], origin: Origin) {
    dossierRef.current = { ...dossierRef.current, [kind]: facts };
    setDossier(dossierRef.current);
    setOrigins((o) => ({ ...o, [kind]: origin }));
  }
  // Keeps sequential extractions from overwriting each other.
  const dossierRef = useRef(dossier);
  dossierRef.current = dossier;

  async function readText(kind: DocKind, text: string) {
    if (!ai) throw new Error('Firebase is not configured, so the AI cannot read files. Type the fields instead.');
    const { extractDocument } = await import('../core/extract/extract');
    const res = await extractDocument(ai, kind, text, { consentToCloud: consent });
    setDoc(kind, res.facts, res.source);
  }

  async function onFile(kind: DocKind, file: File) {
    setError(undefined);
    setBusy(`Reading ${DOC_LABELS[kind].toLowerCase()} on this device…`);
    try {
      const { fileToText } = await import('../core/extract/pdfText');
      await readText(kind, await fileToText(file));
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy(null);
    }
  }

  async function loadSample(read: boolean) {
    setError(undefined);
    const s = sampleDossier(appDate);
    setTrip(s.trip);
    if (!read || !ai) {
      setDossier(s.dossier);
      setOrigins(Object.fromEntries(Object.keys(s.dossier).map((k) => [k, 'sample'])) as Record<DocKind, Origin>);
      return;
    }
    setDossier({});
    dossierRef.current = {};
    setOrigins({});
    // pdf.js and pdf-lib are big: load them only when the sample is used.
    const [{ pdfToText }, { SAMPLE_FILES, samplePdf }] = await Promise.all([
      import('../core/extract/pdfText'),
      import('../core/sample/samplePdfs'),
    ]);
    try {
      for (const kind of Object.keys(SAMPLE_FILES) as DocKind[]) {
        setBusy(`Gemini Nano is reading the sample ${DOC_LABELS[kind].toLowerCase()}…`);
        const bytes = await samplePdf(kind, appDate);
        await readText(kind, await pdfToText(bytes.slice().buffer as ArrayBuffer));
      }
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy(null);
    }
  }

  async function downloadSamples() {
    const { SAMPLE_FILES, samplePdf } = await import('../core/sample/samplePdfs');
    for (const kind of Object.keys(SAMPLE_FILES) as DocKind[]) {
      const bytes = await samplePdf(kind, appDate);
      const url = URL.createObjectURL(new Blob([bytes.slice()], { type: 'application/pdf' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: SAMPLE_FILES[kind] });
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function explainError(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e);
    if (/on.?device|only_on_device|not available|LanguageModel/i.test(msg)) {
      return 'Gemini Nano is not available in this browser, and private documents are only read on-device. Tick “Allow the cloud to read my documents” to continue, or type the fields by hand.';
    }
    return msg;
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-5xl leading-[0.95] font-medium tracking-[-0.03em] text-gray-900 sm:text-6xl">Check my dossier</h1>
            <p className="mt-1 text-sm text-gray-600">
              {DESTINATIONS[trip.destination]} · {PURPOSES[trip.purpose]} · {pretty(trip.entryDate)} → {pretty(trip.exitDate)}{' '}
              <a href="#/trip" className="text-stamp underline">
                edit trip
              </a>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => loadSample(true)} disabled={!!busy} className="inline-flex items-center gap-2 bg-stamp px-5 py-3 text-sm font-semibold text-white hover:bg-stamp-dark disabled:opacity-50">
              <IconPlay size={14} /> Try the sample dossier
            </button>
            <button onClick={downloadSamples} className="border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Download sample PDFs
            </button>
            <button onClick={() => { setDossier({}); setOrigins({}); }} className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100">
              Clear
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 bg-gray-50 p-3 text-xs text-gray-700 sm:grid-cols-3">
          <p>
            <strong>Gemini Nano:</strong> {nano === 'available' ? 'ready on this device' : nano === 'downloadable' || nano === 'downloading' ? 'prepare it on the AI status page' : 'not available here'}
          </p>
          <p>
            <strong>Privacy ledger:</strong> {deviceCalls} on-device · <span className={cloudCalls ? 'font-bold text-sky-700' : ''}>{cloudCalls} cloud</span> call(s)
          </p>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-sky-700" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            Allow the cloud to read my documents
          </label>
        </div>
        {busy && <p className="mt-3 animate-pulse text-sm font-medium text-emerald-800">{busy}</p>}
        {error && <p className="mt-3 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-500">Your documents</h2>
          {kinds.map((kind) => (
            <DocCard key={kind} kind={kind} facts={dossier[kind]} origin={origins[kind]} disabled={!!busy} onFile={(f) => onFile(kind, f)} onEdit={(facts) => setDoc(kind, facts, 'manual')} />
          ))}
        </div>
        <div className="space-y-3 lg:col-span-3">
          <h2 className="text-lg font-semibold text-gray-500">Result</h2>
          <Score sum={sum} />
          {findings.map((f) => (
            <FindingCard key={f.id} f={f} lib={lib} ai={ai} />
          ))}
        </div>
      </div>

      <LetterPanel ai={ai} trip={trip} dossier={dossier} />
      <LedgerPanel />
    </div>
  );
}

function Score({ sum }: { sum: Record<Status, number> }) {
  const total = sum.pass + sum.warn + sum.fail + sum.missing;
  const ready = sum.fail === 0 && sum.missing === 0;
  return (
    <div className={`px-6 py-5 ${ready ? 'bg-emerald-700 text-white' : sum.fail ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <p className="text-2xl font-bold">{ready ? 'Ready to submit' : sum.fail ? `${sum.fail} problem${sum.fail > 1 ? 's' : ''} to fix` : 'Add your documents'}</p>
      <p className="mt-1 text-sm opacity-90">
        {sum.pass}/{total} checks passed · {sum.warn} to double-check · {sum.missing} missing
      </p>
    </div>
  );
}

function FindingCard({ f, lib, ai }: { f: Finding; lib: Library; ai: AI | null }) {
  const [exp, setExp] = useState<{ text: string; source: 'on_device' | 'in_cloud' }>();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>();
  const refusal = f.refusalReason ? lib.facts.find((x) => x.id === `refusal.${f.refusalReason}`) : undefined;

  async function explain() {
    if (!ai) return;
    setLoading(true);
    setErr(undefined);
    try {
      const { explainFinding } = await import('../core/ai/assist');
      setExp(await explainFinding(ai, f, lib));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`border-l-4 bg-white p-5 ${f.status === 'fail' ? 'border-red-700' : f.status === 'warn' ? 'border-amber-500' : f.status === 'pass' ? 'border-emerald-700' : 'border-gray-300'}`}>
      <div className="flex gap-3">
        <StatusDot status={f.status} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{f.title}</p>
          <p className="mt-0.5 text-sm text-gray-600">{f.detail}</p>
          {f.status !== 'pass' && f.fix && <p className="mt-1.5 flex gap-1.5 text-sm text-gray-900"><IconArrow size={16} className="mt-0.5 shrink-0 text-emerald-700" /> <span>{f.fix}</span></p>}
          {f.status !== 'pass' && (refusal || f.consequence) && (
            <p className="mt-2 inline-block bg-red-50 px-2 py-1 text-xs font-medium text-red-800">
              {refusal ? `Risk — ${refusal.statement}` : f.consequence}
            </p>
          )}
          <FactChips ids={f.refusalReason ? [...f.factIds.filter((id) => id !== `refusal.${f.refusalReason}`), `refusal.${f.refusalReason}`] : f.factIds} lib={lib} />
          {f.status === 'fail' && ai && !exp && (
            <button onClick={explain} disabled={loading} className="mt-2 inline-flex text-sm font-semibold text-stamp hover:underline disabled:opacity-50">
              {loading ? 'Explaining…' : 'Explain this'}
            </button>
          )}
          {exp && (
            <div className="mt-2 bg-emerald-50 p-3 text-sm text-gray-800">
              <SourceBadge source={exp.source} />
              <p className="mt-1 whitespace-pre-wrap">{exp.text}</p>
            </div>
          )}
          {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
        </div>
      </div>
    </div>
  );
}

const fieldInput = 'w-full border border-gray-300 px-2 py-1 text-xs focus:border-emerald-600 focus:outline-none';

function DocCard<K extends DocKind>({ kind, facts, origin, disabled, onFile, onEdit }: { kind: K; facts: Dossier[K]; origin?: Origin; disabled: boolean; onFile: (f: File) => void; onEdit: (f: Dossier[K]) => void }) {
  const [open, setOpen] = useState(false);
  const props = DOC_SCHEMAS[kind].schema.properties as Record<string, { type: string; description?: string }>;
  const values = (facts ?? {}) as Record<string, unknown>;
  const filled = Object.keys(values).length;

  const set = (key: string, v: unknown) => {
    const next = { ...values };
    if (v === '' || v === undefined || (typeof v === 'number' && Number.isNaN(v))) delete next[key];
    else next[key] = v;
    onEdit(next as Dossier[K]);
  };

  return (
    <div className="bg-white px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setOpen(!open)} className="text-left">
          <p className="text-sm font-semibold text-gray-900">
            <IconChevron size={14} className={`inline align-[-2px] transition-transform ${open ? 'rotate-90' : ''}`} /> {DOC_LABELS[kind]}
          </p>
          <p className="text-xs text-gray-500">{filled ? `${filled} field(s)` : 'not added'}</p>
        </button>
        <div className="flex items-center gap-2">
          <SourceBadge source={origin} />
          <label className={`cursor-pointer bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-stamp ${disabled ? 'pointer-events-none opacity-40' : ''}`}>
            Read file
            <input type="file" accept="application/pdf,.pdf,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
          </label>
        </div>
      </div>
      {open && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {Object.entries(props).map(([key, spec]) => {
            const v = values[key];
            const lbl = <span className="text-xs font-semibold uppercase text-gray-500">{key.replace(/([A-Z])/g, ' $1')}</span>;
            if (spec.type === 'boolean')
              return (
                <label key={key} className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={v === true} onChange={(e) => set(key, e.target.checked)} className="accent-emerald-700" /> {lbl}
                </label>
              );
            if (spec.type === 'array')
              return (
                <label key={key} className="col-span-2">
                  {lbl}
                  <input className={fieldInput} placeholder="2026-08, 2026-09, 2026-10" defaultValue={Array.isArray(v) ? v.join(', ') : ''} onBlur={(e) => set(key, e.target.value.split(/[,\s]+/).filter((m) => /^\d{4}-\d{2}$/.test(m)))} key={Array.isArray(v) ? v.join() : ''} />
                </label>
              );
            const isDate = spec.description?.startsWith('YYYY-MM-DD');
            return (
              <label key={key} className={isDate || spec.type === 'number' ? '' : 'col-span-2'}>
                {lbl}
                <input
                  className={fieldInput}
                  type={isDate ? 'date' : spec.type === 'number' ? 'number' : 'text'}
                  value={v === undefined ? '' : String(v)}
                  onChange={(e) => set(key, spec.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LedgerPanel() {
  const ledger = useSyncExternalStore(subscribe, getLedger);
  return (
    <Card>
      <h2 className="text-3xl leading-tight font-medium text-gray-900">Privacy ledger</h2>
      <p className="mt-1 text-sm text-gray-600">Every AI call made in this session, and exactly what went to the cloud. Nothing here is stored.</p>
      {ledger.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No AI call yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {ledger.map((e) => (
            <li key={e.id} className="py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400">{e.at}</span>
                <SourceBadge source={e.where === 'blocked' ? undefined : e.where} />
                <span className="font-medium text-gray-800">{e.task}</span>
                <span className="text-xs text-gray-500">({e.dataClass})</span>
              </div>
              {e.payload ? (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs font-semibold text-sky-700">See exactly what the cloud received ({e.chars} characters)</summary>
                  <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap bg-gray-900 p-3 text-xs text-gray-100">{e.payload}</pre>
                </details>
              ) : (
                <p className="text-xs text-emerald-700">Stayed on this device — nothing sent.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
