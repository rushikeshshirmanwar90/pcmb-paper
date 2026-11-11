import { useFonts } from 'expo-font';
import { Chivo_400Regular } from '@expo-google-fonts/chivo/400Regular';
import { Chivo_500Medium } from '@expo-google-fonts/chivo/500Medium';
import { Chivo_600SemiBold } from '@expo-google-fonts/chivo/600SemiBold';
import { Chivo_700Bold } from '@expo-google-fonts/chivo/700Bold';
import { Chivo_800ExtraBold } from '@expo-google-fonts/chivo/800ExtraBold';
import { SpaceGrotesk_400Regular } from '@expo-google-fonts/space-grotesk/400Regular';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';

/**
 * The student look's fonts, loaded at runtime (no app build needed for them).
 * Both candidates load while the style preview compares them; once one is
 * chosen the other is dropped. True once loaded or failed: text falls back to
 * the system font rather than waiting forever.
 */
export function useNeoFonts(): boolean {
  const [loaded, error] = useFonts({
    Chivo_400Regular,
    Chivo_500Medium,
    Chivo_600SemiBold,
    Chivo_700Bold,
    Chivo_800ExtraBold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  return loaded || !!error;
}
