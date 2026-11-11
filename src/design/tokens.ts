// The student look (neobrutalism, "sunny" preset tuned to the warm-yellow
// reference): colours, borders, hard shadows, radii and the type scale. Plain
// TypeScript with no React Native imports, so the contrast rules are
// unit-tested (tests/neo-tokens.test.mjs). Only the student scope uses these;
// teacher and tuition keep the classic theme.

/** The preset's own colour names (components read these). */
export type NeoColors = {
  canvas: string; surface: string; subtle: string; zebra: string;
  ink: string; inkSoft: string; onAccent: string; onInk: string;
  primary: string; primarySoft: string;
  success: string; successSoft: string;
  danger: string; dangerSoft: string; dangerInk: string;
  warning: string; warningSoft: string;
  violet: string; violetSoft: string;
  info: string; infoSoft: string;
  highlight: string;
  doodle: string;
  tabBar: string;
};

/**
 * Sunny: cream page, white cards, warm yellow for the main button, the active
 * tab and the current item; pink, mint and lavender as sparing accents; near-
 * black ink for every text, border and shadow. "danger" is a soft pink, never
 * an alarm red. Checked against WCAG AA.
 */
export const sunny: NeoColors = {
  canvas: '#F8F5EE', surface: '#FFFFFF', subtle: '#ECE7DC', zebra: '#F6F2E9',
  ink: '#121212', inkSoft: '#4A463F', onAccent: '#121212', onInk: '#F8F5EE',
  primary: '#F7C744', primarySoft: '#FCEDBE',
  success: '#86DE98', successSoft: '#DDF5E2',
  danger: '#F49AD9', dangerSoft: '#FCE4F4', dangerInk: '#9B145E',
  warning: '#FFB866', warningSoft: '#FFEBD2',
  violet: '#BFA3FF', violetSoft: '#ECE4FF',
  info: '#8FD3FF', infoSoft: '#DDF1FF',
  highlight: '#F7C744',
  doodle: '#BFA3FF',
  tabBar: '#121212',
};

/** fg over bg at opacity a, as a solid hex. */
export const mix = (fg: string, bg: string, a: number) => {
  const f = [1, 3, 5].map((i) => parseInt(fg.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  return '#' + f.map((x, k) => Math.round(x * a + b[k] * (1 - a)).toString(16).padStart(2, '0')).join('').toUpperCase();
};

/** Dark mode, derived (not hand-picked): accents stay, surfaces go near-black, ink turns cream. */
export const darkFrom = (l: NeoColors): NeoColors => ({
  ...l,
  canvas: '#17161A', surface: '#24222A', subtle: '#2E2B35', zebra: '#1F1D24',
  ink: '#F6F1E7', inkSoft: '#C9C2B5', onInk: '#17161A', tabBar: '#F6F1E7',
  onAccent: '#1A1A1A',
  primarySoft: mix(l.primary, '#24222A', 0.22), successSoft: mix(l.success, '#24222A', 0.22),
  dangerSoft: mix(l.danger, '#24222A', 0.22), warningSoft: mix(l.warning, '#24222A', 0.22),
  violetSoft: mix(l.violet, '#24222A', 0.22), infoSoft: mix(l.info, '#24222A', 0.22),
  dangerInk: l.danger,
});

export const neoColors = (dark: boolean): NeoColors => (dark ? DARK : sunny);
const DARK = darkFrom(sunny);

/**
 * The app's classic palette keys, pointed at the student look by meaning, so
 * every existing `palette.border` or `palette.mutedForeground` keeps working in
 * student screens: every border/line is ink, text is ink or inkSoft, *Ink
 * text tokens are ink (accents are never text colours), error text is dangerInk.
 */
export function toAppPalette<P extends Record<string, string>>(classic: P, n: NeoColors): P & NeoColors {
  const mapped: Record<string, string> = {
    ...classic,
    primary: n.primary, primaryHover: n.primary, primarySoft: n.primarySoft, primaryBorder: n.ink, primaryInk: n.ink, onPrimary: n.onAccent,
    tabSelected: n.ink, brand: n.highlight, secondary: n.subtle,
    background: n.canvas, card: n.surface, cardForeground: n.ink, popover: n.surface,
    sidebar: n.surface, sidebarForeground: n.ink, sidebarHover: n.subtle, sidebarActive: n.highlight, sidebarBorder: n.ink,
    foreground: n.ink, mutedForeground: n.inkSoft, muted: n.subtle,
    border: n.ink, borderStrong: n.ink, input: n.ink, line: n.ink,
    success: n.success, successSoft: n.successSoft, successBorder: n.ink, successInk: n.ink,
    warning: n.warning, warningSoft: n.warningSoft, warningBorder: n.ink, warningInk: n.ink,
    danger: n.danger, dangerSoft: n.dangerSoft, dangerBorder: n.ink, dangerInk: n.dangerInk,
    violet: n.violet, violetSoft: n.violetSoft, violetBorder: n.ink,
    white: n.onAccent, ink: n.ink, inkSoft: n.inkSoft, mutedText: n.inkSoft,
    canvas: n.canvas, surface: n.surface, subtle: n.subtle,
  };
  return { ...mapped, ...n } as P & NeoColors;
}

// ─── Shape ─────────────────────────────────────────────────────────────────

export const Neo = {
  border: { width: 2, thin: 2 },
  radius: { xs: 6, sm: 10, md: 12, lg: 16, xl: 24, button: 12, full: 999 },
  /** Hard offsets, zero blur: small marks 2 · things you tap and cards 4 · overlays 6. */
  shadow: { sm: 2, md: 4, lg: 6 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 },
  screenPadding: 16,
  hit: 44,
} as const;

/** A hard, zero-blur shadow (needs the New Architecture, which SDK 58 always uses). */
export const hardShadow = (size: number, color: string) =>
  size === 0 ? { boxShadow: 'none' } : { boxShadow: `${size}px ${size}px 0px 0px ${color}` };

// ─── Type ──────────────────────────────────────────────────────────────────

/** One family for everything; weight always comes from the face name (Android ignores fontWeight on custom fonts). */
export type FontFaces = { regular: string; medium: string; semibold: string; bold: string; heavy: string };

/** The two candidates (both SIL Open Font License, free to bundle). */
export const FONT_OPTIONS = {
  /** Chivo: sturdy, slightly wide grotesk, closest to the reference; open letters at small sizes. */
  chivo: { regular: 'Chivo_400Regular', medium: 'Chivo_500Medium', semibold: 'Chivo_600SemiBold', bold: 'Chivo_700Bold', heavy: 'Chivo_800ExtraBold' },
  /** Space Grotesk: geometric with more character; a little narrower. */
  spaceGrotesk: { regular: 'SpaceGrotesk_400Regular', medium: 'SpaceGrotesk_500Medium', semibold: 'SpaceGrotesk_600SemiBold', bold: 'SpaceGrotesk_700Bold', heavy: 'SpaceGrotesk_700Bold' },
} as const satisfies Record<string, FontFaces>;

export type FontOption = keyof typeof FONT_OPTIONS;
export const DEFAULT_FONT: FontOption = 'chivo';

/** Bold headings, medium body, regular captions; big heavy numbers. At most three sizes on any one card. */
export function typeScale(f: FontFaces) {
  return {
    display: { fontFamily: f.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
    title: { fontFamily: f.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
    heading: { fontFamily: f.bold, fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
    subheading: { fontFamily: f.semibold, fontSize: 16, lineHeight: 22 },
    body: { fontFamily: f.medium, fontSize: 15, lineHeight: 22 },
    bodySm: { fontFamily: f.regular, fontSize: 14, lineHeight: 20 },
    label: { fontFamily: f.semibold, fontSize: 14, lineHeight: 20 },
    caption: { fontFamily: f.regular, fontSize: 13, lineHeight: 18 },
    overline: { fontFamily: f.semibold, fontSize: 12, lineHeight: 17, letterSpacing: 1.1, textTransform: 'uppercase' as const },
    number: { fontFamily: f.heavy, fontSize: 28, lineHeight: 34, letterSpacing: -0.5, fontVariant: ['tabular-nums' as const] },
    bigNumber: { fontFamily: f.heavy, fontSize: 40, lineHeight: 46, letterSpacing: -1, fontVariant: ['tabular-nums' as const] },
  } as const;
}

export type TextStyles = ReturnType<typeof typeScale>;
export type TextVariant = keyof TextStyles;

/** The scale with the chosen font (the default here; components use the scope's choice). */
export const textStyles: TextStyles = typeScale(FONT_OPTIONS[DEFAULT_FONT]);

// ─── Contrast (WCAG 2) ─────────────────────────────────────────────────────

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
export const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
