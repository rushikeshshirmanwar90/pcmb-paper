import { loadPreference, savePreference } from '@/services/preferences';
import { DEFAULT_PAPER_STYLE, normalizePaperStyle, paperStylePrefsKey, type PaperStyle } from '@/shared/paper-style';

// A teacher's Exam PDF style (font, text size, columns, spacing, logo and
// watermark strength), kept on this phone per signed-in account so the next
// paper starts with it. Only the style is kept, never anything of a paper.

/** The teacher's saved style, or the default with `saved: false` the first time. */
export async function loadPaperStyle(userId: string): Promise<{ style: PaperStyle; saved: boolean }> {
  const raw = await loadPreference(paperStylePrefsKey(userId));
  if (!raw) return { style: DEFAULT_PAPER_STYLE, saved: false };
  try {
    return { style: normalizePaperStyle(JSON.parse(raw)), saved: true };
  } catch {
    return { style: DEFAULT_PAPER_STYLE, saved: false };
  }
}

export function savePaperStyle(userId: string, style: PaperStyle): Promise<void> {
  return savePreference(paperStylePrefsKey(userId), JSON.stringify(normalizePaperStyle(style)));
}
