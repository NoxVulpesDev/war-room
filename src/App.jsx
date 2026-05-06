import { useState, useRef, useCallback, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth, subscribeToTokens, saveTokens, deleteToken } from "./firebase";
import AuthModal from "./AuthModal";
import AdminPanel from "./AdminPanel";
import { MAPS, FACTIONS, NATIONS, TOKEN_RADIUS, MERGE_THRESHOLD, SAVE_DEBOUNCE } from "./constants";
import { getMapLayoutBounds, getMapScreenBounds, generateId, findMergeTarget } from "./utils";
import KnotCorner from "./components/KnotCorner";
import { useAuth } from "./hooks/useAuth";

// ─────────────────────────────────────────────────────────────────────────────
export default function BattleMap() {
  const {
    authReady, firebaseUser, userProfile, setUserProfile,
    userProfiles, showAuthModal, setShowAuthModal,
    adminMode, setAdminMode,
    isAdmin, isMonarch, isCommander, isPlayer, isAdminMode,
    handleAuthSuccess,
  } = useAuth();

  // ── Map / session state ─────────────────────────────────────────────────────
  const [mapImage,     setMapImage]     = useState(null);
  const [selectedMap,  setSelectedMap]  = useState("");
  // sessionId is derived from the selected map — one Firestore collection per map
  const sessionId = selectedMap || "default";
  // True when a non-admin-mode user with a known nation views another nation's map
  const onForeignMap = !isAdminMode && !!selectedMap && !!userProfile?.nation && selectedMap !== userProfile.nation;

  // ── Token state (source of truth = local; synced to/from Firestore) ──────────
  const [tokens,       setTokens]       = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [placingFaction, setPlacingFaction] = useState("player");
  const [mode,         setMode]         = useState("place");
  const [noteInput,    setNoteInput]    = useState("");
  const [dragId,       setDragId]       = useState(null);
  const [showPanel,         setShowPanel]         = useState(false);
  const [showAdminPanel,    setShowAdminPanel]    = useState(false);
  const [tokenLimitWarning, setTokenLimitWarning] = useState(false);
  const [splitCount,   setSplitCount]   = useState(1);

  // ── Save status indicator ───────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState("idle"); // "idle" | "saving" | "saved" | "error"

  // ── Pan & zoom ──────────────────────────────────────────────────────────────
  const [zoom, setZoom]           = useState(1);
  const [pan,  setPan]            = useState({ x: 0, y: 0 });
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const canvasRef      = useRef(null);
  const mapImgRef      = useRef(null);
  const zoomRef        = useRef(1);
  const panRef         = useRef({ x: 0, y: 0 });
  const dragPanRef     = useRef(null);
  const touchRef       = useRef(null);
  const tokenTouchRef  = useRef(null);
  const saveTimerRef   = useRef(null);
  const localTokensRef = useRef([]); // kept in sync for debounced saves

  const [mapNaturalSize, setMapNaturalSize] = useState(null);

  const selectedToken = tokens.find(t => t.id === selected);

  // Preload all map images on mount so switching between maps is instant.
  useEffect(() => {
    MAPS.forEach(({ src }) => { const img = new Image(); img.src = src; });
  }, []);

  useEffect(() => {
    if (userProfile?.nation && !selectedMap) {
      const map = MAPS.find(m => m.id === userProfile.nation);
      if (map) {
        setSelectedMap(userProfile.nation);
        setMapImage(map.src);
        setMapNaturalSize(null);
        setTokens([]);
        setSelected(null);
      }
    }
  }, [userProfile]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setContainerSize({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, [authReady]);

  // ─────────────────────────────────────────────────────────────────────────────
  // FIRESTORE REAL-TIME LISTENER  (re-subscribes when map changes)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlayer || !selectedMap) return;
    const unsub = subscribeToTokens(sessionId, (remoteTokens) => {
      // Only update from Firestore if we have no pending local writes
      // (avoids stomping on mid-drag state)
      if (!saveTimerRef.current) {
        setTokens(remoteTokens);
        localTokensRef.current = remoteTokens;
      }
    });
    return unsub;
  }, [isPlayer, sessionId, selectedMap]);

  // ─────────────────────────────────────────────────────────────────────────────
  // DEBOUNCED SAVE  — called after every local mutation
  // ─────────────────────────────────────────────────────────────────────────────
  const scheduleSave = useCallback((latestTokens, currentUserId, currentIsAdmin) => {
    if (!isPlayer || !selectedMap) return;
    localTokensRef.current = latestTokens;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(async () => {
      saveTimerRef.current = null;
      try {
        await saveTokens(sessionId, localTokensRef.current, currentUserId, currentIsAdmin);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Firestore save error:", err);
        setSaveStatus("error");
      }
    }, SAVE_DEBOUNCE);
  }, [isPlayer, selectedMap, sessionId]);

  // Wrap setTokens so every mutation auto-schedules a save
  const setTokensAndSave = useCallback((updater) => {
    setTokens(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      scheduleSave(next, userProfile?.uid ?? null, isAdminMode);
      return next;
    });
  }, [scheduleSave, userProfile?.uid, isAdminMode]);

  // ─────────────────────────────────────────────────────────────────────────────
  // PERMISSION HELPERS
  // ─────────────────────────────────────────────────────────────────────────────
  // Can the current user mutate a given token?
  const canMutateToken = useCallback((token) => {
    if (!userProfile) return false;
    if (isAdminMode) return true;
    return token.faction !== "enemy" && token.ownerId === userProfile.uid;
  }, [userProfile, isAdminMode]);

  const canPlaceFaction = useCallback((faction) => {
    if (!userProfile) return false;
    if (isAdminMode) return true;
    return faction !== "enemy";
  }, [userProfile, isAdminMode]);

  // ─────────────────────────────────────────────────────────────────────────────
  // MAP SELECTION
  // ─────────────────────────────────────────────────────────────────────────────
  const handleMapSelect = (e) => {
    const map = MAPS.find(m => m.id === e.target.value);
    setSelectedMap(e.target.value);
    setMapImage(map ? map.src : null);
    setMapNaturalSize(null);
    setTokens([]); // will be replaced by Firestore listener
    setSelected(null);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // WHEEL ZOOM
  // ─────────────────────────────────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const factor  = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = Math.min(Math.max(zoomRef.current * factor, 0.1), 10);
    const scale   = newZoom / zoomRef.current;
    const newPan  = {
      x: mx - (mx - panRef.current.x) * scale,
      y: my - (my - panRef.current.y) * scale,
    };
    zoomRef.current = newZoom;
    panRef.current  = newPan;
    setZoom(newZoom);
    setPan(newPan);
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel, authReady]);

  // ─────────────────────────────────────────────────────────────────────────────
  // MOUSE PAN
  // ─────────────────────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && mode === "pan")) {
      e.preventDefault();
      dragPanRef.current = {
        mouseX: e.clientX, mouseY: e.clientY,
        panX: panRef.current.x, panY: panRef.current.y,
      };
      setIsGrabbing(true);
    }
  }, [mode]);

  const handleMouseMove = useCallback((e) => {
    if (!dragPanRef.current) return;
    const newPan = {
      x: dragPanRef.current.panX + (e.clientX - dragPanRef.current.mouseX),
      y: dragPanRef.current.panY + (e.clientY - dragPanRef.current.mouseY),
    };
    panRef.current = newPan;
    setPan(newPan);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (dragPanRef.current) { dragPanRef.current = null; setIsGrabbing(false); }
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup",   handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup",   handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ─────────────────────────────────────────────────────────────────────────────
  // TOUCH GESTURES
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCanvasTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      dragPanRef.current = null;
      setIsGrabbing(false);
      const t1 = e.touches[0], t2 = e.touches[1];
      const rect = canvasRef.current.getBoundingClientRect();
      touchRef.current = {
        type: "pinch",
        startDist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
        startZoom: zoomRef.current,
        startPanX: panRef.current.x, startPanY: panRef.current.y,
        originX: (t1.clientX + t2.clientX) / 2 - rect.left,
        originY: (t1.clientY + t2.clientY) / 2 - rect.top,
      };
    } else if (e.touches.length === 1 && !tokenTouchRef.current) {
      const touch = e.touches[0];
      touchRef.current = { type: "single", startX: touch.clientX, startY: touch.clientY, moved: false };
      if (mode === "pan") {
        dragPanRef.current = { mouseX: touch.clientX, mouseY: touch.clientY, panX: panRef.current.x, panY: panRef.current.y };
        setIsGrabbing(true);
      }
    }
  }, [mode]);

  useEffect(() => {
    const onTouchMove = (e) => {
      if (tokenTouchRef.current) {
        e.preventDefault();
        const touch = e.touches[0];
        const mb = getMapScreenBounds(mapImgRef.current);
        if (!mb) return;
        const x = (touch.clientX - mb.left) / mb.width;
        const y = (touch.clientY - mb.top)  / mb.height;
        setTokens(prev => prev.map(t => t.id === tokenTouchRef.current.id ? { ...t, x, y } : t));
      } else if (touchRef.current?.type === "pinch" && e.touches.length === 2) {
        const t1 = e.touches[0], t2 = e.touches[1];
        const { startDist, startZoom, startPanX, startPanY, originX, originY } = touchRef.current;
        const rect     = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const pinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const midX      = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY      = (t1.clientY + t2.clientY) / 2 - rect.top;
        const newZoom   = Math.min(Math.max(startZoom * (pinchDist / startDist), 0.1), 10);
        const zoomScale = newZoom / startZoom;
        const newPan    = {
          x: midX - (originX - startPanX) * zoomScale,
          y: midY - (originY - startPanY) * zoomScale,
        };
        zoomRef.current = newZoom; panRef.current = newPan;
        setZoom(newZoom); setPan(newPan);
      } else if (touchRef.current?.type === "single" && e.touches.length === 1) {
        const touch = e.touches[0];
        const dx    = touch.clientX - touchRef.current.startX;
        const dy    = touch.clientY - touchRef.current.startY;
        if (!touchRef.current.moved && Math.hypot(dx, dy) > 8) {
          touchRef.current.moved = true;
          dragPanRef.current = {
            mouseX: touchRef.current.startX, mouseY: touchRef.current.startY,
            panX: panRef.current.x, panY: panRef.current.y,
          };
          setIsGrabbing(true);
        }
        if (dragPanRef.current) {
          const newPan = { x: dragPanRef.current.panX + dx, y: dragPanRef.current.panY + dy };
          panRef.current = newPan; setPan(newPan);
        }
      }
    };

    const onTouchEnd = (e) => {
      if (tokenTouchRef.current) {
        const touch = e.changedTouches[0];
        const mb = getMapScreenBounds(mapImgRef.current);
        if (mb) {
          const x = (touch.clientX - mb.left) / mb.width;
          const y = (touch.clientY - mb.top)  / mb.height;
          const draggedId       = tokenTouchRef.current.id;
          const screenThreshold = MERGE_THRESHOLD * zoomRef.current;
          setTokensAndSave(prev => {
            const dragged = prev.find(t => t.id === draggedId);
            if (!dragged) return prev;
            const mergeTarget = findMergeTarget(prev, mb, touch.clientX, touch.clientY, dragged.faction, screenThreshold, draggedId);
            if (mergeTarget) {
              return prev
                .filter(t => t.id !== draggedId)
                .map(t => t.id === mergeTarget.id
                  ? { ...t, count: t.count + dragged.count, notes: [...t.notes, ...dragged.notes] }
                  : t
                );
            }
            return prev.map(t => t.id === draggedId ? { ...t, x, y } : t);
          });
        }
        tokenTouchRef.current = null;
      }
      dragPanRef.current = null; setIsGrabbing(false); touchRef.current = null;
    };

    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend",  onTouchEnd);
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend",  onTouchEnd);
    };
  }, [setTokensAndSave]);

  // ─────────────────────────────────────────────────────────────────────────────
  // ZOOM CONTROLS
  // ─────────────────────────────────────────────────────────────────────────────
  const adjustZoom = useCallback((factor) => {
    const rect    = canvasRef.current.getBoundingClientRect();
    const newZoom = Math.min(Math.max(zoomRef.current * factor, 0.1), 10);
    const scale   = newZoom / zoomRef.current;
    const newPan  = {
      x: rect.width  / 2 - (rect.width  / 2 - panRef.current.x) * scale,
      y: rect.height / 2 - (rect.height / 2 - panRef.current.y) * scale,
    };
    zoomRef.current = newZoom; panRef.current = newPan;
    setZoom(newZoom); setPan(newPan);
  }, []);

  const resetView = useCallback(() => {
    panRef.current  = { x: 0, y: 0 };
    zoomRef.current = 1;
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // CANVAS INTERACTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCanvasClick = useCallback((e) => {
    if (mode !== "place") return;
    if (dragPanRef.current) return;
    if (!canPlaceFaction(placingFaction)) return;
    if (!isAdminMode && selectedMap && userProfile?.nation && selectedMap !== userProfile.nation) return;
    if (!isAdminMode && userProfile?.maxTokens != null) {
      const ownedCount = tokens.filter(t => t.ownerId === userProfile.uid).reduce((s, t) => s + t.count, 0);
      if (ownedCount >= userProfile.maxTokens) {
        setTokenLimitWarning(true);
        setTimeout(() => setTokenLimitWarning(false), 2500);
        return;
      }
    }
    const mb = getMapScreenBounds(mapImgRef.current);
    if (!mb) return;

    const x = (e.clientX - mb.left) / mb.width;
    const y = (e.clientY - mb.top)  / mb.height;

    const screenThreshold = MERGE_THRESHOLD * zoomRef.current;
    const nearby = findMergeTarget(tokens, mb, e.clientX, e.clientY, placingFaction, screenThreshold);

    if (nearby) {
      setTokensAndSave(prev => prev.map(t => t.id === nearby.id ? { ...t, count: t.count + 1 } : t));
    } else {
      setTokensAndSave(prev => [...prev, {
        id: generateId(),
        faction: placingFaction,
        x, y,
        count: 1,
        notes: [],
        ownerId: userProfile?.uid ?? null,
        nation:  userProfile?.nation ?? null,
      }]);
    }
  }, [mode, tokens, placingFaction, canPlaceFaction, userProfile, setTokensAndSave, isAdminMode, selectedMap]);

  const handleDragStart = (e, id) => {
    if (mode !== "move") return;
    const token = tokens.find(t => t.id === id);
    if (token && !canMutateToken(token)) return;
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    const ghost = document.createElement("div");
    ghost.style.opacity = "0";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleCanvasDrop = useCallback((e) => {
    e.preventDefault();
    if (!dragId) return;
    const mb = getMapScreenBounds(mapImgRef.current);
    if (!mb) return;

    const x = (e.clientX - mb.left) / mb.width;
    const y = (e.clientY - mb.top)  / mb.height;

    const dragged = tokens.find(t => t.id === dragId);
    if (!dragged) return;

    const screenThreshold = MERGE_THRESHOLD * zoomRef.current;
    const mergeTarget = findMergeTarget(tokens, mb, e.clientX, e.clientY, dragged.faction, screenThreshold, dragId);

    if (mergeTarget) {
      setTokensAndSave(prev => prev
        .filter(t => t.id !== dragId)
        .map(t => t.id === mergeTarget.id
          ? { ...t, count: t.count + dragged.count, notes: [...t.notes, ...dragged.notes] }
          : t
        )
      );
      setSelected(mergeTarget.id);
    } else {
      setTokensAndSave(prev => prev.map(t => t.id === dragId ? { ...t, x, y } : t));
    }
    setDragId(null);
  }, [dragId, tokens, setTokensAndSave]);

  const handleTokenClick = (id) => {
    if (mode === "pan") return;
    const token = tokens.find(t => t.id === id);
    if (!token) return;
    if (mode === "delete") {
      if (!canMutateToken(token)) return;
      setTokensAndSave(prev => prev.filter(t => t.id !== id));
      // Also delete from Firestore immediately (don't wait for debounce)
      deleteToken(sessionId, id);
      if (selected === id) setSelected(null);
      return;
    }
    setSelected(id === selected ? null : id);
    setShowPanel(true);
  };

  const addNote = () => {
    if (!noteInput.trim() || !selected) return;
    const author = userProfile?.displayName;
    const text   = author ? `[${author}] ${noteInput.trim()}` : noteInput.trim();
    setTokensAndSave(prev => prev.map(t =>
      t.id === selected ? { ...t, notes: [...t.notes, text] } : t
    ));
    setNoteInput("");
  };

  const removeNote = (tokenId, idx) => {
    setTokensAndSave(prev => prev.map(t =>
      t.id === tokenId ? { ...t, notes: t.notes.filter((_, i) => i !== idx) } : t
    ));
  };

  useEffect(() => { setSplitCount(1); }, [selected]);

  const handleSplit = () => {
    if (!selectedToken || selectedToken.count < 2) return;
    const n    = Math.min(Math.max(1, splitCount), selectedToken.count - 1);
    const mb   = getMapScreenBounds(mapImgRef.current);
    const offset = (TOKEN_RADIUS * 3) / (mb?.width ?? 800);
    setTokensAndSave(prev => [
      ...prev.map(t => t.id === selected ? { ...t, count: t.count - n } : t),
      {
        id: generateId(),
        faction: selectedToken.faction,
        x: selectedToken.x + offset,
        y: selectedToken.y + offset,
        count: n,
        notes: [],
        ownerId: userProfile?.uid ?? null,
        nation:  selectedToken.nation ?? null,
      },
    ]);
    setSplitCount(1);
  };

  const canvasCursor = isGrabbing ? "grabbing"
    : mode === "pan"    ? "grab"
    : mode === "place"  ? "crosshair"
    : mode === "delete" ? "not-allowed"
    : "default";

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  if (!authReady) {
    return (
      <div style={{ minHeight: "100vh", background: "#1a0e05", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: "'Cinzel', serif", color: "#5c4a28", letterSpacing: "0.12em", fontSize: 13, textTransform: "uppercase" }}>
          Consulting the runes…
        </p>
      </div>
    );
  }

  const layoutBounds = (mapNaturalSize && containerSize.w)
    ? getMapLayoutBounds(containerSize.w, containerSize.h, mapNaturalSize.w, mapNaturalSize.h)
    : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#1a0e05",
      fontFamily: "'Crimson Text', 'Georgia', serif",
      color: "#e8d5a3",
      display: "flex",
      flexDirection: "column",
    }}>
      {showAuthModal && <AuthModal onAuth={handleAuthSuccess} />}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1a0e05; }
        ::-webkit-scrollbar-thumb { background: #5c3d11; border-radius: 3px; }
        .toolbar-btn {
          font-family: 'Cinzel', serif; font-size: 11px; font-weight: 600; letter-spacing: 0.05em;
          padding: 7px 14px; border-radius: 3px; border: 1px solid #5c3d11;
          background: #2c1a06; color: #c4952a; cursor: pointer; transition: all 0.15s; text-transform: uppercase;
        }
        .toolbar-btn:hover { background: #3a2209; border-color: #8b6914; }
        .toolbar-btn.active      { background: #5c3d11; border-color: #c4952a; color: #f5e8c0; box-shadow: 0 0 8px #c4952a44; }
        .toolbar-btn.player-active    { background: #1a3d26; border-color: #4a9e6a; color: #a8d5b5; }
        .toolbar-btn.enemy-active     { background: #3d1010; border-color: #c45252; color: #e8a0a0; }
        .toolbar-btn.contested-active { background: #2d0a2d; border-color: #a050a0; color: #e8a0d2; }
        .mode-btn {
          font-family: 'Cinzel', serif; font-size: 11px; font-weight: 600; letter-spacing: 0.05em;
          padding: 6px 12px; border-radius: 3px; border: 1px solid #3a2209; background: #1f1005;
          color: #8b7040; cursor: pointer; transition: all 0.15s; text-transform: uppercase;
        }
        .mode-btn:hover { background: #2c1a06; color: #c4952a; border-color: #5c3d11; }
        .mode-btn.active        { background: #3a2209; border-color: #8b6914; color: #f0d060; box-shadow: 0 0 6px #f0d06022; }
        .mode-btn.delete-active { background: #2d0a0a; border-color: #8b1a1a; color: #e05050; }
        .mode-btn.pan-active    { background: #0a1a2d; border-color: #1a4a8b; color: #70a0e0; }
        .note-input {
          background: #1f1005; border: 1px solid #5c3d11; border-radius: 3px;
          color: #e8d5a3; font-family: 'Crimson Text', serif; font-size: 14px;
          padding: 5px 8px; width: 100%; outline: none;
        }
        .note-input:focus { border-color: #8b6914; }
        .zoom-btn {
          font-family: 'Cinzel', serif; font-size: 14px; font-weight: 700;
          padding: 4px 9px; border-radius: 3px; border: 1px solid #3a2209;
          background: #1f1005; color: #8b7040; cursor: pointer; transition: all 0.15s; line-height: 1;
        }
        .zoom-btn:hover { background: #2c1a06; color: #c4952a; border-color: #5c3d11; }
        .token-locked { opacity: 0.65; cursor: not-allowed !important; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        padding: "14px 24px",
        borderBottom: "1px solid #3a2209",
        background: "linear-gradient(180deg, #2c1a06 0%, #1a0e05 100%)",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Cinzel', serif", fontSize: 20, fontWeight: 700,
            color: "#f0d060", margin: 0, letterSpacing: "0.08em",
            textShadow: "0 0 20px #c4952a44",
          }}>⚔ The War Council</h1>
          <p style={{ margin: 0, fontSize: 11, color: "#7a5c28", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Battle Map — Phase II
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "nowrap", overflowX: "auto", flexShrink: 1, minWidth: 0 }}>
          {/* Map selector */}
          <select value={selectedMap} onChange={handleMapSelect} style={{
            fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
            padding: "7px 14px", borderRadius: 3, border: "1px solid #5c3d11",
            background: "#2c1a06", color: selectedMap ? "#f5e8c0" : "#8b7040",
            cursor: "pointer", textTransform: "uppercase", outline: "none",
          }}>
            <option value="">— Select Map —</option>
            {MAPS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>

          <div style={{ width: 1, height: 28, background: "#3a2209" }} />

          {/* Mode */}
          <span style={{ fontSize: 11, color: "#5c4a28", fontFamily: "'Cinzel', serif", letterSpacing: "0.05em" }}>MODE:</span>
          {["place", "move", "pan", "delete"].map(m => (
            <button key={m}
              className={`mode-btn ${mode === m ? (m === "delete" ? "delete-active" : m === "pan" ? "pan-active" : "active") : ""}`}
              onClick={() => setMode(m)}
            >
              {m === "place" ? "⊕ Place" : m === "move" ? "✦ Move" : m === "pan" ? "✥ Pan" : "✕ Delete"}
            </button>
          ))}

          {mode === "place" && (
            <>
              <div style={{ width: 1, height: 28, background: "#3a2209" }} />
              <span style={{ fontSize: 11, color: "#5c4a28", fontFamily: "'Cinzel', serif", letterSpacing: "0.05em" }}>FACTION:</span>
              <button
                className={`toolbar-btn ${placingFaction === "player" ? "player-active" : ""}`}
                onClick={() => setPlacingFaction("player")}
              >⚔ Player</button>
              {/* Enemy faction only visible in admin mode */}
              {isAdminMode && (
                <button
                  className={`toolbar-btn ${placingFaction === "enemy" ? "enemy-active" : ""}`}
                  onClick={() => setPlacingFaction("enemy")}
                >☠ Enemy</button>
              )}
              <button
                className={`toolbar-btn ${placingFaction === "contested" ? "contested-active" : ""}`}
                onClick={() => setPlacingFaction("contested")}
              >⚔ Contested</button>
            </>
          )}

          <div style={{ width: 1, height: 28, background: "#3a2209" }} />

          <button className="zoom-btn" onClick={() => adjustZoom(1.1)}>+</button>
          <span style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: "#8b7040", minWidth: 42, textAlign: "center", letterSpacing: "0.04em" }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="zoom-btn" onClick={() => adjustZoom(1 / 1.1)}>−</button>
          <button className="zoom-btn" onClick={resetView} title="Reset view" style={{ fontSize: 11, padding: "4px 9px" }}>⌂</button>
        </div>

        {/* Token count badges */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {Object.entries(FACTIONS).map(([key, f]) => {
            const total = tokens.filter(t => t.faction === key).reduce((s, t) => s + t.count, 0);
            return (
              <div key={key} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 3,
                background: `${f.color}33`, border: `1px solid ${f.color}`,
              }}>
                <span style={{ fontSize: 14 }}>{f.icon}</span>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: 12, color: f.border }}>{total}</span>
              </div>
            );
          })}
          {/* Per-user unit cap indicator */}
          {!isAdminMode && userProfile?.maxTokens != null && selectedMap && (() => {
            const ownedCount = tokens.filter(t => t.ownerId === userProfile.uid).reduce((s, t) => s + t.count, 0);
            const atLimit = ownedCount >= userProfile.maxTokens;
            return (
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 3,
                background: atLimit ? "#2d0a0a" : "#1a1005",
                border: `1px solid ${atLimit ? "#8b1a1a" : "#3a2209"}`,
              }}>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: atLimit ? "#e05050" : "#8b7040", letterSpacing: "0.04em" }}>
                  {ownedCount}/{userProfile.maxTokens} units
                </span>
              </div>
            );
          })()}
        </div>

        {/* ── User / session area (right-side) ─────────────────────────────── */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {/* Save status pill */}
          {saveStatus !== "idle" && (
            <span style={{
              fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: saveStatus === "saved" ? "#a8d5b5" : saveStatus === "error" ? "#e05050" : "#8b7040",
              padding: "3px 8px", borderRadius: 3,
              background: saveStatus === "saved" ? "#1a3d26" : saveStatus === "error" ? "#2d0a0a" : "#1f1005",
              border: `1px solid ${saveStatus === "saved" ? "#2d6e3e" : saveStatus === "error" ? "#5c1a1a" : "#3a2209"}`,
              transition: "all 0.3s",
            }}>
              {saveStatus === "saving" ? "⟳ Saving…" : saveStatus === "saved" ? "✓ Saved" : "✕ Save error"}
            </span>
          )}

          {/* Role badge */}
          {userProfile && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 10px", borderRadius: 3,
              background: isAdmin ? "#3a2209" : isMonarch ? "#2a1a05" : "#1a2d3d",
              border: `1px solid ${isAdmin ? "#8b6914" : isMonarch ? "#6b5010" : "#1a4a8b"}`,
            }}>
              <span style={{ fontSize: 13 }}>{isAdmin ? "👑" : isMonarch ? "♔" : "⚔"}</span>
              <span style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: isAdmin ? "#f0d060" : isMonarch ? "#c4952a" : "#70a0e0", letterSpacing: "0.06em" }}>
                {userProfile.displayName}
              </span>
              {userProfile.nation && NATIONS[userProfile.nation] && (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{
                    display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                    background: NATIONS[userProfile.nation].border,
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 10, color: NATIONS[userProfile.nation].border, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    {NATIONS[userProfile.nation].label}
                  </span>
                </span>
              )}
              <span style={{ fontSize: 10, color: isAdmin ? "#8b6914" : isMonarch ? "#c4952a" : "#2a5a8b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {isAdmin ? "GM" : isMonarch ? "Monarch" : "Commander"}
              </span>
            </div>
          )}

          {/* Admin mode toggle */}
          {isAdmin && (
            <button
              onClick={() => setAdminMode(m => !m)}
              style={{
                fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                padding: "5px 10px", borderRadius: 3,
                border: `1px solid ${adminMode ? "#c4952a" : "#3a2209"}`,
                background: adminMode ? "#5c3d11" : "#1f1005",
                color: adminMode ? "#f0d060" : "#5c4a28",
                cursor: "pointer", transition: "all 0.15s",
                boxShadow: adminMode ? "0 0 8px #c4952a44" : "none",
              }}
            >
              {adminMode ? "👑 Admin: On" : "👑 Admin: Off"}
            </button>
          )}

          {/* Admin panel button */}
          {isAdmin && (
            <button
              onClick={() => setShowAdminPanel(true)}
              style={{
                fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                padding: "5px 10px", borderRadius: 3,
                border: "1px solid #8b6914", background: "#3a2209",
                color: "#f0d060", cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseOver={e => { e.currentTarget.style.background = "#5c3d11"; }}
              onMouseOut={e => { e.currentTarget.style.background = "#3a2209"; }}
            >
              ⚙ Admin
            </button>
          )}

          {/* Sign out */}
          {firebaseUser && (
            <button
              onClick={() => signOut(auth)}
              style={{
                fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                padding: "5px 10px", borderRadius: 3,
                border: "1px solid #3a2209", background: "#150b02",
                color: "#5c4a28", cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseOver={e => { e.target.style.color = "#c4952a"; e.target.style.borderColor = "#5c3d11"; }}
              onMouseOut={e => { e.target.style.color = "#5c4a28"; e.target.style.borderColor = "#3a2209"; }}
            >
              ⟵ Depart
            </button>
          )}
        </div>
      </header>

      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>

        {/* Canvas area */}
        <div
          ref={canvasRef}
          style={{
            flex: 1, position: "relative", overflow: "hidden",
            touchAction: "none", userSelect: "none",
            background: mapImage
              ? "#0d0800"
              : "repeating-linear-gradient(0deg, #1e1005 0px, #1e1005 39px, #2c1a0611 40px), repeating-linear-gradient(90deg, #1e1005 0px, #1e1005 39px, #2c1a0611 40px)",
            cursor: canvasCursor,
          }}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onTouchStart={handleCanvasTouchStart}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
          onDrop={handleCanvasDrop}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* No-map placeholder */}
          {!mapImage && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12, pointerEvents: "none",
            }}>
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="8" width="64" height="64" rx="4" stroke="#3a2209" strokeWidth="1.5" />
                <path d="M8 52 L24 36 L36 48 L52 28 L72 52" stroke="#3a2209" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
                <circle cx="56" cy="24" r="6" stroke="#3a2209" strokeWidth="1.5" />
              </svg>
              <p style={{ color: "#3a2209", fontFamily: "'Cinzel', serif", fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Select a map to begin
              </p>
            </div>
          )}

          {/* Transform container */}
          <div style={{
            position: "absolute", inset: 0,
            transformOrigin: "0 0",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            willChange: "transform",
          }}>
            {mapImage && (
              <img
                ref={mapImgRef}
                src={mapImage}
                alt="Battle Map"
                onLoad={(e) => setMapNaturalSize({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
                style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%",
                  objectFit: "contain", userSelect: "none", pointerEvents: "none",
                }}
              />
            )}

          </div>

          {/* Token overlay — outside zoom transform (crisp rendering) but pixel measurements
              scaled by zoom so tokens stay proportional to the map */}
          {layoutBounds && (() => {
            const mapScreenLeft = pan.x + layoutBounds.x * zoom;
            const mapScreenTop  = pan.y + layoutBounds.y * zoom;
            const mapScreenW    = layoutBounds.w * zoom;
            const mapScreenH    = layoutBounds.h * zoom;
            const vr            = TOKEN_RADIUS * zoom;
            return (
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {tokens.map(token => {
                  const locked      = !canMutateToken(token);
                  const faction     = FACTIONS[token.faction] ?? FACTIONS.player;
                  const nationStyle = token.faction === "player" && token.nation && NATIONS[token.nation]
                    ? NATIONS[token.nation]
                    : null;
                  const tokenColor  = nationStyle ?? faction;
                  const screenX     = mapScreenLeft + token.x * mapScreenW;
                  const screenY     = mapScreenTop  + token.y * mapScreenH;
                  return (
                    <div
                      key={token.id}
                      draggable={mode === "move" && !locked}
                      onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, token.id); }}
                      onClick={(e) => { e.stopPropagation(); handleTokenClick(token.id); }}
                      onTouchStart={(e) => {
                        if (mode === "move" && !locked) {
                          e.stopPropagation();
                          tokenTouchRef.current = { id: token.id };
                        }
                      }}
                      title={token.notes?.join(" | ") || `${token.faction === "player" && token.ownerId && userProfiles[token.ownerId] ? userProfiles[token.ownerId] : faction.label}${token.nation ? ` (${NATIONS[token.nation]?.label ?? token.nation})` : ""}${locked ? " — not yours" : ""}`}
                      className={locked ? "token-locked" : ""}
                      style={{
                        position: "absolute",
                        left: screenX - vr,
                        top:  screenY - vr,
                        width:  vr * 2,
                        height: vr * 2,
                        borderRadius: "50%",
                        background: `radial-gradient(circle at 35% 35%, ${tokenColor.border}33, ${tokenColor.color})`,
                        border: `${2.5 * zoom}px solid ${selected === token.id ? "#f0d060" : tokenColor.border}`,
                        boxShadow: selected === token.id
                          ? `0 0 0 ${3 * zoom}px #f0d06066, 0 ${2 * zoom}px ${12 * zoom}px #0008`
                          : `0 ${2 * zoom}px ${8 * zoom}px #0006`,
                        display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
                        cursor: locked ? "not-allowed"
                          : mode === "move" ? "grab"
                          : mode === "delete" ? "not-allowed"
                          : "pointer",
                        userSelect: "none",
                        pointerEvents: "all",
                        zIndex: selected === token.id ? 20 : 10,
                        transition: "box-shadow 0.15s, border-color 0.15s",
                        fontFamily: "'Cinzel', serif",
                      }}
                    >
                      <span style={{ fontSize: (token.count > 1 ? 12 : 16) * zoom, lineHeight: 1 }}>{faction.icon}</span>
                      {token.count > 1 && (
                        <span style={{ fontSize: 10 * zoom, fontWeight: 700, color: "#f5e8c0", lineHeight: 1 }}>×{token.count}</span>
                      )}
                      {token.notes?.length > 0 && (
                        <span style={{
                          position: "absolute", top: -4 * zoom, right: -4 * zoom,
                          width: 10 * zoom, height: 10 * zoom, borderRadius: "50%",
                          background: "#c4952a", border: `${zoom}px solid #1a0e05`,
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Token limit warning */}
          {tokenLimitWarning && (
            <div style={{
              position: "absolute", bottom: 52, left: "50%", transform: "translateX(-50%)",
              background: "#2d0a0add", border: "1px solid #8b1a1a", borderRadius: 4,
              padding: "7px 18px", pointerEvents: "none", zIndex: 40,
              fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: "0.09em",
              textTransform: "uppercase", color: "#e05050", whiteSpace: "nowrap",
            }}>
              Unit limit reached — no more can be placed on this map
            </div>
          )}

          {/* Foreign territory banner */}
          {onForeignMap && (
            <div style={{
              position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
              background: "#1a0e05dd", border: "1px solid #5c3d11", borderRadius: 4,
              padding: "7px 18px", pointerEvents: "none", zIndex: 40,
              fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: "0.09em",
              textTransform: "uppercase", color: "#8b7040", whiteSpace: "nowrap",
            }}>
              Foreign territory — tokens cannot be placed here
            </div>
          )}

          {/* Border ornaments */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} xmlns="http://www.w3.org/2000/svg">
            {[[6,6],["calc(100% - 58px)",6],[6,"calc(100% - 58px)"],["calc(100% - 58px)","calc(100% - 58px)"]].map((pos, i) => (
              <g key={i} style={{ transform: `translate(${pos[0]}, ${pos[1]})` }}>
                <circle cx="26" cy="26" r="20" fill="none" stroke="#3a2209" strokeWidth="0.75" />
                <circle cx="26" cy="26" r="14" fill="none" stroke="#2c1a06" strokeWidth="0.5" />
                <path d="M26,12 C26,12 32,18 26,22 C20,26 14,20 20,16 C26,12 26,18 26,26 C26,34 20,38 14,34 C8,30 14,24 20,28"
                  fill="none" stroke="#5c3d11" strokeWidth="1" />
              </g>
            ))}
            <rect x="52" y="6" width="calc(100% - 104px)" height="1" fill="#3a2209" style={{ width: "calc(100% - 104px)" }} />
            <rect x="52" y="10" width="calc(100% - 104px)" height="0.5" fill="#2c1a06" style={{ width: "calc(100% - 104px)" }} />
            <rect x="6" y="52" width="1" height="calc(100% - 104px)" fill="#3a2209" style={{ height: "calc(100% - 104px)" }} />
          </svg>
        </div>

        {/* ── Side panel ──────────────────────────────────────────────────── */}
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: 260,
          transform: `translateX(${showPanel && selectedToken ? 0 : 260}px)`,
          transition: "transform 0.2s ease",
          borderLeft: "1px solid #3a2209",
          background: "#1f1005",
          overflowY: "auto",
          zIndex: 50,
          boxShadow: showPanel && selectedToken ? "-6px 0 24px #0008" : "none",
        }}>
          {selectedToken && (() => {
            const locked = !canMutateToken(selectedToken);
            return (
              <div style={{ width: 260, padding: "20px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: 13, fontWeight: 700, color: "#f0d060", margin: 0, letterSpacing: "0.08em" }}>
                    Token Details
                  </h3>
                  <button onClick={() => { setSelected(null); setShowPanel(false); }}
                    style={{ background: "none", border: "none", color: "#5c3d11", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
                </div>

                {locked && (
                  <p style={{ fontSize: 11, color: "#5c4a28", fontStyle: "italic", marginBottom: 12, background: "#1a0e05", borderRadius: 3, padding: "6px 10px", border: "1px solid #2c1a06" }}>
                    You may view but not edit this token.
                  </p>
                )}

                <div style={{ padding: "10px 12px", background: "#2c1a06", borderRadius: 4, border: "1px solid #3a2209", marginBottom: 16 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 13, color: "#8b7040" }}>Faction</p>
                  <p style={{
                    margin: "0 0 10px", fontSize: 15, fontWeight: 600,
                    color: selectedToken.faction === "player" && selectedToken.nation && NATIONS[selectedToken.nation]
                      ? NATIONS[selectedToken.nation].border
                      : selectedToken.faction === "player" ? "#a8d5b5"
                      : selectedToken.faction === "enemy"  ? "#e8a0a0"
                      : "#e8a0d2",
                  }}>
                    {FACTIONS[selectedToken.faction].icon} {selectedToken.faction === "player" && selectedToken.ownerId && userProfiles[selectedToken.ownerId] ? userProfiles[selectedToken.ownerId] : FACTIONS[selectedToken.faction].label}
                    {selectedToken.faction === "player" && selectedToken.nation && NATIONS[selectedToken.nation] && (
                      <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.8 }}> — {NATIONS[selectedToken.nation].label}</span>
                    )}
                  </p>
                  <p style={{ margin: "0 0 4px", fontSize: 13, color: "#8b7040" }}>Count</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      disabled={locked}
                      onClick={() => !locked && setTokensAndSave(prev => prev.map(t => t.id === selected && t.count > 1 ? { ...t, count: t.count - 1 } : t))}
                      style={{ background: "#3a2209", border: "1px solid #5c3d11", color: "#c4952a", borderRadius: 3, width: 24, height: 24, cursor: locked ? "not-allowed" : "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: locked ? 0.5 : 1 }}
                    >−</button>
                    <span style={{ fontSize: 18, fontFamily: "'Cinzel', serif", fontWeight: 700, color: "#f5e8c0", minWidth: 24, textAlign: "center" }}>{selectedToken.count}</span>
                    <button
                      disabled={locked}
                      onClick={() => !locked && setTokensAndSave(prev => prev.map(t => t.id === selected ? { ...t, count: t.count + 1 } : t))}
                      style={{ background: "#3a2209", border: "1px solid #5c3d11", color: "#c4952a", borderRadius: 3, width: 24, height: 24, cursor: locked ? "not-allowed" : "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: locked ? 0.5 : 1 }}
                    >+</button>
                  </div>
                </div>

                {selectedToken.count > 1 && !locked && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 12, color: "#8b7040", fontFamily: "'Cinzel', serif", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 8px" }}>
                      Split Forces
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={() => setSplitCount(c => Math.max(1, c - 1))}
                        style={{ background: "#3a2209", border: "1px solid #5c3d11", color: "#c4952a", borderRadius: 3, width: 24, height: 24, cursor: "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
                      <span style={{ fontSize: 15, fontFamily: "'Cinzel', serif", fontWeight: 700, color: "#f5e8c0", minWidth: 24, textAlign: "center" }}>{splitCount}</span>
                      <button onClick={() => setSplitCount(c => Math.min(selectedToken.count - 1, c + 1))}
                        style={{ background: "#3a2209", border: "1px solid #5c3d11", color: "#c4952a", borderRadius: 3, width: 24, height: 24, cursor: "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
                      <button onClick={handleSplit}
                        style={{ flex: 1, background: "#1a2d1a", border: "1px solid #2d6e3e", color: "#a8d5b5", borderRadius: 3, padding: "5px 8px", cursor: "pointer", fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}>⑃ Split off</button>
                    </div>
                    <p style={{ margin: "5px 0 0", fontSize: 11, color: "#5c4a28" }}>Detaches {splitCount} unit{splitCount !== 1 ? "s" : ""} into a new token nearby</p>
                  </div>
                )}

                <p style={{ fontSize: 12, color: "#8b7040", fontFamily: "'Cinzel', serif", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 8px" }}>
                  Field Notes
                </p>
                <div style={{ marginBottom: 10 }}>
                  {selectedToken.notes.map((note, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "6px 8px", background: "#2c1a06", borderRadius: 3, border: "1px solid #3a2209", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "#c4952a", flexShrink: 0, marginTop: 1 }}>◆</span>
                      <span style={{ fontSize: 13, color: "#e8d5a3", flex: 1, lineHeight: 1.4 }}>{note}</span>
                      {(!locked || isAdmin || isMonarch) && (
                        <button onClick={() => removeNote(selected, i)}
                          style={{ background: "none", border: "none", color: "#5c3d11", cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1, flexShrink: 0 }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>

                {!!userProfile && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      className="note-input"
                      value={noteInput}
                      onChange={e => setNoteInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addNote()}
                      placeholder="Add a note…"
                      style={{ flex: 1 }}
                    />
                    <button onClick={addNote}
                      style={{ background: "#3a2209", border: "1px solid #5c3d11", color: "#c4952a", borderRadius: 3, padding: "5px 10px", cursor: "pointer", fontFamily: "'Cinzel', serif", fontSize: 11 }}>+</button>
                  </div>
                )}

                {!locked && (
                  <button
                    onClick={() => { setTokensAndSave(prev => prev.filter(t => t.id !== selected)); deleteToken(sessionId, selected); setSelected(null); setShowPanel(false); }}
                    style={{ marginTop: 20, width: "100%", padding: "7px", borderRadius: 3, background: "#2d0a0a", border: "1px solid #5c1a1a", color: "#e05050", fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}
                  >
                    ✕ Remove Token
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}

      {/* Footer */}
      <footer style={{
        padding: "8px 24px", borderTop: "1px solid #2c1a06", background: "#150b02",
        display: "flex", gap: 20, alignItems: "center", fontSize: 12, color: "#5c4a28", flexWrap: "wrap",
      }}>
        <span style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.1em", color: "#3a2d18", textTransform: "uppercase" }}>
          Phase II — Auth &amp; Persistence
        </span>
        <span>⊕ Place: click canvas to place a token</span>
        <span>✦ Move: drag tokens to reposition</span>
        <span>✥ Pan: drag / scroll / middle-click to navigate</span>
        <span>Changes auto-save to Firebase after {SAVE_DEBOUNCE / 1000}s</span>
      </footer>
    </div>
  );
}
