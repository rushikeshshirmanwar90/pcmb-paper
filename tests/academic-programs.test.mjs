// Admin UX Step 2 focused tests: academic programs (mirrored from the
// server's papers/src/lib/school.ts), academic years, student/batch fit, and
// the batch-creation helpers (suggested names, setup status, filters).
//   node --experimental-strip-types --test tests/academic-programs.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  academicYearChoices,
  academicYearOf,
  fitProblem,
  formatAcademicYear,
  parseAcademicYear,
  PROGRAM_INFO,
  PROGRAM_LABELS,
  PROGRAMS,
  programOf,
  programSubjects,
  questionBankOf,
  subjectProblem,
} from '../src/constants/school.ts';
import { ALL, EMPTY_BATCH_FILTER, filterBatches, NO_CLASS, setupOf, suggestBatchName } from '../src/screens/tuition/admin-filters.ts';

describe('programs', () => {
  test('the same six programs, subjects and tracks as the server', () => {
    assert.deepEqual([...PROGRAMS], ['JEE', 'NEET', 'MHT_CET_PCM', 'MHT_CET_PCB', 'HSC_SCIENCE', 'GENERAL']);
    const table = Object.fromEntries(PROGRAMS.map((p) => [p, [PROGRAM_INFO[p].subjects.join(''), PROGRAM_INFO[p].allowed.join(''), PROGRAM_INFO[p].track]]));
    assert.deepEqual(table, {
      JEE: ['PhysicsChemistryMathematics', 'PhysicsChemistryMathematics', 'JEE'],
      NEET: ['PhysicsChemistryBiology', 'PhysicsChemistryBiology', 'NEET'],
      MHT_CET_PCM: ['PhysicsChemistryMathematics', 'PhysicsChemistryMathematics', 'General'],
      MHT_CET_PCB: ['PhysicsChemistryBiology', 'PhysicsChemistryBiology', 'General'],
      HSC_SCIENCE: ['PhysicsChemistryMathematicsBiology', 'PhysicsChemistryMathematicsBiology', 'General'],
      GENERAL: ['PhysicsChemistryMathematicsBiology', 'PhysicsChemistryMathematicsBiology', 'General'],
    });
    assert.equal(PROGRAM_LABELS.MHT_CET_PCB, 'MHT-CET PCB');
    assert.equal(PROGRAM_LABELS.GENERAL, 'General Tuition');
  });

  test('only JEE and NEET have a question bank', () => {
    assert.deepEqual(
      PROGRAMS.filter((p) => questionBankOf(p)),
      ['JEE', 'NEET']
    );
    assert.equal(questionBankOf('JEE'), 'JEE');
    assert.equal(questionBankOf('NEET'), 'NEET');
    assert.equal(questionBankOf(null), null);
  });

  test('legacy records get their program from the track', () => {
    assert.equal(programOf({ track: 'JEE' }), 'JEE');
    assert.equal(programOf({ track: 'NEET' }), 'NEET');
    assert.equal(programOf({ track: 'General' }), 'GENERAL');
    assert.equal(programOf({ program: 'HSC_SCIENCE', track: 'General' }), 'HSC_SCIENCE');
    assert.equal(programOf({ program: null, track: null }), null);
    assert.deepEqual(programSubjects(programOf({ track: 'JEE' })), ['Physics', 'Chemistry', 'Mathematics'], 'a legacy JEE student keeps PCM');
    assert.deepEqual(programSubjects(null), ['Physics', 'Chemistry', 'Mathematics', 'Biology']);
  });

  test('subject defaults and limits', () => {
    for (const p of PROGRAMS) assert.equal(subjectProblem(p, PROGRAM_INFO[p].subjects), null, `${p}'s defaults are valid`);
    assert.equal(subjectProblem('JEE', ['Mathematics']), null);
    assert.match(subjectProblem('NEET', ['Mathematics']), /isn't part of NEET/);
    assert.match(subjectProblem('MHT_CET_PCM', []), /at least one/);
    assert.equal(subjectProblem('HSC_SCIENCE', ['Physics', 'Chemistry', 'Biology']), null);
    assert.match(subjectProblem('HSC_SCIENCE', ['Physics', 'Chemistry']), /Mathematics or Biology/);
    assert.match(subjectProblem('HSC_SCIENCE', ['Physics', 'Mathematics']), /Physics and Chemistry/);
    assert.equal(subjectProblem('GENERAL', ['Chemistry']), null);
  });
});

describe('academic year', () => {
  test('defaults to the session in progress; it starts in April, Indian time', () => {
    assert.equal(academicYearOf(new Date('2026-10-30T10:00:00Z')), '2026-2027');
    assert.equal(academicYearOf(new Date('2027-01-10T10:00:00Z')), '2026-2027');
    assert.equal(academicYearOf(new Date('2027-03-31T18:29:00Z')), '2026-2027');
    assert.equal(academicYearOf(new Date('2027-03-31T18:30:00Z')), '2027-2028');
  });

  test('editable: last, this and next year, plus a batch’s own', () => {
    assert.deepEqual(academicYearChoices('2026-2027'), ['2025-2026', '2026-2027', '2027-2028']);
    assert.deepEqual(academicYearChoices('2026-2027', '2022-2023'), ['2022-2023', '2025-2026', '2026-2027', '2027-2028']);
    assert.deepEqual(academicYearChoices('2026-2027', '2026-2027'), ['2025-2026', '2026-2027', '2027-2028']);
    assert.deepEqual(academicYearChoices('2026-2027', null), ['2025-2026', '2026-2027', '2027-2028']);
    assert.equal(formatAcademicYear('2026-2027'), '2026–2027');
  });

  test('read in the usual spellings, checked to be a year and the next', () => {
    assert.equal(parseAcademicYear('2026–2027'), '2026-2027');
    assert.equal(parseAcademicYear('2026-27'), '2026-2027');
    assert.equal(parseAcademicYear('2026-2028'), null);
    assert.equal(parseAcademicYear(''), null);
  });
});

describe('student and batch fit', () => {
  const batch = { name: 'MHT-CET PCB 12th A', program: 'MHT_CET_PCB', track: 'General', standard: '12th' };
  test('same program and class fit; a student without a class fits too', () => {
    assert.equal(fitProblem({ program: 'MHT_CET_PCB', standard: '12th' }, batch), null);
    assert.equal(fitProblem({ program: 'MHT_CET_PCB', standard: null }, batch), null);
  });
  test('another program or class does not', () => {
    assert.match(fitProblem({ program: 'NEET', standard: '12th' }, batch), /NEET, but MHT-CET PCB 12th A is for MHT-CET PCB/);
    assert.match(fitProblem({ program: 'MHT_CET_PCB', standard: '11th' }, batch), /is for 12th/);
    assert.match(fitProblem({ track: 'General' }, batch), /General Tuition/, "a legacy General student isn't an MHT-CET student");
  });
  test('legacy batches for both classes take either class', () => {
    assert.equal(fitProblem({ program: 'JEE', standard: '11th' }, { name: 'Old', track: 'JEE', standard: null }), null);
  });
});

describe('creating batches', () => {
  test('the suggested name: program, class and the next free letter', () => {
    assert.equal(suggestBatchName('NEET 11th', []), 'NEET 11th A');
    assert.equal(suggestBatchName('NEET 11th', ['NEET 11th A', 'neet  11th b ']), 'NEET 11th C');
    assert.equal(suggestBatchName('MHT-CET PCB 12th', ['NEET 12th A']), 'MHT-CET PCB 12th A');
    const all = Array.from({ length: 26 }, (_, i) => `JEE 12th ${String.fromCharCode(65 + i)}`);
    assert.equal(suggestBatchName('JEE 12th', all), 'JEE 12th 27');
  });

  const none = { classes: 0, weeklyMinutes: 0, days: [], withoutTeacher: 0 };
  const b = (extra = {}) => ({ subjects: ['Physics', 'Chemistry', 'Biology'], teachers: [], studentCount: 0, classes: none, ...extra });

  test('a new batch needs teachers, students and timings, all optional', () => {
    const setup = setupOf(b());
    assert.equal(setup.ready, false);
    assert.equal(setup.done, 0);
    assert.deepEqual(setup.missing, ['teachers', 'students', 'timings']);
  });

  test('setup status as each part is done', () => {
    const teachers = ['Physics', 'Chemistry', 'Biology'].map((subject) => ({ teacherId: subject, name: subject, subject }));
    assert.deepEqual(setupOf(b({ teachers: teachers.slice(0, 2), studentCount: 4 })).missing, ['teachers', 'timings'], 'one subject still without a teacher');
    const ready = setupOf(b({ teachers, studentCount: 4, classes: { classes: 6, weeklyMinutes: 360, days: [1, 2, 3], withoutTeacher: 0 } }));
    assert.equal(setupOf(b({ teachers, studentCount: 4, schedule: [{ day: 1, start: '07:00', end: '09:00' }] })).ready, false, 'older time-only slots are not a timetable');
    assert.equal(ready.ready, true);
    assert.equal(ready.done, 3);
  });
});

describe('batch filters', () => {
  const batches = [
    { id: 'a', program: 'NEET', standard: '11th' },
    { id: 'b', program: 'NEET', standard: '12th' },
    { id: 'c', program: 'MHT_CET_PCM', standard: '11th' },
    { id: 'd', program: 'GENERAL', standard: null }, // a legacy batch for both classes
  ];
  const ids = (list) => list.map((x) => x.id);
  test('by program and class', () => {
    assert.deepEqual(ids(filterBatches(batches, EMPTY_BATCH_FILTER)), ['a', 'b', 'c', 'd']);
    assert.deepEqual(ids(filterBatches(batches, { program: 'NEET', standard: ALL })), ['a', 'b']);
    assert.deepEqual(ids(filterBatches(batches, { program: ALL, standard: '11th' })), ['a', 'c']);
    assert.deepEqual(ids(filterBatches(batches, { program: 'NEET', standard: '12th' })), ['b']);
    assert.deepEqual(ids(filterBatches(batches, { program: ALL, standard: NO_CLASS })), ['d']);
    assert.deepEqual(ids(filterBatches(batches, { program: 'HSC_SCIENCE', standard: ALL })), []);
  });
});
