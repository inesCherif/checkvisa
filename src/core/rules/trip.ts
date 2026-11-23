// The trip profile: the non-identifying facts that decide which rules apply.
// Data class TRIP_FACTS — safe to keep in localStorage and to send to the cloud (cover letter).

import type { ISODate } from './dates';

export const DESTINATIONS = {
  FR: 'France',
  IT: 'Italy',
  DE: 'Germany',
  ES: 'Spain',
  BE: 'Belgium',
  NL: 'Netherlands',
  CH: 'Switzerland',
  AT: 'Austria',
  PT: 'Portugal',
  GR: 'Greece',
} as const;
export type Destination = keyof typeof DESTINATIONS;

export const PURPOSES = {
  tourism: 'Tourism',
  family: 'Family or friends visit',
  business: 'Business',
  study: 'Study / educational training',
  research: 'Research / scientific conference',
  event: 'Cultural, sports or training event',
  medical: 'Medical treatment',
} as const;
export type Purpose = keyof typeof PURPOSES;

export const STATUSES = {
  employee: 'Employee (private sector)',
  'civil-servant': 'Civil servant',
  student: 'Student / pupil',
  pensioner: 'Pensioner',
  farmer: 'Farmer',
  'self-employed': 'Self-employed / business owner',
  other: 'Other / no income',
} as const;
export type Status = keyof typeof STATUSES;

export const ACCOMMODATIONS = {
  hotel: 'Hotel or rental booking',
  host: 'Staying with a host (family / friends)',
  none: 'Not booked yet',
} as const;
export type Accommodation = keyof typeof ACCOMMODATIONS;

export interface Trip {
  destination: Destination;
  purpose: Purpose;
  status: Status;
  entryDate: ISODate;
  exitDate: ISODate;
  age: number;
  accommodation: Accommodation;
  /** Someone else (host, company, parents) pays for the trip. */
  sponsored: boolean;
}

export function defaultTrip(todayIso: ISODate): Trip {
  const [y, m] = todayIso.split('-').map(Number);
  // Default: a 10-day trip about two months from now.
  const start = new Date(Date.UTC(y, m + 1, 10)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m + 1, 19)).toISOString().slice(0, 10);
  return {
    destination: 'FR',
    purpose: 'tourism',
    status: 'employee',
    entryDate: start,
    exitDate: end,
    age: 28,
    accommodation: 'hotel',
    sponsored: false,
  };
}
