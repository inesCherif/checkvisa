// Step 1 smoke test: send one prompt through the routing policy and report where it ran.

import type { AI } from 'firebase/ai';
import { getModel, DEFAULT_CLOUD_MODEL } from './modelFactory';
import { resolveMode, type InferenceModeValue, type InferenceSourceValue } from '../routing/policy';

export interface AskResult {
  text: string;
  source: InferenceSourceValue | undefined;
  mode: InferenceModeValue;
  cloudModel: string;
  ms: number;
}

export async function askDemo(ai: AI, prompt: string, forceCloud: boolean): Promise<AskResult> {
  const mode = resolveMode('DEMO', { forceCloud });
  const model = getModel(ai, mode);
  const started = performance.now();
  const result = await model.generateContent(prompt);
  return {
    text: result.response.text(),
    source: result.response.inferenceSource,
    mode,
    cloudModel: DEFAULT_CLOUD_MODEL,
    ms: Math.round(performance.now() - started),
  };
}
