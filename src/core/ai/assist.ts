// Step 7: the two other hybrid directions.
//  - explainFinding: PRIVATE_DERIVED. On-device with the full detail when Gemini Nano is ready;
//    otherwise the cloud receives a *reduced* payload (rule id + generic wording, no personal values).
//    We pick the payload ourselves instead of letting the SDK fall back with the full prompt.
//  - coverLetter: TRIP_FACTS. Prefer the cloud (better writing); no name or document number is sent:
//    placeholders are filled in locally afterwards. Falls back on-device when offline.

import type { AI } from 'firebase/ai';
import { getModel, DEFAULT_CLOUD_MODEL } from './modelFactory';
import { generateWithRetry } from './retry';
import { checkOnDeviceStatus } from './onDevice';
import { resolveMode, type InferenceSourceValue } from '../routing/policy';
import { record } from '../routing/ledger';
import type { Finding } from '../rules/checks';
import type { Library } from '../data/library';
import { DESTINATIONS, PURPOSES, STATUSES, type Trip } from '../rules/trip';
import { pretty, stayDays } from '../rules/dates';

export interface AssistResult {
  text: string;
  source: InferenceSourceValue;
  payload: string;
}

function refusalText(f: Finding, lib: Library): string {
  if (!f.refusalReason) return f.consequence ?? '';
  return lib.facts.find((x) => x.id === `refusal.${f.refusalReason}`)?.statement ?? '';
}

export function explainPrompts(f: Finding, lib: Library): { full: string; reduced: string } {
  const why = refusalText(f, lib);
  const base = 'You help a Tunisian applicant prepare a Schengen short-stay visa file. In 3 short sentences, in plain English: why consulates check this, what the risk is, and the concrete next step in Tunisia. No legal advice disclaimers.';
  return {
    full: `${base}\nCheck: ${f.title}\nResult: ${f.detail}\nSuggested fix: ${f.fix ?? ''}\nRisk: ${why}`,
    reduced: `${base}\nCheck id: ${f.id} ("${f.title}") failed.\nRisk: ${why}`,
  };
}

export async function explainFinding(ai: AI, f: Finding, lib: Library, forceCloud = false): Promise<AssistResult> {
  const { full, reduced } = explainPrompts(f, lib);
  const onDevice = !forceCloud && (await checkOnDeviceStatus()) === 'available';
  const mode = onDevice ? 'only_on_device' : resolveMode('PRIVATE_DERIVED', { forceCloud: true });
  const payload = onDevice ? full : reduced;
  const result = await generateWithRetry(getModel(ai, mode), payload);
  const source = result.response.inferenceSource ?? (onDevice ? 'on_device' : 'in_cloud');
  record({ task: `Explain “${f.title}”`, dataClass: 'PRIVATE_DERIVED', where: source, payload: source === 'in_cloud' ? payload : undefined, chars: payload.length });
  return { text: result.response.text().trim(), source, payload };
}

export const LETTER_PLACEHOLDERS = ['[FULL NAME]', '[PASSPORT NUMBER]', '[EMPLOYER OR SCHOOL]', '[CITY]'] as const;

export function coverLetterPrompt(trip: Trip): string {
  return [
    'Write a short, formal cover letter (max 180 words, in English) for a Schengen short-stay visa application.',
    `Destination: ${DESTINATIONS[trip.destination]}. Purpose: ${PURPOSES[trip.purpose]}.`,
    `Dates: ${pretty(trip.entryDate)} to ${pretty(trip.exitDate)} (${stayDays(trip.entryDate, trip.exitDate)} days).`,
    `Applicant situation in Tunisia: ${STATUSES[trip.status]}. Trip paid by: ${trip.sponsored ? 'a sponsor' : 'the applicant'}.`,
    `Use exactly these placeholders where personal details go: ${LETTER_PLACEHOLDERS.join(', ')}.`,
    'Mention ties to Tunisia and the intention to return. Address it "To the Visa Section". No invented facts. Plain text only.',
  ].join('\n');
}

export async function coverLetter(ai: AI, trip: Trip, forceOnDevice = false): Promise<AssistResult> {
  const payload = coverLetterPrompt(trip);
  const mode = forceOnDevice ? 'only_on_device' : resolveMode('TRIP_FACTS');
  const result = await generateWithRetry(getModel(ai, mode), payload);
  const source = result.response.inferenceSource ?? (forceOnDevice ? 'on_device' : 'in_cloud');
  record({ task: 'Cover letter', dataClass: 'TRIP_FACTS', where: source, payload: source === 'in_cloud' ? payload : undefined, chars: payload.length });
  return { text: result.response.text().trim(), source, payload };
}

/** Local step: replace placeholders with the user's details. Never sent anywhere. */
export function fillPlaceholders(text: string, values: Partial<Record<(typeof LETTER_PLACEHOLDERS)[number], string>>): string {
  let out = text;
  for (const [k, v] of Object.entries(values)) if (v) out = out.split(k).join(v);
  return out;
}

export { DEFAULT_CLOUD_MODEL };
