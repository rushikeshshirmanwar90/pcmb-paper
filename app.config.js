// Expo reads app.json first and passes it in here. The only thing added is the
// optional developer backend override: `npm run expo:local` (scripts/expo-local.mjs)
// sets TUITIONAPP_BACKEND=local for its own Expo process. A plain `expo start`
// leaves it unset, so nothing is added and the app uses the live server.
// `extra` is served in the manifest, not compiled into the JS bundle, so
// switching modes never leaves a stale bundle behind. See src/lib/backend-url.ts.
module.exports = ({ config }) => {
  // Never inherit a localBackend from app.json or a previous run.
  const { localBackend: _stale, ...extra } = config.extra ?? {};
  if (process.env.TUITIONAPP_BACKEND !== 'local') return { ...config, extra };
  return {
    ...config,
    extra: {
      ...extra,
      localBackend: {
        mode: 'local',
        emulatorUrl: process.env.TUITIONAPP_LOCAL_EMULATOR_URL,
        deviceUrl: process.env.TUITIONAPP_LOCAL_DEVICE_URL,
        loopbackUrl: process.env.TUITIONAPP_LOCAL_LOOPBACK_URL,
        target: process.env.TUITIONAPP_LOCAL_TARGET || undefined, // 'emulator' | 'device'
      },
    },
  };
};
