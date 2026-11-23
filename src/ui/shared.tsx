import type { ReactNode } from 'react';
import type { Library } from '../core/data/library';
import type { Authority } from '../core/data/schema';
import type { Status } from '../core/rules/checks';
import { IconCheck, IconCross, IconQuestion, IconWarning } from './icons';

export const AUTHORITY: Record<Authority, { label: string; className: string }> = {
  'eu-law': { label: 'EU law', className: 'bg-indigo-100 text-indigo-800' },
  'eu-guidance': { label: 'EU guidance', className: 'bg-violet-100 text-violet-800' },
  'national-official': { label: 'National official', className: 'bg-emerald-100 text-emerald-800' },
  'visa-centre': { label: 'Visa centre', className: 'bg-amber-100 text-amber-800' },
  statistics: { label: 'Statistics', className: 'bg-sky-100 text-sky-800' },
  'central-bank': { label: 'Central bank', className: 'bg-teal-100 text-teal-800' },
  standard: { label: 'Standard', className: 'bg-gray-200 text-gray-800' },
  project: { label: 'Project', className: 'bg-gray-100 text-gray-600' },
};

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`bg-white p-6 sm:p-8 ${className}`}>{children}</section>;
}

/** Source chips: each fact shows its publisher kind; clicking opens the exact quote and locator. */
export function FactChips({ ids, lib }: { ids: string[]; lib: Library }) {
  const facts = ids.map((id) => lib.facts.find((f) => f.id === id)).filter((f) => f !== undefined);
  if (facts.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {facts.map((fact) => {
        const source = lib.sourceById.get(fact.sourceId);
        const auth = source ? AUTHORITY[source.authority] : AUTHORITY.project;
        return (
          <details key={fact.id} className="group text-xs">
            <summary className={`cursor-pointer list-none px-2 py-0.5 font-medium ${auth.className}`}>
              {auth.label} · {fact.locator}
              {fact.status === 'to-verify' && ' · to verify'}
            </summary>
            <div className="mt-1 max-w-xl border border-gray-200 bg-gray-50 p-3 text-gray-700">
              <p className="italic">“{fact.quote}”</p>
              {source && (
                <p className="mt-1 text-gray-500">
                  <a className="underline" href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                  </a>{' '}
                  · retrieved {source.retrievedAt}
                </p>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}

export const STATUS_STYLE: Record<Status, { icon: string; label: string; className: string; ring: string }> = {
  pass: { icon: '✓', label: 'OK', className: 'bg-emerald-600 text-white', ring: 'border-emerald-200' },
  warn: { icon: '!', label: 'Check', className: 'bg-amber-500 text-white', ring: 'border-amber-200' },
  fail: { icon: '✕', label: 'Problem', className: 'bg-red-600 text-white', ring: 'border-red-200' },
  missing: { icon: '?', label: 'Missing', className: 'bg-gray-400 text-white', ring: 'border-gray-200' },
};

export function StatusDot({ status }: { status: Status }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.className}`} title={s.label}>
      {status === 'pass' ? <IconCheck size={14} strokeWidth={2.4} /> : status === 'fail' ? <IconCross size={14} strokeWidth={2.4} /> : status === 'warn' ? <IconWarning size={14} strokeWidth={2.2} /> : <IconQuestion size={14} strokeWidth={2.2} />}
    </span>
  );
}

export function SourceBadge({ source }: { source: 'on_device' | 'in_cloud' | 'manual' | 'sample' | undefined }) {
  if (!source) return null;
  const map = {
    on_device: ['On this device · Gemini Nano', 'bg-emerald-100 text-emerald-800'],
    in_cloud: ['Cloud · Gemini', 'bg-sky-100 text-sky-800'],
    manual: ['Typed by you', 'bg-gray-100 text-gray-700'],
    sample: ['Sample data', 'bg-violet-100 text-violet-800'],
  } as const;
  const [label, cls] = map[source];
  return <span className={`px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
