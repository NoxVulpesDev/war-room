import { useState, useRef, useCallback, useEffect } from "react";

const BASE = import.meta.env.BASE_URL;
const MAPS = [
  { id: "erin",      label: "Erin",      src: `${BASE}Erin.jpg` },
  { id: "manx",      label: "Manx",      src: `${BASE}Manx.jpg` },
  { id: "cymria",     label: "Cymria",     src: `${BASE}Cymria.jpg` },
  { id: "caledonia", label: "Caledonia", src: `${BASE}Cal.jpg` },
];

const FACTIONS = {
  player: { color: "#2d6e3e", border: "#a8d5b5", label: "Player", icon: "⚔" },
  enemy:  { color: "#7a1c1c", border: "#fa4c4c", label: "Enemy",  icon: "☠" },
  contested:  { color: "#640264", border: "#e8a0d2", label: "Contested",  icon: "⚔" },
};

const TOKEN_RADIUS = 11;
const MERGE_THRESHOLD = TOKEN_RADIUS * 2.2;

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function KnotCorner({ x = 0, y = 0 }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path d="M0,0 Q8,0 8,8 Q8,16 16,16 Q24,16 24,24 Q24,32 32,32 Q40,32 40,40 L48,40 L48,48 L0,48 Z"
        fill="#2c1a06" stroke="#8b6914" strokeWidth="1" opacity="0.85" />
      <path d="M4,4 Q10,4 10,10 Q10,18 18,18 Q26,18 26,26 Q26,34 34,34 L42,34 L42,44 L4,44 Z"
        fill="none" stroke="#c4952a" strokeWidth="0.5" />
      <circle cx="8" cy="8" r="3" fill="#8b6914" />
      <circle cx="24" cy="24" r="3" fill="#8b6914" />
      <circle cx="40" cy="40" r="3" fill="#8b6914" />
    </g>
  );
}

export default function BattleMap() {
  const [mapImage, setMapImage] = useState(null);
  const [selectedMap, setSelectedMap] = useState("");
  const [tokens, setTokens] = useState([]);
  const [selected, setSelected] = useState(null);
  const [placingFaction, setPlacingFaction] = useState("player");
  const [mode, setMode] = useState("place"); // "place" | "move" | "pan" | "delete"
  const [noteInput, setNoteInput] = useState("");
  const [dragId, setDragId] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const [role] = useState("admin");
  const [splitCount, setSplitCount] = useState(1);

  // Pan & zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isGrabbing, setIsGrabbing] = useState(false);

  const canvasRef = useRef(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const dragPanRef = useRef(null); // {mouseX, mouseY, panX, panY} while panning
  const touchRef = useRef(null);      // touch gesture state
  const tokenTouchRef = useRef(null); // {id} while dragging a token by finger

  const selectedToken = tokens.find(t => t.id === selected);

  const handleMapSelect = (e) => {
    const map = MAPS.find(m => m.id === e.target.value);
    setSelectedMap(e.target.value);
    setMapImage(map ? map.src : null);
  };

  // ── Wheel zoom (non-passive so we can preventDefault) ──
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = Math.min(Math.max(zoomRef.current * factor, 0.1), 10);
    const scale = newZoom / zoomRef.current;
    const newPan = {
      x: mx - (mx - panRef.current.x) * scale,
      y: my - (my - panRef.current.y) * scale,
    };
    zoomRef.current = newZoom;
    panRef.current = newPan;
    setZoom(newZoom);
    setPan(newPan);
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // ── Mouse pan: middle-click always, left-click in pan mode ──
  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && mode === "pan")) {
      e.preventDefault();
      dragPanRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
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
    if (dragPanRef.current) {
      dragPanRef.current = null;
      setIsGrabbing(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ── Touch: canvas gesture start (single finger or pinch) ──
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
        startPanX: panRef.current.x,
        startPanY: panRef.current.y,
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

  // ── Touch: move and end handled at document level (same pattern as mouse) ──
  useEffect(() => {
    const onTouchMove = (e) => {
      if (tokenTouchRef.current) {
        // Drag a token by finger
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = (touch.clientX - rect.left - panRef.current.x) / zoomRef.current;
        const y = (touch.clientY - rect.top - panRef.current.y) / zoomRef.current;
        setTokens(prev => prev.map(t => t.id === tokenTouchRef.current.id ? { ...t, x, y } : t));
      } else if (touchRef.current?.type === "pinch" && e.touches.length === 2) {
        // Pinch-to-zoom + two-finger pan
        const t1 = e.touches[0], t2 = e.touches[1];
        const { startDist, startZoom, startPanX, startPanY, originX, originY } = touchRef.current;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const pinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
        const newZoom = Math.min(Math.max(startZoom * (pinchDist / startDist), 0.1), 10);
        const zoomScale = newZoom / startZoom;
        // Keep the pinch origin point fixed in world space while also translating with finger movement
        const newPan = {
          x: midX - (originX - startPanX) * zoomScale,
          y: midY - (originY - startPanY) * zoomScale,
        };
        zoomRef.current = newZoom;
        panRef.current = newPan;
        setZoom(newZoom);
        setPan(newPan);
      } else if (touchRef.current?.type === "single" && e.touches.length === 1) {
        // Single-finger pan (works in any mode; tap still places because no movement)
        const touch = e.touches[0];
        const dx = touch.clientX - touchRef.current.startX;
        const dy = touch.clientY - touchRef.current.startY;
        if (!touchRef.current.moved && Math.hypot(dx, dy) > 8) {
          touchRef.current.moved = true;
          dragPanRef.current = {
            mouseX: touchRef.current.startX,
            mouseY: touchRef.current.startY,
            panX: panRef.current.x,
            panY: panRef.current.y,
          };
          setIsGrabbing(true);
        }
        if (dragPanRef.current) {
          const newPan = { x: dragPanRef.current.panX + dx, y: dragPanRef.current.panY + dy };
          panRef.current = newPan;
          setPan(newPan);
        }
      }
    };

    const onTouchEnd = (e) => {
      if (tokenTouchRef.current) {
        // Finalise token position and check for merge
        const touch = e.changedTouches[0];
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = (touch.clientX - rect.left - panRef.current.x) / zoomRef.current;
          const y = (touch.clientY - rect.top - panRef.current.y) / zoomRef.current;
          const draggedId = tokenTouchRef.current.id;
          setTokens(prev => {
            const dragged = prev.find(t => t.id === draggedId);
            if (!dragged) return prev;
            const mergeTarget = prev.find(
              t => t.id !== draggedId && t.faction === dragged.faction && dist(t, { x, y }) < MERGE_THRESHOLD
            );
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
      dragPanRef.current = null;
      setIsGrabbing(false);
      touchRef.current = null;
    };

    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []); // stable: only refs and stable setState inside

  // ── Zoom controls (zoom toward canvas center) ──
  const adjustZoom = useCallback((factor) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newZoom = Math.min(Math.max(zoomRef.current * factor, 0.1), 10);
    const scale = newZoom / zoomRef.current;
    const newPan = {
      x: cx - (cx - panRef.current.x) * scale,
      y: cy - (cy - panRef.current.y) * scale,
    };
    zoomRef.current = newZoom;
    panRef.current = newPan;
    setZoom(newZoom);
    setPan(newPan);
  }, []);

  const resetView = useCallback(() => {
    const newPan = { x: 0, y: 0 };
    panRef.current = newPan;
    zoomRef.current = 1;
    setPan(newPan);
    setZoom(1);
  }, []);

  // ── Canvas interactions (coords converted to world space) ──
  const handleCanvasClick = useCallback((e) => {
    if (mode !== "place") return;
    if (dragPanRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
    const y = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;

    const nearby = tokens.find(
      t => t.faction === placingFaction && dist(t, { x, y }) < MERGE_THRESHOLD
    );

    if (nearby) {
      setTokens(prev => prev.map(t => t.id === nearby.id ? { ...t, count: t.count + 1 } : t));
    } else {
      setTokens(prev => [...prev, { id: generateId(), faction: placingFaction, x, y, count: 1, notes: [] }]);
    }
  }, [mode, tokens, placingFaction]);

  const handleDragStart = (e, id) => {
    if (mode !== "move") return;
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
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
    const y = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;

    const dragged = tokens.find(t => t.id === dragId);
    if (!dragged) return;

    const mergeTarget = tokens.find(
      t => t.id !== dragId && t.faction === dragged.faction && dist(t, { x, y }) < MERGE_THRESHOLD
    );

    if (mergeTarget) {
      setTokens(prev => prev
        .filter(t => t.id !== dragId)
        .map(t => t.id === mergeTarget.id
          ? { ...t, count: t.count + dragged.count, notes: [...t.notes, ...dragged.notes] }
          : t
        )
      );
      setSelected(mergeTarget.id);
    } else {
      setTokens(prev => prev.map(t => t.id === dragId ? { ...t, x, y } : t));
    }
    setDragId(null);
  }, [dragId, tokens]);

  const handleTokenClick = (id) => {
    if (mode === "pan") return;
    if (mode === "delete") {
      setTokens(prev => prev.filter(t => t.id !== id));
      if (selected === id) setSelected(null);
      return;
    }
    setSelected(id === selected ? null : id);
    setShowPanel(true);
  };

  const addNote = () => {
    if (!noteInput.trim() || !selected) return;
    setTokens(prev => prev.map(t => t.id === selected ? { ...t, notes: [...t.notes, noteInput.trim()] } : t));
    setNoteInput("");
  };

  const removeNote = (tokenId, idx) => {
    setTokens(prev => prev.map(t => t.id === tokenId
      ? { ...t, notes: t.notes.filter((_, i) => i !== idx) }
      : t
    ));
  };

  // Reset split count whenever a different token is selected
  useEffect(() => { setSplitCount(1); }, [selected]);

  const handleSplit = () => {
    if (!selectedToken || selectedToken.count < 2) return;
    const n = Math.min(Math.max(1, splitCount), selectedToken.count - 1);
    // Place the new token diagonally offset so it doesn't stack
    const offset = TOKEN_RADIUS * 3;
    setTokens(prev => [
      ...prev.map(t => t.id === selected ? { ...t, count: t.count - n } : t),
      {
        id: generateId(),
        faction: selectedToken.faction,
        x: selectedToken.x + offset,
        y: selectedToken.y + offset,
        count: n,
        notes: [],
      },
    ]);
    setSplitCount(1);
  };

  const canvasCursor = isGrabbing ? "grabbing"
    : mode === "pan" ? "grab"
    : mode === "place" ? "crosshair"
    : mode === "delete" ? "not-allowed"
    : "default";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#1a0e05",
      fontFamily: "'Crimson Text', 'Georgia', serif",
      color: "#e8d5a3",
      display: "flex",
      flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');

        * { box-sizing: border-box; }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1a0e05; }
        ::-webkit-scrollbar-thumb { background: #5c3d11; border-radius: 3px; }

        .toolbar-btn {
          font-family: 'Cinzel', serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          padding: 7px 14px;
          border-radius: 3px;
          border: 1px solid #5c3d11;
          background: #2c1a06;
          color: #c4952a;
          cursor: pointer;
          transition: all 0.15s;
          text-transform: uppercase;
        }
        .toolbar-btn:hover { background: #3a2209; border-color: #8b6914; }
        .toolbar-btn.active {
          background: #5c3d11;
          border-color: #c4952a;
          color: #f5e8c0;
          box-shadow: 0 0 8px #c4952a44;
        }
        .toolbar-btn.player-active    { background: #1a3d26; border-color: #4a9e6a; color: #a8d5b5; }
        .toolbar-btn.enemy-active     { background: #3d1010; border-color: #c45252; color: #e8a0a0; }
        .toolbar-btn.contested-active { background: #2d0a2d; border-color: #a050a0; color: #e8a0d2; }

        .mode-btn { font-family: 'Cinzel', serif; font-size: 11px; font-weight: 600; letter-spacing: 0.05em;
          padding: 6px 12px; border-radius: 3px; border: 1px solid #3a2209; background: #1f1005;
          color: #8b7040; cursor: pointer; transition: all 0.15s; text-transform: uppercase; }
        .mode-btn:hover { background: #2c1a06; color: #c4952a; border-color: #5c3d11; }
        .mode-btn.active { background: #3a2209; border-color: #8b6914; color: #f0d060; box-shadow: 0 0 6px #f0d06022; }
        .mode-btn.delete-active { background: #2d0a0a; border-color: #8b1a1a; color: #e05050; }
        .mode-btn.pan-active { background: #0a1a2d; border-color: #1a4a8b; color: #70a0e0; }

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
      `}</style>

      {/* Header */}
      <header style={{
        padding: "14px 24px",
        borderBottom: "1px solid #3a2209",
        background: "linear-gradient(180deg, #2c1a06 0%, #1a0e05 100%)",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Cinzel', serif", fontSize: 20, fontWeight: 700,
            color: "#f0d060", margin: 0, letterSpacing: "0.08em",
            textShadow: "0 0 20px #c4952a44",
          }}>
            ⚔ The War Council
          </h1>
          <p style={{ margin: 0, fontSize: 11, color: "#7a5c28", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Battle Map — Phase I
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "nowrap", overflowX: "auto", flexShrink: 1, minWidth: 0 }}>
          {/* Map selector */}
          <select
            value={selectedMap}
            onChange={handleMapSelect}
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.05em",
              padding: "7px 14px",
              borderRadius: 3,
              border: "1px solid #5c3d11",
              background: "#2c1a06",
              color: selectedMap ? "#f5e8c0" : "#8b7040",
              cursor: "pointer",
              textTransform: "uppercase",
              outline: "none",
            }}
          >
            <option value="">— Select Map —</option>
            {MAPS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
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
              <button
                className={`toolbar-btn ${placingFaction === "enemy" ? "enemy-active" : ""}`}
                onClick={() => setPlacingFaction("enemy")}
              >☠ Enemy</button>
              <button
                className={`toolbar-btn ${placingFaction === "contested" ? "contested-active" : ""}`}
                onClick={() => setPlacingFaction("contested")}
              >⚔ Contested</button>
            </>
          )}

          <div style={{ width: 1, height: 28, background: "#3a2209" }} />

          {/* Zoom controls */}
          <button className="zoom-btn" onClick={() => adjustZoom(1.1)}>+</button>
          <span style={{
            fontFamily: "'Cinzel', serif", fontSize: 11, color: "#8b7040",
            minWidth: 42, textAlign: "center", letterSpacing: "0.04em",
          }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="zoom-btn" onClick={() => adjustZoom(1 / 1.1)}>−</button>
          <button className="zoom-btn" onClick={resetView} title="Reset view" style={{ fontSize: 11, padding: "4px 9px" }}>⌂</button>
        </div>

        {/* Token count badges */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          {Object.entries(FACTIONS).map(([key, f]) => {
            const total = tokens.filter(t => t.faction === key).reduce((s, t) => s + t.count, 0);
            return (
              <div key={key} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 3,
                background: `${f.color}33`,
                border: `1px solid ${f.color}`,
              }}>
                <span style={{ fontSize: 14 }}>{f.icon}</span>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: 12, color: f.border }}>
                  {total}
                </span>
              </div>
            );
          })}
        </div>
      </header>

      {/* Main layout */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>

        {/* Canvas area */}
        <div
          ref={canvasRef}
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            touchAction: "none",
            userSelect: "none",
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
          {/* No-map placeholder — static, outside transform */}
          {!mapImage && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12, pointerEvents: "none",
            }}>
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="8" width="64" height="64" rx="4" stroke="#3a2209" strokeWidth="1.5" />
                <path d="M8 52 L24 36 L36 48 L52 28 L72 52" stroke="#3a2209" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
                <circle cx="56" cy="24" r="6" stroke="#3a2209" strokeWidth="1.5" />
                <path d="M16 60 L64 60" stroke="#2c1a06" strokeWidth="1" />
              </svg>
              <p style={{ color: "#3a2209", fontFamily: "'Cinzel', serif", fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Select a map to begin
              </p>
              <p style={{ color: "#2c1a06", fontSize: 13, margin: 0 }}>
                Or click to place tokens on the grid
              </p>
            </div>
          )}

          {/* Transform container — map image + tokens pan/zoom together */}
          <div style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "0 0",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            willChange: "transform",
          }}>
            {mapImage && (
              <img
                src={mapImage}
                alt="Battle Map"
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  objectFit: "contain",
                  userSelect: "none", pointerEvents: "none",
                }}
              />
            )}

            {/* Tokens */}
            {tokens.map(token => (
              <div
                key={token.id}
                draggable={mode === "move"}
                onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, token.id); }}
                onClick={(e) => { e.stopPropagation(); handleTokenClick(token.id); }}
                onTouchStart={(e) => { if (mode === "move") { e.stopPropagation(); tokenTouchRef.current = { id: token.id }; } }}
                title={token.notes?.join(" | ") || `${FACTIONS[token.faction].label} troops`}
                style={{
                  position: "absolute",
                  left: token.x - TOKEN_RADIUS,
                  top: token.y - TOKEN_RADIUS,
                  width: TOKEN_RADIUS * 2,
                  height: TOKEN_RADIUS * 2,
                  borderRadius: "50%",
                  background: `radial-gradient(circle at 35% 35%, ${FACTIONS[token.faction].border}33, ${FACTIONS[token.faction].color})`,
                  border: `2.5px solid ${selected === token.id ? "#f0d060" : FACTIONS[token.faction].border}`,
                  boxShadow: selected === token.id
                    ? `0 0 0 3px #f0d06066, 0 2px 12px #0008`
                    : `0 2px 8px #0006`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  cursor: mode === "move" ? "grab"
                    : mode === "delete" ? "not-allowed"
                    : mode === "pan" ? (isGrabbing ? "grabbing" : "grab")
                    : "pointer",
                  userSelect: "none",
                  zIndex: selected === token.id ? 20 : 10,
                  transition: "box-shadow 0.15s, border-color 0.15s",
                  fontFamily: "'Cinzel', serif",
                }}
              >
                <span style={{ fontSize: token.count > 1 ? 12 : 16, lineHeight: 1 }}>
                  {FACTIONS[token.faction].icon}
                </span>
                {token.count > 1 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#f5e8c0", lineHeight: 1 }}>
                    ×{token.count}
                  </span>
                )}
                {token.notes?.length > 0 && (
                  <span style={{
                    position: "absolute", top: -4, right: -4,
                    width: 10, height: 10, borderRadius: "50%",
                    background: "#c4952a", border: "1px solid #1a0e05",
                  }} />
                )}
              </div>
            ))}
          </div>

          {/* Border ornaments — static overlay, not transformed */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
            xmlns="http://www.w3.org/2000/svg">
            {[[6, 6], ["calc(100% - 58px)", 6], [6, "calc(100% - 58px)"], ["calc(100% - 58px)", "calc(100% - 58px)"]].map((pos, i) => (
              <g key={i} style={{ transform: `translate(${pos[0]}, ${pos[1]})` }}>
                <circle cx="26" cy="26" r="20" fill="none" stroke="#3a2209" strokeWidth="0.75" />
                <circle cx="26" cy="26" r="14" fill="none" stroke="#2c1a06" strokeWidth="0.5" />
                <path d="M26,12 C26,12 32,18 26,22 C20,26 14,20 20,16 C26,12 26,18 26,26 C26,34 20,38 14,34 C8,30 14,24 20,28"
                  fill="none" stroke="#5c3d11" strokeWidth="1" />
              </g>
            ))}
            <rect x="52" y="6" width="calc(100% - 104px)" height="1" fill="#3a2209"
              style={{ width: "calc(100% - 104px)" }} />
            <rect x="52" y="10" width="calc(100% - 104px)" height="0.5" fill="#2c1a06"
              style={{ width: "calc(100% - 104px)" }} />
            <rect x="6" y="52" width="1" height="calc(100% - 104px)" fill="#3a2209"
              style={{ height: "calc(100% - 104px)" }} />
          </svg>
        </div>

        {/* Side panel — absolute overlay so the canvas never resizes */}
        <div style={{
          position: "absolute",
          top: 0, right: 0, bottom: 0,
          width: 260,
          transform: `translateX(${showPanel && selectedToken ? 0 : 260}px)`,
          transition: "transform 0.2s ease",
          borderLeft: "1px solid #3a2209",
          background: "#1f1005",
          overflowY: "auto",
          zIndex: 50,
          boxShadow: showPanel && selectedToken ? "-6px 0 24px #0008" : "none",
        }}>
          {selectedToken && (
            <div style={{ width: 260, padding: "20px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: 13, fontWeight: 700, color: "#f0d060", margin: 0, letterSpacing: "0.08em" }}>
                  Token Details
                </h3>
                <button onClick={() => { setSelected(null); setShowPanel(false); }}
                  style={{ background: "none", border: "none", color: "#5c3d11", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
              </div>

              <div style={{
                padding: "10px 12px",
                background: "#2c1a06",
                borderRadius: 4,
                border: "1px solid #3a2209",
                marginBottom: 16,
              }}>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#8b7040" }}>Faction</p>
                <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600, color: selectedToken.faction === "player" ? "#a8d5b5" : "#e8a0a0" }}>
                  {FACTIONS[selectedToken.faction].icon} {FACTIONS[selectedToken.faction].label}
                </p>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#8b7040" }}>Count</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setTokens(prev => prev.map(t => t.id === selected && t.count > 1 ? { ...t, count: t.count - 1 } : t))}
                    style={{ background: "#3a2209", border: "1px solid #5c3d11", color: "#c4952a", borderRadius: 3, width: 24, height: 24, cursor: "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                  <span style={{ fontSize: 18, fontFamily: "'Cinzel', serif", fontWeight: 700, color: "#f5e8c0", minWidth: 24, textAlign: "center" }}>{selectedToken.count}</span>
                  <button onClick={() => setTokens(prev => prev.map(t => t.id === selected ? { ...t, count: t.count + 1 } : t))}
                    style={{ background: "#3a2209", border: "1px solid #5c3d11", color: "#c4952a", borderRadius: 3, width: 24, height: 24, cursor: "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
              </div>

              {/* Split forces */}
              {selectedToken.count > 1 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, color: "#8b7040", fontFamily: "'Cinzel', serif", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 8px" }}>
                    Split Forces
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      onClick={() => setSplitCount(c => Math.max(1, c - 1))}
                      style={{ background: "#3a2209", border: "1px solid #5c3d11", color: "#c4952a", borderRadius: 3, width: 24, height: 24, cursor: "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    >−</button>
                    <span style={{ fontSize: 15, fontFamily: "'Cinzel', serif", fontWeight: 700, color: "#f5e8c0", minWidth: 24, textAlign: "center" }}>{splitCount}</span>
                    <button
                      onClick={() => setSplitCount(c => Math.min(selectedToken.count - 1, c + 1))}
                      style={{ background: "#3a2209", border: "1px solid #5c3d11", color: "#c4952a", borderRadius: 3, width: 24, height: 24, cursor: "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    >+</button>
                    <button
                      onClick={handleSplit}
                      style={{ flex: 1, background: "#1a2d1a", border: "1px solid #2d6e3e", color: "#a8d5b5", borderRadius: 3, padding: "5px 8px", cursor: "pointer", fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}
                    >⑃ Split off</button>
                  </div>
                  <p style={{ margin: "5px 0 0", fontSize: 11, color: "#5c4a28" }}>
                    Detaches {splitCount} unit{splitCount !== 1 ? "s" : ""} into a new token nearby
                  </p>
                </div>
              )}

              <p style={{ fontSize: 12, color: "#8b7040", fontFamily: "'Cinzel', serif", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 8px" }}>
                Field Notes
              </p>
              <div style={{ marginBottom: 10 }}>
                {selectedToken.notes.map((note, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 6,
                    padding: "6px 8px", background: "#2c1a06",
                    borderRadius: 3, border: "1px solid #3a2209", marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 12, color: "#c4952a", flexShrink: 0, marginTop: 1 }}>◆</span>
                    <span style={{ fontSize: 13, color: "#e8d5a3", flex: 1, lineHeight: 1.4 }}>{note}</span>
                    <button onClick={() => removeNote(selected, i)}
                      style={{ background: "none", border: "none", color: "#5c3d11", cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1, flexShrink: 0 }}>✕</button>
                  </div>
                ))}
              </div>
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

              <button
                onClick={() => { setTokens(prev => prev.filter(t => t.id !== selected)); setSelected(null); setShowPanel(false); }}
                style={{
                  marginTop: 20, width: "100%", padding: "7px", borderRadius: 3,
                  background: "#2d0a0a", border: "1px solid #5c1a1a", color: "#e05050",
                  fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: "0.05em",
                  textTransform: "uppercase", cursor: "pointer",
                }}
              >
                ✕ Remove Token
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer legend */}
      <footer style={{
        padding: "8px 24px",
        borderTop: "1px solid #2c1a06",
        background: "#150b02",
        display: "flex",
        gap: 20,
        alignItems: "center",
        fontSize: 12,
        color: "#5c4a28",
        flexWrap: "wrap",
      }}>
        <span style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.1em", color: "#3a2d18", textTransform: "uppercase" }}>
          Phase I — Map &amp; Tokens
        </span>
        <span>⊕ Place mode: click canvas to place a token</span>
        <span>✦ Move mode: drag tokens to reposition</span>
        <span>✥ Pan mode: drag to pan · scroll wheel to zoom · middle-click drag always pans</span>
        <span>Tokens of the same faction placed nearby will merge (×count)</span>
      </footer>
    </div>
  );
}
