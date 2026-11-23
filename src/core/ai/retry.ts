// The cloud model sometimes answers "500 high demand" / "503" / "429" for a few seconds.
// Those errors are temporary, so we retry with a growing delay before showing an error.

import type { GenerateContentResult, GenerativeModel } from 'firebase/ai';

type Request = Parameters<GenerativeModel['generateContent']>[0];

/** True for errors that usually go away on their own (server overload, rate limit). */
export function isTransientError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /\[(429|500|502|503|504)\b|high demand|overloaded|unavailable|RESOURCE_EXHAUSTED/i.test(text);
}

export async function withRetry<T>(
  run: () => Promise<T>,
  { attempts = 4, baseDelayMs = 1000, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)) } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= attempts || !isTransientError(error)) throw error;
      await sleep(baseDelayMs * 2 ** (attempt - 1)); // 1 s, 2 s, 4 s
    }
  }
}

export function generateWithRetry(model: GenerativeModel, request: Request): Promise<GenerateContentResult> {
  return withRetry(() => model.generateContent(request));
}
