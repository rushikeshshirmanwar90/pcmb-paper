# Visual patterns & screen archetypes

These patterns are distilled from the references in inspiration.md and rebuilt as original, reusable pieces. **Use the principle, never clone a reference's layout, copy or artwork.** Components (components.md) are the *atoms*; this file covers the *personality* layer and the full-screen layouts that make neobrutalism feel designed rather than merely bordered.

## Anatomy: what the references do (and what they don't)

| Observation | Wallet | SerenMind | Brain Orely | Rule for this skill |
|---|---|---|---|---|
| Canvas | warm off-white | cream **graph paper** | lavender **grid** | `canvasTexture: 'grid'` only on hero, onboarding and empty screens, never behind dense lists or forms |
| Headline | bold grotesk, 2 lines | heavy grotesk, 3 lines, tight leading | **wide extended display**, centered, one word on a **lime marker** | at most one display headline per screen, and at most 1 highlighted word |
| Illustrations | sticker blobs | line-art people in **tilted bordered photo cards** | line-art scenes with flat fills, bleeding off the edge | illustrations get a frame (border + shadow) *or* bleed edge-to-edge, never a soft floating blob |
| Doodles | none | blue asterisk, green squiggle, stars | ✦ sparkles, paper planes, clouds | ≤ 3 doodles per screen, only around headlines and illustrations, never inside controls or lists |
| Primary CTA | full-width mustard | outline white **pill** | right-aligned purple "Next →", full-width lime promo | one primary per screen; the shape follows `radius.button` |
| Secondary actions | colored pair | none | bordered **rounded-square icon buttons** (back, bookmark) | nav icons sit in 40px bordered squares (`radius.sm`) or circles |
| Data | amount tags in pastel chips | n/a | **stat chips** (icon + count) | numbers live in chips/tags, not loose text |
| Progress | n/a | **pill + dots** pager | dots pager; **bordered progress bar** with a checklist | see PageDots and the Generating archetype |
| Shadows | everywhere, 4px | buttons and cards | buttons, cards, progress, chips | interactive or elevated things get shadows; text blocks and backgrounds don't |
| Gradients | none | none | soft pink→lavender **wash behind the illustration only** | allowed **only** as an illustration backdrop (IllustrationBackdrop), never on cards, buttons or text areas |

**Decoration budget per screen:** 1 texture, 1 illustration block, 1 highlighted word, ≤ 3 doodles, 1 sticker. **Task screens** (taking a test, forms, settings, lists, tables) get *none* of these. Personality lives on onboarding, home heroes, results, empty states and paywalls.

## Pattern code

All snippets use the tokens and helpers from tokens.md and components.md (`usePalette`, `Neo`, `font`, `textStyles`, `hardShadow`, `NeoText`, `InkProvider`, `onFill`). They need `react-native-svg`.

### Headline with highlighter word

```tsx
/** Display headline; one word sits on a highlighter block. */
export function Headline({ text, highlight, align = 'left' }: { text: string; highlight?: string; align?: 'left' | 'center' }) {
  const p = usePalette();
  const words = text.split(' ');
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={text}
      style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: align === 'center' ? 'center' : 'flex-start', columnGap: 10, rowGap: 2 }}>
      {words.map((w, i) => {
        const hit = highlight && w.replace(/[.,!?;:'"]/g, '') === highlight;
        const t = <Text key={i} maxFontSizeMultiplier={1.3} style={[textStyles.display, { color: hit ? p.onAccent : p.ink }]}>{w}</Text>;
        return hit ? (
          <View key={i} style={{ backgroundColor: p.highlight, paddingHorizontal: 6, marginHorizontal: -2, transform: [{ rotate: '-1deg' }] }}>{t}</View>
        ) : t;
      })}
    </View>
  );
}
// <Headline text="Turn every doubt into an answer" highlight="answer" />
```

The highlighter has **no border and no shadow**: it's ink on paper, not a control.

### Grid-paper canvas

```tsx
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

export function GridPaper({ size = 24, opacity = 0.07 }: { size?: number; opacity?: number }) {
  const p = usePalette();
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id="neo-grid" width={size} height={size} patternUnits="userSpaceOnUse">
          <Path d={`M${size} 0H0V${size}`} stroke={p.ink} strokeOpacity={opacity} strokeWidth={1} fill="none" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#neo-grid)" />
    </Svg>
  );
}
// <Screen><GridPaper />…</Screen>. Put it as the first child of the screen, behind content.
```

### Doodles (decoration only, `accessible={false}`)

```tsx
import Svg, { Circle, Path } from 'react-native-svg';

export const Sparkle = ({ size = 22, color }: { size?: number; color?: string }) => {
  const p = usePalette();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d="M12 1C13 8 16 11 23 12C16 13 13 16 12 23C11 16 8 13 1 12C8 11 11 8 12 1Z" fill={color ?? p.doodle} stroke={p.ink} strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  );
};

export const Asterisk = ({ size = 34, color }: { size?: number; color?: string }) => {
  const p = usePalette();
  const arms = [0, 60, 120].map((deg) => {
    const r = (deg * Math.PI) / 180, dx = Math.cos(r) * 13, dy = Math.sin(r) * 13;
    return `M${20 - dx} ${20 - dy}L${20 + dx} ${20 + dy}`;
  }).join(' ');
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessible={false}>
      <Path d={arms} stroke={color ?? p.doodle} strokeWidth={7} strokeLinecap="round" />
    </Svg>
  );
};

/** Outlined squiggle: an ink stroke under a colored stroke reads as a bordered noodle. */
export const Squiggle = ({ width = 70, color }: { width?: number; color?: string }) => {
  const p = usePalette();
  const d = 'M4 20 C 14 2, 24 38, 34 20 S 54 2, 66 20';
  return (
    <Svg width={width} height={width * 0.57} viewBox="0 0 70 40" accessible={false}>
      <Path d={d} stroke={p.ink} strokeWidth={9} strokeLinecap="round" fill="none" />
      <Path d={d} stroke={color ?? p.success} strokeWidth={5} strokeLinecap="round" fill="none" />
    </Svg>
  );
};

export const Dot = ({ size = 10, color }: { size?: number; color?: string }) => {
  const p = usePalette();
  return <Svg width={size} height={size} accessible={false}><Circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill={color ?? p.doodle} stroke={p.ink} strokeWidth={1.5} /></Svg>;
};
```

Place doodles with `position: 'absolute'` relative to a headline or illustration (e.g. top-right of the last headline word, overlapping a frame corner by ~30%). Doodles **don't move** (no loops). They may fade in once with the screen.

### Illustration frame (tilted "photo cards")

```tsx
export function IllustrationFrame({ source, tilt = -4, tone = 'surface', width = 150, ratio = 1.3, style }: {
  source: ImageSourcePropType; tilt?: number; tone?: Tone; width?: number; ratio?: number; style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  return (
    <View style={[{ width, height: width * ratio, transform: [{ rotate: `${tilt}deg` }], ...hardShadow(Neo.shadow.md, p.ink), borderRadius: Neo.radius.xl }, style]}>
      <View style={{ flex: 1, borderRadius: Neo.radius.xl, borderWidth: Neo.border.width, borderColor: p.ink, overflow: 'hidden', backgroundColor: toneFill(p, tone) }}>
        <Image source={source} style={{ flex: 1 }} contentFit="cover" accessible={false} />
      </View>
    </View>
  );
}
// Two frames: tilt -5 and +4, the second overlapping the first by ~25% (marginLeft: -width * 0.25), the second higher in z-order.
```

The shadow sits on the **outer** view and `overflow: 'hidden'` on the **inner** one, so the shadow isn't clipped (rn-gotchas).

### Illustration backdrop

The only place a gradient is allowed: a soft two-tint wash *behind an illustration*, bleeding to the screen edge.

```tsx
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
export const IllustrationBackdrop = ({ from, to, height = 260 }: { from: string; to: string; height?: number }) => (
  <Svg width="100%" height={height} style={{ position: 'absolute', top: 0, left: 0 }} accessible={false}>
    <Defs><LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={from} /><Stop offset="1" stopColor={to} /></LinearGradient></Defs>
    <Rect width="100%" height="100%" fill="url(#wash)" />
  </Svg>
);
// from = p.dangerSoft (pink), to = p.canvas. Use *Soft tints only, never saturated accents.
```

### Page dots (onboarding pager)

```tsx
export function PageDots({ count, index }: { count: number; index: number }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }} accessibilityLabel={`Step ${index + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <Dot2 key={i} active={i === index} ink={p.ink} />
      ))}
    </View>
  );
}
function Dot2({ active, ink }: { active: boolean; ink: string }) {
  const w = useSharedValue(active ? 22 : 8);
  useEffect(() => { w.value = withSpring(active ? 22 : 8, Motion.spring.settle); }, [active]);
  const s = useAnimatedStyle(() => ({ width: w.value }));
  return <Animated.View style={[{ height: 8, borderRadius: 4, borderWidth: 2, borderColor: ink, backgroundColor: active ? ink : 'transparent' }, s]} />;
}
```

### Stat chip

```tsx
export function StatChip({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  const p = usePalette();
  return (
    <View accessibilityLabel={`${value} ${label}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 10,
      borderRadius: Neo.radius.sm, borderWidth: Neo.border.width, borderColor: p.ink, backgroundColor: p.surface,
      marginRight: Neo.shadow.sm, marginBottom: Neo.shadow.sm, ...hardShadow(Neo.shadow.sm, p.ink) }}>
      <Icon name={icon} size={16} color={p.ink} />
      <Text style={[textStyles.label, { color: p.ink, fontVariant: ['tabular-nums'] }]}>{value}</Text>
    </View>
  );
}
```

### Promo / upsell card

`Card tone="highlight"` (add `'highlight'` to `Tone`) holding: a small illustration or sticker on the left, a caption ("Premium"), a big price `textStyles.title` + `caption` ("per month"), and a **40px ink circle with a light arrow** on the right (the IconCircle pattern at 40px). The whole card is one `PressableNeo` with `tone="highlight"`. At most one per screen, and never on task screens.

### Dashed divider

```tsx
import Svg, { Line } from 'react-native-svg';
export const DashedDivider = () => {
  const p = usePalette();
  return (
    <Svg height={2} width="100%" accessible={false}>
      <Line x1="0" y1="1" x2="100%" y2="1" stroke={p.ink} strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="5 5" />
    </Svg>
  );
};
```

Use it *inside* a card to separate related parts (question / answer). Use 2px solid ink rules for structure (section headers, table rows). A single-side `borderStyle: 'dashed'` doesn't render on iOS, which is why this uses SVG.

### Section header with rule

`[Title] ────────────` as a row: `NeoText variant="heading"` + `View { flex: 1, height: 2, backgroundColor: ink }`, gap 12, marginTop 32. Groups inside a section get an **overline** label (`textStyles.overline`, `inkSoft`): "TODAY", "COMPLETED", "VARIANTS".

## Screen archetypes

Spacing uses `Neo.screenPadding` (20) gutters. "↓" means a vertical stack.

### 1. Onboarding (SerenMind / Orely / Wallet)
↓ top bar: small wordmark left, ghost "Skip" right · **illustration zone** (≈ 50% of the height: tilted frames, a backdrop wash, or a sticker cluster, plus ≤ 3 doodles) · `Headline` (display, ≤ 3 lines, 1 highlighted word) · body (`bodySm`, `inkSoft`, ≤ 3 lines) · footer row: `PageDots` left + primary "Next →" right (Orely), **or** a centered full-width/pill CTA with a caption under it (SerenMind, Wallet). Canvas `GridPaper`. Motion: the pager slides, dots animate, nothing loops.

### 2. Home / dashboard (Wallet)
↓ header ("Hello, Name 👋" + avatar/bell) · **hero card** (`Card lg`, balance or next action, two side-by-side buttons) · horizontal row of square **quick-action tiles** (first tile in `success` with a "+" circle, the others white with avatars) · section header · list card with avatar rows and amount **tags** · floating black tab bar. No texture, no doodles.

### 3. Task with keypad (Wallet "Transfer")
↓ header: title + round close button · selected-entity card (avatar, name, meta, ↗) · overline "AMOUNT" · big amount card (`display` value + caption "available") · 3×4 `PressableNeo` key grid (gap 12) · pinned full-width primary. Haptics: none per key, `tap` on submit.

### 4. Generating / loading (Orely)
↓ back button + centered title · `Headline` centered (`display`, e.g. "Finding your *weak* topics") with ✦ doodles · an illustration (bleeding edge, `highlight` band behind it) · "Generating…" `heading` · checklist rows (20px check-circle + `bodySm`): done rows show a check (it pops once and stays silent), the pending row shows a small spinner · **bordered progress bar** (track `surface`, fill `primary`, 2px ink right edge) driven by real progress, never fake looping. Use only for waits longer than ~2s.

### 5. Answer / detail (Orely)
↓ backdrop wash + illustration on top (≈ 35%) with a square back button and a bookmark button on it · **content card** overlapping the illustration (−24px margin): overline "ANSWER" in the `primary` color family (ink text), body, `DashedDivider`, overline "QUESTION", body in `inkSoft`, a row of `StatChip`s + share icon · full-width secondary button ("Similar questions") · optional promo card. For pcmb this is the **solution / explanation** screen.

### 6. Results (student)
↓ header · score card (`CountUp`, a `Tag` for the grade) · ONE reward (app-interactions motion.md) · section "By topic" with `NeoProgress` bars (label + %) · weak-topic list with a primary "Practise" button. A Sticker only for scores of 80% and above.

### 7. Data table (teacher screens)
↓ section header with rule · filter chips row · `DataTable` (yellow header, zebra rows, status badges) · `Pagination` row. On narrow phones, it becomes a list of row cards (components.md).

## Illustration guidance
- **Style:** flat fills from the active palette + a 2dp ink line + the hard shadow. No soft gradients inside illustrations and no photographic shading.
- **Making them:** code first (SVG doodles, stickers, icons). Generate scenes and characters with the canvas-design skill under the **App Art Contract**, then export and register them (graphics.md).
- **People:** illustrated, never stock photos inside brutalist frames.
- **Never** put text inside illustration images (it doesn't scale, translate or reach screen readers).
