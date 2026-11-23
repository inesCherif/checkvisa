import { describe, expect, it } from 'vitest';
import { isTransientError, withRetry } from '../../src/core/ai/retry';

const noSleep = { sleep: async () => {} };

describe('retry on temporary cloud errors', () => {
  it('recognises overload and rate-limit errors', () => {
    expect(isTransientError(new Error('[500 ] This model is currently experiencing high demand.'))).toBe(true);
    expect(isTransientError(new Error('[429 ] RESOURCE_EXHAUSTED'))).toBe(true);
    expect(isTransientError(new Error('[401 ] Firebase App Check token is invalid.'))).toBe(false);
  });

  it('retries until the call succeeds', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new Error('[503 ] unavailable');
      return 'ok';
    }, noSleep);
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('does not retry permanent errors', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new Error('[401 ] invalid');
      }, noSleep),
    ).rejects.toThrow('401');
    expect(calls).toBe(1);
  });

  it('gives up after the last attempt', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new Error('[500 ] high demand');
      }, { ...noSleep, attempts: 3 }),
    ).rejects.toThrow('high demand');
    expect(calls).toBe(3);
  });
});
