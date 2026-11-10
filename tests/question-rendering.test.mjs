// Question rendering regressions (shared by self-assessment, topic practice, the test runner and teacher previews).
//   node --experimental-strip-types --test tests/question-rendering.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fitColumns } from '../src/shared/table-fit.ts';
import { splitLatex } from '../src/shared/latex.ts';
import { mathTree } from '../src/shared/mathml-tree.ts';
import { MISSING_OPTION_NOTE, optionSlots } from '../src/screens/student/question-options.ts';
import { SAMPLES } from '../src/dev/question-samples.ts';

const find = (node, tag) => (node.tag === tag ? node : node.children.map((c) => find(c, tag)).find(Boolean) ?? null);
const textOf = (node) => (node.text ?? '') + node.children.map(textOf).join('');

describe('fitColumns', () => {
  test('fits: natural widths unchanged', () => {
    assert.deepEqual(fitColumns([100, 80], 300), [100, 80]);
    assert.deepEqual(fitColumns([100, 80], 0), [100, 80], 'no box known: unchanged');
  });
  test('too wide: the narrow column keeps its width, the wide one takes the rest and wraps', () => {
    const w = fitColumns([900, 120], 300, { min: 48, extra: 10 });
    assert.equal(w[1], 120);
    assert.ok(w[0] + w[1] <= 300, `fits the box: ${w}`);
    assert.ok(w[0] >= 170, `the wide column gets what is left: ${w}`);
  });
  test('two wide columns share equally', () => {
    const w = fitColumns([800, 700], 320, { extra: 0 });
    assert.deepEqual(w, [160, 160]);
  });
  test('a 320px phone with many columns: everyone gets the minimum (the box scrolls)', () => {
    const w = fitColumns([200, 200, 200, 200, 200, 200, 200, 200], 280, { min: 60 });
    assert.deepEqual(w, new Array(8).fill(60));
  });
});

describe('Q17 (match the column): the table parses with its heading row and all four rows', () => {
  const q17 = SAMPLES.find((s) => s.id === 'match-the-column').question;
  const pieces = splitLatex(q17.questionText);
  const display = pieces.find((p) => p.kind !== 'text' && p.display);
  test('the table is a display formula', () => assert.ok(display));
  test('heading row "Column I | Column II" + rows (A)–(D), two columns each', () => {
    const table = find(mathTree(display.value, true), 'mtable');
    assert.ok(table, 'an mtable');
    const rows = table.children.filter((r) => r.tag === 'mtr');
    assert.equal(rows.length, 5);
    assert.match(textOf(rows[0]), /Column\s*I/);
    assert.match(textOf(rows[0]), /Column\s*II/);
    for (const [i, label] of ['(A)', '(B)', '(C)', '(D)'].entries()) assert.ok(textOf(rows[i + 1]).includes(label), label);
    assert.ok(rows.every((r) => r.children.length === 2));
  });
  test('all four options show', () => {
    assert.deepEqual(optionSlots(q17).map((o) => [o.key, o.missing]), [['A', false], ['B', false], ['C', false], ['D', false]]);
  });
});

describe('every sample parses (table, match-the-column, long equation, image, options with maths)', () => {
  for (const s of SAMPLES) {
    test(s.id, () => {
      for (const field of ['questionText', 'optionA', 'optionB', 'optionC', 'optionD']) {
        for (const p of splitLatex(s.question[field] ?? '')) if (p.kind !== 'text') assert.ok(mathTree(p.value, p.display), `${field}: ${p.value.slice(0, 40)}`);
      }
    });
  }
});

describe('which options show', () => {
  const q = (a, b, c, d, figures = {}) => ({ optionA: a, optionB: b, optionC: c, optionD: d, optionDiagramUrls: figures });
  test('True/False keeps just A and B (no fake missing rows)', () => {
    assert.deepEqual(optionSlots(q('True', 'False', '', '')).map((o) => o.key), ['A', 'B']);
  });
  test('a gap shows the empty option, marked missing and still there to pick', () => {
    const slots = optionSlots(q('1', '', '3', '4'));
    assert.deepEqual(slots.map((o) => [o.key, o.missing]), [['A', false], ['B', true], ['C', false], ['D', false]]);
  });
  test('an option with only a figure counts as present', () => {
    assert.deepEqual(optionSlots(q('', '', '', '', { D: ['x.png'] })).map((o) => [o.key, o.missing]), [['A', true], ['B', true], ['C', true], ['D', false]]);
  });
  test('revealed: the keyed option shows even when its text is missing', () => {
    assert.deepEqual(optionSlots(q('Yes', 'No', '', ''), 'D').map((o) => o.key), ['A', 'B', 'C', 'D']);
    assert.deepEqual(optionSlots(q('Yes', 'No', '', ''), ' b ').map((o) => o.key), ['A', 'B']);
  });
  test('no option text at all: A–D shown, all missing, so it can still be answered', () => {
    assert.deepEqual(optionSlots(q('', '', '', '')).map((o) => [o.key, o.missing]), [['A', true], ['B', true], ['C', true], ['D', true]]);
  });
  test('the note students and screen readers get', () => {
    assert.equal(MISSING_OPTION_NOTE, 'Option text missing (your teacher will check this question)');
  });
});
