import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  doc, getDoc, setDoc,
  collection, onSnapshot,
  writeBatch, serverTimestamp, deleteDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth           = getAuth(app);
export const db             = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export async function getOrCreateUserProfile(firebaseUser, characterName, nation) {
  const ref  = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const profile = {
      uid:         firebaseUser.uid,
      email:       firebaseUser.email,
      displayName: characterName ?? firebaseUser.displayName ?? firebaseUser.email.split("@")[0],
      role:        "player",
      nation:      nation ?? null,
      createdAt:   serverTimestamp(),
    };
    await setDoc(ref, profile);
    return profile;
  }
  const stored = snap.data();
  const resolved = characterName ?? firebaseUser.displayName;
  const updated = { ...stored };
  let needsUpdate = false;

  if (resolved && resolved !== stored.displayName) {
    updated.displayName = resolved;
    needsUpdate = true;
  }
  if (nation && nation !== stored.nation) {
    updated.nation = nation;
    needsUpdate = true;
  }

  if (needsUpdate) {
    await setDoc(ref, updated, { merge: true });
    return updated;
  }

  return stored;
}

export function subscribeToTokens(sessionId, callback) {
  const colRef = collection(db, "sessions", sessionId, "tokens");
  return onSnapshot(colRef, (snapshot) => {
    const tokens = [];
    snapshot.forEach((d) => tokens.push({ id: d.id, ...d.data() }));
    callback(tokens);
  });
}

export async function saveTokens(sessionId, tokens, currentUserId = null, isAdmin = false) {
  const batch = writeBatch(db);
  tokens.forEach((token) => {
    if (!isAdmin) {
      if (!token.ownerId || token.ownerId !== currentUserId) return;
    }
    const ref = doc(db, "sessions", sessionId, "tokens", token.id);
    batch.set(ref, {
      faction:   token.faction,
      x:         token.x,
      y:         token.y,
      count:     token.count,
      notes:     token.notes,
      ownerId:   token.ownerId ?? null,
      nation:    token.nation ?? null,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function deleteToken(sessionId, tokenId) {
  const ref = doc(db, "sessions", sessionId, "tokens", tokenId);
  await deleteDoc(ref);
}
