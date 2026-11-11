import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Button, Card, DetailSheet, EmptyView, ErrorView, Icon, Muted, Screen, SectionTitle, useLoad, usePalette, type IconName } from '@/components/kit';
import { SkeletonCard, StaleNotice, useToast } from '@/components/states';
import { SubjectChips } from '@/components/subject-chips';
import { useSignedInUser } from '@/context/auth-context';
import { useDataVersion } from '@/context/data-version';
import { useTabNavigation } from '@/context/tab-context';
import { syncClassReminders } from '@/services/notifications';
import { AnnouncementsSection } from '@/screens/shared/announcements';
import { SyllabusProgressView } from '@/screens/shared/syllabus-progress';
import { ClassRow } from '@/screens/shared/timetable';
import { todayStates } from '@/screens/student/home-next-up';
import { attentionRows, type AttentionKind } from '@/screens/teacher/attention';
import { schoolApi, type TimetableEntry } from '@/services/school-api';

const ATTENTION_ON_HOME = 3;

const ATTENTION_ICON: Record<AttentionKind, IconName> = {
  waiting: { ios: 'pause.circle.fill', android: 'pause_circle' },
  live: { ios: 'dot.radiowaves.left.and.right', android: 'sensors' },
  results: { ios: 'chart.bar', android: 'bar_chart' },
  opening: { ios: 'clock', android: 'schedule' },
};

/** The time now, refreshed every minute, so the class "on now" moves along. */
function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/**
 * A teacher's day, next step first (Home answers "what should I do now?"):
 * today's classes, each with Mark covered (batch and subject already known);
 * what needs attention (students waiting in a paused test first, live tests,
 * results just in, tests about to open); then announcements. The week's
 * timetable is one row away. Totals live in each batch, not here.
 */
export function TeacherHomeScreen() {
  const user = useSignedInUser();
  const palette = usePalette();
  const router = useRouter();
  const { goToTab } = useTabNavigation();
  const version = useDataVersion();
  const now = useNow();
  const toast = useToast();
  const overview = useLoad(() => schoolApi.teacherOverview(), [version]);
  // The test list feeds Needs attention; Home still works without it.
  const tests = useLoad(() => schoolApi.tests(), [version], { cacheKey: 'teacher-tests' });
  const data = overview.data;

  // Reminders 15 minutes before each weekly class.
  const week = data?.week;
  useEffect(() => {
    if (week) void syncClassReminders(week);
  }, [week]);

  const [marking, setMarking] = useState<TimetableEntry | null>(null);
  // A tick in the syllabus bumps the data version: say so once the sheet closes.
  const versionAtOpen = useRef(version);
  const openMarking = (e: TimetableEntry) => {
    versionAtOpen.current = version;
    setMarking(e);
  };
  const closeMarking = () => {
    if (version !== versionAtOpen.current) toast.show({ message: 'Saved. Your students see it now.', kind: 'success' });
    setMarking(null);
  };

  const batches = (data?.batches ?? []).map((b) => ({ id: b.id, name: b.name, mySubjects: b.mySubjects }));
  const rows = data ? todayStates(data.today, new Date(now)) : [];
  // The class to mark: the one on now, else the one that just finished.
  const focus = rows.find((r) => r.state === 'now') ?? [...rows].reverse().find((r) => r.state === 'done') ?? null;
  const attention = tests.data ? attentionRows(tests.data, now) : [];
  const openTest = (id: string) => router.push({ pathname: '/test/[testId]', params: { testId: id } } as Href);
  const date = new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen
      title={`Hello, ${user.name.split(' ')[0]}`}
      subtitle={`${date} · ${user.tuition.name}`}
      onRefresh={() => {
        overview.refresh();
        tests.refresh();
      }}
      refreshing={overview.refreshing}
    >
      {overview.loading ? (
        <>
          <SkeletonCard rows={3} label="today's classes" />
          <SkeletonCard rows={2} label="what needs attention" />
        </>
      ) : overview.error && !data ? (
        <ErrorView message={overview.error} onRetry={overview.reload} />
      ) : data ? (
        <>
          {overview.error ? <StaleNotice message={overview.error} onRetry={overview.reload} /> : null}

          <SectionTitle title="Today" />
          {rows.length ? (
            <Card style={styles.flush}>
              {rows.map(({ entry, state }, i) => (
                <View key={entry.id} style={[styles.classRow, i > 0 && { borderTopColor: palette.border }]}>
                  <View style={styles.flex}>
                    <ClassRow entry={entry} showTeacher={false} />
                  </View>
                  <Button
                    label={state === 'done' || state === 'now' ? 'Mark covered' : 'Plan'}
                    variant={focus?.entry.id === entry.id ? 'primary' : 'tonal'}
                    icon={{ ios: 'checklist', android: 'checklist' }}
                    onPress={() => openMarking(entry)}
                    accessibilityLabel={`Mark topics covered in ${entry.subject}, ${entry.batch.name}`}
                    style={styles.markButton}
                  />
                </View>
              ))}
            </Card>
          ) : (
            <Card>
              <Muted>{batches.length ? 'No classes today.' : "You don't teach any batch yet. Your tuition assigns you to batches."}</Muted>
            </Card>
          )}

          {attention.length ? (
            <>
              <SectionTitle title="Needs attention" action={attention.length > ATTENTION_ON_HOME ? <SeeAll label={`All ${attention.length}`} onPress={() => goToTab('tests')} /> : null} />
              <Card style={styles.flush}>
                {attention.slice(0, ATTENTION_ON_HOME).map((a, i) => (
                  <AttentionItem key={`${a.kind}-${a.testId}`} kind={a.kind} title={a.title} detail={a.detail} subjects={a.subjects} first={i === 0} onPress={() => openTest(a.testId)} />
                ))}
              </Card>
            </>
          ) : tests.error && !tests.data ? (
            <StaleNotice message={tests.error} onRetry={tests.reload} />
          ) : null}

          <AnnouncementsSection batches={batches} canPost={batches.length > 0} allowAllBatches={false} limit={2} />

          <Card style={styles.flush}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Weekly timetable, ${data.week.length} classes a week`}
              onPress={() => router.push('/timetable' as Href)}
              style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
            >
              <Icon name={{ ios: 'calendar', android: 'calendar_month' }} color={palette.primary} size={18} />
              <WeekLine count={data.week.length} />
              <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
            </Pressable>
          </Card>

          <DetailSheet visible={!!marking} title={marking ? `${marking.batch.name} · ${marking.subject}` : 'Syllabus'} onClose={closeMarking}>
            {marking ? <SyllabusProgressView batchId={marking.batch.id} subjects={[marking.subject]} editable /> : null}
          </DetailSheet>
        </>
      ) : (
        <Card>
          <EmptyView icon={{ ios: 'calendar', android: 'calendar_month' }} title="Nothing yet" text="Your classes and tests show here." />
        </Card>
      )}
    </Screen>
  );
}

function WeekLine({ count }: { count: number }) {
  const p = usePalette();
  return (
    <View style={styles.flex}>
      <Text style={[styles.rowTitle, { color: p.foreground }]}>Weekly timetable</Text>
      <Text style={[styles.meta, { color: p.mutedForeground }]}>{count ? `${count} class${count === 1 ? '' : 'es'} a week · add or change classes` : 'Add your weekly classes'}</Text>
    </View>
  );
}

function AttentionItem({ kind, title, detail, subjects, first, onPress }: { kind: AttentionKind; title: string; detail: string; subjects: string; first: boolean; onPress: () => void }) {
  const p = usePalette();
  const urgent = kind === 'waiting';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}. Opens the test`}
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }, pressed && styles.pressed]}
    >
      <Icon name={ATTENTION_ICON[kind]} color={urgent ? p.warningInk : p.inkSoft} size={20} />
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: urgent ? p.warningInk : p.foreground }]} numberOfLines={2}>
          {title}
        </Text>
        <SubjectChips subjects={subjects} />
        <Text style={[styles.meta, { color: p.mutedForeground }]} numberOfLines={2}>
          {detail}
        </Text>
      </View>
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={p.mutedForeground} size={16} />
    </Pressable>
  );
}

function SeeAll({ label, onPress }: { label: string; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}. Opens Tests`} onPress={onPress} hitSlop={12} style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}>
      <Text style={[styles.seeAllText, { color: p.primaryInk }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  flush: { padding: 0, gap: 0, overflow: 'hidden' },
  classRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'transparent' },
  markButton: { minWidth: 140 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  meta: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  seeAll: { minHeight: 32, justifyContent: 'center' },
  seeAllText: { fontSize: 13, fontWeight: '700' },
});
