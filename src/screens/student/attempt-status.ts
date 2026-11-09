import type { Attempt } from '../../services/student-api';

/** Reject responses from another attempt or older control generations.
 * Answer reconciliation separately preserves edits based on current versions. */
export function acceptsAttemptStatus(previous: Attempt, next: Attempt): boolean {
  if (previous.startedAt !== next.startedAt || (previous.id && next.id && previous.id !== next.id)) return false;
  if (previous.state === 'submitted' && next.state !== 'submitted') return false;
  return (next.revision ?? 0) >= (previous.revision ?? 0) &&
    (next.resumeVersion ?? 0) >= (previous.resumeVersion ?? 0);
}
