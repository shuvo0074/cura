import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** Pointer travel (px) before a press becomes a drag; anything less is a click. */
const DRAG_THRESHOLD = 5;

export interface AppointmentDrag {
  id: string;
  /** Drop target under the pointer, as the grid's own key; null when none. */
  target: string | null;
}

/**
 * Drag-to-reschedule on pointer events rather than HTML5 drag and drop.
 *
 * Native DnD is the fragile option here: it does nothing on touch screens,
 * embedded browser views (an editor's preview pane) can swallow it, and
 * browsers differ on draggable buttons. Pointer events behave the same
 * everywhere a mouse, pen or finger can press a card.
 *
 * `resolve` maps a viewport point to the grid's drop key (or null); `onDrop`
 * receives the card's id and the key under the pointer at release.
 */
export function useAppointmentDrag(
  resolve: (x: number, y: number) => string | null,
  onDrop: ((id: string, target: string) => void) | undefined,
) {
  const [drag, setDrag] = useState<AppointmentDrag | null>(null);
  const resolveRef = useRef(resolve);
  const dropRef = useRef(onDrop);
  resolveRef.current = resolve;
  dropRef.current = onDrop;
  const cleanup = useRef<(() => void) | null>(null);

  // Unmounting mid-drag (view switch, sign-out) must not strand listeners.
  useEffect(() => () => cleanup.current?.(), []);

  const start = useCallback((id: string, e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !dropRef.current) return;
    const card = e.currentTarget;
    const originX = e.clientX;
    const originY = e.clientY;
    let ghost: HTMLElement | null = null;
    let offsetX = 0;
    let offsetY = 0;
    let target: string | null = null;
    let announced = false;

    const move = (ev: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - originX, ev.clientY - originY) < DRAG_THRESHOLD) return;
        // A copy of the card follows the pointer; it is moved directly, not
        // through React, so a drag costs a render only when the target changes.
        const box = card.getBoundingClientRect();
        offsetX = originX - box.left;
        offsetY = originY - box.top;
        ghost = card.cloneNode(true) as HTMLElement;
        Object.assign(ghost.style, {
          position: 'fixed',
          left: '0',
          top: '0',
          width: `${box.width}px`,
          height: `${box.height}px`,
          margin: '0',
          zIndex: '1000',
          pointerEvents: 'none',
          opacity: '0.9',
        });
        ghost.removeAttribute('id');
        ghost.setAttribute('aria-hidden', 'true');
        document.body.append(ghost);
        document.body.dataset.appointmentDrag = '';
      }
      ev.preventDefault();
      ghost.style.transform = `translate(${ev.clientX - offsetX}px, ${ev.clientY - offsetY}px)`;
      const next = resolveRef.current(ev.clientX, ev.clientY);
      if (next !== target || !announced) {
        announced = true;
        target = next;
        setDrag({ id, target });
      }
    };

    const finish = (commit: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', abandon);
      window.removeEventListener('keydown', escape);
      cleanup.current = null;
      if (!ghost) return;
      ghost.remove();
      delete document.body.dataset.appointmentDrag;
      setDrag(null);
      // The release would otherwise click whatever is under it — booking that
      // slot or opening that day.
      const swallow = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
      if (commit && target !== null) dropRef.current?.(id, target);
    };
    const release = () => finish(true);
    const abandon = () => finish(false);
    const escape = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') finish(false);
    };

    cleanup.current?.();
    cleanup.current = abandon;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', abandon);
    window.addEventListener('keydown', escape);
  }, []);

  return { drag, start };
}
