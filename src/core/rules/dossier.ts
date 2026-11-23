// The facts read from the applicant's documents (data class PRIVATE: they never leave the device).
// Filled by hand (step 4) or by on-device extraction (step 5). Every field is optional:
// a missing document is reported as "missing", not guessed.

import type { ISODate } from './dates';

export interface PassportFacts {
  fullName?: string;
  number?: string;
  issueDate?: ISODate;
  expiryDate?: ISODate;
  blankPages?: number;
  /** ICAO 9303 check digits of the MRZ, when an MRZ was read. */
  mrzValid?: boolean;
}

export interface InsuranceFacts {
  holderName?: string;
  startDate?: ISODate;
  endDate?: ISODate;
  coverEur?: number;
  allSchengen?: boolean;
  repatriation?: boolean;
}

export interface StatementFacts {
  holderName?: string;
  /** Months covered, "YYYY-MM". */
  months?: string[];
  closingBalance?: number;
  currency?: 'TND' | 'EUR';
}

export interface PayslipFacts {
  employeeName?: string;
  months?: string[];
  netSalaryTnd?: number;
}

export interface BookingFacts {
  passengerName?: string;
  outboundDate?: ISODate;
  returnDate?: ISODate;
}

export interface AccommodationFacts {
  guestName?: string;
  checkIn?: ISODate;
  checkOut?: ISODate;
}

export interface LeaveFacts {
  employeeName?: string;
  startDate?: ISODate;
  endDate?: ISODate;
}

export interface Dossier {
  passport?: PassportFacts;
  insurance?: InsuranceFacts;
  statements?: StatementFacts;
  payslips?: PayslipFacts;
  booking?: BookingFacts;
  accommodation?: AccommodationFacts;
  leave?: LeaveFacts;
}

export type DocKind = keyof Dossier;

export const DOC_LABELS: Record<DocKind, string> = {
  passport: 'Passport',
  insurance: 'Travel insurance',
  statements: 'Bank statements',
  payslips: 'Payslips',
  booking: 'Flight / ferry booking',
  accommodation: 'Accommodation booking',
  leave: 'Leave authorisation',
};
