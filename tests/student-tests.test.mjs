// UX-1 focused tests: the test runner's answer autosave and the test list's
// rules. No test framework needed:
//   node --experimental-strip-types --test tests/
// (Node 22.6+; the flag isn't needed from Node 23.6.)
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createAnswerSaver } from '../src/screens/student/answer-saver.ts';
import { decodeDraft, draftKey, encodeDraft, isEmptyDraft } from '../src/screens/student/attempt-draft.ts';
import {
  byUrgency,
  clock,
  factsLine,
  kindOf,
  percentOf,
  resultTone,
  spokenDuration,
  statusAt,
  untilLabel,
} from '../src/screens/student/test-format.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

const settle = () => new Promise((resolve) => setImmediate(resolve));

/** Timers that only move when the test says so. */
function fakeTimers() {
  let now = 0;
  let nextId = 0;
  const queue = new Map();
  return {
    setTimer: (run, ms) => {
      const id = ++nextId;
      queue.set(id, { at: now + ms, run });
      return id;
    },
    clearTimer: (id) => queue.delete(id),
    pending: () => queue.size,
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...queue.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        queue.delete(due[0]);
        now = due[1].at;
        due[1].run();
        await settle();
      }
      now = end;
      await settle();
    },
  };
}

/** A server whose replies the test controls: each save waits until resolved or failed. */
function fakeServer() {
  const calls = [];
  return {
    calls,
    save: (answers) =>
      new Promise((resolve, reject) => {
        calls.push({ answers, resolve, reject });
      }),
    async reply(ok = true) {
      const call = calls.find((c) => !c.done);
      assert.ok(call, 'no save is waiting for a reply');
      call.done = true;
      if (ok) call.resolve({});
      else call.reject(new Error('offline'));
      await settle();
    },
  };
}

function setup() {
  const timers = fakeTimers();
  const server = fakeServer();
  const answers = new Map();
  const states = [];
  const saver = createAnswerSaver({
    save: server.save,
    read: (i) => answers.get(i) ?? null,
    onState: (s) => states.push(s),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const answer = (index, value) => {
    answers.set(index, value);
    saver.change(index);
  };
  return { timers, server, answers, states, saver, answer };
}

// ─── Autosave ───────────────────────────────────────────────────────────────

describe('answer autosave', () => {
  test('saves a change shortly after it, and only then says "saved"', async () => {
    const { timers, server, saver, answer, states } = setup();
    answer(0, 'B');
    assert.equal(saver.state, 'pending');
    await timers.advance(799);
    assert.equal(server.calls.length, 0, 'waits for the 800 ms pause');
    await timers.advance(1);
    assert.deepEqual(server.calls[0].answers, [{ index: 0, selected: 'B' }]);
    assert.equal(saver.state, 'saving');
    await server.reply(true);
    assert.equal(saver.state, 'saved');
    assert.deepEqual(states, ['pending', 'saving', 'saved']);
  });

  test('a burst of changes goes in one request with the latest values', async () => {
    const { timers, server, answer } = setup();
    answer(0, 'A');
    await timers.advance(300);
    answer(0, 'C');
    answer(1, 'D');
    await timers.advance(800);
    assert.equal(server.calls.length, 1);
    assert.deepEqual(server.calls[0].answers, [
      { index: 0, selected: 'C' },
      { index: 1, selected: 'D' },
    ]);
  });

  test('a cleared answer is saved as null', async () => {
    const { timers, server, answers, saver } = setup();
    answers.set(2, null);
    saver.change(2);
    await timers.advance(800);
    assert.deepEqual(server.calls[0].answers, [{ index: 2, selected: null }]);
  });

  test('a failed save shows "error", keeps the answer and retries with backoff until it works', async () => {
    const { timers, server, saver, answer } = setup();
    answer(3, 'A');
    await timers.advance(800);
    await server.reply(false);
    assert.equal(saver.state, 'error');
    assert.deepEqual(saver.unsent(), [{ index: 3, selected: 'A' }]);

    // Retries after 2 s, 5 s, 10 s, then every 20 s.
    for (const wait of [2000, 5000, 10000, 20000, 20000]) {
      await timers.advance(wait - 1);
      const before = server.calls.length;
      await timers.advance(1);
      assert.equal(server.calls.length, before + 1, `retries after ${wait} ms`);
      await server.reply(false);
      assert.equal(saver.state, 'error');
    }

    await timers.advance(20000);
    await server.reply(true);
    assert.equal(saver.state, 'saved');
    assert.deepEqual(saver.unsent(), []);
  });

  test('a retry sends the newest answer, not the one that failed', async () => {
    const { timers, server, answer } = setup();
    answer(0, 'A');
    await timers.advance(800);
    await server.reply(false);
    answer(0, 'B');
    await timers.advance(800);
    assert.deepEqual(server.calls.at(-1).answers, [{ index: 0, selected: 'B' }]);
  });

  test('the error stays visible while new changes wait, until a save works', async () => {
    const { timers, server, saver, answer } = setup();
    answer(0, 'A');
    await timers.advance(800);
    await server.reply(false);
    answer(1, 'B');
    assert.equal(saver.state, 'error', 'not "pending": the earlier answer still isn\'t saved');
    await timers.advance(800);
    await server.reply(true);
    assert.equal(saver.state, 'saved');
  });

  test('one request at a time: changes made meanwhile go in the next one', async () => {
    const { timers, server, saver, answer } = setup();
    answer(0, 'A');
    await timers.advance(800);
    answer(1, 'B');
    await timers.advance(800);
    assert.equal(server.calls.length, 1, 'waits for the first save to finish');
    await server.reply(true);
    // Shown as "Saving…" (pending or saving), never "saved": index 1 isn't sent yet.
    assert.ok(['pending', 'saving'].includes(saver.state), `state is ${saver.state}`);
    await timers.advance(800);
    assert.deepEqual(server.calls[1].answers, [{ index: 1, selected: 'B' }]);
    await server.reply(true);
    assert.equal(saver.state, 'saved');
  });

  test('Retry now sends at once', async () => {
    const { timers, server, saver, answer } = setup();
    answer(0, 'A');
    await timers.advance(800);
    await server.reply(false);
    saver.retryNow();
    await timers.advance(0);
    assert.equal(server.calls.length, 2);
  });

  test('while submitting, saves hold; if the submission fails they carry on', async () => {
    const { timers, server, saver, answer } = setup();
    answer(0, 'A');
    saver.pause();
    await timers.advance(5000);
    assert.equal(server.calls.length, 0);
    saver.resume();
    await timers.advance(800);
    assert.equal(server.calls.length, 1);
  });

  test('leaving waits for the final save: true only when the server confirms it', async () => {
    const { server, saver, answer } = setup();
    answer(0, 'A');
    const done = saver.settle();
    await settle();
    assert.equal(server.calls.length, 1, 'sends at once, without the 800 ms wait');
    await server.reply(true);
    assert.equal(await done, true);
    assert.equal(saver.state, 'saved');
  });

  test('a failed final save reports false and keeps the answer as unconfirmed', async () => {
    const { server, saver, answer } = setup();
    answer(0, 'A');
    const done = saver.settle();
    await settle();
    await server.reply(false);
    assert.equal(await done, false, 'never claims success');
    assert.equal(saver.state, 'error');
    assert.deepEqual(saver.unconfirmed(), [{ index: 0, selected: 'A' }]);
  });

  test('leaving during a save waits for it, then sends what changed meanwhile', async () => {
    const { timers, server, saver, answer } = setup();
    answer(0, 'A');
    await timers.advance(800);
    answer(1, 'B');
    assert.deepEqual(
      saver.unconfirmed().sort((a, b) => a.index - b.index),
      [
        { index: 0, selected: 'A' },
        { index: 1, selected: 'B' },
      ],
      'answers on the way count as unconfirmed too'
    );
    const done = saver.settle();
    await server.reply(true);
    assert.deepEqual(server.calls[1].answers, [{ index: 1, selected: 'B' }]);
    await server.reply(true);
    assert.equal(await done, true);
    assert.deepEqual(saver.unconfirmed(), []);
  });

  test('leaving: unsent answers are handed over and timers stop', async () => {
    const { timers, saver, answer } = setup();
    answer(4, 'D');
    assert.deepEqual(saver.unsent(), [{ index: 4, selected: 'D' }]);
    saver.dispose();
    assert.equal(timers.pending(), 0);
  });
});

// ─── Draft kept on the phone ────────────────────────────────────────────────

describe('attempt draft (review marks and unconfirmed answers)', () => {
  const STARTED = '2026-10-27T09:00:00.000Z';

  test('is scoped to the user and the test, with storage-safe keys', () => {
    assert.equal(draftKey('6710aa', '6710bb'), 'pcmb.attempt.6710aa.6710bb');
    assert.notEqual(draftKey('userA', 't1'), draftKey('userB', 't1'));
    assert.match(draftKey('a/b c', 't:1'), /^[A-Za-z0-9._]+$/);
  });

  test('round-trips for the same attempt', () => {
    const draft = { startedAt: STARTED, marks: [2, 5], pending: [{ index: 1, selected: 'C' }, { index: 3, selected: null }] };
    assert.deepEqual(decodeDraft(encodeDraft(draft), STARTED), draft);
  });

  test('a draft from another attempt of the test is ignored', () => {
    const draft = { startedAt: STARTED, marks: [1], pending: [] };
    assert.equal(decodeDraft(encodeDraft(draft), '2026-10-28T09:00:00.000Z'), null);
  });

  test('missing or damaged drafts are ignored; bad entries are dropped', () => {
    assert.equal(decodeDraft(null, STARTED), null);
    assert.equal(decodeDraft('{not json', STARTED), null);
    assert.equal(decodeDraft('"text"', STARTED), null);
    const raw = JSON.stringify({ startedAt: STARTED, marks: [1, 1, -1, 'x', 2.5, 3], pending: [{ index: 0, selected: 'A' }, { index: 'x' }, { index: 4, selected: 7 }, null] });
    assert.deepEqual(decodeDraft(raw, STARTED), { startedAt: STARTED, marks: [1, 3], pending: [{ index: 0, selected: 'A' }] });
  });

  test('an empty draft is removed rather than stored', () => {
    assert.equal(isEmptyDraft({ startedAt: STARTED, marks: [], pending: [] }), true);
    assert.equal(isEmptyDraft({ startedAt: STARTED, marks: [0], pending: [] }), false);
  });
});

// ─── Test list rules ────────────────────────────────────────────────────────

const NOW = new Date('2026-10-27T10:00:00').getTime();
const H = 3600_000;
const iso = (ms) => new Date(ms).toISOString();
const testAt = (over = {}) => ({
  id: 't',
  title: 'Physics test',
  subject: 'Physics',
  questionCount: 30,
  durationMinutes: 60,
  maxScore: 120,
  negativeMarks: 1,
  marksPerQuestion: 4,
  opensAt: iso(NOW - H),
  closesAt: iso(NOW + 5 * H),
  ...over,
});

describe('test status and labels', () => {
  test('status follows the open and close times, like the server', () => {
    assert.equal(statusAt(testAt({ opensAt: iso(NOW + H) }), NOW), 'scheduled');
    assert.equal(statusAt(testAt(), NOW), 'open');
    assert.equal(statusAt(testAt({ closesAt: null }), NOW), 'open');
    assert.equal(statusAt(testAt({ closesAt: iso(NOW) }), NOW), 'closed');
  });

  test('an in-progress test reads "continue" (the Home bug), an unknown one stays neutral', () => {
    assert.equal(kindOf(testAt({ mine: { state: 'in-progress', score: null } }), NOW), 'continue');
    assert.equal(kindOf(testAt({ mine: null }), NOW), 'start');
    assert.equal(kindOf(testAt({ mine: undefined }), NOW), 'open');
  });

  test('upcoming, done, missed and closed', () => {
    assert.equal(kindOf(testAt({ opensAt: iso(NOW + H), mine: null }), NOW), 'upcoming');
    assert.equal(kindOf(testAt({ mine: { state: 'submitted', score: 80 } }), NOW), 'done');
    assert.equal(kindOf(testAt({ closesAt: iso(NOW - H), mine: { state: 'submitted', score: 80 } }), NOW), 'done');
    assert.equal(kindOf(testAt({ closesAt: iso(NOW - H), mine: null }), NOW), 'missed');
    assert.equal(kindOf(testAt({ closesAt: iso(NOW - H), mine: { state: 'in-progress', score: null } }), NOW), 'closed');
  });

  test('to-do order: in progress first, then closing soonest, no closing time last', () => {
    const later = testAt({ id: 'later', closesAt: iso(NOW + 48 * H), mine: null });
    const never = testAt({ id: 'never', closesAt: null, mine: null });
    const soon = testAt({ id: 'soon', closesAt: iso(NOW + H), mine: null });
    const going = testAt({ id: 'going', closesAt: iso(NOW + 72 * H), mine: { state: 'in-progress', score: null } });
    assert.deepEqual([later, never, soon, going].sort(byUrgency).map((t) => t.id), ['going', 'soon', 'later', 'never']);
  });

  test('relative times', () => {
    assert.equal(untilLabel(iso(NOW + 30_000), NOW), 'in under a minute');
    assert.equal(untilLabel(iso(NOW + 25 * 60_000), NOW), 'in 25 min');
    assert.equal(untilLabel(iso(NOW + 135 * 60_000), NOW), 'in 2 h 15 min');
    assert.equal(untilLabel(iso(NOW + 5 * H), NOW), 'in 5 h');
    assert.equal(untilLabel(iso(NOW + 3 * 24 * H), NOW), 'in 3 days');
    assert.equal(untilLabel(iso(NOW - H), NOW), 'now');
  });

  test('the timer and what screen readers hear', () => {
    assert.equal(clock(0), '0:00');
    assert.equal(clock(65), '1:05');
    assert.equal(clock(3723), '1:02:03');
    assert.equal(clock(-5), '0:00');
    assert.equal(spokenDuration(272), '4 minutes 32 seconds');
    assert.equal(spokenDuration(60), '1 minute');
  });

  test('score percent and tone bands', () => {
    assert.equal(percentOf(96, 120), 80);
    assert.equal(percentOf(-4, 120), -3);
    assert.equal(percentOf(5, 0), 0);
    assert.equal(resultTone(70), 'success');
    assert.equal(resultTone(55), 'warning');
    assert.equal(resultTone(39), 'danger');
  });

  test('facts line', () => {
    assert.equal(factsLine(testAt()), '30 questions · 60 min · 120 marks · −1 per wrong answer');
    assert.equal(factsLine(testAt({ questionCount: 1, negativeMarks: 0 })), '1 question · 60 min · 120 marks');
  });
});
