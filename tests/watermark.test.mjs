// PDF watermark focused tests: the text is cleaned the way the server cleans it,
// and each account's saved watermark has its own key.
//   node --experimental-strip-types --test tests/watermark.test.mjs
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, test } from 'node:test';
import { cleanWatermark, MAX_WATERMARK, watermarkPrefsKey } from '../src/shared/watermark.ts';

const SERVER_COPY = new URL('../../papers/src/lib/questionPaper/watermark.ts', import.meta.url);

const CASES = [
  'Devne Classes',
  '  Devne   Classes ',
  'Devne\nClasses\t2026',
  '   ',
  '',
  'ab😀'.repeat(30),
  'x'.repeat(100),
  'देवने क्लासेस',
];

describe('cleanWatermark', () => {
  test('keeps one tidy line', () => {
    assert.equal(cleanWatermark('  Devne   Classes '), 'Devne Classes');
    assert.equal(cleanWatermark('Devne\nClasses\t2026'), 'Devne Classes 2026');
    assert.equal(cleanWatermark('   '), '');
  });

  test('stops at the longest allowed, without cutting a character in two', () => {
    const cleaned = cleanWatermark('ab😀'.repeat(30));
    assert.equal(Array.from(cleaned).length, MAX_WATERMARK);
    assert.ok('ab😀'.repeat(30).startsWith(cleaned));
  });

  test('cleaning twice changes nothing, so a saved watermark reads back the same', () => {
    for (const text of CASES) assert.equal(cleanWatermark(cleanWatermark(text)), cleanWatermark(text));
  });

  test("matches the server's copy", { skip: existsSync(SERVER_COPY) ? false : "the papers repo isn't next to this one" }, async () => {
    const server = await import(SERVER_COPY.href);
    assert.equal(server.MAX_WATERMARK, MAX_WATERMARK);
    for (const text of CASES) assert.equal(cleanWatermark(text), server.cleanWatermark(text), JSON.stringify(text));
  });
});

describe('watermarkPrefsKey', () => {
  test('is one key per account, safe to store', () => {
    assert.notEqual(watermarkPrefsKey('teacher-1'), watermarkPrefsKey('teacher-2'));
    assert.equal(watermarkPrefsKey('a/b c'), 'pdfWatermark.a_b_c');
  });
});
