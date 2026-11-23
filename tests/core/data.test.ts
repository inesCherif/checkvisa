import { describe, expect, it } from 'vitest';
import { BUNDLED_RAW, buildLibrary, bundledLibrary } from '../../src/core/data/library';

describe('CheckVisa dataset', () => {
  const lib = bundledLibrary();

  it('validates every source, fact and stats file against the schema', () => {
    expect(lib.sources.length).toBeGreaterThanOrEqual(12);
    expect(lib.facts.length).toBeGreaterThan(50);
  });

  it('uses unique ids', () => {
    const ids = (list: { id: string }[]) => new Set(list.map((x) => x.id)).size === list.length;
    expect(ids(lib.sources)).toBe(true);
    expect(ids(lib.facts)).toBe(true);
  });

  it('cites a known source in every fact', () => {
    for (const fact of lib.facts) expect(lib.sourceById.has(fact.sourceId), fact.id).toBe(true);
  });

  it('rejects a fact that cites an unknown source', () => {
    const bad = { title: 'x', facts: [{ ...lib.facts[0], id: 'bad.fact', sourceId: 'nope' }] };
    expect(() => buildLibrary({ ...BUNDLED_RAW, factFiles: [bad] })).toThrow(/unknown source/);
  });

  it('never marks a fact verified when its source is still to verify', () => {
    for (const fact of lib.facts) {
      if (lib.sourceById.get(fact.sourceId)?.status === 'to-verify') expect(fact.status, fact.id).toBe('to-verify');
    }
  });

  it('draws on at least 6 kinds of publisher', () => {
    expect(new Set(lib.sources.map((s) => s.authority)).size).toBeGreaterThanOrEqual(6);
  });

  it('has all 11 official refusal reasons', () => {
    expect(lib.facts.filter((f) => f.topic === 'refusal-ground')).toHaveLength(11);
  });

  it('keeps statistics consistent with the Commission totals (2025, Tunisia)', () => {
    const s2025 = lib.stats.find((s) => s.year === 2025)!;
    expect(s2025.totals.applied).toBe(188579);
    expect(s2025.totals.notIssued).toBe(36673);
    expect(s2025.totals.notIssuedRate).toBeCloseTo(0.1964, 3);
    const sum = s2025.rows.reduce((t, r) => t + r.applied, 0);
    expect(sum).toBe(s2025.totals.applied);
  });
});
