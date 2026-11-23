import { useMemo } from 'react';
import type { Library } from '../core/data/library';
import { buildChecklist, SECTION_TITLES, type Section } from '../core/rules/checklist';
import { pretty, stayDays } from '../core/rules/dates';
import { meansRequired, toTnd, visaFee, type Rates } from '../core/rules/money';
import { ACCOMMODATIONS, DESTINATIONS, PURPOSES, STATUSES, type Trip } from '../core/rules/trip';
import { Card, FactChips } from './shared';

interface Props {
  trip: Trip;
  setTrip: (t: Trip) => void;
  lib: Library;
  rates: Rates;
}

const label = 'block text-xs font-semibold uppercase tracking-wide text-gray-500';
const input = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none';

export function TripForm({ trip, setTrip }: { trip: Trip; setTrip: (t: Trip) => void }) {
  const set = <K extends keyof Trip>(k: K, v: Trip[K]) => setTrip({ ...trip, [k]: v });
  const select = <T extends Record<string, string>>(k: keyof Trip, options: T) => (
    <select className={input} value={String(trip[k])} onChange={(e) => set(k, e.target.value as Trip[typeof k])}>
      {Object.entries(options).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label>
        <span className={label}>Destination (main stay)</span>
        {select('destination', DESTINATIONS)}
      </label>
      <label>
        <span className={label}>Purpose</span>
        {select('purpose', PURPOSES)}
      </label>
      <label>
        <span className={label}>Arrival in Schengen</span>
        <input type="date" className={input} value={trip.entryDate} onChange={(e) => set('entryDate', e.target.value)} />
      </label>
      <label>
        <span className={label}>Departure from Schengen</span>
        <input type="date" className={input} value={trip.exitDate} min={trip.entryDate} onChange={(e) => set('exitDate', e.target.value)} />
      </label>
      <label>
        <span className={label}>Your situation in Tunisia</span>
        {select('status', STATUSES)}
      </label>
      <label>
        <span className={label}>Age</span>
        <input type="number" min={0} max={120} className={input} value={trip.age} onChange={(e) => set('age', Number(e.target.value))} />
      </label>
      <label>
        <span className={label}>Accommodation</span>
        {select('accommodation', ACCOMMODATIONS)}
      </label>
      <label className="flex items-end gap-2 pb-2 text-sm text-gray-700">
        <input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={trip.sponsored} onChange={(e) => set('sponsored', e.target.checked)} />
        Someone else pays for the trip (host, company, parents)
      </label>
    </div>
  );
}

export default function TripPage({ trip, setTrip, lib, rates }: Props) {
  const items = useMemo(() => buildChecklist(trip, lib, rates), [trip, lib, rates]);
  const fee = visaFee(trip);
  const means = meansRequired(trip, lib, rates);
  const days = stayDays(trip.entryDate, trip.exitDate);
  const sections = [...new Set(items.map((i) => i.section))] as Section[];
  const docs = items.filter((i) => i.kind === 'document').length;

  return (
    <div className="space-y-6">
      <Card>
        <h1 className="text-xl font-bold text-gray-900">Your trip</h1>
        <p className="mt-1 text-sm text-gray-600">
          These answers are not personal documents: they only decide which official rules apply. They stay in this browser.
        </p>
        <div className="mt-5">
          <TripForm trip={trip} setTrip={setTrip} />
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Stay" value={`${days} days`} sub={`${pretty(trip.entryDate)} → ${pretty(trip.exitDate)}`} warn={days > 90} />
        <Kpi label="Documents" value={String(docs)} sub="to prepare" />
        <Kpi label="Visa fee" value={fee.eur === 0 ? 'Free' : `€${fee.eur}`} sub={fee.eur ? `≈ ${toTnd(fee.eur, 'EUR', rates)} TND · non-refundable` : fee.label} />
        <Kpi
          label="Money to show"
          value={means.amount === null ? 'Case by case' : `${means.currency === 'EUR' ? '€' : 'CHF '}${Math.round(means.amount).toLocaleString('en-GB')}`}
          sub={means.amount === null ? DESTINATIONS[trip.destination] : `≈ ${toTnd(means.amount, means.currency, rates).toLocaleString('en-GB')} TND`}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900">Your checklist for {DESTINATIONS[trip.destination]}</h2>
          <a href="#/check" className="rounded-full bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800">
            Check my documents →
          </a>
        </div>
        <p className="mt-1 text-xs text-gray-500">Tap a source chip to read the exact official wording.</p>
        <div className="mt-4 space-y-6">
          {sections.map((section) => (
            <div key={section}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">{SECTION_TITLES[section]}</h3>
              <ul className="mt-2 divide-y divide-gray-100">
                {items
                  .filter((i) => i.section === section)
                  .map((item) => (
                    <li key={item.id} className="flex gap-3 py-3">
                      <span className="mt-0.5 text-base">{item.kind === 'document' ? '📄' : item.kind === 'warning' ? '⚠️' : 'ℹ️'}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                        {item.detail && <p className="mt-0.5 text-sm text-gray-600">{item.detail}</p>}
                        <FactChips ids={item.factIds} lib={lib} />
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${warn ? 'border-red-300' : 'border-gray-200'}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${warn ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}
