import { useMemo } from 'react';
import type { Library } from '../core/data/library';
import { percent, statsByState } from '../core/data/stats';
import { Card } from './shared';

const YEAR_STYLE = ['bg-gray-300', 'bg-emerald-600'];

export default function StatsPage({ lib }: { lib: Library }) {
  const { years, states } = useMemo(() => statsByState(lib.stats), [lib]);
  const latest = lib.stats.find((s) => s.year === years[years.length - 1])!;
  const max = Math.max(...states.flatMap((s) => years.map((y) => s.byYear[y]?.rate ?? 0)));
  const source = lib.sourceById.get(latest.sourceId);

  return (
    <div className="space-y-6">
      <Card>
        <h1 className="text-xl font-bold text-gray-900">How often are Schengen visas not issued in Tunisia?</h1>
        <p className="mt-1 text-sm text-gray-600">
          Short-stay visa applications lodged at Schengen consulates in Tunisia, from the European Commission's
          official statistics. In {latest.year}, <b>{latest.totals.applied.toLocaleString('en-GB')}</b> applications were
          lodged and <b>{percent(latest.totals.notIssuedRate)}</b> were not issued.
        </p>
        <p className="mt-2 text-xs text-gray-500">{latest.definitions.notIssued}</p>
        <div className="mt-3 flex gap-4 text-xs text-gray-600">
          {years.map((y, i) => (
            <span key={y} className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${YEAR_STYLE[i % 2]}`} /> {y}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <table className="w-full text-sm">
          <caption className="sr-only">Share of applications not issued, per Schengen state and year</caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="pb-2 font-medium">Schengen state</th>
              <th className="pb-2 font-medium">Not issued</th>
              <th className="hidden pb-2 text-right font-medium sm:table-cell">Applications {years[years.length - 1]}</th>
            </tr>
          </thead>
          <tbody>
            {states.map((s) => (
              <tr key={s.state} className="border-t border-gray-100 align-middle">
                <td className="w-36 py-2 pr-3 font-medium text-gray-800">{s.state}</td>
                <td className="py-2">
                  <div className="space-y-1">
                    {years.map((y, i) => {
                      const r = s.byYear[y]?.rate ?? null;
                      return (
                        <div key={y} className="flex items-center gap-2">
                          <div className="h-2.5 flex-1 rounded-full bg-gray-50">
                            <div
                              className={`h-2.5 rounded-full ${YEAR_STYLE[i % 2]}`}
                              style={{ width: r === null ? 0 : `${(r / max) * 100}%` }}
                            />
                          </div>
                          <span className="w-12 text-right text-xs tabular-nums text-gray-700">{percent(r)}</span>
                        </div>
                      );
                    })}
                  </div>
                </td>
                <td className="hidden py-2 pl-3 text-right tabular-nums text-gray-700 sm:table-cell">
                  {(s.byYear[years[years.length - 1]]?.applied ?? 0).toLocaleString('en-GB')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-gray-500">
        Source:{' '}
        <a className="underline" href={latest.sourceUrl} target="_blank" rel="noreferrer">
          {source?.title ?? 'European Commission visa statistics'}
        </a>{' '}
        · retrieved {latest.retrievedAt} · file SHA-256 {latest.sha256.slice(0, 12)}…. A high rate is not a prediction for
        your own application; most refusals cite a missing or weak document, which is what CheckVisa helps you catch.
      </p>
    </div>
  );
}
