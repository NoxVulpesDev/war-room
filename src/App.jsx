import { useState, useRef, useCallback, useEffect } from "react";
import { deleteToken } from "./firebase";
import AuthModal from "./AuthModal";
import AdminPanel from "./AdminPanel";
import { MAPS, TOKEN_RADIUS, MERGE_THRESHOLD, SAVE_DEBOUNCE } from "./constants";
import { getMapLayoutBounds, getMapScreenBounds, generateId, findMergeTarget } from "./utils";
import MapHeader from "./components/MapHeader";
import TokenLayer from "./components/TokenLayer";
import TokenPanel from "./components/TokenPanel";
import TimelineBar from "./components/TimelineBar";
import MovementArrows from "./components/MovementArrows";
import { useAuth } from "./hooks/useAuth";
import { useFirestoreTokenSync } from "./hooks/useFirestoreTokenSync";
import { useMapZoomPan } from "./hooks/useMapZoomPan";
import { useHistoryTimeline } from "./hooks/useHistoryTimeline";

// ─────────────────────────────────────────────────────────────────────────────
export default function BattleMap() {
  const {
    authReady, firebaseUser, userProfile,
    userProfiles, showAuthModal,
    adminMode, setAdminMode,
    isAdmin, isMonarch, isPlayer, isAdminMode,
    handleAuthSuccess,
  } = useAuth();

  // ── Map / session state ─────────────────────────────────────────────────────
  const [mapImage,     setMapImage]     = useState(null);
  const [selectedMap,  setSelectedMap]  = useState("");
  // sessionId is derived from the selected map — one Firestore collection per map
  const sessionId = selectedMap || "default";
  // True when a non-admin-mode user with a known nation views another nation's map
  const onForeignMap = !isAdminMode && !!selectedMap && !!userProfile?.nation && selectedMap !== userProfile.nation;

  const { tokens, setTokens, setTokensAndSave, saveStatus } = useFirestoreTokenSync({
    isPlayer, selectedMap, sessionId,
    userId:    userProfile?.uid         ?? null,
    actorName: userProfile?.displayName ?? null,
    isAdminMode,
  });

  // ── Token state ─────────────────────────────────────────────────────────────
  const [selected,     setSelected]     = useState(null);
  const [placingFaction, setPlacingFaction] = useState("player");
  const [mode,         setMode]         = useState("place");
  const [noteInput,    setNoteInput]    = useState("");
  const [dragId,       setDragId]       = useState(null);
  const [showPanel,         setShowPanel]         = useState(false);
  const [showAdminPanel,    setShowAdminPanel]    = useState(false);
  const [tokenLimitWarning, setTokenLimitWarning] = useState(false);
  const [splitCount,   setSplitCount]   = useState(1);

  const mapImgRef = useRef(null);

  const [mapNaturalSize, setMapNaturalSize] = useState(null);

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
  }, [userProfile, selectedMap]);

  const {
    zoom, pan, canvasCursor, containerSize,
    canvasRef, tokenTouchRef,
    zoomRef, dragPanRef,
    handleMouseDown, handleCanvasTouchStart,
    adjustZoom, resetView,
  } = useMapZoomPan({ mode, authReady, mapImgRef, setTokens, setTokensAndSave });

  const {
    isOpen: timelineOpen, entries: historyEntries,
    viewingIndex, setViewingIndex,
    isReplaying, currentSnapshot,
    loading: historyLoading,
    openTimeline, exitReplay,
  } = useHistoryTimeline({ sessionId });

  const displayTokens  = isReplaying && currentSnapshot ? currentSnapshot : tokens;
  const selectedToken  = displayTokens.find(t => t.id === selected);

  // ─────────────────────────────────────────────────────────────────────────────
  // PERMISSION HELPERS
  // ─────────────────────────────────────────────────────────────────────────────
  // Can the current user mutate a given token?
  const canMutateToken = useCallback((token) => {
    if (!userProfile) return false;
    if (isAdminMode) return true;
    if (token.faction === "enemy") return false;
    if (token.ownerId === userProfile.uid) return true;
    return token.members?.some(m => m.ownerId === userProfile.uid) ?? false;
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
  // CANVAS INTERACTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCanvasClick = useCallback((e) => {
    if (isReplaying) return;
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
      setTokensAndSave(prev => prev.map(t => {
        if (t.id !== nearby.id) return t;
        const existingMembers = t.members?.length
          ? t.members
          : [{ id: t.id + "_m0", name: t.name ?? '', count: t.count, notes: t.notes ?? [], ownerId: t.ownerId, nation: t.nation }];
        return {
          ...t,
          count: t.count + 1,
          members: [...existingMembers, { id: generateId(), name: '', count: 1, notes: [], ownerId: userProfile?.uid ?? null, nation: userProfile?.nation ?? null }],
        };
      }), { actionType: "merge", description: `Merged ${placingFaction} troops` });
    } else {
      const memberId = generateId();
      setTokensAndSave(prev => [...prev, {
        id: generateId(),
        faction: placingFaction,
        x, y,
        count: 1,
        notes: [],
        ownerId: userProfile?.uid ?? null,
        nation:  userProfile?.nation ?? null,
        members: [{ id: memberId, name: '', count: 1, notes: [], ownerId: userProfile?.uid ?? null, nation: userProfile?.nation ?? null }],
      }], { actionType: "place", description: `Placed ${placingFaction} troops` });
    }
  }, [isReplaying, mode, tokens, placingFaction, canPlaceFaction, userProfile, setTokensAndSave, isAdminMode, selectedMap, setTokenLimitWarning]);

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
    if (isReplaying) return;
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
      const draggedMembers = dragged.members?.length
        ? dragged.members
        : [{ id: dragged.id + "_m0", name: dragged.name ?? '', count: dragged.count, notes: dragged.notes ?? [], ownerId: dragged.ownerId, nation: dragged.nation }];
      setTokensAndSave(prev => prev
        .filter(t => t.id !== dragId)
        .map(t => {
          if (t.id !== mergeTarget.id) return t;
          const targetMembers = t.members?.length
            ? t.members
            : [{ id: t.id + "_m0", name: t.name ?? '', count: t.count, notes: t.notes ?? [], ownerId: t.ownerId, nation: t.nation }];
          return { ...t, count: t.count + dragged.count, members: [...targetMembers, ...draggedMembers] };
        })
      , { actionType: "merge", description: `Merged ${dragged.faction} troops` });
      setSelected(mergeTarget.id);
    } else {
      setTokensAndSave(prev => prev.map(t => t.id === dragId ? { ...t, x, y } : t), { actionType: "move", description: "Moved troops" });
    }
    setDragId(null);
  }, [isReplaying, dragId, tokens, setTokensAndSave]);

  const handleTokenClick = (id) => {
    if (isReplaying) return;
    if (mode === "pan") return;
    const token = tokens.find(t => t.id === id);
    if (!token) return;
    if (mode === "delete") {
      if (!canMutateToken(token)) return;
      setTokensAndSave(prev => prev.filter(t => t.id !== id), { actionType: "delete", description: `Removed ${token.faction} troops` });
      // Also delete from Firestore immediately (don't wait for debounce)
      deleteToken(sessionId, id);
      if (selected === id) setSelected(null);
      return;
    }
    setSelected(id === selected ? null : id);
    setShowPanel(true);
  };

  // target: 'group' adds to top-level notes; a number adds to that member's notes
  const addNote = (target = 'group') => {
    if (!noteInput.trim() || !selected) return;
    const author = userProfile?.displayName;
    const text   = author ? `[${author}] ${noteInput.trim()}` : noteInput.trim();
    if (target === 'group') {
      setTokensAndSave(prev => prev.map(t =>
        t.id === selected ? { ...t, notes: [...t.notes, text] } : t
      ));
    } else {
      setTokensAndSave(prev => prev.map(t => {
        if (t.id !== selected) return t;
        if (!t.members?.length) return { ...t, notes: [...t.notes, text] };
        return {
          ...t,
          members: t.members.map((m, mi) =>
            mi === target ? { ...m, notes: [...(m.notes ?? []), text] } : m
          ),
        };
      }));
    }
    setNoteInput("");
  };

  const handleSetMemberName = (tokenId, memberIdx, name) => {
    setTokensAndSave(prev => prev.map(t => {
      if (t.id !== tokenId || !t.members?.length) return t;
      return {
        ...t,
        members: t.members.map((m, mi) => mi === memberIdx ? { ...m, name } : m),
      };
    }), { actionType: "rename", description: "Renamed unit" });
  };

  // source: 'group' for top-level notes, or a member index (number) for member notes
  const removeNote = (tokenId, source, idx) => {
    setTokensAndSave(prev => prev.map(t => {
      if (t.id !== tokenId) return t;
      if (source === 'group') return { ...t, notes: t.notes.filter((_, i) => i !== idx) };
      return {
        ...t,
        members: t.members.map((m, mi) =>
          mi === source ? { ...m, notes: m.notes.filter((_, ni) => ni !== idx) } : m
        ),
      };
    }));
  };

  useEffect(() => { setSplitCount(0); }, [selected]);

  useEffect(() => {
    if (isReplaying) { setSelected(null); setShowPanel(false); }
  }, [isReplaying]);

  const handleSplit = () => {
    if (!selectedToken) return;
    const mb = getMapScreenBounds(mapImgRef.current);
    const allMembers = selectedToken.members?.length ? selectedToken.members : null;

    if (allMembers && allMembers.length > 1) {
      const idx = Math.min(Math.max(0, splitCount), allMembers.length - 1);
      const member = allMembers[idx];
      const remaining = allMembers.filter((_, i) => i !== idx);
      const remainingCount = remaining.reduce((s, m) => s + m.count, 0);
      const offset = (TOKEN_RADIUS * 3) / (mb?.width ?? 800);
      setTokensAndSave(prev => [
        ...prev.map(t => t.id === selected ? { ...t, count: remainingCount, members: remaining } : t),
        {
          id: generateId(),
          faction: selectedToken.faction,
          x: selectedToken.x + offset,
          y: selectedToken.y + offset,
          count: member.count,
          notes: [],
          ownerId: member.ownerId,
          nation: member.nation,
          members: [{ ...member }],
        },
      ], { actionType: "split", description: `Split ${selectedToken.faction} troops` });
    } else if (selectedToken.count >= 2) {
      // Legacy path for tokens without members
      const n = Math.min(Math.max(1, splitCount), selectedToken.count - 1);
      const offset = (TOKEN_RADIUS * 3) / (mb?.width ?? 800);
      const newMemberId = generateId();
      setTokensAndSave(prev => [
        ...prev.map(t => t.id === selected ? { ...t, count: t.count - n } : t),
        {
          id: generateId(),
          faction: selectedToken.faction,
          x: selectedToken.x + offset,
          y: selectedToken.y + offset,
          count: n,
          notes: [],
          ownerId: selectedToken.ownerId,
          nation: selectedToken.nation ?? null,
          members: [{ id: newMemberId, count: n, notes: [], ownerId: selectedToken.ownerId, nation: selectedToken.nation ?? null }],
        },
      ], { actionType: "split", description: `Split ${selectedToken.faction} troops` });
    }
    setSplitCount(0);
  };

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

      <MapHeader
        selectedMap={selectedMap} handleMapSelect={handleMapSelect}
        mode={mode} setMode={setMode}
        placingFaction={placingFaction} setPlacingFaction={setPlacingFaction}
        isAdmin={isAdmin} isMonarch={isMonarch} isAdminMode={isAdminMode}
        adminMode={adminMode} setAdminMode={setAdminMode}
        userProfile={userProfile} firebaseUser={firebaseUser}
        saveStatus={saveStatus} tokens={tokens}
        zoom={zoom} adjustZoom={adjustZoom} resetView={resetView}
        onOpenAdminPanel={() => setShowAdminPanel(true)}
        onOpenTimeline={openTimeline} isReplaying={isReplaying}
      />

      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>

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

          {isReplaying && viewingIndex > 0 && (
            <MovementArrows
              prevSnapshot={historyEntries[viewingIndex - 1].snapshot}
              currSnapshot={historyEntries[viewingIndex].snapshot}
              layoutBounds={layoutBounds}
              pan={pan}
              zoom={zoom}
            />
          )}

          <TokenLayer
            tokens={displayTokens} layoutBounds={layoutBounds} pan={pan} zoom={zoom}
            selected={selected} mode={isReplaying ? "pan" : mode}
            canMutateToken={canMutateToken} userProfiles={userProfiles}
            tokenTouchRef={tokenTouchRef}
            tokenLimitWarning={tokenLimitWarning} onForeignMap={onForeignMap}
            handleDragStart={handleDragStart} handleTokenClick={handleTokenClick}
          />

          {/* Replay banner */}
          {isReplaying && (
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
              background: "rgba(60, 20, 5, 0.90)", borderBottom: "1px solid #8b3d11",
              padding: "6px 14px", display: "flex", alignItems: "center",
              justifyContent: "space-between", backdropFilter: "blur(4px)",
            }}>
              <span style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: "#f0d060", letterSpacing: "0.08em" }}>
                📜 VIEWING HISTORY — edits disabled
              </span>
              <button className="toolbar-btn active" onClick={exitReplay}>⟳ Return to Live</button>
            </div>
          )}

          {/* Timeline bar */}
          {timelineOpen && (
            <TimelineBar
              entries={historyEntries}
              viewingIndex={viewingIndex}
              setViewingIndex={setViewingIndex}
              loading={historyLoading}
              onClose={exitReplay}
            />
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

        <TokenPanel
          selectedToken={selectedToken} showPanel={showPanel}
          selected={selected} setSelected={setSelected} setShowPanel={setShowPanel}
          canMutateToken={canMutateToken} isAdmin={isAdmin} isMonarch={isMonarch}
          userProfile={userProfile} userProfiles={userProfiles}
          setTokensAndSave={setTokensAndSave}
          noteInput={noteInput} setNoteInput={setNoteInput}
          addNote={addNote} removeNote={removeNote}
          splitCount={splitCount} setSplitCount={setSplitCount} handleSplit={handleSplit}
          handleSetMemberName={handleSetMemberName}
          sessionId={sessionId}
        />
      </div>

      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} onHistoryCleared={exitReplay} />}

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
