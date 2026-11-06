// Tuition Home: what needs attention, today's classes and syllabus progress.
//   node --experimental-strip-types --test tests/tuition-home.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { attentionItems, classesOnDay, overallCoverage } from '../src/screens/tuition/admin-filters.ts';

const batch = (id, extra = {}) => ({
  id,
  name: `Batch ${id}`,
  subjects: ['Physics', 'Chemistry'],
  teachers: [
    { teacherId: 't1', name: 'Rao', subject: 'Physics' },
    { teacherId: 't2', name: 'Iyer', subject: 'Chemistry' },
  ],
  classes: { classes: 5, weeklyMinutes: 300, days: [1, 3], withoutTeacher: 0 },
  ...extra,
});
const none = { pendingStudents: 0, pendingTeachers: 0, unassignedStudents: 0 };

describe('attentionItems', () => {
  test('is empty when everything is set up', () => {
    assert.deepEqual(attentionItems({ ...none, batches: [batch('a'), batch('b')] }), []);
    assert.deepEqual(attentionItems({ ...none, batches: [] }), []);
  });

  test('lists items most urgent first and skips those with a count of zero', () => {
    const items = attentionItems({
      pendingStudents: 3,
      pendingTeachers: 1,
      unassignedStudents: 4,
      batches: [batch('a', { teachers: [] }), batch('b', { classes: { classes: 0, weeklyMinutes: 0, days: [], withoutTeacher: 0 } })],
    });
    assert.deepEqual(
      items.map((i) => [i.kind, i.count]),
      [['students', 3], ['teachers', 1], ['noTeacher', 1], ['noBatch', 4], ['noTimetable', 1]]
    );
  });

  test('names the batches concerned so one can be opened directly', () => {
    const items = attentionItems({ ...none, batches: [batch('a', { teachers: [] }), batch('b'), batch('c', { teachers: [{ teacherId: 't', name: 'X', subject: 'Physics' }] })] });
    assert.deepEqual(items.find((i) => i.kind === 'noTeacher').batches, [{ id: 'a', name: 'Batch a' }, { id: 'c', name: 'Batch c' }]);
  });

  test('does not flag a new batch for having no students yet', () => {
    assert.deepEqual(attentionItems({ ...none, batches: [batch('a', { studentCount: 0 })] }), []);
  });
});

describe('classesOnDay', () => {
  const entries = [
    { id: '1', day: 1, start: '16:00' },
    { id: '2', day: 2, start: '09:00' },
    { id: '3', day: 1, start: '08:30' },
  ];
  test('keeps one weekday, earliest first', () => {
    assert.deepEqual(classesOnDay(entries, 1).map((e) => e.id), ['3', '1']);
    assert.deepEqual(classesOnDay(entries, 0), []);
  });
  test('does not change the list it is given', () => {
    classesOnDay(entries, 1);
    assert.deepEqual(entries.map((e) => e.id), ['1', '2', '3']);
  });
});

describe('overallCoverage', () => {
  test('adds up the topics across subjects', () => {
    assert.deepEqual(overallCoverage({ Physics: { covered: 10, total: 40, percent: 25 }, Chemistry: { covered: 30, total: 40, percent: 75 } }), { covered: 40, total: 80, percent: 50 });
  });
  test('ignores subjects without a syllabus', () => {
    assert.equal(overallCoverage({ Physics: { covered: 0, total: 0, percent: 0 }, Maths: { covered: 3, total: 4, percent: 75 } }).percent, 75);
  });
  test('is null when there is no syllabus at all', () => {
    assert.equal(overallCoverage({}), null);
    assert.equal(overallCoverage(undefined), null);
    assert.equal(overallCoverage({ Physics: { covered: 0, total: 0, percent: 0 } }), null);
  });
});
