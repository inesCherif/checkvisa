// A fictional applicant ("Yasmine Ben Salah", invented) used for the demo, the tests and the
// judges' "Try the sample dossier" button. Dates are relative to the day you open the app, so the
// sample never goes stale. It contains exactly 4 seeded problems:
//   1. passport expires 2 months after the exit date (needs 3)       → inadmissible
//   2. insurance ends 2 days before the exit date                    → refusal reason 7
//   3. only 2 of the 3 required months of bank statements            → refusal reason 3
//   4. booking name "BEN SALEM" ≠ passport "BEN SALAH"              → refusal reason 8
// `fixed: true` returns the corrected dossier (all green).

import { addDays, addMonths, addYears, monthOf, shiftMonth, type ISODate } from '../rules/dates';
import type { Dossier } from '../rules/dossier';
import type { Trip } from '../rules/trip';

export const SAMPLE_NAME = 'YASMINE BEN SALAH';

export interface Sample {
  trip: Trip;
  dossier: Dossier;
  applicationDate: ISODate;
}

export function sampleDossier(applicationDate: ISODate, fixed = false): Sample {
  const entry = addDays(applicationDate, 45);
  const exit = addDays(entry, 9);
  const m = monthOf(applicationDate);
  const trip: Trip = {
    destination: 'FR',
    purpose: 'tourism',
    status: 'employee',
    entryDate: entry,
    exitDate: exit,
    age: 29,
    accommodation: 'hotel',
    sponsored: false,
  };
  const dossier: Dossier = {
    passport: {
      fullName: SAMPLE_NAME,
      number: 'Z1234567',
      issueDate: addYears(applicationDate, -5),
      expiryDate: fixed ? addYears(applicationDate, 5) : addMonths(exit, 2),
      blankPages: 6,
    },
    insurance: {
      holderName: SAMPLE_NAME,
      startDate: entry,
      endDate: fixed ? exit : addDays(exit, -2),
      coverEur: 30000,
      allSchengen: true,
      repatriation: true,
    },
    statements: {
      holderName: 'Mme Yasmine Ben Salah',
      months: fixed ? [shiftMonth(m, -3), shiftMonth(m, -2), shiftMonth(m, -1)] : [shiftMonth(m, -2), shiftMonth(m, -1)],
      closingBalance: 7850,
      currency: 'TND',
    },
    payslips: {
      employeeName: SAMPLE_NAME,
      months: [shiftMonth(m, -3), shiftMonth(m, -2), shiftMonth(m, -1)],
      netSalaryTnd: 2350,
    },
    booking: {
      passengerName: fixed ? SAMPLE_NAME : 'YASMINE BEN SALEM',
      outboundDate: entry,
      returnDate: exit,
    },
    accommodation: {
      guestName: 'Yasmine Ben Salah',
      checkIn: entry,
      checkOut: exit,
    },
    leave: {
      employeeName: SAMPLE_NAME,
      startDate: addDays(entry, -1),
      endDate: addDays(exit, 1),
    },
  };
  return { trip, dossier, applicationDate };
}
