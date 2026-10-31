// Tuition admin focused tests: the Students and Teachers filters and the
// Batches summaries.
//   node --experimental-strip-types --test tests/tuition-admin.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  activeFilterCount,
  batchesLost,
  commonTime,
  EMPTY_STUDENT_FILTER,
  filterStudents,
  filterTeachers,
  groupTeacherBatches,
  initials,
  missingTeachers,
  NO_BATCH,
  NO_SUBJECTS,
  participation,
  scheduleByDay,
  groupTests,
  testCounts,
} from '../src/screens/tuition/admin-filters.ts';

const student = (id, extra = {}) => ({
  id,
  name: id,
  email: `${id.toLowerCase()}@mail.com`,
  phone: '',
  parentPhone: '',
  program: 'NEET',
  track: 'NEET',
  standard: '11th',
  batch: null,
  active: true,
  lastLoginAt: null,
  createdAt: '',
  ...extra,
});

const students = [
  student('Asha', { program: 'JEE', track: 'JEE', standard: '12th', batch: { id: 'b1', name: 'JEE Morning' } }),
  student('Ravi', { batch: { id: 'b2', name: 'NEET Evening' } }),
  student('Meera', { program: 'GENERAL', track: 'General', standard: null }),
  student('Kabir', { email: 'kabir.k@school.in', standard: '12th' }),
];
const names = (list) => list.map((s) => s.name);
const f = (patch) => ({ ...EMPTY_STUDENT_FILTER, ...patch });

describe('student filters', () => {
  test('no filter: everyone', () => {
    assert.deepEqual(names(filterStudents(students, EMPTY_STUDENT_FILTER)), ['Asha', 'Ravi', 'Meera', 'Kabir']);
    assert.equal(activeFilterCount(EMPTY_STUDENT_FILTER), 0);
  });

  test('search matches name or email, any case, ignoring spaces around it', () => {
    assert.deepEqual(names(filterStudents(students, f({ search: '  aSh ' }))), ['Asha']);
    assert.deepEqual(names(filterStudents(students, f({ search: 'school.in' }))), ['Kabir']);
  });

  test('program and class', () => {
    assert.deepEqual(names(filterStudents(students, f({ program: 'NEET' }))), ['Ravi', 'Kabir']);
    assert.deepEqual(names(filterStudents(students, f({ standard: '12th' }))), ['Asha', 'Kabir']);
    assert.deepEqual(names(filterStudents(students, f({ program: 'NEET', standard: '12th' }))), ['Kabir']);
  });

  test('one batch, or no batch', () => {
    assert.deepEqual(names(filterStudents(students, f({ batch: 'b2' }))), ['Ravi']);
    assert.deepEqual(names(filterStudents(students, f({ batch: NO_BATCH }))), ['Meera', 'Kabir']);
  });

  test('counts each filter that narrows the list', () => {
    assert.equal(activeFilterCount(f({ search: ' ', program: 'JEE', batch: NO_BATCH })), 2);
  });
});

const teacher = (name, subjects, batches = []) => ({ id: name, name, email: `${name}@mail.com`, phone: '', subjects, active: true, createdAt: '', lastLoginAt: null, batches });

describe('teacher filters', () => {
  const teachers = [teacher('Iyer', ['Physics', 'Mathematics']), teacher('Das', ['Biology']), teacher('New', [])];

  test('by subject, or no subjects', () => {
    assert.deepEqual(names(filterTeachers(teachers, { search: '', subject: 'Mathematics' })), ['Iyer']);
    assert.deepEqual(names(filterTeachers(teachers, { search: '', subject: NO_SUBJECTS })), ['New']);
    assert.deepEqual(names(filterTeachers(teachers, { search: 'das@', subject: 'all' })), ['Das']);
  });

  test('dropping a subject loses the batches taught in it', () => {
    const t = teacher('Iyer', ['Physics', 'Mathematics'], [
      { id: 'b1', name: 'JEE A', subject: 'Physics' },
      { id: 'b1', name: 'JEE A', subject: 'Mathematics' },
      { id: 'b2', name: 'JEE B', subject: 'Physics' },
    ]);
    assert.deepEqual(batchesLost(t, ['Mathematics']).map((b) => `${b.name}/${b.subject}`), ['JEE A/Physics', 'JEE B/Physics']);
    assert.deepEqual(batchesLost(t, ['Physics', 'Mathematics']), []);
    assert.deepEqual(groupTeacherBatches(t.batches), [
      { id: 'b1', name: 'JEE A', subjects: ['Physics', 'Mathematics'] },
      { id: 'b2', name: 'JEE B', subjects: ['Physics'] },
    ]);
  });
});

describe('batch summaries', () => {
  test('subjects without a teacher', () => {
    const batch = { subjects: ['Physics', 'Chemistry', 'Biology'], teachers: [{ teacherId: 't', name: 'T', subject: 'Chemistry' }] };
    assert.deepEqual(missingTeachers(batch), ['Physics', 'Biology']);
    assert.deepEqual(missingTeachers({ subjects: ['Physics'], teachers: [{ teacherId: 't', name: 'T', subject: 'Physics' }] }), []);
  });

  test('week runs Monday to Sunday, each day in start order', () => {
    const week = scheduleByDay([
      { day: 0, start: '09:00', end: '10:00' },
      { day: 1, start: '16:00', end: '18:00' },
      { day: 1, start: '07:00', end: '08:00' },
    ]);
    assert.deepEqual(week.map((d) => d.day), [1, 2, 3, 4, 5, 6, 0]);
    assert.deepEqual(week[0].slots.map((s) => s.start), ['07:00', '16:00']);
    assert.equal(week[6].slots.length, 1);
  });

  test('a shared class time only when every class has it', () => {
    assert.equal(commonTime([]), null);
    assert.deepEqual(commonTime([{ day: 1, start: '16:00', end: '18:00' }, { day: 3, start: '16:00', end: '18:00' }]), { start: '16:00', end: '18:00' });
    assert.equal(commonTime([{ day: 1, start: '16:00', end: '18:00' }, { day: 3, start: '16:00', end: '17:30' }]), null);
  });

  test('participation as a share of the batch', () => {
    assert.deepEqual(participation({ submitted: 3, batchStudents: 8 }), { submitted: 3, total: 8, percent: 38 });
    assert.equal(participation({ submitted: 0, batchStudents: 0 }).percent, 0);
  });

  test('initials', () => {
    assert.equal(initials('Asha Rao'), 'AR');
    assert.equal(initials(' meera  k  iyer '), 'MI');
    assert.equal(initials(''), '?');
  });
});

describe('tuition tests list', () => {
  const t = (id, status, opensAt, closesAt = null) => ({ id, status, opensAt, closesAt });
  const tests = [
    t('ended-old', 'closed', '2026-10-01T09:00:00Z', '2026-10-02T09:00:00Z'),
    t('soon', 'scheduled', '2026-11-01T09:00:00Z'),
    t('open-no-end', 'open', '2026-10-20T09:00:00Z'),
    t('ended-new', 'closed', '2026-10-20T09:00:00Z', '2026-10-25T09:00:00Z'),
    t('open-closing', 'open', '2026-10-21T09:00:00Z', '2026-10-29T09:00:00Z'),
    t('later', 'scheduled', '2026-12-01T09:00:00Z'),
  ];
  const ids = (groups) => groups.map((g) => [g.status, g.tests.map((x) => x.id)]);

  test('all: active, then upcoming, then ended, each in its own order', () => {
    assert.deepEqual(ids(groupTests(tests, 'all')), [
      ['open', ['open-closing', 'open-no-end']],
      ['scheduled', ['soon', 'later']],
      ['closed', ['ended-new', 'ended-old']],
    ]);
  });

  test('one state only, and empty states are left out', () => {
    assert.deepEqual(ids(groupTests(tests, 'scheduled')), [['scheduled', ['soon', 'later']]]);
    assert.deepEqual(groupTests(tests.filter((x) => x.status !== 'open'), 'open'), []);
  });

  test('counts per state', () => {
    assert.deepEqual(testCounts(tests), { open: 2, scheduled: 2, closed: 2 });
    assert.deepEqual(testCounts([]), { open: 0, scheduled: 0, closed: 0 });
  });

  test("grouping doesn't reorder the caller's list", () => {
    const copy = [...tests];
    groupTests(tests, 'all');
    assert.deepEqual(tests, copy);
  });
});
