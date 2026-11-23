// Step 5: read one document into fields with Firebase AI Logic.
// Data class PRIVATE → ONLY_ON_DEVICE (Gemini Nano in Chrome, JSON-constrained output).
// The cloud is only used if the user explicitly consents, and that call is written to the ledger
// with its full payload.

import { getGenerativeModel, type AI, type GenerativeModel } from 'firebase/ai';
import { getCloudModel, ON_DEVICE_INPUT_LANGUAGES, ON_DEVICE_OUTPUT_LANGUAGES } from '../ai/modelFactory';
import { resolveMode } from '../routing/policy';
import { record } from '../routing/ledger';
import type { DocKind, Dossier } from '../rules/dossier';
import { DOC_SCHEMAS, extractionPrompt, normalize, parseJsonLoose } from './schemas';
import { parseMrz } from './mrz';
import { generateWithRetry } from '../ai/retry';

const cache = new Map<string, GenerativeModel>();

function extractionModel(ai: AI, kind: DocKind, cloud: boolean): GenerativeModel {
  const key = `${kind}|${cloud}|${getCloudModel()}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const model = getGenerativeModel(ai, {
    mode: resolveMode('PRIVATE', { forceCloud: cloud, consentToCloud: cloud }),
    inCloudParams: { model: getCloudModel(), generationConfig: { responseMimeType: 'application/json', temperature: 0 } },
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: 'text', languages: ON_DEVICE_INPUT_LANGUAGES }],
        expectedOutputs: [{ type: 'text', languages: ON_DEVICE_OUTPUT_LANGUAGES }],
        temperature: 0.1,
        topK: 1,
      } as never,
      promptOptions: { responseConstraint: DOC_SCHEMAS[kind].schema },
    },
  });
  cache.set(key, model);
  return model;
}

export interface ExtractResult<K extends DocKind> {
  facts: NonNullable<Dossier[K]>;
  source: 'on_device' | 'in_cloud';
  ms: number;
}

export async function extractDocument<K extends DocKind>(
  ai: AI,
  kind: K,
  text: string,
  opts: { consentToCloud?: boolean } = {},
): Promise<ExtractResult<K>> {
  const cloud = !!opts.consentToCloud;
  const prompt = extractionPrompt(kind, text);
  const started = performance.now();
  const result = await generateWithRetry(extractionModel(ai, kind, cloud), prompt);
  const source = result.response.inferenceSource ?? (cloud ? 'in_cloud' : 'on_device');
  record({ task: `Read ${kind}`, dataClass: 'PRIVATE', where: source, payload: source === 'in_cloud' ? prompt : undefined, chars: prompt.length });
  let facts = normalize(kind, parseJsonLoose(result.response.text()));

  // Deterministic cross-check for passports: the MRZ (ICAO 9303) wins over the AI reading.
  if (kind === 'passport') {
    const mrz = parseMrz(text);
    if (mrz) {
      const { birthDate: _b, ...fromMrz } = mrz;
      facts = { ...facts, ...(mrz.mrzValid ? fromMrz : { mrzValid: false }) } as typeof facts;
    }
  }
  return { facts, source, ms: Math.round(performance.now() - started) };
}
