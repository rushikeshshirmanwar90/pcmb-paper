# UX-1 — Student Tests

_Date: 2026-10-27 · Branch `feature/ux1-student-tests` in both repos (mobile from `HEAD` = `origin/main`; backend from `origin/main`) · Not committed, pushed or deployed._

Implements plan items **S-1, S-2, S-3, S-6** from `UX_IMPROVEMENT_PLAN.md`, following the apple-design guidelines (cited below) on top of the existing warm theme and kit. Scoring, submission, resume and the question order are unchanged. Autosave still sends changes 0.8 s after the last change; it now retries a save that fails.

## 1. Changes implemented

### Tests screen (`student-tests.tsx`)
- Three sections: **To do · n**, **Upcoming · n**, **Past tests**.
- **To-do cards**: subject icon, title, subject and teacher, a facts line ("30 questions · 60 min · 120 marks · −1 per wrong answer"), the closing time ("Closes in 3 h" in amber with an hourglass when under a day), a status badge (In progress / Not started) and one action: **Start test**, **Continue test** or **Open test**.
- Only the most urgent card gets the filled button; the others use a quieter *tonal* button (`buttons.md › Style`: "Keep the number of prominent buttons to one or two per view").
- Sort order: in progress first, then the one closing soonest.
- **Upcoming**: scheduled tests with "Opens tomorrow, 9:30 AM · in 18 h". Read-only, with a screen-reader explanation.
- **Past tests**: compact rows with score, a % badge in the teachers' bands (≥70 % green, <40 % red), Missed / Closed badges, and "view results" / "see answers".
- Status is recomputed every 30 s on the phone, so a test moves from Upcoming to To do (or closes) without a refresh.
- Empty state "You're all caught up", which names the next opening time when one is known.

### Test runner (`test-runner.tsx`)
- **Intro**:
  - subject tile and title
  - a 2×2 facts grid (questions, time limit, total marks, marks per question)
  - a plain sentence on negative marking and closing time
  - a warning when the test closes before the full time limit (this uses the server's existing deadline rule)
  - "Before you start" tips
  - one Start test button
- **Header**: Leave button (with confirmation), title, and a **timer pill**. The pill turns amber from 5 min and red from 1 min; the digits always carry the meaning, and screen readers hear "Time left, 4 minutes 32 seconds".
- **Status bar**:
  - "Question 7 of 30"
  - the **save status** (below)
  - an **All questions 18/30** toggle
  - an answered-progress bar
- **Question palette**:
  - a summary ("18 answered · 12 not answered · 3 marked")
  - a legend
  - 44 pt cells where answered = filled, not answered = outline, current = thick border, marked = bookmark badge (shape, not only colour: `accessibility.md › Vision`)
  - full spoken labels per cell
- **Question**: "Q7 · Chapter" with the marks it carries (+4 / −1). Options are 56 pt tall with 2 pt selected borders, a filled key, a check mark and a "tap again to clear" hint. There is also a **Clear answer** button.
- **Mark for review** toggle (checkbox role). Marks are kept on the phone for the app session and survive leaving and re-entering the test.
- **5-minute and 1-minute warnings**: an inline, dismissible notice (auto-hides after 10 s) plus a screen-reader announcement. Not an alert, per `alerts.md › Best practices`: "Avoid using an alert merely to provide information". On resume with less time left, one warning shows once.
- **Footer**: Previous / Next. On the last question Next becomes **Submit test**, and a quiet "Submit test" link is otherwise always there. The submit confirmation now also states the marked-for-review count.
- **Android back / Leave**: a "Leave the test?" confirmation whose wording follows the real save state. Before, the back button did nothing. Leaving saves whatever is pending.
- Content stays phone-width and centred on tablets; `KeyboardAvoidingView` covers numerical answers on iOS.

### Answer-save feedback (`answer-saver.ts`, new)
The autosave logic moved into a small React-free module so it can be tested.

| What | Before | Now |
|---|---|---|
| Status shown | None | **All answers saved** / **Saving…** / **Not saved yet · Retry** (tap to retry now) |
| Failed save | Re-queued, but only resent on the *next* answer change | Retried automatically after 2 s, 5 s, 10 s, then every 20 s |
| Requests | Could overlap | One at a time; changes made meanwhile go in the next request |
| Values sent | Values at the time of the change | Each request reads the latest answers, so a retry never resends a stale one |
| Leaving the screen | Pending changes dropped | Pending changes are sent |

The error state stays visible until a save actually succeeds. Submission still sends every answer.

### Results
- Success notice "Test submitted" straight after submitting (`feedback.md`: confirm significant actions).
- **Score card**: score / max (44 pt), a % badge, a right/wrong/skipped bar with a spoken label, marks gained and lost, accuracy of answered questions, and time taken.
- **Right / Wrong / Skipped** tiles; Wrong now uses the danger tone and Skipped a neutral one.
- **All · Wrong · Skipped** segmented filter with counts (`segmented-controls.md`: closely related views, at most five segments on iPhone).
- Each question gets an outcome badge (Right · +4 / Wrong · −1 / Skipped · 0). Options say **"Your answer"** / **"Correct answer"** in text, not only in colour.
- Solutions start open under Wrong and Skipped, and collapsed under All.
- Empty filters ("No wrong answers").
- A test that closed without an attempt shows an info notice instead of a score.
- Numerical answers use the server's verdict, so "2.0" vs "2" is no longer marked wrong.

### Student Home (`student-home.tsx`) — label fix only
- Home now also loads the student's test list (existing API) with the overview. In-progress tests show **Continue test**; if that list fails to load, Home shows a neutral **Open test** instead of guessing.
- The section uses the new test cards; the rest of Home is unchanged.

### Shared kit (`kit.tsx`), additive only
- `Button` gets a `tonal` variant and an `accessibilityLabel` prop.
- `StatTile` gets `danger` and `neutral` tones.
- New `Segmented` control (tablist/tab roles, 46 pt).
- New `Notice` component (info / success / warning / danger, optional 44 pt dismiss, live region).

### Backend (`papers`)
`GET /api/tests?upcoming=1` also lists a student's scheduled tests, as summaries only. Opening one (404) or starting one (400) early is still refused, so no question or solution leaks. The flag is opt-in, so older app builds (which would list them as "Missed") are unaffected.

## 2. Features added
Upcoming tests · urgency sorting and closing countdowns · score % on past tests · test intro facts and short-time warning · mark for review · question palette legend and states · Clear answer · accurate save status with automatic retry · 5 / 1-minute warnings · leave with confirmation · results filters, outcome badges, score bar and accuracy · "Test submitted" confirmation.

## 3. Files modified

| Repo | File | Change |
|---|---|---|
| pcmb-paper | `src/screens/student/student-tests.tsx` | Rewritten list: cards, sections, rows |
| | `src/screens/student/test-runner.tsx` | Intro, runner, palette, warnings, leave, results |
| | `src/screens/student/question-view.tsx` | Option design, text tags, `solutionOpen`, `answerCorrect` (PYQ practice benefits; its behaviour is unchanged) |
| | `src/screens/student/student-home.tsx` | Continue/Start fix only |
| | `src/screens/student/answer-saver.ts` | **New**: autosave module |
| | `src/screens/student/test-format.ts` | **New**: status, ordering and label helpers |
| | `src/components/kit.tsx` | Additions listed above |
| | `src/services/student-api.ts` | `tests()` asks for upcoming tests |
| | `tests/student-tests.test.mjs` | **New**: focused unit tests |
| papers | `src/app/api/tests/route.ts` | `?upcoming=1` for students |
| | `tests/ux1-student-tests.test.ts` | **New**: route tests |

No other role screens, navigation, packages or dependencies were changed.

## 4. Test results

| Check | Result |
|---|---|
| Mobile `npx tsc --noEmit` | Pass |
| Mobile `npx expo lint` | Pass (0 errors, 0 warnings) |
| Mobile unit tests: `node --experimental-strip-types --test tests/student-tests.test.mjs` | **18/18 pass**: 10 autosave (debounce, batching, backoff, latest-value retry, one-at-a-time, pause on submit, unsent on leave) and 8 list rules (incl. the in-progress → Continue case) |
| Mobile Android bundle: `npx expo export --platform android` | Builds |
| Backend `npx tsc --noEmit` and ESLint on changed files | Pass |
| Backend `npm test` (all suites) | **70/70 pass**, incl. 6 new: default list unchanged; upcoming listed for own batch only; no questions or solutions in the list; scheduled test still 404 to open and 400 to start; teacher lists unaffected |
| Contrast (WCAG, computed) | New text pairs ≥ 4.5:1, or ≥ 3:1 for bold text (`accessibility.md › Vision`), in light and dark. Unselected segment labels were raised from 3.91 to 7.15:1 |

## 5. Follow-up fixes (UX-1 finish)

Two limitations from the first pass are fixed. Mobile only; no backend, navigation, scoring, timer or UI-layout changes.

**Pending answers on leaving**
- Leave now waits for the final save's result (`AnswerSaver.settle()`): it sends immediately and waits for any save already on the way. It returns `true` only when the server confirms every answer.
- If that save fails, the app says so ("Some answers aren't saved") instead of closing silently. The student chooses **Cancel** to stay and keep retrying, or **Leave anyway**. The message is honest about what happens next:
  - the answers are kept on this phone and sent when the test is reopened, and only server-saved answers count if time runs out first; or
  - if even the phone couldn't store them, they may be lost.
- Unconfirmed answers (not sent, or still on the way) are also written to the phone shortly after every change and when the screen closes. A killed or crashed app therefore loses nothing either.
- On reopening, the stored answers are restored and re-sent, unless the student has changed that question since opening.

**Mark for review persists**
- Marks are stored with the unconfirmed answers as a small JSON file in the app's documents folder (`expo-file-system`, already used by My PDFs; web: `localStorage`). No new dependency. Not `expo-secure-store`: a long test's draft can pass its ~2 KB value limit (about 33 bytes per unconfirmed answer), and drafts hold nothing secret.
- The draft is keyed per **user and test** (`pcmb.attempt.<userId>.<testId>`, also the file name) and stamped with the attempt's `startedAt`, so a draft from another attempt is ignored. Writes to one key are serialised. Damaged data is discarded.
- The draft is cleared after a successful submission, and whenever the test opens as already submitted (including when time ran out while away).

**Files**
- `src/screens/student/answer-saver.ts`: adds `settle()` and `unconfirmed()`.
- `src/screens/student/attempt-draft.ts` (**new**, pure): key, encode, validated decode.
- `src/services/attempt-store.ts` (**new**): storage in `Paths.document/attempt-drafts/<key>.json`.
- `src/screens/student/test-runner.tsx`: restore, persist, safe leave, clear on submit; the in-memory marks map is removed.
- `tests/student-tests.test.mjs`: +8 tests.

**Results:** unit tests **26/26 pass** (adds final-save success, failure, waiting for an in-flight save and unconfirmed tracking, plus draft scoping, attempt check, corrupt-data handling and empty-draft removal). `tsc` passes, `expo lint` reports 0 problems, and the Android bundle builds.

## 6. Remaining limitations
- **Not checked on a device or simulator.** Verified by types, lint, unit tests and a production bundle only; a visual pass on iOS and Android (including the largest text size) is still needed.
- Review marks and unconfirmed answers are per device: they don't follow the student to another phone.
- If time runs out while the student is away, answers kept only on the phone are not included. The server finalises with what it has; the app warns about this before leaving.
- **Home makes one extra request** (`/tests`) to know attempt states. Adding the attempt state to `/student/overview` (a small backend change) would remove it.
- **Upcoming tests are visible to students as soon as they are scheduled**, with title, subject and time only. If teachers want unannounced tests, a per-test "show in advance" option would be needed (product decision).
- No haptic feedback for the time warnings: that would need `expo-haptics`, a new dependency.
- Exam security (blocking app switching, screenshots and so on) is out of scope, as agreed. "Leave test" is deliberately allowed, matching the existing "timer keeps running if you leave the app" behaviour.
