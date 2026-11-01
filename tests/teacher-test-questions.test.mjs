// Editing a test's questions: preselection, topic changes, Back, review, math rendering.
//   node --experimental-strip-types --test tests/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { pickedInOrder, pickerList, pickerQuestions, pickerTakesBack, reconcilePool, seedTopic, stepBack } from '../src/screens/teacher/test-questions.ts';
import { hasLatex, splitLatex } from '../src/shared/latex.ts';
import { mathTree } from '../src/shared/mathml-tree.ts';

const copy = (n, sourceId, chapter = 'Electrostatics', topic = 'Electric Field') => ({
  sourceId,
  questionText: `Q${n}`,
  optionA: 'a',
  optionB: 'b',
  optionC: 'c',
  optionD: 'd',
  chapter,
  topic,
});
const bank = (id, topic = 'Electric Field') => ({ _id: id, questionNumber: 1, questionText: id, chapter: 'Electrostatics', topic });
const known = (qs) => new Map(qs.map((q) => [q._id, q]));
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const ids = (qs) => qs.map((q) => q._id);

describe('existing questions are preselected', () => {
  const saved = [copy(1, 'a1'), copy(2, 'b2'), copy(3, null), copy(4, 'a1')];
  const picked = pickerQuestions(saved);
  test('keyed by sourceId, in the test order', () => assert.deepEqual(ids(picked).slice(0, 2), ['a1', 'b2']));
  test('no duplicate selections', () => assert.equal(new Set(ids(picked)).size, picked.length));
  test('a copy with an unknown source is kept, not dropped', () => assert.ok(picked.some((q) => q._id === 'saved:2' && q.questionText === 'Q3')));
  test('the saved copy is not mutated', () => assert.equal(saved[0].sourceId, 'a1'));
});

describe('the topic the picker opens on', () => {
  test('is the first saved question that names a chapter and a topic', () => {
    const saved = pickerQuestions([copy(1, 'a', '', ''), copy(2, 'b', 'Optics', 'Lenses'), copy(3, 'c', 'Heat', 'Calorimetry')]);
    assert.deepEqual(seedTopic(saved), { chapter: 'Optics', topic: 'Lenses' });
  });
  test('is none when no saved question has metadata, so nothing is fetched and nothing is dropped', () => {
    const saved = pickerQuestions([copy(1, 'a', '', ''), copy(2, null, undefined, '  ')]);
    assert.equal(seedTopic(saved), null);
    assert.equal(saved.length, 2);
  });
});

describe('the list after extra questions load', () => {
  const saved = pickerQuestions([copy(1, 'a1'), copy(2, 'b2')]);
  const k = known(saved);
  // The bank returns the two saved questions again, plus two new ones, in bank order.
  const pool = [bank('n0'), bank('a1'), bank('n1'), bank('b2')];
  const shown = reconcilePool(pool, k);

  test('lists the bank order, saved and new questions together', () => assert.deepEqual(ids(shown), ['n0', 'a1', 'n1', 'b2']));
  test('a question the test already holds keeps its saved copy, not the bank version', () => {
    assert.equal(shown[1].questionText, 'Q1');
    assert.equal(shown[0].questionText, 'n0');
  });
  test('only the saved questions are picked; new ones are not', () => {
    const picks = new Set(ids(saved));
    assert.deepEqual(shown.map((q) => picks.has(q._id)), [false, true, false, true]);
  });
  test('the pool is not mutated', () => assert.equal(pool[1].questionText, 'a1'));
});

describe('selections survive changing topics', () => {
  const saved = pickerQuestions([copy(1, 'a1'), copy(2, 'b2', 'Optics', 'Lenses')]);
  const picks = new Set(ids(saved));
  // Topic A's pool, then topic B's pool: held questions come from `known`.
  const k = known(saved);
  const poolB = [bank('x1', 'Magnetism'), bank('x2', 'Magnetism')];
  poolB.forEach((q) => k.set(q._id, q));

  test('Selected shows picks from every topic, whatever the listed pool', () => {
    assert.deepEqual(ids(pickerList('selected', poolB, picks, k)), ['a1', 'b2']);
    assert.deepEqual(ids(pickerList('all', poolB, picks, k)), ['x1', 'x2']);
  });
  test('picking a new question appends it; unpicking removes only that one; no duplicates', () => {
    const sel = new Set(picks);
    sel.add('x1');
    sel.add('x1');
    assert.deepEqual(ids(pickedInOrder(sel, k)), ['a1', 'b2', 'x1']);
    sel.delete('a1');
    assert.deepEqual(ids(pickedInOrder(sel, k)), ['b2', 'x1']);
  });
  test('a pick whose bank source is gone stays in the test', () => {
    const lone = pickerQuestions([copy(1, null)]);
    assert.deepEqual(ids(pickedInOrder(new Set(ids(lone)), known(lone))), ['saved:0']);
  });
  test('the original selection is untouched (cancel keeps the test)', () => {
    const before = ids(saved);
    pickerList('selected', poolB, new Set(), k);
    assert.deepEqual(ids(saved), before);
  });
});

describe('Back', () => {
  test('Details and Done leave the wizard', () => {
    assert.equal(stepBack(1), 'leave');
    assert.equal(stepBack(5), 'leave');
  });
  test('Questions → Details, Marking → Questions, Review → Marking', () => {
    assert.equal(stepBack(2), 1);
    assert.equal(stepBack(3), 2);
    assert.equal(stepBack(4), 3);
  });
  test('the edit picker takes Back only from Change topic, never from its list', () => {
    assert.equal(pickerTakesBack(true, 'config'), true);
    assert.equal(pickerTakesBack(true, 'questions'), false);
  });
  test('a new test keeps its own Back: the picker never takes it', () => {
    assert.equal(pickerTakesBack(false, 'config'), false);
    assert.equal(pickerTakesBack(false, 'questions'), false);
  });
});

// The picker, the review and the student view all draw maths through MathText:
// text → splitLatex → mathTree (KaTeX MathML) → native views. These run the real
// pipeline on representative questions; a tree that parses is drawn, a null
// tree is the only path that shows source.
describe('maths in questions and options is drawn, not shown as source', () => {
  const samples = {
    fraction: ['The field is $\\frac{kq}{r^2}$ at distance r.', 'mfrac'],
    root: ['Find $\\sqrt{2gh}$ for the speed.', 'msqrt'],
    power: ['Energy is $\\frac{1}{2}mv^{2}$.', 'msup'],
    subscript: ['Take $\\varepsilon_0 = 8.85\\times10^{-12}$.', 'msub'],
    greek: ['An angle $\\theta$ and $\\alpha$, $\\mu_0$.', 'mi'],
    bareCommand: ['\\frac{1}{4\\pi\\varepsilon_0}\\frac{q}{r^2}', 'mfrac'],
    mixed: ['A charge $q$ moves at $v = 3\\times10^{8}$ m/s in a field $\\vec{E}$.', 'mover'],
  };
  const tags = (node, out = new Set()) => (out.add(node.tag), node.children.forEach((c) => tags(c, out)), out);
  const leaves = (node) => [node.text, ...node.children.flatMap(leaves)].join('');

  for (const [name, [text, tag]] of Object.entries(samples)) {
    test(`${name}`, () => {
      assert.ok(hasLatex(text), 'detected as maths');
      const maths = splitLatex(text).filter((p) => p.kind === 'math');
      assert.ok(maths.length > 0, 'has a maths piece');
      for (const piece of maths) {
        const tree = mathTree(piece.value, piece.display);
        assert.ok(tree, `parsed: ${piece.value}`);
        assert.ok(!/\\[a-zA-Z]+/.test(leaves(tree)), `no raw command left in: ${leaves(tree)}`);
      }
      assert.ok(maths.some((p) => tags(mathTree(p.value, p.display)).has(tag)), `drawn with <${tag}>`);
    });
  }
  test('plain text is not treated as maths', () => assert.equal(hasLatex('Which of these is a vector quantity?'), false));
  test('text around the maths stays text', () => {
    const pieces = splitLatex('Value of $x$ is');
    assert.deepEqual(pieces.map((p) => p.kind), ['text', 'math', 'text']);
  });
});

describe('where the edit flow draws questions', () => {
  const tests = src('../src/screens/teacher/teacher-tests.tsx');
  const picker = src('../src/components/create-exam-modal.tsx');
  const preview = tests.slice(tests.indexOf('function QuestionPreview'), tests.indexOf('function TestDetail'));

  test('the review draws question and options with the same MathText the picker and student view use', () => {
    assert.match(preview, /<MathText text=\{q\.questionText\}/);
    assert.match(preview, /<MathText text=\{option\}/);
    assert.doesNotMatch(preview, /<Text[^>]*>\s*\{q\.questionText\}/);
  });
  test('the picker draws question and options with MathText', () => {
    assert.match(picker, /<MathText text=\{question\.questionText\}/);
    assert.match(picker, /<MathText\s+text=\{optText\}/);
  });
  test('the picker and the review draw question and option diagrams with the shared Diagrams component', () => {
    assert.match(picker, /<Diagrams urls=\{question\.diagramUrls\}/);
    assert.match(picker, /<Diagrams urls=\{question\.optionDiagramUrls\?\.\[optKey/);
    assert.match(preview, /<Diagrams urls=\{q\.diagramUrls\}/);
    assert.match(preview, /<Diagrams urls=\{figures\}/);
  });
  test('no new renderer or maths library was added', () => {
    assert.doesNotMatch(tests, /katex|react-native-render-html|mathjax/i);
    assert.doesNotMatch(src('../package.json'), /mathjax|react-native-math|react-native-katex/i);
  });
  test('the review shows no answer key', () => assert.doesNotMatch(preview, /correctAnswer/));
});

describe('edit mode wiring', () => {
  const tests = src('../src/screens/teacher/teacher-tests.tsx');
  const picker = src('../src/components/create-exam-modal.tsx');

  test('editing mounts the creation picker with the test questions picked, and no longer has its own step', () => {
    assert.match(tests, /initialQuestions=\{edit \? questions : undefined\}/);
    assert.doesNotMatch(tests, /Pick different questions/);
    assert.doesNotMatch(tests, /setPicking/);
  });
  test('the picker opens on the question list in edit mode, on the details otherwise', () => {
    assert.match(picker, /useState<Step>\(editing \? 'questions' : 'config'\)/);
  });
  test('the first saved topic loads on open, by the same fetch the Change topic button uses', () => {
    assert.match(picker, /loadPool\(\[seed\]\)/);
    assert.match(picker, /await loadPool\(groups\)/);
  });
  test('a new test still starts empty; an edited one keeps its picks on a topic change', () => {
    assert.match(picker, /if \(!editing\) setSelectedQuestionIds\(new Set\(\)\)/);
  });
  test('Android Back and the arrow share one handler; ✕ asks before dropping changes', () => {
    assert.match(tests, /onRequestClose=\{back\}/);
    assert.match(tests, /accessibilityLabel="Back" onPress=\{back\}/);
    assert.match(tests, /accessibilityLabel="Close" onPress=\{leave\}/);
    assert.match(tests, /confirmAction\('Discard your changes\?'/);
  });
  test('a question taken out in Review is unpicked in the picker too', () => assert.match(tests, /flow\.current\?\.deselect\(/));
  test('Review does not fetch', () => {
    const review = tests.slice(tests.indexOf('{step === 4 ?'), tests.indexOf('{step === 5 && saved'));
    assert.doesNotMatch(review, /fetch|loadPool|QuestionSetFlow/);
  });

  const route = src('../../papers/src/app/api/tests/[id]/route.ts');
  test('server still refuses edits once opened, after attempts, or by other teachers', () => {
    assert.match(route, /status !== "scheduled"\) throw badRequest/);
    assert.match(route, /TestAttempt\.exists\(\{ testId: test\._id \}\)/);
    assert.match(route, /mustEdit\(canEdit\)/);
  });
  test('the picker never writes to the bank', () => assert.doesNotMatch(picker, /updateQuestion|deleteQuestion/));
});
