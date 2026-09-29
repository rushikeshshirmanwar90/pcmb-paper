/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

const lightPalette = {
  primary: '#C6613F',
  primaryHover: '#AC5032',
  primarySoft: '#F6E8E1',
  primaryBorder: '#E7C1B1',
  primaryInk: '#71351F',
  onPrimary: '#FFFFFF',
  tabSelected: '#C6613F',
  brand: '#E8A55A',
  secondary: '#EFE9DE',
  background: '#FAF9F5',
  card: '#FFFFFF',
  cardForeground: '#282622',
  popover: '#FFFFFF',
  navy: '#181715',
  navy2: '#252320',
  sidebar: '#F4F0E8',
  sidebarForeground: '#36332E',
  sidebarHover: '#E9E2D7',
  sidebarActive: '#E9D6C9',
  sidebarBorder: '#DED6CA',
  foreground: '#282622',
  mutedForeground: '#77736B',
  muted: '#F0EEE9',
  border: '#E5E0D7',
  borderStrong: '#CFC8BC',
  input: '#D8D1C6',
  success: '#36745B',
  successSoft: '#E6F1EB',
  successBorder: '#B9D7C5',
  successInk: '#24563F',
  warning: '#B7792E',
  warningSoft: '#F8EFDF',
  warningBorder: '#E9D3AC',
  warningInk: '#7A4D19',
  danger: '#B84E45',
  dangerSoft: '#F7E7E3',
  dangerBorder: '#E6BDB5',
  dangerInk: '#79332D',
  violet: '#78678E',
  violetSoft: '#EEEAF2',
  violetBorder: '#D5CADF',
  white: '#FFFFFF',
  ink: '#282622',
  inkSoft: '#504B44',
  mutedText: '#77736B',
  line: '#E5E0D7',
  canvas: '#FAF9F5',
  surface: '#FFFFFF',
  subtle: '#F0EEE9',
} as const;

const darkPalette = {
  primary: '#D97757',
  primaryHover: '#E48C6D',
  primarySoft: '#4A3028',
  primaryBorder: '#754939',
  primaryInk: '#F0B39A',
  onPrimary: '#262624',
  tabSelected: '#FFFFFF',
  brand: '#D89A54',
  secondary: '#3A3936',
  background: '#262624',
  card: '#302F2C',
  cardForeground: '#F2EFE9',
  popover: '#34332F',
  navy: '#181715',
  navy2: '#252320',
  sidebar: '#2D2C29',
  sidebarForeground: '#E7E2D9',
  sidebarHover: '#3B3934',
  sidebarActive: '#4A3730',
  sidebarBorder: '#45423C',
  foreground: '#F2EFE9',
  mutedForeground: '#AAA49A',
  muted: '#3A3936',
  border: '#45423C',
  borderStrong: '#5C574F',
  input: '#575249',
  success: '#65A884',
  successSoft: '#263B31',
  successBorder: '#3C634E',
  successInk: '#A5D3B7',
  warning: '#D5A254',
  warningSoft: '#413625',
  warningBorder: '#6F5935',
  warningInk: '#E9C68F',
  danger: '#D4776E',
  dangerSoft: '#432B29',
  dangerBorder: '#71413B',
  dangerInk: '#E8AAA3',
  violet: '#B19CC6',
  violetSoft: '#3A3340',
  violetBorder: '#5B4D66',
  white: '#262624',
  ink: '#F2EFE9',
  inkSoft: '#D5CFC4',
  mutedText: '#AAA49A',
  line: '#45423C',
  canvas: '#262624',
  surface: '#302F2C',
  subtle: '#3A3936',
} as const;

export type PaletteTokens = { [Token in keyof typeof lightPalette]: string };
export const Palette: PaletteTokens = lightPalette;
export const getPalette = (dark: boolean): PaletteTokens => dark ? darkPalette : lightPalette;

export const Colors = {
  light: {
    text: lightPalette.foreground,
    background: lightPalette.background,
    backgroundElement: lightPalette.card,
    backgroundSelected: lightPalette.secondary,
    textSecondary: lightPalette.mutedForeground,
  },
  dark: {
    text: darkPalette.foreground,
    background: darkPalette.background,
    backgroundElement: darkPalette.card,
    backgroundSelected: darkPalette.secondary,
    textSecondary: darkPalette.mutedForeground,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
