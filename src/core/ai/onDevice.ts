// Reads whether Chrome's on-device model (Gemini Nano) can run here, for the status panel.

import { ON_DEVICE_INPUT_LANGUAGES, ON_DEVICE_OUTPUT_LANGUAGES } from './modelFactory';

export type OnDeviceStatus = LanguageModelAvailability | 'not-supported';

export async function checkOnDeviceStatus(): Promise<OnDeviceStatus> {
  const api = globalThis.LanguageModel;
  if (!api) return 'not-supported';
  try {
    return await api.availability({
      expectedInputs: [{ type: 'text', languages: ON_DEVICE_INPUT_LANGUAGES }],
      expectedOutputs: [{ type: 'text', languages: ON_DEVICE_OUTPUT_LANGUAGES }],
    });
  } catch {
    return 'unavailable';
  }
}

export const ON_DEVICE_STATUS_TEXT: Record<OnDeviceStatus, string> = {
  available: 'Ready — answers can be produced on this device.',
  downloadable: 'Not downloaded yet — click "Prepare Gemini Nano" (one-time download).',
  downloading: 'Downloading the on-device model…',
  unavailable: 'This device cannot run the on-device model — the cloud will be used.',
  'not-supported': 'This browser has no on-device model (Chrome desktop 148+ needed) — the cloud will be used.',
};
