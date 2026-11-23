import { describe, expect, it } from 'vitest';
import { CONFIG_DEFAULTS, parseConfig } from '../../src/firebase/remoteConfig';
import { DEFAULT_RATES } from '../../src/core/rules/money';

const from = (values: Record<string, string>) => (key: string) => values[key] ?? CONFIG_DEFAULTS[key] ?? '';

describe('Remote Config parsing', () => {
  it('uses the defaults when nothing is set', () => {
    const c = parseConfig(from({}));
    expect(c.rates.tndPerEur).toBe(DEFAULT_RATES.tndPerEur);
    expect(c.cloudModel).toBe(CONFIG_DEFAULTS.cloud_model);
  });

  it('reads valid values', () => {
    const c = parseConfig(from({ rate_tnd_per_eur: '3.52', rates_as_of: 'BCT, 2026-11-23', cloud_model: 'gemini-3.5-flash' }));
    expect(c.rates.tndPerEur).toBe(3.52);
    expect(c.rates.asOf).toBe('BCT, 2026-11-23');
    expect(c.cloudModel).toBe('gemini-3.5-flash');
  });

  it('rejects nonsense values', () => {
    const c = parseConfig(from({ rate_tnd_per_eur: 'abc', rate_tnd_per_chf: '9999', cloud_model: 'rm -rf' }));
    expect(c.rates.tndPerEur).toBe(DEFAULT_RATES.tndPerEur);
    expect(c.rates.tndPerChf).toBe(DEFAULT_RATES.tndPerChf);
    expect(c.cloudModel).toBe(CONFIG_DEFAULTS.cloud_model);
  });
});
