import { describe, expect, it } from 'vitest';
import { bundledLibrary } from '../../src/core/data/library';
import { destinationStat, percent, statsByState } from '../../src/core/data/stats';

const lib = bundledLibrary();

describe('visa statistics', () => {
  it('has both years and France first (most applications)', () => {
    const { years, states } = statsByState(lib.stats);
    expect(years).toEqual([2023, 2025]);
    expect(states[0].state).toBe('France');
  });

  it('matches the Commission figures for France 2025', () => {
    const fr = destinationStat(lib.stats, 'FR');
    expect(fr?.year).toBe(2025);
    expect(fr?.stat.applied).toBe(116833);
    expect(percent(fr!.stat.rate)).toBe('15.4%');
  });

  it('sums per state and agrees with the file totals', () => {
    const file = lib.stats.find((s) => s.year === 2025)!;
    const { states } = statsByState([file]);
    expect(states.reduce((n, s) => n + s.byYear[2025].applied, 0)).toBe(file.totals.applied);
  });
});
