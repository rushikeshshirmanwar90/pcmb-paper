# Graphics pipeline: generating art for the app

When a screen needs a graphic (onboarding art, empty states, results and badges, error/offline states, the app icon and splash), this pipeline produces original artwork that matches the active preset, exports it in app-ready formats, and wires it into the screen. **The canvas-design skill makes the artwork; this file sets the rules it must follow for an app and handles everything after.**

## 1. Pick the cheapest medium that works (decision ladder)

| Need | Medium | Why |
|---|---|---|
| Icons, doodles (✦ asterisk squiggle), stickers, badges, grid paper, simple shapes, charts | **Code**: `react-native-svg` components (patterns.md, components.md) | Themeable (light/dark/preset), razor sharp, ~0 KB, animatable |
| Scenes, objects, characters: onboarding, empty states, results, paywall, offline | **Generated still**: canvas-design master → `export_assets.py still` → WebP @1x/2x/3x | Rich art without bloating the code |
| A still that should "arrive" (pop, tilt, slide in once) | **Still + Reanimated** (`usePop`, `entering`) | Smooth, interruptible, respects reduced motion, no extra bytes |
| Inherently sequential motion (a mascot waves, a badge assembles, a trophy fills) | **Frame animation**: generated frames → `export_assets.py anim` → animated WebP that **plays once** | Works in `expo-image` on iOS and Android with real alpha |
| Sharing outside the app (WhatsApp, social) | GIF via `--gif` | GIF is 256 colors with jaggy 1-bit alpha and big files: share-only, never in-app |

Don't generate what code can draw, and don't use frame animation when a still + Reanimated says the same thing. Lottie is fine only if the app already uses it; this pipeline doesn't author Lottie files.

## 2. The App Art Contract (overrides canvas-design defaults for app assets)

canvas-design aims for museum-quality abstract art: one-off pieces, thin type, "never cartoony". App illustrations have different jobs: they must be **legible at 64dp, consistent across a set, text-free and theme-safe**. When invoking canvas-design for app assets, pass this contract and tell it the contract wins on conflict:

1. **Palette:** only the active preset's hexes (presets.md), mostly `ink`, `surface`, `primary`, `highlight` and 1–2 pastels. No gradients, no textures, no photographic shading inside the art.
2. **Line:** a uniform ink outline equal to **2dp at the target size** (6px on a 3× master; scale proportionally). Rounded joins.
3. **Depth:** flat fills + the preset's **hard offset shadow** (`shadow.md`, down-right, ink, 0 blur). No soft shadows or glows.
4. **Composition:** one clear subject, centered, at least 6% safe padding, on a **transparent background**. Pass the silhouette test: recognizable as a black shape at 64dp.
5. **No text, numbers or letters** inside images (localization, font scaling, screen readers). Put words in the UI.
6. **Interior ink never touches the outer outline:** keep a gap ≥ the outline width, so the automatic dark variant stays clean (§5).
7. **Character style** (if people appear): simple geometric shapes, varied skin tones and identities, friendly neutral expressions, no realistic faces, no likenesses of real people, nothing that could read as a brand mascot.
8. **Original only:** the references in inspiration.md are for principles. Never trace, recreate or "match" a reference image, artist, character or brand.
9. **A set, not singles:** the same viewpoint, line weight, palette ratios and shadow direction for every asset in the app.
10. **Render big:** masters at ≥ 3× the target dp (e.g. 660×570 for a 220×190dp slot). The export script warns when a master is too small.

### The app's art philosophy (canvas-design step 1, done once per app)
canvas-design always starts by writing a design philosophy. For an app, write it **once** and reuse it for every asset, so the set stays coherent. Save it as `design/graphics/philosophy.md`, with this contract appended verbatim. A starting point for this skill's look:

> **Paper Brutalism.** Objects as cut paper on a warm desk: flat planes of confident color held by one unbroken ink line, each piece lifted by a hard shadow as if pinned a few millimetres above the page. Forms are simple, slightly chunky and rounded at the corners; nothing is rendered, everything is *placed*. Color is rationed: one loud accent and one quiet one per piece, the rest ink and paper. Composition is centered and calm, with generous air, so each object reads like a sticker on a notebook cover. Every edge, gap and angle is meticulously considered, the product of painstaking craft.

Adapt the wording to the preset (e.g. `lavender`: line-art study desk, lime highlighter accents; `doodle`: notebook margins, sparkles and squiggles).

## 3. Brief per asset

Write one brief per graphic before generating, in `design/graphics/briefs.md`:

```
Asset: empty-tests                     Screen: Teacher › Tests (empty state)
Job: Reassure that nothing is wrong and invite creating the first test
Slot: 200×170 dp · still · light + dark
Subject: an open notebook with a check-mark badge and one sparkle
Palette: ink, surface, highlight (pages), success (badge), violet (sparkle)
Alt text: decorative (the empty-state title already says it)  ← or a short label if the image carries meaning
Motion: arrives with FadeIn once (no frame animation)
```

## 4. Generate (with canvas-design)

1. Invoke the **canvas-design** skill with the philosophy (`design/graphics/philosophy.md` + contract) and the brief. Ask for a **single PNG with a transparent background** at ≥ 3× the slot size, saved to `design/graphics/masters/<asset>.png`. Masters are source files and are not bundled.
2. Let canvas-design do its refinement pass, while respecting the contract (refining means simplifying, not adding detail that dies at 64dp).
3. **Frame animations:** have the generation script draw the subject as a function of `t ∈ [0, 1]` and save 12–20 PNG frames to `design/graphics/masters/<asset>-frames/` (00.png, 01.png…). Keep it to ≤ 900ms for celebrations and ≤ 1.5s otherwise. Ease out, with one small overshoot at most. The last frame is the resting state.

## 5. Export

```bash
# still, with an automatic dark-mode variant
python ${CLAUDE_SKILL_DIR}/design/neobrutalism-expo/scripts/export_assets.py still design/graphics/masters/empty-tests.png \
  --name empty-tests --dp 200x170 --out assets/illustrations --dark \
  --palette "#1A1A1A,#FFFFFF,#FFE26A,#4FD1C5,#A68CF0" --alt ""

# frame animation (plays once) + final-frame still for reduced motion
python ${CLAUDE_SKILL_DIR}/design/neobrutalism-expo/scripts/export_assets.py anim design/graphics/masters/badge-unlock-frames \
  --name badge-unlock --dp 120x120 --fps 20 --out assets/illustrations
```

The script trims, fits with safe padding, writes WebP at 1×/2×/3× (Metro picks the scale from `require('./name.webp')`), and with `--dark` writes a variant where **only the silhouette-connected ink (outlines and shadows) turns cream**, so the art survives a dark canvas while interior details stay dark. It checks budgets (still @3x ≤ 150 KB, animation ≤ 450 KB), measures palette drift, prints a registry line, and saves a preview sheet (light / dark / 64dp) to `design/graphics/previews/`. **Open the preview and look at it** before using the asset: the 64dp thumbnail must still read.

## 6. Register and use

```ts
// src/assets/illustrations/index.ts (one typed registry; paste the lines the script prints)
export type Art = { src: number; dark?: number; end?: number; width: number; height: number; alt: string; animated?: boolean };
export const illustrations = {
  emptyTests: { src: require('./empty-tests.webp'), dark: require('./empty-tests-dark.webp'), width: 200, height: 170, alt: '' },
  badgeUnlock: { src: require('./badge-unlock.webp'), end: require('./badge-unlock-end.webp'), width: 120, height: 120, alt: '', animated: true },
} satisfies Record<string, Art>;
```

```tsx
import { Image } from 'expo-image';
import { useColorScheme } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/** Theme- and motion-aware illustration. Decorative unless `art.alt` is set. */
export function Illustration({ art, scale = 1, play = true }: { art: Art; scale?: number; play?: boolean }) {
  const dark = useColorScheme() === 'dark';
  const reduce = useReducedMotion();
  const still = art.animated && (reduce || !play) ? art.end : undefined;   // reduced motion: show the resting frame
  const source = still ?? (dark && art.dark ? art.dark : art.src);
  return (
    <Image
      source={source}
      style={{ width: art.width * scale, height: art.height * scale }}
      contentFit="contain"
      autoplay={!still}
      cachePolicy="memory-disk"
      transition={0}
      accessible={!!art.alt}
      accessibilityRole={art.alt ? 'image' : undefined}
      accessibilityLabel={art.alt || undefined}
    />
  );
}
```

Placement rules (patterns.md decoration budget still applies): at most 1 illustration block per screen; **none on task screens** (taking a test, forms, settings, tables); animated assets only for rewards, onboarding and badge moments, mounted when the moment happens (so they play once, at the right time), at most one per screen. Preload hero art for the next screen with `Image.prefetch` when the user is about to reach it.

## 7. App icon and splash

Use the same philosophy, with these extra rules:
- **Icon:** a 1024×1024 PNG with **no transparency** (iOS), one bold symbol on the preset's `highlight` or `primary`, ink outline, and a hard shadow scaled to stay visible at 29pt. Test it at 48px.
- **Android adaptive icon:** a foreground PNG with the symbol inside the central 66% safe zone and a transparent surround. Set `backgroundColor` to the same flat color.
- **Splash:** the symbol only (no text), centered on the preset's `canvas` color. Set `splash.image`, `splash.backgroundColor`, plus `dark` variants if the app supports dark mode.
- Wire them up in `app.json` (`icon`, `android.adaptiveIcon`, `splash` or the `expo-splash-screen` plugin config), then rebuild. Icons don't update over the air.

## 8. Checklist before an asset ships
- [ ] Only preset colors (palette drift ≤ 12%), ink outline, hard shadow, transparent background, no text.
- [ ] Reads at 64dp; the dark variant reads on the dark canvas (preview sheet checked).
- [ ] Within budget; registered with `alt` (or deliberately decorative).
- [ ] Animated: plays once, has an `end` still, appears only at its moment, and reduced motion shows the still.
- [ ] Original artwork that follows the brief and matches the rest of the set.
