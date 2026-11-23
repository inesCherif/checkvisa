// Remote Config: values the maintainer can change without redeploying the app.
//   rate_tnd_per_eur, rate_tnd_per_chf  exchange rates used to show amounts in Tunisian dinars
//   rates_as_of                        label shown next to the rates (e.g. "BCT, 2026-11-23")
//   cloud_model                        Gemini model used for cloud calls
// The template is versioned in remoteconfig.template.json and deployed with the Firebase CLI.

import type { FirebaseApp } from 'firebase/app';
import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config';
import { DEFAULT_RATES, type Rates } from '../core/rules/money';
import { DEFAULT_CLOUD_MODEL } from '../core/ai/modelFactory';

export interface AppConfig {
  rates: Rates;
  cloudModel: string;
}

export const CONFIG_DEFAULTS: Record<string, string> = {
  rate_tnd_per_eur: String(DEFAULT_RATES.tndPerEur),
  rate_tnd_per_chf: String(DEFAULT_RATES.tndPerChf),
  rates_as_of: DEFAULT_RATES.asOf,
  cloud_model: DEFAULT_CLOUD_MODEL,
};

/** Turns raw Remote Config strings into a safe config; bad values fall back to the defaults. */
export function parseConfig(get: (key: string) => string): AppConfig {
  const rate = (key: string, fallback: number) => {
    const n = Number(get(key));
    return Number.isFinite(n) && n > 0.5 && n < 20 ? n : fallback;
  };
  const model = get('cloud_model').trim();
  return {
    rates: {
      tndPerEur: rate('rate_tnd_per_eur', DEFAULT_RATES.tndPerEur),
      tndPerChf: rate('rate_tnd_per_chf', DEFAULT_RATES.tndPerChf),
      asOf: get('rates_as_of').trim() || DEFAULT_RATES.asOf,
      source: DEFAULT_RATES.source,
    },
    cloudModel: /^gemini-[\w.-]+$/.test(model) ? model : DEFAULT_CLOUD_MODEL,
  };
}

export async function loadRemoteConfig(app: FirebaseApp): Promise<AppConfig> {
  const rc = getRemoteConfig(app);
  rc.settings.minimumFetchIntervalMillis = 60 * 60 * 1000; // at most once an hour
  rc.defaultConfig = CONFIG_DEFAULTS;
  try {
    await fetchAndActivate(rc);
  } catch (error) {
    console.warn('[CheckVisa] Remote Config fetch failed, using defaults.', error);
  }
  return parseConfig((key) => getValue(rc, key).asString());
}
