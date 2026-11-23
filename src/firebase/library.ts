// Live copy of the dataset in Firestore.
//   meta/dataset            { version, publishedAt, counts }
//   sources/{id}            Source records
//   facts/{id}              Fact records
//   stats/{country-year}    Commission statistics files
// Reads: any signed-in (anonymous) user. Writes: maintainer only (firestore.rules).

import { collection, doc, getDoc, getDocs, getFirestore, writeBatch } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';
import { buildLibrary, type Library } from '../core/data/library';

export async function loadLibraryFromFirestore(app: FirebaseApp): Promise<Library | null> {
  const db = getFirestore(app);
  const meta = await getDoc(doc(db, 'meta', 'dataset'));
  if (!meta.exists()) return null;
  const [sources, facts, stats] = await Promise.all(
    ['sources', 'facts', 'stats'].map((name) => getDocs(collection(db, name))),
  );
  return buildLibrary({
    version: String(meta.data().version),
    sources: sources.docs.map((d) => d.data()),
    factFiles: [{ title: 'firestore', facts: facts.docs.map((d) => d.data()) }],
    stats: stats.docs.map((d) => d.data()),
  });
}

/** Maintainer action: copy the bundled, schema-validated dataset into Firestore. */
export async function publishLibrary(app: FirebaseApp, lib: Library): Promise<number> {
  const db = getFirestore(app);
  const docs: Array<[string, string, object]> = [
    ...lib.sources.map((s): [string, string, object] => ['sources', s.id, s]),
    ...lib.facts.map((f): [string, string, object] => ['facts', f.id, f]),
    ...lib.stats.map((s): [string, string, object] => ['stats', `${s.country.toLowerCase()}-${s.year}`, s]),
  ];
  // Firestore batches hold at most 500 writes.
  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(db);
    for (const [col, id, data] of docs.slice(i, i + 450)) batch.set(doc(db, col, id), JSON.parse(JSON.stringify(data)));
    await batch.commit();
  }
  const batch = writeBatch(db);
  batch.set(doc(db, 'meta', 'dataset'), {
    version: lib.version,
    publishedAt: new Date().toISOString(),
    counts: { sources: lib.sources.length, facts: lib.facts.length, stats: lib.stats.length },
  });
  await batch.commit();
  return docs.length + 1;
}
