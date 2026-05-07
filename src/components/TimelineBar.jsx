import { useMemo } from "react";

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diffMins = Math.floor((Date.now() - d) / 60000);
  if (diffMins < 1)   return "just now";
  if (diffMins < 60)  return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TimelineBar({ entries, viewingIndex, setViewingIndex, loading, onClose }) {
  const entry    = entries[viewingIndex];
  const timeLabel = useMemo(() => entry ? formatTimestamp(entry.timestamp) : "", [entry]);

  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0, height: 48,
      background: "rgba(12, 6, 1, 0.94)", borderTop: "1px solid #3a2209",
      display: "flex", alignItems: "center", gap: 8, padding: "0 12px",
      zIndex: 20, backdropFilter: "blur(4px)",
    }}>
      {loading ? (
        <span style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: "#8b7040", letterSpacing: "0.08em" }}>
          Consulting the chronicles…
        </span>
      ) : !entries.length ? (
        <span style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: "#8b7040", letterSpacing: "0.08em" }}>
          No history recorded yet.
        </span>
      ) : (
        <>
          <button
            className="toolbar-btn"
            onClick={() => setViewingIndex(i => Math.max(0, i - 1))}
            disabled={viewingIndex <= 0}
            style={{ flexShrink: 0, padding: "5px 10px", opacity: viewingIndex <= 0 ? 0.35 : 1 }}
          >‹</button>

          <input
            type="range"
            min={0}
            max={entries.length - 1}
            value={viewingIndex ?? 0}
            onChange={e => setViewingIndex(Number(e.target.value))}
            style={{ flex: 1, minWidth: 60, accentColor: "#c4952a", cursor: "pointer" }}
          />

          <button
            className="toolbar-btn"
            onClick={() => setViewingIndex(i => Math.min(entries.length - 1, i + 1))}
            disabled={viewingIndex >= entries.length - 1}
            style={{ flexShrink: 0, padding: "5px 10px", opacity: viewingIndex >= entries.length - 1 ? 0.35 : 1 }}
          >›</button>

          {entry && (
            <span style={{
              flexShrink: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontFamily: "'Crimson Text', serif", fontSize: 13, color: "#c4952a",
            }}>
              {entry.actorName && (
                <span style={{ color: "#8b7040" }}>{entry.actorName} · </span>
              )}
              {entry.description}
              {timeLabel && (
                <span style={{ color: "#5c4a28", marginLeft: 8 }}>{timeLabel}</span>
              )}
            </span>
          )}

          <span style={{
            flexShrink: 0, fontFamily: "'Cinzel', serif", fontSize: 10,
            color: "#5c4a28", whiteSpace: "nowrap", letterSpacing: "0.04em",
          }}>
            {(viewingIndex ?? 0) + 1} / {entries.length}
          </span>
        </>
      )}

      <button className="toolbar-btn active" onClick={onClose} style={{ flexShrink: 0, marginLeft: "auto" }}>
        ⟳ Live
      </button>
    </div>
  );
}
