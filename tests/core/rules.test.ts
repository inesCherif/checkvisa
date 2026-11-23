import { describe, expect, it } from 'vitest';
import { bundledLibrary } from '../../src/core/data/library';
import { addMonths, stayDays, shiftMonth } from '../../src/core/rules/dates';
import { meansRequired, visaFee } from '../../src/core/rules/money';
import { buildChecklist } from '../../src/core/rules/checklist';
import { compareNames, runChecks, summarize } from '../../src/core/rules/checks';
import { sampleDossier } from '../../src/core/sample/sampleDossier';
import type { Trip } from '../../src/core/rules/trip';

const lib = bundledLibrary();
const factIds = new Set(lib.facts.map((f) => f.id));
const APP = '2026-11-23';

const trip = (over: Partial<Trip> = {}): Trip => ({
  destination: 'FR',
  purpose: 'tourism',
  status: 'employee',
  entryDate: '2027-01-10',
  exitDate: '2027-01-19',
  age: 30,
  accommodation: 'hotel',
  sponsored: false,
  ...over,
});

describe('dates', () => {
  it('counts entry and exit days', () => expect(stayDays('2027-01-10', '2027-01-19')).toBe(10));
  it('clamps month ends and handles leap years', () => {
    expect(addMonths('2027-11-30', 3)).toBe('2028-02-29');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
  });
  it('shifts months across years', () => expect(shiftMonth('2026-01', -1)).toBe('2025-12'));
});

describe('fee', () => {
  it('adult pays 90', () => expect(visaFee(trip()).eur).toBe(90));
  it('child 6–11 pays 45', () => expect(visaFee(trip({ age: 8 })).eur).toBe(45));
  it('under 6 is free', () => expect(visaFee(trip({ age: 5 })).eur).toBe(0));
  it('student travelling to study is free, student tourist is not', () => {
    expect(visaFee(trip({ status: 'student', purpose: 'study' })).eur).toBe(0);
    expect(visaFee(trip({ status: 'student', purpose: 'tourism' })).eur).toBe(90);
  });
});

describe('means of subsistence', () => {
  it('France hotel: 65/day', () => expect(meansRequired(trip(), lib).amount).toBe(650));
  it('France no accommodation: 120/day', () => expect(meansRequired(trip({ accommodation: 'none' }), lib).amount).toBe(1200));
  it('Spain applies the minimum total', () => {
    expect(meansRequired(trip({ destination: 'ES', exitDate: '2027-01-12' }), lib).amount).toBe(1020.6);
  });
  it('Italy 1–5 days is a fixed amount', () => {
    expect(meansRequired(trip({ destination: 'IT', exitDate: '2027-01-12' }), lib).amount).toBe(269.6);
  });
  it('Italy 10 days is per day', () => expect(meansRequired(trip({ destination: 'IT' }), lib).amount).toBe(449.3));
  it('Austria has no fixed amount', () => expect(meansRequired(trip({ destination: 'AT' }), lib).amount).toBeNull());
  it('Switzerland is in CHF', () => expect(meansRequired(trip({ destination: 'CH' }), lib).currency).toBe('CHF'));
});

describe('checklist', () => {
  it('cites only facts that exist, for every destination / status / purpose', () => {
    for (const destination of ['FR', 'IT', 'DE', 'ES', 'BE', 'NL', 'CH', 'AT', 'PT', 'GR'] as const) {
      for (const status of ['employee', 'student', 'other'] as const) {
        for (const purpose of ['tourism', 'business', 'study'] as const) {
          const items = buildChecklist(trip({ destination, status, purpose, age: 16, sponsored: true }), lib);
          for (const item of items) for (const id of item.factIds) expect(factIds, `${item.id} → ${id}`).toContain(id);
        }
      }
    }
  });
  it('adds parental consent for minors and sponsor proof when sponsored', () => {
    const ids = buildChecklist(trip({ age: 15, sponsored: true }), lib).map((i) => i.id);
    expect(ids).toContain('minor-consent');
    expect(ids).toContain('sponsor');
  });
  it('shows the national visa centre', () => {
    expect(buildChecklist(trip({ destination: 'DE' }), lib).some((i) => i.id === 'centre.de')).toBe(true);
  });
});

describe('names', () => {
  it('ignores case, accents and order', () => expect(compareNames('Yasmine BEN SALAH', 'ben salah yasmine')).toBe('same'));
  it('flags a missing token as partial', () => expect(compareNames('YASMINE BEN SALAH', 'Yasmine Salah')).toBe('partial'));
  it('flags a different surname', () => expect(compareNames('YASMINE BEN SALAH', 'YASMINE BEN SALEM')).toBe('different'));
  it('treats titles as extra tokens (partial)', () => expect(compareNames('YASMINE BEN SALAH', 'Mme Yasmine Ben Salah')).toBe('partial'));
});

describe('sample dossier', () => {
  it('catches exactly the 4 seeded problems', () => {
    const s = sampleDossier(APP);
    const findings = runChecks(s.dossier, { trip: s.trip, lib, applicationDate: APP });
    const failed = findings.filter((f) => f.status === 'fail').map((f) => f.id).sort();
    expect(failed).toEqual(['identity.names', 'insurance.period', 'passport.validity', 'statements.months']);
    for (const f of findings) for (const id of f.factIds) expect(factIds).toContain(id);
  });
  it('is all green once fixed (only the courtesy-title warning remains)', () => {
    const s = sampleDossier(APP, true);
    const sum = summarize(runChecks(s.dossier, { trip: s.trip, lib, applicationDate: APP }));
    expect(sum.fail).toBe(0);
    expect(sum.missing).toBe(0);
  });
  it('works whatever the application date', () => {
    for (const d of ['2027-01-01', '2027-03-31', '2028-02-29']) {
      const s = sampleDossier(d);
      expect(runChecks(s.dossier, { trip: s.trip, lib, applicationDate: d }).filter((f) => f.status === 'fail')).toHaveLength(4);
    }
  });
});

describe('checks edge cases', () => {
  it('passport valid exactly 3 months after exit passes', () => {
    const f = runChecks({ passport: { expiryDate: addMonths('2027-01-19', 3) } }, { trip: trip(), lib, applicationDate: APP });
    expect(f.find((x) => x.id === 'passport.validity')?.status).toBe('pass');
  });
  it('low balance fails when not sponsored, warns when sponsored', () => {
    const d = { statements: { months: [], closingBalance: 500, currency: 'TND' as const } };
    expect(runChecks(d, { trip: trip(), lib, applicationDate: APP }).find((x) => x.id === 'means.balance')?.status).toBe('fail');
    expect(runChecks(d, { trip: trip({ sponsored: true }), lib, applicationDate: APP }).find((x) => x.id === 'means.balance')?.status).toBe('warn');
  });
  it('insurance below 30,000 fails with refusal reason 7', () => {
    const f = runChecks({ insurance: { coverEur: 20000 } }, { trip: trip(), lib, applicationDate: APP }).find((x) => x.id === 'insurance.cover');
    expect(f?.status).toBe('fail');
    expect(f?.refusalReason).toBe(7);
  });
});
