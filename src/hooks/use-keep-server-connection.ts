import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { pingServer } from '@/services/apiService';

const EVERY_MS = 5000;

/**
 * While `active`, keeps the connection to the server from going idle, so the
 * request a screen is about to make doesn't land on a dropped connection (see
 * pingServer). iOS only: it reaches the server over HTTP/3, which is what goes
 * stale; Android's networking uses HTTP/2 over TCP.
 */
export function useKeepServerConnection(active: boolean) {
  useEffect(() => {
    if (!active || Platform.OS !== 'ios') return;
    // Right away too: if the connection is already dead, iOS replaces it
    // sooner, well before the teacher finishes the form.
    pingServer();
    const id = setInterval(() => {
      if (AppState.currentState === 'active') pingServer();
    }, EVERY_MS);
    return () => clearInterval(id);
  }, [active]);
}
