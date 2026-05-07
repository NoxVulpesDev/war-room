import { useState, useRef, useCallback, useEffect } from "react";
import { getMapScreenBounds, findMergeTarget } from "../utils";
import { MERGE_THRESHOLD } from "../constants";

export function useMapZoomPan({ mode, authReady, mapImgRef, setTokens, setTokensAndSave }) {
  const [zoom,          setZoom]          = useState(1);
  const [pan,           setPan]           = useState({ x: 0, y: 0 });
  const [isGrabbing,    setIsGrabbing]    = useState(false);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const canvasRef      = useRef(null);
  const zoomRef        = useRef(1);
  const panRef         = useRef({ x: 0, y: 0 });
  const dragPanRef     = useRef(null);
  const touchRef       = useRef(null);
  const tokenTouchRef  = useRef(null);

  // Canvas resize observer
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setContainerSize({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, [authReady]);

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const factor  = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = Math.min(Math.max(zoomRef.current * factor, 0.1), 10);
    const scale   = newZoom / zoomRef.current;
    const newPan  = {
      x: mx - (mx - panRef.current.x) * scale,
      y: my - (my - panRef.current.y) * scale,
    };
    zoomRef.current = newZoom;
    panRef.current  = newPan;
    setZoom(newZoom);
    setPan(newPan);
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel, authReady]);

  // Mouse pan
  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && mode === "pan")) {
      e.preventDefault();
      dragPanRef.current = {
        mouseX: e.clientX, mouseY: e.clientY,
        panX: panRef.current.x, panY: panRef.current.y,
      };
      setIsGrabbing(true);
    }
  }, [mode]);

  const handleMouseMove = useCallback((e) => {
    if (!dragPanRef.current) return;
    const newPan = {
      x: dragPanRef.current.panX + (e.clientX - dragPanRef.current.mouseX),
      y: dragPanRef.current.panY + (e.clientY - dragPanRef.current.mouseY),
    };
    panRef.current = newPan;
    setPan(newPan);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (dragPanRef.current) { dragPanRef.current = null; setIsGrabbing(false); }
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup",   handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup",   handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Touch: pinch zoom, single-finger pan, and token drag
  const handleCanvasTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      dragPanRef.current = null;
      setIsGrabbing(false);
      const t1 = e.touches[0], t2 = e.touches[1];
      const rect = canvasRef.current.getBoundingClientRect();
      touchRef.current = {
        type: "pinch",
        startDist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
        startZoom: zoomRef.current,
        startPanX: panRef.current.x, startPanY: panRef.current.y,
        originX: (t1.clientX + t2.clientX) / 2 - rect.left,
        originY: (t1.clientY + t2.clientY) / 2 - rect.top,
      };
    } else if (e.touches.length === 1 && !tokenTouchRef.current) {
      const touch = e.touches[0];
      touchRef.current = { type: "single", startX: touch.clientX, startY: touch.clientY, moved: false };
      if (mode === "pan") {
        dragPanRef.current = { mouseX: touch.clientX, mouseY: touch.clientY, panX: panRef.current.x, panY: panRef.current.y };
        setIsGrabbing(true);
      }
    }
  }, [mode]);

  useEffect(() => {
    const onTouchMove = (e) => {
      if (tokenTouchRef.current) {
        e.preventDefault();
        const touch = e.touches[0];
        const mb = getMapScreenBounds(mapImgRef.current);
        if (!mb) return;
        const x = (touch.clientX - mb.left) / mb.width;
        const y = (touch.clientY - mb.top)  / mb.height;
        setTokens(prev => prev.map(t => t.id === tokenTouchRef.current.id ? { ...t, x, y } : t));
      } else if (touchRef.current?.type === "pinch" && e.touches.length === 2) {
        const t1 = e.touches[0], t2 = e.touches[1];
        const { startDist, startZoom, startPanX, startPanY, originX, originY } = touchRef.current;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const pinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const midX      = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY      = (t1.clientY + t2.clientY) / 2 - rect.top;
        const newZoom   = Math.min(Math.max(startZoom * (pinchDist / startDist), 0.1), 10);
        const zoomScale = newZoom / startZoom;
        const newPan    = {
          x: midX - (originX - startPanX) * zoomScale,
          y: midY - (originY - startPanY) * zoomScale,
        };
        zoomRef.current = newZoom; panRef.current = newPan;
        setZoom(newZoom); setPan(newPan);
      } else if (touchRef.current?.type === "single" && e.touches.length === 1) {
        const touch = e.touches[0];
        const dx    = touch.clientX - touchRef.current.startX;
        const dy    = touch.clientY - touchRef.current.startY;
        if (!touchRef.current.moved && Math.hypot(dx, dy) > 8) {
          touchRef.current.moved = true;
          dragPanRef.current = {
            mouseX: touchRef.current.startX, mouseY: touchRef.current.startY,
            panX: panRef.current.x, panY: panRef.current.y,
          };
          setIsGrabbing(true);
        }
        if (dragPanRef.current) {
          const newPan = { x: dragPanRef.current.panX + dx, y: dragPanRef.current.panY + dy };
          panRef.current = newPan; setPan(newPan);
        }
      }
    };

    const onTouchEnd = (e) => {
      if (tokenTouchRef.current) {
        const touch = e.changedTouches[0];
        const mb = getMapScreenBounds(mapImgRef.current);
        if (mb) {
          const x = (touch.clientX - mb.left) / mb.width;
          const y = (touch.clientY - mb.top)  / mb.height;
          const draggedId       = tokenTouchRef.current.id;
          const screenThreshold = MERGE_THRESHOLD * zoomRef.current;
          setTokensAndSave(prev => {
            const dragged = prev.find(t => t.id === draggedId);
            if (!dragged) return prev;
            const mergeTarget = findMergeTarget(prev, mb, touch.clientX, touch.clientY, dragged.faction, screenThreshold, draggedId);
            if (mergeTarget) {
              return prev
                .filter(t => t.id !== draggedId)
                .map(t => t.id === mergeTarget.id
                  ? { ...t, count: t.count + dragged.count, notes: [...t.notes, ...dragged.notes] }
                  : t
                );
            }
            return prev.map(t => t.id === draggedId ? { ...t, x, y } : t);
          }, { actionType: "move", description: "Moved troops" });
        }
        tokenTouchRef.current = null;
      }
      dragPanRef.current = null; setIsGrabbing(false); touchRef.current = null;
    };

    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend",  onTouchEnd);
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend",  onTouchEnd);
    };
  }, [setTokensAndSave, mapImgRef, setTokens]);

  // Zoom button controls
  const adjustZoom = useCallback((factor) => {
    const rect    = canvasRef.current.getBoundingClientRect();
    const newZoom = Math.min(Math.max(zoomRef.current * factor, 0.1), 10);
    const scale   = newZoom / zoomRef.current;
    const newPan  = {
      x: rect.width  / 2 - (rect.width  / 2 - panRef.current.x) * scale,
      y: rect.height / 2 - (rect.height / 2 - panRef.current.y) * scale,
    };
    zoomRef.current = newZoom; panRef.current = newPan;
    setZoom(newZoom); setPan(newPan);
  }, []);

  const resetView = useCallback(() => {
    panRef.current  = { x: 0, y: 0 };
    zoomRef.current = 1;
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const canvasCursor = isGrabbing ? "grabbing"
    : mode === "pan"    ? "grab"
    : mode === "place"  ? "crosshair"
    : mode === "delete" ? "not-allowed"
    : "default";

  return {
    zoom, pan, isGrabbing, canvasCursor, containerSize,
    canvasRef, tokenTouchRef,
    zoomRef,    // needed for screen-space threshold in canvas click/drop handlers
    dragPanRef, // needed for pan-in-progress check in handleCanvasClick
    handleMouseDown, handleCanvasTouchStart,
    adjustZoom, resetView,
  };
}
