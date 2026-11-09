import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import * as draft from '../src/screens/student/attempt-draft.ts';
import * as visibility from '../src/screens/student/exam-visibility.ts';

// Exercise the real store with a native filesystem stand-in: async writes must
// never be used by the synchronous lifecycle persistence path.
function store() {
  const files = new Map();
  let directoryExists = false;
  let fail = false;
  class Directory {
    constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); }
    get exists() { return directoryExists; }
    create() { directoryExists = true; }
  }
  class File {
    constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); }
    get exists() { return files.has(this.uri); }
    textSync() { return files.get(this.uri); }
    delete() { files.delete(this.uri); }
    write() { throw new Error('Unexpected asynchronous lifecycle write'); }
    writeSync(value) {
      if (fail) throw new Error('Storage unavailable');
      files.set(this.uri, value);
    }
  }
  const source = readFileSync(new URL('../src/services/attempt-store.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const exports = {};
  const modules = {
    'react-native': { Platform: { OS: 'android' } },
    'expo-file-system': { Directory, File, Paths: { document: 'documents' } },
    '@/screens/student/attempt-draft': draft,
    '@/screens/student/exam-visibility': visibility,
  };
  new Function('require', 'exports', outputText)(name => {
    assert.ok(name in modules, `Unexpected import: ${name}`);
    return modules[name];
  }, exports);
  return { ...exports, files, failWrites: () => { fail = true; } };
}

const snapshot = (current = 1) => ({ startedAt: 'today', marks: [0], pending: [{ index: 0, selected: 'B' }], current });

test('repeated queued saves complete and restore the latest answer snapshot', async () => {
  const s = store();
  assert.deepEqual(await Promise.all([
    s.saveDraft('user', 'test', snapshot(1)),
    s.saveDraft('user', 'test', snapshot(2)),
  ]), [true, true]);
  assert.deepEqual(await s.loadDraft('user', 'test', 'today'), snapshot(2));
});

test('an immediate lifecycle save finishes before returning and invalidates older queued saves', async () => {
  const s = store();
  const queued = s.saveDraft('user', 'test', snapshot(1));
  assert.equal(s.saveDraftImmediate('user', 'test', snapshot(3)), true);
  assert.equal(JSON.parse([...s.files.values()][0]).current, 3);
  await queued;
  assert.deepEqual(await s.loadDraft('user', 'test', 'today'), snapshot(3));
});

test('repeated visibility snapshots replace the existing file immediately', () => {
  const s = store();
  assert.equal(s.saveVisibility('user', 'test', { sequence: 1 }), true);
  assert.equal(s.saveVisibility('user', 'test', { sequence: 2 }), true);
  assert.equal(s.files.size, 1);
  assert.deepEqual(JSON.parse([...s.files.values()][0]), { sequence: 2 });
});

test('storage failures return false for queued, immediate and visibility saves', async () => {
  const s = store();
  s.failWrites();
  assert.equal(await s.saveDraft('user', 'test', snapshot()), false);
  assert.equal(s.saveDraftImmediate('user', 'test', snapshot()), false);
  assert.equal(s.saveVisibility('user', 'test', {}), false);
});

test('clearing an attempt removes both files without an outstanding write restoring them', async () => {
  const s = store();
  const queued = s.saveDraft('user', 'test', snapshot());
  s.saveVisibility('user', 'test', {});
  await s.clearDraft('user', 'test');
  await queued;
  assert.equal(s.files.size, 0);
  assert.equal(await s.loadDraft('user', 'test', 'today'), null);
});
