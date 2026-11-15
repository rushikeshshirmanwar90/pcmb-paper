// App configuration. The one place the server address lives: change LIVE_URL
// here to point the app at another server (no trailing slash, no /api).
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { chooseApiUrl, readLocalBackend } from '@/lib/backend-url';

const LIVE_URL = 'http://192.168.31.159:3000';

/**
 * The papers server the app talks to: the live one, unless a developer started
 * Expo with `npm run expo:local` (development builds only, never a release).
 */
export const API_URL = chooseApiUrl({
  live: LIVE_URL,
  dev: __DEV__,
  local: readLocalBackend(Constants.expoConfig?.extra),
  os: Platform.OS,
  isDevice: Device.isDevice,
});

/** The server's API routes. */
export const API_BASE_URL = `${API_URL}/api`;
