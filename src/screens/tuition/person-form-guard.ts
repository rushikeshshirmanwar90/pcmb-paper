import { useEffect, useRef, useState } from 'react';
import { usePreventRemove } from 'expo-router';
import { confirmAction } from '@/components/account-section';

/** Covers header/system/gesture back; keep the form mounted while a save is in flight. */
export function usePersonFormGuard(dirty: boolean, saving: boolean) {
  const allowRef = useRef<() => void>(() => {});
  const leaving = useRef(false);
  // Mirrors the hook's internal state once prevention is disabled, so `preventRemove` stays in sync with it.
  const [released, setReleased] = useState(false);
  const protectedNow = dirty || saving;
  // A change in the protected state arms the guard again.
  const [seenProtected, setSeenProtected] = useState(protectedNow);
  if (seenProtected !== protectedNow) {
    setSeenProtected(protectedNow);
    setReleased(false);
  }
  const allowLeave = usePreventRemove(protectedNow && !released, ({ repeat }) => {
    if (leaving.current) { allowRef.current(); repeat(); return; }
    if (saving) return;
    confirmAction('Discard changes?', 'Your unsaved changes will be lost.', 'Discard', () => {
      allowRef.current();
      repeat();
    });
  });
  useEffect(() => {
    allowRef.current = () => { setReleased(true); allowLeave(); };
  });
  return () => { leaving.current = true; allowRef.current(); };
}
