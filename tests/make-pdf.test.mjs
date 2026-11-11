// Make PDF: the rules behind the flow (what a choice does to the ones after it,
// the selection's add/replace/reorder, automatic generation's settings and
// messages), the exam and PDF-style contracts shared with the server, and the
// structure of the screens (single-select exam and subject, multi-select
// chapters, settings shown per PDF kind).
//   node --experimental-strip-types --test tests/make-pdf.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { EXAM_IDS, EXAMS, examSubjectProblem, isExamId, sourceMatchesExam } from '../src/shared/exam-bank.ts';
import { base64Bytes, logoContentType, MAX_LOGO_BYTES } from '../src/shared/logo-limits.ts';
import { DEFAULT_PAPER_STYLE, normalizePaperStyle, paperStylePrefsKey, WATERMARK_OPACITY, WATERMARK_OPACITY_CHOICES } from '../src/shared/paper-style.ts';
import { DEFAULT_SMART_SLIDE_SETTINGS, normalizeSlideSettings } from '../src/shared/smart-slide-layout.ts';
import {
  addQuestions,
  autoBody,
  autoProblem,
  autoTotal,
  chaptersOf,
  DEFAULT_AUTO,
  editQuestion,
  EMPTY_SCOPE,
  hasWork,
  keepMatching,
  matchesScope,
  MAX_QUESTIONS,
  mixFromCount,
  moveQuestion,
  orderLike,
  removeQuestion,
  replaceQuestion,
  scopeReady,
  scopeSummary,
  shortfallMessage,
  standardsOf,
  titleFromNames,
  withChapters,
  withExam,
  withSubject,
} from '../src/screens/teacher/make-pdf/model.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const SERVER = (path) => new URL(`../../papers/src/lib/${path}`, import.meta.url);

const q = (id, over = {}) => ({
  _id: id,
  questionNumber: 1,
  examCategory: 'JEE/NEET',
  standard: '11th',
  subject: 'Physics',
  chapter: 'Kinematics',
  topic: 'Motion',
  difficulty: 'Mid',
  questionText: `Question ${id}`,
  optionA: 'a',
  optionB: 'b',
  optionC: 'c',
  optionD: 'd',
  correctAnswer: 'A',
  explanation: '',
  source: 'JEE MAIN 2020',
  ...over,
});
const ids = (list) => list.map((item) => item._id);
const inJee = (question) => sourceMatchesExam(question.source, 'JEE');

describe('the exams, shared with the server', () => {
  test('the app and the server hold the same exam file', () => {
    assert.equal(read('../src/shared/exam-bank.ts'), readFileSync(SERVER('examBank.ts'), 'utf8').replace(/\r\n/g, '\n'));
  });

  test('only JEE and NEET; each its own subjects; sources never cross', () => {
    assert.deepEqual([...EXAM_IDS], ['JEE', 'NEET']);
    assert.ok(isExamId('JEE') && isExamId('NEET'));
    for (const other of ['MHT_CET_PCM', 'HSC_SCIENCE', 'Foundation', 'General', 'All', '', undefined]) assert.equal(isExamId(other), false);
    assert.deepEqual(EXAMS.JEE.subjects, ['Physics', 'Chemistry', 'Mathematics']);
    assert.deepEqual(EXAMS.NEET.subjects, ['Physics', 'Chemistry', 'Biology']);
    assert.match(examSubjectProblem('JEE', 'Biology'), /isn't part of JEE/);
    assert.equal(examSubjectProblem('NEET', 'Biology'), null);
    assert.ok(sourceMatchesExam('JEE MAIN 2020', 'JEE') && !sourceMatchesExam('JEE MAIN 2020', 'NEET'));
    assert.ok(sourceMatchesExam('AIPMT 2014', 'NEET') && !sourceMatchesExam('AIPMT 2014', 'JEE'));
    assert.ok(!sourceMatchesExam('', 'JEE') && !sourceMatchesExam(undefined, 'NEET') && !sourceMatchesExam('MHT CET 2021', 'JEE'));
  });
});

describe('the Exam PDF style, shared with the server', () => {
  test('the app and the server hold the same style file', () => {
    assert.equal(read('../src/shared/paper-style.ts'), readFileSync(SERVER('questionPaper/style.ts'), 'utf8').replace(/\r\n/g, '\n'));
  });

  test('defaults are the paper as it always was; only listed values pass', () => {
    assert.deepEqual(DEFAULT_PAPER_STYLE, { fontFamily: 'noto-sans', fontSize: 'medium', columns: 2, spacing: 'standard', logo: false, watermarkOpacity: 16 });
    assert.deepEqual(normalizePaperStyle(undefined), DEFAULT_PAPER_STYLE);
    assert.deepEqual(normalizePaperStyle({ fontFamily: '../x', columns: 3, fontSize: 'huge', spacing: 'wide', logo: 'yes', watermarkOpacity: 'dark' }), DEFAULT_PAPER_STYLE);
    assert.equal(normalizePaperStyle({ columns: 1 }).columns, 1);
    assert.equal(normalizePaperStyle({ fontFamily: 'noto-serif' }).fontFamily, 'noto-serif');
    assert.equal(normalizePaperStyle({ watermarkOpacity: 500 }).watermarkOpacity, WATERMARK_OPACITY.max);
    assert.ok(WATERMARK_OPACITY_CHOICES.includes(WATERMARK_OPACITY.default));
  });

  test('a teacher\'s style is kept under their own key', () => {
    assert.notEqual(paperStylePrefsKey('a'), paperStylePrefsKey('b'));
    assert.match(paperStylePrefsKey('a b/c'), /^[A-Za-z0-9._-]+$/);
  });

  test('the Smart PDF font is one of the bundled families, and older saved layouts still load', () => {
    assert.equal(DEFAULT_SMART_SLIDE_SETTINGS.fontFamily, 'noto-sans');
    assert.equal(normalizeSlideSettings({ fontFamily: 'noto-serif' }).fontFamily, 'noto-serif');
    assert.equal(normalizeSlideSettings({ fontFamily: 'Comic Sans' }).fontFamily, 'noto-sans');
    assert.equal(normalizeSlideSettings({ theme: 'green', questionAreaPct: 40 }).fontFamily, 'noto-sans');
  });
});

describe('what a change of exam, subject or chapters does', () => {
  const picked = { exam: 'JEE', subject: 'Physics', chapters: ['Kinematics', 'Optics'], topics: ['Motion', 'Lenses'] };

  test('a new exam clears chapters and topics, and keeps the subject only if the exam has it', () => {
    const neet = withExam(picked, 'NEET', EXAMS.NEET.subjects);
    assert.deepEqual(neet, { exam: 'NEET', subject: 'Physics', chapters: [], topics: [] });
    const maths = withExam({ ...picked, subject: 'Mathematics' }, 'NEET', EXAMS.NEET.subjects);
    assert.deepEqual(maths, { exam: 'NEET', subject: '', chapters: [], topics: [] });
    assert.equal(withExam(picked, 'JEE', EXAMS.JEE.subjects), picked, 'the same exam changes nothing');
  });

  test('a new subject clears chapters and topics', () => {
    assert.deepEqual(withSubject(picked, 'Chemistry'), { exam: 'JEE', subject: 'Chemistry', chapters: [], topics: [] });
    assert.equal(withSubject(picked, 'Physics'), picked);
  });

  test('other chapters drop the topics of chapters no longer picked', () => {
    const next = withChapters(picked, ['Kinematics'], { Kinematics: ['Motion'], Optics: ['Lenses'] });
    assert.deepEqual(next.chapters, ['Kinematics']);
    assert.deepEqual(next.topics, ['Motion']);
    assert.deepEqual(withChapters(picked, [], {}).topics, [], 'with none picked no topic is left that belongs to a chapter');
  });

  test('a scope needs an exam and a subject; chapters may be none', () => {
    assert.equal(scopeReady(EMPTY_SCOPE), false);
    assert.equal(scopeReady({ ...EMPTY_SCOPE, exam: 'JEE' }), false);
    assert.equal(scopeReady({ ...EMPTY_SCOPE, exam: 'JEE', subject: 'Physics' }), true);
    assert.equal(scopeSummary({ ...EMPTY_SCOPE, exam: 'JEE', subject: 'Physics' }, 'JEE'), 'JEE · Physics · All chapters');
    assert.equal(scopeSummary(picked, 'JEE'), 'JEE · Physics · 2 chapters');
    assert.equal(scopeSummary({ ...picked, chapters: ['Optics'] }, 'JEE'), 'JEE · Physics · Optics');
  });
});

describe('which questions may stay selected', () => {
  const scope = { exam: 'JEE', subject: 'Physics', chapters: ['Kinematics'], topics: [] };

  test('a question must be of the exam, the subject and a chosen chapter', () => {
    assert.ok(matchesScope(q('a'), scope, inJee));
    assert.ok(!matchesScope(q('b', { source: 'NEET 2019' }), scope, inJee), 'another exam');
    assert.ok(!matchesScope(q('c', { source: '' }), scope, inJee), 'no exam named');
    assert.ok(!matchesScope(q('d', { subject: 'Chemistry' }), scope, inJee), 'another subject');
    assert.ok(!matchesScope(q('e', { chapter: 'Optics' }), scope, inJee), 'another chapter');
    assert.ok(matchesScope(q('f', { chapter: ' kinematics ' }), scope, inJee), 'spelling and case are forgiven');
    assert.ok(matchesScope(q('g', { chapter: 'Optics' }), { ...scope, chapters: [] }, inJee), 'no chapters picked means all');
    assert.ok(!matchesScope(q('h'), EMPTY_SCOPE, inJee));
    assert.ok(matchesScope(q('i', { subject: 'Botany' }), { ...scope, subject: 'Biology', exam: 'JEE' }, inJee), 'Biology also files as Botany and Zoology');
  });

  test('topics narrow further when picked', () => {
    const topical = { ...scope, topics: ['Motion'] };
    assert.ok(matchesScope(q('a'), topical, inJee));
    assert.ok(!matchesScope(q('b', { topic: 'Vectors' }), topical, inJee));
  });

  test('keepMatching keeps the matching ones in order and counts the rest', () => {
    const list = [q('1'), q('2', { source: 'NEET 2019' }), q('3'), q('4', { chapter: 'Optics' })];
    const { kept, dropped } = keepMatching(list, scope, inJee);
    assert.deepEqual(ids(kept), ['1', '3']);
    assert.equal(dropped, 2);
    assert.deepEqual(keepMatching(list, { ...scope, exam: 'NEET', chapters: [] }, (x) => sourceMatchesExam(x.source, 'NEET')).kept.map((x) => x._id), ['2']);
  });
});

describe('the selection: add, remove, replace, reorder, edit', () => {
  const list = [q('1'), q('2'), q('3')];

  test('adding skips what is already there and what is past the limit, keeping ids stable', () => {
    const out = addQuestions(list, [q('3'), q('4'), q('4'), q('5')]);
    assert.deepEqual(ids(out.list), ['1', '2', '3', '4', '5']);
    assert.deepEqual([out.added, out.duplicates, out.overLimit], [2, 2, 0]);
    const full = addQuestions(list, [q('9'), q('10')], 4);
    assert.deepEqual(ids(full.list), ['1', '2', '3', '9']);
    assert.equal(full.overLimit, 1);
    assert.equal(MAX_QUESTIONS, 300);
    assert.deepEqual(ids(list), ['1', '2', '3'], 'the original is untouched');
  });

  test('removing takes one out and leaves the order', () => {
    assert.deepEqual(ids(removeQuestion(list, '2')), ['1', '3']);
    assert.deepEqual(ids(removeQuestion(list, 'zzz')), ['1', '2', '3']);
  });

  test('replacing puts the new question in the old one\'s place, and refuses a duplicate', () => {
    assert.deepEqual(ids(replaceQuestion(list, '2', q('9'))), ['1', '9', '3']);
    assert.equal(replaceQuestion(list, '2', q('3')), null, 'already in the paper');
    assert.equal(replaceQuestion(list, 'missing', q('9')), null);
    assert.deepEqual(ids(replaceQuestion(list, '2', q('2', { questionText: 'edited' }))), ['1', '2', '3']);
  });

  test('reordering moves one question; out-of-range moves do nothing', () => {
    assert.deepEqual(ids(moveQuestion(list, 0, 2)), ['2', '3', '1']);
    assert.deepEqual(ids(moveQuestion(list, 2, 0)), ['3', '1', '2']);
    assert.equal(moveQuestion(list, 0, 0), list);
    assert.equal(moveQuestion(list, 0, 3), list);
    assert.equal(moveQuestion(list, -1, 1), list);
  });

  test('an edit changes the wording for this PDF and keeps the id and place', () => {
    const next = editQuestion(list, q('2', { questionText: 'reworded' }));
    assert.deepEqual(ids(next), ['1', '2', '3']);
    assert.equal(next[1].questionText, 'reworded');
    assert.equal(list[1].questionText, 'Question 2');
  });

  test('names and classes for the paper', () => {
    assert.equal(titleFromNames(['EMI']), 'EMI');
    assert.equal(titleFromNames(['A'.repeat(40), 'B'.repeat(40), 'Optics']), `${'A'.repeat(40)} +2 more`);
    assert.equal(standardsOf([q('1', { standard: '12th' }), q('2', { standard: '11th' }), q('3', { standard: '11th' })]), '11th, 12th');
    assert.deepEqual(chaptersOf([q('1'), q('2', { chapter: 'Optics' }), q('3')]), ['Kinematics', 'Optics']);
    assert.deepEqual(orderLike(['Optics', 'Kinematics', 'Zeta'], ['Kinematics', 'Optics']), ['Kinematics', 'Optics', 'Zeta']);
    assert.deepEqual(orderLike(['b', 'a'], []), ['b', 'a']);
  });

  test('leaving would lose work once a kind and an exam or questions are chosen', () => {
    assert.equal(hasWork(null, EMPTY_SCOPE, []), false);
    assert.equal(hasWork('exam', EMPTY_SCOPE, []), false);
    assert.equal(hasWork('exam', { ...EMPTY_SCOPE, exam: 'JEE' }, []), true);
    assert.equal(hasWork('smart', EMPTY_SCOPE, list), true);
  });
});

describe('automatic generation', () => {
  const scope = { exam: 'NEET', subject: 'Biology', chapters: ['Cell'], topics: [] };

  test('defaults ask for 20 questions of any type, repeats allowed', () => {
    assert.equal(autoTotal(DEFAULT_AUTO), 20);
    assert.equal(DEFAULT_AUTO.byLevel, false);
    assert.equal(DEFAULT_AUTO.type, 'any');
    assert.equal(DEFAULT_AUTO.avoidUsed, false);
    assert.equal(autoProblem(DEFAULT_AUTO), null);
  });

  test('settings that can\'t be honoured are named', () => {
    assert.match(autoProblem({ ...DEFAULT_AUTO, count: 0 }), /at least one/);
    assert.match(autoProblem({ ...DEFAULT_AUTO, count: Number.NaN }), /at least one/);
    assert.match(autoProblem({ ...DEFAULT_AUTO, count: 301 }), /up to 300/);
    assert.match(autoProblem({ ...DEFAULT_AUTO, byLevel: true, mix: { Easy: 0, Mid: 0, Hard: 0 } }), /at least one/);
    assert.match(autoProblem({ ...DEFAULT_AUTO, byLevel: true, mix: { Easy: 5, Mid: -1, Hard: 2 } }), /whole number/);
    assert.equal(autoProblem({ ...DEFAULT_AUTO, byLevel: true, mix: { Easy: 5, Mid: 5, Hard: 0 } }), null);
  });

  test('a total splits 40 / 40 / 20 and always adds up', () => {
    for (const n of [1, 2, 7, 20, 33, 300]) {
      const mix = mixFromCount(n);
      assert.equal(mix.Easy + mix.Mid + mix.Hard, n, `${n}`);
      assert.ok(mix.Easy >= 0 && mix.Mid >= 0 && mix.Hard >= 0);
    }
    assert.deepEqual(mixFromCount(20), { Easy: 8, Mid: 8, Hard: 4 });
  });

  test('the request carries the scope, the type, the number or the mix, and what to leave out', () => {
    assert.deepEqual(autoBody(scope, { ...DEFAULT_AUTO, count: 12, type: 'MCQ' }, ['x']), {
      exam: 'NEET',
      subject: 'Biology',
      chapters: ['Cell'],
      topics: [],
      answerType: 'MCQ',
      count: 12,
      exclude: ['x'],
    });
    const byLevel = autoBody(scope, { ...DEFAULT_AUTO, byLevel: true, mix: { Easy: 1, Mid: 2, Hard: 3 } }, []);
    assert.deepEqual(byLevel.mix, { Easy: 1, Mid: 2, Hard: 3 });
    assert.ok(!('count' in byLevel));
  });

  test('a shortfall says how many were found, and nothing when all were', () => {
    const base = { requested: 20, found: 8, complete: false, available: { Easy: 3, Mid: 5, Hard: 0, total: 8 }, avoided: 0, requestedByLevel: null, foundByLevel: { Easy: 0, Mid: 0, Hard: 0 } };
    assert.match(shortfallMessage(base), /Only 8 of the 20 questions you asked for are available/);
    assert.equal(shortfallMessage({ ...base, found: 20, complete: true }), null);
    assert.match(shortfallMessage({ ...base, found: 0 }), /no questions for these choices/);
    assert.match(shortfallMessage({ ...base, found: 0, avoided: 12 }), /12 were left out because they are in PDFs you already made/);
    assert.match(shortfallMessage({ ...base, avoided: 4 }), /4 left out because they are in earlier PDFs/);
    const levels = shortfallMessage({ ...base, requestedByLevel: { Easy: 10, Mid: 5, Hard: 5 }, foundByLevel: { Easy: 3, Mid: 5, Hard: 0 } });
    assert.match(levels, /Easy: 3 of 10, Hard: 0 of 5/);
    assert.doesNotMatch(levels, /Mid:/);
  });
});

describe('the logo limits', () => {
  test('the app\'s limit matches the server\'s', () => {
    const server = readFileSync(SERVER('instituteLogo.ts'), 'utf8');
    assert.match(server, new RegExp(`MAX_LOGO_BYTES = ${MAX_LOGO_BYTES / 1024} \\* 1024`));
  });

  test('the real type of an image is read from its bytes, not assumed', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]).toString('base64');
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]).toString('base64');
    assert.equal(logoContentType(png), 'image/png');
    assert.equal(logoContentType(jpeg), 'image/jpeg');
    assert.equal(logoContentType(Buffer.from('<svg/>').toString('base64')), null);
    assert.equal(logoContentType(''), null);
  });

  test('the size of a base64 image', () => {
    assert.equal(base64Bytes(Buffer.from('abc').toString('base64')), 3);
    assert.equal(base64Bytes(Buffer.from('ab').toString('base64')), 2);
    assert.equal(base64Bytes(Buffer.from('a').toString('base64')), 1);
    assert.equal(base64Bytes(Buffer.alloc(1000).toString('base64')), 1000);
  });
});

describe('the screens', () => {
  const scope = read('../src/screens/teacher/make-pdf/scope-step.tsx');
  const flow = read('../src/screens/teacher/make-pdf/flow.tsx');
  const exam = read('../src/screens/teacher/make-pdf/exam-settings.tsx');
  const smart = read('../src/components/smart-pdf-screen.tsx');
  const method = read('../src/screens/teacher/make-pdf/method-step.tsx');

  test('exam and subject are single-select dropdowns without an "All" row; chapters keep the multi-select', () => {
    assert.match(scope, /<DropdownSelect\s+label="Exam"\s+required/);
    assert.match(scope, /<DropdownSelect\s+label="Subject"\s+required/);
    assert.match(scope, /<MultiSelectDropdown\s+label="Chapters"/);
    assert.doesNotMatch(scope, /Chips|MultiChips|ChipRow/, 'no chips for the exam, subject or chapters');
    const dropdown = read('../src/components/dropdown-select.tsx');
    assert.match(dropdown, /required\?: boolean/);
    assert.match(dropdown, /required \? options\.filter/);
  });

  test('one screen offers Exam PDF and Smart PDF and chooses the questions; no wizard steps remain', () => {
    const page = read('../src/screens/teacher/make-pdf/one-page.tsx');
    assert.match(page, /label: 'Exam PDF'/);
    assert.match(page, /label: 'Smart PDF'/);
    assert.match(flow, /useState<PdfKind>/);
    assert.equal((flow.match(/<OnePageSelect/g) ?? []).length, 1);
    for (const gone of ['<ScopeStep', '<ReviewStep', '<MethodStep', '<ManualPicker']) assert.ok(!flow.includes(gone), gone);
  });

  test('only an Exam PDF gets the paper settings; a Smart PDF gets its own and none of the paper\'s', () => {
    assert.match(flow, /step === 'settings' && kind === 'exam'[\s\S]*<ExamSettingsStep/);
    assert.match(flow, /step === 'settings' && kind === 'smart'[\s\S]*<SmartPdfScreen/);
    for (const examOnly of ['DateField', 'Paper set', 'Total marks', 'Watermark', 'PDF_CHOICES', 'Answer Key', 'answerKey', 'Duration', 'Columns']) {
      assert.ok(!smart.includes(examOnly), `Smart PDF settings don't mention ${examOnly}`);
    }
    for (const smartOnly of ['Presentation title', 'Question area', 'Options layout', 'Writing space', 'Reset to Default', 'Edit Layout', 'Generate Smart PDF']) {
      assert.ok(smart.includes(smartOnly), `Smart PDF settings have ${smartOnly}`);
    }
    for (const field of ['Paper title', 'Paper set', 'DateField', 'Watermark', 'Institute logo', 'Page layout', 'Columns', 'Font', 'Text size']) {
      assert.ok(exam.includes(field), `Exam PDF settings have ${field}`);
    }
  });

  test('the shared subject browser offers targets, additive random fill, manual picking and removal', () => {
    const page = read('../src/screens/teacher/question-selection/subject-selector.tsx');
    for (const text of ['Fill Remaining', 'SelectionCard', 'View Selected', 'QuestionActionMenu', 'onEndReached']) assert.ok(page.includes(text), text);
    assert.ok(read('../src/screens/teacher/question-selection/action-menu.tsx').includes('Remove Question'));
    assert.ok(page.includes('SelectedQuestionRow'));
    assert.doesNotMatch(page, /Custom random count|Add \$\{custom\} Random|label="Preview"/);
  });

  test('the flow never reads questions from anywhere but the exam-checked services', () => {
    assert.doesNotMatch(flow, /fetchQuestions|fetchQuestionPool|searchPdfQuestions|MOCK_QUESTIONS/);
    const service = read('../src/services/pdf-questions.ts');
    assert.match(service, /sourceMatchesExam/);
    assert.match(service, /verifyBankQuestions/);
    assert.doesNotMatch(service, /MOCK_QUESTIONS/);
  });

  test('the Questions tab shows the new flow, and My PDFs and the question bank are still there', () => {
    const tab = read('../src/app/questions.tsx');
    assert.match(tab, /<MakePdfFlow/);
    assert.doesNotMatch(tab, /<QuestionSetFlow/);
    assert.match(tab, /MyPdfsScreen/);
    assert.match(tab, /BrowseQuestions/);
  });

  test('the logo is set on the tuition admin\'s profile, not on the teacher\'s screens', () => {
    assert.match(read('../src/screens/tuition/tuition-profile.tsx'), /<InstituteLogoCard/);
    assert.doesNotMatch(exam, /saveInstituteLogo|pickLogo/);
  });
});
