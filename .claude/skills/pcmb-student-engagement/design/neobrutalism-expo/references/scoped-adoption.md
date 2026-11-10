# Scoped adoption: neobrutalism for one role or area only

Use this when only part of the app should become neobrutalist (e.g. **the student login**), while the other parts (teacher, tuition, admin) **keep their current look exactly**. The interaction layer (app-interactions skill) and the structure work (human-friendly-ux) still apply everywhere; only the *look* is scoped.

The core idea: **one kit, two looks.** Screens keep importing the same `Button`, `Card` or `usePalette()`. A design scope set at the root tells the kit which look to render. No screen is duplicated, and no role gets a forked kit.

## 1. Write the scope map first (and confirm it with the user)

```
Scope map
- student login (all tabs + pushed screens + sheets)      → neo
- teacher login                                          → classic (unchanged)
- tuition login                                          → classic (unchanged)
- pre-login (login, register, forgot password, verify)   → classic   ← shared by every role; neo only if the user asks
- student-only gates (force password change for students) → neo
- shared screens (announcements, timetable, …)          → follow the viewer's scope automatically
- teacher "preview as student" (if any)                  → neo, so teachers see what students see (ask the user)
```

Find the roles in the code (auth context, role-based tabs/guards) and which files are shared between roles (imports from `screens/shared`, `components/*` used by several role folders). If a decision isn't obvious, ask. A wrong scope is visible to every user of that role.

## 2. The design scope

```tsx
// lib/design-scope.tsx
import { createContext, PropsWithChildren, useContext } from 'react';

export type Design = 'classic' | 'neo';
const DesignCtx = createContext<Design>('classic');

export function DesignProvider({ design, children }: PropsWithChildren<{ design: Design }>) {
  return <DesignCtx.Provider value={design}>{children}</DesignCtx.Provider>;
}
export const useDesign = () => useContext(DesignCtx);
export const designForRole = (role?: string | null): Design => (role === 'student' ? 'neo' : 'classic');
```

Set it once, where the signed-in role is known, **around everything that role can reach**: its tabs, the root Stack's pushed screens and its modals. Because a session has one role, the root is the right place:

```tsx
// app/_layout.tsx (sketch: keep the app's existing providers and structure)
function SignedIn() {
  const { user } = useAuth();
  return (
    <DesignProvider design={designForRole(user?.role)}>
      {/* role tabs, root Stack, sheets, toasts: everything renders inside the scope */}
    </DesignProvider>
  );
}
```

Pre-login screens render outside (classic by default). A screen that must look neo regardless of the viewer (e.g. a teacher previewing the student test view) wraps itself: `<DesignProvider design="neo">…</DesignProvider>`.

## 3. Scope-aware palette

Keep the app's palette **type and token names**. In neo scope, `usePalette()` returns the preset's colors mapped onto those same names, so every existing `p.primary`, `p.border` or `p.mutedForeground` keeps working.

```ts
// constants/neo-palette.ts
import { studio as preset } from './presets';     // ← the chosen preset (presets.md)
import type { Palette } from '@/components/kit';   // the app's existing palette type

/** The neo preset expressed in the app's own token names. Every key of the app's palette must be mapped. */
export function neoPalette(dark: boolean): Palette {
  const n = dark ? darkFrom(preset.light) : preset.light;
  return {
    ...classicPaletteFor(dark),           // start from the app's palette so no key is missing
    // surfaces & text
    background: n.canvas, canvas: n.canvas, card: n.surface, surface: n.surface, popover: n.surface,
    subtle: n.subtle, muted: n.subtle, foreground: n.ink, ink: n.ink, text: n.ink,
    mutedForeground: n.inkSoft, inkSoft: n.inkSoft, textSecondary: n.inkSoft,
    // every border/line token becomes ink
    border: n.ink, borderStrong: n.ink, input: n.ink, line: n.ink,
    primaryBorder: n.ink, successBorder: n.ink, warningBorder: n.ink, dangerBorder: n.ink,
    // accents
    primary: n.primary, primarySoft: n.primarySoft, onPrimary: n.onAccent, primaryInk: n.ink,
    success: n.success, successSoft: n.successSoft, successInk: n.ink,
    warning: n.warning, warningSoft: n.warningSoft, warningInk: n.ink,
    danger: n.danger, dangerSoft: n.dangerSoft, dangerInk: n.dangerInk,
    violet: n.violet, violetSoft: n.violetSoft,
    // neo-only extras (components.md reads these)
    highlight: n.highlight, doodle: n.doodle, onAccent: n.onAccent, onInk: n.onInk, tabBar: n.tabBar, zebra: n.zebra,
    info: n.info, infoSoft: n.infoSoft,
  } as Palette;
}
```

```ts
// in the kit, replacing the old usePalette
export function usePalette(): Palette {
  const dark = useColorScheme() === 'dark';
  return useDesign() === 'neo' ? neoPalette(dark) : classicPaletteFor(dark);   // classicPaletteFor = the app's old getPalette
}
```

Adapt the key list to the app's real palette: map each key by *meaning*, and never leave a key pointing at an old classic color inside neo scope. Memoize the two palettes (they're constants per mode).

## 4. Scope-aware tokens for shared code

Neo components read `Neo`, `font` and `textStyles` directly. They only ever render in neo scope. Code that renders in **both** scopes (shared screens, shared components, the app-interactions layer) must not hard-code either look. It reads:

```ts
export function useDesignTokens() {
  const neo = useDesign() === 'neo';
  return neo
    ? { borderWidth: Neo.border.width, radius: Neo.radius, shadow: (s: 'sm' | 'md' | 'lg', c: string) => hardShadow(Neo.shadow[s], c) }
    : { borderWidth: StyleSheet.hairlineWidth, radius: CLASSIC_RADIUS, shadow: CLASSIC_SHADOW };  // the app's current values
}
```

## 5. Kit branching: one export, two looks

For every kit component whose look changes:

1. **Rename the existing implementation to `Classic<Name>`, unchanged** (same code, same styles). This is the guarantee that the other roles look exactly as before.
2. Add `Neo<Name>` from components.md, accepting the **same props** (map neo variants onto the app's prop names; extra neo props are optional).
3. Export the original name as a switch:

```tsx
export function Button(props: ButtonProps) {
  return useDesign() === 'neo' ? <NeoButton {...props} /> : <ClassicButton {...props} />;
}
export function Card(props: CardProps) {
  return useDesign() === 'neo' ? <NeoCard {...props} /> : <ClassicCard {...props} />;
}
// Text: export AppText (neo → NeoText, classic → the app's text styling) for shared code.
// Pressable primitive: neo → PressableNeo, classic → PressScale (app-interactions adapters.md).
```

New behavior props added for everyone (e.g. `disabledReason`, `loading` improvements from app-interactions) go into **both** branches. New *look-only* props (tone, elevation, highlight) are optional and ignored by the classic branch.

Hooks with no visual output (`useLoad`, `useAsyncAction`, `useForm`) are never branched.

## 6. What gets swept, and how

| Files | Treatment |
|---|---|
| Role-specific screens in neo scope (e.g. `screens/student/**`, student-only routes) | the **full screen sweep** (SKILL.md step 6): tokens, `NeoText`, hard shadows, patterns, personality |
| **Shared** screens and components (rendered by several roles) | **kit-only sweep**: replace hard-coded colors, radii, shadows and font weights with kit components, `usePalette()` and `useDesignTokens()`, so they adapt. No neo-only patterns (stickers, doodles, highlighter) unless wrapped in `useDesign() === 'neo'` |
| Screens of classic roles (e.g. `screens/teacher/**`, `screens/tuition/**`) | **no visual changes.** They only receive the interaction layer (app-interactions) and structure changes (human-friendly-ux) |
| Math, WebView, PDF output | untouched in every scope |

Navigation chrome (tab bar, header, drawer, status bar style) branches like any kit component. The neo tab bar shows only in neo scope.

Fonts: load the preset's fonts at the root once (they're small); only neo components use them.

## 7. Guarding the classic roles (do this every step)

1. **Before step 2**, capture reference screenshots of the key classic-role screens (each role's tabs, a form, a list, a modal), in light and dark mode.
2. After each step, log in as each classic role and compare. **Any difference is a bug** in the branching (usually a shared file using a neo token directly).
3. Audit the neo folder and leak-check the classic folders in one command:
   ```bash
   bash ${CLAUDE_SKILL_DIR}/design/neobrutalism-expo/scripts/audit.sh src/screens/student --leaks src/screens/teacher src/screens/tuition
   ```
   In the neo folder the counts should fall toward zero; the leak check must print `clean` (neo-only symbols never appear in classic-only folders).
4. Log in as the neo role and run the per-screen checklist (SKILL.md).

## 8. Later: widening the scope

To bring another role into neo later, change `designForRole` and run the full sweep on that role's folder. The kit already supports both looks, so no rework is needed.
