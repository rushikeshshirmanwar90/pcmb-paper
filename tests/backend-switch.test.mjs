// Backend selection: Vercel by default, Local only when `npm run expo:local` asks.
//   node --experimental-strip-types --test tests/backend-switch.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, test } from 'node:test';
import { chooseApiUrl, readLocalBackend } from '../src/lib/backend-url.ts';

const LIVE = 'https://papers-jet.vercel.app';
const appConfig = createRequire(import.meta.url)('../app.config.js');
const base = { name: 'x', extra: { router: {}, eas: { projectId: 'p' } } };
const local = {
  mode: 'local',
  emulatorUrl: 'http://10.0.2.2:3000',
  deviceUrl: 'http://192.168.1.20:3000',
  loopbackUrl: 'http://localhost:3000',
};
const pick = (o) => chooseApiUrl({ live: LIVE, dev: true, local, os: 'android', isDevice: false, ...o });

const tuitionKeys = () => Object.keys(process.env).filter((k) => k.startsWith('TUITIONAPP_'));
function withEnv(env, run) {
  const saved = Object.fromEntries(tuitionKeys().map((k) => [k, process.env[k]]));
  tuitionKeys().forEach((k) => delete process.env[k]);
  Object.assign(process.env, env);
  try {
    return run();
  } finally {
    tuitionKeys().forEach((k) => delete process.env[k]);
    Object.assign(process.env, saved);
  }
}

describe('app.config.js', () => {
  test('default: no localBackend, rest of the config preserved', () => {
    const out = withEnv({}, () => appConfig({ config: base }));
    assert.equal(out.extra.localBackend, undefined);
    assert.deepEqual(out.extra.eas, base.extra.eas);
    assert.equal(out.name, 'x');
  });
  test('a stale localBackend in the base config is dropped by default', () => {
    const out = withEnv({}, () => appConfig({ config: { ...base, extra: { ...base.extra, localBackend: local } } }));
    assert.equal(out.extra.localBackend, undefined);
  });
  test('any other TUITIONAPP_BACKEND value is not local', () => {
    const out = withEnv({ TUITIONAPP_BACKEND: 'vercel' }, () => appConfig({ config: base }));
    assert.equal(out.extra.localBackend, undefined);
  });
  test('local: explicit mode and URLs, rest preserved', () => {
    const env = { TUITIONAPP_BACKEND: 'local', TUITIONAPP_LOCAL_EMULATOR_URL: local.emulatorUrl, TUITIONAPP_LOCAL_DEVICE_URL: local.deviceUrl, TUITIONAPP_LOCAL_TARGET: '' };
    const out = withEnv(env, () => appConfig({ config: base }));
    assert.equal(out.extra.localBackend.mode, 'local');
    assert.equal(out.extra.localBackend.target, undefined);
    assert.deepEqual(out.extra.eas, base.extra.eas);
  });
});

describe('URL selection', () => {
  test('no local config -> live', () => assert.equal(pick({ local: null }), LIVE));
  test('release build ignores local config', () => assert.equal(pick({ dev: false }), LIVE));
  test('a localBackend without mode "local" is ignored', () => {
    assert.equal(readLocalBackend({ localBackend: { emulatorUrl: local.emulatorUrl } }), null);
    assert.equal(readLocalBackend({}), null);
    assert.equal(readLocalBackend(undefined), null);
  });
  test('Android emulator -> 10.0.2.2', () => assert.equal(pick({ isDevice: false }), 'http://10.0.2.2:3000'));
  test('physical Android phone -> LAN address', () => assert.equal(pick({ isDevice: true }), 'http://192.168.1.20:3000'));
  test('explicit target overrides detection', () => {
    assert.equal(pick({ isDevice: true, local: { ...local, target: 'emulator' } }), 'http://10.0.2.2:3000');
    assert.equal(pick({ isDevice: false, local: { ...local, target: 'device' } }), 'http://192.168.1.20:3000');
  });
  test('iOS simulator and web -> localhost; iPhone -> LAN', () => {
    assert.equal(pick({ os: 'ios', isDevice: false }), 'http://localhost:3000');
    assert.equal(pick({ os: 'web', isDevice: true }), 'http://localhost:3000');
    assert.equal(pick({ os: 'ios', isDevice: true }), 'http://192.168.1.20:3000');
  });
  test('missing or invalid URL falls back to live', () => {
    assert.equal(pick({ isDevice: true, local: { mode: 'local' } }), LIVE);
    assert.equal(pick({ isDevice: true, local: { ...local, deviceUrl: 'nonsense' } }), LIVE);
  });
});
