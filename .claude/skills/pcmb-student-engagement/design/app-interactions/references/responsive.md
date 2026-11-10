# Responsive layout (phones, large phones, foldables, tablets, landscape, web)

The same rules apply to every role and every visual design. Code uses the kit contract in adapters.md.

Good mobile UI scales by **layout**, not by shrinking or stretching the style. Borders, shadows and radii stay the same at every size (in neo scope: 2px ink, hard offsets), and type follows the user's font-size setting. What changes with space is the number of columns, the gutters, the max content width, and whether two panes sit side by side.

## Size classes (by window, not device)

Decide by the **window** (`useWindowDimensions`), never by device model: iPad split view, foldables, Android multi-window and web resize all change the window.

| Class | Width | Typical | Layout |
|---|---|---|---|
| `compact` | < 600 | phones (portrait) | 1 column, gutter 20 (16 below 360), bottom tab bar, sheets from the bottom |
| `medium` | 600–839 | large phones in landscape, small tablets, unfolded foldables | 2-column grids, content max 680 centered, sheets as centered dialogs (max 560) |
| `expanded` | ≥ 840 | tablets, desktop web | content max 960 centered **or** list-detail split view; a navigation rail can replace the bottom tabs; dialogs max 560 |

Height matters too: **`short`** = height < 480 (phones in landscape). There, collapse large titles, put sheets at full height, and make the keypad and option grids two columns.

```tsx
import { PixelRatio, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type SizeClass = 'compact' | 'medium' | 'expanded';

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const size: SizeClass = width >= 840 ? 'expanded' : width >= 600 ? 'medium' : 'compact';
  const gutter = width < 360 ? 16 : size === 'compact' ? 20 : 28;
  const maxContent = size === 'expanded' ? 960 : size === 'medium' ? 680 : width;
  return {
    size, width, height, insets, gutter,
    short: height < 480,
    landscape: width > height,
    columns: size === 'expanded' ? 3 : size === 'medium' ? 2 : 1,
    contentWidth: Math.min(maxContent, width - gutter * 2),
    fontScale: PixelRatio.getFontScale(),          // the user's text-size setting: never fight it
    split: size === 'expanded',                    // list-detail side by side
  };
}
```

If the app already has a responsive hook, align its thresholds and returns with this instead of adding a second one.

## Rules

1. **Never scale fonts by screen width.** Helpers that shrink text on small phones (e.g. `scaleFont(size) * 0.9`) push text below a readable size and fight the user's accessibility setting. Small screens get fewer columns, tighter gutters and truncation, not smaller type. The only width-based type change allowed: `display` may step up from 32 to 40 on `expanded`.
2. **Respect font scale.** Layouts must survive `fontScale` 1.0–2.0: text wraps, rows grow taller, and `maxFontSizeMultiplier` caps only headlines, tags and tab labels (tokens.md). Test at the largest setting.
3. **Center and cap content** on wide windows (`contentWidth`). Never stretch a form, a card or a line of body text across a 1200px window: body text should stay at ≤ ~70 characters per line.
4. **Grids keep breathing room:** `gap` ≥ 12 and every item's width computed from `contentWidth` minus the gaps. In neo scope, items also reserve their hard-shadow offset at the right and bottom.
5. **Two panes only on `expanded`:** list (≈ 360 wide) + detail. Selecting a row updates the detail pane instead of pushing a screen. The same component pushes on compact.
6. **Navigation adapts, it doesn't duplicate:** bottom tabs on compact/medium; on expanded, a left **navigation rail** (72 wide, styled like the app's tab bar) or keep bottom tabs inside a centered max-width frame. Pick one per app.
7. **Sheets → dialogs** on medium and up: the same content, centered, max 560 wide, raised like the app's dialogs.
8. **Touch targets stay ≥ 44** on every size. Don't shrink controls on small phones; hide secondary actions in ⋯ instead.
9. **Safe areas everywhere:** headers use `insets.top`, pinned buttons and the floating tab bar use `insets.bottom` (+ 8). Android is edge-to-edge in recent Expo SDKs, so content draws under the system bars unless padded.
10. **Orientation:** phones may stay portrait (`"orientation": "portrait"` in app.json) unless a screen benefits from landscape. Tablets and web support both. A test runner in landscape: question on the left, options on the right.

## Responsive building blocks

```tsx
/** Centers content and caps its width; use as the first child of every scroll view. */
export function Container({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { contentWidth } = useLayout();
  return <View style={[{ width: contentWidth, alignSelf: 'center' }, style]}>{children}</View>;
}

/** Equal-width grid that reserves room for hard shadows. */
export function Grid<T>({ items, render, min = 1, gap = 12 }: { items: T[]; render: (item: T, width: number) => ReactNode; min?: number; gap?: number }) {
  const { columns, contentWidth } = useLayout();
  const cols = Math.max(min, columns);
  const w = Math.floor((contentWidth - gap * (cols - 1)) / cols);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {items.map((it, i) => <View key={i} style={{ width: w }}>{render(it, w)}</View>)}
    </View>
  );
}

/** List-detail: side by side on expanded, push navigation on compact/medium. */
export function SplitView({ list, detail, hasSelection }: { list: ReactNode; detail: ReactNode; hasSelection: boolean }) {
  const { split } = useLayout();
  const p = usePalette();
  const t = useDesignTokens();
  if (!split) return <>{list}</>;   // compact: the list screen pushes the detail route itself
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ width: 360, borderRightWidth: t.borderWidth, borderColor: p.border }}>{list}</View>
      <View style={{ flex: 1 }}>{hasSelection ? detail : <EmptyDetail />}</View>
    </View>
  );
}
```

Stat tiles: 2 per row on compact, 3–4 on medium/expanded. Answer options: 1 column on compact portrait, 2 columns on `short` landscape and expanded. Keypads: max 360 wide, centered.

## Keyboard

- Wrap forms in `KeyboardAvoidingView` (`behavior="padding"` on iOS, `"height"` or none on Android with `softwareKeyboardLayoutMode: "pan"`/`"resize"` set in app.json), or use `react-native-keyboard-controller`'s `KeyboardAwareScrollView` if the app has it.
- `keyboardShouldPersistTaps="handled"` on every scroll view containing inputs, so tapping a button doesn't just dismiss the keyboard.
- Chain fields: `returnKeyType="next"` + focus the next ref. The last field uses `"done"`/`"go"` and submits.
- The pinned primary button stays visible above the keyboard (it moves with the keyboard, not under it).
- Use the right keyboard per field: `keyboardType="number-pad"` for codes and marks, `"email-address"`; `autoCapitalize="characters"` for room codes; `textContentType`/`autoComplete` for name, email, password and OTP (`one-time-code`).

## Web specifics (react-native-web)

- Hover: on pointer devices, pressables show a hover state (classic: opacity 0.85; neo: face tinted 12% lighter). Press feedback stays the same.
- Keyboard: every pressable is reachable by Tab with a visible 2px focus ring (built into `PressScale`/`PressableNeo` via the kit); Enter/Space activate; Escape closes sheets and dialogs.
- `cursor: 'pointer'` on pressables, text selectable in content areas, and a max content width always.

## Test matrix

| Check | Sizes |
|---|---|
| Layout and clipping | 320×568 (iPhone SE 1st gen / small Android), 360×780, 390×844, 430×932 |
| Landscape (`short`) | 844×390 |
| Medium | 600×960 (foldable), 744×1133 (iPad mini) |
| Expanded | 1024×1366 (iPad Pro), 1280×800 (web) |
| Text size | font scale 1.0, 1.3, 2.0 on the smallest phone |
| Keyboard | every form on the smallest phone, keyboard open, pinned CTA visible |
