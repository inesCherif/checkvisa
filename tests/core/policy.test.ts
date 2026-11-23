import { describe, expect, it } from 'vitest';
import { describeSource, PrivacyGateError, resolveMode, ROUTING_TABLE } from '../../src/core/routing/policy';

describe('routing policy', () => {
  it('keeps private documents on the device by default', () => {
    expect(resolveMode('PRIVATE')).toBe('only_on_device');
  });

  it('refuses to send private data to the cloud without consent', () => {
    expect(() => resolveMode('PRIVATE', { forceCloud: true })).toThrow(PrivacyGateError);
  });

  it('allows the cloud for private data only after explicit consent', () => {
    expect(resolveMode('PRIVATE', { forceCloud: true, consentToCloud: true })).toBe('only_in_cloud');
  });

  it('prefers on-device for explanations derived from private facts', () => {
    expect(resolveMode('PRIVATE_DERIVED')).toBe('prefer_on_device');
  });

  it('prefers the cloud for non-identifying trip facts (falls back on-device offline)', () => {
    expect(resolveMode('TRIP_FACTS')).toBe('prefer_in_cloud');
  });

  it('uses the cloud for public official sources', () => {
    expect(resolveMode('PUBLIC')).toBe('only_in_cloud');
  });

  it('lets the demo be forced to the cloud', () => {
    expect(resolveMode('DEMO')).toBe('prefer_on_device');
    expect(resolveMode('DEMO', { forceCloud: true })).toBe('only_in_cloud');
  });

  it('documents a reason for every data class', () => {
    for (const rule of Object.values(ROUTING_TABLE)) expect(rule.why.length).toBeGreaterThan(10);
  });

  it('labels where an answer came from', () => {
    expect(describeSource('on_device', 'prefer_on_device')).toMatch(/On this device/);
    expect(describeSource('in_cloud', 'prefer_on_device')).toMatch(/fallback/);
    expect(describeSource('in_cloud', 'only_in_cloud')).toBe('Cloud · Gemini');
  });
});
