import { FACTIONS, NATIONS } from "../constants";
import { deleteToken } from "../firebase";

export default function TokenPanel({
  selectedToken, showPanel,
  selected, setSelected, setShowPanel,
  canMutateToken, isAdmin, isMonarch,
  userProfile, userProfiles,
  setTokensAndSave,
  noteInput, setNoteInput, addNote, removeNote,
  splitCount, setSplitCount, handleSplit,
  sessionId,
}) {
  const locked = selectedToken ? !canMutateToken(selectedToken) : true;

  return (
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
      {selectedToken && (
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
              {selectedToken.members?.length > 1 ? (
                <>
                  <select
                    value={splitCount}
                    onChange={e => setSplitCount(Number(e.target.value))}
                    style={{ background: "#1f1005", border: "1px solid #5c3d11", borderRadius: 3, color: "#e8d5a3", fontFamily: "'Crimson Text', serif", fontSize: 13, padding: "5px 8px", width: "100%", outline: "none", cursor: "pointer", marginBottom: 6 }}
                  >
                    {selectedToken.members.map((member, i) => {
                      const name = (member.ownerId && userProfiles[member.ownerId]) || 'Unknown';
                      const nation = member.nation && NATIONS[member.nation] ? NATIONS[member.nation].label : null;
                      const label = nation ? `${name} — ${nation} (${member.count} unit${member.count !== 1 ? 's' : ''})` : `${name} (${member.count} unit${member.count !== 1 ? 's' : ''})`;
                      return <option key={i} value={i}>{label}</option>;
                    })}
                  </select>
                  <button onClick={handleSplit}
                    style={{ width: "100%", background: "#1a2d1a", border: "1px solid #2d6e3e", color: "#a8d5b5", borderRadius: 3, padding: "5px 8px", cursor: "pointer", fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}>⑃ Split off selected</button>
                  <p style={{ margin: "5px 0 0", fontSize: 11, color: "#5c4a28" }}>Detaches selected member into its own token, restoring their notes and owner</p>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => setSplitCount(c => Math.max(0, c - 1))}
                      style={{ background: "#3a2209", border: "1px solid #5c3d11", color: "#c4952a", borderRadius: 3, width: 24, height: 24, cursor: "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
                    <span style={{ fontSize: 15, fontFamily: "'Cinzel', serif", fontWeight: 700, color: "#f5e8c0", minWidth: 24, textAlign: "center" }}>{Math.max(1, splitCount)}</span>
                    <button onClick={() => setSplitCount(c => Math.min(selectedToken.count - 1, c + 1))}
                      style={{ background: "#3a2209", border: "1px solid #5c3d11", color: "#c4952a", borderRadius: 3, width: 24, height: 24, cursor: "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
                    <button onClick={handleSplit}
                      style={{ flex: 1, background: "#1a2d1a", border: "1px solid #2d6e3e", color: "#a8d5b5", borderRadius: 3, padding: "5px 8px", cursor: "pointer", fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}>⑃ Split off</button>
                  </div>
                  <p style={{ margin: "5px 0 0", fontSize: 11, color: "#5c4a28" }}>Detaches {Math.max(1, splitCount)} unit{Math.max(1, splitCount) !== 1 ? "s" : ""} into a new token nearby</p>
                </>
              )}
            </div>
          )}

          <p style={{ fontSize: 12, color: "#8b7040", fontFamily: "'Cinzel', serif", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 8px" }}>
            Field Notes
          </p>
          <div style={{ marginBottom: 10 }}>
            {selectedToken.notes.map((note, i) => (
              <div key={`g-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "6px 8px", background: "#2c1a06", borderRadius: 3, border: "1px solid #3a2209", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#c4952a", flexShrink: 0, marginTop: 1 }}>◆</span>
                <span style={{ fontSize: 13, color: "#e8d5a3", flex: 1, lineHeight: 1.4 }}>{note}</span>
                {(!locked || isAdmin || isMonarch) && (
                  <button onClick={() => removeNote(selected, 'group', i)}
                    style={{ background: "none", border: "none", color: "#5c3d11", cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1, flexShrink: 0 }}>✕</button>
                )}
              </div>
            ))}
            {selectedToken.members?.flatMap((member, mi) =>
              (member.notes ?? []).map((note, ni) => (
                <div key={`m-${mi}-${ni}`} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "6px 8px", background: "#2c1a06", borderRadius: 3, border: "1px solid #3a2209", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#c4952a", flexShrink: 0, marginTop: 1 }}>◆</span>
                  <span style={{ fontSize: 13, color: "#e8d5a3", flex: 1, lineHeight: 1.4 }}>{note}</span>
                  {(!locked || isAdmin || isMonarch) && (
                    <button onClick={() => removeNote(selected, mi, ni)}
                      style={{ background: "none", border: "none", color: "#5c3d11", cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1, flexShrink: 0 }}>✕</button>
                  )}
                </div>
              ))
            )}
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
              onClick={() => {
                setTokensAndSave(prev => prev.filter(t => t.id !== selected));
                deleteToken(sessionId, selected);
                setSelected(null);
                setShowPanel(false);
              }}
              style={{ marginTop: 20, width: "100%", padding: "7px", borderRadius: 3, background: "#2d0a0a", border: "1px solid #5c1a1a", color: "#e05050", fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}
            >
              ✕ Remove Token
            </button>
          )}
        </div>
      )}
    </div>
  );
}
