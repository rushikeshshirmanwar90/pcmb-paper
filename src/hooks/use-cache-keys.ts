import { useMemo } from 'react';
import { useSignedInUser } from '@/context/auth-context';
import { cacheKeys } from '@/services/cache-keys';

/** Load-cache keys for the signed-in user in the workspace in use. */
export function useCacheKeys() {
  const { id, role, tuition } = useSignedInUser();
  const tuitionId = tuition.id;
  return useMemo(() => cacheKeys({ id, role, tuition: { id: tuitionId } }), [id, role, tuitionId]);
}
