const h2 = {
  fontFamily: "'Cinzel', serif", fontSize: 13, fontWeight: 700,
  color: "#f0d060", margin: "0 0 12px", letterSpacing: "0.08em", textTransform: "uppercase",
};
const h3 = {
  fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 700,
  color: "#c4952a", margin: "16px 0 6px", letterSpacing: "0.08em", textTransform: "uppercase",
};
const p = { margin: "0 0 6px", fontSize: 13, color: "#e8d5a3", lineHeight: 1.5 };
const note = { margin: "0 0 6px", fontSize: 12, color: "#8b7040", lineHeight: 1.5 };
const pill = (bg, border, color) => ({
  display: "inline-block", padding: "1px 7px", borderRadius: 3,
  background: bg, border: `1px solid ${border}`, color, fontSize: 11,
  fontFamily: "'Cinzel', serif", letterSpacing: "0.05em", textTransform: "uppercase",
  whiteSpace: "nowrap",
});
const section = {
  padding: "14px 16px", background: "#2c1a06", borderRadius: 4,
  border: "1px solid #3a2209", marginBottom: 16,
};
const monarchSection = {
  ...section, background: "#2a1a05", border: "1px solid #6b5010",
};
const adminSection = {
  ...section, background: "#2c2005", border: "1px solid #8b6914",
};
const tableStyle = {
  width: "100%", borderCollapse: "collapse", fontSize: 12,
  color: "#e8d5a3", fontFamily: "'Crimson Text', Georgia, serif",
};
const th = {
  textAlign: "left", padding: "5px 8px",
  fontFamily: "'Cinzel', serif", fontSize: 10, color: "#5c4a28",
  letterSpacing: "0.08em", textTransform: "uppercase",
  borderBottom: "1px solid #3a2209",
};
const td = { padding: "5px 8px", borderBottom: "1px solid #2c1a06", verticalAlign: "top" };

function Row({ label, desc }) {
  return (
    <tr>
      <td style={{ ...td, color: "#c4952a", whiteSpace: "nowrap", fontFamily: "'Cinzel', serif", fontSize: 11 }}>{label}</td>
      <td style={td}>{desc}</td>
    </tr>
  );
}

function CommanderSection() {
  return (
    <div style={section}>
      <p style={h2}>⚔ Commander</p>

      <p style={h3}>Navigation</p>
      <table style={tableStyle}>
        <thead><tr><th style={th}>Control</th><th style={th}>Action</th></tr></thead>
        <tbody>
          <Row label="Scroll wheel" desc="Zoom in / out" />
          <Row label="Pan mode / Middle-click / Right-drag" desc="Pan the map" />
          <Row label="Pinch (touch)" desc="Pinch to zoom" />
          <Row label="+ / − buttons" desc="Step zoom" />
          <Row label="⌂ button" desc="Reset view" />
        </tbody>
      </table>

      <p style={h3}>Placing Tokens</p>
      <p style={p}>Switch to <strong>⊕ Place</strong> mode, then click anywhere on your home map.</p>
      <p style={note}>• Faction options: <span style={pill("#1a3d26","#4a9e6a","#a8d5b5")}>⚔ Player</span> or <span style={pill("#2d0a2d","#a050a0","#e8a0d2")}>⚔ Contested</span></p>
      <p style={note}>• Clicking near an existing same-faction token <strong>merges</strong> it into a group.</p>
      <p style={note}>• You can only place on <strong>your home nation's map</strong>.</p>
      <p style={note}>• A unit cap may apply — your usage shows in the header (e.g. <em>3/10 units</em>). Placement is blocked when you hit the limit.</p>

      <p style={h3}>Moving & Deleting</p>
      <p style={note}>• <strong>✦ Move</strong> mode — drag any token you own to reposition it. Dropping onto another same-faction token merges them.</p>
      <p style={note}>• <strong>✕ Delete</strong> mode — click one of your tokens to remove it instantly.</p>

      <p style={h3}>Token Panel</p>
      <p style={p}>Click any token (in Place or Move mode) to open the side panel.</p>
      <table style={tableStyle}>
        <thead><tr><th style={th}>Feature</th><th style={th}>What it does</th></tr></thead>
        <tbody>
          <Row label="Count −/+" desc="Adjust troop count on your own tokens." />
          <Row label="Unit Name" desc="Name your unit (or a specific member of a group)." />
          <Row label="Field Notes" desc="Add notes to any token — prefixed with your name. Delete your own notes with ✕." />
          <Row label="Split Forces" desc="Detach part of a group into a new token nearby. For grouped tokens, choose a member from the dropdown; for simple tokens, set a count." />
          <Row label="Donate Token" desc="Transfer full ownership to another player. Select a recipient and click ⇒ Transfer ownership." />
        </tbody>
      </table>

      <p style={h3}>History Timeline</p>
      <p style={p}>Click <strong>📜 History</strong> to scrub through past map states. Edits are disabled while viewing history — click <strong>⟳ Return to Live</strong> to resume.</p>

      <p style={h3}>Undo</p>
      <p style={p}>Click <strong>↩ Undo</strong> in the toolbar, or press <strong>Ctrl+Z</strong>, to reverse your last action on the current map.</p>
      <p style={note}>• Only your own most recent action is reversed — other players' changes since then are preserved.</p>
      <p style={note}>• If another player modified a token you affected after your action, a warning banner will appear asking you to confirm before proceeding.</p>
      <p style={note}>• The undo is saved as its own history entry, so it can be seen in the timeline.</p>
    </div>
  );
}

function MonarchSection() {
  return (
    <div style={monarchSection}>
      <p style={{ ...h2, color: "#c4952a" }}>♔ Monarch — Additional Powers</p>
      <p style={p}>Everything a Commander can do, plus:</p>
      <p style={note}>• <strong>Edit the count</strong> of any token belonging to your nation, even tokens you don't own.</p>
      <p style={note}>• <strong>Remove any note</strong> from any token in your nation, including notes left by other commanders.</p>
    </div>
  );
}

function AdminSection() {
  return (
    <div style={adminSection}>
      <p style={{ ...h2, color: "#f0d060" }}>👑 GM — Additional Powers</p>

      <p style={h3}>Admin Mode Toggle</p>
      <p style={p}>The <strong>👑 Admin: Off / On</strong> button in the top-right enables elevated permissions. Without it active you operate at Commander level.</p>

      <p style={h3}>With Admin Mode On</p>
      <p style={note}>• Place <span style={pill("#3d1010","#c45252","#e8a0a0")}>☠ Enemy</span> faction tokens.</p>
      <p style={note}>• Place tokens on <strong>any nation's map</strong>.</p>
      <p style={note}>• Move, delete, or edit <strong>any token</strong> regardless of owner.</p>
      <p style={note}>• Remove <strong>any note</strong> on any token.</p>
      <p style={note}>• <strong>No unit cap</strong> enforced.</p>

      <p style={h3}>GM Notes (Token Panel)</p>
      <p style={p}>The Token Panel shows a <strong>⚙ GM Notes</strong> section visible only to you. Attach private intelligence or scenario notes to any token — players never see this section, regardless of admin mode.</p>

      <p style={h3}>Admin Panel (⚙ Admin button)</p>
      <table style={tableStyle}>
        <thead><tr><th style={th}>Section</th><th style={th}>What you can do</th></tr></thead>
        <tbody>
          <Row label="Global Settings" desc="Set the default unit cap for all users. Leave blank for no limit." />
          <Row label="History Management" desc="Clear all recorded history for a selected map. Permanent — cannot be undone." />
          <Row label="User Management" desc="Set each user's nation, rank (Commander / Monarch / GM), and per-user unit cap override." />
        </tbody>
      </table>
    </div>
  );
}

export default function HelpModal({ onClose, isAdmin, isMonarch }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(10,5,0,0.87)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Crimson Text', Georgia, serif",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "min(720px, 96vw)",
        maxHeight: "88vh",
        background: "#1f1005",
        border: "1px solid #5c3d11",
        borderRadius: 6,
        boxShadow: "0 0 60px #0009, 0 0 24px #c4952a18",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{ height: 4, background: "linear-gradient(90deg, transparent, #8b6914, #c4952a, #8b6914, transparent)", flexShrink: 0 }} />

        <div style={{
          padding: "14px 20px",
          borderBottom: "1px solid #3a2209",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0, background: "#2c1a06",
        }}>
          <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: 15, fontWeight: 700, color: "#f0d060", margin: 0, letterSpacing: "0.08em" }}>
            ? Field Manual
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#5c3d11", cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1 }}
          >✕</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>
          <CommanderSection />
          {(isMonarch || isAdmin) && <MonarchSection />}
          {isAdmin && <AdminSection />}
        </div>

        <div style={{ height: 4, background: "linear-gradient(90deg, transparent, #5c3d11, #8b6914, #5c3d11, transparent)", flexShrink: 0 }} />
      </div>
    </div>
  );
}
