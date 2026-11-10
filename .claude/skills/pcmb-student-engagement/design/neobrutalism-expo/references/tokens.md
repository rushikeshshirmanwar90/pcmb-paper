# Neobrutalism tokens

Palettes, radii, shadows and fonts are defined **per preset** in `presets.md`. This file holds what every preset shares: how the theme plugs into an existing app, the type scale, dark mode, contrast rules, icons, system chrome, and the cheat-sheet for migrating old styles. Every contrast figure was computed with the WCAG formula.

## Plugging into an existing theme file

1. Copy the chosen preset (presets.md) into the app, e.g. `constants/presets.ts`.
2. In the existing theme file, **keep the app's current token names** and point them at the preset's palette, so every existing `usePalette()` consumer keeps compiling. Map semantics: primary → `primary`, success → `success`, danger/destructive → `danger`, warning → `warning`, violet/secondary → `violet`, background → `canvas`, card/popover → `surface`, muted → `subtle`, foreground → `ink`, mutedForeground → `inkSoft`, and **every border/line/input token → `ink`**. Old `*Border` tokens → `ink`. Old `*Ink` tokens → `ink`, except error text, which becomes `dangerInk`. An old `white` used as text on primary becomes `onAccent`.
3. Export `Neo`, `font`, `hardShadow` (presets.md → Assembling) and `textStyles` (below).

## Type scale

The scale is the same for every preset. Only the families and heading weight change. Sizes step gently (12 → 32) and are tuned for phones.

```ts
const heading = preset.headingWeight === 'display' ? font.display : preset.headingWeight === 'bold' ? font.bold : font.medium;
const tight = preset.headingWeight === 'medium' ? -0.6 : -0.4;   // Medium headings get slightly tighter tracking

export const textStyles = {
  display:    { fontFamily: preset.headingWeight === 'medium' ? font.medium : font.display, fontSize: 32, lineHeight: 38, letterSpacing: -1 },
  title:      { fontFamily: heading,     fontSize: 24, lineHeight: 30, letterSpacing: tight },     // screen title
  heading:    { fontFamily: heading,     fontSize: 20, lineHeight: 26, letterSpacing: tight / 2 },  // section title
  subheading: { fontFamily: font.medium, fontSize: 16, lineHeight: 22 },                            // card title
  body:       { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },                           
  bodySm:     { fontFamily: font.regular, fontSize: 14, lineHeight: 21 },                           
  label:      { fontFamily: font.medium, fontSize: 14, lineHeight: 20 },                            // buttons sm, labels
  caption:    { fontFamily: font.regular, fontSize: 13, lineHeight: 19 },                           // badges, meta
  overline:   { fontFamily: font.medium, fontSize: 12, lineHeight: 18, letterSpacing: 1.3, textTransform: 'uppercase' as const }, // "VARIANTS", "STATES"
  mono:       { fontFamily: font.mono,   fontSize: 12, lineHeight: 18 },                            // codes, room IDs, hex
} as const;
```

Rules:
- **Display fonts** (Unbounded, Bricolage Grotesque) are for headlines of 24px and up only, at most 3 lines, and never for body, labels or numbers inside tables.
- Button labels use `font.medium` at 14 (sm), 16 (md) or 17 (lg). Presets with `headingWeight: 'bold'` use `font.bold`.
- **Question stems, options and long reading text use `body` (regular).** Never set paragraphs in display or bold.
- `overline` labels sit above groups of controls ("STATES", "TODAY"), always in `inkSoft`.
- Table headers use `font.bold` at 13.6. Table cells use `bodySm`.
- Timers, scores and counters use `fontVariant: ['tabular-nums']`.
- **Font scaling:** keep `allowFontScaling`, but cap it with `maxFontSizeMultiplier`: 1.3 for display, title, tags and tab labels, and 1.6 elsewhere.

## Contrast rules (all presets)

| Pair | Rule |
|---|---|
| Body text | `ink` on canvas, surface or any `*Soft` tint (≥ 13:1 in all presets) |
| Secondary text | `inkSoft` on canvas, surface and `*Soft` tints only (≥ 5.5:1). On saturated fills, use the fill's ink at 0.8 opacity |
| Text on accents | always `onAccent` (dark). White text on any preset accent is 1.3–3.3:1, which fails |
| Error text / error border | `dangerInk` (≥ 5.2:1). The `danger` fill is for buttons, chips and the error-state *shadow* |
| Accent colors **as text** | never: pink/teal/blue/purple text on white is 1.9–2.9:1 |
| `doodle` color | decoration only (sparkles, squiggles), never text, never behind text |
| Placeholder | `inkSoft`, not 50% ink (3.4:1) |
| Non-text (borders, focus rings, progress fills) | ≥ 3:1 against neighbours. Ink borders are 15–17:1 |

## Dark mode recipe (derived, works for any preset)

Ship dark mode only if the app already has it. Don't hand-pick colors; derive them:

```ts
export const mix = (fg: string, bg: string, a: number) => {
  const f = [1, 3, 5].map((i) => parseInt(fg.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  return '#' + f.map((x, k) => Math.round(x * a + b[k] * (1 - a)).toString(16).padStart(2, '0')).join('').toUpperCase();
};

export const darkFrom = (l: Palette): Palette => ({
  ...l,                                   // saturated accents, highlight, doodle: unchanged (they keep dark onAccent text)
  canvas: '#17161A', surface: '#24222A', subtle: '#2E2B35', zebra: '#1F1D24',
  ink: '#F6F1E7', inkSoft: '#C9C2B5', onInk: '#17161A', tabBar: '#F6F1E7',
  onAccent: '#1A1A1A', onPrimary: '#1A1A1A',
  primarySoft: mix(l.primary, '#24222A', 0.22), successSoft: mix(l.success, '#24222A', 0.22),
  dangerSoft: mix(l.danger, '#24222A', 0.22), warningSoft: mix(l.warning, '#24222A', 0.22),
  violetSoft: mix(l.violet, '#24222A', 0.22), infoSoft: mix(l.info, '#24222A', 0.22),
  dangerInk: l.danger,                    // pink/red reads on near-black (≥ 7:1 for all presets)
});
```

These 22% dark tints carry cream `ink` at ≥ 7.5:1 for every preset. Borders and shadows use `ink` (cream) in dark mode, so outlines stay visible.

## Icons

Use outline icons with a **2px stroke**, or the bold weight of the app's existing icon set (SF Symbols `weight="semibold"`, Phosphor `bold`, Lucide `strokeWidth={2}`). Sizes: 16px inside inputs, 20px in buttons, alerts and dialogs, and 24px in hero tiles and the tab bar. Color always comes from `useInk()`. Don't mix filled and outline icons; filled is only for the active tab. Chevrons in breadcrumbs and rows are 14px.

## System chrome

- `app.json`: root `backgroundColor`, `splash.backgroundColor` and `android.navigationBar.backgroundColor` = the preset's `canvas` (or set it at runtime with `expo-system-ui` `setBackgroundColorAsync`).
- `<StatusBar style="dark" />` in light mode, `"light"` in dark mode.

## Mapping cheat-sheet for the sweep

| Old | New |
|---|---|
| `borderWidth: 1` / `0.5` / `hairlineWidth` | `Neo.border.width` |
| grey `borderColor` | `palette.ink` |
| `borderRadius` 2–5 | `Neo.radius.xs` |
| `borderRadius` 6–10 | `Neo.radius.sm` on chips and keys, `Neo.radius.md` on inputs, options and list cards |
| `borderRadius` 12–24 | `Neo.radius.lg` on cards, sheets and dialogs. `Neo.radius.xl` on icon tiles and illustration frames |
| `borderRadius ≥ 999` | `radius.full` on badges, avatars and progress tracks. **Buttons use `radius.button`**, which is a pill only in `doodle` |
| `shadow*` / `elevation` | `hardShadow(Neo.shadow.md, ink)`, or remove for plain groupings |
| `fontWeight` 700/800/bold | `textStyles.*` variant or `font.bold` |
| `fontWeight` 600 | `font.semibold` (in `studio`, use `font.medium`, its emphasis weight) |
| `fontWeight` 500 | `font.medium` |
| no weight / 400 | `font.regular` |
| raw `<Text style={{ fontSize, fontWeight, color }}>` | `<NeoText variant="…">` |
| `color: palette.primary` (etc.) on text | `ink`, plus a colored Tag or highlight behind it if emphasis is needed |
| grey `mutedForeground` on a saturated fill | `<NeoText soft>` |
