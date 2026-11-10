# human-friendly-ux (bundled design guide)

> Part of the **pcmb-student-engagement** skill. Paths in this guide (`references/…`, `scripts/…`) are relative to **this folder**: `${CLAUDE_SKILL_DIR}/design/human-friendly-ux/`.
>
> **What it covers:** Restructures Expo / React Native apps so they match how people think, decide and remember: fixes screens where content isn't divided properly into pages, tabs or steps, overloaded screens and mega-modals, confusing navigation, long forms, filter walls, lost progress and dead ends, using human-behavior principles (Hick, chunking, progressive disclosure, recognition, goal-gradient, Zeigarnik, peak-end, Fitts, Tesler, defaults, mental models) with Apple's design foundations. Includes a structure-audit script, a tabs/segments/sheets/stepper decision table, screen specs and Expo Router recipes. Use it whenever the user says the app is not user friendly, confusing, cluttered or hard to navigate, that data or pages aren't divided properly, or asks to reorganise screens, tabs or flows, improve UX, information architecture, onboarding or forms, or wants psychology-based UX, even for one screen.


# Human-friendly UX: structure that fits how people think

Most "this app isn't user friendly" problems aren't visual. They're **structural**: too many things on one screen, several tasks fused into one modal, no clear first step, progress that gets lost, labels that don't predict what's behind them. This skill finds those problems and restructures the app using how people actually behave, then hands off to the visual design system.

## Who owns what
- **This skill:** information architecture, navigation model, flows, screen content priority, states, and behavior-driven rules (what goes on which screen, in what order, behind which container).
- **apple-design:** design foundations (purpose, agency, familiarity, simplicity, wayfinding, specific labels) and the *feel* of motion and gestures. Apply its wayfinding questions to every screen.
- **neobrutalism-expo** (or the app's design system): how screens *look*. Build every new or split screen with the kit components; in a scoped app, the kit picks the look per role.
- **app-interactions:** behavior on every screen: states, loading, motion, haptics, responsive.
- **impeccable / taste-skill / ui-ux-pro-max:** critique passes after restructuring.

## Reference files

| File | Read before… |
|---|---|
| `references/behavior-principles.md` | diagnosing any screen or explaining *why* a change helps |
| `references/restructure-playbook.md` | restructuring anything: the 7-step process, container decision table, spec template, worked examples |
| `references/expo-navigation.md` | implementing the new structure in Expo Router (sheets, steppers, segmented views, undo, resume, guards) |
| `scripts/structure-audit.mjs` | starting, and after each restructured flow |

## Core rules (apply everywhere)

1. **One screen, one job.** Each screen answers one job story and has **one primary action**, placed in the thumb zone (bottom).
2. **Container follows content relationship:** independent areas → bottom tabs (3–5) · parallel views of one object → segmented control (≤ 4) · hierarchy → push · short focused task → sheet · long dependent task → stepper (3–5 steps, ≤ 5 fields each) · rare details → disclosure · many items → list + search + filter sheet. Full table in the playbook.
3. **Layer, don't dump (progressive disclosure):** summary first (3 items + "See all"), details one tap away, advanced options behind "More options".
4. **Order by use (serial position):** the most frequent task is first on the screen and first in menus; unfinished work ("Continue…") comes before everything.
5. **Remember for the user (recognition, Tesler):** pre-fill context (current class, subject, last settings), keep filters, scroll position and drafts, and never ask for something the app already knows.
6. **Show progress and position (goal-gradient, wayfinding):** "Step 2 of 4", "12/30 answered", a title that names where you are, an obvious way back.
7. **Never lose work (Zeigarnik, interruptions):** autosave drafts and answers, survive backgrounding, offer resume. Use undo instead of "Are you sure?", and confirm only irreversible actions.
8. **Fewer, clearer choices (Hick, choice overload):** presets and templates before customisation, ≤ 2 secondary actions visible, the rest in ⋯ menus or swipe actions.
9. **Labels predict destinations (information scent):** nouns for places, verbs for actions, no "Manage", "Submit" or "Other".
10. **Every list and screen has its non-happy states:** loading (skeleton), empty (why + the one action), error (what + retry), partial, offline. Implement them with the bundled **app-interactions** guide (`design/app-interactions/`: `AsyncView`, skeletons, `AsyncButton`, toasts, `useOnline` in its references/states-and-async.md; layouts in its references/responsive.md). It applies to every role, whatever the visual design.
11. **End well (peak–end):** each top task ends on a clear outcome and one next step, never on a spinner, a dead end or a generic toast.
12. **Respect people:** calm language, no dark patterns, no guilt or fake urgency, extra care during tests (exam anxiety).

## Workflow

1. **Audit:** run `node ${CLAUDE_SKILL_DIR}/design/human-friendly-ux/scripts/structure-audit.mjs <src>` and map the current routes as a tree (playbook Step 1). Read every flagged file before judging. Task-runner screens (taking a test) can legitimately carry more actions.
2. **Users & tasks:** roles, the top 5 job stories per role, and baseline taps/decisions/dead ends for each (Step 2). Ask the user to confirm the roles and top tasks if they aren't clear from the code and docs.
3. **Diagnose:** findings as *Principle → observation → change*, prioritised by frequency × severity (Step 3).
4. **Propose:** a new map, a screen spec for every new or changed screen, and a before/after task table (Steps 4–5). **Stop and get the user's approval.** Restructuring changes navigation and muscle memory, so it's hard to undo.
5. **Implement incrementally:** one flow at a time with the Expo Router recipes. Split large files along the new map, keep the APIs and validation, add drafts and resume, keep deep links working (Step 6).
6. **Style & behave:** build the new screens with the app's kit (in a neobrutalism scope, with neobrutalism-expo's archetypes and checklist), and wire states, motion and responsiveness with app-interactions.
7. **Verify:** re-walk the tasks (fewer taps, no dead ends), re-run the audit, do the wayfinding check on every screen, an interruption test and a first-use read-through (Step 7).

## Per-screen review checklist
- [ ] I can state this screen's single job in one sentence, and its primary action is obvious and bottom-reachable.
- [ ] Where am I / where can I go / what's here / how do I get out: all answered without thinking.
- [ ] ≤ 7 items per group; ≤ 5 inputs visible at once; ≤ 2 secondary actions visible.
- [ ] Most-used content first; unfinished work surfaced; rare things one level deeper.
- [ ] Context pre-filled; nothing asked twice; filters and position remembered.
- [ ] Loading, empty, error and offline states designed.
- [ ] Leaving and returning (or backgrounding) loses nothing.
- [ ] Labels are specific nouns and verbs; no jargon.
- [ ] No tabs inside tabs, no modal on a modal, no dead end.

## Anti-patterns
- Mega-modals that hold a whole workflow in `step === …` modes and dozens of `useState`.
- A dashboard that shows every module in full; a "Settings" page that hides features.
- Tabs for things that aren't parallel views; a hamburger hiding primary navigation; > 5 tabs.
- Confirmation dialogs for reversible actions; silent data loss on back.
- Forms showing every field at once; required fields hidden behind "More options".
- Making users re-pick their class, subject or filters on every screen.
- Redesigning visuals to hide structural problems (aesthetic-usability is not a fix).
- Inventing features while restructuring. Reorganise what exists; propose new features separately.
