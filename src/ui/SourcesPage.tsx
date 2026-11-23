import { useEffect, useMemo, useState } from 'react';
import { bundledLibrary, type Library } from '../core/data/library';
import type { Authority, Source } from '../core/data/schema';
import { isFirebaseConfigured } from '../firebase/config';
import { getFirebase } from '../firebase/init';
import { loadLibraryFromFirestore } from '../firebase/library';
import { AUTHORITY } from './shared';


type Origin = 'bundle' | 'firestore';

export default function SourcesPage() {
  const [lib, setLib] = useState<Library>(() => bundledLibrary());
  const [origin, setOrigin] = useState<Origin>('bundle');
  const [filter, setFilter] = useState<Authority | 'all'>('all');

  // Prefer the live Firestore copy (updatable without redeploy); fall back to the bundled dataset.
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const { app, user } = getFirebase();
    user
      .then(() => loadLibraryFromFirestore(app))
      .then((live) => {
        if (live) {
          setLib(live);
          setOrigin('firestore');
        }
      })
      .catch(() => undefined);
  }, []);

  const shown = useMemo(
    () => lib.sources.filter((s) => filter === 'all' || s.authority === filter),
    [lib, filter],
  );
  const verified = lib.facts.filter((f) => f.status === 'verified').length;
  const authorities = [...new Set(lib.sources.map((s) => s.authority))];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h1 className="text-xl font-bold text-gray-900">Data library</h1>
        <p className="mt-1 text-sm text-gray-600">
          Every rule CheckVisa applies comes from an official source below, with the exact article and quote. Nothing
          depends on a single website: EU law, EU guidance, each destination's government, Commission statistics, the
          central bank and international standards.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Sources" value={lib.sources.length} />
          <Stat label="Kinds of publisher" value={authorities.length} />
          <Stat label="Facts" value={lib.facts.length} />
          <Stat label="Verified facts" value={`${Math.round((verified / lib.facts.length) * 100)}%`} />
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Dataset version {lib.version} · served from{' '}
          <strong>{origin === 'firestore' ? 'Firestore (live copy)' : 'the bundled dataset'}</strong>
        </p>
      </section>

      <StatsTable lib={lib} />

      <div className="flex flex-wrap gap-2">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
        {authorities.map((a) => (
          <FilterButton key={a} active={filter === a} onClick={() => setFilter(a)} label={AUTHORITY[a].label} />
        ))}
      </div>

      <div className="space-y-3">
        {shown.map((source) => (
          <SourceCard key={source.id} source={source} lib={lib} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium ${active ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-300'}`}
    >
      {label}
    </button>
  );
}

function SourceCard({ source, lib }: { source: Source; lib: Library }) {
  const [open, setOpen] = useState(false);
  const facts = lib.factsBySource.get(source.id) ?? [];
  const badge = AUTHORITY[source.authority];
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            source.status === 'verified' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
          }`}
        >
          {source.status === 'verified' ? 'Verified' : 'To verify'}
        </span>
        <span className="text-xs text-gray-500">refresh: {source.refresh}</span>
      </div>
      <h2 className="mt-2 text-sm font-semibold text-gray-900">{source.title}</h2>
      <p className="text-xs text-gray-600">{source.publisher}</p>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-gray-600 sm:grid-cols-2">
        {source.versionDate && <Row term="Version" value={source.versionDate} />}
        <Row term="Retrieved" value={source.retrievedAt} />
        {source.permanentId && <Row term="Permanent id" value={source.permanentId} />}
        {source.sha256 && <Row term="SHA-256" value={`${source.sha256.slice(0, 16)}…`} mono />}
        <Row term="Used for" value={source.usedFor} />
        <Row term="Licence" value={source.licence} />
      </dl>
      {source.notes && <p className="mt-2 text-xs text-orange-700">{source.notes}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <a href={source.url} target="_blank" rel="noreferrer" className="font-medium text-emerald-700 underline">
          Open source
        </a>
        {source.archiveUrl && (
          <a href={source.archiveUrl} target="_blank" rel="noreferrer" className="text-gray-600 underline">
            Archived copy
          </a>
        )}
        {facts.length > 0 && (
          <button onClick={() => setOpen(!open)} className="text-gray-700 underline">
            {open ? 'Hide' : 'Show'} {facts.length} facts
          </button>
        )}
      </div>
      {open && (
        <ul className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {facts.map((fact) => (
            <li key={fact.id} className="text-sm">
              <p className="text-gray-900">
                {fact.statement}{' '}
                {fact.status === 'to-verify' && <span className="text-xs text-orange-700">(to verify)</span>}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                <span className="font-medium">{fact.locator}</span> — “{fact.quote}”
              </p>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Row({ term, value, mono }: { term: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="inline font-medium text-gray-700">{term}: </dt>
      <dd className={`inline ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

function StatsTable({ lib }: { lib: Library }) {
  const latest = [...lib.stats].sort((a, b) => b.year - a.year)[0];
  const previous = lib.stats.find((s) => s.year < latest.year);
  if (!latest) return null;
  const prevRate = (state: string) => previous?.rows.find((r) => r.schengenState === state)?.notIssuedRate;
  const pct = (x: number | null | undefined) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`);
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">
        Schengen visas in Tunisia, {latest.year} — official European Commission data
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        {latest.totals.applied.toLocaleString('en')} applications · {latest.totals.notIssued.toLocaleString('en')} not
        issued ({pct(latest.totals.notIssuedRate)})
        {previous && <> · {previous.year}: {pct(previous.totals.notIssuedRate)}</>}. “Not issued” = refused or
        examination discontinued.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="text-xs text-gray-500">
            <tr>
              <th className="py-1 pr-3">Consulate in Tunis</th>
              <th className="py-1 pr-3 text-right">Applications</th>
              <th className="py-1 pr-3 text-right">Not issued {latest.year}</th>
              {previous && <th className="py-1 text-right">{previous.year}</th>}
            </tr>
          </thead>
          <tbody>
            {latest.rows.slice(0, 10).map((r) => (
              <tr key={r.schengenState} className="border-t border-gray-100">
                <td className="py-1.5 pr-3 text-gray-900">{r.schengenState}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{r.applied.toLocaleString('en')}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{pct(r.notIssuedRate)}</td>
                {previous && <td className="py-1.5 text-right tabular-nums text-gray-500">{pct(prevRate(r.schengenState))}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
