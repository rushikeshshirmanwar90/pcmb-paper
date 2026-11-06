import { AttemptControls } from '@/screens/teacher/attempt-controls';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { Badge, Button, Card, DetailSheet, DetailRow, EmptyView, ErrorText, ErrorView, Icon, ListRow, LoadingView, Muted, Notice, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { confirmAction } from '@/components/account-section';
import { StackScreen, useGoBack } from '@/components/stack-screen';
import { useSignedInUser } from '@/context/auth-context';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { AddTestStudents } from '@/screens/teacher/add-test-students';
import { TestWizard } from '@/screens/teacher/teacher-tests';
import { TestLiveManagement } from '@/screens/teacher/test-live-management';
import { TestCompletedResults } from '@/screens/teacher/test-completed-results';
import { useLiveMonitor } from '@/screens/teacher/test-monitor-section';
import { refreshedLabel, rowLines } from '@/screens/teacher/test-monitor';
import { matchesAccess, matchesParticipation, PARTICIPATION_GROUPS, participationCounts, type ParticipationGroup } from '@/screens/teacher/test-management';
import { actionsFor, STATUS_WORDS } from '@/screens/teacher/test-schedule';
import { dateTimeLabel, schoolApi, type AccessStudent, type TestMonitorRow } from '@/services/school-api';

export function TestManagementScreen({ testId }: { testId: string }) {
  const user = useSignedInUser();
  if (user.role !== 'teacher' && user.role !== 'tuition') return <StackScreen title="Test management"><Notice title="Teacher access required" text="Only teachers and tuition administrators can manage tests." /></StackScreen>;
  return <TeacherTestPage testId={testId} />;
}

function TeacherTestPage({ testId }: { testId: string }) {
  const palette = usePalette();
  const goBack = useGoBack();
  const focused = useIsFocused();
  const version = useDataVersion();
  const { data, error, loading, refreshing, refresh, reload } = useLoad(() => schoolApi.test(testId), [testId, version]);
  const overview = useLoad(() => schoolApi.teacherOverview(), [], { enabled: !!data?.canEdit });
  const test = data?.test;
  const monitor = useLiveMonitor(testId, !focused || !test ? 'off' : test.status === 'closed' ? 'off' : test.status === 'open' ? 'poll' : 'once', reload);
  const [group, setGroup] = useState<ParticipationGroup>('taking');
  const [query, setQuery] = useState('');
  const [studentDetail, setStudentDetail] = useState<TestMonitorRow | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const can = test ? actionsFor(test) : null;
  const managed = test?.accessVersion === 1;
  const hasAccess = Array.isArray(monitor.data?.accessStudents);
  const closed = test?.status === 'closed';
  const selectedGroup = PARTICIPATION_GROUPS.find(item => item.key === group)!;
  const changed = () => { bumpDataVersion(); reload(); void monitor.refresh(); };
  const act = async (key: string, action: () => Promise<unknown>, message: string) => {
    if (busy) return;
    setBusy(key); setActionError(null); setFeedback(null);
    try { await action(); setFeedback(message); changed(); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Could not save. Refresh and try again.'); }
    finally { setBusy(null); }
  };
  const accessAction = (row: AccessStudent, action: 'approve' | 'decline' | 'revoke') => {
    const run = () => void act(row.student.id, () => schoolApi.testAccess(testId, row.student.id, action), action === 'approve' ? `${row.student.name} can now take this test.` : action === 'decline' ? `Declined the request from ${row.student.name}.` : `Removed access for ${row.student.name}.`);
    if (action === 'revoke') confirmAction('Remove test access?', `${row.student.name} will not be able to start this test. Already-started attempts are protected.`, 'Remove access', run);
    else run();
  };
  const studentRows = (monitor.data?.students ?? []).filter(row => matchesParticipation(row, group) && row.student.name.toLowerCase().includes(query.trim().toLowerCase()));
  const accessRows = (monitor.data?.accessStudents ?? []).filter(row => matchesAccess(row, group) && row.student.name.toLowerCase().includes(query.trim().toLowerCase()));
  const footer = !closed && data?.canEdit && test && can && (can.edit || can.cancel || can.closeNow) ? <View style={styles.actions}>
    {can.edit ? <Button label="Edit test" variant="secondary" disabled={!!busy || overview.loading || !overview.data} onPress={() => setEditing(true)} /> : null}
    {can.cancel ? <Button label="Cancel test" variant="danger" disabled={!!busy} onPress={() => confirmAction('Cancel this test?', 'This upcoming test will be removed. Its question bank stays unchanged.', 'Cancel test', () => void act('cancel', async () => { await schoolApi.deleteTest(testId); goBack(); }, 'Test cancelled.'))} /> : null}
    {can.closeNow ? <Button label="End test for everyone" variant="danger" disabled={!!busy} onPress={() => confirmAction('End the test now?', 'All attempts still in progress will be submitted using saved answers. No more students can start.', 'End test', () => void act('end', () => schoolApi.updateTest(testId, { closeNow: true }), 'The test has ended.'))} /> : null}
  </View> : undefined;

  return <>
    <StackScreen title="Test management" subtitle={test?.status === 'open' ? 'Live participation and student access' : closed ? 'Results and analysis' : 'Schedule and student access'} onRefresh={() => { refresh(); void monitor.refresh(); }} refreshing={refreshing} footer={footer}>
      {loading ? <LoadingView label="Loading test…" /> : error && !data ? <ErrorView message={error} onRetry={reload} /> : test && data ? <>
        <View style={styles.heading}>
          <Badge label={STATUS_WORDS[test.status].label} tone={STATUS_WORDS[test.status].tone} />
          <Text accessibilityRole="header" style={[styles.title, { color: palette.foreground }]}>{test.title}</Text>
          <Text style={[styles.subtitle, { color: palette.mutedForeground }]}>{test.subject} · {(test.batches ?? [test.batch]).map(b => b.name).join(', ')}</Text>
          <Muted>{test.status === 'open' ? 'Closes' : closed ? 'Closed' : 'Opens'} {dateTimeLabel(test.status === 'scheduled' ? test.opensAt : test.closesAt)}</Muted>
        </View>
        <ErrorText message={actionError} />
        {feedback ? <Notice tone="success" title="Test updated" text={feedback} /> : null}
        {data.canEdit && !closed ? <>
          <Button label="Add students" icon={{ ios: 'person.badge.plus', android: 'person_add' }} disabled={!!busy} onPress={() => setAddOpen(true)} />
          {managed ? <Muted>Allow students from the selected batches to join{test.status === 'open' ? ' the ongoing test' : ''}, even without an access request.</Muted> : <Muted>This older test allows students through batch enrollment. Individual access controls are available for newly created tests.</Muted>}
        </> : null}
        {!closed ? !monitor.data ? (monitor.error ? <ErrorView message={monitor.error} onRetry={monitor.refresh} /> : <LoadingView label="Loading students…" />) : <>
          <TestLiveManagement monitor={monitor.data} group={group} onGroup={setGroup} query={query} onQuery={setQuery} />
          {monitor.lastOk ? <Muted>Updated {refreshedLabel(monitor.lastOk)}{test.status === 'open' ? ' · refreshes every 15 seconds' : ''}</Muted> : null}
          {monitor.error ? <ErrorText message={`Could not refresh. Showing the last update. ${monitor.error}`} /> : null}
          {managed && !hasAccess ? <Notice title="Student access could not be loaded" text="This server did not return test access records. The Phase 1 backend must be available to approve requests or add students." /> : null}
          <SectionTitle title={`${selectedGroup.label} (${monitor.data ? participationCounts(monitor.data)[group] : 0})`} />
          <Muted>{selectedGroup.description}</Muted>
          {studentRows.length || accessRows.length ? <Card style={styles.list}>
            {studentRows.map((row, index) => {
              const permission = monitor.data?.accessStudents?.find(r => r.student.id === row.student.id);
              const lines = rowLines(row);
              return <View key={row.student.id}>
                <ListRow onPress={() => setStudentDetail(row)} title={row.student.name} subtitle={row.state === 'not-started' ? 'Allowed to take this test · Not started' : lines.filter(Boolean).join('\n')} last={index === studentRows.length - 1} right={<Badge label={participationLabel(row)} tone={row.state === 'violation' ? 'danger' : row.state === 'in-progress' ? 'primary' : 'neutral'} />} />
                {data.canEdit && !closed && permission && !permission.started && permission.allowed ? <View style={styles.rowAction}><Button label="Remove access" variant="secondary" disabled={!!busy} onPress={() => accessAction(permission, 'revoke')} /></View> : null}
              </View>;
            })}
            {accessRows.map((row, index) => <View key={row.student.id}>
              <ListRow title={row.student.name} subtitle={[row.batch?.name, !row.eligible ? 'Account activation or enrollment needs attention' : row.request === 'pending' ? 'Waiting for teacher approval' : row.request === 'declined' ? 'Access request declined' : 'Not allowed to start this test'].filter(Boolean).join(' | ')} last={index === accessRows.length - 1} />
              {data.canEdit && !closed ? <View style={styles.rowAction}>
                {row.request === 'pending' ? <><Button label="Approve request" disabled={!!busy || !row.eligible} onPress={() => accessAction(row, 'approve')} /><Button label="Decline request" variant="secondary" disabled={!!busy} onPress={() => accessAction(row, 'decline')} /></> : row.eligible ? <Button label="Allow student" variant="secondary" disabled={!!busy} onPress={() => void act(row.student.id, () => schoolApi.testAccess(testId, row.student.id, 'grant'), `${row.student.name} can now take this test.`)} /> : null}
              </View> : null}
            </View>)}
          </Card> : <EmptyView icon={{ ios: 'person.2', android: 'groups' }} title={query ? 'No students found' : `No students in ${selectedGroup.label.toLowerCase()}`} text={query ? 'Try another name.' : 'This list updates as students start, submit or receive access.'} />}
        </> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }} onPress={() => setDetailsOpen(v => !v)} style={styles.detailsTrigger}>
          <Text style={[styles.detailsLabel, { color: palette.foreground }]}>Schedule and marking</Text>
          <Icon name={detailsOpen ? { ios: 'chevron.up', android: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more' }} color={palette.mutedForeground} size={20} />
        </Pressable>
        {detailsOpen ? <Card><DetailRow label="Opens" value={dateTimeLabel(test.opensAt)} /><DetailRow label="Closes" value={dateTimeLabel(test.closesAt)} /><DetailRow label="Time limit" value={`${test.durationMinutes} minutes`} /><DetailRow label="Questions" value={String(test.questionCount)} /><DetailRow label="Maximum marks" value={String(test.maxScore)} /><DetailRow label="Marking" value={`+${test.marksPerQuestion}${test.negativeMarks ? ` / −${test.negativeMarks}` : ', no negative marks'}`} /><DetailRow label="Set by" value={test.teacher.name} /></Card> : null}
        {closed ? <TestCompletedResults test={test} questions={data.questions} /> : null}
      </> : null}
    </StackScreen>
    {studentDetail && !closed ? data?.canEdit ? <AttemptControls testId={testId} row={studentDetail} onClose={() => setStudentDetail(null)} onChanged={message => { setFeedback(message); changed(); }} /> : <DetailSheet visible title={studentDetail.student.name} onClose={() => setStudentDetail(null)}><Badge label={participationLabel(studentDetail)} /><Muted>{rowLines(studentDetail).filter(Boolean).join(" | ")}</Muted></DetailSheet> : null}
    {addOpen && !closed && test ? <AddTestStudents test={test} monitor={monitor.data} onClose={() => setAddOpen(false)} onChanged={added => { if (added) setFeedback(`Allowed ${added} student${added === 1 ? '' : 's'} to take this test.`); changed(); }} /> : null}
    {editing && data && overview.data ? <TestWizard edit={{ test: data.test, questions: data.questions }} batches={overview.data.batches} onClose={() => setEditing(false)} onView={() => { setEditing(false); changed(); }} onManage={() => { setEditing(false); changed(); }} /> : null}
  </>;
}

function participationLabel(row: TestMonitorRow) {
  return row.state === 'in-progress' ? 'In progress' : row.state === 'not-started' ? 'Not started' : row.state === 'violation' ? 'Violation' : row.state === 'auto-submitted' ? 'Auto-submitted' : 'Submitted';
}

const styles = StyleSheet.create({
  heading: { gap: 4, alignItems: 'flex-start' },
  title: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  subtitle: { fontSize: 14, lineHeight: 21 },
  list: { paddingVertical: 0 },
  rowAction: { paddingHorizontal: 12, paddingBottom: 14, gap: 8 },
  actions: { gap: 8 },
  detailsTrigger: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  detailsLabel: { fontSize: 16, fontWeight: '600' },
});
