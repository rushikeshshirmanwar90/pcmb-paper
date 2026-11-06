import { loadPreference, savePreference } from '@/services/preferences';
import { cleanWatermark, watermarkPrefsKey } from '@/shared/watermark';

// A teacher's PDF watermark, kept on this phone per signed-in account so the
// next paper starts with it. Only the text is kept, never anything of a paper.

/** The saved watermark; null until the teacher has ever set one ("" once they chose none). */
export async function loadPdfWatermark(userId: string): Promise<string | null> {
  const raw = await loadPreference(watermarkPrefsKey(userId));
  return raw === null ? null : cleanWatermark(raw);
}

export function savePdfWatermark(userId: string, watermark: string): Promise<void> {
  return savePreference(watermarkPrefsKey(userId), cleanWatermark(watermark));
}
