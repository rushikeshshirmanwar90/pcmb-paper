import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/app-text';
import { Button, Card, EmptyView, ErrorView, Icon, Screen, SectionTitle, StatusChip, useLoad, usePalette, Muted, type IconName } from '@/components/kit';
import { SkeletonCard } from '@/components/states';
import { SubjectChips } from '@/components/subject-chips';
import { NeoTag } from '@/design/neo-kit';
import { SubjectMark } from '@/design/illustrations';
import { useTabNavigation } from '@/context/tab-context';
import { useTabDataVersion } from '@/context/data-version';
import {
  byUrgency,
  closesSoon,
  factsLine,
  kindOf,
  percentOf,
  subjectIcon,
  untilLabel,
  whenLabel,
  type ListedTest,
  type TestKind as Kind,
} from '@/screens/student/test-format';
import { RequestTestAccessButton } from '@/screens/student/test-access';
import { testAccessLabel } from '@/screens/student/test-format';
import { TestRunner } from '@/screens/student/test-runner';
import { dayLabel } from '@/services/school-api';
import { studentApi } from '@/services/student-api';
import { face } from '@/design/type';
import { Neo } from '@/design/tokens';


const time = (iso: string) => new Date(iso).getTime();

/** The time now, refreshed every `everyMs`, so labels like "closes in 3 h" and each test's status stay true. */
function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/** The student's tests: to do now, upcoming, and past ones with results. */
export function StudentTestsScreen() {
  const version = useTabDataVersion('tests');
  const now = useNow();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => studentApi.tests(), [version]);
  const [openId, setOpenId] = useState<string | null>(null);
  const { goToTab } = useTabNavigation();

  const tests: ListedTest[] = data ?? [];
  const restricted = tests.filter(t => t.access && !t.access.allowed);
  const withKind = tests.filter(t => !t.access || t.access.allowed).map((t) => ({ test: t, kind: kindOf(t, now) }));
  const toDo = withKind.filter((x) => x.kind === 'start' || x.kind === 'continue' || x.kind === 'open').map((x) => x.test).sort(byUrgency);
  const upcoming = withKind.filter((x) => x.kind === 'upcoming').map((x) => x.test).sort((a, b) => time(a.opensAt) - time(b.opensAt));
  const past = withKind.filter((x) => x.kind === 'done' || x.kind === 'missed' || x.kind === 'closed').sort((a, b) => time(b.test.opensAt) - time(a.test.opensAt));

  return (
    <Screen title="Tests" subtitle="Your batch's tests and results" onRefresh={refresh} refreshing={refreshing}>
      {loading ? (
        <>
          <SkeletonCard rows={2} label="your tests" />
          <SkeletonCard rows={3} label="past tests" />
        </>
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !tests.length ? (
        <Card>
          <EmptyView icon={{ ios: 'list.clipboard', android: 'assignment' }} art="emptyTests" title="No tests yet" text="Tests your teachers set for your batch show here, with your results." />
        </Card>
      ) : (
        <>
          <SectionTitle title={`To do · ${toDo.length}`} />
          {toDo.length ? (
            <TestCards tests={toDo} now={now} onOpen={setOpenId} />
          ) : (
            <Card>
              <EmptyView
                icon={{ ios: 'checkmark.circle', android: 'task_alt' }}
                art="allCaughtUp"
                title={restricted.length ? 'No tests ready to start' : "You're all caught up"}
                text={restricted.length ? 'Some tests need teacher approval. Request access below.' : upcoming.length ? `Your next test opens ${whenLabel(upcoming[0].opensAt, now)}.` : 'New tests from your teachers show here.'}
                action={<Button label="Practise meanwhile" variant="secondary" icon={{ ios: 'book', android: 'menu_book' }} onPress={() => goToTab('practice')} />}
              />
            </Card>
          )}

          {upcoming.length ? (
            <>
              <SectionTitle title={`Upcoming · ${upcoming.length}`} />
              <Card style={styles.listCard}>
                {upcoming.map((t, i) => (
                  <UpcomingRow key={t.id} test={t} now={now} last={i === upcoming.length - 1} />
                ))}
              </Card>
            </>
          ) : null}

          {past.length ? (
            <>
              <SectionTitle title="Past tests" />
              <Card style={styles.listCard}>
                {past.map(({ test, kind }, i) => (
                  <PastRow key={test.id} test={test} kind={kind} onOpen={setOpenId} last={i === past.length - 1} />
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}
      {restricted.length ? <MutedAccess tests={restricted} onOpen={setOpenId} onRefresh={refresh} /> : null}
      {openId ? <TestRunner testId={openId} onClose={() => setOpenId(null)} /> : null}
    </Screen>
  );
}

/** Tests to take, as cards with one clear action each. Also used on Home. */
export function TestList({ tests, onOpen }: { tests: ListedTest[]; onOpen: (id: string) => void }) {
  const now = useNow();
  return <TestCards tests={[...tests].sort(byUrgency)} now={now} onOpen={onOpen} />;
}

function TestCards({ tests, now, onOpen }: { tests: ListedTest[]; now: number; onOpen: (id: string) => void }) {
  return (
    <View style={styles.cards}>
      {tests.map((t, i) => (
        // Only the most urgent test gets the filled button: one prominent action per screen.
        <TestCard key={t.id} test={t} kind={kindOf(t, now)} now={now} prominent={i === 0} onOpen={onOpen} />
      ))}
    </View>
  );
}

const ACTIONS: Partial<Record<Kind, { label: string; icon: IconName }>> = {
  start: { label: 'Start test', icon: { ios: 'play.fill', android: 'play_arrow' } },
  continue: { label: 'Continue test', icon: { ios: 'arrow.right', android: 'arrow_forward' } },
  open: { label: 'Open test', icon: { ios: 'arrow.right', android: 'arrow_forward' } },
  done: { label: 'View results', icon: { ios: 'chart.bar', android: 'bar_chart' } },
  closed: { label: 'View results', icon: { ios: 'chart.bar', android: 'bar_chart' } },
  missed: { label: 'See answers', icon: { ios: 'book', android: 'menu_book' } },
};

function TestCard({ test, kind, now, prominent, onOpen }: { test: ListedTest; kind: Kind; now: number; prominent: boolean; onOpen: (id: string) => void }) {
  const palette = usePalette();
  const soon = closesSoon(test, now);
  const paused = test.mine?.state === 'suspended';
  const action = paused ? { label: 'View paused test', icon: { ios: 'pause.circle', android: 'pause_circle' } as IconName } : ACTIONS[kind];
  const timing = test.closesAt
    ? `Closes ${soon ? untilLabel(test.closesAt, now) : whenLabel(test.closesAt, now)}`
    : 'No closing time';

  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <SubjectMark subject={test.subject} icon={subjectIcon(test.subject)} ink={palette.ink} fill={palette.primarySoft} />
        <View style={styles.flex}>
          <Text style={[styles.cardTitle, { color: palette.foreground }]} numberOfLines={2} textBreakStrategy="balanced">
            {test.title}
          </Text>
          <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={1}>
            {test.teacher.name}
          </Text>
        </View>
      </View>
      <View style={styles.chips}>
        {paused ? (
          <StatusChip kind="locked" word="Paused" />
        ) : kind === 'continue' ? (
          <StatusChip kind="live" word="In progress" />
        ) : kind === 'start' ? (
          soon ? <StatusChip kind="due" word="Closes soon" /> : <StatusChip kind="new" word="Not started" />
        ) : kind === 'open' ? (
          <StatusChip kind="live" word="Open now" />
        ) : null}
        <SubjectChips subjects={test.subject || 'Mixed'} />
      </View>

      <Text style={[styles.facts, { color: palette.inkSoft }]}>{factsLine(test)}</Text>

      <View style={styles.timing}>
        <Icon name={{ ios: soon ? 'clock.badge.exclamationmark' : 'clock', android: soon ? 'hourglass_top' : 'schedule' }} color={soon ? palette.foreground : palette.mutedForeground} size={15} />
        <Text style={[styles.timingText, { color: soon ? palette.foreground : palette.mutedForeground }, soon && styles.strong]}>{timing}</Text>
      </View>

      {action ? (
        <Button
          label={action.label}
          icon={action.icon}
          variant={prominent ? 'primary' : 'secondary'}
          onPress={() => onOpen(test.id)}
          accessibilityLabel={`${action.label}: ${test.title}`}
        />
      ) : null}
    </Card>
  );
}

function UpcomingRow({ test, now, last }: { test: ListedTest; now: number; last: boolean }) {
  const palette = usePalette();
  return (
    <View
      accessible
      accessibilityLabel={`${test.title}, opens ${whenLabel(test.opensAt, now)}. ${factsLine(test)}. You can start it once it opens.`}
      style={[styles.row, !last && { borderBottomWidth: Neo.border.width, borderBottomColor: palette.border }]}
    >
      <IconTile icon={{ ios: 'calendar', android: 'event_upcoming' }} tone="neutral" />
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={2}>
          {test.title}
        </Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]}>
          Opens {whenLabel(test.opensAt, now)} · {test.questionCount} questions · {test.durationMinutes} min
        </Text>
      </View>
      <StatusChip kind="upcoming" word={untilLabel(test.opensAt, now)} />
    </View>
  );
}

function PastRow({ test, kind, onOpen, last }: { test: ListedTest; kind: Kind; onOpen: (id: string) => void; last: boolean }) {
  const palette = usePalette();
  const score = kind === 'done' ? test.mine?.score ?? null : null;
  const percent = score !== null ? percentOf(score, test.maxScore) : null;
  const action = ACTIONS[kind]!;
  const status =
    score !== null
      ? `scored ${score} of ${test.maxScore}, ${percent} percent`
      : kind === 'missed'
      ? 'not taken'
      : 'closed';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${test.title}, ${status}. ${action.label}`}
      onPress={() => onOpen(test.id)}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: Neo.border.width, borderBottomColor: palette.border }, pressed && styles.pressed]}
    >
      <SubjectMark subject={test.subject} icon={subjectIcon(test.subject)} ink={palette.ink} fill={kind === 'done' ? palette.primarySoft : palette.secondary} />
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={2}>
          {test.title}
        </Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={1}>
          {dayLabel(test.opensAt)}
        </Text>
        {(test.subject ?? '').includes(',') ? (
          <View style={styles.rowChips}>
            <SubjectChips subjects={test.subject} max={2} />
          </View>
        ) : null}
      </View>
      {score !== null && percent !== null ? (
        <NeoTag label={`${score}/${test.maxScore}`} tone={percent >= 70 ? 'success' : percent >= 40 ? 'primarySoft' : 'dangerSoft'} accessibilityLabel={`${score} of ${test.maxScore}, ${percent} percent`} />
      ) : kind === 'missed' ? (
        <StatusChip kind="missed" />
      ) : (
        <StatusChip kind="locked" word="Closed" />
      )}
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
    </Pressable>
  );
}

/** A subject's icon on a soft square, so lists scan by subject. */
function IconTile({ icon, tone = 'primary' }: { icon: IconName; tone?: 'primary' | 'neutral' }) {
  const palette = usePalette();
  return (
    <View style={[styles.tile, { backgroundColor: tone === 'primary' ? palette.primarySoft : palette.secondary, borderColor: palette.ink }]}>
      <Icon name={icon} color={tone === 'primary' ? palette.primary : palette.mutedForeground} size={19} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  cards: { gap: 12 },
  card: { gap: 12, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontSize: 17, lineHeight: 22, fontFamily: face.bold },
  meta: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  facts: { fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  timing: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
  timingText: { fontSize: 13, lineHeight: 18 },
  listCard: { paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 64 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontFamily: face.semibold },
  until: { fontSize: 13, fontFamily: face.semibold, fontVariant: ['tabular-nums'] },
  scoreCol: { alignItems: 'flex-end', gap: 4 },
  score: { fontSize: 16, fontFamily: face.heavy, fontVariant: ['tabular-nums'] },
  scoreOf: { fontSize: 13, fontFamily: face.semibold },
  tile: { width: 40, height: 40, borderRadius: Neo.radius.sm, borderWidth: Neo.border.width, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  rowChips: { marginTop: 6 },
  strong: { fontFamily: face.bold },
  pressed: { opacity: 0.7 },
});

function MutedAccess({ tests, onOpen, onRefresh }: { tests: ListedTest[]; onOpen: (id: string) => void; onRefresh: () => void }) {
  const palette = usePalette();
  return (
    <>
      <SectionTitle title="Needs approval" />
      <Muted>You can open these to look. Your teacher has to approve you before you take one.</Muted>
      {tests.map((test) => (
        <Card key={test.id} style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${test.title}, needs your teacher's approval. Opens the test`}
            onPress={() => onOpen(test.id)}
            style={({ pressed }) => [styles.cardTop, pressed && styles.pressed]}
          >
            <SubjectMark subject={test.subject} icon={subjectIcon(test.subject)} ink={palette.ink} fill={palette.secondary} />
            <View style={styles.flex}>
              <Text style={[styles.cardTitle, { color: palette.foreground }]} numberOfLines={2}>
                {test.title}
              </Text>
              {test.access ? (
                <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={2}>
                  {testAccessLabel(test.access)}
                </Text>
              ) : null}
            </View>
            <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
          </Pressable>
          <View style={styles.chips}>
            <StatusChip kind="locked" word="Needs approval" />
            <SubjectChips subjects={test.subject || 'Mixed'} />
          </View>
          {test.access ? <RequestTestAccessButton testId={test.id} access={test.access} onRefresh={onRefresh} /> : null}
        </Card>
      ))}
    </>
  );
}
