// App configuration. The one place the server address lives: change API_URL
// here to point the app at another server (no trailing slash, no /api).

/**
 * For local testing only: set EXPO_PUBLIC_API_URL in the shell that starts Expo
 * (e.g. http://10.0.2.2:3000 from the Android emulator). Never put it in a file;
 * unset, or not an http(s) address, the app uses the live server.
 */
const LOCAL_OVERRIDE = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');

/** The papers server the app talks to. */
export const API_URL = /^https?:\/\/\S+$/.test(LOCAL_OVERRIDE) ? LOCAL_OVERRIDE : 'https://papers-jet.vercel.app';

/** The server's API routes. */
export const API_BASE_URL = `${API_URL}/api`;
