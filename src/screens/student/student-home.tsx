import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/app-text';
import { useRouter } from 'expo-router';
import { Button, Card, DetailSheet, EmptyView, ErrorView, Icon, Muted, Notice, Screen, SectionTitle, StatusChip, useLoad, usePalette, type IconName } from '@/components/kit';
import { SubjectChips } from '@/components/subject-chips';
import { PatternBackdrop, SubjectMark } from '@/design/illustrations';
import { NeoTag, NeoText } from '@/design/neo-kit';
import type { StatusKind } from '@/design/status';
import { SkeletonCard, StaleNotice } from '@/components/states';
import { programOf, questionBankOf, SCHOOL_SUBJECTS, WEEKDAY_NAMES, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { useTabDataVersion } from '@/context/data-version';
import { useTabNavigation } from '@/context/tab-context';
import { useEngagement } from '@/engagement/engagement-provider';
import { syncClassReminders } from '@/services/notifications';
import { AnnouncementsSection } from '@/screens/shared/announcements';
import { WeekTimetable } from '@/screens/shared/timetable';
import { Bubble } from '@/screens/auth-ui';
import { nextClass, todayStates, type ClassState, type NextClass } from '@/screens/student/home-next-up';
import { ContinueCard } from '@/screens/student/practice/continue-card';
import { practiceChapterHref } from '@/screens/student/practice/practice-links';
import { ProgressHeader } from '@/screens/student/progress-header';
import { byUrgency, closesSoon, kindOf, subjectIcon, untilLabel, whenLabel, type ListedTest, type TestKind } from '@/screens/student/test-format';
import { TestRunner } from '@/screens/student/test-runner';
import { dayLabel, type TimetableEntry } from '@/services/school-api';
import { studentApi, type StudentOverview, type TopicStat } from '@/services/student-api';
import { formatTime } from '@/services/tuition-api';
import { face } from '@/design/type';
import { Neo } from '@/design/tokens';

const WEAK_ON_HOME = 3;

const asSubject = (s: string): SchoolSubject | null => ((SCHOOL_SUBJECTS as readonly string[]).includes(s) ? (s as SchoolSubject) : null);

/** The time now, refreshed every minute, so today's classes move from next to on now to done. */
function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/**
 * A student's day, most useful first (Home answers "what should I do now?"):
 * the progress header, what to do next (a test, or the next class), today's
 * classes, the topics to fix, then announcements. The week is a tap away; the
 * syllabus gauge and what was covered lately live on the Syllabus tab, with a
 * one-line link here.
 */
export function StudentHomeScreen() {
  const user = useSignedInUser();
  const version = useTabDataVersion('home');
  const { goToTab } = useTabNavigation();
  const router = useRouter();
  const clock = useNow();
  // The overview's open tests don't say whether one is under way, so the
  // student's test list (which does) loads alongside it. If that list fails,
  // the tests still show, with a neutral "Open test" instead of a guess.
  const { data: loaded, error, loading, refreshing, refresh, reload } = useLoad(async () => {
    const [overview, tests] = await Promise.all([studentApi.overview(), studentApi.tests().catch(() => null)]);
    return { overview, tests, at: Date.now() };
  }, [version]);
  const data = loaded?.overview ?? null;
  // Pull to refresh also reloads the progress header.
  const engagement = useEngagement();
  const refreshAll = () => {
    refresh();
    engagement.reload();
  };
  // Reminders 15 minutes before each weekly class.
  const week = data?.week;
  useEffect(() => {
    if (week) void syncClassReminders(week);
  }, [week]);
  const [openTest, setOpenTest] = useState<string | null>(null);
  const [showWeek, setShowWeek] = useState(false);
  // A weak topic's Practise opens that chapter (or topic) in topic practice,
  // for programs with a question bank only.
  const practise = questionBankOf(programOf(user))
    ? (subject: SchoolSubject, chapter: string, topic: string) => router.push(practiceChapterHref({ subject, chapter, topic: topic || null }))
    : null;

  // "Now" is when the data loaded, so Next up matches what was fetched.
  const now = loaded?.at ?? 0;
  const mineOf = (id: string) => (loaded?.tests ? loaded.tests.find((t) => t.id === id)?.mine ?? null : undefined);
  const toTake: ListedTest[] = (data?.openTests ?? [])
    .map((t) => ({ ...t, mine: mineOf(t.id) }))
    .filter((t) => ['start', 'continue', 'open'].includes(kindOf(t, now)))
    .sort(byUrgency);
  const upNextClass = data?.batch ? nextClass(data.week, new Date(now)) : null;

  // "Wednesday, 4 November · NEET 2027 Morning": today's date sets the scene for Today below.
  const date = new Date(clock).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen
      title={`Hello, ${user.name.split(' ')[0]}`}
      subtitle={`${date} · ${data?.batch ? data.batch.name : user.tuition.name}`}
      headerArt={<PatternBackdrop />}
      onRefresh={refreshAll}
      refreshing={refreshing}
    >
      {/* Streak · today's goal · level: loads on its own, hidden when the tuition has it off. */}
      <ProgressHeader />
      {loading ? (
        <HomeSkeleton />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data ? (
        <>
          {error ? <StaleNotice message={error} onRetry={reload} /> : null}
          {!data.batch ? (
            data.enrollmentStatus === 'approval_pending' ? (
              <Notice
                title="Enrollment Pending"
                text={`Your account is ready. Your enrollment in ${data.pendingBatchName ?? 'your batch'} is awaiting approval from ${user.tuition.name}.`}
              />
            ) : data.enrollmentStatus === 'batch_pending' ? (
              <Notice
                title="Batch Assignment Pending"
                text={`Your account is ready. The administration of ${user.tuition.name} will assign your batch shortly.`}
              />
            ) : (
              <Notice title="You're not in a batch yet" text="Your tuition will add you to one; then your classes, tests and syllabus show here." />
            )
          ) : null}

          {/* Next up: the most urgent test, else the class on now or next. */}
          <SectionTitle title="Next up" />
          {toTake.length ? (
            <NextTestCard test={toTake[0]} now={now} more={toTake.slice(1)} onOpen={setOpenTest} onMore={() => goToTab('tests')} />
          ) : upNextClass ? (
            <NextClassCard next={upNextClass} />
          ) : (
            <Card>
              <EmptyView
                icon={{ ios: 'checkmark.circle', android: 'task_alt' }}
                art="allCaughtUp"
                title="You're all caught up"
                text={data.batch ? 'No tests to take and no classes in your timetable yet.' : 'Tests and classes show here once you join a batch.'}
              />
            </Card>
          )}

          {/* Unfinished practice comes back here, unless a test is waiting (the test always wins). */}
          {!toTake.length ? <ContinueCard /> : null}

          {/* Today: where the day stands, class by class; the week is a tap away. */}
          {data.batch ? (
            <>
              <SectionTitle title="Today" />
              <TodayCard today={data.today} week={data.week} now={clock} onShowWeek={() => setShowWeek(true)} />
            </>
          ) : null}

          {/* Needs work: the next step first; the last test is a calm line, never the loudest thing here. */}
          <SectionTitle title="Needs work" />
          <NeedsWorkCard insight={data.insight} onPractise={practise} />
          {data.batch ? <SyllabusLink batch={data.batch} onOpen={() => goToTab('syllabus')} /> : null}

          <AnnouncementsSection batches={[]} canPost={false} allowAllBatches={false} limit={2} tabKey="home" />

          <DetailSheet visible={showWeek} title="Weekly timetable" onClose={() => setShowWeek(false)}>
            <WeekTimetable entries={data.week} showBatch={false} emptyText="Your teachers haven't added classes yet." />
          </DetailSheet>
        </>
      ) : null}
      {openTest ? <TestRunner testId={openTest} onClose={() => setOpenTest(null)} /> : null}
    </Screen>
  );
}

// ─── Next up ───────────────────────────────────────────────────────────────

const ACTIONS: Partial<Record<TestKind, { label: string; icon: IconName }>> = {
  start: { label: 'Start test', icon: { ios: 'play.fill', android: 'play_arrow' } },
  continue: { label: 'Continue test', icon: { ios: 'arrow.right', android: 'arrow_forward' } },
  open: { label: 'Open test', icon: { ios: 'arrow.right', android: 'arrow_forward' } },
};

/** The test's state on the card: colour + word + icon. */
function testStatus(kind: TestKind, soon: boolean): { kind: StatusKind; word: string } | null {
  if (kind === 'continue') return { kind: 'live', word: 'In progress' };
  if (kind === 'open') return { kind: 'live', word: 'Open now' };
  if (kind === 'start') return soon ? { kind: 'due', word: 'Closes soon' } : { kind: 'new', word: 'Not started' };
  return null;
}

/**
 * The one thing to do next, with the screen's only filled button. The status
 * sits in the line above the title, so the title gets the card's full width.
 * Other tests to take are summed up at the foot, the next to close named.
 */
function NextTestCard({ test, now, more, onOpen, onMore }: { test: ListedTest; now: number; more: ListedTest[]; onOpen: (id: string) => void; onMore: () => void }) {
  const palette = usePalette();
  const kind = kindOf(test, now);
  const action = ACTIONS[kind];
  const soon = closesSoon(test, now);
  const timing = test.closesAt ? `Closes ${soon ? untilLabel(test.closesAt, now) : whenLabel(test.closesAt, now)}` : 'No closing time';
  const following = more[0];
  const status = testStatus(kind, soon);
  return (
    <Card style={styles.flush}>
      <View style={styles.hero}>
        <View style={styles.eyebrowRow}>
          {status ? <StatusChip kind={status.kind} word={status.word} /> : null}
          <SubjectChips subjects={test.subject || 'Mixed'} />
        </View>
        <NeoText variant="heading">{test.title}</NeoText>
        <Text style={[styles.meta, { color: palette.mutedForeground }]}>
          {[test.teacher.name, `${test.questionCount} questions`, `${test.durationMinutes} min`, `${test.maxScore} marks`].join(' · ')}
        </Text>
        <View style={styles.timing}>
          <Icon
            name={{ ios: soon ? 'clock.badge.exclamationmark' : 'clock', android: soon ? 'hourglass_top' : 'schedule' }}
            color={soon ? palette.warningInk : palette.mutedForeground}
            size={15}
          />
          <Text style={[styles.meta, { color: soon ? palette.foreground : palette.mutedForeground }, soon && styles.strong]}>{timing}</Text>
        </View>
        {action ? (
          <Button label={action.label} icon={action.icon} onPress={() => onOpen(test.id)} accessibilityLabel={`${action.label}: ${test.title}`} style={styles.heroButton} />
        ) : null}
      </View>
      {following ? (
        <FooterRow
          title={`${more.length} more test${more.length === 1 ? '' : 's'} to take`}
          subtitle={following.closesAt ? `${following.title} · closes ${untilLabel(following.closesAt, now)}` : following.title}
          onPress={onMore}
          accessibilityLabel={`${more.length} more test${more.length === 1 ? '' : 's'} to take. Next to close: ${following.title}. Opens Tests`}
        />
      ) : null}
    </Card>
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
    <Card style={styles.flush}>
      <View accessible accessibilityLabel={`${ongoing ? 'Class on now' : 'Next class'}: ${entry.subject}, ${when}${details ? `, ${details}` : ''}`} style={styles.hero}>
        <StatusChip kind={ongoing ? 'live' : 'upcoming'} word={ongoing ? 'Class on now' : 'Next class'} />
        <View style={styles.classTitle}>
          <SubjectMark subject={entry.subject} size={40} icon={subjectIcon(entry.subject)} ink={palette.ink} fill={palette.primarySoft} />
          <NeoText variant="heading" style={styles.flex}>
            {entry.subject}
          </NeoText>
        </View>
        <Text style={[styles.meta, { color: palette.foreground }]}>{when}</Text>
        {details ? <Text style={[styles.meta, { color: palette.mutedForeground }]}>{details}</Text> : null}
      </View>
    </Card>
  );
}

/** A tappable row across the foot of a card, under a hairline. */
function FooterRow({ icon, title, subtitle, onPress, accessibilityLabel, bare = false }: { icon?: IconName; title: string; subtitle?: string; onPress: () => void; accessibilityLabel?: string; /** The card's only row: no hairline above. */ bare?: boolean }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.footerRow, { borderTopColor: palette.border }, bare && styles.bare, pressed && { backgroundColor: palette.muted }]}
    >
      {icon ? <Icon name={icon} color={palette.inkSoft} size={18} /> : null}
      <View style={styles.flex}>
        <Text style={[styles.footerTitle, { color: palette.foreground }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
    </Pressable>
  );
}

// ─── Today ─────────────────────────────────────────────────────────────────

const STATE_LABEL: Record<ClassState, { label: string; kind: StatusKind } | null> = {
  done: { label: 'Done', kind: 'done' },
  now: { label: 'On now', kind: 'live' },
  next: { label: 'Next', kind: 'upcoming' },
  later: null,
};

/**
 * Today's classes on a rail of answer bubbles, the app's mark: filled when a
 * class is over, a ring for the one on now or next. A label says the same in
 * words, so colour isn't the only signal.
 */
function TodayCard({ today, week, now, onShowWeek }: { today: TimetableEntry[]; week: TimetableEntry[]; now: number; onShowWeek: () => void }) {
  const rows = todayStates(today, new Date(now));
  return (
    <Card style={styles.flush}>
      {rows.length ? (
        <View style={styles.today}>
          {rows.map(({ entry, state }, i) => (
            <TodayRow key={entry.id} entry={entry} state={state} last={i === rows.length - 1} />
          ))}
        </View>
      ) : (
        <View style={styles.today}>
          <Muted>No classes today.</Muted>
        </View>
      )}
      <FooterRow
        icon={{ ios: 'calendar', android: 'calendar_month' }}
        title="Weekly timetable"
        subtitle={week.length ? `${week.length} class${week.length === 1 ? '' : 'es'} a week` : 'No classes added yet'}
        onPress={onShowWeek}
      />
    </Card>
  );
}

function TodayRow({ entry, state, last }: { entry: TimetableEntry; state: ClassState; last: boolean }) {
  const palette = usePalette();
  const status = STATE_LABEL[state];
  const done = state === 'done';
  const details = [entry.batch.venue, entry.teacher.name, entry.note || null].filter(Boolean).join(' · ');
  const bubble =
    state === 'done' ? (
      <Bubble size={20} variant="filled" color={palette.borderStrong}>
        <Icon name={{ ios: 'checkmark', android: 'check' }} color={palette.foreground} size={11} />
      </Bubble>
    ) : state === 'now' ? (
      <Bubble size={20} color={palette.success} />
    ) : state === 'next' ? (
      <Bubble size={20} />
    ) : (
      <Bubble size={20} variant="quiet" />
    );
  return (
    <View
      accessible
      accessibilityLabel={`${entry.subject}, ${formatTime(entry.start)} to ${formatTime(entry.end)}${details ? `, ${details}` : ''}${status ? `. ${status.label}` : ''}`}
      style={styles.todayRow}
    >
      <View style={styles.timeCol}>
        <Text style={[styles.time, { color: done ? palette.mutedForeground : palette.foreground }]}>{formatTime(entry.start)}</Text>
        <Text style={[styles.timeEnd, { color: palette.mutedForeground }]}>{formatTime(entry.end)}</Text>
      </View>
      <View style={styles.rail}>
        {bubble}
        {!last ? <View style={[styles.railLine, { backgroundColor: palette.border }]} /> : null}
      </View>
      <View style={[styles.flex, !last && styles.todayGap]}>
        <View style={styles.subjectRow}>
          <Text style={[styles.subject, { color: done ? palette.mutedForeground : palette.foreground }]} numberOfLines={1}>
            {entry.subject}
          </Text>
          {status ? <StatusChip kind={status.kind} word={status.label} /> : null}
        </View>
        {details ? (
          <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={2}>
            {details}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Loading ───────────────────────────────────────────────────────────────

/** First load: the shape of Next up and Today, titles included, so nothing jumps when they land. */
function HomeSkeleton() {
  return (
    <>
      <SectionTitle title="Next up" />
      <SkeletonCard rows={2} label="what's next" />
      <SectionTitle title="Today" />
      <SkeletonCard rows={3} label="today's classes" />
    </>
  );
}

// ─── Needs work ────────────────────────────────────────────────────────────

type Practise = ((subject: SchoolSubject, chapter: string, topic: string) => void) | null;

/**
 * What to work on, next step first: "3 topics to fix" with one Practise button,
 * the topics (each opens its practice), then the last test as a small neutral
 * line. Scores are never red or big here (student-psychology: no alarm states).
 */
function NeedsWorkCard({ insight, onPractise }: { insight: StudentOverview['insight']; onPractise: Practise }) {
  const palette = usePalette();
  const last = insight.lastResult;
  const weak = insight.weak.slice(0, WEAK_ON_HOME);
  const total = insight.weak.length;
  const first = weak[0];
  const firstSubject = first ? asSubject(first.subject) : null;
  const practiseFirst = first && firstSubject && onPractise ? () => onPractise(firstSubject, first.chapter, first.topic) : null;
  return (
    <Card style={styles.progressCard}>
      {first ? (
        <View style={styles.fixHead}>
          <NeoText variant="subheading" accessibilityRole="header">
            {total} topic{total === 1 ? '' : 's'} to fix
          </NeoText>
          <Text style={[styles.meta, { color: palette.mutedForeground }]}>Start with {first.topic || first.chapter}. A few PYQs a day moves it.</Text>
          {practiseFirst ? (
            <Button
              label="Practise"
              variant="tonal"
              icon={{ ios: 'play.fill', android: 'play_arrow' }}
              onPress={practiseFirst}
              accessibilityLabel={`Practise ${first.topic || first.chapter}`}
              style={styles.fixButton}
            />
          ) : null}
        </View>
      ) : (
        <EmptyView
          icon={{ ios: 'scope', android: 'my_location' }}
          art="noMistakes"
          title={last ? 'Nothing to fix right now' : 'No topics to fix yet'}
          text={last ? 'Keep practising to stay sharp.' : 'Practise PYQs and take tests; the topics worth fixing show here.'}
        />
      )}

      {weak.length ? (
        <View>
          {weak.map((t) => (
            <WeakTopicRow key={`${t.subject}|${t.chapter}|${t.topic}`} stat={t} onPractise={onPractise} />
          ))}
        </View>
      ) : null}

      {last ? (
        <View
          accessible
          accessibilityLabel={`Last test, ${last.title}, ${dayLabel(last.submittedAt)}: ${last.score} of ${last.maxScore}`}
          style={[styles.lastLine, { borderTopColor: palette.border }]}
        >
          <Text style={[styles.lastText, { color: palette.mutedForeground }]} numberOfLines={1}>
            Last test · {last.title}
          </Text>
          <NeoTag label={`${last.score}/${last.maxScore}`} tone={scoreTone(last.score, last.maxScore)} />
        </View>
      ) : null}
    </Card>
  );
}

function WeakTopicRow({ stat, onPractise }: { stat: TopicStat; onPractise: Practise }) {
  const palette = usePalette();
  const subject = asSubject(stat.subject);
  const name = stat.topic || stat.chapter;
  // The chapter says the subject well enough on screen; the spoken label names both.
  const where = stat.topic ? stat.chapter : stat.subject;
  const practise = subject && onPractise ? () => onPractise(subject, stat.chapter, stat.topic) : null;
  const body = (
    <>
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={1}>
          {where}
        </Text>
      </View>
      <NeoTag label={`${stat.accuracy}%`} tone={scoreTone(stat.accuracy, 100)} accessibilityLabel={`${stat.accuracy} percent right so far`} />
      {practise ? <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} /> : null}
    </>
  );
  const label = `${name}, ${stat.subject}${stat.topic ? `, ${stat.chapter}` : ''}, ${stat.accuracy} percent right so far`;
  return practise ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. Practise in Practice`}
      onPress={practise}
      style={({ pressed }) => [styles.weakRow, { borderTopColor: palette.border }, pressed && { backgroundColor: palette.muted }]}
    >
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={label} style={[styles.weakRow, { borderTopColor: palette.border }]}>
      {body}
    </View>
  );
}

/** Score chips stay calm: soft pink when low (never alarm red), yellow in the middle, mint when strong. */
function scoreTone(score: number, max: number) {
  const pct = max > 0 ? score / max : 0;
  return pct >= 0.7 ? ('success' as const) : pct >= 0.4 ? ('primarySoft' as const) : ('dangerSoft' as const);
}

/** The syllabus in one line; the gauge per subject and what was covered lately are on the Syllabus tab. */
function SyllabusLink({ batch, onOpen }: { batch: NonNullable<StudentOverview['batch']>; onOpen: () => void }) {
  const totals = batch.subjects.reduce(
    (acc, s) => {
      const c = batch.coverage[s];
      return c?.total ? { covered: acc.covered + c.covered, total: acc.total + c.total } : acc;
    },
    { covered: 0, total: 0 }
  );
  const pct = totals.total ? Math.round((totals.covered / totals.total) * 100) : null;
  return (
    <Card style={styles.flush}>
      <FooterRow
        icon={{ ios: 'map', android: 'map' }}
        title={pct === null ? 'Syllabus' : `Syllabus covered ${pct}%`}
        subtitle="By subject, and what was covered in class lately"
        onPress={onOpen}
        accessibilityLabel={`${pct === null ? 'Syllabus' : `Syllabus covered ${pct} percent`}. Opens the Syllabus tab`}
        bare
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.6 },
  // Cards whose rows run edge to edge, e.g. a footer row under a hairline.
  flush: { padding: 0, gap: 0 },
  strong: { fontFamily: face.bold },

  hero: { padding: 16, gap: 8 },
  eyebrowRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  classTitle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  eyebrow: { fontSize: 13, fontFamily: face.semibold, flexShrink: 1 },
  heroTitle: { fontSize: 20, lineHeight: 25, fontFamily: face.heavy },
  meta: { fontSize: 13, lineHeight: 18 },
  timing: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroButton: { marginTop: 8 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: Neo.border.width, borderBottomLeftRadius: Neo.radius.lg - 2, borderBottomRightRadius: Neo.radius.lg - 2 },
  footerTitle: { fontSize: 15, fontFamily: face.semibold },

  today: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 },
  todayRow: { flexDirection: 'row', gap: 10 },
  // Wide enough for '12:45 PM' on one line at the default text size.
  timeCol: { width: 76 },
  time: { fontSize: 14, fontFamily: face.bold, fontVariant: ['tabular-nums'] },
  timeEnd: { fontSize: 12, marginTop: 1, fontVariant: ['tabular-nums'] },
  rail: { alignItems: 'center' },
  railLine: { width: 2, flex: 1, borderRadius: 1, marginVertical: 4 },
  todayGap: { paddingBottom: 16 },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subject: { fontSize: 15, fontFamily: face.bold, flexShrink: 1 },

  bare: { borderTopWidth: 0 },
  progressCard: { gap: 12, padding: 16 },
  fixHead: { gap: 4 },
  fixTitle: { fontSize: 17, lineHeight: 22, fontFamily: face.bold },
  fixButton: { marginTop: 8 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontFamily: face.semibold, marginTop: 2 },
  weakRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 56, borderTopWidth: Neo.border.width },
  lastLine: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10, borderTopWidth: Neo.border.width },
  lastText: { flex: 1, fontSize: 13, lineHeight: 18 },
  lastScore: { fontSize: 13, fontFamily: face.semibold, fontVariant: ['tabular-nums'] },
});
