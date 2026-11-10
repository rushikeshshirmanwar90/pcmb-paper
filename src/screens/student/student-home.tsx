import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Badge, Button, Card, DetailSheet, EmptyView, ErrorView, Icon, ListRow, LoadingView, Muted, Notice, ProgressBar, Screen, SectionTitle, useLoad, usePalette, type IconName } from '@/components/kit';
import { programOf, questionBankOf, SCHOOL_SUBJECTS, WEEKDAY_NAMES, type SchoolSubject } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { useTabDataVersion } from '@/context/data-version';
import { openPracticeAt } from '@/context/practice-target';
import { useTabNavigation } from '@/context/tab-context';
import { useEngagement } from '@/engagement/engagement-provider';
import { syncClassReminders } from '@/services/notifications';
import { AnnouncementsSection } from '@/screens/shared/announcements';
import { WeekTimetable } from '@/screens/shared/timetable';
import { Bubble } from '@/screens/auth-ui';
import { nextClass, todayStates, type ClassState, type NextClass } from '@/screens/student/home-next-up';
import { PRACTICE_TAB } from '@/screens/student/student-practice';
import { ProgressHeader } from '@/screens/student/progress-header';
import { byUrgency, closesSoon, kindOf, percentOf, resultTone, subjectIcon, untilLabel, whenLabel, type ListedTest, type TestKind } from '@/screens/student/test-format';
import { TestRunner } from '@/screens/student/test-runner';
import { dayLabel, type TimetableEntry } from '@/services/school-api';
import { studentApi, type StudentOverview, type TopicStat } from '@/services/student-api';
import { formatTime } from '@/services/tuition-api';

const RECENT_ON_HOME = 3;
const WEAK_ON_HOME = 3;
/** From this text size up, a subject's coverage bar goes under its name instead of beside it. */
const STACK_FROM_FONT_SCALE = 1.3;

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
 * A student's day, most useful first: what to do next (a test, or the next
 * class), today's classes, how they're doing, then announcements. The whole
 * week and every topic covered lately are a tap away.
 */
export function StudentHomeScreen() {
  const user = useSignedInUser();
  const version = useTabDataVersion('home');
  const { goToTab } = useTabNavigation();
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
  const [showRecent, setShowRecent] = useState(false);
  // A weak topic's Practise opens it in the Practice tab (topic practice),
  // for programs with a question bank only.
  const practise = questionBankOf(programOf(user))
    ? (subject: SchoolSubject, chapter: string, topic: string) => {
        openPracticeAt({ subject, chapter, topic: topic || null });
        goToTab(PRACTICE_TAB);
      }
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
      title={`Hi, ${user.name.split(' ')[0]}`}
      subtitle={`${date} · ${data?.batch ? data.batch.name : user.tuition.name}`}
      onRefresh={refreshAll}
      refreshing={refreshing}
    >
      {/* Streak · today's goal · level: loads on its own, hidden when the tuition has it off. */}
      <ProgressHeader />
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data ? (
        <>
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
                title="You're all caught up"
                text={data.batch ? 'No tests to take and no classes in your timetable yet.' : 'Tests and classes show here once you join a batch.'}
              />
            </Card>
          )}

          {/* Today: where the day stands, class by class; the week is a tap away. */}
          {data.batch ? (
            <>
              <SectionTitle title="Today" />
              <TodayCard today={data.today} week={data.week} now={clock} onShowWeek={() => setShowWeek(true)} />
            </>
          ) : null}

          {/* Your progress: last result, weak topics to practise, syllabus. */}
          <SectionTitle title="Your progress" />
          <ResultCard insight={data.insight} onPractise={practise} />
          {data.batch ? <SyllabusCard batch={data.batch} recent={data.recent} onShowRecent={() => setShowRecent(true)} /> : null}

          <AnnouncementsSection batches={[]} canPost={false} allowAllBatches={false} limit={2} tabKey="home" />

          <DetailSheet visible={showWeek} title="Weekly timetable" onClose={() => setShowWeek(false)}>
            <WeekTimetable entries={data.week} showBatch={false} emptyText="Your teachers haven't added classes yet." />
          </DetailSheet>
          <DetailSheet visible={showRecent} title="Covered in class lately" onClose={() => setShowRecent(false)}>
            <Card style={styles.flush}>
              {data.recent.map((r, i) => (
                <ListRow key={r.id} title={r.topic || r.chapter} subtitle={`${r.subject}${r.topic ? ` · ${r.chapter}` : ''} · ${dayLabel(r.coveredOn)}`} last={i === data.recent.length - 1} />
              ))}
            </Card>
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

const STATUS: Partial<Record<TestKind, string>> = { start: 'Not started', continue: 'In progress', open: 'Open now' };

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
  return (
    <Card style={styles.flush}>
      <View style={styles.hero}>
        <View style={styles.eyebrowRow}>
          <Icon name={subjectIcon(test.subject)} color={palette.mutedForeground} size={15} />
          <Text style={[styles.eyebrow, { color: palette.mutedForeground }]} numberOfLines={1}>
            {test.subject || 'Mixed'}
            {STATUS[kind] ? (
              <Text style={{ color: kind === 'continue' ? palette.warningInk : palette.mutedForeground }}> · {STATUS[kind]}</Text>
            ) : null}
          </Text>
        </View>
        <Text style={[styles.heroTitle, { color: palette.foreground }]}>{test.title}</Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]}>
          {[test.teacher.name, `${test.questionCount} questions`, `${test.durationMinutes} min`, `${test.maxScore} marks`].join(' · ')}
        </Text>
        <View style={styles.timing}>
          <Icon
            name={{ ios: soon ? 'clock.badge.exclamationmark' : 'clock', android: soon ? 'hourglass_top' : 'schedule' }}
            color={soon ? palette.warningInk : palette.mutedForeground}
            size={15}
          />
          <Text style={[styles.meta, { color: soon ? palette.warningInk : palette.mutedForeground, fontWeight: soon ? '700' : '500' }]}>{timing}</Text>
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
        <View style={styles.eyebrowRow}>
          <Icon name={subjectIcon(entry.subject)} color={ongoing ? palette.successInk : palette.mutedForeground} size={15} />
          <Text style={[styles.eyebrow, { color: ongoing ? palette.successInk : palette.mutedForeground }]}>{ongoing ? 'Class on now' : 'Next class'}</Text>
        </View>
        <Text style={[styles.heroTitle, { color: palette.foreground }]}>{entry.subject}</Text>
        <Text style={[styles.meta, { color: palette.foreground }]}>{when}</Text>
        {details ? <Text style={[styles.meta, { color: palette.mutedForeground }]}>{details}</Text> : null}
      </View>
    </Card>
  );
}

/** A tappable row across the foot of a card, under a hairline. */
function FooterRow({ icon, title, subtitle, onPress, accessibilityLabel }: { icon?: IconName; title: string; subtitle?: string; onPress: () => void; accessibilityLabel?: string }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.footerRow, { borderTopColor: palette.border }, pressed && { backgroundColor: palette.muted }]}
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

const STATE_LABEL: Record<ClassState, { label: string; tone: 'neutral' | 'success' | 'primary' } | null> = {
  done: { label: 'Done', tone: 'neutral' },
  now: { label: 'On now', tone: 'success' },
  next: { label: 'Next', tone: 'primary' },
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
          {status ? <Badge label={status.label} tone={status.tone} /> : null}
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

// ─── Your progress ─────────────────────────────────────────────────────────

type Practise = ((subject: SchoolSubject, chapter: string, topic: string) => void) | null;

function ResultCard({ insight, onPractise }: { insight: StudentOverview['insight']; onPractise: Practise }) {
  const palette = usePalette();
  const last = insight.lastResult;
  const percent = last ? percentOf(last.score, last.maxScore) : null;
  const weak = insight.weak.slice(0, WEAK_ON_HOME);
  return (
    <Card style={styles.progressCard}>
      {last && percent !== null ? (
        <View accessible accessibilityLabel={`Last test, ${last.title}: ${last.score} of ${last.maxScore}, ${percent} percent`} style={styles.lastRow}>
          <View style={styles.flex}>
            <Text style={[styles.label, { color: palette.mutedForeground }]}>Last test · {dayLabel(last.submittedAt)}</Text>
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
        <View>
          <Text style={[styles.cardHeading, { color: palette.foreground }]}>Needs work</Text>
          {weak.map((t) => (
            <WeakTopicRow key={`${t.subject}|${t.chapter}|${t.topic}`} stat={t} onPractise={onPractise} />
          ))}
        </View>
      ) : null}

      {insight.strong.length ? (
        <View style={styles.strongRow}>
          <Icon name={{ ios: 'checkmark.circle', android: 'check_circle' }} color={palette.success} size={16} />
          <Text style={[styles.meta, styles.flex, { color: palette.successInk }]}>
            Strong: {insight.strong.slice(0, 3).map((s) => s.topic || s.chapter).join(', ')}
          </Text>
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
  // The score comes first, so it never gets cut off; the whole row opens practice.
  const body = (
    <>
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={1}>
          <Text style={{ color: palette.dangerInk, fontWeight: '700' }}>{stat.accuracy}% right</Text> · {where}
        </Text>
      </View>
      {practise ? (
        <View style={styles.practise}>
          <Text style={[styles.practiseText, { color: palette.primary }]}>Practise</Text>
          <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.primary} size={14} />
        </View>
      ) : null}
    </>
  );
  const label = `${name}, ${stat.subject}${stat.topic ? `, ${stat.chapter}` : ''}, ${stat.accuracy} percent right`;
  return practise ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. Practise in Practice`}
      onPress={practise}
      style={({ pressed }) => [styles.weakRow, { borderTopColor: palette.border }, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={label} style={[styles.weakRow, { borderTopColor: palette.border }]}>
      {body}
    </View>
  );
}

function SyllabusCard({ batch, recent, onShowRecent }: { batch: NonNullable<StudentOverview['batch']>; recent: StudentOverview['recent']; onShowRecent: () => void }) {
  const palette = usePalette();
  // One line per subject (name, bar, percent) reads like a gauge; large text stacks it.
  const { fontScale } = useWindowDimensions();
  const inline = fontScale < STACK_FROM_FONT_SCALE;
  return (
    <Card style={styles.progressCard}>
      <Text style={[styles.cardHeading, { color: palette.foreground }]}>Syllabus covered</Text>
      <View style={styles.coverageList}>
        {batch.subjects.map((s) => {
          const c = batch.coverage[s];
          const pct = c?.total ? `${c.percent}%` : '–';
          return (
            <View
              key={s}
              style={inline ? styles.coverageInline : styles.coverageStacked}
              accessible
              accessibilityLabel={`${s}, ${c?.total ? `${c.percent} percent covered, ${c.covered} of ${c.total} topics` : 'no syllabus'}`}
            >
              {inline ? (
                <>
                  <Text style={[styles.subjectName, { color: palette.foreground }]} numberOfLines={1}>
                    {s}
                  </Text>
                  <View style={styles.flex}>
                    <ProgressBar value={c?.percent ?? 0} tone="success" />
                  </View>
                  <Text style={[styles.pct, { color: palette.mutedForeground }]}>{pct}</Text>
                </>
              ) : (
                <>
                  <View style={styles.coverageTop}>
                    <Text style={[styles.subject, { color: palette.foreground }]}>{s}</Text>
                    <Text style={[styles.pct, { color: palette.mutedForeground }]}>{pct}</Text>
                  </View>
                  <ProgressBar value={c?.percent ?? 0} tone="success" />
                </>
              )}
            </View>
          );
        })}
      </View>
      {recent.length ? (
        <View style={[styles.recent, { borderTopColor: palette.border }]}>
          <Text style={[styles.label, { color: palette.mutedForeground }]}>Covered in class lately</Text>
          {recent.slice(0, RECENT_ON_HOME).map((r) => (
            <Text key={r.id} style={[styles.recentLine, { color: palette.foreground }]} numberOfLines={1}>
              {r.topic || r.chapter} <Text style={{ color: palette.mutedForeground }}>· {r.subject} · {dayLabel(r.coveredOn)}</Text>
            </Text>
          ))}
          {recent.length > RECENT_ON_HOME ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`See all ${recent.length} topics covered lately`}
              onPress={onShowRecent}
              style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
            >
              <Text style={[styles.practiseText, { color: palette.primary }]}>See all {recent.length}</Text>
              <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.primary} size={14} />
            </Pressable>
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
  pressed: { opacity: 0.6 },
  // Cards whose rows run edge to edge, e.g. a footer row under a hairline.
  flush: { padding: 0, gap: 0, overflow: 'hidden' },

  hero: { padding: 16, gap: 6 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  heroTitle: { fontSize: 20, lineHeight: 25, fontWeight: '800' },
  meta: { fontSize: 13, lineHeight: 18 },
  timing: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroButton: { marginTop: 8 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  footerTitle: { fontSize: 15, fontWeight: '600' },

  today: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 },
  todayRow: { flexDirection: 'row', gap: 10 },
  // Wide enough for '12:45 PM' on one line at the default text size.
  timeCol: { width: 76 },
  time: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timeEnd: { fontSize: 12, marginTop: 1, fontVariant: ['tabular-nums'] },
  rail: { alignItems: 'center' },
  railLine: { width: 2, flex: 1, borderRadius: 1, marginVertical: 4 },
  todayGap: { paddingBottom: 16 },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subject: { fontSize: 15, fontWeight: '700', flexShrink: 1 },

  progressCard: { gap: 12, padding: 16 },
  label: { fontSize: 12, fontWeight: '600' },
  lastRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', marginTop: 2 },
  scoreCol: { alignItems: 'flex-end', gap: 4 },
  score: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreOf: { fontSize: 14, fontWeight: '600' },
  cardHeading: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  weakRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 56, borderTopWidth: StyleSheet.hairlineWidth },
  practise: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  practiseText: { fontSize: 15, fontWeight: '700' },
  strongRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },

  coverageList: { gap: 12 },
  coverageInline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coverageStacked: { gap: 5 },
  coverageTop: { flexDirection: 'row', justifyContent: 'space-between' },
  subjectName: { fontSize: 14, fontWeight: '600', width: 96 },
  pct: { fontSize: 13, fontWeight: '600', minWidth: 36, textAlign: 'right', fontVariant: ['tabular-nums'] },
  recent: { gap: 4, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  recentLine: { fontSize: 13, lineHeight: 19 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', minHeight: 44 },
});
