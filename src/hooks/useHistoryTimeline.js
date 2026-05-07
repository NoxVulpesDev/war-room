import { useState, useCallback, useEffect } from "react";
import { getHistory } from "../firebase";

export function useHistoryTimeline({ sessionId }) {
  const [isOpen,       setIsOpen]       = useState(false);
  const [entries,      setEntries]      = useState([]);
  const [viewingIndex, setViewingIndex] = useState(null);
  const [loading,      setLoading]      = useState(false);

  const isReplaying = isOpen && viewingIndex !== null;

  const currentSnapshot = isReplaying && entries[viewingIndex]?.snapshot
    ? Object.entries(entries[viewingIndex].snapshot).map(([id, data]) => ({ id, ...data }))
    : null;

  const exitReplay = useCallback(() => {
    setIsOpen(false);
    setViewingIndex(null);
    setEntries([]);
  }, []);

  // Reset when the active map changes
  useEffect(() => {
    exitReplay();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openTimeline = useCallback(async () => {
    setIsOpen(true);
    setLoading(true);
    try {
      const history = await getHistory(sessionId);
      setEntries(history);
      setViewingIndex(history.length > 0 ? history.length - 1 : null);
    } catch (err) {
      console.error("History fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  return {
    isOpen, entries, viewingIndex, setViewingIndex,
    isReplaying, currentSnapshot,
    loading, openTimeline, exitReplay,
  };
}
