import { api } from '@/services/api-client';
import { engagementStore, type EngagementField, type MeResponse } from '@/engagement/engagement-store';

// The student's progress from papers (GET /api/engagement/me). Students only;
// the server answers { enabled: false } when the tuition has it switched off.

export type { EngagementField, MeResponse, MeSnapshot } from '@/engagement/engagement-store';

export const engagementApi = {
  me: () => api<MeResponse>('/engagement/me'),
};

/**
 * Passes a learning response's `engagement` field to the store, then returns the
 * response unchanged. Never throws: progress must never break answering or submitting.
 */
export function withEngagement<T extends { engagement?: EngagementField | null }>(request: Promise<T>): Promise<T> {
  const owner = engagementStore.get().owner;
  return request.then((res) => {
    try {
      engagementStore.publish(res?.engagement, owner);
    } catch {
      // Progress is a bonus; the response still goes through.
    }
    return res;
  });
}
