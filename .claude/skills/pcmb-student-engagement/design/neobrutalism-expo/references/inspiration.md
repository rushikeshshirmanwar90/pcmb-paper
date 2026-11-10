# Inspiration: what the references teach (and how to study new ones)

The skill's defaults come from studying four references: a Figma neobrutalism UI library (shadcn-based, LITE edition), a wallet app, a learning app ("Brain Orely") and a wellness app ("SerenMind"). **We take principles from them, not pixels.** This file records those principles so every new screen inherits the *thinking*, and it explains how to study a new reference the user brings.

## Lessons from the Figma UI library

1. **One stroke, everywhere.** A single border weight (2px ink) on every control and card is what makes a kit feel like a system. Mixed weights look like bugs.
2. **Shadow depth encodes hierarchy.** Three hard-shadow sizes, each with a job: small marks (badges, checkboxes, page numbers) 2 · things you touch and cards 4 · overlays (dialogs) 8. Nothing else gets a shadow.
3. **Calm type can still be brutalist.** Headings in a *Medium* grotesk with slight negative tracking, regular body, bold only for table headers and numbers. The borders do the shouting, so the type doesn't have to.
4. **Disabled shouldn't redesign the control.** Fading the whole thing to 50% while keeping the border and shadow keeps the layout and the meaning. *Error* recolors the border **and** the shadow, which is unmistakable without extra icons.
5. **Location vs selection.** Yellow marks *where you are* (active tab, table header, page band). The primary color marks *what you picked* (checked box, current page). Keeping the two apart makes dense screens readable.
6. **Structure is visible.** Section titles carry a 2px rule to the edge, groups get small UPPERCASE overline labels, and tables use a highlight header plus zebra rows with ink dividers. The grid is shown, not hidden.
7. **Every component shows every state.** Default, hover/pressed, disabled, error, checked, and empty/0%/100% for progress. Design the states first.
8. **Progress is a paper strip.** A fill with an ink edge inside a bordered pill track reads as physical.

Where the library is weak (and this skill corrects it): white text on red/coral buttons (≈ 3:1), accent colors used as text (≈ 2–3:1), grey helper text on tinted alerts (≈ 4:1), and red error text (≈ 3.3:1). See the contrast rules in tokens.md.

## Lessons from the app screens

| Reference | Principle we keep |
|---|---|
| Wallet | A **hero card** carries the main number and two actions. Quick-action tiles in a row. Amounts live in colored tags. A keypad made of real bordered keys. An ink tab bar with a colored active tab. |
| Brain Orely | A **wide display headline with one highlighted word** gives instant personality. A grid canvas. Rounded-square nav buttons over illustrations. **Stat chips** for counts. An honest "Generating…" screen with a checklist and a bordered progress bar. One loud promo card. A dashed divider *inside* cards, solid rules *between* structures. |
| SerenMind | Illustrations inside **tilted, overlapping bordered frames**. Sparse doodles (an asterisk, a squiggle) near the headline. **Pill** CTA for a softer brand. A pager of one pill and several dots. A small caption under the CTA. Graph-paper canvas. |
| All three | **Decoration is zoned:** onboarding, heroes, results and empty states get personality, while task screens stay plain. Text never sits on a gradient. Illustrations use flat fills + ink line art. |

These became the presets (presets.md), the patterns and screen archetypes (patterns.md), and the component rules (components.md).

## Studying a new reference

When the user shares a new screenshot or Figma file "for inspiration":

1. **Extract principles, not values.** For each element, ask what job it does and why it works. Write 5–10 lessons like the ones above.
2. **Map to the system:** which preset is closest? Which tokens would change (canvas, primary, highlight, radius.button, headingWeight, canvasTexture)? Which patterns are new?
3. **Check contrast** on any new color pair before adopting it (tokens.md rules). References often fail AA.
4. **Change only what the lesson needs.** Don't clone layouts, illustrations, names or brand marks. Recreate the *principle* in the app's own content.
5. Record the new lessons in this file and any new pattern in patterns.md, so the skill keeps learning.

### Reading a Figma file (Figma MCP)

1. The Figma MCP needs **edit access**. For a community file, ask the user to *Duplicate to drafts* and share the copy's link.
2. URL `figma.com/design/<fileKey>/<name>?node-id=1-534` → fileKey + nodeId `1:534`.
3. `create_session` (fileKey, a short read-only description) → `get_metadata` on the root frame to list the sections → `get_variable_defs` (if it returns `{}`, the values live on the layers).
4. Load the `figma-design-to-code` guidance (MCP resource `skill://figma/figma-design-to-code/SKILL.md`), then call `get_design_context` **per section** in parallel batches, not on the whole page.
5. Read the generated Tailwind as *evidence* of the designer's system, not code to port:

| You see | It tells you |
|---|---|
| `border-2 border-[#1a1a1a]` on everything | one-stroke system → `Neo.border.width` |
| `drop-shadow-[2px…]` / `[4px…]` / `[8px…]` on different element types | a shadow hierarchy → `Neo.shadow.sm/md/lg` |
| `rounded-[8px]` / `[4px]` / `[16777200px]` | radius roles → `radius.md` / `xs` / `full` |
| `font-['X:Medium']` on headings | heading weight → `headingWeight` |
| `uppercase tracking-[…]` small grey text | overline labels |
| `opacity-50` on a whole control | the disabled strategy |
| `bg-[rgba(color,0.2)]` | soft tints → precompute as solid `*Soft` tokens |
| `absolute left/top` everywhere | a layout artifact; rebuild with flex + gap |

6. Never paste the generated web markup into React Native, and never download the file's illustrations or icons into the app unless the user owns them.
