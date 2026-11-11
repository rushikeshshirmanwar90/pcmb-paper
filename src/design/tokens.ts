// The student look (neobrutalism, "lavender" preset): colours, borders, hard
// shadows, radii and the type scale. Plain TypeScript with no React Native
// imports, so the contrast rules are unit-tested (tests/neo-tokens.test.mjs).
// Only the student scope uses these; teacher and tuition keep the classic theme.

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

/** Lavender: playful and studious, made for students. Checked against WCAG AA. */
export const lavender: NeoColors = {
  canvas: '#EEE8FF', surface: '#FFFFFF', subtle: '#E2DAF7', zebra: '#F6F3FF',
  ink: '#1A1A1A', inkSoft: '#4D4766', onAccent: '#1A1A1A', onInk: '#FFFFFF',
  primary: '#A98BFA', primarySoft: '#ECE5FE',
  success: '#7EDC9A', successSoft: '#E3F7E9',
  danger: '#FF8FB8', dangerSoft: '#FFE6EF', dangerInk: '#B0124A',
  warning: '#FFB65C', warningSoft: '#FFEFDB',
  violet: '#A98BFA', violetSoft: '#ECE5FE',
  info: '#8FD3FF', infoSoft: '#E6F5FF',
  highlight: '#D7F25A',
  doodle: '#A98BFA',
  tabBar: '#1A1A1A',
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

export const neoColors = (dark: boolean): NeoColors => (dark ? DARK : lavender);
const DARK = darkFrom(lavender);

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
  radius: { xs: 6, sm: 10, md: 12, lg: 18, xl: 28, button: 12, full: 999 },
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

/**
 * Lexend for everything people read (made for reading ease; open, wide letters
 * that stay clear at 13px on small Android screens). Unbounded, a wide display
 * face, only for screen titles of 24px and up. Weight always comes from the
 * family name: Android ignores fontWeight on custom fonts.
 */
export const font = {
  display: 'Unbounded_700Bold',
  regular: 'Lexend_400Regular',
  medium: 'Lexend_500Medium',
  semibold: 'Lexend_600SemiBold',
  bold: 'Lexend_700Bold',
} as const;

/** Six steps people see on a card: at most three of them in any one card. */
export const textStyles = {
  display: { fontFamily: font.display, fontSize: 30, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: font.display, fontSize: 24, lineHeight: 31, letterSpacing: -0.4 },
  heading: { fontFamily: font.semibold, fontSize: 19, lineHeight: 26, letterSpacing: -0.2 },
  subheading: { fontFamily: font.medium, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  bodySm: { fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: font.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  overline: { fontFamily: font.medium, fontSize: 12, lineHeight: 18, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  number: { fontFamily: font.bold, fontSize: 24, lineHeight: 30, fontVariant: ['tabular-nums' as const] },
} as const;

export type TextVariant = keyof typeof textStyles;

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
