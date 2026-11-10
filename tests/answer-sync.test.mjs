import assert from 'node:assert/strict';
import { test } from 'node:test';
import { restorableAnswers, mergeSavedAnswers } from '../src/screens/student/answer-sync.ts';
import { decodeDraft, encodeDraft } from '../src/screens/student/attempt-draft.ts';
import { createAnswerSaver } from '../src/screens/student/answer-saver.ts';

test('reopening discards older pending drafts, including legacy drafts, while preserving offline edits with a matching version', () => {
  const saved = [{ index: 0, selected: 'C', version: 3 }, { index: 1, selected: 'A', version: 1 }];
  const pending = [{ index: 0, selected: 'B', baseVersion: 1 }, { index: 1, selected: 'B', baseVersion: 1 }, { index: 2, selected: 'D', baseVersion: 0 }];
  assert.deepEqual(restorableAnswers(pending, saved), pending.slice(1));
  assert.deepEqual(restorableAnswers([{ index: 0, selected: 'B' }, { index: 3, selected: 'A' }], saved), [{ index: 3, selected: 'A' }]);
  assert.deepEqual([...mergeSavedAnswers(new Map([[0, 'B'], [1, 'B'], [2, 'D']]), pending, saved)], [[0, 'C'], [1, 'B'], [2, 'D']]);
});

test('draft persistence retains per-answer versions, review marks and navigation', () => {
  const draft = { startedAt: 'today', marks: [2], pending: [{ index: 2, selected: 'B', baseVersion: 7 }], current: 2, visited: [0, 2] };
  assert.deepEqual(decodeDraft(encodeDraft(draft), 'today'), draft);
});

test('a retry carries the current acknowledged version and newest local answer', async () => {
  let version = 0, answer = 'A', fail = true;
  const calls = [];
  const saver = createAnswerSaver({ read: () => answer, readVersion: () => version, onState: () => {}, delayMs: 100000,
    save: async updates => { calls.push(updates); if (fail) throw new Error('offline'); version++; } });
  saver.change(0); await saver.flush();
  answer = 'B'; saver.change(0); fail = false; await saver.flush();
  assert.deepEqual(calls[1], [{ index: 0, selected: 'B', baseVersion: 0 }]);
  answer = 'C'; saver.change(0); await saver.flush();
  assert.deepEqual(calls[2], [{ index: 0, selected: 'C', baseVersion: 1 }]);
  saver.dispose();
});

test('an edit while saving retains the in-flight guard, and disposing prevents late retries', async () => {
  let finish;
  let answer = 'A';
  const saver = createAnswerSaver({ read: () => answer, readVersion: () => 0, onState: () => {}, delayMs: 100000,
    save: () => new Promise(resolve => { finish = resolve; }) });
  saver.change(0); const flight = saver.flush();
  answer = 'B'; saver.change(0);
  assert.equal(saver.state, 'pending');
  assert.equal(saver.saving, true);
  assert.deepEqual(saver.unconfirmed(), [{ index: 0, selected: 'B', baseVersion: 0 }]);
  saver.dispose(); finish(); await flight;
  assert.equal(saver.saving, false);
  assert.deepEqual(saver.unsent(), [{ index: 0, selected: 'B', baseVersion: 0 }]);
});
