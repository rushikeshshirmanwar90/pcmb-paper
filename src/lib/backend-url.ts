// Which server a development build talks to. Pure, so tests can run it.
// `npm run expo:local` serves a `localBackend` entry in the Expo manifest
// (app.config.js); without one, or outside development, the live server is used.

export interface LocalBackend {
  mode: 'local';
  emulatorUrl?: string;
  deviceUrl?: string;
  loopbackUrl?: string;
  /** Forces the emulator or phone URL when detection is wrong. */
  target?: 'emulator' | 'device';
}

/** Reads `extra.localBackend`, ignoring anything that is not an explicit local selection. */
export function readLocalBackend(extra: unknown): LocalBackend | null {
  const value = (extra as { localBackend?: Partial<LocalBackend> } | null | undefined)?.localBackend;
  return value && value.mode === 'local' ? (value as LocalBackend) : null;
}

const http = (url: string | undefined) => (url && /^https?:\/\/\S+$/.test(url) ? url.replace(/\/+$/, '') : undefined);

export function chooseApiUrl({
  live,
  dev,
  local,
  os,
  isDevice,
}: {
  live: string;
  dev: boolean;
  local: LocalBackend | null;
  os: string;
  isDevice: boolean;
}): string {
  if (!dev || !local) return live;
  const asEmulator = local.target === 'emulator' || (local.target !== 'device' && !isDevice);
  const url =
    os === 'android'
      ? asEmulator ? local.emulatorUrl : local.deviceUrl
      : asEmulator || os === 'web' ? local.loopbackUrl : local.deviceUrl;
  return http(url) ?? live;
}
