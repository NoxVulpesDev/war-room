import { TOKEN_RADIUS } from "../constants";

const ARROW_COLOR = {
  player:    "#a8d5b5",
  enemy:     "#cccccc",
  contested: "#e8a0d2",
};

export default function MovementArrows({ prevSnapshot, currSnapshot, layoutBounds, pan, zoom }) {
  if (!layoutBounds || !prevSnapshot || !currSnapshot) return null;

  const mapLeft = pan.x + layoutBounds.x * zoom;
  const mapTop  = pan.y + layoutBounds.y * zoom;
  const mapW    = layoutBounds.w * zoom;
  const mapH    = layoutBounds.h * zoom;
  const r       = TOKEN_RADIUS * zoom;

  const arrows = [];
  Object.entries(currSnapshot).forEach(([id, curr]) => {
    const prev = prevSnapshot[id];
    if (!prev) return;
    if (prev.x === curr.x && prev.y === curr.y) return;

    const x1raw = mapLeft + prev.x * mapW;
    const y1raw = mapTop  + prev.y * mapH;
    const x2raw = mapLeft + curr.x * mapW;
    const y2raw = mapTop  + curr.y * mapH;

    const dx  = x2raw - x1raw;
    const dy  = y2raw - y1raw;
    const len = Math.hypot(dx, dy);
    if (len < r * 2.5) return;

    const startRatio = r / len;
    const endRatio   = (len - r) / len;

    arrows.push({
      id,
      x1: x1raw + dx * startRatio,
      y1: y1raw + dy * startRatio,
      x2: x1raw + dx * endRatio,
      y2: y1raw + dy * endRatio,
      faction: curr.faction ?? "player",
    });
  });

  if (!arrows.length) return null;

  const factions = [...new Set(arrows.map(a => a.faction))];
  const strokeW  = Math.max(3, 3 * zoom);

  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="mv-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.9" />
        </filter>

        {factions.map(f => {
          const color = ARROW_COLOR[f] ?? ARROW_COLOR.player;
          return (
            <marker key={f} id={`mv-arrow-${f}`} viewBox="0 0 10 6" refX="9" refY="3"
              markerWidth="6" markerHeight="5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L10,3 L0,6 Z" fill={color} />
            </marker>
          );
        })}
      </defs>

      <g filter="url(#mv-shadow)">
        {arrows.map(({ id, x1, y1, x2, y2, faction }) => {
          const color = ARROW_COLOR[faction] ?? ARROW_COLOR.player;
          return (
            <line key={id} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color} strokeWidth={strokeW}
              strokeLinecap="round" markerEnd={`url(#mv-arrow-${faction})`} />
          );
        })}
      </g>
    </svg>
  );
}
