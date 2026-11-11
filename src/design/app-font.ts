import { Chivo_400Regular } from '@expo-google-fonts/chivo/400Regular';
import { Chivo_500Medium } from '@expo-google-fonts/chivo/500Medium';
import { Chivo_600SemiBold } from '@expo-google-fonts/chivo/600SemiBold';
import { Chivo_700Bold } from '@expo-google-fonts/chivo/700Bold';
import { Chivo_800ExtraBold } from '@expo-google-fonts/chivo/800ExtraBold';
import type { FontOption } from '@/design/tokens';

// THE ONE PLACE to change the student look's font. To swap it: change
// APP_FONT to another key of FONT_OPTIONS (tokens.ts) and import that
// family's five faces below instead (the dev style preview compares them all).
// Only these five files ship in the app.

export const APP_FONT: FontOption = 'chivo';

export const APP_FONT_FILES = { Chivo_400Regular, Chivo_500Medium, Chivo_600SemiBold, Chivo_700Bold, Chivo_800ExtraBold };
