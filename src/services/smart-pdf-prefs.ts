import { loadPreference, savePreference } from '@/services/preferences';
import {
  DEFAULT_SMART_SLIDE_SETTINGS,
  normalizeSlideSettings,
  slidePrefsKey,
  type SmartSlideSettings,
} from '@/shared/smart-slide-layout';

// A teacher's Smart PDF layout, kept on this phone per signed-in account.
// Only the layout is kept: never questions, titles or topics, which always
// come from the paper being made.

/** The teacher's saved layout, or the default with `saved: false` the first time. */
export async function loadSmartSlideSettings(userId: string): Promise<{ settings: SmartSlideSettings; saved: boolean }> {
  const raw = await loadPreference(slidePrefsKey(userId));
  if (!raw) return { settings: DEFAULT_SMART_SLIDE_SETTINGS, saved: false };
  try {
    return { settings: normalizeSlideSettings(JSON.parse(raw)), saved: true };
  } catch {
    return { settings: DEFAULT_SMART_SLIDE_SETTINGS, saved: false };
  }
}

export function saveSmartSlideSettings(userId: string, settings: SmartSlideSettings): Promise<void> {
  return savePreference(slidePrefsKey(userId), JSON.stringify(normalizeSlideSettings(settings)));
}
