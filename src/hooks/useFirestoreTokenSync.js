import { useState, useRef, useCallback, useEffect } from "react";
import { subscribeToTokens, saveTokens, saveHistoryEntry } from "../firebase";
import { SAVE_DEBOUNCE } from "../constants";

export function useFirestoreTokenSync({ isPlayer, selectedMap, sessionId, userId, actorName, isAdminMode, isMonarch, userNation }) {
  const [tokens,     setTokens]     = useState([]);
  const [saveStatus, setSaveStatus] = useState("idle");

  const saveTimerRef      = useRef(null);
  const localTokensRef    = useRef([]);
  const pendingDeletesRef = useRef(new Set());

  // Re-subscribe whenever the active map changes
  useEffect(() => {
    if (!isPlayer || !selectedMap) return;
    const unsub = subscribeToTokens(sessionId, (remoteTokens) => {
      // Only update from Firestore when no local write is pending —
      // avoids stomping mid-drag state
      if (!saveTimerRef.current) {
        setTokens(remoteTokens);
        localTokensRef.current = remoteTokens;
      }
    });
    return unsub;
  }, [isPlayer, sessionId, selectedMap]);

  const pendingActionMetaRef = useRef(null);

  const scheduleSave = useCallback((latestTokens, removedIds = [], actionMeta = null) => {
    if (!isPlayer || !selectedMap) return;
    localTokensRef.current = latestTokens;
    removedIds.forEach(id => pendingDeletesRef.current.add(id));
    // Last actionMeta before the debounce fires wins (most recent intentional action)
    if (actionMeta) pendingActionMetaRef.current = actionMeta;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(async () => {
      saveTimerRef.current = null;
      const toDelete = [...pendingDeletesRef.current];
      pendingDeletesRef.current.clear();
      const meta = pendingActionMetaRef.current;
      pendingActionMetaRef.current = null;
      try {
        await saveTokens(sessionId, localTokensRef.current, userId, isAdminMode, toDelete, isMonarch ? userNation : null);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
        if (meta) {
          saveHistoryEntry(sessionId, localTokensRef.current, {
            actorId:     userId,
            actorName:   actorName ?? null,
            actionType:  meta.actionType,
            description: meta.description,
          }).catch(err => console.error("History write error:", err));
        }
      } catch (err) {
        console.error("Firestore save error:", err);
        setSaveStatus("error");
      }
    }, SAVE_DEBOUNCE);
  }, [isPlayer, selectedMap, sessionId, userId, actorName, isAdminMode, isMonarch, userNation]);

  const setTokensAndSave = useCallback((updater, actionMeta = null) => {
    setTokens(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const prevIds = new Set(prev.map(t => t.id));
      const nextIds = new Set(next.map(t => t.id));
      const removedIds = [...prevIds].filter(id => !nextIds.has(id));
      scheduleSave(next, removedIds, actionMeta);
      return next;
    });
  }, [scheduleSave]);

  return { tokens, setTokens, setTokensAndSave, saveStatus };
}
