import React, { useEffect } from 'react';
import { useLoad } from '@/components/kit';
import { useDataVersion } from '@/context/data-version';
import { joinRequestsApi } from '@/services/tuition-api';

const CHECK_EVERY_MS = 30000;

/** Teachers waiting to join, kept fresh: on changes and every 30 seconds (the bell, Home and the Join requests inbox). */
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
