import { FACTIONS, NATIONS, TOKEN_RADIUS } from "../constants";

export default function TokenLayer({
  tokens, layoutBounds, pan, zoom,
  selected, mode,
  canMutateToken, userProfiles,
  tokenTouchRef,
  tokenLimitWarning, onForeignMap,
  dragPos,
  handleTokenMouseDown, handleTokenClick,
}) {
  if (!layoutBounds) return null;

  const mapScreenLeft = pan.x + layoutBounds.x * zoom;
  const mapScreenTop  = pan.y + layoutBounds.y * zoom;
  const mapScreenW    = layoutBounds.w * zoom;
  const mapScreenH    = layoutBounds.h * zoom;
  const vr            = TOKEN_RADIUS * zoom;

  return (
    <>
      {/* Token overlay — outside zoom transform for crisp rendering */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {tokens.map(token => {
          const locked      = !canMutateToken(token);
          const faction     = FACTIONS[token.faction] ?? FACTIONS.player;
          const nationStyle = token.faction === "player" && token.nation && NATIONS[token.nation]
            ? NATIONS[token.nation]
            : null;
          const tokenColor  = nationStyle ?? faction;
          const isDragging  = dragPos?.id === token.id;
          const screenX     = isDragging ? dragPos.screenX : mapScreenLeft + token.x * mapScreenW;
          const screenY     = isDragging ? dragPos.screenY : mapScreenTop  + token.y * mapScreenH;
          return (
            <div
              key={token.id}
              onMouseDown={(e) => { handleTokenMouseDown(e, token.id); }}
              onClick={(e) => { e.stopPropagation(); handleTokenClick(token.id); }}
              onTouchStart={(e) => {
                if (mode === "move" && !locked) {
                  e.stopPropagation();
                  tokenTouchRef.current = { id: token.id };
                }
              }}
              title={token.notes?.join(" | ") || `${token.faction === "player" && token.ownerId && userProfiles[token.ownerId] ? userProfiles[token.ownerId]?.displayName ?? faction.label : faction.label}${token.nation ? ` (${NATIONS[token.nation]?.label ?? token.nation})` : ""}${locked ? " — not yours" : ""}`}
              className={locked ? "token-locked" : ""}
              style={{
                position: "absolute",
                left: screenX - vr,
                top:  screenY - vr,
                width:  vr * 2,
                height: vr * 2,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 35%, ${tokenColor.border}33, ${tokenColor.color})`,
                border: `${2.5 * zoom}px solid ${selected === token.id ? "#f0d060" : tokenColor.border}`,
                boxShadow: selected === token.id
                  ? `0 0 0 ${3 * zoom}px #f0d06066, 0 ${2 * zoom}px ${12 * zoom}px #0008`
                  : `0 ${2 * zoom}px ${8 * zoom}px #0006`,
                display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
                cursor: locked ? "not-allowed"
                  : isDragging ? "grabbing"
                  : mode === "move" ? "grab"
                  : mode === "delete" ? "not-allowed"
                  : "pointer",
                userSelect: "none",
                pointerEvents: "all",
                zIndex: isDragging ? 30 : selected === token.id ? 20 : 10,
                transition: isDragging ? "none" : "box-shadow 0.15s, border-color 0.15s",
                fontFamily: "'Cinzel', serif",
              }}
            >
              <span style={{ fontSize: (token.count > 1 ? 9 : 12) * zoom, lineHeight: 1 }}>{faction.icon}</span>
              {token.count > 1 && (
                <span style={{ fontSize: 7 * zoom, fontWeight: 700, color: "#f5e8c0", lineHeight: 1 }}>×{token.count}</span>
              )}
              {token.notes?.length > 0 && (
                <span style={{
                  position: "absolute", top: -4 * zoom, right: -4 * zoom,
                  width: 10 * zoom, height: 10 * zoom, borderRadius: "50%",
                  background: "#c4952a", border: `${zoom}px solid #1a0e05`,
                }} />
              )}
              {token.locked && token.members?.length > 1 && (
                <span style={{
                  position: "absolute", top: -4 * zoom, left: -4 * zoom,
                  width: 10 * zoom, height: 10 * zoom, borderRadius: "50%",
                  background: "#5c3d11", border: `${zoom}px solid #1a0e05`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 6 * zoom, lineHeight: 1, color: "#c4952a",
                }}>⚿</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Token limit warning */}
      {tokenLimitWarning && (
        <div style={{
          position: "absolute", bottom: 52, left: "50%", transform: "translateX(-50%)",
          background: "#2d0a0add", border: "1px solid #8b1a1a", borderRadius: 4,
          padding: "7px 18px", pointerEvents: "none", zIndex: 40,
          fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: "0.09em",
          textTransform: "uppercase", color: "#e05050", whiteSpace: "nowrap",
        }}>
          Unit limit reached — no more can be placed on this map
        </div>
      )}

      {/* Foreign territory banner */}
      {onForeignMap && (
        <div style={{
          position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
          background: "#1a0e05dd", border: "1px solid #5c3d11", borderRadius: 4,
          padding: "7px 18px", pointerEvents: "none", zIndex: 40,
          fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: "0.09em",
          textTransform: "uppercase", color: "#8b7040", whiteSpace: "nowrap",
        }}>
          Foreign territory — tokens cannot be placed here
        </div>
      )}
    </>
  );
}
