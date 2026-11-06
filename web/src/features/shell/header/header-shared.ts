/** Hooks and types shared by the header popovers. */

import { useEffect, useRef } from 'react';

/** Closes a popover on outside click or Escape. */
export function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return ref;
}

// -- Notification centre -----------------------------------------------------

export interface Alert {
  id: string;
  text: string;
  detail: string;
  tone: 'arrival' | 'upcoming';
}

// -- Help --------------------------------------------------------------------

// -- Profile -----------------------------------------------------------------

export interface WorkspaceToggles {
  available: boolean;
  soundOn: boolean;
  staffAccess: boolean;
  assistantDoctorAccess: boolean;
}
