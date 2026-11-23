// The routing policy: which kind of data may be processed where.
//
// Every AI call in CheckVisa declares a *data class*. This file is the single place that
// turns a data class into a Firebase AI Logic inference mode, so the privacy rules can be
// read (and tested) in one screen. Pure TypeScript: no Firebase import, runs in unit tests.

/** Same string values as `InferenceMode` in firebase/ai. */
export type InferenceModeValue = 'prefer_on_device' | 'only_on_device' | 'prefer_in_cloud' | 'only_in_cloud';

export type DataClass =
  /** Passports, bank statements, payslips… Never leaves the device without explicit consent. */
  | 'PRIVATE'
  /** Text derived from private facts (e.g. an explanation of a failed check). */
  | 'PRIVATE_DERIVED'
  /** Non-identifying trip facts (destination, dates, purpose). */
  | 'TRIP_FACTS'
  /** Public official sources (laws, consulate checklists). */
  | 'PUBLIC'
  /** Step 1 smoke test. */
  | 'DEMO';

export type CloudPermission = 'only-with-consent' | 'reduced-payload' | 'allowed';

export interface RouteRule {
  defaultMode: InferenceModeValue;
  cloud: CloudPermission;
  why: string;
}

export const ROUTING_TABLE: Record<DataClass, RouteRule> = {
  PRIVATE: {
    defaultMode: 'only_on_device',
    cloud: 'only-with-consent',
    why: 'Identity and financial documents are read on this device only.',
  },
  PRIVATE_DERIVED: {
    defaultMode: 'prefer_on_device',
    cloud: 'reduced-payload',
    why: 'Uses facts from your documents; if the cloud is needed it only gets rule ids and generic numbers.',
  },
  TRIP_FACTS: {
    defaultMode: 'prefer_in_cloud',
    cloud: 'allowed',
    why: 'Non-identifying trip facts; the cloud model writes better text, and it falls back on-device when offline.',
  },
  PUBLIC: {
    defaultMode: 'only_in_cloud',
    cloud: 'allowed',
    why: 'Public official sources need the larger cloud model.',
  },
  DEMO: {
    defaultMode: 'prefer_on_device',
    cloud: 'allowed',
    why: 'Smoke test: on-device when available, cloud otherwise.',
  },
};

export interface RouteOptions {
  /** Simulate a device without the on-device model (or let the user insist on the cloud). */
  forceCloud?: boolean;
  /** The user explicitly agreed to send (redacted) private data to the cloud. */
  consentToCloud?: boolean;
}

export class PrivacyGateError extends Error {
  constructor(public readonly dataClass: DataClass) {
    super(`${dataClass} data can only go to the cloud with the user's explicit consent.`);
    this.name = 'PrivacyGateError';
  }
}

/** Decide the inference mode for one AI call. Throws PrivacyGateError instead of leaking data. */
export function resolveMode(dataClass: DataClass, options: RouteOptions = {}): InferenceModeValue {
  const rule = ROUTING_TABLE[dataClass];
  if (!options.forceCloud) return rule.defaultMode;
  if (rule.cloud === 'only-with-consent' && !options.consentToCloud) {
    throw new PrivacyGateError(dataClass);
  }
  return 'only_in_cloud';
}

export type InferenceSourceValue = 'on_device' | 'in_cloud';

/** Human label for where an answer was produced. */
export function describeSource(source: InferenceSourceValue | undefined, mode: InferenceModeValue): string {
  if (source === 'on_device') return 'On this device · Gemini Nano';
  if (source === 'in_cloud') {
    return mode === 'prefer_on_device' ? 'Cloud · fallback (on-device model not ready)' : 'Cloud · Gemini';
  }
  return 'Unknown source';
}
