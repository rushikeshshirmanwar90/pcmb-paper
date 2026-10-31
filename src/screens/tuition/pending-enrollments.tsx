import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import { Badge, Button, Card, ErrorText, Icon, Muted, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { PROGRAM_LABELS } from '@/constants/school';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { Avatar } from '@/screens/tuition/admin-ui';
import { enrollmentsApi, timeAgo, type Enrollment, type EnrollmentResult } from '@/services/tuition-api';

/**
 * People › Students › Pending Enrollments: students who entered a batch's
 * joining code and wait to be let in. Tick one, several or all, then approve
 * or reject them together. Shows nothing when none are waiting.
 */
export function PendingEnrollments({ onDone }: { onDone: (message: string, tone?: 'danger') => void }) {
  const palette = usePalette();
  const version = useDataVersion();
  const { data, error, reload } = useLoad(() => enrollmentsApi.pending(), [version]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const list = data ?? [];
  // Requests decided elsewhere drop out of the selection.
  const chosen = selected.filter((id) => list.some((e) => e.id === id));

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
  const all = chosen.length === list.length;
  const count = chosen.length ? ` (${chosen.length})` : '';

  return (
    <>
      <SectionTitle
        title={`Pending Enrollments (${list.length})`}
        action={
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setSelected(all ? [] : list.map((e) => e.id))}>
            <Text style={[styles.link, { color: palette.primary }]}>{all ? 'Clear' : 'Select all'}</Text>
          </Pressable>
        }
      />
      <ErrorText message={error ?? problem} />
      <Card style={styles.card}>
        {list.map((e, i) => (
          <EnrollmentRow key={e.id} enrollment={e} last={i === list.length - 1} checked={chosen.includes(e.id)} onToggle={() => toggle(e.id)} />
        ))}
      </Card>
      <View style={styles.row}>
        <Button label={`Reject${count}`} variant="secondary" disabled={!chosen.length || busy !== null} loading={busy === 'reject'} onPress={reject} style={styles.flex} />
        <Button label={`Approve${count}`} disabled={!chosen.length || busy !== null} loading={busy === 'approve'} onPress={() => decide('approve')} style={styles.flex} />
      </View>
      <Muted>Tick the students to decide. Approved students join their batch and get the app.</Muted>
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

function EnrollmentRow({ enrollment: e, last, checked, onToggle }: { enrollment: Enrollment; last: boolean; checked: boolean; onToggle: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${e.name}, ${e.batch.name}, asked ${timeAgo(e.createdAt)}`}
      onPress={onToggle}
      style={[styles.row, styles.rowPad, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]}
    >
      <Avatar name={e.name} />
      <View style={styles.flex}>
        <Text style={[styles.name, { color: palette.foreground }]} numberOfLines={1}>
          {e.name}
        </Text>
        <View style={styles.badges}>
          <Badge label={e.batch.name} tone="violet" />
          {e.batch.program ? <Badge label={PROGRAM_LABELS[e.batch.program]} /> : null}
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowPad: { padding: 12 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12 },
  link: { fontSize: 15, fontWeight: '700' },
});
