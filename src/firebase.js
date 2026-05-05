// ─────────────────────────────────────────────────────────────────────────────
// firebase.js
// Replace the placeholder values below with your own Firebase project config.
// Get them from: Firebase Console → Project Settings → Your apps → Web app
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

// ── 🔧 REPLACE THESE with your Firebase project values ──────────────────────
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};
// ────────────────────────────────────────────────────────────────────────────

const app  = initializeApp(firebaseConfig);

export const auth     = getAuth(app);
export const db       = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// ── Firestore helpers ────────────────────────────────────────────────────────

/**
 * Fetch (or create) a user profile document.
 * First-ever sign-in creates the doc with role = "player".
 * To promote someone to admin, manually set role = "admin" in Firestore console.
 */
export async function getOrCreateUserProfile(firebaseUser) {
  const ref = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const profile = {
      uid:         firebaseUser.uid,
      email:       firebaseUser.email,
      displayName: firebaseUser.displayName ?? firebaseUser.email.split("@")[0],
      role:        "player",              // default — promote in Firestore console
      createdAt:   serverTimestamp(),
    };
    await setDoc(ref, profile);
    return profile;
  }
  return snap.data();
}

/**
 * Subscribe to the tokens collection for a given session/map.
 * Returns an unsubscribe function.
 * Each document in `sessions/{sessionId}/tokens` represents one token.
 */
export function subscribeToTokens(sessionId, callback) {
  const colRef = collection(db, "sessions", sessionId, "tokens");
  return onSnapshot(colRef, (snapshot) => {
    const tokens = [];
    snapshot.forEach((d) => tokens.push({ id: d.id, ...d.data() }));
    callback(tokens);
  });
}

/**
 * Persist the full token array to Firestore using a batch write.
 * This overwrites the entire collection for the session — suitable for
 * Phase I where one "active battle" exists at a time.
 *
 * In Phase III (timeline / snapshots) you would extend this to write
 * a timeline entry alongside the live token state.
 */
export async function saveTokens(sessionId, tokens) {
  const batch = writeBatch(db);

  // Write each token as its own document (id = token.id)
  tokens.forEach((token) => {
    const ref = doc(db, "sessions", sessionId, "tokens", token.id);
    batch.set(ref, {
      faction: token.faction,
      x:       token.x,
      y:       token.y,
      count:   token.count,
      notes:   token.notes,
      ownerId: token.ownerId ?? null,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

/**
 * Delete a single token document from the session.
 */
export async function deleteToken(sessionId, tokenId) {
  const { deleteDoc } = await import("firebase/firestore");
  const ref = doc(db, "sessions", sessionId, "tokens", tokenId);
  await deleteDoc(ref);
}
