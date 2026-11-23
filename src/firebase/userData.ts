// What an account stores, and nothing else: users/{uid} = { trip, checked, updatedAt }.
// `trip` = the answers that choose which rules apply (destination, dates, purpose…);
// `checked` = ids of checklist items the person ticked. No document, no extracted field, no result.
// firestore.rules enforces the owner and these exact keys.

import { deleteDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';
import type { Trip } from '../core/rules/trip';

export interface UserData {
  trip?: Trip;
  checked?: string[];
}

const ref = (app: FirebaseApp, uid: string) => doc(getFirestore(app), 'users', uid);

export async function loadUserData(app: FirebaseApp, uid: string): Promise<UserData | null> {
  const snap = await getDoc(ref(app, uid));
  return snap.exists() ? (snap.data() as UserData) : null;
}

export async function saveUserData(app: FirebaseApp, uid: string, data: Required<UserData>): Promise<void> {
  await setDoc(ref(app, uid), { trip: data.trip, checked: data.checked.slice(0, 199), updatedAt: serverTimestamp() });
}

export async function deleteUserData(app: FirebaseApp, uid: string): Promise<void> {
  await deleteDoc(ref(app, uid));
}
