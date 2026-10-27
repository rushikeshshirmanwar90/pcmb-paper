import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, DetailSheet, EmptyView, ErrorView, Icon, ListRow, LoadingView, Muted, Notice, ProgressBar, Screen, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { SCHOOL_SUBJECTS, WEEKDAY_NAMES, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { useDataVersion } from '@/context/data-version';
import { useTabNavigation } from '@/context/tab-context';
import { syncClassReminders } from '@/services/notifications';
import { AnnouncementsSection } from '@/screens/shared/announcements';
import { ClassRow, WeekTimetable } from '@/screens/shared/timetable';
import { nextClass, type NextClass } from '@/screens/student/home-next-up';
import { PracticeSheet } from '@/screens/student/student-pyq';
import { TestList } from '@/screens/student/student-tests';
import { byUrgency, kindOf, percentOf, resultTone, type ListedTest } from '@/screens/student/test-format';
import { TestRunner } from '@/screens/student/test-runner';
import { dayLabel } from '@/services/school-api';
import { studentApi, type StudentOverview, type TopicStat } from '@/services/student-api';
import { formatTime } from '@/services/tuition-api';

const RECENT_ON_HOME = 3;
const WEAK_ON_HOME = 3;

const asSubject = (s: string): SchoolSubject | null => ((SCHOOL_SUBJECTS as readonly string[]).includes(s) ? (s as SchoolSubject) : null);

/**
 * A student's day, most useful first: what to do next (a test, or the next
 * class), today's classes, how they're doing, then announcements. The whole
 * week and every topic covered lately are a tap away.
 */
export function StudentHomeScreen() {
  const user = useSignedInUser();
  const version = useDataVersion();
  const { goToTab } = useTabNavigation();
  // The overview's open tests don't say whether one is under way, so the
  // student's test list (which does) loads alongside it. If that list fails,
  // the tests still show, with a neutral "Open test" instead of a guess.
  const { data: loaded, error, loading, refreshing, refresh, reload } = useLoad(async () => {
    const [overview, tests] = await Promise.all([studentApi.overview(), studentApi.tests().catch(() => null)]);
    return { overview, tests, at: Date.now() };
  }, [version]);
  const data = loaded?.overview ?? null;
  // Reminders 15 minutes before each weekly class.
  const week = data?.week;
  useEffect(() => {
    if (week) void syncClassReminders(week);
  }, [week]);
  const [openTest, setOpenTest] = useState<string | null>(null);
  const [showWeek, setShowWeek] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [practise, setPractise] = useState<{ subject: SchoolSubject; chapter: string } | null>(null);

  // "Now" is when the data loaded, so Next up matches what was fetched.
  const now = loaded?.at ?? 0;
  const mineOf = (id: string) => (loaded?.tests ? loaded.tests.find((t) => t.id === id)?.mine ?? null : undefined);
  const toTake: ListedTest[] = (data?.openTests ?? [])
    .map((t) => ({ ...t, mine: mineOf(t.id) }))
    .filter((t) => ['start', 'continue', 'open'].includes(kindOf(t, now)))
    .sort(byUrgency);
  const upNextClass = data?.batch ? nextClass(data.week, new Date(now)) : null;

  return (
    <Screen
      title={`Hi, ${user.name.split(' ')[0]}`}
      subtitle={data?.batch ? `${data.batch.name} · ${user.tuition.name}` : user.tuition.name}
      onRefresh={refresh}
      refreshing={refreshing}
    >
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data ? (
        <>
          {!data.batch ? (
            <Notice title="You're not in a batch yet" text="Your tuition will add you to one; then your classes, tests and syllabus show here." />
          ) : null}

          {/* Next up: the most urgent test, else the class on now or next. */}
          <SectionTitle title="Next up" />
          {toTake.length ? (
            <>
              <TestList tests={toTake.slice(0, 1)} onOpen={setOpenTest} />
              {toTake.length > 1 ? (
                <Card style={styles.listCard}>
                  <ListRow
                    icon={{ ios: 'list.clipboard', android: 'assignment' }}
                    title={`${toTake.length - 1} more test${toTake.length === 2 ? '' : 's'} to take`}
                    subtitle="See them in Tests"
                    onPress={() => goToTab('tests')}
                    last
                  />
                </Card>
              ) : null}
            </>
          ) : upNextClass ? (
            <NextClassCard next={upNextClass} />
          ) : (
            <Card>
              <EmptyView
                icon={{ ios: 'checkmark.circle', android: 'task_alt' }}
                title="You're all caught up"
                text={data.batch ? 'No tests to take and no classes in your timetable yet.' : 'Tests and classes show here once you join a batch.'}
              />
            </Card>
          )}

          {/* Today: today's classes; the week is a tap away. */}
          {data.batch ? (
            <>
              <SectionTitle title="Today" />
              <Card>
                {data.today.length ? data.today.map((e) => <ClassRow key={e.id} entry={e} />) : <Muted>No classes today.</Muted>}
              </Card>
              <Card style={styles.listCard}>
                <ListRow
                  icon={{ ios: 'calendar', android: 'calendar_month' }}
                  title="Weekly timetable"
                  subtitle={data.week.length ? `${data.week.length} class${data.week.length === 1 ? '' : 'es'} a week` : 'No classes added yet'}
                  onPress={() => setShowWeek(true)}
                  last
                />
              </Card>
            </>
          ) : null}

          {/* Your progress: last result, weak topics to practise, syllabus. */}
          <SectionTitle title="Your progress" />
          <ResultCard insight={data.insight} onPractise={(subject, chapter) => setPractise({ subject, chapter })} />
          {data.batch ? (
            <SyllabusCard batch={data.batch} recent={data.recent} onShowRecent={() => setShowRecent(true)} />
          ) : null}

          <AnnouncementsSection batches={[]} canPost={false} allowAllBatches={false} limit={2} />

          <DetailSheet visible={showWeek} title="Weekly timetable" onClose={() => setShowWeek(false)}>
            <WeekTimetable entries={data.week} emptyText="Your teachers haven't added classes yet." />
          </DetailSheet>
          <DetailSheet visible={showRecent} title="Covered in class lately" onClose={() => setShowRecent(false)}>
            <Card style={styles.listCard}>
              {data.recent.map((r, i) => (
                <ListRow key={r.id} title={r.topic || r.chapter} subtitle={`${r.subject}${r.topic ? ` · ${r.chapter}` : ''} · ${dayLabel(r.coveredOn)}`} last={i === data.recent.length - 1} />
              ))}
            </Card>
          </DetailSheet>
        </>
      ) : null}
      {openTest ? <TestRunner testId={openTest} onClose={() => setOpenTest(null)} /> : null}
      {practise ? <PracticeSheet subject={practise.subject} chapter={practise.chapter} onClose={() => setPractise(null)} /> : null}
    </Screen>
  );
}

function NextClassCard({ next }: { next: NextClass }) {
  const palette = usePalette();
  const { entry, inDays, ongoing } = next;
  const when = ongoing
    ? `On now · until ${formatTime(entry.end)}`
    : `${inDays === 0 ? 'Today' : inDays === 1 ? 'Tomorrow' : WEEKDAY_NAMES[entry.day]}, ${formatTime(entry.start)}`;
  const details = [entry.batch.venue, entry.teacher.name, entry.note || null].filter(Boolean).join(' · ');
  return (
    <Card style={styles.nextCard}>
      <View accessible accessibilityLabel={`Next class: ${entry.subject}, ${when}${details ? `, ${details}` : ''}`} style={styles.nextTop}>
        <View style={[styles.tile, { backgroundColor: ongoing ? palette.successSoft : palette.primarySoft }]}>
          <Icon name={{ ios: 'book', android: 'menu_book' }} color={ongoing ? palette.success : palette.primary} size={20} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.eyebrow, { color: ongoing ? palette.successInk : palette.primary }]}>{ongoing ? 'Class on now' : 'Next class'}</Text>
          <Text style={[styles.nextTitle, { color: palette.foreground }]}>{entry.subject}</Text>
          <Text style={[styles.meta, { color: palette.foreground }]}>{when}</Text>
          {details ? <Text style={[styles.meta, { color: palette.mutedForeground }]}>{details}</Text> : null}
        </View>
      </View>
    </Card>
  );
}

function ResultCard({ insight, onPractise }: { insight: StudentOverview['insight']; onPractise: (subject: SchoolSubject, chapter: string) => void }) {
  const palette = usePalette();
  const last = insight.lastResult;
  const percent = last ? percentOf(last.score, last.maxScore) : null;
  const weak = insight.weak.slice(0, WEAK_ON_HOME);
  return (
    <Card style={styles.progressCard}>
      {last && percent !== null ? (
        <View accessible accessibilityLabel={`Last test, ${last.title}: ${last.score} of ${last.maxScore}, ${percent} percent`} style={styles.lastRow}>
          <View style={styles.flex}>
            <Text style={[styles.eyebrow, { color: palette.mutedForeground }]}>Last test · {dayLabel(last.submittedAt)}</Text>
            <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={2}>
              {last.title}
            </Text>
          </View>
          <View style={styles.scoreCol}>
            <Text style={[styles.score, { color: palette.foreground }]}>
              {last.score}
              <Text style={[styles.scoreOf, { color: palette.mutedForeground }]}>/{last.maxScore}</Text>
            </Text>
            <Badge label={`${percent}%`} tone={resultTone(percent)} />
          </View>
        </View>
      ) : (
        <Muted>Take tests and practise PYQs; your results and weak topics show here.</Muted>
      )}

      {weak.length ? (
        <View style={styles.weak}>
          <Text style={[styles.cardHeading, { color: palette.foreground }]}>Needs work</Text>
          {weak.map((t) => (
            <WeakTopicRow key={`${t.subject}|${t.chapter}|${t.topic}`} stat={t} onPractise={onPractise} />
          ))}
        </View>
      ) : null}

      {insight.strong.length ? (
        <Text style={[styles.meta, { color: palette.successInk }]}>
          Strong: {insight.strong.slice(0, 3).map((s) => s.topic || s.chapter).join(', ')}
        </Text>
      ) : null}
    </Card>
  );
}

function WeakTopicRow({ stat, onPractise }: { stat: TopicStat; onPractise: (subject: SchoolSubject, chapter: string) => void }) {
  const palette = usePalette();
  const subject = asSubject(stat.subject);
  const name = stat.topic || stat.chapter;
  return (
    <View style={[styles.weakRow, { borderTopColor: palette.border }]}>
      <View style={styles.flex} accessible accessibilityLabel={`${name}, ${stat.subject}, ${stat.accuracy} percent right`}>
        <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={1}>
          {stat.subject}
          {stat.topic ? ` · ${stat.chapter}` : ''} · <Text style={{ color: palette.dangerInk, fontWeight: '700' }}>{stat.accuracy}% right</Text>
        </Text>
      </View>
      {subject ? (
        <Button
          label="Practise"
          variant="tonal"
          onPress={() => onPractise(subject, stat.chapter)}
          accessibilityLabel={`Practise ${stat.chapter} past-year questions`}
          style={styles.practise}
        />
      ) : null}
    </View>
  );
}

function SyllabusCard({ batch, recent, onShowRecent }: { batch: NonNullable<StudentOverview['batch']>; recent: StudentOverview['recent']; onShowRecent: () => void }) {
  const palette = usePalette();
  return (
    <Card style={styles.progressCard}>
      <Text style={[styles.cardHeading, { color: palette.foreground }]}>Syllabus covered</Text>
      {batch.subjects.map((s) => {
        const c = batch.coverage[s];
        return (
          <View key={s} style={styles.coverage} accessible accessibilityLabel={`${s}, ${c?.total ? `${c.percent} percent covered` : 'no syllabus'}`}>
            <View style={styles.coverageTop}>
              <Text style={[styles.subject, { color: palette.foreground }]}>{s}</Text>
              <Text style={[styles.meta, { color: palette.mutedForeground }]}>{c?.total ? `${c.percent}%` : '–'}</Text>
            </View>
            <ProgressBar value={c?.percent ?? 0} tone="success" />
          </View>
        );
      })}
      {recent.length ? (
        <View style={[styles.recent, { borderTopColor: palette.border }]}>
          <Text style={[styles.eyebrow, { color: palette.mutedForeground }]}>Covered in class lately</Text>
          {recent.slice(0, RECENT_ON_HOME).map((r) => (
            <Text key={r.id} style={[styles.meta, { color: palette.foreground }]} numberOfLines={1}>
              {r.topic || r.chapter} <Text style={{ color: palette.mutedForeground }}>· {r.subject} · {dayLabel(r.coveredOn)}</Text>
            </Text>
          ))}
          {recent.length > RECENT_ON_HOME ? (
            <ListRow title={`See all ${recent.length}`} onPress={onShowRecent} last accessibilityLabel={`See all ${recent.length} topics covered lately`} />
          ) : null}
        </View>
      ) : (
        <Muted>Your teachers mark topics here as they teach them.</Muted>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  listCard: { paddingVertical: 0 },
  nextCard: { padding: 16 },
  nextTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  nextTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800', marginTop: 2 },
  meta: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  progressCard: { gap: 12, padding: 16 },
  lastRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', marginTop: 2 },
  scoreCol: { alignItems: 'flex-end', gap: 4 },
  score: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreOf: { fontSize: 14, fontWeight: '600' },
  cardHeading: { fontSize: 15, fontWeight: '700' },
  weak: { gap: 2 },
  weakRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  practise: { minHeight: 44, paddingHorizontal: 14 },
  coverage: { gap: 5 },
  coverageTop: { flexDirection: 'row', justifyContent: 'space-between' },
  subject: { fontSize: 14, fontWeight: '600' },
  recent: { gap: 4, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
