import { describe, expect, it } from 'vitest';
import { fixMillimes, parseTndAmounts } from '../../../src/core/extract/amounts';

describe('Tunisian dinar amounts', () => {
  it('reads millimes after the comma', () => {
    expect(parseTndAmounts('Solde fin de mois : 7 850,000 TND')).toEqual([7850]);
    expect(parseTndAmounts('Net à payer 2.350,500 DT')).toEqual([2350.5]);
  });
  it('fixes a value read as millimes', () => {
    expect(fixMillimes(7850000, 'Solde : 7 850,000 TND')).toBe(7850);
  });
  it('keeps a correct value', () => {
    expect(fixMillimes(7850, 'Solde : 7 850,000 TND')).toBe(7850);
    expect(fixMillimes(1200, 'Balance 1200 EUR')).toBe(1200);
  });
});
