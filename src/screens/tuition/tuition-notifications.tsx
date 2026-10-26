import React, { useEffect, useState } from 'react';
import { Card, DetailSheet, EmptyView, ErrorView, LoadingView, SectionTitle, useLoad } from '@/components/kit';
import { useDataVersion } from '@/context/data-version';
import { AcceptSheet, JoinCodeCard, RequestCard } from '@/screens/tuition/join-requests';
import { joinRequestsApi, type JoinRequest } from '@/services/tuition-api';

const CHECK_EVERY_MS = 30000;

/** People waiting to join, kept fresh: on changes and every 30 seconds. */
export function useJoinRequests() {
  const version = useDataVersion();
  const result = useLoad(() => joinRequestsApi.pending(), [version]);
  const { reload } = result;
  useEffect(() => {
    const timer = setInterval(reload, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [reload]);
  return result;
}

/**
 * The tuition's notifications: people asking to join (accept each as a
 * student or teacher, or reject), and the join code they ask with.
 */
export function TuitionNotificationsSheet({
  visible,
  onClose,
  requests,
}: {
  visible: boolean;
  onClose: () => void;
  requests: ReturnType<typeof useJoinRequests>;
}) {
  const { data, error, loading, refreshing, refresh, reload } = requests;
  const [accepting, setAccepting] = useState<{ request: JoinRequest; as: 'student' | 'teacher' } | null>(null);
  const list = data ?? [];

  return (
    <DetailSheet visible={visible} title="Notifications" onClose={onClose} onRefresh={refresh} refreshing={refreshing}>
      <SectionTitle title={`Asking to join (${list.length})`} />
      {loading ? (
        <LoadingView label="Checking for requests…" />
      ) : error && !data ? (
        <ErrorView message={`Couldn't load the requests: ${error}`} onRetry={reload} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyView
            icon={{ ios: 'bell', android: 'notifications' }}
            title="No one is waiting"
            text="When a student or teacher asks to join with your code, they show up here. Accept them as a student or a teacher."
          />
        </Card>
      ) : (
        list.map((r) => <RequestCard key={r.id} request={r} onAccept={(as) => setAccepting({ request: r, as })} onDone={reload} />)
      )}

      <SectionTitle title="Your join code" />
      <JoinCodeCard waiting={list.length} />

      <AcceptSheet accepting={accepting} onClose={() => setAccepting(null)} />
    </DetailSheet>
  );
}
