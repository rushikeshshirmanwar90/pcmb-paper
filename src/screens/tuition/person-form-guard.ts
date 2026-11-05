import { useEffect, useRef } from 'react';
import { usePreventRemove } from 'expo-router';
import { confirmAction } from '@/components/account-section';

/** Covers header/system/gesture back; keep the form mounted while a save is in flight. */
export function usePersonFormGuard(dirty: boolean, saving: boolean) {
  const allowRef = useRef<() => void>(() => {});
  const leaving = useRef(false);
  const allowLeave = usePreventRemove(dirty || saving, ({ repeat }) => {
    if (leaving.current) { allowRef.current(); repeat(); return; }
    if (saving) return;
    confirmAction('Discard changes?', 'Your unsaved changes will be lost.', 'Discard', () => {
      allowRef.current();
      repeat();
    });
  });
  useEffect(() => { allowRef.current = allowLeave; });
  return () => { leaving.current = true; allowLeave(); };
}
