// Visa fee and means of subsistence, computed from the dataset's facts (never hard-coded rules
// without a source: every amount below is read from a Fact value, and the fact id is returned).

import type { Library } from '../data/library';
import type { Fact } from '../data/schema';
import { stayDays } from './dates';
import type { Trip } from './trip';

export interface Rates {
  /** TND for 1 EUR. */
  tndPerEur: number;
  /** TND for 1 CHF. */
  tndPerChf: number;
  asOf: string;
  source: string;
}

/**
 * Fallback rates, overridden at runtime by Remote Config (`rate_tnd_per_eur`, `rate_tnd_per_chf`).
 * Approximate values; the app labels them "approximate" and links the Central Bank source.
 */
export const DEFAULT_RATES: Rates = {
  tndPerEur: 3.4,
  tndPerChf: 3.65,
  asOf: 'approximate',
  source: 'bct-exchange-rates',
};

export interface FeeResult {
  eur: number;
  label: string;
  factIds: string[];
}

export function visaFee(trip: Trip): FeeResult {
  if (trip.age < 6) return { eur: 0, label: 'Free: children under 6', factIds: ['fee-waiver.child-under-6'] };
  if (trip.status === 'student' && trip.purpose === 'study') {
    return { eur: 0, label: 'Free: students travelling for study or educational training', factIds: ['fee-waiver.students'] };
  }
  if (trip.purpose === 'research') {
    return { eur: 0, label: 'Free: researchers travelling for research or a scientific event', factIds: ['fee-waiver.researchers'] };
  }
  if (trip.age <= 11) return { eur: 45, label: 'Child aged 6–11', factIds: ['fee.child-6-11', 'fee.regulation-2024'] };
  return { eur: 90, label: 'Adult', factIds: ['fee.adult', 'fee.regulation-2024'] };
}

export interface MeansResult {
  /** null when the state sets no fixed amount (case-by-case). */
  amount: number | null;
  currency: 'EUR' | 'CHF';
  days: number;
  explanation: string;
  factId: string;
  /** Amount converted to EUR (CHF → EUR via TND rates), for comparison with bank balances. */
  amountEur: number | null;
}

type Num = Record<string, number>;

function italyTotal(days: number, solo: Record<string, Num>): number {
  const band = days <= 5 ? solo['1-5'] : days <= 10 ? solo['6-10'] : days <= 20 ? solo['11-20'] : solo['21+'];
  return (band.fixed ?? 0) + (band.perDay ?? 0) * (days <= 5 ? 0 : days);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function meansRequired(trip: Trip, lib: Library, rates: Rates = DEFAULT_RATES): MeansResult {
  const days = stayDays(trip.entryDate, trip.exitDate);
  const factId = `means.${trip.destination.toLowerCase()}`;
  const fact: Fact | undefined = lib.facts.find((f) => f.id === factId);
  const v = (fact?.value ?? {}) as Record<string, unknown>;
  const n = (k: string) => Number(v[k]);
  let amount: number | null = null;
  let currency: 'EUR' | 'CHF' = 'EUR';
  let explanation = '';

  switch (trip.destination) {
    case 'FR': {
      const perDay = trip.accommodation === 'hotel' ? n('hotel') : trip.accommodation === 'host' ? n('host') : n('noAccommodation');
      amount = perDay * days;
      explanation = `EUR ${perDay} per day × ${days} days`;
      break;
    }
    case 'IT': {
      amount = italyTotal(days, v.solo as Record<string, Num>);
      explanation = `Italian table A (one traveller) for ${days} days`;
      break;
    }
    case 'DE':
      amount = n('fallbackPerDay') * days;
      explanation = `about EUR ${n('fallbackPerDay')} per day × ${days} days (Germany decides case by case)`;
      break;
    case 'ES':
      amount = Math.max(n('perDay') * days, n('minimumTotal'));
      explanation = `EUR ${n('perDay')} per day × ${days} days, minimum EUR ${n('minimumTotal')}`;
      break;
    case 'BE': {
      const perDay = trip.accommodation === 'host' ? n('host') : n('hotel');
      amount = perDay * days;
      explanation = `about EUR ${perDay} per day × ${days} days`;
      break;
    }
    case 'CH': {
      const perDay = trip.status === 'student' ? n('studentPerDay') : n('perDay');
      amount = perDay * days;
      currency = 'CHF';
      explanation = `about CHF ${perDay} per day × ${days} days`;
      break;
    }
    case 'NL':
      amount = n('perDay') * days;
      explanation = `EUR ${n('perDay')} per day × ${days} days`;
      break;
    case 'PT':
      amount = n('perEntry') + n('perDay') * days;
      explanation = `EUR ${n('perEntry')} per entry + EUR ${n('perDay')} × ${days} days`;
      break;
    case 'GR':
      amount = Math.max(n('perDay') * days, days <= 5 ? n('minimumUpTo5Days') : 0);
      explanation = `EUR ${n('perDay')} per day × ${days} days${days <= 5 ? `, minimum EUR ${n('minimumUpTo5Days')}` : ''}`;
      break;
    case 'AT':
      explanation = 'Austria sets no reference amount; the consulate decides case by case.';
      break;
  }
  if (amount !== null && Number.isNaN(amount)) amount = null;
  const amountEur =
    amount === null ? null : currency === 'EUR' ? round2(amount) : round2((amount * rates.tndPerChf) / rates.tndPerEur);
  return { amount: amount === null ? null : round2(amount), currency, days, explanation, factId, amountEur };
}

export function toTnd(amount: number, currency: 'EUR' | 'CHF', rates: Rates = DEFAULT_RATES): number {
  return Math.round(amount * (currency === 'EUR' ? rates.tndPerEur : rates.tndPerChf));
}
