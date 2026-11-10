// 1B teacher Home: "Needs attention" from the teacher's tests.
//   node --experimental-strip-types --test tests/teacher-attention.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { attentionRows } from '../src/screens/teacher/attention.ts';

const NOW = Date.parse('2026-11-10T10:00:00Z');
const H = 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();
let n = 0;
const t = (over) => ({
  id: `t${++n}`, title: `Test ${n}`, batch: { id: 'b', name: 'NEET 12th A' }, teacher: { id: 'me', name: 'Me' }, subject: 'Physics', standard: '12th',
  questionCount: 20, marksPerQuestion: 4, negativeMarks: 1, maxScore: 80, durationMinutes: 60,
  opensAt: iso(NOW - 2 * H), closesAt: iso(NOW + 2 * H), lastStartAt: null, status: 'open', createdAt: iso(NOW - 48 * H),
  started: 0, submitted: 0, batchStudents: 32, averageScore: null, ...over,
});

describe('attentionRows', () => {
  test('paused students waiting come first, then live, results, opening', () => {
    const rows = attentionRows([
      t({ id: 'opening', status: 'scheduled', opensAt: iso(NOW + 3 * H), closesAt: iso(NOW + 5 * H) }),
      t({ id: 'results', status: 'closed', opensAt: iso(NOW - 30 * H), closesAt: iso(NOW - 26 * H), submitted: 30, averageScore: 54 }),
      t({ id: 'live', submitted: 18 }),
      t({ id: 'waiting', pendingResolution: true, status: 'closed', closesAt: iso(NOW - H) }),
    ], NOW);
    assert.deepEqual(rows.map((r) => [r.kind, r.testId]), [['waiting', 'waiting'], ['live', 'live'], ['results', 'results'], ['opening', 'opening']]);
    assert.match(rows[1].detail, /^18\/32 submitted · closes /);
    assert.equal(rows[2].detail, '30 took it · average 54/80');
  });

  test('old results, far-off tests and closed tests nobody took are left out', () => {
    assert.deepEqual(attentionRows([
      t({ status: 'closed', closesAt: iso(NOW - 4 * 24 * H), submitted: 10 }),
      t({ status: 'scheduled', opensAt: iso(NOW + 2 * 24 * H), closesAt: iso(NOW + 3 * 24 * H) }),
      t({ status: 'closed', closesAt: iso(NOW - H), submitted: 0 }),
    ], NOW), []);
  });

  test('a waiting test shows once, as waiting (not also as live)', () => {
    const rows = attentionRows([t({ pendingResolution: true })], NOW);
    assert.deepEqual(rows.map((r) => r.kind), ['waiting']);
  });

  test('live tests closing sooner come first; the newest results first', () => {
    const rows = attentionRows([
      t({ id: 'late', closesAt: iso(NOW + 5 * H) }),
      t({ id: 'soon', closesAt: iso(NOW + H) }),
      t({ id: 'older', status: 'closed', closesAt: iso(NOW - 40 * H), submitted: 3 }),
      t({ id: 'newer', status: 'closed', closesAt: iso(NOW - 2 * H), submitted: 3 }),
    ], NOW);
    assert.deepEqual(rows.map((r) => r.testId), ['soon', 'late', 'newer', 'older']);
  });
});
