// "Every answer quotes the law", shown on the sample passport's real dates.
// A date axis puts the passport's expiry against the date it must still be valid (3 months after
// leaving). Moving the trip or renewing the passport re-runs the app's real rule engine.

import { useMemo, useState } from 'react';
import { runChecks } from '../core/rules/checks';
import { addDays, addMonths, addYears, parse, pretty, type ISODate } from '../core/rules/dates';
import { DEFAULT_RATES } from '../core/rules/money';
import { sampleDossier } from '../core/sample/sampleDossier';
import type { Library } from '../core/data/library';

const DAY = 86_400_000;

export default function PassportTimeline({ lib, day }: { lib: Library; day: ISODate }) {
  const base = useMemo(() => sampleDossier(day), [day]);
  const length = (parse(base.trip.exitDate) - parse(base.trip.entryDate)) / DAY;
  const startOffset = (parse(base.trip.entryDate) - parse(day)) / DAY;
  const [offset, setOffset] = useState(startOffset);
  const [renewed, setRenewed] = useState(false);

  const entry = addDays(day, offset);
  const exit = addDays(entry, length);
  const expiry = renewed ? addYears(day, 10) : base.dossier.passport!.expiryDate!;
  const required = addMonths(exit, 3);

  // The verdict comes from the same engine the app uses.
  const finding = useMemo(() => {
    const dossier = { ...base.dossier, passport: { ...base.dossier.passport!, expiryDate: expiry } };
    const trip = { ...base.trip, entryDate: entry, exitDate: exit };
    return runChecks(dossier, { trip, lib, applicationDate: day, rates: DEFAULT_RATES }).find((f) => f.id === 'passport.validity');
  }, [base, entry, exit, expiry, lib, day]);
  const fact = lib.facts.find((f) => f.id === 'passport.validity-after-exit');
  const ok = finding?.status === 'pass';

  // Axis: from today to a little after the latest date that matters.
  const axisStart = parse(day);
  const axisEnd = Math.max(parse(addMonths(addDays(day, startOffset + 75 + length), 3)), parse(base.dossier.passport!.expiryDate!)) + 20 * DAY;
  const pct = (d: ISODate) => Math.min(100, Math.max(0, ((parse(d) - axisStart) / (axisEnd - axisStart)) * 100));
  const short = Math.round((parse(required) - parse(expiry)) / DAY);

  const months: Array<{ label: string; at: number }> = [];
  const m = new Date(axisStart);
  m.setUTCDate(1);
  m.setUTCMonth(m.getUTCMonth() + 1);
  while (m.getTime() < axisEnd) {
    months.push({ label: m.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }), at: ((m.getTime() - axisStart) / (axisEnd - axisStart)) * 100 });
    m.setUTCMonth(m.getUTCMonth() + 1);
  }

  return (
    <section className="lp-law" aria-labelledby="law-title">
      <div className="lp-law-head">
        <h2 id="law-title" data-split>
          Every answer quotes the law.
        </h2>
        <div data-reveal>
          <p>
            Here is the first problem from the lamp, on the sample passport's own dates. Move the trip or renew the passport: the same rule engine as
            the app checks it again, here, as you drag.
          </p>
        </div>
      </div>

      <div className="lp-tl" data-ui>
        <div className="lp-tl-row">
          <span className="lp-tl-name">Your trip</span>
          <div className="lp-tl-lane">
            <span className="lp-tl-trip" style={{ left: `${pct(entry)}%`, width: `${Math.max(0.6, pct(exit) - pct(entry))}%` }} />
            <span className="lp-tl-label" style={{ left: `${pct(exit)}%` }}>
              Leave {pretty(exit)}
            </span>
          </div>
        </div>
        <div className="lp-tl-row">
          <span className="lp-tl-name">Passport</span>
          <div className="lp-tl-lane">
            <span className="lp-tl-pass" style={{ width: `${pct(expiry)}%` }} />
            <span className="lp-tl-label" style={{ left: `${pct(expiry)}%` }}>
              {renewed ? `Valid until ${pretty(expiry)}` : `Expires ${pretty(expiry)}`}
            </span>
          </div>
        </div>
        <div className="lp-tl-row">
          <span className="lp-tl-name">The rule</span>
          <div className="lp-tl-lane">
            <span className={`lp-tl-need${ok ? ' ok' : ''}`} style={{ left: `${pct(exit)}%`, width: `${pct(required) - pct(exit)}%` }} />
            {!ok && short > 0 && (
              <span className="lp-tl-gap" style={{ left: `${pct(expiry)}%`, width: `${pct(required) - pct(expiry)}%` }}>
                {short} days short
              </span>
            )}
            <span className="lp-tl-label" style={{ left: `${pct(required)}%` }}>
              Valid until {pretty(required)}
            </span>
          </div>
        </div>
        <div className="lp-tl-months" aria-hidden="true">
          {months.map((mo) => (
            <span key={mo.at} style={{ left: `${mo.at}%` }}>
              {mo.label}
            </span>
          ))}
        </div>
      </div>

      <div className="lp-law-foot">
        {fact && (
          <blockquote>
            <p>“{fact.quote}.”</p>
            <cite>
              EU Visa Code, {fact.locator}, Regulation (EC) No 810/2009.{' '}
              <a href={lib.sourceById.get(fact.sourceId)?.url} target="_blank" rel="noreferrer">
                Read the article
              </a>
            </cite>
          </blockquote>
        )}
        <div className="lp-law-verdict" aria-live="polite">
          <p className={`lp-verdict ${ok ? 'ok' : 'bad'}`}>{ok ? 'This passport is valid long enough.' : 'This passport would be refused.'}</p>
          <p>{finding?.detail}</p>
          {!ok && finding?.fix && <p className="lp-law-fix">{finding.fix}</p>}
          <label className="lp-range">
            <span>Move the trip</span>
            <input type="range" min={7} max={startOffset + 75} value={offset} onChange={(e) => setOffset(Number(e.target.value))} />
          </label>
          <button type="button" className={`lp-renew${renewed ? ' on' : ''}`} onClick={() => setRenewed(!renewed)} aria-pressed={renewed}>
            {renewed ? 'Back to the old passport' : 'Renew the passport'}
          </button>
        </div>
      </div>
    </section>
  );
}
