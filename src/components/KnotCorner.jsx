export default function KnotCorner({ x = 0, y = 0 }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path d="M0,0 Q8,0 8,8 Q8,16 16,16 Q24,16 24,24 Q24,32 32,32 Q40,32 40,40 L48,40 L48,48 L0,48 Z"
        fill="#2c1a06" stroke="#8b6914" strokeWidth="1" opacity="0.85" />
      <path d="M4,4 Q10,4 10,10 Q10,18 18,18 Q26,18 26,26 Q26,34 34,34 L42,34 L42,44 L4,44 Z"
        fill="none" stroke="#c4952a" strokeWidth="0.5" />
      <circle cx="8"  cy="8"  r="3" fill="#8b6914" />
      <circle cx="24" cy="24" r="3" fill="#8b6914" />
      <circle cx="40" cy="40" r="3" fill="#8b6914" />
    </g>
  );
}
