// Builds Firebase AI Logic models. A model's hybrid configuration is fixed when it is
// created, so we keep one cached instance per (mode, cloud model) pair.

import { getGenerativeModel, type AI, type GenerativeModel } from 'firebase/ai';
import type { InferenceModeValue } from '../routing/policy';

/** SDK default for hybrid cloud fallback (firebase JS SDK v13). Overridable via Remote Config later. */
export const DEFAULT_CLOUD_MODEL = 'gemini-3.5-flash-lite';

/** Tunisian documents are mostly in French; the UI answers in English. */
export const ON_DEVICE_INPUT_LANGUAGES = ['en', 'fr'];
export const ON_DEVICE_OUTPUT_LANGUAGES = ['en'];

const cache = new Map<string, GenerativeModel>();

export function getModel(ai: AI, mode: InferenceModeValue, cloudModel: string = DEFAULT_CLOUD_MODEL): GenerativeModel {
  const key = `${mode}|${cloudModel}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const model = getGenerativeModel(ai, {
    mode,
    inCloudParams: { model: cloudModel },
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: 'text', languages: ON_DEVICE_INPUT_LANGUAGES }],
        expectedOutputs: [{ type: 'text', languages: ON_DEVICE_OUTPUT_LANGUAGES }],
      },
    },
  });
  cache.set(key, model);
  return model;
}
