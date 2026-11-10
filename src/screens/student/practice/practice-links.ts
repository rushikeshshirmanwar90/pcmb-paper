import { loadPreference, savePreference } from '@/services/preferences';
import { isLastPractised, type LastPractised } from '@/screens/student/practice/practice-place';

export * from '@/screens/student/practice/practice-place';

// ─── The last place practised (for "Continue") ─────────────────────────────

const lastKey = (userId: string) => `practice.last.${userId}`;

/** Remembered on this phone per student, so Continue works after the app restarts. */
export async function loadLastPractised(userId: string): Promise<LastPractised | null> {
  const raw = await loadPreference(lastKey(userId));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isLastPractised(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLastPractised(userId: string, last: LastPractised) {
  return savePreference(lastKey(userId), JSON.stringify(last));
}
