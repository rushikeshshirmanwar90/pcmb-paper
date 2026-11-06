import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptsAttemptStatus } from '../src/screens/student/attempt-status.ts';
import { secondsLeft, skewOf } from '../src/screens/student/exam-guard.ts';
import { decodeDraft, encodeDraft, isEmptyDraft } from '../src/screens/student/attempt-draft.ts';
import { createAnswerSaver } from '../src/screens/student/answer-saver.ts';
import { statusAt } from '../src/screens/student/test-format.ts';
import { matchesParticipation } from '../src/screens/teacher/test-management.ts';

const attempt = { id: 'same-attempt', startedAt: '2026-11-06T08:00:00Z', state: 'in-progress', revision: 1, resumeVersion: 0 };

test('extension updates the server countdown without replacing the attempt', () => {
  const now = Date.parse('2026-11-06T09:00:00Z');
  const extended = { ...attempt, revision: 2, deadline: '2026-11-06T09:15:00Z', serverTime: new Date(now).toISOString() };
  assert.equal(acceptsAttemptStatus(attempt, extended), true);
  assert.equal(secondsLeft(extended.deadline, skewOf(extended.serverTime, now), now), 900);
  assert.equal(acceptsAttemptStatus(extended, attempt), false);
});

test('resume accepts the same identity and rejects old suspension responses', () => {
  const paused = { ...attempt, revision: 3, state: 'suspended' };
  const resumed = { ...attempt, revision: 4, resumeVersion: 1 };
  assert.equal(acceptsAttemptStatus(paused, resumed), true);
  assert.equal(acceptsAttemptStatus(resumed, paused), false);
  assert.equal(acceptsAttemptStatus(attempt, { ...resumed, id: 'second-attempt' }), false);
  assert.equal(acceptsAttemptStatus({ ...resumed, state: 'submitted' }, resumed), false);
});

test('draft round trip preserves selected pending answers, review marks and question position', () => {
  const draft = { startedAt: attempt.startedAt, current: 7, visited: [0, 3, 7], marks: [3, 7], pending: [{ index: 7, selected: 'B' }] };
  assert.deepEqual(decodeDraft(encodeDraft(draft), attempt.startedAt), draft);
  assert.equal(isEmptyDraft({ startedAt: attempt.startedAt, current: 7, marks: [], pending: [] }), false);
  assert.equal(decodeDraft(encodeDraft(draft), 'another-attempt'), null);
});

test('network failure followed by suspension preserves pending saves until teacher resume', async () => {
  let online = false;
  const writes = [];
  const saver = createAnswerSaver({ save: async updates => { if (!online) throw new Error('offline'); writes.push(updates); }, read: () => 'B', onState: () => {}, delayMs: 100000, retryMs: [100000] });
  saver.change(7);
  await saver.flush();
  saver.pause();
  online = true;
  await saver.flush();
  assert.equal(writes.length, 0);
  assert.deepEqual(saver.unconfirmed(), [{ index: 7, selected: 'B' }]);
  saver.resume();
  await saver.flush();
  assert.deepEqual(writes, [[{ index: 7, selected: 'B' }]]);
  assert.deepEqual(saver.unconfirmed(), []);
  saver.dispose();
});

test('continuations remain Live after closesAt, and pending violations are not submitted', () => {
  const test = { opensAt: '2026-11-06T08:00:00Z', closesAt: '2026-11-06T09:00:00Z', pendingResolution: true };
  assert.equal(statusAt(test, Date.parse('2026-11-06T09:05:00Z')), 'open');
  assert.equal(statusAt({ ...test, pendingResolution: false }, Date.parse('2026-11-06T09:05:00Z')), 'closed');
  assert.equal(matchesParticipation({ state: 'violation', resumable: true }, 'submitted'), false);
  assert.equal(matchesParticipation({ state: 'violation', resumable: true }, 'violations'), true);
});
