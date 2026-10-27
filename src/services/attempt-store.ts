import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { decodeDraft, draftKey, encodeDraft, isEmptyDraft, type AttemptDraft } from '@/screens/student/attempt-draft';

// Keeps a test attempt's draft (review marks, unconfirmed answers) between app
// launches: one small JSON file per user and test in the app's own documents
// folder (as My PDFs does), or local storage on the web. A file, not the
// secure store: drafts of long tests can pass the secure store's ~2 KB limit,
// and they hold nothing secret. Scoped to the signed-in user and the test, and
// checked against the attempt's start time when read.

const draftsDir = () => new Directory(Paths.document, 'attempt-drafts');
const draftFile = (key: string) => new File(draftsDir(), `${key}.json`);

// Writes to one draft happen in order, so an older write never lands last.
const queues = new Map<string, Promise<void>>();

function enqueue(key: string, write: () => Promise<void> | void): Promise<void> {
  const next = (queues.get(key) ?? Promise.resolve()).then(write, write).catch(() => {});
  queues.set(key, next);
  return next;
}

function read(key: string): string | null {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
  const file = draftFile(key);
  return file.exists ? file.textSync() : null;
}

function write(key: string, value: string | null) {
  if (Platform.OS === 'web') {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
    return;
  }
  const file = draftFile(key);
  if (value === null) {
    if (file.exists) file.delete();
    return;
  }
  const dir = draftsDir();
  if (!dir.exists) dir.create({ intermediates: true });
  file.create({ overwrite: true });
  file.write(value);
}

/** The draft of this attempt, if the phone has one. */
export async function loadDraft(userId: string, testId: string, startedAt: string): Promise<AttemptDraft | null> {
  const key = draftKey(userId, testId);
  try {
    await queues.get(key);
    return decodeDraft(read(key), startedAt);
  } catch {
    return null;
  }
}

/** Saves the draft; an empty one is removed instead. Resolves false if the phone couldn't store it. */
export function saveDraft(userId: string, testId: string, draft: AttemptDraft): Promise<boolean> {
  const key = draftKey(userId, testId);
  let ok = true;
  return enqueue(key, () => {
    try {
      write(key, isEmptyDraft(draft) ? null : encodeDraft(draft));
    } catch {
      ok = false;
    }
  }).then(() => ok);
}

/** Forgets the draft, e.g. once the test is submitted. */
export function clearDraft(userId: string, testId: string): Promise<void> {
  const key = draftKey(userId, testId);
  return enqueue(key, () => write(key, null));
}
