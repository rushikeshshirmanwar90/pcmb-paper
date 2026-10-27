import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, EmptyView, ErrorView, Icon, LoadingView, Screen, SectionTitle, useLoad, usePalette, type IconName } from '@/components/kit';
import { useDataVersion } from '@/context/data-version';
import {
  byUrgency,
  closesSoon,
  factsLine,
  kindOf,
  percentOf,
  resultTone,
  subjectIcon,
  untilLabel,
  whenLabel,
  type ListedTest,
  type TestKind as Kind,
} from '@/screens/student/test-format';
import { TestRunner } from '@/screens/student/test-runner';
import { dayLabel } from '@/services/school-api';
import { studentApi } from '@/services/student-api';


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
  const version = useDataVersion();
  const now = useNow();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => studentApi.tests(), [version]);
  const [openId, setOpenId] = useState<string | null>(null);

  const tests: ListedTest[] = data ?? [];
  const withKind = tests.map((t) => ({ test: t, kind: kindOf(t, now) }));
  const toDo = withKind.filter((x) => x.kind === 'start' || x.kind === 'continue' || x.kind === 'open').map((x) => x.test).sort(byUrgency);
  const upcoming = withKind.filter((x) => x.kind === 'upcoming').map((x) => x.test).sort((a, b) => time(a.opensAt) - time(b.opensAt));
  const past = withKind.filter((x) => x.kind === 'done' || x.kind === 'missed' || x.kind === 'closed').sort((a, b) => time(b.test.opensAt) - time(a.test.opensAt));

  return (
    <Screen title="Tests" subtitle="Your batch's tests and results" onRefresh={refresh} refreshing={refreshing}>
      {loading ? (
        <LoadingView label="Loading your tests…" />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !tests.length ? (
        <Card>
          <EmptyView icon={{ ios: 'list.clipboard', android: 'assignment' }} title="No tests yet" text="Tests your teachers set for your batch show here, with your results." />
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
                title="You're all caught up"
                text={upcoming.length ? `Your next test opens ${whenLabel(upcoming[0].opensAt, now)}.` : 'New tests from your teachers show here.'}
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
  const action = ACTIONS[kind];
  const timing = test.closesAt
    ? `Closes ${soon ? untilLabel(test.closesAt, now) : whenLabel(test.closesAt, now)}`
    : 'No closing time';

  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <IconTile icon={subjectIcon(test.subject)} />
        <View style={styles.flex}>
          <Text style={[styles.cardTitle, { color: palette.foreground }]} numberOfLines={2}>
            {test.title}
          </Text>
          <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={1}>
            {test.subject || 'Mixed'} · {test.teacher.name}
          </Text>
        </View>
        {kind === 'continue' ? <Badge label="In progress" tone="warning" /> : kind === 'start' ? <Badge label="Not started" tone="primary" /> : null}
      </View>

      <Text style={[styles.facts, { color: palette.inkSoft }]}>{factsLine(test)}</Text>

      <View style={styles.timing}>
        <Icon name={{ ios: soon ? 'clock.badge.exclamationmark' : 'clock', android: soon ? 'hourglass_top' : 'schedule' }} color={soon ? palette.warningInk : palette.mutedForeground} size={15} />
        <Text style={[styles.timingText, { color: soon ? palette.warningInk : palette.mutedForeground, fontWeight: soon ? '700' : '500' }]}>{timing}</Text>
      </View>

      {action ? (
        <Button
          label={action.label}
          icon={action.icon}
          variant={prominent ? 'primary' : 'tonal'}
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
      style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}
    >
      <IconTile icon={{ ios: 'calendar', android: 'event_upcoming' }} tone="neutral" />
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={2}>
          {test.title}
        </Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]}>
          Opens {whenLabel(test.opensAt, now)} · {test.questionCount} Q · {test.durationMinutes} min
        </Text>
      </View>
      <Text style={[styles.until, { color: palette.mutedForeground }]}>{untilLabel(test.opensAt, now)}</Text>
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
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }, pressed && styles.pressed]}
    >
      <IconTile icon={subjectIcon(test.subject)} tone={kind === 'done' ? 'primary' : 'neutral'} />
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={2}>
          {test.title}
        </Text>
        <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={1}>
          {test.subject || 'Mixed'} · {dayLabel(test.opensAt)} · {kind === 'missed' ? 'see answers' : 'view results'}
        </Text>
      </View>
      {score !== null && percent !== null ? (
        <View style={styles.scoreCol}>
          <Text style={[styles.score, { color: palette.foreground }]}>
            {score}
            <Text style={[styles.scoreOf, { color: palette.mutedForeground }]}>/{test.maxScore}</Text>
          </Text>
          <Badge label={`${percent}%`} tone={resultTone(percent)} />
        </View>
      ) : (
        <Badge label={kind === 'missed' ? 'Missed' : 'Closed'} />
      )}
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
    </Pressable>
  );
}

/** A subject's icon on a soft square, so lists scan by subject. */
function IconTile({ icon, tone = 'primary' }: { icon: IconName; tone?: 'primary' | 'neutral' }) {
  const palette = usePalette();
  return (
    <View style={[styles.tile, { backgroundColor: tone === 'primary' ? palette.primarySoft : palette.secondary }]}>
      <Icon name={icon} color={tone === 'primary' ? palette.primary : palette.mutedForeground} size={19} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  cards: { gap: 12 },
  card: { gap: 12, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  meta: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  facts: { fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  timing: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
  timingText: { fontSize: 13, lineHeight: 18 },
  listCard: { paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 64 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  until: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  scoreCol: { alignItems: 'flex-end', gap: 4 },
  score: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  scoreOf: { fontSize: 13, fontWeight: '600' },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
