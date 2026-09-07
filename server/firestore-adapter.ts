/**
 * Firestore Adapter for Vercel deployment.
 * Replaces filesystem JSON persistence with Firebase Firestore.
 * Uses firebase-admin SDK with service account credentials from env vars.
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'nice-victor-58gvj';
const DATABASE_ID =
  process.env.FIREBASE_DATABASE_ID ||
  'ai-studio-pemilihanperwaki-83293269-9974-47dc-a459-a915defdc295';

const SYSTEM_COLLECTION = 'system_state';
const DB_DOC_ID = 'election_db';

let _app: App | null = null;
let _db: Firestore | null = null;

function getDb(): Firestore {
  if (_db) return _db;

  if (getApps().length === 0) {
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (clientEmail && privateKey) {
      _app = initializeApp({
        credential: cert({ projectId: PROJECT_ID, clientEmail, privateKey }),
      });
    } else {
      // Fallback: Application Default Credentials (local dev / GCP)
      _app = initializeApp({ projectId: PROJECT_ID });
    }
  } else {
    _app = getApps()[0];
  }

  _db = getFirestore(_app, DATABASE_ID);
  return _db;
}

export async function loadDbFromFirestore(): Promise<any | null> {
  try {
    const db = getDb();
    const snap = await db.collection(SYSTEM_COLLECTION).doc(DB_DOC_ID).get();
    if (snap.exists) {
      const data = snap.data();
      // Firestore stores arrays fine but we stored JSON string to avoid nested array limits
      if (data && data.json_blob) {
        return JSON.parse(data.json_blob as string);
      }
      if (data) return data;
    }
    return null;
  } catch (err) {
    console.error('[FirestoreAdapter] loadDbFromFirestore error:', err);
    return null;
  }
}

export async function saveDbToFirestore(state: any): Promise<void> {
  try {
    const db = getDb();
    // Store as JSON string blob to avoid Firestore document size limits on nested arrays
    const json_blob = JSON.stringify(state);
    await db.collection(SYSTEM_COLLECTION).doc(DB_DOC_ID).set({
      json_blob,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[FirestoreAdapter] saveDbToFirestore error:', err);
  }
}

export function isFirestoreConfigured(): boolean {
  return !!(
    process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
  );
}
