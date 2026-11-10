# Theme presets

Neobrutalism has one grammar (ink outlines, hard offset shadows, flat fills, chunky type) but many *dialects*. This file gives four original, contrast-checked dialects as drop-in TypeScript. They're **inspired by** the references the skill studied (a Figma neobrutalism UI library and three app screens), not copied from them. **Every component in `components.md` reads only from the active preset**, so switching dialect means changing one import.

| Preset | Inspired by | Feel | Best for |
|---|---|---|---|
| `studio` **(default)** | the Figma UI library's *system thinking*: calm Medium headings, a shadow scale tied to hierarchy, ruled sections | Calm and organised: warm paper, coral primary, 8px corners | Teacher/admin tools, dashboards, data-heavy apps |
| `sunny` | the wallet screens | Friendly and tactile: mustard CTA, white cards, bold headings | Consumer apps, wallets, utilities |
| `lavender` | the "Brain Orely" learning app | Playful and studious: lavender canvas, purple CTA, lime highlighter, wide display font | **Student / learning apps**, onboarding-heavy flows |
| `doodle` | the "SerenMind" wellness app | Warm and illustrated: graph paper, orange + yellow, pill buttons, doodles | Wellness, journaling, community, onboarding |

All palettes were tuned for this skill and checked against WCAG AA. Treat them as strong starting points: if the app has brand colors, keep the preset's *structure* (radius, shadow scale, fonts, roles) and swap the hues, then re-check the contrast rules in tokens.md.

**Choosing:** if the user names a reference or vibe, use the matching preset. Otherwise ask once, showing the table. For an app with both teachers and students, one preset still covers the whole app; `lavender` suits student-heavy apps and `studio` suits staff-heavy ones. Never mix two presets in one app. Borrow *patterns* (patterns.md) instead.

## Token schema (every preset defines all of these)

```ts
export type Palette = {
  canvas: string; surface: string; subtle: string; zebra: string;          // page, cards, disabled/track, table stripes
  ink: string; inkSoft: string; onAccent: string; onInk: string;           // text, borders, shadows
  primary: string; primarySoft: string; onPrimary: string;                 // main CTA
  success: string; successSoft: string;
  danger: string; dangerSoft: string; dangerInk: string;                   // dangerInk = error text & error border
  warning: string; warningSoft: string;
  violet: string; violetSoft: string;
  info: string; infoSoft: string;
  highlight: string;                                                       // marker behind key words, active tab, selected
  doodle: string;                                                          // sparkles/asterisks/squiggles only, never text
  tabBar: string;
};

export type Preset = {
  name: 'studio' | 'sunny' | 'lavender' | 'doodle';
  light: Palette;
  border: { width: number; thin: number };
  radius: { xs: number; sm: number; md: number; lg: number; xl: number; button: number; full: 999 };
  shadow: { sm: number; md: number; lg: number };       // hard offsets, blur 0
  font: { display: string; regular: string; medium: string; semibold: string; bold: string; mono: string };
  headingWeight: 'medium' | 'bold' | 'display';        // which family headings use
  canvasTexture: 'none' | 'grid';                       // grid paper on hero/onboarding screens (patterns.md)
};
```

Radius roles: `xs` checkboxes, tooltips, tiny tags · `sm` chips, keys, pagination cells · `md` inputs, tabs, options, list cards · `lg` cards, sheets, dialogs · `xl` icon tiles, illustration frames · `button` buttons (preset decides rounded vs pill) · `full` badges, avatars, progress tracks.

## `studio` (default)

```ts
export const studio: Preset = {
  name: 'studio',
  light: {
    canvas: '#FCF4EA', surface: '#FFFFFF', subtle: '#F1E8DC', zebra: '#F9F5EF',
    ink: '#1A1A1A', inkSoft: '#555555', onAccent: '#1A1A1A', onInk: '#FFFFFF',
    primary: '#FF7A6B', primarySoft: '#FFE2DE', onPrimary: '#1A1A1A',     // coral (ink 6.8:1)
    success: '#4FD1C5', successSoft: '#D8F5F2',                           // teal (ink 9.3:1)
    danger: '#FF5468', dangerSoft: '#FFD9DE', dangerInk: '#B31B30',       // red fill (ink 5.6:1); error text ≥ 5:1 everywhere
    warning: '#FFE26A', warningSoft: '#FFF9DE',                           // yellow (ink 13.5:1)
    violet: '#A68CF0', violetSoft: '#EBE6FC',                             // purple (ink 6.3:1)
    info: '#5CC0DE', infoSoft: '#DBF1F8',                                 // sky (ink 8.3:1)
    highlight: '#FFE26A',    // location: active tab, table header, hero band, highlighter word
    doodle: '#FF9F6B',       // peach sparkles
    tabBar: '#1A1A1A',
  },
  border: { width: 2, thin: 2 },
  radius: { xs: 4, sm: 8, md: 8, lg: 10, xl: 14, button: 8, full: 999 },
  shadow: { sm: 2, md: 4, lg: 8 },               // small marks 2 · interactive & cards 4 · overlays 8
  font: {
    display: 'SpaceGrotesk_500Medium', regular: 'SpaceGrotesk_400Regular', medium: 'SpaceGrotesk_500Medium',
    semibold: 'SpaceGrotesk_600SemiBold', bold: 'SpaceGrotesk_700Bold', mono: 'SpaceMono_400Regular',
  },
  headingWeight: 'medium',                        // calm Medium headings with negative tracking; bold is reserved for table headers & numbers
  canvasTexture: 'none',
};
```

Signature details: a section header with a 2px rule running to the edge, UPPERCASE overline labels above groups, segmented tabs with ink dividers and a yellow active segment, tables with a highlight header and zebra rows, and paper-strip progress bars.

## `sunny`: wallet reference

```ts
export const sunny: Preset = {
  name: 'sunny',
  light: {
    canvas: '#FAF6EC', surface: '#FFFFFF', subtle: '#F1EBDD', zebra: '#F7F2E6',
    ink: '#111111', inkSoft: '#4A463F', onAccent: '#111111', onInk: '#FAF6EC',
    primary: '#F5C542', primarySoft: '#FCEBB6', onPrimary: '#111111',
    success: '#7FD99B', successSoft: '#D9F5E1',
    danger: '#FF8FB8', dangerSoft: '#FFE0EC', dangerInk: '#A3123F',
    warning: '#FFB65C', warningSoft: '#FFE8C7',
    violet: '#C3A6FF', violetSoft: '#ECE3FF',
    info: '#8FD3FF', infoSoft: '#DDF1FF',
    highlight: '#F5C542', doodle: '#C3A6FF', tabBar: '#111111',
  },
  border: { width: 2, thin: 1.5 },
  radius: { xs: 6, sm: 8, md: 12, lg: 16, xl: 20, button: 12, full: 999 },
  shadow: { sm: 2, md: 4, lg: 6 },
  font: {
    display: 'SpaceGrotesk_700Bold', regular: 'SpaceGrotesk_400Regular', medium: 'SpaceGrotesk_500Medium',
    semibold: 'SpaceGrotesk_600SemiBold', bold: 'SpaceGrotesk_700Bold', mono: 'SpaceMono_400Regular',
  },
  headingWeight: 'bold',
  canvasTexture: 'none',
};
```

Signature details: wavy sticker badges on onboarding, keypad of bordered keys, a black tab bar with a mustard active tab, and an "icon in an ink circle" inside buttons (↗ Transfer).

## `lavender`: "Brain Orely" reference (recommended for students)

```ts
export const lavender: Preset = {
  name: 'lavender',
  light: {
    canvas: '#EEE8FF', surface: '#FFFFFF', subtle: '#E2DAF7', zebra: '#F6F3FF',
    ink: '#1A1A1A', inkSoft: '#4D4766', onAccent: '#1A1A1A', onInk: '#FFFFFF',
    primary: '#A98BFA', primarySoft: '#ECE5FE', onPrimary: '#1A1A1A',     // purple CTA (ink 6.4:1)
    success: '#7EDC9A', successSoft: '#E3F7E9',
    danger: '#FF8FB8', dangerSoft: '#FFE6EF', dangerInk: '#B0124A',
    warning: '#FFB65C', warningSoft: '#FFEFDB',
    violet: '#A98BFA', violetSoft: '#ECE5FE',
    info: '#8FD3FF', infoSoft: '#E6F5FF',
    highlight: '#D7F25A',    // lime: highlighter behind a key word, premium card, hero band
    doodle: '#A98BFA',       // sparkles ✦ in purple
    tabBar: '#1A1A1A',
  },
  border: { width: 2, thin: 2 },
  radius: { xs: 6, sm: 10, md: 12, lg: 18, xl: 28, button: 12, full: 999 },
  shadow: { sm: 2, md: 4, lg: 6 },
  font: {
    display: 'Unbounded_800ExtraBold',             // wide, heavy display, headlines only (≥ 24px)
    regular: 'Lexend_400Regular', medium: 'Lexend_500Medium', semibold: 'Lexend_600SemiBold', bold: 'Lexend_700Bold',
    mono: 'SpaceMono_400Regular',
  },
  headingWeight: 'display',
  canvasTexture: 'grid',
};
```

Signature details: a wide extended display headline with **one word on a lime highlighter block**, a faint grid on the lavender canvas, line-art illustrations with flat fills, ✦ sparkle doodles, rounded-square bordered back/bookmark buttons, stat chips (icon + count), a lime "Premium" promo card with an ink arrow circle, and a "Generating…" screen with a checklist and a bordered progress bar. Packages: `@expo-google-fonts/unbounded`, `@expo-google-fonts/lexend`.

## `doodle`: "SerenMind" reference

```ts
export const doodle: Preset = {
  name: 'doodle',
  light: {
    canvas: '#FBF6EA', surface: '#FFFFFF', subtle: '#F1EADA', zebra: '#F8F3E7',
    ink: '#1A1A1A', inkSoft: '#57524A', onAccent: '#1A1A1A', onInk: '#FBF6EA',
    primary: '#F26B3A', primarySoft: '#FCDED4', onPrimary: '#1A1A1A',     // orange (ink 5.8:1; white would be 3.0:1)
    success: '#A5C93A', successSoft: '#EBF3D4',
    danger: '#FF8F8F', dangerSoft: '#FFE6E6', dangerInk: '#B3261E',
    warning: '#F6C945', warningSoft: '#FDF3D6',
    violet: '#B79CFF', violetSoft: '#EFE9FF',
    info: '#7FB8FF', infoSoft: '#E3EFFF',
    highlight: '#F6C945',
    doodle: '#2F5BFF',       // cobalt asterisk/squiggle; decoration only (ink on cobalt is 3.4:1)
    tabBar: '#1A1A1A',
  },
  border: { width: 2, thin: 2 },
  radius: { xs: 6, sm: 10, md: 14, lg: 20, xl: 24, button: 999, full: 999 },   // pill buttons
  shadow: { sm: 2, md: 4, lg: 6 },
  font: {
    display: 'BricolageGrotesque_800ExtraBold',
    regular: 'DMSans_400Regular', medium: 'DMSans_500Medium', semibold: 'DMSans_600SemiBold', bold: 'DMSans_700Bold',
    mono: 'SpaceMono_400Regular',
  },
  headingWeight: 'display',
  canvasTexture: 'grid',
};
```

Signature details: graph-paper canvas, illustration "photo cards" tilted ±4° and overlapping, a cobalt asterisk and green squiggle doodles, white outline **pill** buttons with a hard shadow, a pill-plus-dots page indicator, and a small centered caption under the CTA. Packages: `@expo-google-fonts/bricolage-grotesque`, `@expo-google-fonts/dm-sans`. If a package name doesn't resolve, search for it with `npx expo install @expo-google-fonts/<family-kebab>`, and keep the `Family_800ExtraBold` naming.

## Assembling the active theme

```ts
// theme/neo.ts
import { studio } from './presets';           // ← the ONE line that picks the dialect
export const preset = studio;

export const Neo = {
  border: preset.border,
  radius: preset.radius,
  shadow: preset.shadow,
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 },
  screenPadding: 20,
  hit: 44,
} as const;

export const font = preset.font;
export const hardShadow = (size: number, color: string) =>
  size === 0 ? { boxShadow: 'none' as const } : { boxShadow: `${size}px ${size}px 0px 0px ${color}` };
```

`textStyles` is built from the preset in tokens.md. Dark palettes are derived with the recipe in tokens.md, not hand-picked per preset.
