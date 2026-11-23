// What to read from each kind of document. The JSON schema is passed to Gemini Nano as a
// `responseConstraint`, so the on-device model must answer with exactly these fields.
// The AI only *reads*; normalize() then validates every value before the rule engine sees it.

import type { DocKind, Dossier } from '../rules/dossier';
import { isISODate } from '../rules/dates';

type JsonSchema = Record<string, unknown>;

const str = { type: 'string' };
const date = { type: 'string', description: 'YYYY-MM-DD, or empty if absent' };
const num = { type: 'number' };
const bool = { type: 'boolean' };
const months = { type: 'array', items: { type: 'string', description: 'YYYY-MM' } };

const obj = (properties: Record<string, unknown>): JsonSchema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
});

export const DOC_SCHEMAS: Record<DocKind, { schema: JsonSchema; hint: string }> = {
  passport: {
    schema: obj({ fullName: str, number: str, issueDate: date, expiryDate: date }),
    hint: 'a Tunisian passport photo page. fullName = given names then surname.',
  },
  insurance: {
    schema: obj({ holderName: str, startDate: date, endDate: date, coverEur: num, allSchengen: bool, repatriation: bool }),
    hint: 'a travel medical insurance certificate. coverEur = maximum medical cover in euros. allSchengen = valid in all Schengen states.',
  },
  statements: {
    schema: obj({ holderName: str, months: months, closingBalance: num, currency: { type: 'string', enum: ['TND', 'EUR'] } }),
    hint: 'bank account statements. months = every calendar month covered by the statements. closingBalance = the most recent balance. Tunisian amounts use a comma before 3 millime digits: "7 850,000 TND" means 7850.',
  },
  payslips: {
    schema: obj({ employeeName: str, months: months, netSalaryTnd: num }),
    hint: 'payslips (fiches de paie). months = the pay months. netSalaryTnd = net salary of the latest payslip.',
  },
  booking: {
    schema: obj({ passengerName: str, outboundDate: date, returnDate: date }),
    hint: 'a round-trip flight or ferry reservation from Tunisia. outboundDate = departure from Tunisia; returnDate = flight back.',
  },
  accommodation: {
    schema: obj({ guestName: str, checkIn: date, checkOut: date }),
    hint: 'a hotel or rental booking confirmation.',
  },
  leave: {
    schema: obj({ employeeName: str, startDate: date, endDate: date }),
    hint: 'an employer leave authorisation (titre de congé / autorisation de congé).',
  },
};

export function extractionPrompt(kind: DocKind, text: string): string {
  return [
    `You read ${DOC_SCHEMAS[kind].hint}`,
    'The text may be in French or English. Copy values exactly as printed; convert every date to YYYY-MM-DD.',
    'If a value is not in the text, use an empty string, 0 or false. Do not invent values.',
    'Answer with JSON only.',
    '--- DOCUMENT TEXT ---',
    text.slice(0, 6000),
  ].join('\n');
}

/** Keep only well-formed values; drop empties so the rule engine reports them as missing. */
export function normalize<K extends DocKind>(kind: K, raw: unknown): NonNullable<Dossier[K]> {
  const out: Record<string, unknown> = {};
  const props = (DOC_SCHEMAS[kind].schema.properties ?? {}) as Record<string, { type: string; description?: string }>;
  const r = (raw ?? {}) as Record<string, unknown>;
  for (const [key, spec] of Object.entries(props)) {
    const v = r[key];
    if (spec.type === 'string') {
      if (typeof v !== 'string' || !v.trim()) continue;
      if (spec.description?.startsWith('YYYY-MM-DD')) {
        if (isISODate(v.trim())) out[key] = v.trim();
      } else out[key] = v.trim();
    } else if (spec.type === 'number') {
      const n = typeof v === 'string' ? Number(v.replace(/[\s,]/g, '')) : v;
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[key] = n;
    } else if (spec.type === 'boolean') {
      if (typeof v === 'boolean') out[key] = v;
    } else if (spec.type === 'array') {
      if (Array.isArray(v)) {
        const list = [...new Set(v.filter((m): m is string => typeof m === 'string' && /^\d{4}-\d{2}$/.test(m)))].sort();
        if (list.length) out[key] = list;
      }
    }
  }
  return out as NonNullable<Dossier[K]>;
}

/** Tolerant JSON parse (cloud models sometimes wrap JSON in ``` fences). */
export function parseJsonLoose(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  }
}
