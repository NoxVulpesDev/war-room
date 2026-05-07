import { useState, useEffect, useRef } from "react";
import { FACTIONS, NATIONS } from "../constants";
import { deleteToken } from "../firebase";

const noteRow = { display: "flex", alignItems: "flex-start", gap: 6, padding: "6px 8px", background: "#2c1a06", borderRadius: 3, border: "1px solid #3a2209", marginBottom: 4 };
const sectionLabel = { fontSize: 12, color: "#8b7040", fontFamily: "'Cinzel', serif", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 8px" };
const memberHeader = { fontSize: 11, color: "#c4952a", fontFamily: "'Cinzel', serif", letterSpacing: "0.06em", textTransform: "uppercase", margin: "8px 0 4px", paddingLeft: 2 };
const selectStyle = { background: "#1f1005", border: "1px solid #5c3d11", borderRadius: 3, color: "#e8d5a3", fontFamily: "'Crimson Text', serif", fontSize: 13, padding: "5px 8px", width: "100%", outline: "none", cursor: "pointer" };

export default function TokenPanel({
  selectedToken, showPanel,
  selected, setSelected, setShowPanel,
  canMutateToken, canEditCount, isAdmin, isMonarch,
  userProfile, userProfiles,
  setTokensAndSave,
  noteInput, setNoteInput, addNote, removeNote,
  addGmNote, removeGmNote,
  splitCount, setSplitCount, handleSplit,
  handleToggleLock,
  handleSetMemberName,
  handleDonate,
  sessionId,
}) {
  const locked = selectedToken ? !canMutateToken(selectedToken) : true;
  const countLocked = selectedToken ? !canEditCount(selectedToken) : true;
  const isOwner = selectedToken?.ownerId === userProfile?.uid;
  const [noteTarget, setNoteTarget] = useState(0);
  const [donateTarget, setDonateTarget] = useState("");
  const [gmNoteInput, setGmNoteInput] = useState("");

  const members = selectedToken?.members ?? [];
  const isGrouped = members.length > 1;
  const activeMemberIdx = isGrouped ? Math.min(splitCount, members.length - 1) : 0;
  const activeMember = members[activeMemberIdx] ?? null;

  useEffect(() => { setNoteTarget(0); setDonateTarget(""); setGmNoteInput(""); }, [selected]);

  const memberLabel = (member) => {
    const name = member.name?.trim() || (member.ownerId && userProfiles[member.ownerId]?.displayName) || "Unnamed";
    const nation = member.nation && NATIONS[member.nation] ? NATIONS[member.nation].label : null;
    return nation ? `${name} — ${nation}` : name;
  };

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

          {/* Header */}
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

          {selectedToken.locked && (
            <p style={{ fontSize: 11, color: "#8b7040", marginBottom: 12, background: "#1a0e05", borderRadius: 3, padding: "6px 10px", border: "1px solid #3a2209" }}>
              Group composition is locked — cannot be merged or split.
            </p>
          )}

          {/* Faction + Count */}
          <div style={{ padding: "10px 12px", background: "#2c1a06", borderRadius: 4, border: "1px solid #3a2209", marginBottom: 12 }}>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: "#8b7040" }}>Faction</p>
            <p style={{
              margin: "0 0 10px", fontSize: 15, fontWeight: 600,
              color: selectedToken.faction === "player" && selectedToken.nation && NATIONS[selectedToken.nation]
                ? NATIONS[selectedToken.nation].border
                : selectedToken.faction === "player" ? "#a8d5b5"
                : selectedToken.faction === "enemy"  ? "#e8a0a0"
                : "#e8a0d2",
            }}>
              {FACTIONS[selectedToken.faction].icon} {selectedToken.faction === "player" && selectedToken.ownerId && userProfiles[selectedToken.ownerId] ? userProfiles[selectedToken.ownerId]?.displayName ?? FACTIONS[selectedToken.faction].label : FACTIONS[selectedToken.faction].label}
              {selectedToken.faction === "player" && selectedToken.nation && NATIONS[selectedToken.nation] && (
                <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.8 }}> — {NATIONS[selectedToken.nation].label}</span>
              )}
            </p>
            <p style={{ margin: "0 0 4px", fontSize: 13, color: "#8b7040" }}>Count</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button disabled={countLocked}
                onClick={() => !countLocked && setTokensAndSave(prev => prev.map(t => t.id === selected && t.count > 1 ? { ...t, count: t.count - 1 } : t))}
                style={{ background: "#3a2209", border: "1px solid #5c3d11", color: "#c4952a", borderRadius: 3, width: 24, height: 24, cursor: countLocked ? "not-allowed" : "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: countLocked ? 0.5 : 1 }}>−</button>
              <span style={{ fontSize: 18, fontFamily: "'Cinzel', serif", fontWeight: 700, color: "#f5e8c0", minWidth: 24, textAlign: "center" }}>{selectedToken.count}</span>
              <button disabled={countLocked}
                onClick={() => !countLocked && setTokensAndSave(prev => prev.map(t => t.id === selected ? { ...t, count: t.count + 1 } : t))}
                style={{ background: "#3a2209", border: "1px solid #5c3d11", color: "#c4952a", borderRadius: 3, width: 24, height: 24, cursor: countLocked ? "not-allowed" : "pointer", fontSize: 16, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: countLocked ? 0.5 : 1 }}>+</button>
            </div>
          </div>

          {/* Unit Name */}
          {activeMember !== null && (
            <div style={{ marginBottom: 16 }}>
              <p style={sectionLabel}>Unit Name</p>
              <input
                className="note-input"
                value={activeMember.name ?? ""}
                onChange={e => !locked && handleSetMemberName(selected, activeMemberIdx, e.target.value)}
                placeholder={isGrouped ? `Name for ${memberLabel(activeMember)}…` : "Name this unit…"}
                readOnly={locked}
                style={{ width: "100%", opacity: locked ? 0.6 : 1 }}
              />
              {isGrouped && (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#5c4a28" }}>Editing name for selected member — use the split dropdown to switch</p>
              )}
            </div>
          )}

          {/* Split Forces */}
          {selectedToken.count > 1 && !locked && (
            <div style={{ marginBottom: 16 }}>
              <p style={sectionLabel}>Split Forces</p>
              {isGrouped ? (
                <>
                  <select value={splitCount} onChange={e => setSplitCount(Number(e.target.value))}
                    style={{ ...selectStyle, marginBottom: 6 }}>
                    {members.map((member, i) => {
                      const name = member.name?.trim() || (member.ownerId && userProfiles[member.ownerId]?.displayName) || "Unnamed";
                      const nation = member.nation && NATIONS[member.nation] ? NATIONS[member.nation].label : null;
                      return <option key={i} value={i}>{name}{nation ? ` — ${nation}` : ""} ({member.count} unit{member.count !== 1 ? "s" : ""})</option>;
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

          {/* Lock Group */}
          {isGrouped && !locked && (
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={handleToggleLock}
                style={{ width: "100%", background: selectedToken.locked ? "#2d1a06" : "#1a0e05", border: `1px solid ${selectedToken.locked ? "#c4952a" : "#5c3d11"}`, color: selectedToken.locked ? "#c4952a" : "#8b7040", borderRadius: 3, padding: "5px 8px", cursor: "pointer", fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}
              >
                {selectedToken.locked ? "⚿ Unlock group" : "⚿ Lock group"}
              </button>
              <p style={{ margin: "5px 0 0", fontSize: 11, color: "#5c4a28" }}>
                {selectedToken.locked ? "Allow this group to be merged with or split again" : "Prevent this group from being merged or split"}
              </p>
            </div>
          )}

          {/* Donate Token */}
          {isOwner && !locked && selectedToken.faction !== "enemy" && (
            <div style={{ marginBottom: 16 }}>
              <p style={sectionLabel}>Donate Token</p>
              <select
                value={donateTarget}
                onChange={e => setDonateTarget(e.target.value)}
                style={{ ...selectStyle, marginBottom: 6 }}
              >
                <option value="">— Select recipient —</option>
                {Object.values(userProfiles)
                  .filter(u => u.uid !== userProfile?.uid)
                  .sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? ""))
                  .map(u => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName ?? u.uid}{u.nation && NATIONS[u.nation] ? ` — ${NATIONS[u.nation].label}` : ""}
                    </option>
                  ))}
              </select>
              <button
                disabled={!donateTarget}
                onClick={() => { if (donateTarget) { handleDonate(donateTarget); setDonateTarget(""); } }}
                style={{ width: "100%", background: donateTarget ? "#1a2a3d" : "#1f1005", border: `1px solid ${donateTarget ? "#3d6e8b" : "#3a2209"}`, color: donateTarget ? "#90c4e0" : "#5c4a28", borderRadius: 3, padding: "5px 8px", cursor: donateTarget ? "pointer" : "not-allowed", fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}
              >
                ⇒ Transfer ownership
              </button>
              <p style={{ margin: "5px 0 0", fontSize: 11, color: "#5c4a28" }}>Transfers full control of this token to the selected player</p>
            </div>
          )}

          {/* Field Notes */}
          <p style={sectionLabel}>Field Notes</p>
          <div style={{ marginBottom: 10 }}>
            {members.map((member, mi) => {
              const notes = member.notes ?? [];
              if (notes.length === 0) return null;
              return (
                <div key={`ms-${mi}`}>
                  {isGrouped && <p style={memberHeader}>◈ {memberLabel(member)}</p>}
                  {notes.map((note, ni) => (
                    <div key={`m-${mi}-${ni}`} style={noteRow}>
                      <span style={{ fontSize: 12, color: "#c4952a", flexShrink: 0, marginTop: 1 }}>◆</span>
                      <span style={{ fontSize: 13, color: "#e8d5a3", flex: 1, lineHeight: 1.4 }}>{note}</span>
                      {(!locked || isAdmin || isMonarch) && (
                        <button onClick={() => removeNote(selected, mi, ni)}
                          style={{ background: "none", border: "none", color: "#5c3d11", cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1, flexShrink: 0 }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
            {selectedToken.notes.length > 0 && (
              <div>
                {isGrouped && <p style={memberHeader}>◈ Group</p>}
                {selectedToken.notes.map((note, i) => (
                  <div key={`g-${i}`} style={noteRow}>
                    <span style={{ fontSize: 12, color: "#c4952a", flexShrink: 0, marginTop: 1 }}>◆</span>
                    <span style={{ fontSize: 13, color: "#e8d5a3", flex: 1, lineHeight: 1.4 }}>{note}</span>
                    {(!locked || isAdmin || isMonarch) && (
                      <button onClick={() => removeNote(selected, "group", i)}
                        style={{ background: "none", border: "none", color: "#5c3d11", cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1, flexShrink: 0 }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Note */}
          {!!userProfile && (
            <div style={{ marginBottom: 16 }}>
              {isGrouped && (
                <select value={noteTarget} onChange={e => setNoteTarget(e.target.value === "group" ? "group" : Number(e.target.value))}
                  style={{ ...selectStyle, fontSize: 12, marginBottom: 6 }}>
                  {members.map((m, i) => (
                    <option key={i} value={i}>Note on: {m.name?.trim() || (m.ownerId && userProfiles[m.ownerId]?.displayName) || "Unnamed"}</option>
                  ))}
                  <option value="group">Note on: Group</option>
                </select>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  className="note-input"
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addNote(noteTarget)}
                  placeholder="Add a note…"
                  style={{ flex: 1 }}
                />
                <button onClick={() => addNote(noteTarget)}
                  style={{ background: "#3a2209", border: "1px solid #5c3d11", color: "#c4952a", borderRadius: 3, padding: "5px 10px", cursor: "pointer", fontFamily: "'Cinzel', serif", fontSize: 11 }}>+</button>
              </div>
            </div>
          )}

          {/* GM Notes — only visible to admins */}
          {isAdmin && (
            <div style={{ marginBottom: 16, borderTop: "1px solid #2c1a06", paddingTop: 14 }}>
              <p style={{ ...sectionLabel, color: "#a06030" }}>⚙ GM Notes <span style={{ fontSize: 10, fontWeight: 400, letterSpacing: 0, textTransform: "none", color: "#5c3d11" }}>(hidden from players)</span></p>
              {(selectedToken.gmNotes ?? []).map((note, i) => (
                <div key={`gm-${i}`} style={{ ...noteRow, background: "#1a0e02", border: "1px solid #5c3011" }}>
                  <span style={{ fontSize: 12, color: "#a06030", flexShrink: 0, marginTop: 1 }}>◆</span>
                  <span style={{ fontSize: 13, color: "#c4a060", flex: 1, lineHeight: 1.4 }}>{note}</span>
                  <button onClick={() => removeGmNote(selected, i)}
                    style={{ background: "none", border: "none", color: "#5c3d11", cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1, flexShrink: 0 }}>✕</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  className="note-input"
                  value={gmNoteInput}
                  onChange={e => setGmNoteInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { addGmNote(gmNoteInput); setGmNoteInput(""); } }}
                  placeholder="Add a GM note…"
                  style={{ flex: 1, borderColor: "#5c3011" }}
                />
                <button onClick={() => { addGmNote(gmNoteInput); setGmNoteInput(""); }}
                  style={{ background: "#3a2009", border: "1px solid #5c3011", color: "#a06030", borderRadius: 3, padding: "5px 10px", cursor: "pointer", fontFamily: "'Cinzel', serif", fontSize: 11 }}>+</button>
              </div>
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
              style={{ marginTop: 4, width: "100%", padding: "7px", borderRadius: 3, background: "#2d0a0a", border: "1px solid #5c1a1a", color: "#e05050", fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}
            >
              ✕ Remove Token
            </button>
          )}
        </div>
      )}
    </div>
  );
}
