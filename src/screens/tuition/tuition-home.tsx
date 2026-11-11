import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  EmptyView,
  ErrorView,
  Icon,
  ListRow,
  LoadingView,
  Muted,
  ProgressBar,
  Screen,
  SectionTitle,
  useLoad,
  usePalette,
  type IconName,
} from '@/components/kit';
import { formatAcademicYear, PROGRAM_LABELS } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { useDataVersion } from '@/context/data-version';
import { useTabNavigation } from '@/context/tab-context';
import { SkeletonCard, StaleNotice } from '@/components/states';
import { SubjectChips } from '@/components/subject-chips';
import { attentionRows, type AttentionKind as TestAttentionKind } from '@/screens/teacher/attention';
import { usePendingStudents } from '@/screens/tuition/requests-screen';
import { AnnouncementsSection } from '@/screens/shared/announcements';
import { NotificationBell } from '@/screens/shared/notification-bell';
import {
  attentionItems,
  classesOnDay,
  NO_BATCH,
  overallCoverage,
  plural,
  type AttentionItem,
  type AttentionKind,
} from '@/screens/tuition/admin-filters';
import { useBackToHome } from '@/screens/tuition/admin-ui';
import { batchHref } from '@/screens/tuition/batch-nav';
import { InviteStudentsPicker } from '@/screens/tuition/invite-students';
import { showStudents, showTeachers } from '@/screens/tuition/people-nav';
import { useJoinRequests } from '@/screens/tuition/tuition-notifications';
import { schoolApi, type TimetableEntry } from '@/services/school-api';
import { formatTime, tuitionApi, type Overview } from '@/services/tuition-api';

/** Classes listed under Today before "Show all". */
const TODAY_LIMIT = 4;

/** Test rows on the tuition's Home: paused students first, then live tests and fresh results (at most this many). */
const TEST_ROWS = 3;

/**
 * The tuition's home, in the order of what needs doing (Home answers "what
 * should I do now?"): Needs attention (everyone waiting to join, in one row
 * that opens the Join requests inbox; students paused in a test; live tests;
 * results just in; students with no batch; batches missing a teacher or
 * timetable), quick ways to add people and batches, today's classes,
 * announcements, then each batch's syllabus progress.
 */
export function TuitionHomeScreen() {
  const user = useSignedInUser();
  const version = useDataVersion();
  const router = useRouter();
  const { goToTab } = useTabNavigation();
  // Home is always mounted, so it owns Android's back button for the tuition's tabs.
  useBackToHome();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => tuitionApi.overview(), [version]);
  const requests = useJoinRequests();
  const enrollments = usePendingStudents();
  const timetable = useLoad(() => schoolApi.timetable(), [version]);
  // Every test of the tuition: students paused and waiting for a decision come first.
  // "Now" for the test rows is when the list loaded, so the rows match what was fetched.
  const tests = useLoad(async () => ({ list: await schoolApi.tests(), at: Date.now() }), [version]);
  const [inviting, setInviting] = useState(false);
  const [allClasses, setAllClasses] = useState(false);

  const waitingTeachers = requests.data?.length ?? 0;
  const waitingStudents = enrollments.data?.length ?? 0;
  const today = classesOnDay(timetable.data ?? [], new Date().getDay());
  const shownClasses = allClasses ? today : today.slice(0, TODAY_LIMIT);

  // Requests are one row here (see below); the rest come from attentionItems as before.
  const attention = data
    ? attentionItems({
        pendingStudents: 0,
        pendingTeachers: 0,
        unassignedStudents: data.totals.unassignedStudents,
        batches: data.batches,
      })
    : [];
  const waiting = waitingStudents + waitingTeachers;
  const testRows = tests.data ? attentionRows(tests.data.list, tests.data.at).filter((r) => r.kind !== 'opening').slice(0, TEST_ROWS) : [];
  const openRequests = () => router.push('/requests' as Href);
  const openTest = (id: string) => router.push({ pathname: '/test/[testId]', params: { testId: id } } as Href);

  const openAttention = (item: AttentionItem) => {
    const only = item.batches.length === 1 ? item.batches[0].id : null;
    switch (item.kind) {
      case 'students':
        showStudents();
        goToTab('people');
        break;
      case 'teachers':
        openRequests();
        break;
      case 'noBatch':
        showStudents(NO_BATCH);
        goToTab('people');
        break;
      case 'noTeacher':
        if (only) router.push(batchHref(only, 'assign-teacher'));
        else goToTab('batches');
        break;
      case 'noTimetable':
        if (only) router.push(batchHref(only, 'schedule'));
        else goToTab('batches');
        break;
    }
  };

  return (
    <Screen
      title={user.tuition.name || 'Your tuition'}
      subtitle="Students, teachers and batches at a glance"
      headerRight={<NotificationBell count={waiting} onPress={openRequests} />}
      onRefresh={() => {
        refresh();
        requests.reload();
        enrollments.reload();
        timetable.reload();
        tests.reload();
      }}
      refreshing={refreshing}
    >
      {loading ? (
        <>
          <SkeletonCard rows={3} label="what needs attention" />
          <SkeletonCard rows={2} label="today's classes" />
        </>
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data ? (
        <>
          {error ? <StaleNotice message={error} onRetry={reload} /> : null}
          {attention.length || waiting || testRows.length ? (
            <>
              <SectionTitle title="Needs attention" />
              <Card style={styles.listCard}>
                {waiting ? (
                  <ListRow
                    icon={ATTENTION_ICONS.students}
                    title={`${waiting} waiting to join`}
                    subtitle={[waitingStudents ? plural(waitingStudents, 'student') : null, waitingTeachers ? plural(waitingTeachers, 'teacher') : null].filter(Boolean).join(' · ') + ' · Open join requests'}
                    onPress={openRequests}
                    last={!testRows.length && !attention.length}
                  />
                ) : null}
                {testRows.map((r, i) => (
                  <TestAttentionRow key={`${r.kind}-${r.testId}`} kind={r.kind} title={r.title} detail={r.detail} subjects={r.subjects} last={i === testRows.length - 1 && !attention.length} onPress={() => openTest(r.testId)} />
                ))}
                {attention.map((item, i) => {
                  const text = attentionText(item);
                  return (
                    <ListRow
                      key={item.kind}
                      icon={ATTENTION_ICONS[item.kind]}
                      title={text.title}
                      subtitle={text.subtitle}
                      onPress={() => openAttention(item)}
                      last={i === attention.length - 1}
                    />
                  );
                })}
              </Card>
            </>
          ) : null}

          <SummaryStrip
            students={data.totals.students}
            teachers={data.totals.teachers}
            batches={data.totals.batches}
            onStudents={() => {
              showStudents();
              goToTab('people');
            }}
            onTeachers={() => {
              showTeachers();
              goToTab('people');
            }}
            onBatches={() => goToTab('batches')}
          />

          <View style={styles.actions}>
            <QuickAction label="Invite students" icon={{ ios: 'qrcode', android: 'group_add' }} onPress={() => setInviting(true)} />
            <QuickAction
              label="Add student"
              icon={{ ios: 'person.badge.plus', android: 'person_add' }}
              onPress={() => router.push({ pathname: '/student/new', params: { batchId: '' } })}
            />
            <QuickAction label="New batch" icon={{ ios: 'plus', android: 'add' }} onPress={() => router.push('/batch/new')} />
          </View>

          <SectionTitle
            title="Today's classes"
            action={today.length > TODAY_LIMIT ? <TextAction label={allClasses ? 'Show fewer' : `Show all ${today.length}`} onPress={() => setAllClasses((v) => !v)} /> : undefined}
          />
          {timetable.loading ? (
            <LoadingView label="Loading today's classes…" />
          ) : timetable.error && !timetable.data ? (
            <View style={styles.inline}>
              <Muted>Couldn&apos;t load today&apos;s classes.</Muted>
              <TextAction label="Retry" onPress={timetable.reload} />
            </View>
          ) : today.length ? (
            <Card style={styles.listCard}>
              {shownClasses.map((entry, i) => (
                <TodayRow key={entry.id} entry={entry} last={i === shownClasses.length - 1} onPress={() => router.push(batchHref(entry.batch.id, 'schedule'))} />
              ))}
            </Card>
          ) : (
            <Muted>{(timetable.data ?? []).length ? 'No classes today.' : 'No timetable yet. Add classes from a batch’s Schedule.'}</Muted>
          )}

          <AnnouncementsSection batches={data.batches.map((b) => ({ id: b.id, name: b.name }))} canPost allowAllBatches limit={2} compact />

          <SectionTitle title="Syllabus progress" />
          {data.batches.length === 0 ? (
            <Card>
              <EmptyView
                icon={{ ios: 'square.grid.2x2', android: 'grid_view' }}
                title="No batches yet"
                text="Create your first batch, then add teachers and students to it."
                action={<Button label="Create batch" icon={{ ios: 'plus', android: 'add' }} onPress={() => router.push('/batch/new')} />}
              />
            </Card>
          ) : (
            <Card style={styles.listCard}>
              {data.batches.map((batch, i) => (
                <BatchProgressRow key={batch.id} batch={batch} last={i === data.batches.length - 1} onPress={() => router.push(batchHref(batch.id))} />
              ))}
            </Card>
          )}
        </>
      ) : null}
      {inviting && data ? <InviteStudentsPicker batches={data.batches} onClose={() => setInviting(false)} /> : null}
    </Screen>
  );
}

// ─── Needs attention ───────────────────────────────────────────────────────

const ATTENTION_ICONS: Record<AttentionKind, IconName> = {
  students: { ios: 'person.crop.circle.badge.plus', android: 'person_add' },
  teachers: { ios: 'person.crop.circle.badge.plus', android: 'person_add' },
  noTeacher: { ios: 'person.crop.rectangle', android: 'co_present' },
  noBatch: { ios: 'person.3', android: 'groups' },
  noTimetable: { ios: 'calendar', android: 'calendar_month' },
};

/** "Maths, Physics +1" for a few batch names. */
function nameList(batches: AttentionItem['batches']) {
  const names = batches.slice(0, 2).map((b) => b.name);
  return batches.length > 2 ? `${names.join(', ')} +${batches.length - 2}` : names.join(', ');
}

function attentionText(item: AttentionItem): { title: string; subtitle: string } {
  const n = item.count;
  switch (item.kind) {
    case 'students':
      return { title: `${plural(n, 'student')} waiting to join`, subtitle: 'Approve or reject them in People' };
    case 'teachers':
      return { title: `${n} ${n === 1 ? 'teacher wants' : 'teachers want'} to join`, subtitle: 'Review them under Pending Teachers' };
    case 'noTeacher':
      return { title: `${plural(n, 'batch', 'batches')} ${n === 1 ? 'needs' : 'need'} a teacher`, subtitle: nameList(item.batches) };
    case 'noBatch':
      return { title: `${plural(n, 'student')} ${n === 1 ? 'has' : 'have'} no batch`, subtitle: 'Assign them in People' };
    case 'noTimetable':
      return { title: `${plural(n, 'batch', 'batches')} ${n === 1 ? 'has' : 'have'} no timetable`, subtitle: nameList(item.batches) };
  }
}

/** A test that needs the tuition: students waiting in a paused test (first, in amber words), live, or results just in. */
function TestAttentionRow({ kind, title, detail, subjects, last, onPress }: { kind: TestAttentionKind; title: string; detail: string; subjects: string; last: boolean; onPress: () => void }) {
  const palette = usePalette();
  const urgent = kind === 'waiting';
  const icon: IconName = urgent ? { ios: 'pause.circle.fill', android: 'pause_circle' } : kind === 'live' ? { ios: 'dot.radiowaves.left.and.right', android: 'sensors' } : { ios: 'chart.bar', android: 'bar_chart' };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}. Opens the test`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }, pressed && styles.pressed]}
    >
      <Icon name={icon} color={urgent ? palette.warningInk : palette.inkSoft} size={20} />
      <View style={[styles.flex, styles.gap]}>
        <Text style={[styles.rowTitle, { color: urgent ? palette.warningInk : palette.foreground }]} numberOfLines={2}>
          {title}
        </Text>
        <SubjectChips subjects={subjects} />
        <Text style={[styles.rowMeta, { color: palette.mutedForeground }]} numberOfLines={2}>
          {detail}
        </Text>
      </View>
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
    </Pressable>
  );
}

// ─── Summary and quick actions ─────────────────────────────────────────────

/** The three totals in one compact, tappable strip. */
function SummaryStrip({
  students,
  teachers,
  batches,
  onStudents,
  onTeachers,
  onBatches,
}: {
  students: number;
  teachers: number;
  batches: number;
  onStudents: () => void;
  onTeachers: () => void;
  onBatches: () => void;
}) {
  const palette = usePalette();
  const cells = [
    { label: 'Students', value: students, hint: 'Opens People, showing students', onPress: onStudents },
    { label: 'Teachers', value: teachers, hint: 'Opens People, showing teachers', onPress: onTeachers },
    { label: 'Batches', value: batches, hint: 'Opens Batches', onPress: onBatches },
  ];
  return (
    <View style={[styles.strip, { backgroundColor: palette.card, borderColor: palette.border }]}>
      {cells.map((c, i) => (
        <Pressable
          key={c.label}
          accessibilityRole="button"
          accessibilityLabel={`${c.value} ${c.label.toLowerCase()}`}
          accessibilityHint={c.hint}
          onPress={c.onPress}
          style={({ pressed }) => [styles.stripCell, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: palette.border }, pressed && styles.pressed]}
        >
          <Text style={[styles.stripValue, { color: palette.foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {c.value}
          </Text>
          <Text style={[styles.stripLabel, { color: palette.mutedForeground }]} numberOfLines={1}>
            {c.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function QuickAction({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: palette.card, borderColor: palette.border }, pressed && styles.pressed]}
    >
      <Icon name={icon} color={palette.primary} size={20} />
      <Text style={[styles.actionLabel, { color: palette.foreground }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A small text button beside a section title. */
function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
      <Text style={[styles.textAction, { color: palette.primary }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Today and batches ─────────────────────────────────────────────────────

/** One class today: time, subject, batch and teacher (flagged when there is none). */
function TodayRow({ entry, last, onPress }: { entry: TimetableEntry; last: boolean; onPress: () => void }) {
  const palette = usePalette();
  const noTeacher = !entry.teacher.name;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.subject}, ${formatTime(entry.start)} to ${formatTime(entry.end)}, ${entry.batch.name}, ${noTeacher ? 'no teacher' : entry.teacher.name}`}
      accessibilityHint="Opens the batch's schedule"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }, pressed && styles.pressed]}
    >
      <View style={styles.timeCol}>
        <Text style={[styles.time, { color: palette.foreground }]}>{formatTime(entry.start)}</Text>
        <Text style={[styles.timeEnd, { color: palette.mutedForeground }]}>{formatTime(entry.end)}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={1}>
          {entry.subject}
        </Text>
        <Text style={[styles.rowMeta, { color: noTeacher ? palette.warningInk : palette.mutedForeground, fontWeight: noTeacher ? '700' : '400' }]} numberOfLines={2}>
          {[entry.batch.name, noTeacher ? 'No teacher yet' : entry.teacher.name].join(' · ')}
        </Text>
      </View>
      <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
    </Pressable>
  );
}

/** A batch with how much of its syllabus is covered overall; per-subject progress is in the batch's details. */
function BatchProgressRow({ batch, last, onPress }: { batch: Overview['batches'][number]; last: boolean; onPress: () => void }) {
  const palette = usePalette();
  const progress = overallCoverage(batch.coverage);
  const detail = [batch.standard, plural(batch.studentCount, 'student')].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${batch.name}, ${PROGRAM_LABELS[batch.program]}, ${detail}, ${progress ? `${progress.percent}% of the syllabus covered` : 'no syllabus found'}`}
      accessibilityHint="Opens the batch"
      onPress={onPress}
      style={({ pressed }) => [styles.batchRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }, pressed && styles.pressed]}
    >
      <View style={styles.batchLine}>
        <View style={styles.flex}>
          <Text style={[styles.rowTitle, { color: palette.foreground }]} numberOfLines={1}>
            {batch.name}
          </Text>
          <Text style={[styles.rowMeta, { color: palette.mutedForeground }]} numberOfLines={1}>
            {detail}
            {batch.academicYear ? ` · ${formatAcademicYear(batch.academicYear)}` : ''}
          </Text>
        </View>
        {progress ? <Text style={[styles.percent, { color: palette.foreground }]}>{progress.percent}%</Text> : <Badge label="No syllabus" />}
        <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} color={palette.mutedForeground} size={16} />
      </View>
      {progress ? <ProgressBar value={progress.percent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap: { gap: 3 },
  pressed: { opacity: 0.75 },
  listCard: { paddingVertical: 0, paddingHorizontal: 14, gap: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textAction: { fontSize: 13, fontWeight: '700' },
  strip: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  stripCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 8, minHeight: 56 },
  stripValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stripLabel: { fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, minHeight: 68, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6 },
  actionLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, minHeight: 56 },
  timeCol: { width: 66 },
  time: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timeEnd: { fontSize: 12, fontVariant: ['tabular-nums'] },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowMeta: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  batchRow: { paddingVertical: 11, gap: 8, minHeight: 56 },
  batchLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  percent: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
