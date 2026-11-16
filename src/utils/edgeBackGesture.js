export function isEdgeBackSwipe({ startX, startY, endX, endY, viewportWidth, edgeSize = 32, minimumSwipe = 64, maxVerticalDrift = 80 }) {
  if (![startX, startY, endX, endY, viewportWidth].every(Number.isFinite) || viewportWidth <= 0) return false;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  if (Math.abs(deltaY) > maxVerticalDrift) return false;
  const fromLeft = startX <= edgeSize;
  const fromRight = startX >= viewportWidth - edgeSize;
  return (fromLeft && deltaX >= minimumSwipe) || (fromRight && deltaX <= -minimumSwipe);
}

const INTERACTIVE_TARGETS = 'button, a, input, textarea, select, [contenteditable="true"], [role="button"]';

export function installEdgeBackGesture(targetWindow, { enabled = true, onBack }) {
  if (!enabled || typeof onBack !== 'function') return () => {};
  let start = null;

  const onPointerDown = (event) => {
    if (event.pointerType !== 'touch' || event.isPrimary === false) return;
    if (event.target?.closest?.(INTERACTIVE_TARGETS)) return;
    const edgeSize = 32;
    const fromLeft = event.clientX <= edgeSize;
    const fromRight = event.clientX >= targetWindow.innerWidth - edgeSize;
    if (!fromLeft && !fromRight) return;
    start = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  };

  const onPointerUp = (event) => {
    if (!start || event.pointerId !== start.pointerId) return;
    const valid = isEdgeBackSwipe({
      startX: start.x, startY: start.y,
      endX: event.clientX, endY: event.clientY,
      viewportWidth: targetWindow.innerWidth,
    });
    start = null;
    if (valid) onBack();
  };

  const clear = () => { start = null; };
  targetWindow.addEventListener('pointerdown', onPointerDown, { passive: true });
  targetWindow.addEventListener('pointerup', onPointerUp, { passive: true });
  targetWindow.addEventListener('pointercancel', clear, { passive: true });
  targetWindow.addEventListener('blur', clear);
  return () => {
    targetWindow.removeEventListener('pointerdown', onPointerDown);
    targetWindow.removeEventListener('pointerup', onPointerUp);
    targetWindow.removeEventListener('pointercancel', clear);
    targetWindow.removeEventListener('blur', clear);
    clear();
  };
}
