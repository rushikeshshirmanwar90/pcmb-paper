// Teacher screens' loading: the tabs that read the same data share one
// request, and cached answers never cross users, institutes or workspaces.
//   node --experimental-strip-types --test tests/teacher-loading.test.mjs
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { cacheKeys } from '../src/services/cache-keys.ts';
import { cachedLoad, clearLoadCache, loadShared } from '../src/services/load-cache.ts';

const teacher = { id: 'u1', role: 'teacher', tuition: { id: 't1' } };

describe('teacher loading', () => {
  beforeEach(() => clearLoadCache());

  test('Home, Batches, Tests and Profile opening together make one overview request', async () => {
    let calls = 0;
    const overview = async () => {
      calls += 1;
      return { totals: { batches: 2 } };
    };
    // All four tabs mount at once (PagerView keeps every page), each with the same key.
    const key = cacheKeys(teacher).teacherOverview;
    const answers = await Promise.all([1, 2, 3, 4].map(() => loadShared(key, overview)));
    assert.equal(calls, 1);
    assert.ok(answers.every((a) => a.totals.batches === 2));
    assert.deepEqual(cachedLoad(key), { totals: { batches: 2 } }, 'opening a tab again starts from it');
  });

  test('pull to refresh still sends its own request', async () => {
    let calls = 0;
    const key = cacheKeys(teacher).teacherOverview;
    await loadShared(key, async () => (calls += 1));
    await loadShared(key, async () => (calls += 1), { fresh: true });
    assert.equal(calls, 2);
  });

  test('keys differ by user, institute and workspace', () => {
    const base = cacheKeys(teacher);
    const otherUser = cacheKeys({ ...teacher, id: 'u2' });
    const otherTuition = cacheKeys({ ...teacher, tuition: { id: 't2' } });
    const adminWorkspace = cacheKeys({ ...teacher, role: 'tuition' });
    for (const other of [otherUser, otherTuition, adminWorkspace]) {
      assert.notEqual(other.teacherOverview, base.teacherOverview);
      assert.notEqual(other.tests(), base.tests());
      assert.notEqual(other.announcements(50), base.announcements(50));
    }
    assert.equal(cacheKeys({ ...teacher }).teacherOverview, base.teacherOverview, 'the same owner shares');
  });

  test("an admin switching to the Teacher workspace never sees the Admin workspace's answer", async () => {
    const admin = cacheKeys({ ...teacher, role: 'tuition' });
    await loadShared(admin.announcements(50), async () => ['admin view']);
    assert.equal(cachedLoad(cacheKeys(teacher).announcements(50)), undefined);
  });

  test('keys tell apart the parameters of each request', () => {
    const k = cacheKeys(teacher);
    assert.notEqual(k.tests(), k.tests('b1'));
    assert.notEqual(k.tests('b1'), k.tests('b2'));
    assert.notEqual(k.batch('b1'), k.batch('b2'));
    assert.notEqual(k.bankOptions('Physics|11th|regular'), k.bankOptions('Physics|12th|regular'));
    assert.notEqual(k.announcements(3), k.announcements(50));
    // Distinct requests never share a key.
    const all = [k.teacherOverview, k.tests(), k.batch('all'), k.testBatches, k.bankOptions('all'), k.announcements(50)];
    assert.equal(new Set(all).size, all.length);
  });

  test('a slow answer from before a data change is not shown after it', async () => {
    let finish;
    const key = cacheKeys(teacher).tests();
    const slow = loadShared(key, () => new Promise((resolve) => (finish = resolve)));
    clearLoadCache(); // bumpDataVersion: e.g. the teacher ended a test
    const fresh = await loadShared(key, async () => ['closed']);
    finish(['open']);
    await slow;
    assert.deepEqual(fresh, ['closed']);
    assert.deepEqual(cachedLoad(key), ['closed']);
  });
});
