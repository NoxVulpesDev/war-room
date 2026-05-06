import { useState, useRef, useCallback, useEffect } from "react";
import { subscribeToTokens, saveTokens } from "../firebase";
import { SAVE_DEBOUNCE } from "../constants";

export function useFirestoreTokenSync({ isPlayer, selectedMap, sessionId, userId, isAdminMode }) {
  const [tokens,     setTokens]     = useState([]);
  const [saveStatus, setSaveStatus] = useState("idle");

  const saveTimerRef   = useRef(null);
  const localTokensRef = useRef([]);

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

  const scheduleSave = useCallback((latestTokens) => {
    if (!isPlayer || !selectedMap) return;
    localTokensRef.current = latestTokens;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(async () => {
      saveTimerRef.current = null;
      try {
        await saveTokens(sessionId, localTokensRef.current, userId, isAdminMode);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Firestore save error:", err);
        setSaveStatus("error");
      }
    }, SAVE_DEBOUNCE);
  }, [isPlayer, selectedMap, sessionId, userId, isAdminMode]);

  const setTokensAndSave = useCallback((updater) => {
    setTokens(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  return { tokens, setTokens, setTokensAndSave, saveStatus };
}
