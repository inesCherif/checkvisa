// Step 1 smoke test: send one prompt through the routing policy and report where it ran.

import type { AI } from 'firebase/ai';
import { getModel, getCloudModel } from './modelFactory';
import { generateWithRetry } from './retry';
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
  const result = await generateWithRetry(model, prompt);
  return {
    text: result.response.text(),
    source: result.response.inferenceSource,
    mode,
    cloudModel: getCloudModel(),
    ms: Math.round(performance.now() - started),
  };
}
