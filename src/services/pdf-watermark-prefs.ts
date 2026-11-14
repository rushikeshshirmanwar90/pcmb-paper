import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadPreference } from '@/services/preferences';
import { cleanWatermark, watermarkPrefsKey } from '@/shared/watermark';

// A teacher's PDF watermark, kept on this phone in AsyncStorage per signed-in
// account, so the next paper starts with what they typed last. Only the text
// is kept, never anything of a paper.

/** The saved watermark; null until the teacher has ever set one ("" once they chose none). */
export async function loadPdfWatermark(userId: string): Promise<string | null> {
  const key = watermarkPrefsKey(userId);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw !== null) return cleanWatermark(raw);
  } catch {
    // Unreadable storage: fall through to the older copy, or none.
  }
  // Watermarks saved before the move to AsyncStorage lived in the settings store; carry one over once.
  const older = await loadPreference(key);
  if (older === null) return null;
  await savePdfWatermark(userId, older);
  return cleanWatermark(older);
}

export async function savePdfWatermark(userId: string, watermark: string): Promise<void> {
  try {
    await AsyncStorage.setItem(watermarkPrefsKey(userId), cleanWatermark(watermark));
  } catch {
    // Not kept: the next paper starts without it.
  }
}
