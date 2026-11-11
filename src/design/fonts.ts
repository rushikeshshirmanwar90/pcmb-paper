import { useFonts } from 'expo-font';
import { Lexend_400Regular } from '@expo-google-fonts/lexend/400Regular';
import { Lexend_500Medium } from '@expo-google-fonts/lexend/500Medium';
import { Lexend_600SemiBold } from '@expo-google-fonts/lexend/600SemiBold';
import { Lexend_700Bold } from '@expo-google-fonts/lexend/700Bold';
import { Unbounded_700Bold } from '@expo-google-fonts/unbounded/700Bold';

/**
 * The student look's fonts, loaded at runtime (no new app build needed for
 * them). Only the five faces used are bundled. True once loaded or failed:
 * text falls back to the system font rather than waiting forever.
 */
export function useNeoFonts(): boolean {
  const [loaded, error] = useFonts({ Lexend_400Regular, Lexend_500Medium, Lexend_600SemiBold, Lexend_700Bold, Unbounded_700Bold });
  return loaded || !!error;
}
