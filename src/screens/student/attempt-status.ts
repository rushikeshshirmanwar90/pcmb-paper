import type { Attempt } from '../../services/student-api';

/** Status refreshes change timing/state only. They cannot replace the local
 * answer queue, navigation or review marks, or switch to another attempt. */
export function acceptsAttemptStatus(previous: Attempt, next: Attempt): boolean {
  if (previous.startedAt !== next.startedAt || (previous.id && next.id && previous.id !== next.id)) return false;
  if (previous.state === 'submitted' && next.state !== 'submitted') return false;
  return (next.revision ?? 0) >= (previous.revision ?? 0) &&
    (next.resumeVersion ?? 0) >= (previous.resumeVersion ?? 0);
}
