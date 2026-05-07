import { useState, useEffect } from "react";
import { getAllUsers, updateUserProfile, getGlobalSettings, updateGlobalSettings, clearHistory } from "./firebase";
import { MAPS } from "./constants";

const NATIONS_LIST = [
  { value: "erin",      label: "Erin" },
  { value: "manx",      label: "Manx" },
  { value: "caledonia", label: "Caledonia" },
  { value: "cymria",    label: "Cymria" },
];

export default function AdminPanel({ onClose }) {
  const [users,         setUsers]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [edits,         setEdits]         = useState({});
  const [saving,        setSaving]        = useState({});
  const [errors,        setErrors]        = useState({});
  const [globalSettings, setGlobalSettings] = useState({ defaultMaxTokens: "" });
  const [globalSaving,  setGlobalSaving]  = useState(false);
  const [globalError,   setGlobalError]   = useState("");

  const [historyMap,    setHistoryMap]    = useState(MAPS[0].id);
  const [historySaving, setHistorySaving] = useState(false);
  const [historyMsg,    setHistoryMsg]    = useState("");
  const [historyError,  setHistoryError]  = useState("");

  useEffect(() => {
    Promise.all([getAllUsers(), getGlobalSettings()])
      .then(([allUsers, settings]) => {
        setUsers(allUsers);
        const initialEdits = {};
        allUsers.forEach(u => {
          initialEdits[u.uid] = {
            nation:    u.nation ?? "",
            role:      u.role === "player" ? "commander" : (u.role ?? "commander"),
            maxTokens: u.maxTokens != null ? String(u.maxTokens) : "",
          };
        });
        setEdits(initialEdits);
        setGlobalSettings({
          defaultMaxTokens: settings.defaultMaxTokens != null ? String(settings.defaultMaxTokens) : "",
        });
        setLoading(false);
      })
      .catch(err => {
        console.error("Admin panel load error:", err);
        setLoading(false);
      });
  }, []);

  const setField = (uid, field, value) => {
    setEdits(prev => ({ ...prev, [uid]: { ...prev[uid], [field]: value } }));
  };

  const saveUser = async (uid) => {
    setSaving(prev => ({ ...prev, [uid]: true }));
    setErrors(prev => ({ ...prev, [uid]: "" }));
    try {
      const e = edits[uid];
      const updates = {
        nation:    e.nation || null,
        role:      e.role,
        maxTokens: e.maxTokens === "" ? null : Number(e.maxTokens),
      };
      await updateUserProfile(uid, updates);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...updates } : u));
    } catch (err) {
      setErrors(prev => ({ ...prev, [uid]: err.message }));
    } finally {
      setSaving(prev => ({ ...prev, [uid]: false }));
    }
  };

  const handleClearHistory = async () => {
    const mapLabel = MAPS.find(m => m.id === historyMap)?.label ?? historyMap;
    if (!window.confirm(`Delete all history for the ${mapLabel} map? This cannot be undone.`)) return;
    setHistorySaving(true);
    setHistoryMsg("");
    setHistoryError("");
    try {
      const count = await clearHistory(historyMap);
      setHistoryMsg(`Cleared ${count} entr${count === 1 ? "y" : "ies"} from ${mapLabel}.`);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setHistorySaving(false);
    }
  };

  const saveGlobal = async () => {
    setGlobalSaving(true);
    setGlobalError("");
    try {
      const updates = {
        defaultMaxTokens: globalSettings.defaultMaxTokens === "" ? null : Number(globalSettings.defaultMaxTokens),
      };
      await updateGlobalSettings(updates);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setGlobalSaving(false);
    }
  };

  const inp = {
    background: "#150b02",
    border: "1px solid #5c3d11",
    borderRadius: 3,
    color: "#e8d5a3",
    fontFamily: "'Crimson Text', Georgia, serif",
    fontSize: 13,
    padding: "5px 8px",
    outline: "none",
    width: "100%",
  };

  const btn = {
    fontFamily: "'Cinzel', serif",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    padding: "5px 12px",
    borderRadius: 3,
    border: "1px solid #8b6914",
    background: "#3a2209",
    color: "#f0d060",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(10,5,0,0.87)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Crimson Text', Georgia, serif",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "min(880px, 96vw)",
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
          flexShrink: 0,
          background: "#2c1a06",
        }}>
          <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: 15, fontWeight: 700, color: "#f0d060", margin: 0, letterSpacing: "0.08em" }}>
            👑 Council Administration
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#5c3d11", cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1 }}
          >✕</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>

          {/* Global Settings */}
          <div style={{ marginBottom: 28, padding: "14px 16px", background: "#2c1a06", borderRadius: 4, border: "1px solid #3a2209" }}>
            <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 700, color: "#c4952a", margin: "0 0 12px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Global Settings
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, color: "#8b7040", fontFamily: "'Cinzel', serif", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                Default max units per map:
              </label>
              <input
                style={{ ...inp, width: 80 }}
                type="number"
                min="0"
                value={globalSettings.defaultMaxTokens}
                onChange={e => setGlobalSettings(prev => ({ ...prev, defaultMaxTokens: e.target.value }))}
                placeholder="∞"
              />
              <button onClick={saveGlobal} disabled={globalSaving} style={{ ...btn, opacity: globalSaving ? 0.6 : 1 }}>
                {globalSaving ? "Saving…" : "Save"}
              </button>
              <span style={{ fontSize: 11, color: "#5c4a28" }}>Leave blank for no limit</span>
            </div>
            {globalError && <p style={{ margin: "8px 0 0", fontSize: 11, color: "#e05050" }}>{globalError}</p>}
          </div>

          {/* History Management */}
          <div style={{ marginBottom: 28, padding: "14px 16px", background: "#2c1a06", borderRadius: 4, border: "1px solid #3a2209" }}>
            <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 700, color: "#c4952a", margin: "0 0 12px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              History Management
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, color: "#8b7040", fontFamily: "'Cinzel', serif", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                Map:
              </label>
              <select
                style={{ ...inp, width: "auto", cursor: "pointer" }}
                value={historyMap}
                onChange={e => { setHistoryMap(e.target.value); setHistoryMsg(""); setHistoryError(""); }}
              >
                {MAPS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <button
                onClick={handleClearHistory}
                disabled={historySaving}
                style={{
                  ...btn,
                  border: "1px solid #8b1a1a",
                  background: "#2d0a0a",
                  color: "#e05050",
                  opacity: historySaving ? 0.6 : 1,
                  cursor: historySaving ? "wait" : "pointer",
                }}
              >
                {historySaving ? "Clearing…" : "✕ Clear History"}
              </button>
              {historyMsg && <span style={{ fontSize: 11, color: "#a8d5b5" }}>{historyMsg}</span>}
            </div>
            {historyError && <p style={{ margin: "8px 0 0", fontSize: 11, color: "#e05050" }}>{historyError}</p>}
          </div>

          {/* Users */}
          <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 700, color: "#c4952a", margin: "0 0 12px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Users
          </h3>

          {loading ? (
            <p style={{ color: "#5c4a28", fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: "0.1em" }}>
              Consulting the scrolls…
            </p>
          ) : users.length === 0 ? (
            <p style={{ color: "#5c4a28", fontSize: 13 }}>No users found.</p>
          ) : (
            <div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "210px 1fr 1fr 110px 70px",
                gap: 8, padding: "4px 10px 8px",
                borderBottom: "1px solid #3a2209",
              }}>
                {["Name / Email", "Nation", "Rank", "Max Units", ""].map(h => (
                  <span key={h} style={{ fontSize: 10, color: "#5c4a28", fontFamily: "'Cinzel', serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {h}
                  </span>
                ))}
              </div>

              {users.map(user => {
                const uid      = user.uid;
                const edit     = edits[uid] ?? { nation: "", role: "commander", maxTokens: "" };
                const isSaving = saving[uid];
                const rowError = errors[uid];
                return (
                  <div key={uid} style={{ borderBottom: "1px solid #2c1a06" }}>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "210px 1fr 1fr 110px 70px",
                      gap: 8, padding: "10px 10px",
                      alignItems: "center",
                    }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#e8d5a3", fontWeight: 600 }}>{user.displayName}</div>
                        <div style={{ fontSize: 10, color: "#5c4a28", marginTop: 1 }}>{user.email}</div>
                      </div>

                      <select
                        style={{ ...inp, cursor: "pointer" }}
                        value={edit.nation}
                        onChange={e => setField(uid, "nation", e.target.value)}
                      >
                        <option value="">— None —</option>
                        {NATIONS_LIST.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                      </select>

                      <select
                        style={{ ...inp, cursor: "pointer" }}
                        value={edit.role}
                        onChange={e => setField(uid, "role", e.target.value)}
                      >
                        <option value="commander">Commander</option>
                        <option value="monarch">Monarch</option>
                        <option value="admin">GM (Admin)</option>
                      </select>

                      <input
                        style={inp}
                        type="number"
                        min="0"
                        value={edit.maxTokens}
                        onChange={e => setField(uid, "maxTokens", e.target.value)}
                        placeholder="∞"
                      />

                      <button
                        onClick={() => saveUser(uid)}
                        disabled={isSaving}
                        style={{ ...btn, opacity: isSaving ? 0.6 : 1, cursor: isSaving ? "wait" : "pointer" }}
                      >
                        {isSaving ? "…" : "Save"}
                      </button>
                    </div>
                    {rowError && (
                      <div style={{ padding: "0 10px 8px", fontSize: 11, color: "#e05050" }}>
                        Error: {rowError}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ height: 4, background: "linear-gradient(90deg, transparent, #5c3d11, #8b6914, #5c3d11, transparent)", flexShrink: 0 }} />
      </div>
    </div>
  );
}
