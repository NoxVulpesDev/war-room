import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { MAPS, FACTIONS, NATIONS } from "../constants";
import HelpModal from "./HelpModal";

export default function MapHeader({
  selectedMap, handleMapSelect,
  mode, setMode,
  placingFaction, setPlacingFaction,
  isAdmin, isMonarch, isAdminMode, adminMode, setAdminMode,
  userProfile, firebaseUser,
  saveStatus, tokens,
  zoom, adjustZoom, resetView,
  onOpenAdminPanel,
  onOpenTimeline, isReplaying,
  tokenCap,
}) {
  const [showHelp, setShowHelp] = useState(false);

  return (
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
        {!isAdminMode && tokenCap != null && selectedMap && (() => {
          const ownedCount = tokens.filter(t => t.ownerId === userProfile.uid && t.faction !== "contested").reduce((s, t) => s + t.count, 0);
          const atLimit = ownedCount >= tokenCap;
          return (
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 3,
              background: atLimit ? "#2d0a0a" : "#1a1005",
              border: `1px solid ${atLimit ? "#8b1a1a" : "#3a2209"}`,
            }}>
              <span style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: atLimit ? "#e05050" : "#8b7040", letterSpacing: "0.04em" }}>
                {ownedCount}/{tokenCap} units
              </span>
            </div>
          );
        })()}
      </div>

      {/* ── User / session area ───────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            onClick={onOpenAdminPanel}
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

        {/* History / timeline */}
        {selectedMap && (
          <button
            onClick={onOpenTimeline}
            style={{
              fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase",
              padding: "5px 10px", borderRadius: 3,
              border: `1px solid ${isReplaying ? "#c4952a" : "#3a2209"}`,
              background: isReplaying ? "#5c3d11" : "#1f1005",
              color: isReplaying ? "#f0d060" : "#8b7040",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            📜 History
          </button>
        )}

        {/* Help */}
        {firebaseUser && (
          <button
            onClick={() => setShowHelp(true)}
            style={{
              fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase",
              padding: "5px 10px", borderRadius: 3,
              border: "1px solid #3a2209", background: "#150b02",
              color: "#5c4a28", cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseOver={e => { e.currentTarget.style.color = "#c4952a"; e.currentTarget.style.borderColor = "#5c3d11"; }}
            onMouseOut={e => { e.currentTarget.style.color = "#5c4a28"; e.currentTarget.style.borderColor = "#3a2209"; }}
          >
            ? Guide
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

        {/* Save status pill — always in DOM to prevent layout shift; pinned right */}
        <span style={{
          marginLeft: "auto",
          fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: saveStatus === "saved" ? "#a8d5b5" : saveStatus === "error" ? "#e05050" : "#8b7040",
          padding: "3px 8px", borderRadius: 3,
          background: saveStatus === "saved" ? "#1a3d26" : saveStatus === "error" ? "#2d0a0a" : "#1f1005",
          border: `1px solid ${saveStatus === "saved" ? "#2d6e3e" : saveStatus === "error" ? "#5c1a1a" : "#3a2209"}`,
          transition: "color 0.3s, background 0.3s, border-color 0.3s",
          minWidth: 88, textAlign: "center",
          visibility: saveStatus === "idle" ? "hidden" : "visible",
        }}>
          {saveStatus === "saving" ? "⟳ Saving…" : saveStatus === "saved" ? "✓ Saved" : "✕ Save error"}
        </span>
      </div>

      {showHelp && (
        <HelpModal
          onClose={() => setShowHelp(false)}
          isAdmin={isAdmin}
          isMonarch={isMonarch}
        />
      )}
    </header>
  );
}
