// The screens' load cache: answers kept for the next screen, shared requests,
// and nothing surviving a data change or a new login.
//   node --experimental-strip-types --test tests/load-cache.test.mjs
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { cachedLoad, clearLoadCache, loadShared } from '../src/services/load-cache.ts';

describe('load cache', () => {
  beforeEach(() => clearLoadCache());

  test('keeps the answer for the next screen', async () => {
    assert.equal(cachedLoad('batch:1'), undefined);
    await loadShared('batch:1', async () => ({ name: 'NEET 11th A' }));
    assert.deepEqual(cachedLoad('batch:1'), { name: 'NEET 11th A' });
  });

  test('two screens asking at once make one request', async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      return 'students';
    };
    const [a, b] = await Promise.all([loadShared('batch:1', load), loadShared('batch:1', load)]);
    assert.equal(calls, 1);
    assert.equal(a, 'students');
    assert.equal(b, 'students');
    await loadShared('batch:1', load);
    assert.equal(calls, 2, 'a finished request is not shared with a later one');
  });

  test('a failed request is not kept and can be tried again', async () => {
    await assert.rejects(loadShared('batch:1', async () => Promise.reject(new Error('offline'))), /offline/);
    assert.equal(cachedLoad('batch:1'), undefined);
    assert.equal(await loadShared('batch:1', async () => 'ok'), 'ok');
  });

  test('clearing drops the answers', async () => {
    await loadShared('batches', async () => ['a']);
    clearLoadCache();
    assert.equal(cachedLoad('batches'), undefined);
  });

  test('an answer that started before a clear is not kept', async () => {
    let finish;
    const slow = loadShared('batch:1', () => new Promise((resolve) => (finish = resolve)));
    clearLoadCache(); // e.g. a student was moved, or another user logged in
    finish('before the change');
    assert.equal(await slow, 'before the change');
    assert.equal(cachedLoad('batch:1'), undefined);
  });

  test('a request after a clear is not joined to one from before it', async () => {
    let calls = 0;
    loadShared('batch:1', () => (calls += 1, new Promise(() => {})));
    clearLoadCache();
    assert.equal(await loadShared('batch:1', async () => (calls += 1, 'fresh')), 'fresh');
    assert.equal(calls, 2);
  });

  test('a refresh the user asks for is a new request, not the stalled one', async () => {
    let calls = 0;
    loadShared('batch:1', () => (calls += 1, new Promise(() => {}))); // a dead connection: never answers
    const refreshed = loadShared('batch:1', async () => (calls += 1, 'fresh'), { fresh: true });
    assert.equal(await refreshed, 'fresh');
    assert.equal(calls, 2);
    assert.equal(cachedLoad('batch:1'), 'fresh');
  });

  test('an older answer arriving after a newer one does not overwrite it', async () => {
    let finishOld;
    const old = loadShared('batch:1', () => new Promise((resolve) => (finishOld = resolve)));
    await loadShared('batch:1', async () => 'new', { fresh: true });
    finishOld('old');
    assert.equal(await old, 'old'); // its own screen still gets it
    assert.equal(cachedLoad('batch:1'), 'new');
  });

  test('only the most recent answers are kept', async () => {
    for (let i = 0; i < 70; i++) await loadShared(`k${i}`, async () => i);
    assert.equal(cachedLoad('k0'), undefined);
    assert.equal(cachedLoad('k69'), 69);
  });
});
