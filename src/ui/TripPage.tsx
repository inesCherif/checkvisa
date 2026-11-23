import { useMemo } from 'react';
import type { Library } from '../core/data/library';
import { buildChecklist, SECTION_TITLES, type Section } from '../core/rules/checklist';
import { pretty, stayDays } from '../core/rules/dates';
import { meansRequired, toTnd, visaFee, type Rates } from '../core/rules/money';
import { ACCOMMODATIONS, DESTINATIONS, PURPOSES, STATUSES, type Trip } from '../core/rules/trip';
import { FactChips } from './shared';
import { destinationStat, percent } from '../core/data/stats';
import { IconArrow, IconCheck, IconNote, IconWarning } from './icons';

interface Props {
  trip: Trip;
  setTrip: (t: Trip) => void;
  lib: Library;
  rates: Rates;
  checked: string[];
  setChecked: (ids: string[]) => void;
}

const field = 'block w-full appearance-none border-0 border-b-2 border-gray-300 bg-transparent py-2 text-xl text-gray-900 transition-colors focus:border-ink focus:outline-none';

export function TripForm({ trip, setTrip }: { trip: Trip; setTrip: (t: Trip) => void }) {
  const set = <K extends keyof Trip>(k: K, v: Trip[K]) => setTrip({ ...trip, [k]: v });
  const select = <T extends Record<string, string>>(k: keyof Trip, options: T) => (
    <select className={field} value={String(trip[k])} onChange={(e) => set(k, e.target.value as Trip[typeof k])}>
      {Object.entries(options).map(([v, l]) => (
        <option key={v} value={v} className="bg-white">
          {l}
        </option>
      ))}
    </select>
  );
  const row = 'block text-[15px] text-gray-500';
  return (
    <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className={row}>Main destination</span>
        {select('destination', DESTINATIONS)}
      </label>
      <label className="sm:col-span-2">
        <span className={row}>Purpose of the trip</span>
        {select('purpose', PURPOSES)}
      </label>
      <label>
        <span className={row}>You arrive</span>
        <input type="date" className={field} value={trip.entryDate} onChange={(e) => set('entryDate', e.target.value)} />
      </label>
      <label>
        <span className={row}>You leave</span>
        <input type="date" className={field} value={trip.exitDate} min={trip.entryDate} onChange={(e) => set('exitDate', e.target.value)} />
      </label>
      <label className="sm:col-span-2">
        <span className={row}>Your situation in Tunisia</span>
        {select('status', STATUSES)}
      </label>
      <label>
        <span className={row}>Age</span>
        <input type="number" min={0} max={120} className={field} value={trip.age} onChange={(e) => set('age', Number(e.target.value))} />
      </label>
      <label>
        <span className={row}>Where you stay</span>
        {select('accommodation', ACCOMMODATIONS)}
      </label>
      <label className="flex cursor-pointer items-center gap-3 text-[17px] text-gray-800 sm:col-span-2">
        <input type="checkbox" className="h-5 w-5 accent-[#d51f28]" checked={trip.sponsored} onChange={(e) => set('sponsored', e.target.checked)} />
        Someone else pays for the trip (a host, a company, your parents)
      </label>
    </div>
  );
}

export default function TripPage({ trip, setTrip, lib, rates, checked, setChecked }: Props) {
  const items = useMemo(() => buildChecklist(trip, lib, rates), [trip, lib, rates]);
  const fee = visaFee(trip);
  const means = meansRequired(trip, lib, rates);
  const days = stayDays(trip.entryDate, trip.exitDate);
  const sections = [...new Set(items.map((i) => i.section))] as Section[];
  const docs = items.filter((i) => i.kind === 'document');
  const ready = docs.filter((d) => checked.includes(d.id)).length;
  const toggle = (id: string) => setChecked(checked.includes(id) ? checked.filter((c) => c !== id) : [...checked, id]);
  const stat = destinationStat(lib.stats, trip.destination);

  const numbers: Array<[string, string, string, boolean?]> = [
    [`${days} days`, 'in the Schengen area', `${pretty(trip.entryDate)} to ${pretty(trip.exitDate)}`, days > 90],
    [String(docs.length), 'documents to prepare', `${ready} ready so far`],
    [fee.eur === 0 ? 'Free' : `€${fee.eur}`, 'visa fee', fee.eur ? `about ${toTnd(fee.eur, 'EUR', rates)} TND, not refunded` : fee.label],
    [
      means.amount === null ? 'Case by case' : `${means.currency === 'EUR' ? '€' : 'CHF '}${Math.round(means.amount).toLocaleString('en-GB')}`,
      'money to show',
      means.amount === null ? DESTINATIONS[trip.destination] : `about ${toTnd(means.amount, means.currency, rates).toLocaleString('en-GB')} TND`,
    ],
  ];

  return (
    <div className="grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
      <div className="lg:sticky lg:top-8 lg:self-start">
        <h1 className="text-5xl leading-[0.95] font-medium sm:text-6xl">Your trip</h1>
        <p className="mt-4 max-w-md text-lg text-gray-600">These answers decide which official rules apply. They are not documents, and they stay in this browser.</p>
        <div className="mt-10">
          <TripForm trip={trip} setTrip={setTrip} />
        </div>
      </div>

      <div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-8">
          {numbers.map(([value, label, sub, warn]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className={`text-4xl leading-none font-medium tracking-[-0.03em] sm:text-5xl ${warn ? 'text-red-700' : 'text-gray-900'}`}>{value}</dd>
              <dd className="mt-2 text-gray-700">{label}</dd>
              <dd className="text-sm text-gray-500">{sub}</dd>
            </div>
          ))}
        </dl>

        {stat && (
          <p className="mt-10 bg-gray-100 px-5 py-4 text-[17px] text-gray-800">
            In {stat.year}, <b className="font-semibold text-gray-900">{percent(stat.stat.rate)}</b> of the {stat.stat.applied.toLocaleString('en-GB')}{' '}
            applications to {DESTINATIONS[trip.destination]} lodged in Tunisia were not issued.{' '}
            <a href="#/stats" className="text-stamp underline underline-offset-4">
              Compare countries
            </a>
          </p>
        )}

        <div className="mt-16 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl leading-tight font-medium sm:text-4xl">Your checklist for {DESTINATIONS[trip.destination]}</h2>
            <p className="mt-2 text-gray-500">Tick what you already have. Open a source to read the official wording.</p>
          </div>
          <a href="#/check" className="inline-flex items-center gap-2 bg-stamp px-5 py-3 font-semibold text-white transition-transform hover:-translate-y-0.5">
            Check my documents <IconArrow size={16} />
          </a>
        </div>
        <div className="mt-6 h-1.5 bg-gray-200" role="progressbar" aria-valuemin={0} aria-valuemax={docs.length} aria-valuenow={ready} aria-label="Documents ready">
          <div className="h-full bg-ink transition-[width] duration-500" style={{ width: `${docs.length ? (ready / docs.length) * 100 : 0}%` }} />
        </div>

        <div className="mt-10 space-y-12">
          {sections.map((section) => (
            <section key={section}>
              <h3 className="text-lg font-semibold text-stamp">{SECTION_TITLES[section]}</h3>
              <ul className="mt-3">
                {items
                  .filter((i) => i.section === section)
                  .map((item) => {
                    const done = checked.includes(item.id);
                    return (
                      <li key={item.id} className="flex gap-4 py-4">
                        {item.kind === 'document' ? (
                          <button
                            type="button"
                            onClick={() => toggle(item.id)}
                            aria-pressed={done}
                            aria-label={`${done ? 'Untick' : 'Tick'} ${item.title}`}
                            className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center border-2 transition-colors ${done ? 'border-ok bg-ok text-white' : 'border-gray-400 hover:border-stamp'}`}
                          >
                            {done && <IconCheck size={14} strokeWidth={3} />}
                          </button>
                        ) : (
                          <span className={`mt-0.5 shrink-0 ${item.kind === 'warning' ? 'text-red-700' : 'text-sky-700'}`}>
                            {item.kind === 'warning' ? <IconWarning size={22} /> : <IconNote size={22} />}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className={`text-[17px] font-semibold transition-colors ${done ? 'text-gray-500 line-through decoration-1' : 'text-gray-900'}`}>{item.title}</p>
                          {item.detail && <p className="mt-1 text-gray-600">{item.detail}</p>}
                          <FactChips ids={item.factIds} lib={lib} />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
