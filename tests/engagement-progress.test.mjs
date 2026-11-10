// Phase 0: the progress store and the progress header's numbers and words.
//   node --experimental-strip-types --test tests/engagement-progress.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createEngagementStore } from '../src/engagement/engagement-store.ts';
import { goalFill, goalLabel, goalText, levelCaption, levelFill, levelLabel, shouldStack, streakCaption, streakLabel } from '../src/engagement/progress-format.ts';

const me = (over = {}) => ({
  enabled: true,
  xp: { total: 240, level: 2, levelStartXp: 100, nextLevelXp: 300, intoLevel: 140, toNext: 60, progress: 0.7 },
  today: { date: '2026-11-10', xp: 60, goal: 100, goalKey: 'regular', goalMet: false, practiceXp: 60, practiceCap: 400 },
  streak: { current: 3, longest: 5, freezes: 0, maxFreezes: 2, securedToday: false },
  ...over,
});
const field = (snapshot) => ({ enabled: true, xpAwarded: 10, duplicate: false, me: snapshot });

describe('progress store', () => {
  test('starts unknown, loads, then shows the server snapshot', () => {
    const store = createEngagementStore();
    store.reset('s1');
    assert.equal(store.get().enabled, null);
    const token = store.beginLoad();
    assert.equal(store.get().status, 'loading');
    store.finishLoad(token, me());
    assert.equal(store.get().status, 'ready');
    assert.equal(store.get().enabled, true);
    assert.equal(store.get().me.xp.total, 240);
  });

  test('engagement switched off hides everything', () => {
    const store = createEngagementStore();
    store.reset('s1');
    store.finishLoad(store.beginLoad(), { enabled: false });
    assert.equal(store.get().enabled, false);
    assert.equal(store.get().me, null);
  });

  test('a learning response updates the numbers without a refetch', () => {
    const store = createEngagementStore();
    store.reset('s1');
    store.finishLoad(store.beginLoad(), me());
    let calls = 0;
    store.subscribe(() => calls++);
    store.publish(field(me({ today: { ...me().today, xp: 70 } })), 's1');
    assert.equal(store.get().me.today.xp, 70);
    assert.equal(calls, 1);
  });

  test('a slower load that started before a learning response never overwrites it', () => {
    const store = createEngagementStore();
    store.reset('s1');
    const token = store.beginLoad();
    store.publish(field(me({ today: { ...me().today, xp: 90 } })), 's1');
    store.finishLoad(token, me()); // older numbers (60 XP)
    assert.equal(store.get().me.today.xp, 90);
    assert.equal(store.get().status, 'ready');
  });

  test('null or missing engagement fields (older server, failure there) change nothing', () => {
    const store = createEngagementStore();
    store.reset('s1');
    store.finishLoad(store.beginLoad(), me());
    const before = store.get();
    store.publish(null, 's1');
    store.publish(undefined, 's1');
    assert.equal(store.get(), before);
  });

  test("another student's numbers never leak: reset forgets, late replies and loads are ignored", () => {
    const store = createEngagementStore();
    store.reset('s1');
    const oldLoad = store.beginLoad();
    store.reset('s2');
    assert.equal(store.get().me, null);
    store.finishLoad(oldLoad, me());
    store.publish(field(me()), 's1');
    assert.equal(store.get().me, null);
    assert.equal(store.get().owner, 's2');
  });

  test('a failed refresh keeps the last numbers and says if it was offline', () => {
    const store = createEngagementStore();
    store.reset('s1');
    store.finishLoad(store.beginLoad(), me());
    const token = store.beginLoad();
    assert.equal(store.get().status, 'ready'); // no skeleton while numbers are on screen
    store.failLoad(token, "You're offline.", true);
    assert.equal(store.get().status, 'error');
    assert.equal(store.get().offline, true);
    assert.equal(store.get().me.xp.total, 240);
  });
});

describe('progress header numbers', () => {
  test('goal ring fills with XP, caps at full, and is full once the goal is met', () => {
    assert.equal(goalFill(me().today), 0.6);
    assert.equal(goalFill({ ...me().today, xp: 250 }), 1);
    assert.equal(goalFill({ ...me().today, xp: 0 }), 0);
    assert.equal(goalFill({ ...me().today, goal: 0 }), 0);
    assert.equal(goalFill({ ...me().today, xp: 40, goalMet: true }), 1);
    assert.equal(goalText(me().today), '60/100');
    assert.equal(goalText({ ...me().today, xp: -5 }), '0/100');
  });

  test('level bar follows the server progress, clamped', () => {
    assert.equal(levelFill(me().xp), 0.7);
    assert.equal(levelFill({ ...me().xp, progress: 1.4 }), 1);
    assert.equal(levelFill({ ...me().xp, progress: Number.NaN }), 0);
    assert.equal(levelCaption(me().xp), '60 XP to L3');
  });

  test('every chip has words for a screen reader', () => {
    assert.equal(streakLabel(me().streak), '3-day streak.');
    assert.equal(streakLabel({ ...me().streak, securedToday: true, freezes: 1 }), '3-day streak, today counted, 1 streak freeze saved.');
    assert.equal(streakLabel({ ...me().streak, current: 0, freezes: 2 }), "No streak yet. Meet today's goal to start one, 2 streak freezes saved.");
    assert.equal(goalLabel(me().today), "Today's goal: 60 of 100 XP.");
    assert.equal(goalLabel({ ...me().today, xp: 120, goalMet: true }), "Today's goal done: 120 of 100 XP.");
    assert.equal(levelLabel(me().xp), 'Level 2, 60 XP to level 3.');
    assert.equal(streakCaption({ ...me().streak, current: 0 }), 'No streak yet');
  });

  test('chips wrap on small phones and at large text sizes', () => {
    assert.equal(shouldStack(320, 1), true);
    assert.equal(shouldStack(359, 1), true);
    assert.equal(shouldStack(360, 1), false);
    assert.equal(shouldStack(412, 1.3), true);
    assert.equal(shouldStack(768, 1), false);
  });
});
