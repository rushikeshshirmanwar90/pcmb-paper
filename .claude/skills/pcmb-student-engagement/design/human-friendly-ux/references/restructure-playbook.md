# Restructure playbook: dividing content so it makes sense

Use this when a screen or flow "has everything in one place", when users get lost, or when the structure audit flags a file. The output is a **new map + screen specs approved by the user**, then an incremental implementation.

## Step 1. Inventory (read, don't change)

1. Run `node ${CLAUDE_SKILL_DIR}/design/human-friendly-ux/scripts/structure-audit.mjs <src>` and list the flagged screens.
2. List the routes (the `app/` folder for Expo Router, or the navigators) and draw the **current map** as a tree, with modals marked `[modal]`, tabs `[tab]` and in-screen modes `{mode}`:
   ```
   Tabs
   ├─ Home
   ├─ Papers [tab]
   │   └─ Create exam [modal] {basics}{chapters}{questions}{settings}{share}   ← 5 modes in one modal
   └─ Profile
   ```
3. For each flagged screen, list its **content blocks** (what's shown) and **actions** (what you can do), each tagged by how often it's needed: **daily / weekly / rare**.

## Step 2. Users and top tasks

1. Identify the roles (e.g. teacher, student, admin) from the code (role-based tabs, guards) and from PRODUCT.md. Ask the user if it's unclear.
2. Write the **top 5 tasks per role** as job stories: *"When I ___, I want to ___, so I can ___."* (e.g. "When my class finishes a test, I want to see who struggled on which topic, so I can plan the next lesson.")
3. Walk each task through the current app and record: **taps, screens, decisions, scrolls, text inputs, dead ends**. This is the baseline to beat.

## Step 3. Diagnose

For each flagged screen and each slow task, write findings as **Principle → observation → change** (behavior-principles.md). Typical root causes:

| Symptom | Usual cause | Principle |
|---|---|---|
| One giant modal / screen with `step === …` modes | Several tasks fused together | Chunking, progressive disclosure |
| A long scroll of unrelated sections | No hierarchy: everything is equal | Hick, serial position, common region |
| Tabs inside tabs inside a modal | Navigation designed per feature, not per user model | Mental models, Jakob |
| Same data shown in 3 places, each slightly different | No single home for the object | Mental models, recognition |
| Many buttons with equal weight | No primary action | Von Restorff, Hick |
| Users re-enter context (class, subject) everywhere | The app doesn't remember | Recognition, Tesler |
| Lost work after leaving a screen | No drafts or state persistence | Interruptions, Zeigarnik |

## Step 4. Choose the right container (decision table)

Pick by the *relationship between pieces of content*, not by taste:

| The content is… | Use | Rules |
|---|---|---|
| **Independent top-level areas** used often (Home, Classes, Questions, Profile) | **Bottom tabs** | 3–5 tabs, nouns, each with its own stack. Never put actions in the tab bar |
| **2–4 parallel views of the same object** that users switch between (a class: Students · Tests · Schedule) | **Segmented control / top tabs** under the header | Equal importance, short labels, swipeable (pager). Keep the header (object name) fixed. Max 4 |
| **A hierarchy** (list → item → sub-item) | **Push navigation** (stack) | Large title on lists, back always available, ≤ 3 levels deep from a tab |
| **A short focused task** that returns to where you were (add student, filter, quick edit, pick a date) | **Sheet** (form sheet with detents) | Cancel/Done in the sheet header, ≤ 1 screen of content, never a sheet on top of a sheet |
| **A long task with dependent parts** (create exam, onboarding, register) | **Stepper flow** (one route per step) | 3–5 steps, ≤ 5 fields per step, progress "2 of 4", back keeps data, autosave draft, a **review step** at the end |
| **A summary of many modules** (dashboard) | **Summary cards + "See all"** | Each card shows 3 items max + a link to the full screen. Order by daily use |
| **Rarely needed details/settings** | **Disclosure row / "More options"** | Collapsed by default. Remember the expanded state only if it's used often |
| **Many items** (> ~15) | **List + search + filters (in a sheet) + sort** | Group by time/section headers, sticky search, remembered filters, a good empty state |
| **An irreversible or blocking decision** | **Alert dialog** | Only for destructive/irreversible actions. Otherwise use **undo** |
| **Secondary actions on an item** | **Swipe actions / long-press menu / ⋯ menu** | The primary action stays visible; the rest is one gesture away |

**Never:** tabs inside tabs (more than one level of in-screen tabs) · a modal over a modal · a hamburger hiding primary navigation · more than 5 horizontally scrolling tabs · carousels for important content · a "Settings" dumping ground for features.

## Step 5. Write the new map + screen specs (and get approval)

Restructuring changes navigation and muscle memory, so it is **hard to undo**. Present this to the user and wait for an OK before implementing.

**New map** (same tree format, with changes marked):
```
Tabs
├─ Home                      (+ "Continue" card, + today's tests)
├─ Papers
│   └─ Create exam  ▸ 1 Basics ▸ 2 Questions ▸ 3 Settings ▸ 4 Review & share   (stepper routes, draft autosaved)
└─ Profile
```

**Screen spec** (one per new or changed screen):
```
Screen: Create exam · Step 2 Questions
Who / job: Teacher, "When I set a test, I want to pick questions by chapter so the test matches what I taught."
Entry: Step 1 Next · Resume draft card on Home
Primary action: Next (bottom, disabled until ≥ 1 question, with a reason shown)
Secondary: Auto-pick 20 · Preview
Content (priority order): chapter chips → topic list with counts → selected count bar
States: loading (skeleton list) · empty (no questions for chapter → suggest another) · error (retry) · partial
Exit: Back (keeps selection) · Close (saves draft, confirms only if nothing is saved)
Principles: Chunking (one decision per step), Goal-gradient (2 of 4), Recognition (last chapters first)
```

Also give a **before/after task table**: taps, screens and decisions for each top task, before → after.

## Step 6. Implement incrementally

1. **One flow at a time**, starting with the highest frequency × severity. Keep the app shippable after each flow.
2. **Split files along the new map:** each step, tab or sub-screen becomes its own route/component file. Shared state lives in a small store/context or the route params, *not* in one 2,000-line component.
3. **Preserve behavior and data:** the same API calls and the same validation. Add draft autosave (secure store / async storage) for long flows.
4. **Keep deep links and notifications working.** Map old routes to new ones and update notification targets.
5. Remove dead modes, flags and state left behind by the split.
6. Use expo-navigation.md for the Expo Router recipes and the design system's components (e.g. the neobrutalism-expo kit) for every new screen.

## Step 7. Verify

- Re-walk the top tasks: **fewer taps/decisions, no dead ends**, and progress is visible in every multi-step flow.
- Re-run the structure audit: the flagged scores drop, and no new screen exceeds its budgets.
- Wayfinding on every screen (apple-design): *Where am I? Where can I go? What's here? How do I get out?*
- Interruption test: background the app mid-flow, return, and check that nothing is lost.
- First-use test: someone new completes the top task without help (or read it through as a first-timer).

## Worked examples (common shapes)

**A. The mega-modal** (one modal, many `step ===` modes, dozens of `useState`, several scroll areas)
→ A stepper of 3–5 routes in a modal stack: *Basics → Content → Settings → Review*. Each route owns ≤ 5 inputs. A shared draft in context, autosaved. Advanced settings go behind "More options" on the Settings step. The review step shows everything with "Edit" links back to each step. Success ends on a clear outcome screen (share code + "View test") — peak–end.

**B. The everything-object screen** (a class or batch page with students, tests, schedule, invitations, settings all stacked)
→ Header with the object name + key stats → **segmented control: Students · Tests · Schedule** (the 3 most-used views) → Invitations becomes a badge on Students ("3 pending") that opens a sheet → Settings moves to the ⋯ menu as a pushed screen.

**C. The long dashboard** (home showing every module in full)
→ Order: **Continue card** (Zeigarnik) → **Today** (due tests, next class) → 2 stat tiles → modules as summary cards (3 items + See all). Anything not used weekly leaves Home.

**D. The task-runner screen** (taking a test: question, options, palette, timer, flags, submit in one view)
→ Keep the question + options as the screen. Move the palette into a **bottom sheet** opened from a "12/30" pill. Put the timer as a calm pill in the header. Flag sits as an icon next to the question number. Submit goes on the last question and in the palette sheet → a **review screen** (unanswered/flagged count, "Go to Q7") → confirm → results. One scroll area, the primary action at the bottom.

**E. The filter wall** (8+ chips/dropdowns above a list)
→ Search field + one row of the 3 most-used filters + a "Filters (2)" button that opens a sheet with the rest. Remember the filters per screen and show active filters as removable chips.
