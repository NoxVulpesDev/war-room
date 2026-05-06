import { MERGE_THRESHOLD } from "./constants";

export function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Compute the objectFit:contain letterbox rect in a container of cW×cH for an image of iW×iH.
// Returns {x, y, w, h} in the container's own coordinate space.
export function getMapLayoutBounds(cW, cH, iW, iH) {
  const cAR = cW / cH;
  const iAR = iW / iH;
  if (iAR > cAR) {
    const h = cW / iAR;
    return { x: 0, y: (cH - h) / 2, w: cW, h };
  }
  const w = cH * iAR;
  return { x: (cW - w) / 2, y: 0, w, h: cH };
}

// Returns the map-content bounds in viewport coordinates (accounts for zoom/pan via CSS transform).
export function getMapScreenBounds(imgEl) {
  if (!imgEl?.naturalWidth) return null;
  const ir = imgEl.getBoundingClientRect();
  const b  = getMapLayoutBounds(ir.width, ir.height, imgEl.naturalWidth, imgEl.naturalHeight);
  return { left: ir.left + b.x, top: ir.top + b.y, width: b.w, height: b.h };
}

export function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// Find a token of the same faction within screenThreshold pixels of (clientX, clientY).
// Optionally exclude a token by id (e.g. the token being dragged).
export function findMergeTarget(tokens, mb, clientX, clientY, faction, screenThreshold, excludeId = null) {
  return tokens.find(t => {
    if (excludeId && t.id === excludeId) return false;
    if (t.faction !== faction) return false;
    return Math.hypot(t.x * mb.width + mb.left - clientX,
                      t.y * mb.height + mb.top  - clientY) < screenThreshold;
  });
}
