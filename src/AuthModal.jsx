// ─────────────────────────────────────────────────────────────────────────────
// AuthModal.jsx  —  Celtic-parchment login / sign-up modal
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth, getOrCreateUserProfile } from "./firebase";

const inputStyle = {
  width: "100%",
  background: "#150b02",
  border: "1px solid #5c3d11",
  borderRadius: 3,
  color: "#e8d5a3",
  fontFamily: "'Crimson Text', Georgia, serif",
  fontSize: 15,
  padding: "8px 10px",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

const btnPrimary = {
  width: "100%",
  padding: "9px 0",
  borderRadius: 3,
  border: "1px solid #8b6914",
  background: "linear-gradient(180deg, #3a2209 0%, #2c1a06 100%)",
  color: "#f0d060",
  fontFamily: "'Cinzel', serif",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  cursor: "pointer",
  transition: "all 0.15s",
};

const errStyle = {
  fontSize: 12,
  color: "#e05050",
  background: "#2d0a0a",
  border: "1px solid #5c1a1a",
  borderRadius: 3,
  padding: "6px 10px",
  marginTop: 6,
  fontFamily: "'Crimson Text', serif",
};

// ── Decorative SVG knotwork divider ──────────────────────────────────────────
function KnotDivider() {
  return (
    <svg width="100%" height="16" viewBox="0 0 220 16" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", margin: "8px 0" }}>
      <line x1="0" y1="8" x2="88" y2="8" stroke="#3a2209" strokeWidth="0.75" />
      <circle cx="110" cy="8" r="6" fill="none" stroke="#5c3d11" strokeWidth="0.75" />
      <circle cx="110" cy="8" r="2.5" fill="#5c3d11" />
      <path d="M102,8 C102,4 106,4 110,8 C114,12 118,12 118,8 C118,4 114,4 110,8" fill="none" stroke="#8b6914" strokeWidth="0.75" />
      <line x1="122" y1="8" x2="220" y2="8" stroke="#3a2209" strokeWidth="0.75" />
    </svg>
  );
}

// ── Main AuthModal component ─────────────────────────────────────────────────
export default function AuthModal({ onAuth }) {
  const [tab, setTab] = useState("login");   // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const finish = async (firebaseUser) => {
    const profile = await getOrCreateUserProfile(firebaseUser);
    onAuth(firebaseUser, profile);
  };

  const handleEmailAuth = async () => {
    setError("");
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    try {
      if (tab === "login") {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await finish(cred.user);
      } else {
        if (!displayName.trim()) { setError("Enter a display name."); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: displayName.trim() });
        await finish(cred.user);
      }
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(10,5,0,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Crimson Text', Georgia, serif",
    }}>
      <div style={{
        width: "min(400px, 92vw)",
        background: "#1f1005",
        border: "1px solid #5c3d11",
        borderRadius: 6,
        boxShadow: "0 0 60px #0009, 0 0 20px #c4952a18",
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Top ornament bar */}
        <div style={{
          height: 4,
          background: "linear-gradient(90deg, transparent, #8b6914, #c4952a, #8b6914, transparent)",
        }} />

        <div style={{ padding: "28px 28px 24px" }}>
          {/* Title */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>⚔</div>
            <h2 style={{
              fontFamily: "'Cinzel', serif", fontSize: 18, fontWeight: 700,
              color: "#f0d060", margin: 0, letterSpacing: "0.08em",
              textShadow: "0 0 20px #c4952a44",
            }}>The War Council</h2>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#5c4a28", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Identify yourself, commander
            </p>
          </div>

          <KnotDivider />

          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            {["login", "signup"].map(t => (
              <button key={t}
                onClick={() => { setTab(t); setError(""); }}
                style={{
                  flex: 1, padding: "6px 0", borderRadius: 3, cursor: "pointer",
                  fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 600,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  border: tab === t ? "1px solid #8b6914" : "1px solid #3a2209",
                  background: tab === t ? "#3a2209" : "#150b02",
                  color: tab === t ? "#f0d060" : "#5c4a28",
                  transition: "all 0.15s",
                }}
              >
                {t === "login" ? "⚔ Enter" : "✦ Join"}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {tab === "signup" && (
              <div>
                <label style={{ fontSize: 11, color: "#8b7040", fontFamily: "'Cinzel', serif", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                  Commander's Name
                </label>
                <input
                  style={inputStyle}
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name in the chronicles"
                  onFocus={e => e.target.style.borderColor = "#8b6914"}
                  onBlur={e => e.target.style.borderColor = "#5c3d11"}
                />
              </div>
            )}
            <div>
              <label style={{ fontSize: 11, color: "#8b7040", fontFamily: "'Cinzel', serif", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                Email
              </label>
              <input
                style={inputStyle}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                onFocus={e => e.target.style.borderColor = "#8b6914"}
                onBlur={e => e.target.style.borderColor = "#5c3d11"}
                onKeyDown={e => e.key === "Enter" && handleEmailAuth()}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#8b7040", fontFamily: "'Cinzel', serif", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                Password
              </label>
              <input
                style={inputStyle}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={tab === "signup" ? "At least 6 characters" : "••••••••"}
                onFocus={e => e.target.style.borderColor = "#8b6914"}
                onBlur={e => e.target.style.borderColor = "#5c3d11"}
                onKeyDown={e => e.key === "Enter" && handleEmailAuth()}
              />
            </div>

            {error && <div style={errStyle}>{error}</div>}

            <button
              style={{ ...btnPrimary, marginTop: 4, opacity: loading ? 0.6 : 1 }}
              onClick={handleEmailAuth}
              disabled={loading}
              onMouseOver={e => { if (!loading) { e.target.style.background = "linear-gradient(180deg, #5c3d11 0%, #3a2209 100%)"; e.target.style.boxShadow = "0 0 12px #c4952a22"; }}}
              onMouseOut={e => { e.target.style.background = "linear-gradient(180deg, #3a2209 0%, #2c1a06 100%)"; e.target.style.boxShadow = "none"; }}
            >
              {loading ? "…" : tab === "login" ? "⚔ Enter the Council" : "✦ Join the Council"}
            </button>

          </div>

          {/* Role note */}
          <p style={{
            marginTop: 16, fontSize: 11, color: "#3a2d18", textAlign: "center",
            lineHeight: 1.5, letterSpacing: "0.04em",
          }}>
            New accounts join as <em style={{ color: "#5c4a28" }}>Player</em>.<br />
            The Game Master promotes commanders via the Firebase console.
          </p>
        </div>

        {/* Bottom ornament bar */}
        <div style={{
          height: 4,
          background: "linear-gradient(90deg, transparent, #5c3d11, #8b6914, #5c3d11, transparent)",
        }} />
      </div>
    </div>
  );
}

// ── Map Firebase error codes to human-readable strings ───────────────────────
function friendlyError(code) {
  const map = {
    "auth/invalid-email":            "That email address isn't valid.",
    "auth/user-not-found":           "No account found with that email.",
    "auth/wrong-password":           "Incorrect password.",
    "auth/email-already-in-use":     "An account with that email already exists.",
    "auth/weak-password":            "Password must be at least 6 characters.",
    "auth/too-many-requests":        "Too many attempts. Please wait and try again.",
    "auth/network-request-failed":   "Network error — check your connection.",
  };
  return map[code] ?? `Authentication error (${code})`;
}