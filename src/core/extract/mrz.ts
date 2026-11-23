// ICAO Doc 9303 machine-readable zone (TD3 passports: 2 lines × 44 characters).
// Deterministic: when an MRZ is found in the text, its check digits validate (or correct) what
// the AI read, and the dates and name are taken from it.

import type { PassportFacts } from '../rules/dossier';

const WEIGHTS = [7, 3, 1];

export function checkDigit(field: string): number {
  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    const c = field[i];
    const v = c === '<' ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55; // A=10 … Z=35
    sum += v * WEIGHTS[i % 3];
  }
  return sum % 10;
}

function yymmdd(s: string, future: boolean): string {
  const yy = Number(s.slice(0, 2));
  const now = new Date().getUTCFullYear() % 100;
  const century = future ? (yy < now - 30 ? 2100 : 2000) : yy > now ? 1900 : 2000;
  return `${century + yy}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
}

/** Finds a TD3 MRZ in free text and returns the passport facts it encodes. */
export function parseMrz(text: string): (PassportFacts & { birthDate?: string }) | null {
  const lines = text
    .toUpperCase()
    .replace(/[ \t]/g, '')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9<]{44}$/.test(l));
  const i = lines.findIndex((l) => l.startsWith('P'));
  if (i < 0 || !lines[i + 1]) return null;
  const [l1, l2] = [lines[i], lines[i + 1]];
  const [surname, given = ''] = l1.slice(5).split('<<');
  const number = l2.slice(0, 9);
  const birth = l2.slice(13, 19);
  const expiry = l2.slice(21, 27);
  const valid =
    checkDigit(number) === Number(l2[9]) && checkDigit(birth) === Number(l2[19]) && checkDigit(expiry) === Number(l2[27]);
  return {
    fullName: `${given.replace(/</g, ' ').trim()} ${surname.replace(/</g, ' ').trim()}`.trim(),
    number: number.replace(/</g, ''),
    expiryDate: yymmdd(expiry, true),
    birthDate: yymmdd(birth, false),
    mrzValid: valid,
  };
}

/** Builds TD3 MRZ lines (used by the sample-dossier generator). */
export function buildMrz(p: { surname: string; given: string; number: string; birth: string; expiry: string; sex: 'F' | 'M' }): [string, string] {
  const pad = (s: string, n: number) => (s + '<'.repeat(n)).slice(0, n);
  const l1 = pad(`P<TUN${p.surname.replace(/ /g, '<')}<<${p.given.replace(/ /g, '<')}`, 44);
  const num = pad(p.number, 9);
  const b = p.birth.replace(/-/g, '').slice(2);
  const e = p.expiry.replace(/-/g, '').slice(2);
  const body = `${num}${checkDigit(num)}TUN${b}${checkDigit(b)}${p.sex}${e}${checkDigit(e)}${'<'.repeat(14)}`;
  const personal = '<'.repeat(14);
  const composite = `${num}${checkDigit(num)}${b}${checkDigit(b)}${e}${checkDigit(e)}${personal}${checkDigit(personal)}`;
  const l2 = `${body}${checkDigit(personal)}${checkDigit(composite)}`;
  return [l1, l2];
}
