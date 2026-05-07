import { useState, useCallback } from "react";
import { getHistory, deleteHistoryEntry } from "../firebase";

function snapshotEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.x       === b.x       &&
    a.y       === b.y       &&
    a.count   === b.count   &&
    a.faction === b.faction &&
    JSON.stringify(a.notes   ?? []) === JSON.stringify(b.notes   ?? []) &&
    JSON.stringify(a.gmNotes ?? []) === JSON.stringify(b.gmNotes ?? [])
  );
}

async function applyUndo({ entryId, description, prevSnapshot, changedIds }, tokens, setTokensAndSave, sessionId) {
  const changedSet   = new Set(changedIds);
  const currentById  = Object.fromEntries(tokens.map(t => [t.id, t]));
  const result       = [];
  const processed    = new Set();

  for (const t of tokens) {
    if (!changedSet.has(t.id)) {
      result.push(t);
    } else {
      processed.add(t.id);
      const prev = prevSnapshot[t.id];
      if (prev) result.push({ id: t.id, ...prev }); // restore; omit = delete (user added it)
    }
  }

  // Restore tokens the user deleted (in prevSnapshot but gone from live board)
  for (const [id, snap] of Object.entries(prevSnapshot)) {
    if (changedSet.has(id) && !processed.has(id) && !currentById[id]) {
      result.push({ id, ...snap });
    }
  }

  setTokensAndSave(result, { actionType: "undo", description: `Undo: ${description}` });

  try {
    await deleteHistoryEntry(sessionId, entryId);
  } catch (err) {
    console.error("Failed to remove history entry after undo:", err);
  }
}

export function useUndoLastAction({ sessionId, userId, tokens, setTokensAndSave }) {
  const [status,        setStatus]        = useState("idle"); // "idle" | "loading" | "confirming"
  const [undoData,      setUndoData]      = useState(null);
  const [nothingToUndo, setNothingToUndo] = useState(false);

  const triggerUndo = useCallback(async () => {
    if (!sessionId || !userId || status !== "idle") return;
    setStatus("loading");

    try {
      const history = await getHistory(sessionId);

      // Most recent entry by this user that isn't itself an undo
      let myAbsIdx = -1;
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].actorId === userId && history[i].actionType !== "undo") {
          myAbsIdx = i;
          break;
        }
      }

      if (myAbsIdx === -1) {
        setStatus("idle");
        setNothingToUndo(true);
        setTimeout(() => setNothingToUndo(false), 2000);
        return;
      }

      const myEntry   = history[myAbsIdx];
      const prevEntry = myAbsIdx > 0 ? history[myAbsIdx - 1] : null;
      const mySnap    = myEntry.snapshot   ?? {};
      const prevSnap  = prevEntry?.snapshot ?? {};

      // Which token IDs did this action affect?
      const allIds    = new Set([...Object.keys(mySnap), ...Object.keys(prevSnap)]);
      const changedIds = [];
      for (const id of allIds) {
        const inMy   = id in mySnap;
        const inPrev = id in prevSnap;
        if (inMy !== inPrev || (inMy && JSON.stringify(mySnap[id]) !== JSON.stringify(prevSnap[id]))) {
          changedIds.push(id);
        }
      }

      // Detect whether any affected token has since been changed by someone else
      const currentById = Object.fromEntries(tokens.map(t => [t.id, t]));
      let warning = null;
      for (const id of changedIds) {
        const myVal = mySnap[id];
        const cur   = currentById[id];
        if (myVal && !cur) {
          warning = "A token you affected has since been removed by another player."; break;
        }
        if (!myVal && cur) {
          warning = "A token you removed has since been restored by another player."; break;
        }
        if (myVal && cur && !snapshotEqual(myVal, cur)) {
          warning = "A token you affected has since been modified by another player."; break;
        }
      }

      const data = { entryId: myEntry.id, description: myEntry.description, prevSnapshot: prevSnap, changedIds, warning };

      if (warning) {
        setUndoData(data);
        setStatus("confirming");
      } else {
        await applyUndo(data, tokens, setTokensAndSave, sessionId);
        setStatus("idle");
      }
    } catch (err) {
      console.error("Undo error:", err);
      setStatus("idle");
    }
  }, [sessionId, userId, status, tokens, setTokensAndSave]);

  const confirmUndo = useCallback(async () => {
    if (!undoData) return;
    await applyUndo(undoData, tokens, setTokensAndSave, sessionId);
    setUndoData(null);
    setStatus("idle");
  }, [undoData, tokens, setTokensAndSave, sessionId]);

  const cancelUndo = useCallback(() => {
    setUndoData(null);
    setStatus("idle");
  }, []);

  return { undoStatus: status, undoData, nothingToUndo, triggerUndo, confirmUndo, cancelUndo };
}
