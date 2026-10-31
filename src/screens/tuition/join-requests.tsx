import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { confirmAction } from '@/components/account-section';
import { Badge, Button, Card, ErrorText, Icon, Muted, SectionTitle, useLoad, usePalette } from '@/components/kit';
import { bumpDataVersion, useDataVersion } from '@/context/data-version';
import { joinRequestsApi, timeAgo, type JoinRequest } from '@/services/tuition-api';

/** "Maths" fits a badge better than "Mathematics". */
const SHORT_SUBJECT: Record<string, string> = { Mathematics: 'Maths' };

/**
 * People › Teachers › Pending Teachers: those who asked to join with the
 * institute's teacher code, to approve or reject. Approving makes them a
 * teacher; batches are assigned afterwards, as for any teacher.
 */
export function PendingTeachers({ onDone }: { onDone?: (message: string, tone?: 'danger') => void }) {
  const version = useDataVersion();
  const { data, error, reload } = useLoad(() => joinRequestsApi.pending(), [version]);
  const requests = data ?? [];
  if (!requests.length && !error) return null;
  return (
    <>
      <SectionTitle title={`Pending Teachers (${requests.length})`} />
      <ErrorText message={error} />
      {requests.map((r) => (
        <RequestCard key={r.id} request={r} onDone={reload} onMessage={onDone} />
      ))}
    </>
  );
}

/** A teacher's request: name, verified email, the subjects they chose and when they asked. */
export function RequestCard({ request, onDone, onMessage }: { request: JoinRequest; onDone: () => void; onMessage?: (message: string, tone?: 'danger') => void }) {
  const palette = usePalette();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = async (action: 'approve' | 'reject') => {
    setBusy(true);
    setError(null);
    try {
      await (action === 'approve' ? joinRequestsApi.approve(request.id) : joinRequestsApi.reject(request.id));
      bumpDataVersion();
      onMessage?.(action === 'approve' ? `${request.person.name} approved. Assign them to batches from their details.` : `${request.person.name} rejected.`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Couldn't ${action} them.`);
      setBusy(false);
    }
  };

  const reject = () =>
    confirmAction(`Reject ${request.person.name}?`, 'They can ask again with your teacher code, or join another tuition.', 'Reject', () => decide('reject'));

  return (
    <Card>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: palette.warningSoft }]}>
          <Icon name={{ ios: 'person.crop.circle.badge.questionmark', android: 'person_add' }} color={palette.warning} size={20} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.name, { color: palette.foreground }]}>{request.person.name}</Text>
          <Text style={[styles.meta, { color: palette.mutedForeground }]}>
            {request.person.email}
            {request.person.emailVerified ? ' · Verified' : ''}
          </Text>
          <Text style={[styles.meta, { color: palette.mutedForeground }]}>
            Requested {new Date(request.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} ({timeAgo(request.createdAt)})
          </Text>
        </View>
      </View>
      <View style={styles.badges}>
        {request.subjects.map((s) => (
          <Badge key={s} label={SHORT_SUBJECT[s] ?? s} tone="violet" />
        ))}
      </View>
      <ErrorText message={error} />
      <View style={styles.row}>
        <Button label="Approve" icon={{ ios: 'checkmark', android: 'check' }} onPress={() => void decide('approve')} loading={busy} style={styles.flex} />
        <Button label="Reject" variant="secondary" onPress={reject} disabled={busy} style={styles.flex} />
      </View>
      <Muted>Approving doesn&apos;t assign any batch.</Muted>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 10 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, lineHeight: 19 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
});
