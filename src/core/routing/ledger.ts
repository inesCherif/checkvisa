// The privacy ledger: every AI call is recorded here with where it ran. For cloud calls the exact
// payload is kept so the user can read precisely what left the device. In memory only.

import type { DataClass, InferenceSourceValue } from './policy';

export interface LedgerEntry {
  id: number;
  at: string;
  task: string;
  dataClass: DataClass;
  where: InferenceSourceValue | 'blocked';
  /** Exact text sent to the cloud (cloud calls only). */
  payload?: string;
  chars: number;
}

let entries: LedgerEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

export function record(e: Omit<LedgerEntry, 'id' | 'at'>): void {
  entries = [{ ...e, id: nextId++, at: new Date().toLocaleTimeString('en-GB') }, ...entries];
  listeners.forEach((l) => l());
}

export function getLedger(): LedgerEntry[] {
  return entries;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
