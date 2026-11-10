# The student app experience (and the teacher additions)

Where every feature lives, how it looks and moves, and how it plugs into the app's current structure. Names below come from the saved map (discover.md §4). Don't scan to confirm them; if a file isn't where the map says, ask the user before looking (discover.md §1).

Skill hand-offs:
- **Look:** neobrutalism-expo for the **student login** (set up in Phase 1; scoped-adoption.md). Teacher and tuition keep the classic kit.
- **Guides:** every feature ships with its Guideway guide (guideway.md). Wrap the controls its steps point at in `GuideTarget`.
- **Behavior:** app-interactions (states, skeletons, motion budget, haptics, responsive) for every new screen.
- **Structure:** human-friendly-ux (one job per screen, ≤ 5 tabs, progressive disclosure). Run its per-screen checklist.
- **Graphics:** canvas-design + neobrutalism-expo graphics.md (App Art Contract, `export_assets.py`).

## 1. Information architecture (student, 5 tabs, unchanged count)

Phase 1's structure redesign (SKILL.md, Phase 1 rules) builds this layout first, with empty slots hidden until each feature ships. If the human-behaviour analysis suggests a better arrangement, propose it to the user; this table is the default, not a constraint.

| Tab | Becomes | Contents (top → bottom) |
|---|---|---|
| **Home** | "Today" | progress header (streak · goal ring · level) → **Next up** (a test due today always wins) → Today's 5 (F2) → Mistakes due (F3, if any) → teacher shout-out / batch challenge (F8, if any) → league snapshot (F7) → today's classes → announcements. **Max 6 blocks visible**; the rest are behind "More" |
| **Tests** | unchanged | teacher tests. Results screens gain the post-release XP / personal best card |
| **Syllabus** | **Roadmap** (rename the label) | exam countdown + expected marks (F5) → "Next 3 for you" → subject switcher → chapter path (F4) |
| **Practice** | the practice hub | Today's 5 · Mistakes · Duels · Squad · Practise by topic · Self-assessment |
| **Profile** | "You" | level card + frame · badges shelf (F6) · stats · squad · settings (goal, practice reminder + time, event notifications, league visibility, duel invites, weekly recap, vibration, reduce motion) · account |

New routes, each its own file (human-friendly-ux → expo-navigation.md): `engagement/progress` (sheet) · `engagement/daily` (focused session, full screen) · `engagement/revision` · `engagement/league` · `engagement/badges` · `engagement/duels/[id]` · `engagement/squad` · `engagement/recap` (story, full screen) · `engagement/celebrate` (transparent modal for level-up/badge moments).

**Tests stay sacred:** the ready check, the secure test runner and the paused screen get **no** engagement UI: no header, toasts, celebrations or nudges. Engagement resumes on the results screen. Every test screen follows secure-tests.md.

## 2. Client architecture

- **API:** add an `engagementApi` beside `studentApi` (same `api-client.ts` conventions), typed from the backend responses.
- **State:** an `EngagementProvider` near the student root holds `me` (XP, level, today, streak, settings) loaded with the app's existing `useLoad`. Every learning response that carries `engagement` updates it in place, so the header updates without refetching.
- **Celebrations queue:** `levelUp`, new `badges`, goal completion and streak milestones from responses go into one queue and play **one at a time, after the current interaction**, never mid-question. Store "seen" ids so a reinstall doesn't replay them.
- **XP toasts:** merge awards within 2 s ("+27 XP · 3 answers"), at most one visible, above the tab bar (app-interactions `ToastProvider`).
- **Offline:** practice answers already queue and sync (`answer-saver.ts`). XP and goal changes appear when the server confirms. Never estimate XP on the device.
- **Feature flag:** if `me.enabled === false` (tuition switched it off), hide every engagement surface and keep the old screens.

### Local daily reminder (gentle policy)

```ts
// services/engagement-reminder.ts: at most one local reminder per day, at the student's time, only on days the goal isn't met.
import * as Notifications from 'expo-notifications';

const PREFIX = 'engagement-daily-';
const DAYS_AHEAD = 3;                                         // keeps nudging for a few days even if the app isn't opened

const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Re-arms the next reminders. Call on app start/foreground, when settings change, and when today's goal is met.
 * Uses one-off DATE triggers (not a repeating DAILY trigger), so a met goal really cancels today's reminder.
 */
export async function armReminders({ enabled, time, goalMetToday, copy }: {
  enabled: boolean; time: string; goalMetToday: boolean; copy: { title: string; body: string };
}) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  if (!enabled) return;
  const [h, m] = time.split(':').map(Number);                 // 07:00–21:30, validated by the server (quiet hours)
  const now = new Date();
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m);
    if (i === 0 && (goalMetToday || at <= now)) continue;    // goal done or time passed: skip today
    await Notifications.scheduleNotificationAsync({
      identifier: PREFIX + localDate(at),
      content: { title: copy.title, body: copy.body, data: { route: '/engagement/daily' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  }
}
```

Verify the trigger API against the Expo SDK version in `package.json` (AGENTS.md: Expo changes every SDK) and reuse the patterns already in `services/notifications.ts` (class reminders). Copy comes from the server (`me.reminderCopy`), so it's personal ("Today's 5 are ready, about 6 min · Kinematics first").

## 3. Screen specs (student)

Build these with the neobrutalism-expo components named here (available from Phase 1).

- **Progress header:** three `PressableNeo` chips in a row (streak flame + count · goal ring with "60/100" · level chip "L12") on the canvas. On small phones, the level chip collapses into the goal ring's sheet.
- **Today's 5 card:** a `Card` in `highlight` tone: "Today's 5 · ~6 min", subject tags, a primary "Start" button. Completed → `successSoft` with ✓, the score and tomorrow's teaser.
- **Daily / revision session:** reuse `question-view.tsx` inside the neo `AnswerOption` styling. A top progress bar ("3/5"), instant feedback (app-interactions answer feedback), the explanation, then "Next". The end screen uses the Results archetype (patterns.md) with a `CountUp` of XP.
- **Roadmap path:** a vertical list of chapter nodes connected by a thick 2px ink path line. Each node is a `PressableNeo` circle (mastery ring as an SVG arc), with chapter name + weightage `Tag` beside it. The "You are here" marker is a sticker-style pin. Milestone markers are `Sticker`s between nodes. The subject switcher is a `Segmented` control. "Next 3 for you" is a `Card` with 3 `ListRow`s, each with a reason line.
- **League:** a `Card` table: rank, avatar, name, level chip, weekly XP. "You" is highlighted with `primarySoft`, and the top 3 get medal tags. A countdown chip ("ends Sun 11:59 PM"). Hidden state explained in an `Alert`.
- **Badges shelf:** a `Grid` of 3 (compact) / 5 (expanded) badge tiles. Locked tiles show a grey silhouette + a progress bar + criteria.
- **Weekly recap:** full-screen story slides (tap to advance, swipe down to close, auto-advance off), each a big number + one sentence + one small illustration. The last slide is "This week's plan" with buttons into the roadmap.
- **Celebrate modal:** a transparent backdrop, centered art (play-once), title, one line, a "Nice!" button. Auto-dismisses only if reduced motion is on.

Empty, loading and error states for every screen per app-interactions (skeleton rows shaped like the real list).

## 4. Motion graphics plan (within the motion budget)

| Moment | Motion | Asset |
|---|---|---|
| XP gain | toast slides up, the number counts | code |
| Goal ring completes | ring fills to full, a check pops, haptic `success` | code (SVG arc) |
| Streak secured (once a day) | flame bumps ±3°, the count pops, haptic `bump` | flame: small play-once animated WebP (≤ 600 ms) |
| Level up | full-screen title card, rotated sticker drops in | per title tier (8 pieces): canvas-design art, still + play-once |
| Badge unlocked | bottom sheet + badge pops (gold/legend: play-once animation) | one still per badge tier; animations for gold/legend only |
| Chapter mastered | node fills, a sparkle doodle appears once | code (SVG) |
| Milestone on the path | sticker drops in once | 4 milestone stickers |
| Daily 5/5 | "Perfect Five" sticker | 1 sticker |
| Weekly recap | slide transitions (spring.settle), numbers count up | 5 small spot illustrations |
| League top 3 (Monday) | medal tag pops | code |

Rules: one celebration at a time, queued after the interaction; nothing loops; reduced motion shows the final frame; **nothing plays in tests**; the art follows the App Art Contract (preset colors, ink outline, hard shadow, no text in images, original). Budget: all engagement art ≤ 1.5 MB total in the bundle.

## 5. Teacher additions (classic look, teacher/tuition logins)

- **Batch screen → "Engagement"** (a new segment beside the existing views): KPI tiles (active this week, average streak, daily-challenge completion %), a "Not active for 3+ days" list with a "Send shout-out" action, the mastery heatmap per chapter, and "most-missed questions" (anonymous counts).
- **Challenges:** a stepper sheet (template → target → dates → reward). Active challenges show progress.
- **Shout-out:** from a student row (template picker + optional short note).
- **Tuition profile:** exam dates per program (F5) and an "Engagement features" on/off switch.
- Classic kit only (no neo leak); app-interactions states apply.

## 6. Accessibility and inclusion

- Every celebration has a text equivalent announced to screen readers ("Level 12 reached, Compound").
- Streak, goal ring and mastery rings carry numbers, not only color.
- Leaderboards use names as the students set them; avatars are initials or pastel illustrations (no photo requirement).
- Copy works for students who are behind: no "everyone else has finished".
