// The keys screens share loads under (see load-cache.ts). Screens that ask for
// the same thing use the same key, so they make one request between them.
//
// The cache already empties on every login, workspace switch and data change;
// each key also names the user, institute and workspace it was loaded for, so
// one account's answers can never be read in another's place.

export interface CacheOwner {
  id: string;
  /** The workspace in use (the signed-in user's role). */
  role: string | null;
  tuition: { id: string };
}

export function cacheKeys(owner: CacheOwner) {
  const scope = `${owner.role ?? 'none'}@${owner.tuition.id}/${owner.id}`;
  return {
    /** /teacher/overview: Home, Batches, Tests, Profile and Manage Test all read it. */
    teacherOverview: `${scope}:teacher-overview`,
    /** The tests list, all or one batch's. */
    tests: (batchId?: string) => `${scope}:tests:${batchId ?? 'all'}`,
    /** A batch's details and recent syllabus progress. */
    batch: (batchId: string) => `${scope}:batch:${batchId}`,
    /** The batches a test can be set for. */
    testBatches: `${scope}:test-batches`,
    /** Chapters, topics and counts for one question-bank scope (bankKey). */
    bankOptions: (bankKey: string) => `${scope}:bank-options:${bankKey}`,
    announcements: (limit: number) => `${scope}:announcements:${limit}`,
  };
}

export type CacheKeys = ReturnType<typeof cacheKeys>;
