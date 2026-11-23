// Small, timezone-safe date helpers. All dates are ISO "YYYY-MM-DD" strings handled in UTC.

export type ISODate = string;

const DAY = 86_400_000;

export function parse(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

export function format(t: number): ISODate {
  return new Date(t).toISOString().slice(0, 10);
}

export function isISODate(d: unknown): d is ISODate {
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(parse(d));
}

export function addDays(d: ISODate, n: number): ISODate {
  return format(parse(d) + n * DAY);
}

/** Adds calendar months, clamping to the last day of the target month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(d: ISODate, n: number): ISODate {
  const [y, m, day] = d.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return format(target.getTime());
}

export function addYears(d: ISODate, n: number): ISODate {
  return addMonths(d, n * 12);
}

/** Number of calendar days of a stay, counting both the entry and the exit day (Schengen counting). */
export function stayDays(entry: ISODate, exit: ISODate): number {
  return Math.round((parse(exit) - parse(entry)) / DAY) + 1;
}

export function nights(checkIn: ISODate, checkOut: ISODate): number {
  return Math.round((parse(checkOut) - parse(checkIn)) / DAY);
}

export function cmp(a: ISODate, b: ISODate): number {
  return parse(a) - parse(b);
}

/** "YYYY-MM" of a date. */
export function monthOf(d: ISODate): string {
  return d.slice(0, 7);
}

/** "YYYY-MM" shifted by n months. */
export function shiftMonth(ym: string, n: number): string {
  return monthOf(addMonths(`${ym}-01`, n));
}

export function today(): ISODate {
  return format(Date.now() - new Date().getTimezoneOffset() * 60_000);
}

export function pretty(d: ISODate): string {
  return new Date(parse(d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function prettyMonth(ym: string): string {
  return new Date(parse(`${ym}-01`)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
