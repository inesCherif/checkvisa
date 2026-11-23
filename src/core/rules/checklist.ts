// Step 3: turn a trip profile into the document checklist, using the harmonised list for Tunisia
// (Commission Decision C(2019) 3271, Annex VI), the Visa Code and the national pages.
// No AI here: rules are deterministic, and every line cites the facts it comes from.

import type { Library } from '../data/library';
import { stayDays } from './dates';
import { meansRequired, toTnd, visaFee, DEFAULT_RATES, type Rates } from './money';
import type { Trip } from './trip';

export type Section = 'travel-document' | 'insurance' | 'trip' | 'money' | 'situation' | 'purpose' | 'apply';

export const SECTION_TITLES: Record<Section, string> = {
  'travel-document': 'Passport',
  insurance: 'Travel medical insurance',
  trip: 'Travel and accommodation',
  money: 'Money for the stay',
  situation: 'Your situation in Tunisia',
  purpose: 'Purpose of the trip',
  apply: 'Fee and where to apply',
};

export interface ChecklistItem {
  id: string;
  section: Section;
  title: string;
  detail?: string;
  factIds: string[];
  /** 'info' lines are guidance (fee, centre), not documents to bring. */
  kind: 'document' | 'info' | 'warning';
}

const PURPOSE_FACT: Record<Trip['purpose'], string> = {
  tourism: 'documents.tn.tourism',
  family: 'documents.tn.family-visit',
  business: 'documents.tn.business',
  study: 'documents.tn.event',
  research: 'documents.tn.event',
  event: 'documents.tn.event',
  medical: 'documents.tn.medical',
};

const STATUS_FACT: Partial<Record<Trip['status'], string>> = {
  employee: 'documents.tn.employee',
  'civil-servant': 'documents.tn.civil-servant',
  student: 'documents.tn.student',
  pensioner: 'documents.tn.pensioner',
  farmer: 'documents.tn.farmer',
};

export function buildChecklist(trip: Trip, lib: Library, rates: Rates = DEFAULT_RATES): ChecklistItem[] {
  const fact = (id: string) => lib.facts.find((f) => f.id === id);
  const statement = (id: string) => fact(id)?.statement ?? id;
  const items: ChecklistItem[] = [];
  const add = (item: ChecklistItem) => items.push(item);
  const days = stayDays(trip.entryDate, trip.exitDate);

  if (days > 90) {
    add({ id: 'stay-too-long', section: 'trip', kind: 'warning', title: `Your stay is ${days} days: a short-stay visa allows at most 90 days in 180.`, factIds: ['stay-limit.90-180', 'refusal.4'] });
  }

  // Passport
  add({ id: 'passport', section: 'travel-document', kind: 'document', title: 'Valid passport', detail: [statement('passport.validity-after-exit'), statement('passport.max-age'), statement('passport.blank-pages')].join(' '), factIds: ['passport.validity-after-exit', 'passport.max-age', 'passport.blank-pages'] });

  // Insurance
  add({ id: 'insurance', section: 'insurance', kind: 'document', title: 'Travel medical insurance (at least EUR 30,000)', detail: [statement('insurance.territory-and-period'), statement('insurance.risks')].join(' '), factIds: ['insurance.min-cover', 'insurance.territory-and-period', 'insurance.risks'] });

  // Trip
  add({ id: 'round-trip', section: 'trip', kind: 'document', title: 'Round-trip reservation or ticket', detail: 'Dates must match the trip you declare.', factIds: ['documents.tn.round-trip'] });
  add({ id: 'accommodation', section: 'trip', kind: 'document', title: trip.accommodation === 'host' ? 'Invitation / proof of accommodation from your host' : 'Proof of accommodation for every night', detail: statement('documents.tn.accommodation'), factIds: ['documents.tn.accommodation'] });

  // Money
  add({ id: 'bank-statements', section: 'money', kind: 'document', title: 'Bank statements for the last 3 months', detail: 'Stamped statements with no missing month, in your name.', factIds: ['documents.tn.bank-statements'] });
  const means = meansRequired(trip, lib, rates);
  if (means.amount !== null) {
    add({ id: 'means-amount', section: 'money', kind: 'info', title: `Show at least ${means.currency} ${means.amount.toLocaleString('en-GB')} (≈ ${toTnd(means.amount, means.currency, rates).toLocaleString('en-GB')} TND)`, detail: `${means.explanation}. TND value at ${rates.asOf} rates.`, factIds: [means.factId, 'means.assessment'] });
  } else {
    add({ id: 'means-amount', section: 'money', kind: 'info', title: 'No fixed amount: show enough money for the whole stay', detail: means.explanation, factIds: [means.factId, 'means.assessment'] });
  }
  if (trip.sponsored) {
    add({ id: 'sponsor', section: 'money', kind: 'document', title: 'Sponsorship proof and the sponsor’s means', detail: statement('documents.tn.sponsor'), factIds: ['documents.tn.sponsor'] });
  }
  add({ id: 'other-means', section: 'money', kind: 'info', title: 'Other accepted means', detail: statement('documents.tn.other-means'), factIds: ['documents.tn.other-means'] });

  // Situation
  const statusFact = STATUS_FACT[trip.status];
  if (statusFact) {
    add({ id: `status-${trip.status}`, section: 'situation', kind: 'document', title: 'Proof of your situation', detail: statement(statusFact), factIds: [statusFact] });
  } else {
    add({ id: 'status-other', section: 'situation', kind: 'document', title: 'Proof of your ties and income in Tunisia', detail: `${statement('documents.supporting-categories')} Business owners usually add the company registration (RNE) and tax certificate.`, factIds: ['documents.supporting-categories', 'refusal.9'] });
  }
  if (trip.age < 18) {
    add({ id: 'minor-consent', section: 'situation', kind: 'document', title: 'Parental consent', detail: statement('documents.tn.minors'), factIds: ['documents.tn.minors'] });
  }

  // Purpose
  const purposeFact = PURPOSE_FACT[trip.purpose];
  add({ id: `purpose-${trip.purpose}`, section: 'purpose', kind: 'document', title: 'Documents for the purpose of your trip', detail: statement(purposeFact), factIds: [purposeFact] });

  // Fee & where to apply
  const fee = visaFee(trip);
  add({ id: 'fee', section: 'apply', kind: 'info', title: fee.eur === 0 ? `Visa fee: free (${fee.label})` : `Visa fee: EUR ${fee.eur} (≈ ${toTnd(fee.eur, 'EUR', rates)} TND) — ${fee.label}`, detail: `${statement('fee.non-refundable')} The visa centre adds its own service fee.`, factIds: [...fee.factIds, 'fee.non-refundable'] });
  const dest = trip.destination;
  const national = lib.facts.filter((f) => f.states?.includes(dest) && (f.topic === 'visa-centre' || f.topic === 'appointments' || (f.topic === 'documents' && f.id.startsWith(`documents.${dest.toLowerCase()}`))));
  for (const f of national) {
    add({ id: f.id, section: 'apply', kind: f.topic === 'documents' ? 'warning' : 'info', title: f.statement, factIds: [f.id] });
  }
  if (national.length === 0) {
    add({ id: 'centre-unknown', section: 'apply', kind: 'info', title: 'Check the embassy website for the visa centre and booking rules.', factIds: ['documents.supporting-categories'] });
  }
  return items;
}
