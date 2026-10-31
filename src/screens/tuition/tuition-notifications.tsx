import React, { useEffect } from 'react';
import { Card, DetailSheet, EmptyView, ErrorView, LoadingView, SectionTitle, useLoad } from '@/components/kit';
import { useDataVersion } from '@/context/data-version';
import { RequestCard } from '@/screens/tuition/join-requests';
import { joinRequestsApi } from '@/services/tuition-api';

const CHECK_EVERY_MS = 30000;

/** Teachers waiting to join, kept fresh: on changes and every 30 seconds. */
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

/** The tuition's notifications: teachers asking to join with the teacher code, to approve or reject. */
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
  const list = data ?? [];

  return (
    <DetailSheet visible={visible} title="Notifications" onClose={onClose} onRefresh={refresh} refreshing={refreshing}>
      <SectionTitle title={`Pending Teachers (${list.length})`} />
      {loading ? (
        <LoadingView label="Checking for requests…" />
      ) : error && !data ? (
        <ErrorView message={`Couldn't load the requests: ${error}`} onRetry={reload} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyView
            icon={{ ios: 'bell', android: 'notifications' }}
            title="No one is waiting"
            text="When a teacher asks to join with your teacher code, they show up here. Student requests are under People › Students."
          />
        </Card>
      ) : (
        list.map((r) => <RequestCard key={r.id} request={r} onDone={reload} />)
      )}
    </DetailSheet>
  );
}
