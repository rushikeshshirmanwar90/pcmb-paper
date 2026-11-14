// toQuestion keeps the bank's subject and never invents Physics.
//   node --experimental-strip-types --test tests/question-subject.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, test } from 'node:test';
import ts from 'typescript';
import { deriveSubjects, subjectCounts, unresolvedSubjectCount, unresolvedSubjectMessage } from '../src/screens/teacher/make-pdf/pdf-subjects.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('src/services/apiService.ts');
const start = source.indexOf('const DIFFICULTY_NAMES');
const end = source.indexOf('export interface QuestionPoolRequest');
const code = ts.transpileModule(
  `const urlList = (v) => (Array.isArray(v) ? v : []);\n${source.slice(start, end).replaceAll('export function', 'function')}\nresult = toQuestion;`,
  { compilerOptions: { target: ts.ScriptTarget.ES2020 } },
).outputText;
const sandbox = { result: null };
runInNewContext(code, sandbox);
const toQuestion = sandbox.result;

describe('toQuestion subject', () => {
  test('real subjects are preserved', () => {
    for (const subject of ['Physics', 'Chemistry', 'Mathematics', 'Biology']) {
      assert.equal(toQuestion({ subject }, 0, 'Science').subject, subject);
    }
  });

  test('a missing subject is not silently Physics', () => {
    for (const raw of [{}, { subject: '' }, { subject: '   ' }, { subject: null }]) {
      assert.equal(toQuestion(raw, 0).subject, '');
    }
  });

  test('a verified selection subject fills only the gap', () => {
    assert.equal(toQuestion({}, 0, 'Chemistry').subject, 'Chemistry');
    assert.equal(toQuestion({ subject: 'Biology' }, 0, 'Chemistry').subject, 'Biology');
  });

  test('other fields keep their historical defaults', () => {
    const q = toQuestion({}, 3);
    assert.equal(q._id, 'q-api-3');
    assert.equal(q.examCategory, 'JEE/NEET');
    assert.equal(q.standard, '12th');
  });

  test('wiring: pool and bank paths pass the verified subject, bare map(toQuestion) is gone', () => {
    assert.match(source, /toQuestion\(raw, idx, request\.subject\)/);
    assert.match(read('src/services/pdf-questions.ts'), /toQuestion\(item, idx, request\.subject\)/);
    assert.ok(!/\.map\(toQuestion\)/.test(source + read('src/services/pdf-questions.ts')));
  });

  test('Make PDF: unknown-subject questions do not become Physics in the subject list', () => {
    const picked = [toQuestion({ subject: 'Chemistry' }, 0), toQuestion({}, 1), toQuestion({ subject: 'Physics' }, 2)];
    assert.deepEqual(deriveSubjects(picked), ['Chemistry', 'Physics']);
    assert.deepEqual(subjectCounts(picked).map(r => r.count), [1, 1]);
  });
});

describe('Make PDF: unresolved subjects are flagged, never dropped or relabelled', () => {
  const picked = [toQuestion({ subject: 'Chemistry' }, 0), toQuestion({}, 1), toQuestion({ subject: '  ' }, 2)];
  test('counts and message cover every blank question', () => {
    assert.equal(unresolvedSubjectCount(picked), 2);
    assert.match(unresolvedSubjectMessage(picked), /^2 selected questions have no subject/);
    assert.match(unresolvedSubjectMessage([picked[1]]), /^1 selected question has no subject/);
  });
  test('no message when every question has a subject', () => {
    assert.equal(unresolvedSubjectMessage([picked[0]]), null);
    assert.equal(unresolvedSubjectMessage([]), null);
  });
  test('the selection itself is untouched', () => {
    assert.equal(picked.length, 3);
  });
  test('flow blocks generation and Smart PDF while unresolved', () => {
    const flow = read('src/screens/teacher/make-pdf/flow.tsx');
    assert.match(flow, /if \(subjectBlock\) \{\s*setPdfError\(subjectBlock\);\s*return;/);
    assert.match(flow, /kind === 'smart' && !subjectBlock/);
    assert.match(read('src/screens/teacher/make-pdf/exam-settings.tsx'), /blocked \? blocked :/);
  });
});
