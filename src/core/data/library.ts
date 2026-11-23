// The bundled CheckVisa dataset (data/), validated and indexed.
// Step 2 serves it from the bundle; the same records are published to Firestore so they can be
// updated without a redeploy (see src/firebase/library.ts).

import sourcesJson from '../../../data/sources.json';
import euLaw from '../../../data/facts/eu-law.json';
import refusalGrounds from '../../../data/facts/refusal-grounds.json';
import harmonisedList from '../../../data/facts/harmonised-list-tn.json';
import referenceAmounts from '../../../data/facts/reference-amounts.json';
import visaCentres from '../../../data/facts/visa-centres-tn.json';
import stats2025 from '../../../data/stats/ec-consulates-tunisia-2025.json';
import stats2023 from '../../../data/stats/ec-consulates-tunisia-2023.json';
import { FactFileSchema, SourceSchema, StatsFileSchema, type Fact, type Source, type StatsFile } from './schema';

export const DATASET_VERSION = '2026-11-23';

export interface Library {
  version: string;
  sources: Source[];
  facts: Fact[];
  stats: StatsFile[];
  sourceById: Map<string, Source>;
  factsBySource: Map<string, Fact[]>;
}

export function buildLibrary(raw: { sources: unknown; factFiles: unknown[]; stats: unknown[]; version?: string }): Library {
  const sources = SourceSchema.array().parse(raw.sources);
  const facts = raw.factFiles.flatMap((file) => FactFileSchema.parse(file).facts);
  const stats = raw.stats.map((s) => StatsFileSchema.parse(s));

  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const factsBySource = new Map<string, Fact[]>();
  for (const fact of facts) {
    if (!sourceById.has(fact.sourceId)) throw new Error(`Fact ${fact.id} cites unknown source ${fact.sourceId}`);
    factsBySource.set(fact.sourceId, [...(factsBySource.get(fact.sourceId) ?? []), fact]);
  }
  return { version: raw.version ?? DATASET_VERSION, sources, facts, stats, sourceById, factsBySource };
}

export const BUNDLED_RAW = {
  version: DATASET_VERSION,
  sources: sourcesJson,
  factFiles: [euLaw, refusalGrounds, harmonisedList, referenceAmounts, visaCentres],
  stats: [stats2025, stats2023],
};

export const bundledLibrary = (): Library => buildLibrary(BUNDLED_RAW);
