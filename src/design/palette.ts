import { getPalette, type PaletteTokens } from '@/constants/theme';
import { neoColors, toAppPalette, type NeoColors } from '@/design/tokens';

/** The student look in the app's own palette names, plus the preset's extras (highlight, onAccent…). */
export type NeoPalette = PaletteTokens & NeoColors;

const cache: Partial<Record<'light' | 'dark', NeoPalette>> = {};

export function neoAppPalette(dark: boolean): NeoPalette {
  const key = dark ? 'dark' : 'light';
  return (cache[key] ??= toAppPalette(getPalette(dark), neoColors(dark)));
}
