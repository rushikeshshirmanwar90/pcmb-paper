// Step 2.5 focused tests: the API address (live for release builds, local
// when asked), the subject timetable editor's rules, and the programs offered
// for new batches and students.
//   node --experimental-strip-types --test tests/step25.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PRODUCTION_API_ORIGIN, resolveApiOrigin } from '../src/services/api-origin.ts';
import {
  classProblem,
  dateToTime,
  daysLabel,
  duration,
  from12,
  label12,
  sortClasses,
  TEACHING_DAYS,
  timeToDate,
  to12,
  weeklyMinutes,
} from '../src/screens/tuition/timetable-draft.ts';
import { OFFERED_PROGRAMS, programChoices } from '../src/constants/school.ts';

describe('API address', () => {
  const at = (patch) => resolveApiOrigin({ dev: true, configured: undefined, hostUri: '192.168.1.20:8081', platform: 'android', ...patch });

  test('release builds always use the live server', () => {
    assert.deepEqual(resolveApiOrigin({ dev: false, configured: 'http://192.168.1.20:3000', platform: 'android' }), { origin: PRODUCTION_API_ORIGIN, source: 'production' });
    assert.equal(resolveApiOrigin({ dev: false, configured: 'local', hostUri: 'localhost:8081', platform: 'ios' }).origin, 'https://papers-jet.vercel.app');
  });

  test('development defaults to local, including empty or invalid configuration', () => {
    assert.equal(at({}).origin, 'http://192.168.1.20:3000');
    assert.equal(at({ configured: '  ' }).origin, 'http://192.168.1.20:3000');
    assert.equal(at({ configured: 'nonsense' }).origin, 'http://192.168.1.20:3000');
  });

  test('"local": the computer Metro runs on, port 3000', () => {
    assert.deepEqual(at({ configured: 'local' }), { origin: 'http://192.168.1.20:3000', source: 'local' }, 'a phone on the same Wi-Fi');
    assert.equal(at({ configured: 'local:4000' }).origin, 'http://192.168.1.20:4000');
    assert.equal(at({ configured: 'local', hostUri: 'localhost:8081' }).origin, 'http://10.0.2.2:3000', 'the Android emulator');
    assert.equal(at({ configured: 'local', hostUri: '127.0.0.1:8081', platform: 'ios' }).origin, 'http://127.0.0.1:3000', 'the iOS simulator');
    assert.equal(at({ configured: 'local', hostUri: null, platform: 'android' }).origin, 'http://10.0.2.2:3000');
    assert.equal(at({ configured: 'local', hostUri: null, platform: 'ios' }).origin, 'http://localhost:3000');
  });

  test('an explicit address is used as given, without a trailing /api', () => {
    assert.deepEqual(at({ configured: 'http://10.0.0.5:3000/api/' }), { origin: 'http://10.0.0.5:3000', source: 'configured' });
  });
});

describe('subject timetable editor', () => {
  const cls = (id, subject, day, start, end) => ({ id, subject, day, start, end });
  // Physics Monday 10 AM, Chemistry Monday 12 PM, Biology Tuesday 10 AM.
  const week = [cls('p', 'Physics', 1, '10:00', '11:00'), cls('c', 'Chemistry', 1, '12:00', '13:00'), cls('b', 'Biology', 2, '10:00', '11:00')];

  test('Monday to Saturday are the teaching days; Sunday is only a choice', () => {
    assert.deepEqual([...TEACHING_DAYS], [1, 2, 3, 4, 5, 6]);
    assert.ok(!TEACHING_DAYS.includes(0));
    assert.match(classProblem(week, [], '10:00', '11:00'), /at least one day/, 'no day is picked by itself');
    assert.equal(classProblem(week, [0], '10:00', '11:00'), null, 'Sunday when picked');
  });

  test('12-hour display, 24-hour storage', () => {
    assert.equal(label12('16:30'), '4:30 PM');
    assert.equal(label12('00:05'), '12:05 AM');
    assert.equal(label12('12:00'), '12:00 PM');
    assert.equal(from12(4, 30, true), '16:30');
    assert.equal(from12(12, 0, false), '00:00');
    assert.equal(from12(12, 15, true), '12:15');
    assert.deepEqual(to12('07:05'), { hour: 7, minute: 5, pm: false });
    assert.equal(dateToTime(timeToDate('18:45')), '18:45', 'native pickers round-trip');
    assert.equal(duration('16:00', '17:30'), '1 h 30 min');
  });

  test('several subjects on one day; one subject on several days', () => {
    assert.equal(classProblem(week, [1], '11:00', '12:00'), null, 'Monday 11–12 fits between Physics and Chemistry');
    assert.equal(classProblem(week, [3, 5], '10:00', '11:00'), null, 'Physics again on Wednesday and Friday');
    assert.equal(daysLabel([1, 3, 5]), 'Mon, Wed, Fri');
    assert.equal(daysLabel(TEACHING_DAYS), 'Mon–Sat');
    assert.equal(weeklyMinutes(week), 180);
  });

  test('overlaps in the batch are refused, on any picked day; back to back is fine', () => {
    assert.match(classProblem(week, [3, 1], '10:30', '11:30'), /On Monday it overlaps Physics, 10:00 AM – 11:00 AM/);
    assert.match(classProblem(week, [2], '09:30', '10:01'), /Tuesday it overlaps Biology/);
    assert.equal(classProblem(week, [1], '11:00', '12:00'), null);
    assert.match(classProblem(week, [4], '11:00', '10:00'), /end after it starts/);
  });

  test('moving a class is checked against the others, not itself', () => {
    assert.equal(classProblem(week, [1], '10:15', '11:15', 'p'), null);
    assert.match(classProblem(week, [1], '11:30', '12:30', 'p'), /overlaps Chemistry/);
  });

  test('timetable order: Monday first, Sunday last, then by time', () => {
    const sorted = sortClasses([cls('s', 'Physics', 0, '09:00', '10:00'), ...week.slice().reverse()]);
    assert.deepEqual(sorted.map((c) => c.id), ['p', 'c', 'b', 's']);
  });
});

describe('programs offered in this release', () => {
  test('JEE and NEET for anything new; a record keeps its own program', () => {
    assert.deepEqual([...OFFERED_PROGRAMS], ['JEE', 'NEET']);
    assert.deepEqual(programChoices(), ['JEE', 'NEET']);
    assert.deepEqual(programChoices('NEET'), ['JEE', 'NEET']);
    assert.deepEqual(programChoices('MHT_CET_PCB'), ['JEE', 'NEET', 'MHT_CET_PCB'], 'an existing MHT-CET batch isn\'t reclassified');
  });
});
