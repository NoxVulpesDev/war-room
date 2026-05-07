import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  doc, getDoc, setDoc,
  collection, onSnapshot,
  writeBatch, serverTimestamp, deleteDoc,
  getDocs, addDoc, query, orderBy, limit,
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
      role:        "commander",
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

export async function saveTokens(sessionId, tokens, currentUserId = null, isAdmin = false, deleteIds = [], monarchNation = null) {
  const batch = writeBatch(db);
  tokens.forEach((token) => {
    if (!isAdmin) {
      const ownedByUser = token.ownerId && token.ownerId === currentUserId;
      const monarchCanSave = monarchNation && token.nation === monarchNation && token.faction !== "enemy";
      if (!ownedByUser && !monarchCanSave) return;
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
      members:   token.members ?? [],
      updatedAt: serverTimestamp(),
    });
  });
  deleteIds.forEach((id) => {
    batch.delete(doc(db, "sessions", sessionId, "tokens", id));
  });
  await batch.commit();
}

export async function donateToken(sessionId, tokenId, newOwnerId, newNation) {
  await setDoc(doc(db, "sessions", sessionId, "tokens", tokenId),
    { ownerId: newOwnerId, nation: newNation, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function deleteToken(sessionId, tokenId) {
  const ref = doc(db, "sessions", sessionId, "tokens", tokenId);
  await deleteDoc(ref);
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => ({ ...d.data(), uid: d.id }));
}

export async function updateUserProfile(uid, updates) {
  await setDoc(doc(db, "users", uid), updates, { merge: true });
}

export async function getGlobalSettings() {
  const snap = await getDoc(doc(db, "config", "global"));
  return snap.exists() ? snap.data() : { defaultMaxTokens: null };
}

export async function updateGlobalSettings(updates) {
  await setDoc(doc(db, "config", "global"), updates, { merge: true });
}

export async function clearHistory(sessionId) {
  const snap = await getDocs(collection(db, "sessions", sessionId, "history"));
  if (snap.empty) return 0;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

export async function getHistory(sessionId) {
  const q = query(
    collection(db, "sessions", sessionId, "history"),
    orderBy("timestamp", "desc"),
    limit(100)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
}

export async function saveHistoryEntry(sessionId, tokens, { actorId, actorName, actionType, description }) {
  const snapshot = {};
  tokens.forEach((t) => {
    snapshot[t.id] = {
      faction: t.faction,
      x:       t.x,
      y:       t.y,
      count:   t.count,
      notes:   t.notes   ?? [],
      ownerId: t.ownerId ?? null,
      nation:  t.nation  ?? null,
      members: t.members ?? [],
    };
  });
  await addDoc(collection(db, "sessions", sessionId, "history"), {
    timestamp:   serverTimestamp(),
    actorId:     actorId  ?? null,
    actorName:   actorName ?? null,
    actionType,
    description,
    snapshot,
  });
}
