import type { Href } from 'expo-router';

export type BatchPage = 'students' | 'teachers' | 'assign-teacher' | 'schedule' | 'invitations' | 'schedule/new' | `schedule/${string}` | 'settings';

/** The route of a batch (by its id) or of one of its management screens. */
export const batchHref = (batchId: string, page?: BatchPage, query?: Record<string, string>): Href => {
  const search = query ? `?${new URLSearchParams(query).toString()}` : '';
  return `/batch/${batchId}${page ? `/${page}` : ''}${search}` as Href;
};
