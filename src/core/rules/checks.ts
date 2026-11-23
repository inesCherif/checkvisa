// Step 4: the dossier checks. Deterministic rules — the AI only reads documents and explains
// results; it never decides pass/fail. Each finding names the fact it enforces and the refusal
// reason (Visa Code Annex VI) the problem typically leads to.

import { addMonths, addYears, cmp, monthOf, pretty, prettyMonth, shiftMonth, stayDays, type ISODate } from './dates';
import type { Dossier } from './dossier';
import type { Library } from '../data/library';
import { meansRequired, DEFAULT_RATES, type Rates } from './money';
import type { Trip } from './trip';

export type Status = 'pass' | 'warn' | 'fail' | 'missing';

export interface Finding {
  id: string;
  doc: keyof Dossier | 'trip' | 'identity';
  title: string;
  status: Status;
  detail: string;
  fix?: string;
  factIds: string[];
  /** Annex VI refusal reason number this problem typically leads to. */
  refusalReason?: number;
  /** Non-refusal consequence (e.g. application inadmissible). */
  consequence?: string;
}

/** Uppercase, strip accents and punctuation → set of name tokens. */
export function nameTokens(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort();
}

export type NameMatch = 'same' | 'partial' | 'different';

export function compareNames(a: string, b: string): NameMatch {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.join(' ') === tb.join(' ')) return 'same';
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (small.length > 0 && small.every((t) => big.includes(t))) return 'partial';
  return 'different';
}

export interface CheckContext {
  trip: Trip;
  lib: Library;
  /** Application date (defaults to today). */
  applicationDate: ISODate;
  rates?: Rates;
}

export function runChecks(d: Dossier, ctx: CheckContext): Finding[] {
  const { trip, applicationDate } = ctx;
  const rates = ctx.rates ?? DEFAULT_RATES;
  const out: Finding[] = [];
  const push = (f: Finding) => out.push(f);
  const { entryDate: entry, exitDate: exit } = trip;

  // ---- Trip length
  const days = stayDays(entry, exit);
  push(
    days > 90
      ? { id: 'trip.length', doc: 'trip', title: 'Stay length', status: 'fail', detail: `${days} days requested; the maximum is 90 days in any 180-day period.`, fix: 'Shorten the trip or apply for a national long-stay visa.', factIds: ['stay-limit.90-180'], refusalReason: 4 }
      : { id: 'trip.length', doc: 'trip', title: 'Stay length', status: 'pass', detail: `${days} days, within the 90/180 rule.`, factIds: ['stay-limit.90-180'] },
  );

  // ---- Passport
  const p = d.passport;
  if (!p?.expiryDate) {
    push({ id: 'passport.validity', doc: 'passport', title: 'Passport validity', status: 'missing', detail: 'Expiry date not provided.', factIds: ['passport.validity-after-exit'] });
  } else {
    const needed = addMonths(exit, 3);
    push(
      cmp(p.expiryDate, needed) >= 0
        ? { id: 'passport.validity', doc: 'passport', title: 'Passport validity', status: 'pass', detail: `Valid until ${pretty(p.expiryDate)}; needed until at least ${pretty(needed)}.`, factIds: ['passport.validity-after-exit'] }
        : { id: 'passport.validity', doc: 'passport', title: 'Passport validity', status: 'fail', detail: `Expires ${pretty(p.expiryDate)}, but it must be valid until at least ${pretty(needed)} (3 months after you leave).`, fix: 'Renew your passport before applying, or shorten the trip so you leave by ' + pretty(addMonths(p.expiryDate, -3)) + '.', factIds: ['passport.validity-after-exit'], consequence: 'The application is inadmissible (Visa Code Art. 19).' },
    );
  }
  if (p?.issueDate) {
    const oldest = addYears(applicationDate, -10);
    push(
      cmp(p.issueDate, oldest) >= 0
        ? { id: 'passport.age', doc: 'passport', title: 'Passport issued within 10 years', status: 'pass', detail: `Issued ${pretty(p.issueDate)}.`, factIds: ['passport.max-age'] }
        : { id: 'passport.age', doc: 'passport', title: 'Passport issued within 10 years', status: 'fail', detail: `Issued ${pretty(p.issueDate)}, more than 10 years before the application.`, fix: 'Apply with a new passport.', factIds: ['passport.max-age'], consequence: 'The application is inadmissible (Visa Code Art. 19).' },
    );
  }
  if (p?.blankPages !== undefined) {
    push(
      p.blankPages >= 2
        ? { id: 'passport.pages', doc: 'passport', title: 'Blank pages', status: 'pass', detail: `${p.blankPages} blank pages.`, factIds: ['passport.blank-pages'] }
        : { id: 'passport.pages', doc: 'passport', title: 'Blank pages', status: 'fail', detail: `Only ${p.blankPages} blank page(s); at least 2 are required.`, fix: 'Get a new passport.', factIds: ['passport.blank-pages'], consequence: 'The application is inadmissible (Visa Code Art. 19).' },
    );
  }
  if (p?.mrzValid === false) {
    push({ id: 'passport.mrz', doc: 'passport', title: 'Passport machine-readable zone', status: 'warn', detail: 'The MRZ check digits do not match — probably a reading error.', fix: 'Re-scan the passport photo page or type the fields by hand.', factIds: [] });
  }

  // ---- Insurance
  const ins = d.insurance;
  if (!ins) {
    push({ id: 'insurance.present', doc: 'insurance', title: 'Travel medical insurance', status: 'missing', detail: 'No insurance provided yet.', factIds: ['insurance.min-cover'], refusalReason: 7 });
  } else {
    if (ins.coverEur !== undefined) {
      push(
        ins.coverEur >= 30000
          ? { id: 'insurance.cover', doc: 'insurance', title: 'Insurance cover amount', status: 'pass', detail: `EUR ${ins.coverEur.toLocaleString('en-GB')} ≥ EUR 30,000.`, factIds: ['insurance.min-cover'] }
          : { id: 'insurance.cover', doc: 'insurance', title: 'Insurance cover amount', status: 'fail', detail: `Covers EUR ${ins.coverEur.toLocaleString('en-GB')}, below the EUR 30,000 minimum.`, fix: 'Buy a policy with at least EUR 30,000 of cover.', factIds: ['insurance.min-cover'], refusalReason: 7 },
      );
    }
    if (ins.startDate && ins.endDate) {
      const ok = cmp(ins.startDate, entry) <= 0 && cmp(ins.endDate, exit) >= 0;
      const gaps: string[] = [];
      if (cmp(ins.startDate, entry) > 0) gaps.push(`starts ${pretty(ins.startDate)}, after you arrive (${pretty(entry)})`);
      if (cmp(ins.endDate, exit) < 0) gaps.push(`ends ${pretty(ins.endDate)}, before you leave (${pretty(exit)})`);
      push(
        ok
          ? { id: 'insurance.period', doc: 'insurance', title: 'Insurance covers every day', status: 'pass', detail: `${pretty(ins.startDate)} → ${pretty(ins.endDate)} covers ${pretty(entry)} → ${pretty(exit)}.`, factIds: ['insurance.territory-and-period'] }
          : { id: 'insurance.period', doc: 'insurance', title: 'Insurance covers every day', status: 'fail', detail: `The policy ${gaps.join(' and ')}.`, fix: `Extend the policy to cover ${pretty(entry)} → ${pretty(exit)}.`, factIds: ['insurance.territory-and-period'], refusalReason: 7 },
      );
    }
    if (ins.allSchengen === false) {
      push({ id: 'insurance.territory', doc: 'insurance', title: 'Valid in all Schengen states', status: 'fail', detail: 'The policy does not cover the whole Schengen area.', fix: 'Choose a policy valid in all Schengen states.', factIds: ['insurance.territory-and-period'], refusalReason: 7 });
    }
    if (ins.repatriation === false) {
      push({ id: 'insurance.risks', doc: 'insurance', title: 'Medical repatriation covered', status: 'fail', detail: 'Repatriation for medical reasons is not covered.', fix: 'Choose a policy covering repatriation, urgent care, hospital treatment and death.', factIds: ['insurance.risks'], refusalReason: 7 });
    }
  }

  // ---- Bank statements: the last 3 months, consecutive
  const st = d.statements;
  const current = monthOf(applicationDate);
  const required = [shiftMonth(current, -3), shiftMonth(current, -2), shiftMonth(current, -1)];
  if (!st?.months?.length) {
    push({ id: 'statements.months', doc: 'statements', title: 'Bank statements — last 3 months', status: 'missing', detail: `Needed: ${required.map(prettyMonth).join(', ')}.`, factIds: ['documents.tn.bank-statements'], refusalReason: 3 });
  } else {
    const have = new Set(st.months);
    const missing = required.filter((m) => !have.has(m));
    const shiftedOk = missing.length === 1 && missing[0] === required[2] && have.has(shiftMonth(current, -4));
    push(
      missing.length === 0
        ? { id: 'statements.months', doc: 'statements', title: 'Bank statements — last 3 months', status: 'pass', detail: `${required.map(prettyMonth).join(', ')} all present.`, factIds: ['documents.tn.bank-statements'] }
        : shiftedOk
          ? { id: 'statements.months', doc: 'statements', title: 'Bank statements — last 3 months', status: 'warn', detail: `${prettyMonth(required[2])} is missing — fine only if your bank has not issued it yet.`, fix: `Ask the bank for a statement up to the current date.`, factIds: ['documents.tn.bank-statements'], refusalReason: 3 }
          : { id: 'statements.months', doc: 'statements', title: 'Bank statements — last 3 months', status: 'fail', detail: `You provided ${st.months.length} month(s); missing: ${missing.map(prettyMonth).join(', ')}.`, fix: `Ask your bank for stamped statements covering ${required.map(prettyMonth).join(', ')}.`, factIds: ['documents.tn.bank-statements'], refusalReason: 3 },
    );
  }
  const means = meansRequired(trip, ctx.lib, rates);
  if (st?.closingBalance !== undefined && means.amountEur !== null) {
    const balanceEur = st.currency === 'EUR' ? st.closingBalance : st.closingBalance / rates.tndPerEur;
    const pretty0 = (n: number) => Math.round(n).toLocaleString('en-GB');
    if (balanceEur >= means.amountEur) {
      push({ id: 'means.balance', doc: 'statements', title: 'Enough money for the stay', status: 'pass', detail: `Balance ≈ EUR ${pretty0(balanceEur)}; required ≈ EUR ${pretty0(means.amountEur)} (${means.explanation}).`, factIds: [means.factId, 'means.assessment'] });
    } else {
      push({ id: 'means.balance', doc: 'statements', title: 'Enough money for the stay', status: trip.sponsored ? 'warn' : 'fail', detail: `Balance ≈ EUR ${pretty0(balanceEur)}; required ≈ EUR ${pretty0(means.amountEur)} (${means.explanation}).`, fix: trip.sponsored ? 'Add the sponsor’s commitment and bank statements.' : 'Add savings, a sponsor (with their statements), or proof of the tourist allowance / international card.', factIds: [means.factId, 'means.assessment', 'documents.tn.other-means'], refusalReason: 3 });
    }
  }

  // ---- Employee documents
  if (trip.status === 'employee') {
    const ps = d.payslips;
    if (!ps?.months?.length) {
      push({ id: 'payslips.months', doc: 'payslips', title: 'Payslips — last 3 months', status: 'missing', detail: 'Employees must show the last 3 payslips.', factIds: ['documents.tn.employee'], refusalReason: 9 });
    } else {
      const have = new Set(ps.months);
      const lastThree = [-3, -2, -1].map((k) => shiftMonth(current, k));
      const prevThree = [-4, -3, -2].map((k) => shiftMonth(current, k));
      const ok = lastThree.every((m) => have.has(m)) || prevThree.every((m) => have.has(m));
      push(
        ok
          ? { id: 'payslips.months', doc: 'payslips', title: 'Payslips — last 3 months', status: 'pass', detail: `${ps.months.length} recent payslips.`, factIds: ['documents.tn.employee'] }
          : { id: 'payslips.months', doc: 'payslips', title: 'Payslips — last 3 months', status: 'fail', detail: `Have: ${ps.months.map(prettyMonth).join(', ')}. Needed: 3 consecutive recent months.`, fix: 'Ask your employer for the missing payslips.', factIds: ['documents.tn.employee'], refusalReason: 9 },
      );
    }
    const lv = d.leave;
    if (!lv?.startDate || !lv.endDate) {
      push({ id: 'leave.period', doc: 'leave', title: 'Leave authorisation', status: 'missing', detail: 'Employees need a leave or duty-travel authorisation.', factIds: ['documents.tn.employee'], refusalReason: 9 });
    } else {
      const ok = cmp(lv.startDate, entry) <= 0 && cmp(lv.endDate, exit) >= 0;
      push(
        ok
          ? { id: 'leave.period', doc: 'leave', title: 'Leave covers the trip', status: 'pass', detail: `${pretty(lv.startDate)} → ${pretty(lv.endDate)}.`, factIds: ['documents.tn.employee'] }
          : { id: 'leave.period', doc: 'leave', title: 'Leave covers the trip', status: 'fail', detail: `Leave ${pretty(lv.startDate)} → ${pretty(lv.endDate)} does not cover ${pretty(entry)} → ${pretty(exit)}.`, fix: 'Ask your employer to correct the leave dates.', factIds: ['documents.tn.employee'], refusalReason: 9 },
      );
    }
  }

  // ---- Booking
  const bk = d.booking;
  if (!bk?.outboundDate || !bk.returnDate) {
    push({ id: 'booking.dates', doc: 'booking', title: 'Round-trip booking', status: 'missing', detail: 'A round-trip reservation is required.', factIds: ['documents.tn.round-trip'], refusalReason: 2 });
  } else {
    const ok = bk.outboundDate === entry && bk.returnDate === exit;
    push(
      ok
        ? { id: 'booking.dates', doc: 'booking', title: 'Booking matches your dates', status: 'pass', detail: `${pretty(bk.outboundDate)} → ${pretty(bk.returnDate)}.`, factIds: ['documents.tn.round-trip'] }
        : { id: 'booking.dates', doc: 'booking', title: 'Booking matches your dates', status: 'fail', detail: `Booking ${pretty(bk.outboundDate)} → ${pretty(bk.returnDate)}, but you declare ${pretty(entry)} → ${pretty(exit)}.`, fix: 'Make the form, booking, insurance and accommodation use the same dates.', factIds: ['documents.tn.round-trip'], refusalReason: 8 },
    );
  }

  // ---- Accommodation: every night between entry and exit
  const ac = d.accommodation;
  if (trip.accommodation !== 'host') {
    if (!ac?.checkIn || !ac.checkOut) {
      push({ id: 'accommodation.nights', doc: 'accommodation', title: 'Accommodation for every night', status: 'missing', detail: 'No accommodation booking provided.', factIds: ['documents.tn.accommodation'], refusalReason: 2 });
    } else {
      const ok = cmp(ac.checkIn, entry) <= 0 && cmp(ac.checkOut, exit) >= 0;
      push(
        ok
          ? { id: 'accommodation.nights', doc: 'accommodation', title: 'Accommodation for every night', status: 'pass', detail: `${pretty(ac.checkIn)} → ${pretty(ac.checkOut)}.`, factIds: ['documents.tn.accommodation'] }
          : { id: 'accommodation.nights', doc: 'accommodation', title: 'Accommodation for every night', status: 'fail', detail: `Booked ${pretty(ac.checkIn)} → ${pretty(ac.checkOut)}; you stay ${pretty(entry)} → ${pretty(exit)}.`, fix: 'Book the missing nights or explain where you stay.', factIds: ['documents.tn.accommodation'], refusalReason: 2 },
      );
    }
  }

  // ---- Same person on every document
  if (p?.fullName) {
    const others: Array<[string, string | undefined]> = [
      ['Insurance', ins?.holderName],
      ['Bank statements', st?.holderName],
      ['Payslips', d.payslips?.employeeName],
      ['Booking', bk?.passengerName],
      ['Accommodation', ac?.guestName],
      ['Leave', d.leave?.employeeName],
    ];
    const different: string[] = [];
    const partial: string[] = [];
    for (const [label, name] of others) {
      if (!name) continue;
      const m = compareNames(p.fullName, name);
      if (m === 'different') different.push(`${label}: “${name}”`);
      if (m === 'partial') partial.push(`${label}: “${name}”`);
    }
    if (different.length) {
      push({ id: 'identity.names', doc: 'identity', title: 'Same name on every document', status: 'fail', detail: `Passport says “${p.fullName}”, but ${different.join('; ')}.`, fix: 'Ask the issuer to correct the name so it matches your passport exactly.', factIds: ['refusal.8'], refusalReason: 8 });
    } else if (partial.length) {
      push({ id: 'identity.names', doc: 'identity', title: 'Same name on every document', status: 'warn', detail: `Shorter or longer name than the passport (“${p.fullName}”): ${partial.join('; ')}.`, fix: 'Usually accepted, but the full passport name is safer.', factIds: ['refusal.8'] });
    } else if (others.some(([, n]) => n)) {
      push({ id: 'identity.names', doc: 'identity', title: 'Same name on every document', status: 'pass', detail: `All documents match “${p.fullName}”.`, factIds: ['refusal.8'] });
    }
  }

  return out;
}

export function summarize(findings: Finding[]): Record<Status, number> {
  const s: Record<Status, number> = { pass: 0, warn: 0, fail: 0, missing: 0 };
  for (const f of findings) s[f.status]++;
  return s;
}
