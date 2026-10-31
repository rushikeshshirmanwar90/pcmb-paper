// Which server the app talks to. Kept free of React Native imports so it can
// be tested on its own (tests/api-origin.test.mjs).
//
// Release builds always use the live server. Development defaults to local,
// unless EXPO_PUBLIC_API_URL specifies an address:
//   EXPO_PUBLIC_API_URL=http://192.168.1.20:3000   a server at that address
//   EXPO_PUBLIC_API_URL=local                       this computer, as the phone sees it:
//                                                   the address Metro was opened on, port 3000
//   EXPO_PUBLIC_API_URL=local:4000                  the same, another port
// For `local`, a phone on the same Wi-Fi uses the computer's network address;
// the Android emulator, which can't reach "localhost", uses 10.0.2.2; the iOS
// simulator uses localhost.

export const PRODUCTION_API_ORIGIN = 'https://papers-jet.vercel.app';
export const DEFAULT_LOCAL_PORT = 3000;

export interface OriginInput {
  /** __DEV__: a development build or Expo Go. */
  dev: boolean;
  /** process.env.EXPO_PUBLIC_API_URL */
  configured?: string | null;
  /** Where Metro is, e.g. "192.168.1.20:8081" (Constants.expoConfig.hostUri). */
  hostUri?: string | null;
  platform: 'android' | 'ios' | 'web' | string;
}

const clean = (url: string) => url.trim().replace(/\/+$/, '').replace(/\/api$/, '');
const LOOPBACK = /^(localhost|127\.0\.0\.1)$/;

/** The server origin (no trailing /api), and why it was chosen. */
export function resolveApiOrigin({ dev, configured, hostUri, platform }: OriginInput): { origin: string; source: 'production' | 'configured' | 'local' } {
  if (!dev) return { origin: PRODUCTION_API_ORIGIN, source: 'production' };
  const value = configured?.trim() || 'local';

  const local = /^local(?::(\d{2,5}))?$/i.exec(value);
  if (local) {
    const port = Number(local[1] ?? DEFAULT_LOCAL_PORT);
    let host = (hostUri ?? '').replace(/^[a-z]+:\/\//i, '').split('/')[0].replace(/:\d+$/, '') || 'localhost';
    // The Android emulator reaches this computer at 10.0.2.2, not at its own localhost.
    if (platform === 'android' && LOOPBACK.test(host)) host = '10.0.2.2';
    return { origin: `http://${host}:${port}`, source: 'local' };
  }
  if (/^https?:\/\/[^\s/]+/i.test(value)) return { origin: clean(value), source: 'configured' };
  return resolveApiOrigin({ dev, configured: 'local', hostUri, platform });
}
