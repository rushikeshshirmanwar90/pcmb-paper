import React, { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import {
  Badge,
  Button,
  Card,
  EmptyView,
  ErrorText,
  ErrorView,
  Icon,
  ListRow,
  LoadingView,
  Muted,
  ProgressBar,
  Screen,
  SectionTitle,
  StatGrid,
  StatTile,
  useLoad,
  usePalette,
} from '@/components/kit';
import { formatAcademicYear, PROGRAM_LABELS } from '@/constants/school';
import { useSignedInUser } from '@/context/auth-context';
import { useDataVersion } from '@/context/data-version';
import { useTabNavigation } from '@/context/tab-context';
import { AnnouncementsSection } from '@/screens/shared/announcements';
import { NotificationBell } from '@/screens/shared/notification-bell';
import { NO_BATCH } from '@/screens/tuition/admin-filters';
import { copyText, FlashNotice, useBackToHome, useFlash } from '@/screens/tuition/admin-ui';
import { showStudents } from '@/screens/tuition/people-nav';
import { TuitionNotificationsSheet, useJoinRequests } from '@/screens/tuition/tuition-notifications';
import { tuitionApi, type Overview } from '@/services/tuition-api';

/**
 * The tuition's home: totals, the join code to hand out, then each batch with
 * its students and how much of each subject's syllabus it has covered, then
 * announcements.
 */
export function TuitionHomeScreen() {
  const user = useSignedInUser();
  const palette = usePalette();
  const version = useDataVersion();
  const { goToTab } = useTabNavigation();
  // Home is always mounted, so it owns Android's back button for the tuition's tabs.
  useBackToHome();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => tuitionApi.overview(), [version]);
  const requests = useJoinRequests();
  const waiting = requests.data?.length ?? 0;
  const [showNotifications, setShowNotifications] = useState(false);
  // Bumped to reload the join code: on pull to refresh, and after the
  // notifications sheet (which can make a new code) closes.
  const [codeRound, setCodeRound] = useState(0);

  return (
    <Screen
      title={user.tuition.name || 'Your tuition'}
      subtitle="Students, teachers and batches at a glance"
      headerRight={<NotificationBell count={waiting} onPress={() => setShowNotifications(true)} />}
      onRefresh={() => {
        refresh();
        requests.reload();
        setCodeRound((n) => n + 1);
      }}
      refreshing={refreshing}
    >
      {loading ? (
        <LoadingView />
      ) : error && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data ? (
        <>
          {waiting ? (
            <Card>
              <ListRow
                icon={{ ios: 'person.crop.circle.badge.plus', android: 'person_add' }}
                title={`${waiting} ${waiting === 1 ? 'person wants' : 'people want'} to join`}
                subtitle="Accept them as students or teachers"
                onPress={() => setShowNotifications(true)}
                last
              />
            </Card>
          ) : null}
          <StatGrid>
            <StatTile label="Students" value={data.totals.students} icon={{ ios: 'person.3.fill', android: 'groups' }} />
            <StatTile label="Teachers" value={data.totals.teachers} icon={{ ios: 'person.crop.rectangle.stack', android: 'co_present' }} tone="violet" />
            <StatTile label="Batches" value={data.totals.batches} icon={{ ios: 'square.grid.2x2', android: 'grid_view' }} tone="success" />
          </StatGrid>
          {data.totals.unassignedStudents > 0 ? (
            <Muted>
              {data.totals.unassignedStudents} student{data.totals.unassignedStudents === 1 ? ' has' : 's have'} no batch yet.{' '}
              <Text
                accessibilityRole="link"
                accessibilityHint="Opens People, showing students without a batch"
                onPress={() => {
                  showStudents(NO_BATCH);
                  goToTab('people');
                }}
                style={[styles.link, { color: palette.primary }]}
              >
                Assign them in People
              </Text>
            </Muted>
          ) : null}

          <JoinCodeQuickCard round={codeRound} onShowRequests={() => setShowNotifications(true)} waiting={waiting} />

          <SectionTitle title="Batches" />
          {data.batches.length === 0 ? (
            <Card>
              <EmptyView
                icon={{ ios: 'square.grid.2x2', android: 'grid_view' }}
                title="No batches yet"
                text="Create your first batch from the Batches tab, then add teachers and students to it."
              />
            </Card>
          ) : (
            data.batches.map((batch) => <BatchCoverageCard key={batch.id} batch={batch} />)
          )}

          <AnnouncementsSection batches={data.batches.map((b) => ({ id: b.id, name: b.name }))} canPost allowAllBatches />
        </>
      ) : null}
      <TuitionNotificationsSheet
        visible={showNotifications}
        onClose={() => {
          setShowNotifications(false);
          setCodeRound((n) => n + 1);
        }}
        requests={requests}
      />
    </Screen>
  );
}

/**
 * The institute's join code, ready to hand out: copy, share, or make a new
 * one. Anyone who joins with it waits for the tuition to accept them.
 */
function JoinCodeQuickCard({ round, waiting, onShowRequests }: { round: number; waiting: number; onShowRequests: () => void }) {
  const palette = usePalette();
  const user = useSignedInUser();
  const { data: code, error, loading, setData, reload } = useLoad(() => tuitionApi.joinCode(), [round]);
  const [renewing, setRenewing] = useState(false);
  const { flash, show, clear } = useFlash();

  const copy = async () => {
    if (!code) return;
    if (await copyText(code)) show('Join code copied.');
    else show("Couldn't copy here. Press and hold the code to copy it.", 'danger');
  };

  const share = () =>
    code &&
    Share.share({
      message: `Join ${user.tuition.name} on the PCMB app: create an account, tap "Join a tuition" and enter the code ${code}.`,
    }).catch(() => {});

  const renew = () =>
    confirmAction('Make a new join code?', "The current code stops working. People who already joined aren't affected.", 'Make new code', async () => {
      setRenewing(true);
      clear();
      try {
        const next = await tuitionApi.renewJoinCode();
        setData(() => next);
        show('New join code ready. The old one no longer works.');
      } catch (e) {
        show(e instanceof Error ? e.message : "Couldn't make a new code.", 'danger');
      } finally {
        setRenewing(false);
      }
    });

  return (
    <Card>
      <View style={styles.codeTop}>
        <View style={[styles.codeIcon, { backgroundColor: palette.primarySoft }]}>
          <Icon name={{ ios: 'key', android: 'key' }} color={palette.primary} size={18} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.codeTitle, { color: palette.foreground }]}>Institute join code</Text>
          <Text style={[styles.codeHint, { color: palette.mutedForeground }]}>
            Students and teachers ask to join with it. You approve each request.
          </Text>
        </View>
      </View>

      <View style={[styles.codeBox, { backgroundColor: palette.background, borderColor: palette.border }]}>
        <Text
          selectable
          accessibilityLabel={code ? `Join code ${code.split('').join(' ')}` : 'Join code loading'}
          style={[styles.code, { color: code ? palette.foreground : palette.mutedForeground }]}
        >
          {code ?? (loading ? '····-····' : '—')}
        </Text>
      </View>

      {error && !code ? (
        <View style={styles.codeError}>
          <ErrorText message={`Couldn't load the join code. ${error}`} />
          <Button label="Try again" variant="secondary" onPress={reload} />
        </View>
      ) : null}
      <FlashNotice flash={flash} onDismiss={clear} />

      <View style={styles.codeActions}>
        <Button
          label="Copy"
          variant="secondary"
          icon={{ ios: 'doc.on.doc', android: 'content_copy' }}
          onPress={() => void copy()}
          disabled={!code}
          style={styles.codeButton}
          accessibilityLabel="Copy join code"
        />
        <Button
          label="Share"
          variant="tonal"
          icon={{ ios: 'square.and.arrow.up', android: 'share' }}
          onPress={() => void share()}
          disabled={!code}
          style={styles.codeButton}
          accessibilityLabel="Share join code"
        />
        <Button
          label="Renew"
          variant="secondary"
          icon={{ ios: 'arrow.clockwise', android: 'refresh' }}
          onPress={renew}
          loading={renewing}
          disabled={!code}
          style={styles.codeButton}
          accessibilityLabel="Make a new join code"
        />
      </View>
      {waiting ? (
        <Muted>
          {waiting} waiting for approval.{' '}
          <Text accessibilityRole="link" onPress={onShowRequests} style={[styles.link, { color: palette.primary }]}>
            Review requests
          </Text>
        </Muted>
      ) : null}
    </Card>
  );
}

function BatchCoverageCard({ batch }: { batch: Overview['batches'][number] }) {
  const palette = usePalette();
  return (
    <Card>
      <View style={styles.batchTop}>
        <Text style={[styles.batchName, { color: palette.foreground }]} numberOfLines={1}>
          {batch.name}
        </Text>
        <Badge label={PROGRAM_LABELS[batch.program]} tone="primary" />
        {batch.academicYear ? <Badge label={formatAcademicYear(batch.academicYear)} /> : null}
      </View>
      <Muted>
        {batch.studentCount} student{batch.studentCount === 1 ? '' : 's'}
        {batch.standard ? ` · ${batch.standard}` : ''}
        {batch.venue ? ` · ${batch.venue}` : ''}
      </Muted>
      <View style={styles.subjects}>
        {batch.subjects.map((subject) => {
          const c = batch.coverage[subject];
          return (
            <View key={subject} style={styles.subjectRow}>
              <View style={styles.subjectLabel}>
                <Text style={[styles.subjectName, { color: palette.foreground }]}>{subject}</Text>
                <Text style={[styles.subjectPct, { color: palette.mutedForeground }]}>
                  {c && c.total ? `${c.percent}% covered · ${c.covered}/${c.total} topics` : 'No syllabus found'}
                </Text>
              </View>
              <ProgressBar value={c?.percent ?? 0} />
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  codeTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  codeIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  codeTitle: { fontSize: 16, fontWeight: '700' },
  codeHint: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  codeBox: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  code: { fontSize: 26, fontWeight: '800', letterSpacing: 4, fontVariant: ['tabular-nums'] },
  codeError: { gap: 8 },
  codeActions: { flexDirection: 'row', gap: 8 },
  codeButton: { flex: 1, paddingHorizontal: 8 },
  link: { fontWeight: '700' },
  batchTop: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
  batchName: { fontSize: 17, fontWeight: '700', flex: 1 },
  subjects: { gap: 10, marginTop: 4 },
  subjectRow: { gap: 5 },
  subjectLabel: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  subjectName: { fontSize: 14, fontWeight: '600' },
  subjectPct: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
