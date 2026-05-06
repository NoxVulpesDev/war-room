// ─────────────────────────────────────────────────────────────────────────────
// AuthModal.jsx  —  Celtic-parchment login / sign-up modal
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
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
  const [view, setView] = useState("auth");  // "auth" | "reset" | "resetSent"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [nation, setNation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const finish = async (firebaseUser, characterName, chosenNation) => {
    const profile = await getOrCreateUserProfile(firebaseUser, characterName, chosenNation);
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
        if (!nation) { setError("Choose your nation."); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: displayName.trim() });
        await finish(cred.user, displayName.trim(), nation);
      }
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setError("");
    if (!email) { setError("Enter your email address first."); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setView("resetSent");
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

          {/* Password reset — sent confirmation */}
          {view === "resetSent" && (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 22, margin: "0 0 10px" }}>✉</p>
              <p style={{ color: "#e8d5a3", fontSize: 14, lineHeight: 1.6, margin: "0 0 16px" }}>
                A password reset scroll has been dispatched to <em style={{ color: "#f0d060" }}>{email}</em>.<br />
                Check your inbox and follow the link within.
              </p>
              <button
                style={{ ...btnPrimary, width: "auto", padding: "7px 20px" }}
                onClick={() => { setView("auth"); setError(""); }}
                onMouseOver={e => { e.target.style.background = "linear-gradient(180deg, #5c3d11 0%, #3a2209 100%)"; }}
                onMouseOut={e => { e.target.style.background = "linear-gradient(180deg, #3a2209 0%, #2c1a06 100%)"; }}
              >
                ← Back to Login
              </button>
            </div>
          )}

          {/* Password reset — email entry */}
          {view === "reset" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, color: "#8b7040", lineHeight: 1.5 }}>
                Enter your email and we'll send a link to reclaim your access.
              </p>
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
                  onKeyDown={e => e.key === "Enter" && handlePasswordReset()}
                  autoFocus
                />
              </div>
              {error && <div style={errStyle}>{error}</div>}
              <button
                style={{ ...btnPrimary, marginTop: 4, opacity: loading ? 0.6 : 1 }}
                onClick={handlePasswordReset}
                disabled={loading}
                onMouseOver={e => { if (!loading) { e.target.style.background = "linear-gradient(180deg, #5c3d11 0%, #3a2209 100%)"; e.target.style.boxShadow = "0 0 12px #c4952a22"; }}}
                onMouseOut={e => { e.target.style.background = "linear-gradient(180deg, #3a2209 0%, #2c1a06 100%)"; e.target.style.boxShadow = "none"; }}
              >
                {loading ? "…" : "✉ Send Reset Link"}
              </button>
              <button
                style={{ background: "none", border: "none", color: "#5c4a28", fontSize: 12, cursor: "pointer", textDecoration: "underline", fontFamily: "'Crimson Text', serif", padding: 0, marginTop: 2 }}
                onClick={() => { setView("auth"); setError(""); }}
              >
                ← Back to login
              </button>
            </div>
          )}

          {/* Tab switcher + login/signup fields */}
          {view === "auth" && (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
                {["login", "signup"].map(t => (
                  <button key={t}
                    onClick={() => { setTab(t); setError(""); setNation(""); }}
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

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tab === "signup" && (
                  <>
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
                    <div>
                      <label style={{ fontSize: 11, color: "#8b7040", fontFamily: "'Cinzel', serif", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                        Nation
                      </label>
                      <select
                        style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}
                        value={nation}
                        onChange={e => setNation(e.target.value)}
                        onFocus={e => e.target.style.borderColor = "#8b6914"}
                        onBlur={e => e.target.style.borderColor = "#5c3d11"}
                      >
                        <option value="">— Choose your nation —</option>
                        <option value="erin">🟢 Erin</option>
                        <option value="manx">🔴 Manx</option>
                        <option value="caledonia">🔵 Caledonia</option>
                        <option value="cymria">🟡 Cymria</option>
                      </select>
                    </div>
                  </>
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

                {tab === "login" && (
                  <button
                    style={{ background: "none", border: "none", color: "#5c4a28", fontSize: 12, cursor: "pointer", textDecoration: "underline", fontFamily: "'Crimson Text', serif", padding: 0, textAlign: "right" }}
                    onClick={() => { setView("reset"); setError(""); }}
                  >
                    Forgot your password?
                  </button>
                )}

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
            </>
          )}

          {/* Role note */}
          <p style={{
            marginTop: 16, fontSize: 11, color: "#3a2d18", textAlign: "center",
            lineHeight: 1.5, letterSpacing: "0.04em",
          }}>
            New accounts join as <em style={{ color: "#5c4a28" }}>Commander</em>.<br />
            Commanders may only place tokens on their own nation's map.<br />
            The Game Master may promote commanders to Monarch via the admin panel.
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
    "auth/invalid-action-code":      "This reset link has expired or already been used.",
  };
  return map[code] ?? `Authentication error (${code})`;
}