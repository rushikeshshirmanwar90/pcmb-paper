# neobrutalism-expo (bundled design guide)

> Part of the **pcmb-student-engagement** skill. Paths in this guide (`references/…`, `scripts/…`) are relative to **this folder**: `${CLAUDE_SKILL_DIR}/design/neobrutalism-expo/`.
>
> **What it covers:** Visual design system and redesign workflow for friendly neobrutalism (neo-brutalist) UI in Expo / React Native apps: ink outlines, hard zero-blur shadows, flat pastel fills, chunky grotesk or wide display type, press-into-shadow buttons. Includes four original theme presets, 25+ components, personality patterns, screen archetypes, a canvas-design graphics pipeline and role-scoped adoption, so only one login or area can become neobrutalist while the others keep their look exactly. Pairs with app-interactions (motion, states, responsive) and human-friendly-ux (structure). Use it whenever the user wants neobrutalism, brutalist, Gumroad/shadcn-neo, bold-bordered or sticker-style screens in Expo or React Native: a screen, a component, a theme, one role or login, or a whole-app redesign. Also use it for a look taken from a reference image or Figma file, or for app illustrations, GIFs, icons or splash art in this style.


# Neobrutalism for Expo / React Native

This skill turns an Expo app, or **one part of it** (for example the student login), into a **friendly neobrutalist** interface: confident ink outlines, hard shadows and flat color, made warm and readable rather than raw. It is opinionated on purpose. Follow the rules exactly unless the user overrides them, because consistency is what makes this style look designed instead of broken.

**Inspiration, not imitation.** The defaults were distilled from a Figma neobrutalism UI library and three reference apps (inspiration.md). Use their *principles*. Never clone a reference's layout, copy, colors or artwork. The same applies when the user brings new references: study them, write down the lessons, and express them through this system.

Related guides and skills, with this split of authority (app-interactions and human-friendly-ux are bundled next to this guide in `design/`; the rest are user-installed skills):
- **This skill owns the look:** presets, components, patterns, graphics, and *where* the look applies (scope).
- **app-interactions** owns behavior in every scope and role: motion and haptics, states, loading, skeletons, toasts, offline, responsive layout. This skill only supplies the neo *look* of those interactions (its adapters.md).
- **human-friendly-ux** owns *structure*: which content goes on which screen, tabs vs steps vs sheets, flows. Restructure first, then style.
- **canvas-design** makes the *artwork* when a screen needs graphics; this skill gives it the App Art Contract and turns its output into app assets (graphics.md).
- **apple-design** owns motion *physics*. **impeccable / taste-skill / ui-ux-pro-max** own critique passes. **frontend-design** owns intent: "distinctive" comes from patterns.md, never from breaking the rules below.

## Reference files: read them when you reach these points

| File | Read before… |
|---|---|
| `references/scoped-adoption.md` | the look should apply to **only some roles, logins or areas** (e.g. students only). Read it before step 2 |
| `references/presets.md` | choosing the look, or touching colors, radius, shadow scale or fonts |
| `references/tokens.md` | wiring the theme into the app, type scale, dark mode, contrast, icons, migration cheat-sheet |
| `references/components.md` | writing or restyling any component (start with "The system in six rules" and §0–2) |
| `references/patterns.md` | onboarding, home heroes, results, empty states, paywalls, or any full-screen layout |
| `references/graphics.md` | a screen needs an illustration, badge art, an animated graphic/GIF, an app icon or a splash |
| `references/inspiration.md` | the user shares a screenshot or Figma link, or asks "why" a rule exists |
| `references/rn-gotchas.md` | clipped shadows, fonts, haptics, layout jumps, web issues |
| `scripts/audit.sh` | starting a redesign, and after each sweep step (pass a folder to audit one scope) |
| `scripts/export_assets.py` | exporting generated artwork (stills, dark variants, play-once animations) |
| app-interactions skill | motion, haptics, states, loading, skeletons, toasts, offline, responsive (all scopes) |

## The look in one paragraph

Every surface is a flat piece of colored paper with a **2px ink outline** and a **hard shadow offset down-right with zero blur**, on a warm or tinted canvas. One primary color marks the main action; a **highlight** color marks where you are; pastels carry meaning. Type is a grotesk: calm Medium or bold headings, regular body. Some presets add a **wide display face** for hero headlines. Corners are moderately rounded. On press, an element **slides into its shadow** like a physical button. Personality (a highlighted word, doodles, tilted illustration frames, stickers) lives only on onboarding, heroes, results and empty states.

## Non-negotiable rules (inside the neo scope)

1. **One stroke:** `Neo.border.width` (2px) ink on every card, button, input, chip, tab, avatar, key and checkbox. No hairlines, no grey borders, no borderless cards.
2. **Shadow = hierarchy:** hard offsets only (`hardShadow`), no blur, spread, opacity or `elevation`. `sm` for small marks (badges, checkboxes, chips, page cells), `md` for anything you touch and for cards, `lg` for overlays (dialogs, sheets). Text blocks and backgrounds never get one. The only non-ink shadow is the highlight-colored one under the ink tab bar.
3. **Selection vs location:** choosing (checked, picked answer, selected filter, current page) → **primary** family. Where you are (active tab/segment, nav item, table header, hero band) → **highlight**.
4. **Color & contrast:** the canvas is never pure white. Text color comes from the surface (`useInk()` / `NeoText`), so accent fills always get dark `onAccent` text. Accents are **never** text colors. `inkSoft` goes only on surfaces and soft tints. Error text uses `dangerInk`. Every pair follows tokens.md → Contrast rules.
5. **Radius by role:** `xs` checkbox/tooltip/tag · `sm` chips/keys/cells/nav squares · `md` inputs/tabs/options · `lg` cards/sheets/dialogs · `xl` icon tiles/illustration frames · `button` (rounded, or pill in `doodle`) · `full` badges/avatars/progress.
6. **Type:** the preset's families only, loaded per weight. Weight comes from `fontFamily`, never `fontWeight` (Android ignores it for custom fonts). Display faces are for headlines ≥ 24px only. Question text and paragraphs use regular body.
7. **States change one thing:** pressed = slides into its shadow. Disabled = whole control at 50% opacity, structure unchanged. Error = border **and** shadow turn `danger` + `dangerInk` helper text. Focus = highlight-tinted fill. Loading = spinner + label, full color. **Shadow space is always reserved**, so nothing ever shifts.
8. **Room for shadows:** shadowed elements reserve their offset on the right and bottom, and no ancestor of a shadowed element has `overflow: 'hidden'`.
9. **Decoration is zoned:** per screen at most 1 texture, 1 illustration block, 1 highlighted word, ≤ 3 doodles and 1 sticker, and **none** on task screens (tests, forms, settings, lists, tables). Gradients only as an illustration backdrop.
10. **Behavior comes from app-interactions:** its motion budget, haptics map, async states and responsive rules apply unchanged. This skill only changes how they *look* (press-into-shadow, neo skeleton frames, bordered loader squares).
11. **Scope is explicit:** if only part of the app is neo, the kit renders the neo look **only inside the neo scope**. Every other area must stay **pixel-identical** to before (scoped-adoption.md).

## Workflow: redesigning an existing app (or one role of it)

Work in this order. Each step must leave the app running. Work on a branch (e.g. `design/neobrutalism`) and commit after each step.

### 0. Choose the scope and the preset
- **Scope:** the whole app, or only some roles or areas? If only some, write the scope map (scoped-adoption.md §1: roles, pre-login screens, shared screens, previews), confirm it with the user, and **capture reference screenshots of the classic areas** before changing anything.
- **Preset:** read presets.md. If the user named a reference or vibe, map it to a preset; otherwise ask once, showing the four presets in one line each. With brand colors, keep the preset's structure and swap its hues, re-checking contrast. New references get studied first (inspiration.md).

### 1. Audit (read before writing)
Run `bash ${CLAUDE_SKILL_DIR}/design/neobrutalism-expo/scripts/audit.sh <folder>` on the folders in scope (and the shared folders). Also run `node ${CLAUDE_SKILL_DIR}/design/human-friendly-ux/scripts/structure-audit.mjs <src>`. Read the theme file and how screens consume it, the shared primitives file and its exports, which components are shared between roles, the tab bar, header, drawer, root `_layout.tsx`, and `app.json` (`newArchEnabled` must not be `false`, because `boxShadow` needs the New Architecture). Read `PRODUCT.md`/`DESIGN.md`; if they conflict with this skill, ask which wins. Write a short plan: token file, primitives, shared files, screens that bypass the kit, the dark-mode decision, and **no-touch zones** (KaTeX/MathJax/WebView, PDF/print templates, charts with their own palettes, native pickers).

### 2. Tokens
Copy the preset and export `Neo`, `font`, `hardShadow`, `mix` and `textStyles` (tokens.md). **Whole app:** remap the existing palette values, keeping the token names (tokens.md → Plugging in). **Scoped:** keep the classic palette untouched, add `DesignProvider`/`useDesign` at the root, `neoPalette()` mapped onto the app's token names, a scope-aware `usePalette()` and `useDesignTokens()` (scoped-adoption.md §2–4). Derive dark mode with `darkFrom()` only if the app already supports it.

### 3. Fonts & system chrome
`npx expo install expo-font` plus the preset's `@expo-google-fonts/*` packages. Load the weights in the root `_layout.tsx` with `useFonts`, keeping the splash up until they load. Give the base text component the `textStyles` variants (scoped: only the neo branch). Splash and system bars: the preset's canvas for a whole-app redesign. When scoped, keep the classic splash and set the status/navigation bar per scope.

### 4. Kit
**Whole app:** restyle the shared kit **in place** (same exports and props) from components.md. **Scoped:** branch every kit component instead: the old implementation becomes `Classic<Name>` **unchanged**, the neo one becomes `Neo<Name>` with the same props, and the exported name switches on `useDesign()` (scoped-adoption.md §5). Start with `InkContext`, `NeoText` and `PressableNeo`, then Card, Button, IconButton, Badge/Tag/Chip, Field, Checkbox/Radio/Switch, Tabs/Segmented, Alert, ProgressBar, ListRow, Avatar, StatTile, DataTable, QuestionPalette, Tooltip, Dialog/Sheet, Empty/Error, Keypad/CodeInput, Sticker, and `AnswerOption` for learning apps. The app-interactions primitives (async states, skeletons, loaders, toasts, responsive helpers) are added once for all scopes; give each one its neo look through the branch. Missing pieces go into the kit, not inline in screens.

### 5. Navigation chrome
Tab bar, header, section headers and overlines per components.md §21–22 (scoped: branched, so the neo tab bar appears only in neo scope). Update the tab-bar-height hook so scroll views clear the floating bar.

### 6. Screen sweep (neo scope only)
For screens flagged by the structure audit, **restructure before restyling** (human-friendly-ux: map → specs → user approval → split into tabs, steps or sheets). Restyling a cluttered screen only makes the clutter prettier.

Go folder by folder **within the neo scope**. In each screen:
- hex → tokens; raw `<Text>` + `fontWeight` → `NeoText`;
- radius numbers → radius roles; thin/grey borders → 2px ink;
- soft shadows/`elevation` → `hardShadow` by hierarchy, or nothing;
- hand-styled buttons → kit `Button`/`PressableNeo`;
- section titles outside cards with a rule, and overline labels on groups;
- `gap` ≥ 12, with no `overflow: 'hidden'` on shadow ancestors.

**Shared screens** (rendered by several roles) get the kit-only sweep: kit components, `usePalette()` and `useDesignTokens()`, with no neo-only tokens or patterns (scoped-adoption.md §6). **Classic-scope screens get no visual changes.** Match neo screens to an archetype in patterns.md where one fits. Re-run the audit after each folder; every neo screen must pass the per-screen checklist.

### 7. Personality pass (neo scope)
Only on onboarding, home hero, results, empty states and paywalls, using patterns.md: a `Headline` with one highlighted word, `GridPaper` (if the preset uses texture), illustration frames or backdrop, ≤ 3 doodles, a sticker. Stay inside the decoration budget, and skip anything that slows a task flow.

**Graphics:** follow graphics.md: draw what code can (SVG doodles, stickers, icons). For scenes and characters, write one app art philosophy + a brief per asset, generate with **canvas-design** under the App Art Contract, export with `export_assets.py` (`--dark` for dark mode; `anim` for play-once animations), check the preview sheet, register the asset, and render it with `<Illustration>`. Change the app icon and splash only for a whole-app redesign, or if the user asks.

### 8. Interactions
Use the **app-interactions** skill for motion, haptics, states, loading and responsive behavior. It applies to **every** role and scope with the same logic; in neo scope the kit renders its neo look (press-into-shadow, neo skeleton frames, bordered `DotsLoader`, neo toasts, neo answer feedback).

### 9. Verify
- `npx tsc --noEmit` and `npx expo lint` pass.
- **Neo scope** (log in as that role): on a ≈360dp Android phone and an iPhone, no clipped shadows, no layout jumps on select/disable/error, and the tab bar clears the content; OS text size at maximum still works; dark mode (if shipped) keeps dark text on accent fills and visible borders.
- **Classic scopes** (log in as each other role): screens match the reference screenshots exactly, and the leak check in scoped-adoption.md §7 is clean.
- app-interactions verification (states, motion, responsive) for every role.
- Run the user's critique skill (impeccable / taste review) on 2–3 key neo screens and fix what it finds.

## Per-screen checklist (neo screens, definition of done)
- [ ] Canvas background, 20px gutters, section headers with rules, overline labels on groups, 12–16px gaps.
- [ ] Every card, input and pressable: 2px ink border, the shadow size that matches its hierarchy, shadow space reserved.
- [ ] No hex, `fontWeight`, soft shadow, grey border or stray radius number left in the file.
- [ ] One primary action in view. Selection uses primary; location uses highlight.
- [ ] All text from `NeoText`/`useInk()`. No white on accents, no accent-colored text.
- [ ] Touch targets ≥ 44pt; icon buttons have `accessibilityLabel`.
- [ ] Decoration within budget (none on task screens).
- [ ] app-interactions per-screen checklist passes (states, motion, responsive).
- [ ] Math, WebView and PDF content untouched.

## Building a single new screen or component
If tokens and the kit exist, skip to composing: pick the archetype in patterns.md, compose kit components only, apply the personality pattern only if the screen type allows it, then run the per-screen checklist. A new screen inside a classic scope uses the kit as-is and gets no neo patterns.

## Anti-patterns (reject in review)
- Soft/blurred shadows, `elevation`, glassmorphism, gradients on UI surfaces, blur views (in neo scope).
- Grey 1px borders, borderless cards, mixed border widths, a shadow on everything (no hierarchy).
- Pure white canvas. Large pure-black fills other than the tab bar.
- White text on accents, accent-colored text, `inkSoft` on saturated fills, red error text below 4.5:1.
- Highlight used for selection or primary used for location. Two presets mixed.
- Shadows clipped by `overflow: 'hidden'` or screen edges; layout that jumps when state changes.
- Display fonts in paragraphs, buttons or tables. Bold paragraphs for question text.
- Doodles, textures or stickers on task screens. More than one highlighted word. Text over gradients or illustrations.
- Cloning a reference's layout, copy or artwork instead of applying its principle.
- Restyled KaTeX/math, PDFs or print previews.
- Text baked into images, off-palette or gradient-shaded art, art that disappears in dark mode, looping GIFs in the app, animated art on task screens, artwork traced from a reference.
- Polishing the visuals of an overloaded screen instead of dividing it properly (human-friendly-ux).
- **Scoped apps:** restyling the shared kit in place, forking screens per role, neo tokens or patterns in shared or classic-only files, any visual change to a classic role, a neo splash or icon when only one role is neo.
