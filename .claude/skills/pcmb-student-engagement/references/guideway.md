# Guideway: in-app guides that show how each feature works

Guideway is the app's **own** guide system: a spotlight on the real control plus a short step card. It's built in-house, with no third-party tour library, so it:
- matches the neobrutalism student look (and the classic teacher look)
- adds no native dependency and is safe on Expo SDK 58 / the New Architecture
- respects Reduce Motion and screen readers

It ships in **Phase 1** (with the redesign), and **every feature from Phase 2 on ships with its guide** (§4).

## 0. Principles (how people actually learn an app)

1. **At the moment of need.** A guide starts the first time someone reaches that feature, on that screen. There's no long tour at first launch; people skip those and forget them.
2. **Short.** Use 1–4 steps. Each step has a title of 2–5 words and a body of at most 2 short sentences (about 20 words), verb first ("Tap Start to…"). Every step points at a real control.
3. **Always skippable.** "Skip" is on every step. Android Back goes to the previous step, and closes the guide on the first step. A guide never blocks the app for more than one tap.
4. **Learn by doing.** Where it makes sense, the last step is "Try it": the target stays live, and the guide ends when the user taps it.
5. **One thing at a time.**
   - Guides and celebrations share one queue. Celebrations go first, because they were earned.
   - A guide shows only when the screen is idle: no sheet or modal open, nothing loading, no question mid-answer.
   - At most **one guide per screen visit and two a day** start on their own. Guides the user opens themselves don't count.
6. **Never in tests.** Nothing appears in the runner or the paused screen. The test ready check has its own short guide **before** the first secure test.
7. **Replayable.** Screens with a guide have a small "?" in the header, and Profile → **Help & guides** lists every guide for the role with "Show me".
8. **Remembered across devices.** Seen guides are saved on the phone (`services/preferences.ts`) and synced to the server once settings exist (`settings.guidesSeen` on the engagement profile, or the teacher's user settings). A reinstall never replays them.
9. **Versioned.** Every guide has a `version`. When a feature changes meaningfully, bump it and the guide shows again as **"What's new"**, with only the changed steps.
10. **Accessible.**
    - With Reduce Motion on, the spotlight jumps instead of animating.
    - Screen readers announce each step and move focus to the card. The target's own label is read too.
    - The card works at the largest font size and on a 320px phone; the target scrolls into view first.
11. **Same voice.** Copy follows student-psychology.md's voice guide (teacher guides are plainer and shorter). No hype, at most one emoji, nothing about other students' marks.
12. **Feature-aware.** Show guides only for features that are on. With engagement off, engagement guides never show.

## 1. Architecture (`src/guideway/` in pcmb-paper)

| File | Job |
|---|---|
| `registry.ts` | every guide as data (below); the one place copy lives |
| `guideway-logic.ts` | **pure, unit-tested**: `eligible(guide, ctx)`, `pickNext(queue, ctx)`, `placeCard(…)`, `seenKey(id, version)`, the daily cap |
| `guideway-provider.tsx` | seen state (load and save), the shared queue with celebrations, the current guide and step; `start(id)`, `next()`, `back()`, `skip()`, `finish()`; analytics events |
| `guide-target.tsx` | `<GuideTarget id="today5.start">…</GuideTarget>` registers a ref; measured with `measureInWindow` only when its step is shown (after layout and scroll) |
| `guide-overlay.tsx` | a transparent `Modal`: the dim layer as **4 rectangles around the target** (no SVG mask needed), a 2px ink outline + hard shadow around the hole, an arrow, and the step card (title, body, step dots, Back / Next / Skip) |
| `use-guide-trigger.ts` | `useGuideTrigger('today5', { ready })` on a screen asks to show the guide when it's eligible |
| `help-guides-screen.tsx` | Profile → Help & guides (per role) |

The look follows the active design scope: neobrutalism components for students (Card, PressableNeo, hard shadow), and the classic kit for teacher and tuition logins.

```ts
// src/guideway/registry.ts: guides are data, so copy and order change without touching screens.
export type Role = 'student' | 'teacher' | 'tuition';
export type GuideStep = {
  target: string;                         // a GuideTarget id on this screen; omit for a centered card
  title: string;                          // 2–5 words
  body: string;                           // ≤ 2 short sentences
  tryIt?: boolean;                        // last step only: the target stays live; tapping it finishes the guide
};
export type Guide = {
  id: string;
  version: number;                        // bump when the feature changes → "What's new"
  roles: Role[];
  screen: string;                         // the route where it can start
  feature?: 'engagement' | 'secure-tests'; // hidden when that feature is off
  steps: GuideStep[];                     // 1–4
};

export const GUIDES: Guide[] = [
  {
    id: 'today5',
    version: 1,
    roles: ['student'],
    screen: '/(tabs)/home',
    feature: 'engagement',
    steps: [
      { target: 'today5.card', title: "Today's 5", body: 'Five questions picked for you every day: weak topics, old mistakes and what you studied in class.' },
      { target: 'progress.goal', title: 'Fills your goal', body: 'Every answer adds XP to your daily goal. About 6 minutes is enough.' },
      { target: 'today5.start', title: 'Try it now', body: 'Tap Start for your first set.', tryIt: true },
    ],
  },
];
```

```ts
// src/guideway/guideway-logic.ts (part): where the step card goes. Pure, so it's property-tested.
export type Rect = { x: number; y: number; width: number; height: number };
export type Placement = { x: number; y: number; side: 'above' | 'below' };

/** Puts the card below the target if it fits (or there's more room below), otherwise above; always inside the gutters. */
export function placeCard(
  target: Rect,
  card: { width: number; height: number },
  screen: { width: number; height: number },
  insets: { top: number; bottom: number },
  gap = 12,
  gutter = 16,
): Placement {
  const spaceBelow = screen.height - insets.bottom - (target.y + target.height);
  const spaceAbove = target.y - insets.top;
  const below = spaceBelow >= card.height + gap || spaceBelow >= spaceAbove;
  const y = below
    ? Math.min(target.y + target.height + gap, screen.height - insets.bottom - gutter - card.height)
    : Math.max(insets.top + gutter, target.y - gap - card.height);
  const x = Math.min(Math.max(gutter, target.x + target.width / 2 - card.width / 2), screen.width - gutter - card.width);
  return { x, y, side: below ? 'below' : 'above' };
}
```

The caller sets the card width to `min(screen width − 32, 360)` and measures its height before placing it. If the target is off-screen, scroll it into view first. If a target can't be found within 1 s, skip that step; skip the whole guide if no target was found. A missing target must never block the user.

**Eligibility** (`eligible`) is true only when **all** of these hold:
- the role matches and the feature is on
- the guide (at this version) hasn't been seen
- the user is on the guide's screen and the screen is idle
- there's no test attempt running or paused, and no celebration queued
- fewer than 2 automatic guides have run today, and none has run on this screen visit

A manual start ("?" or Help & guides) skips only the seen check and the daily cap.

## 2. Analytics

Events: `guide_started`, `guide_step` (index), `guide_completed`, `guide_skipped` (at step n), `guide_replayed`. Add them to the AppEvent collection (metrics.md).

Track per guide:
- the completion rate
- the **step-1 skip rate**: above 50% means the guide is annoying or too long, so shorten it
- feature adoption for users who finished the guide vs. users who skipped it

## 3. Teacher and tuition guides

These use the same engine in the classic look, with plainer copy and at most 3 steps. They mostly cover tools a teacher uses rarely and must get right the first time: creating a challenge, choosing a test security level, re-admitting a student, the integrity review and exam dates.

## 4. Guide catalogue (one per feature; build it in the same phase)

| Phase | Guide id | Who | Starts when | Steps |
|---|---|---|---|---|
| 1 | `progress-header` | student | first Home visit after Phase 1 ships | streak (freezes) · goal ring · level chip |
| 1 | `help-guides` | all | first Profile visit | where Help & guides lives (1 step) |
| 2 | `today5` | student | first time the Today's 5 card shows | the card · it fills your goal · Try it: Start |
| 2 | `mistakes` | student | first mistake saved | where mistakes go · the dots (boxes) · Revise due |
| 2 | `daily-goal` | student | first goal completion | choose your goal (Chill → Beast) · changes apply tomorrow |
| 2 | `reminder` | student | settings, first open | one reminder a day, at your time, only if the goal isn't done |
| 3 | `roadmap` | student | first Roadmap visit | subject switch · chapter states · You are here · Next 3 and their reasons |
| 3 | `outlook` | student | first time expected marks show | countdown · the estimate range (and why it's an estimate) |
| 3 | `exam-dates` | tuition | first visit to exam settings | set dates per program · students see the countdown |
| 4 | `levels` | student | first level-up | titles · cosmetics in Profile |
| 4 | `badges` | student | first badge earned | shelf · locked badges show progress |
| 5 | `league` | student | first league card | your rank this week · resets Monday · hide yourself |
| 5 | `batch-engagement` | teacher | first visit to the Engagement view | tiles · "not active for 3+ days" · send a shout-out |
| 5 | `create-challenge` | teacher | first tap on New challenge | template → target → dates → reward |
| 6 | `duels` | student | first visit to Duels | pick a batchmate · same 5 questions · 24 hours |
| 6 | `squads` | student | first visit to Squad | squad goal · nudges are preset messages |
| 7 | `recap` | student | first Monday recap | tap to advance · share shows only your stats |
| 8 | `ready-check` | student | before the first secure test (on the test card) | what's checked · Fix it buttons · what pauses a test · "Ask my teacher" |
| 8 | `test-security` | teacher | first time creating a test after Phase 8 | the levels · shuffles · resume code |
| 8 | `readmit` | teacher | first "Waiting for you" in the live monitor | the timeline · Let back in / new phone / + minutes · bulk resume |
| 8 | `integrity-review` | teacher | first integrity tab | flags are prompts, not proof · Looks fine / Don't count / Retake |

## 5. Definition of done (for every feature from Phase 2)

- [ ] The guide is in the registry with copy that passes the voice guide (read it aloud: does it sound like a helpful senior?).
- [ ] Every step's target is wrapped in `GuideTarget`, and the trigger is on the screen.
- [ ] It works at max font size, on a 320px phone, in dark mode, with a screen reader and with Reduce Motion on.
- [ ] Unit tests: eligibility and placement (testing.md M14). System test: a Maestro flow checks that the first visit shows it, Skip works, Back works, and it replays from Help & guides.
- [ ] Analytics events fire.
