// European Commission visa statistics for Schengen consulates in Tunisia, reshaped for display.
// "Not issued" = refused + discontinued applications (Commission definition, kept in the data file).

import type { StatsFile } from './schema';
import { DESTINATIONS, type Destination } from '../rules/trip';

export interface StateYear {
  applied: number;
  notIssued: number;
  /** notIssued / (issued + ltvIssued + notIssued), null when no decisions were taken. */
  rate: number | null;
}

export interface StateStats {
  state: string;
  byYear: Record<number, StateYear>;
}

function rate(issued: number, ltv: number, notIssued: number): number | null {
  const decided = issued + ltv + notIssued;
  return decided === 0 ? null : notIssued / decided;
}

/** One row per Schengen state (all its consulates in Tunisia summed), biggest first in the latest year. */
export function statsByState(files: StatsFile[]): { years: number[]; states: StateStats[] } {
  const years = [...new Set(files.map((f) => f.year))].sort((a, b) => a - b);
  const sums = new Map<string, Record<number, { applied: number; issued: number; ltv: number; notIssued: number }>>();
  for (const file of files) {
    for (const row of file.rows) {
      const perYear = sums.get(row.schengenState) ?? {};
      const cur = perYear[file.year] ?? { applied: 0, issued: 0, ltv: 0, notIssued: 0 };
      cur.applied += row.applied;
      cur.issued += row.issued;
      cur.ltv += row.ltvIssued;
      cur.notIssued += row.notIssued;
      perYear[file.year] = cur;
      sums.set(row.schengenState, perYear);
    }
  }
  const latest = years[years.length - 1];
  const states: StateStats[] = [...sums.entries()].map(([state, perYear]) => ({
    state,
    byYear: Object.fromEntries(
      Object.entries(perYear).map(([y, s]) => [Number(y), { applied: s.applied, notIssued: s.notIssued, rate: rate(s.issued, s.ltv, s.notIssued) }]),
    ),
  }));
  states.sort((a, b) => (b.byYear[latest]?.applied ?? 0) - (a.byYear[latest]?.applied ?? 0));
  return { years, states };
}

/** Latest-year figure for the trip's destination, or null when the Commission has no row for it. */
export function destinationStat(files: StatsFile[], destination: Destination): { year: number; stat: StateYear } | null {
  const { years, states } = statsByState(files);
  const latest = years[years.length - 1];
  const row = states.find((s) => s.state === DESTINATIONS[destination]);
  const stat = row?.byYear[latest];
  return stat ? { year: latest, stat } : null;
}

export const percent = (r: number | null): string => (r === null ? '—' : `${(r * 100).toFixed(1)}%`);
