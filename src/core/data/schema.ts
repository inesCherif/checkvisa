// Schemas for the CheckVisa dataset (data/). Every fact must point to a source record and quote it.
// Validated in tests (tests/core/data.test.ts) and again before publishing to Firestore.

import { z } from 'zod';

export const AuthoritySchema = z.enum([
  'eu-law', // binding EU regulation (EUR-Lex)
  'eu-guidance', // Commission decisions, Visa Code Handbook
  'national-official', // a Schengen state's government website
  'visa-centre', // external service provider (TLScontact, VFS, BLS, Almaviva)
  'statistics', // official statistics
  'central-bank', // Banque Centrale de Tunisie
  'standard', // ICAO
  'project', // our own generated material (test documents)
]);
export type Authority = z.infer<typeof AuthoritySchema>;

export const VerificationSchema = z.enum(['verified', 'to-verify']);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const SourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(3),
  publisher: z.string().min(2),
  authority: AuthoritySchema,
  url: z.url(),
  /** Permanent identifier when one exists (EU ELI / CELEX). */
  permanentId: z.string().optional(),
  /** Version or "as of" date printed on the source itself. */
  versionDate: isoDate.optional(),
  /** When we downloaded / read it. */
  retrievedAt: isoDate,
  /** SHA-256 of the exact file we read (hex), when we have a copy. */
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  /** Wayback Machine snapshot, so the source survives website changes. */
  archiveUrl: z.url().optional(),
  language: z.string().min(2),
  licence: z.string().min(3),
  refresh: z.enum(['permanent', 'yearly', 'monthly', 'weekly', 'on-change']),
  usedFor: z.string().min(5),
  status: VerificationSchema,
  notes: z.string().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export const TopicSchema = z.enum([
  'passport',
  'insurance',
  'fee',
  'fee-waiver',
  'means',
  'documents',
  'refusal-ground',
  'stay-limit',
  'visa-centre',
  'appointments',
  'statistics',
  'exchange-rate',
  'allowance',
  'mrz',
]);
export type Topic = z.infer<typeof TopicSchema>;

export const FactSchema = z.object({
  id: z.string().regex(/^[a-z0-9.-]+$/),
  topic: TopicSchema,
  /** Plain-English statement shown in the app. */
  statement: z.string().min(10),
  /** Machine-usable value for the rule engine (number, text, or small object). */
  value: z.union([z.number(), z.string(), z.boolean(), z.record(z.string(), z.unknown())]).optional(),
  unit: z.string().optional(),
  sourceId: z.string(),
  /** Where in the source: article, paragraph, page, section. */
  locator: z.string().min(2),
  /** Short verbatim quote from the source (original language). */
  quote: z.string().min(5).max(600),
  /** Schengen states this fact applies to (ISO 3166 alpha-2), when not all of them. */
  states: z.array(z.string().length(2)).optional(),
  validFrom: isoDate.optional(),
  status: VerificationSchema,
  notes: z.string().optional(),
});
export type Fact = z.infer<typeof FactSchema>;

export const FactFileSchema = z.object({
  title: z.string(),
  facts: z.array(FactSchema).min(1),
});

export const StatsRowSchema = z.object({
  schengenState: z.string(),
  consulate: z.string(),
  applied: z.number().int().nonnegative(),
  issued: z.number().int().nonnegative(),
  multipleEntryIssued: z.number().int().nonnegative(),
  ltvIssued: z.number().int().nonnegative(),
  notIssued: z.number().int().nonnegative(),
  notIssuedRate: z.number().min(0).max(1).nullable(),
});

export const StatsFileSchema = z.object({
  dataset: z.literal('ec-visa-statistics-consulates'),
  year: z.number().int(),
  country: z.string(),
  sourceId: z.string(),
  sourceUrl: z.url(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  retrievedAt: isoDate,
  definitions: z.record(z.string(), z.string()),
  totals: z.object({
    applied: z.number(),
    issued: z.number(),
    ltvIssued: z.number(),
    notIssued: z.number(),
    notIssuedRate: z.number(),
  }),
  rows: z.array(StatsRowSchema).min(1),
});
export type StatsFile = z.infer<typeof StatsFileSchema>;
