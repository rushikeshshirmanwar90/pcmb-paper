import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, DetailRow, ErrorText, Muted, Notice, SectionTitle } from '@/components/kit';
import { dateTimeLabel, type TestAccess, type TestSummary } from '@/services/school-api';
import { studentApi } from '@/services/student-api';
import { testAccessLabel } from './test-format';

/** Shared by the visible restricted-test row and its detail view. Never starts an attempt. */
type RequestAccessProps = { testId: string; access: TestAccess; onRefresh: () => void };
export function RequestTestAccessButton(props: RequestAccessProps) {
  return <RequestAccess key={`${props.testId}:${props.access.request}:${props.access.canRequest}`} {...props} />;
}

function RequestAccess({ testId, access, onRefresh }: RequestAccessProps) {
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const pending = requested || access.request === 'pending';
  const request = async () => {
    if (inFlight.current || pending || !access.canRequest) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      await studentApi.requestTestAccess(testId);
      setRequested(true);
      onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not request access. Try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  if (access.allowed) return null;
  return <>
    <ErrorText message={error} />
    {pending ? <Muted>Request sent. Waiting for your teacher to approve access.</Muted> : null}
    {pending || access.canRequest ? <Button label={pending ? 'Request pending' : 'Request access'} variant="secondary" disabled={busy || pending} loading={busy} onPress={() => void request()} /> : null}
  </>;
}

export function RestrictedTest({ test, access, onClose, onRefresh }: { test: TestSummary; access: TestAccess; onClose: () => void; onRefresh: () => void }) {
  return <ScrollView contentContainerStyle={styles.content}>
    <SectionTitle title={test.title} />
    <Notice title={testAccessLabel(access)} text={access.request === 'declined' ? 'Your teacher did not allow your request. You cannot take this test unless access is granted. You can request again while the test is open.' : 'You are not allowed to take this test. Request access from your teacher. You can start only after your teacher approves.'} />
    <Card>
      <DetailRow label="Subject" value={test.subject || 'Mixed'} />
      <DetailRow label="Batches" value={(test.batches ?? [test.batch]).map(batch => batch.name).join(', ')} />
      <DetailRow label="Teacher" value={test.teacher.name} />
      <DetailRow label="Opens" value={dateTimeLabel(test.opensAt)} />
      <DetailRow label="Closes" value={dateTimeLabel(test.closesAt)} />
      <DetailRow label="Duration" value={`${test.durationMinutes} min`} />
    </Card>
    <RequestTestAccessButton testId={test.id} access={access} onRefresh={onRefresh} />
    {!access.canRequest && access.request !== 'pending' ? <Muted>Access requests are unavailable for this test. Contact your teacher.</Muted> : null}
    <Button label="Refresh access" variant="secondary" onPress={onRefresh} />
    <Button label="Close" variant="secondary" onPress={onClose} />
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { padding: 16, gap: 14 } });
