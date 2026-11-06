import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { matchesAccess, matchesParticipation, participationCounts, studentsToAdd } from '../src/screens/teacher/test-management.ts';

const participant = state => ({ student: { id: state, name: state }, state });
const access = (id, overrides = {}) => ({ student: { id, name: id }, eligible: true, allowed: false, started: false, request: null, ...overrides });
const monitor = {
  counts: { inProgress: 1, notStarted: 2, submitted: 3, autoSubmitted: 1, violations: 1, total: 6 },
  accessStudents: [access('restricted'), access('pending', { request: 'pending' }), access('allowed', { allowed: true }), access('started', { started: true }), access('unactivated', { eligible: false })],
};

test('submitted includes violation and automatic submissions; violation list names only violators', () => {
  const rows = ['in-progress', 'not-started', 'submitted', 'auto-submitted', 'violation'].map(participant);
  assert.deepEqual(rows.filter(r => matchesParticipation(r, 'submitted')).map(r => r.student.id), ['submitted', 'auto-submitted', 'violation']);
  assert.deepEqual(rows.filter(r => matchesParticipation(r, 'violations')).map(r => r.student.id), ['violation']);
  assert.deepEqual(rows.filter(r => matchesParticipation(r, 'waiting')).map(r => r.student.id), ['not-started']);
});

test('access requests overlap not-allowed without changing participation state', () => {
  assert.equal(matchesAccess(access('pending', { request: 'pending' }), 'restricted'), true);
  assert.equal(matchesAccess(access('pending', { request: 'pending' }), 'requests'), true);
  assert.equal(matchesAccess(access('started', { request: 'pending', started: true }), 'requests'), false);
  assert.deepEqual(participationCounts(monitor), { taking: 1, waiting: 2, submitted: 3, violations: 1, restricted: 3, requests: 1 });
});

test('add students includes a newly admitted or requesting student, excludes inactive and started students', () => {
  assert.deepEqual(studentsToAdd(monitor).map(r => r.student.id), ['restricted', 'pending']);
  assert.deepEqual(studentsToAdd({ ...monitor, accessStudents: undefined }), []);
});

test('legacy monitor counts work without access-management fields', () => {
  const counts = participationCounts({ ...monitor, accessStudents: undefined });
  assert.equal(counts.waiting, 2);
  assert.equal(counts.restricted, 0);
  assert.equal(counts.requests, 0);
});

test('teacher test UI retains valid punctuation instead of mojibake', () => {
  const text = readFileSync(new URL('../src/screens/teacher/teacher-tests.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(text, /Ã|Â|â€|\uFFFD/);
  assert.match(text, /Wrong answer \(−\)/);
});
