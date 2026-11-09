import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import { Badge, Button, Card, ErrorText, Icon, Muted, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { PROGRAM_LABELS } from '@/constants/school';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { Avatar, OptionPicker, type PickerOption } from '@/screens/tuition/admin-ui';
import { enrollmentsApi, timeAgo, tuitionApi, type Batch, type Enrollment, type EnrollmentResult } from '@/services/tuition-api';

/**
 * People › Students › Pending Enrollments: students who used a joining code
 * or were added by an admin and wait to be enrolled. Tick one, several or all,
 * then approve or reject them together. Admin-created batch-assignment
 * requests (no batch) get individual handling. Shows nothing when none waiting.
 */
export function PendingEnrollments({ onDone }: { onDone: (message: string, tone?: 'danger') => void }) {
  const palette = usePalette();
  const version = useDataVersion();
  const { data, error, reload } = useLoad(() => enrollmentsApi.pending(), [version]);
  const batchesLoad = useLoad(() => tuitionApi.batches(), [version], { cacheKey: 'batches' });
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const list = data ?? [];
  const chosen = selected.filter((id) => list.some((e) => e.id === id));

  // Split into join-code (bulk selectable) and admin-created batch-assignment (individual).
  const joinCodeRequests = list.filter((e) => (e.source ?? 'join_code') === 'join_code' && e.batch);
  const adminRequests = list.filter((e) => e.source === 'admin_created');

  if (!list.length && !error) return null;

  const decide = async (action: 'approve' | 'reject') => {
    setBusy(action);
    setProblem(null);
    try {
      const result = await enrollmentsApi.decide(chosen, action);
      setSelected([]);
      bumpDataVersion();
      onDone(summary(result), result.failed.length ? 'danger' : undefined);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Couldn't save. Try again.");
      reload();
    } finally {
      setBusy(null);
    }
  };
  const reject = () =>
    confirmAction(
      `Reject ${chosen.length === 1 ? 'this student' : `${chosen.length} students`}?`,
      'They can enter a code and ask again.',
      'Reject',
      () => decide('reject')
    );

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const selectableIds = joinCodeRequests.map((e) => e.id);
  const all = selectableIds.length > 0 && selectableIds.every((id) => chosen.includes(id));
  const count = chosen.length ? ` (${chosen.length})` : '';

  return (
    <>
      <SectionTitle
        title={`Pending Enrollments (${list.length})`}
        action={
          selectableIds.length > 0 ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setSelected(all ? [] : selectableIds)}>
              <Text style={[styles.link, { color: palette.primary }]}>{all ? 'Clear' : 'Select all'}</Text>
            </Pressable>
          ) : undefined
        }
      />
      <ErrorText message={error ?? problem} />

      {/* Join-code requests: bulk selectable */}
      {joinCodeRequests.length > 0 ? (
        <>
          <Card style={styles.card}>
            {joinCodeRequests.map((e, i) => (
              <JoinCodeEnrollmentRow key={e.id} enrollment={e} last={i === joinCodeRequests.length - 1} checked={chosen.includes(e.id)} onToggle={() => toggle(e.id)} />
            ))}
          </Card>
          <View style={styles.row}>
            <Button label={`Reject${count}`} variant="secondary" disabled={!chosen.length || busy !== null} loading={busy === 'reject'} onPress={reject} style={styles.flex} />
            <Button label={`Approve${count}`} disabled={!chosen.length || busy !== null} loading={busy === 'approve'} onPress={() => decide('approve')} style={styles.flex} />
          </View>
          <Muted>Tick the students to decide. Approved students join their batch and get the app.</Muted>
        </>
      ) : null}

      {/* Admin-created requests: individual actions */}
      {adminRequests.length > 0 ? (
        <Card style={styles.card}>
          {adminRequests.map((e, i) => (
            <AdminEnrollmentRow
              key={e.id}
              enrollment={e}
              batches={batchesLoad.data ?? []}
              last={i === adminRequests.length - 1}
              onDone={(msg, tone) => { bumpDataVersion(); onDone(msg, tone); }}
            />
          ))}
        </Card>
      ) : null}
    </>
  );
}

function summary({ approved, rejected, failed }: EnrollmentResult) {
  const parts = [
    approved ? `${approved} approved` : null,
    rejected ? `${rejected} rejected` : null,
    failed.length ? `${failed.length} couldn't be added (${failed.map((f) => `${f.name}: ${f.reason}`).join(' ')})` : null,
  ].filter(Boolean);
  return `${parts.join(', ')}.`;
}

function JoinCodeEnrollmentRow({ enrollment: e, last, checked, onToggle }: { enrollment: Enrollment; last: boolean; checked: boolean; onToggle: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${e.name}, ${e.batch?.name ?? 'no batch'}, asked ${timeAgo(e.createdAt)}`}
      onPress={onToggle}
      style={[styles.row, styles.rowPad, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}
    >
      <Avatar name={e.name} />
      <View style={styles.flex}>
        <Text style={[styles.name, { color: palette.foreground }]} numberOfLines={1}>
          {e.name}
        </Text>
        <View style={styles.badges}>
          {e.batch ? <Badge label={e.batch.name} tone="violet" /> : null}
          {e.batch?.program ? <Badge label={PROGRAM_LABELS[e.batch.program]} /> : null}
          <Text style={[styles.meta, { color: palette.mutedForeground }]}>{timeAgo(e.createdAt)}</Text>
        </View>
      </View>
      <Icon
        name={checked ? { ios: 'checkmark.circle.fill', android: 'check_circle' } : { ios: 'circle', android: 'radio_button_unchecked' }}
        color={checked ? palette.primary : palette.mutedForeground}
        size={24}
      />
    </Pressable>
  );
}

function AdminEnrollmentRow({ enrollment: e, batches, last, onDone }: {
  enrollment: Enrollment; batches: Batch[]; last: boolean;
  onDone: (message: string, tone?: 'danger') => void;
}) {
  const palette = usePalette();
  const [busy, setBusy] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(e.batch?.id ?? '');
  const needsBatch = !e.batch;
  const requestType: string = e.batch ? 'Enrollment Approval' : 'Batch Assignment';

  const batchOptions: PickerOption[] = [
    ...batches.map((b) => ({ value: b.id, label: b.name })),
  ];

  const approve = async () => {
    const batchId = needsBatch ? selectedBatch : e.batch?.id;
    if (needsBatch && !batchId) return onDone('Select a batch first.', 'danger');
    setBusy(true);
    try {
      const result = await enrollmentsApi.decide([e.id], 'approve', needsBatch ? batchId : undefined);
      onDone(summary(result), result.failed.length ? 'danger' : undefined);
    } catch (err) {
      onDone(err instanceof Error ? err.message : "Couldn't save.", 'danger');
    } finally {
      setBusy(false);
    }
  };

  const reject = () =>
    confirmAction(
      `Reject ${e.name}'s enrollment?`,
      needsBatch ? 'The student account stays, but the pending assignment is removed.' : 'The student account stays, but they will not be enrolled.',
      needsBatch ? 'Dismiss' : 'Reject',
      async () => {
        setBusy(true);
        try {
          const result = await enrollmentsApi.decide([e.id], 'reject');
          onDone(summary(result));
        } catch (err) {
          onDone(err instanceof Error ? err.message : "Couldn't save.", 'danger');
        } finally {
          setBusy(false);
        }
      }
    );

  return (
    <View style={[styles.adminRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}>
      <View style={styles.row}>
        <Avatar name={e.name} />
        <View style={styles.flex}>
          <Text style={[styles.name, { color: palette.foreground }]} numberOfLines={1}>{e.name}</Text>
          {e.email ? <Text style={[styles.meta, { color: palette.mutedForeground }]} numberOfLines={1}>{e.email}</Text> : null}
          <View style={styles.badges}>
            <Badge label={requestType} tone={needsBatch ? 'warning' : 'violet'} />
            {e.batch ? <Badge label={e.batch.name} tone="violet" /> : null}
            <Text style={[styles.meta, { color: palette.mutedForeground }]}>{timeAgo(e.createdAt)}</Text>
          </View>
        </View>
      </View>
      {needsBatch ? (
        <OptionPicker
          label="Select batch"
          options={batchOptions}
          selected={selectedBatch}
          onChange={setSelectedBatch}
          chipsUpTo={0}
          searchPlaceholder="Search batches"
        />
      ) : null}
      <View style={styles.row}>
        <Button label={needsBatch ? 'Dismiss' : 'Reject'} variant="secondary" onPress={reject} disabled={busy} style={styles.flex} />
        <Button label={needsBatch ? 'Approve & Enroll' : 'Approve'} onPress={approve} loading={busy} disabled={busy} style={styles.flex} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowPad: { padding: 12 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12 },
  link: { fontSize: 15, fontWeight: '700' },
  adminRow: { padding: 12, gap: 10 },
});
