import { useFonts } from 'expo-font';
import { APP_FONT_FILES } from '@/design/app-font';

/**
 * Loads the student look's font (design/app-font.ts) at startup. Bundled
 * files, so it's quick and needs no network. True once loaded or failed:
 * text falls back to the system font rather than waiting forever.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(APP_FONT_FILES);
  return loaded || !!error;
}
