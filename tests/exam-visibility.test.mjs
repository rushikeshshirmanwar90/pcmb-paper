import { AWAY_LIMIT_MS } from '../src/screens/student/exam-guard.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createExamVisibility, decodeVisibility, reopenVisibility, VISIBILITY_GRACE_MS } from '../src/screens/student/exam-visibility.ts';

const settle = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  let time = Date.parse('2026-11-06T09:00:00Z');
  const packets = [], records = [], blocked = [], statuses = [];
  let online = true, suspended = false;
  const controller = createExamVisibility({ startedAt: '2026-11-06T08:59:00Z', resumeVersion: 0,
    now: () => time, clockSkew: () => 0, persist: record => records.push(record), onBlocked: state => blocked.push(state), onLoss: () => {}, onStatus: status => statuses.push(status),
    send: async packet => {
      packets.push(packet);
      if (!online) throw new Error('offline');
      if (packet.interruptions.some(i => Date.parse(i.returnedAt ?? packet.observedAt) - Date.parse(i.startedAt) > VISIBILITY_GRACE_MS)) suspended = true;
      return { state: suspended ? 'suspended' : 'in-progress', resumeVersion: packet.resumeVersion, visibilityVerified: packet.visible && !suspended };
    },
  });
  return { controller, packets, records, blocked, statuses, advance: ms => { time += ms; }, online: value => { online = value; }, latest: () => records.at(-1), resumeServer: () => { suspended = false; } };
}

test('all reasons share exactly 10 seconds; short returns are verified before answering', async () => {
  assert.equal(VISIBILITY_GRACE_MS, AWAY_LIMIT_MS);
  for (const reason of ['app-background', 'app-inactive', 'focus-loss', 'screen-focus-loss', 'split-screen']) {
    const h = harness(); await h.controller.flush();
    h.controller.lose('source', reason); await settle();
    assert.equal(h.blocked.at(-1), true);
    h.advance(10000); h.controller.gain('source'); await settle(); await h.controller.flush();
    assert.equal(h.statuses.at(-1).state, 'in-progress'); assert.equal(h.blocked.at(-1), false);
    assert.ok(h.packets.some(p => p.interruptions.some(i => i.returnedAt && Date.parse(i.returnedAt) - Date.parse(i.startedAt) === 10000)));
    h.controller.dispose();
  }
});

test('over-grace loss stays suspended and blocked until a teacher changes the generation', async () => {
  const h = harness(); await h.controller.flush();
  h.controller.lose('focus', 'focus-loss'); await settle(); h.advance(10001);
  await h.controller.flush();
  assert.equal(h.statuses.at(-1).state, 'suspended');
  h.controller.gain('focus'); await h.controller.flush();
  assert.equal(h.blocked.at(-1), true); assert.equal(h.statuses.at(-1).state, 'suspended');
  h.controller.dispose();
});

test('overlapping Android blur/background and screen focus use one interruption and earliest timestamp', async () => {
  const h = harness(); await h.controller.flush();
  h.controller.lose('android-focus', 'focus-loss'); const first = h.latest().open;
  h.advance(500); h.controller.lose('app', 'app-background'); h.controller.lose('screen', 'screen-focus-loss');
  assert.equal(h.latest().open.id, first.id); assert.equal(h.latest().open.startedAt, first.startedAt);
  h.controller.gain('app'); h.controller.gain('android-focus'); await settle();
  assert.equal(h.controller.visible(), false); assert.equal(h.blocked.at(-1), true);
  h.controller.gain('screen'); await settle(); await h.controller.flush();
  const completed = h.packets.flatMap(p => p.interruptions).filter(i => i.returnedAt);
  assert.ok(completed.length); assert.equal(new Set(completed.map(i => i.id)).size, 1);
  assert.equal(h.blocked.at(-1), false); h.controller.dispose();
});

test('crash/relaunch restores persisted interruption IDs and timestamps without discarding draft identity', async () => {
  const h = harness(); await h.controller.flush(); h.online(false);
  h.controller.lose('app', 'app-background'); await settle();
  const record = decodeVisibility(JSON.stringify(h.latest()));
  assert.ok(record); const original = record.open; h.controller.dispose();
  const packet = reopenVisibility(record, Date.parse(original.startedAt) + 12000);
  assert.equal(packet.interruptions[0].id, original.id);
  assert.equal(Date.parse(packet.interruptions[0].returnedAt) - Date.parse(packet.interruptions[0].startedAt), 12000);
  assert.equal(record.startedAt, '2026-11-06T08:59:00Z');
  assert.equal(decodeVisibility('bad json'), null);
});

test('network failures preserve completed interruption outbox for idempotent retry', async () => {
  const h = harness(); await h.controller.flush(); h.online(false);
  h.controller.lose('focus', 'focus-loss'); await settle(); h.advance(9000); h.controller.gain('focus'); await settle();
  const id = h.latest().pending[0].id;
  assert.equal(h.blocked.at(-1), true);
  h.online(true); await h.controller.flush();
  assert.ok(h.packets.at(-1).interruptions.some(i => i.id === id));
  assert.equal(h.latest().pending.length, 0); assert.equal(h.blocked.at(-1), false); h.controller.dispose();
});

test('stationary students remain visible through heartbeats without any touch input', async () => {
  const h = harness();
  for (let i = 0; i < 25; i++) { h.advance(2000); await h.controller.flush(); }
  assert.equal(h.packets.length, 25);
  assert.ok(h.packets.every(p => p.visible && p.interruptions.length === 0));
  assert.equal(h.blocked.at(-1), false); h.controller.dispose();
});

test('stale in-flight heartbeat cannot unblock a newly hidden examination', async () => {
  let resolve;
  const blocked = [];
  const c = createExamVisibility({ startedAt: '2026-11-06T08:59:00Z', resumeVersion: 0, now: () => Date.parse('2026-11-06T09:00:00Z'), clockSkew: () => 0,
    persist: () => {}, onBlocked: value => blocked.push(value), onLoss: () => {}, onStatus: () => {},
    send: () => new Promise(done => { resolve = done; }),
  });
  const flight = c.flush(); c.lose('focus', 'focus-loss');
  resolve({ state: 'in-progress', resumeVersion: 0, visibilityVerified: true }); await flight;
  assert.equal(blocked.at(-1), true); assert.equal(c.visible(), false); c.dispose();
});

test('focus regained while suspended stays blocked, then a teacher resume clears acknowledged interruptions', async () => {
  const h = harness(); await h.controller.flush();
  h.controller.lose('app', 'app-background'); await settle(); h.advance(11000); await h.controller.flush();
  h.controller.gain('app'); assert.equal(h.blocked.at(-1), true);
  h.resumeServer(); h.controller.accept({ state: 'in-progress', resumeVersion: 1, visibilityVerified: false });
  await h.controller.flush();
  assert.equal(h.packets.at(-1).resumeVersion, 1);
  assert.equal(h.packets.at(-1).interruptions.length, 0);
  assert.equal(h.blocked.at(-1), false); h.controller.dispose();
});
