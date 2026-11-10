# Secure tests: stop cheating, stay fair, let teachers re-admit

Read this before touching anything in the teacher-test flow: creating a test, the ready check, the runner, the paused screen, the live monitor, results. How to build it is in `secure-tests-build.md`.

## 0. Principles

1. **Layers, not one lock.** No phone app can make cheating impossible (a second phone or a helper exists). Combine four layers: **lock** the phone down, **detect** what can't be locked, make shared answers **useless** (shuffles, sets, watermark), and **review** afterwards.
2. **The server judges, the phone reports.** The clock, deadline, strikes, pauses and every decision live in `papers`. The app reports evidence and shows the state. A modified app must never be able to unpause itself, skip tracking or extend time.
3. **Pause, never punish automatically.** A tripped rule *pauses* the attempt (answers saved, time frozen). Only a teacher resumes, ends or voids it. After-test signals (similar answers, odd speed) are "worth a look", never verdicts.
4. **Fair to honest students.** Phone calls, a dead battery, bad internet and an auto-locking screen happen. They pause the test, the teacher lets the student back in with one tap, and nothing saved is lost.
5. **Minors.** No audio, no face recognition, no tracking outside the test. Camera snapshots only in the opt-in Proctored level with verifiable parental consent (§8).
6. **Calm words.** "Test paused", never "cheating detected". No engagement UI, toasts, celebrations or nudges anywhere in the ready check, runner or paused screen (SKILL.md rule 4).

## 1. What exists today (updated 10 Nov 2026, after merging main: pcmb-paper `b58c835`, papers `4ef0f38`)

Work from this table. Don't re-read the test code unless the user asks (discover.md, code access).

| Area | Today | Where |
|---|---|---|
| Clock and deadline | the app shows time by the server's clock; the deadline and auto-submit are server-side. At close, expired unfinished attempts are finished; **a paused attempt keeps the room pending (`pendingResolution`) until a teacher decides**: suspensions are no longer auto-submitted at release | papers `lib/attempts.ts` (`deadlineOf`, `finalize`, `finalizeExpired`), `lib/test-completion.ts` (`completionReleased`); app `exam-guard.ts` (`skewOf`, `secondsLeft`) |
| Leaving the app | heartbeats every 2 s (`HEARTBEAT_MS`). **Only an observed app backgrounding counts** (`AppState` → `background`, via `trackAppBackground`). Inactive, Android focus loss, screen blur, split-screen and heartbeat silence no longer pause; the app reports only `app-background` interruptions, and the server ignores any other reason for pausing. More than 10 s in the background pauses the attempt (`suspendedAt`, `endedReason: 'violation'`, `remainingMs` frozen). A heartbeat gap alone is not evidence | app `exam-app-state.ts`, `exam-visibility.ts`, `use-exam-visibility.ts`; papers `lib/attempt-visibility.ts` (`reconcileVisibilityLocked`, `reportVisibility`), `lib/exam-visibility-policy.ts` (`VISIBILITY_GRACE_MS = 10_000`) |
| Split-screen | Start is disabled while the phone reliably reports split-screen; during the test, split-screen blocks answering behind a notice ("does not count as leaving the app; the timer keeps running") | `test-runner.tsx`, `exam-security.ts` |
| One session | `clientId` + sequence per run, retired clients ignored, `resumeVersion` generations stop stale reports | same as Leaving the app |
| Answers | **versioned answers**: `start` with `answerVersions: true` sets `versionedAnswers`; each saved answer carries a `version`; saves and submit send `baseVersion`; a stale save gets 409 ("An answer changed on the server"), then the app refreshes status and merges (`restorableAnswers`, `mergeSavedAnswers`) without losing unsaved edits. `submitAnswers` saves the last answers and scores in one transaction under the test lock. Drafts survive kills (`attempt-store`, `attempt-draft`); saving waits until the draft is restored | app `answer-sync.ts`, `answer-saver.ts`, `attempt-store.ts`, `attempt-status.ts`, `test-runner.tsx`; papers `lib/attempts.ts` (`saveAnswers`, `submitAnswers`), `models/TestAttempt.ts` |
| Capture | `preventScreenCaptureAsync` while running (Android FLAG_SECURE; iOS blocks screenshots on 13+ and recordings) | `test-runner.tsx` |
| Android extras | hides other apps' overlays (12+), reads split-screen/PiP, Back blocked while running | `modules/exam-security` (Kotlin), `exam-security.ts`, `exam-guard.ts` |
| Paper safety | questions only from start; answers and solutions only after close and release; release waits for paused attempts | `questionsFor`, `attemptOut`, `lib/test-completion.ts` |
| Restricted tests | non-assigned students request access, the teacher approves; start re-checks access and the opening time inside the lock | `test-access.tsx`; papers `lib/test-access.ts` |
| Teacher test management | edit and cancel only while the test is scheduled and nobody has started (checked under the test lock); edited questions must be bank questions in the batches' shared scope; creating is idempotent (`requestId` + body fingerprint; a different body with the same id gets 409) | papers `app/api/tests/route.ts`, `app/api/tests/[id]/route.ts`, `lib/tests.ts`; app `create-test/*`, `test-management*.ts(x)` |
| Teacher controls | live monitor (15 s polling, Violations filter, `pendingResolution` count); per student: **Extend**, **Resume** (same attempt, answers and remaining time restored), **Finalize**; idempotent `requestId`, audit in `controls` | `test-monitor*.ts(x)`, `attempt-controls.tsx`; papers `lib/attempt-control.ts`, `lib/test-monitor.ts` |
| Engagement (Phase 0) | test XP is **participation only** (80, once per student and test, key `test:<sid>:<testId>`), awarded **after the test lock** on every finish path: submit route, `finalize()`, `recordEvent`, teacher Finalize, End test, `completionReleased`, and a visibility report after the student's time ran out. Never for a paused attempt. No engagement UI in any test screen: the submit response's `engagement` field goes to the progress store inside `student-api.ts`; `test-runner.tsx` doesn't read it | papers `lib/engagement/rules.ts` (`testEngagement`); app `services/engagement-api.ts` (`withEngagement`) |
| Tests | papers: `phase2b-secure-exam`, `phase2c-live-monitor`, `phase2-individual-controls`, `test-access-phase1`, `engagement-routes` (finish-path XP); app: `secure-exam`, `exam-security`, `exam-visibility`, `exam-app-state`, `answer-sync`, `attempt-store` (`.test.mjs`) | |

**Gaps this file closes**
- Nothing keeps the screen awake, so an auto-locking phone pauses an honest student mid-question.
- `start` lets the client opt out of visibility tracking (`body.visibility === true`), so a modified client can run untracked.
- **Only backgrounding pauses now** (main's fairness fix). Split-screen, floating windows, focus loss and heartbeat silence are blocked or ignored but leave no trace for the teacher. S4 should record them as "worth a look" signals for the integrity report, never as automatic pauses.
- There's no device binding, app-version gate, installed-app-only rule or integrity check.
- Every student gets the same question order and option order.
- There's no on-screen watermark, and numeric answers open the system keyboard (AI keyboards, clipboard, search).
- Screenshots, recording, casting and external displays aren't detected. iOS has nothing beyond capture blocking.
- There's no lockdown mode, and one flat rule covers every kind of event.
- Students can't ask to be let back in, and teachers see "violation" without the reason.
- There are no pre-start overrides and no after-test review.

## 2. Threat model (method → stop · detect)

| # | How students cheat | Stop it | Detect it |
|---|---|---|---|
| 1 | Switch to Google, ChatGPT, YouTube, notes, WhatsApp | Strict: lockdown (Android app pinning; iOS assessment mode or Guided Access) | app state + heartbeats (exists) → strike or pause |
| 2 | Split-screen, pop-up/freeform window, picture-in-picture | Strict lockdown | multi-window reading (exists) → 5 s to close it, then pause |
| 3 | Floating bubbles and AI overlays drawn over the test | hide overlay windows (exists, Android 12+) | n/a |
| 4 | Assistants that read the screen (Circle to Search, Gemini on screen, Lens, iOS visual look-up) | capture blocking blanks the screen content they receive (verify on real devices) | opening them blurs the app → counted as leaving |
| 5 | Screenshot to share | capture blocking (exists) | screenshot listener → strike (Strict: pause) |
| 6 | Screen recording, casting, mirroring, AirPlay, HDMI | capture blocking shows black | iOS capture state, Android 15 recording callback, extra displays → pause after 3 s |
| 7 | Photo of the screen with a second phone | nothing on the phone can stop it | shuffles + sets make the photo useless to neighbours; the watermark (name + attempt code) traces leaks |
| 8 | Friend logs in on another phone | device binding + attempt token | another device → pause `device` |
| 9 | Someone else writes the test | login | Proctored: start photo + random snapshots for the teacher |
| 10 | Passing answers in the room | shuffles + sets; supervision | after-test similar-wrong-answer pairs |
| 11 | Pasting, keyboard AI/search/translate, dictation | no text input in the runner: numeric answers use an in-app keypad | n/a |
| 12 | Changing the phone's clock | server clock (exists) | n/a |
| 13 | Airplane mode or killing the app to look things up | n/a | missing heartbeats pause after 10 s (exists); stored interruptions reported on return (exists) |
| 14 | Modded/patched/cloned app, hooking tools, rooted/jailbroken phone, emulator | version gate + installed app only + app integrity (Play Integrity / App Attest) at start and resume | integrity verdict: Standard logs, Strict blocks (teacher can override) |
| 15 | Calling the API from a laptop with a copied token | attempt token bound to the device; tracking mandatory; no web | requests without the token are refused |
| 16 | Accessibility-service apps that read or tap the screen | Strict: unknown services off before start (override for real assistive needs) | list of enabled services |
| 17 | USB debugging / scrcpy mirroring | capture blocking (secure windows are black in mirrors) | ADB or developer options on: Standard logs, Strict blocks (override) |
| 18 | Friends sending answers as notifications | Do Not Disturb in the ready check; iOS assessment mode | tapping one = leaving the app |
| 19 | Paper leak before or after | questions only after start (exists), answers after release (exists), different sets for batches writing at different times | watermark |
| 20 | Earpiece or helper out of view | supervision | Proctored snapshots may show it; **honest limit** (§9) |

## 3. Security levels (the teacher picks one per test)

**Always on, every level:**
- server clock and deadline, heartbeats with the 10 s grace, tracking required
- capture blocking, and screenshot, recording and display detection
- overlay hiding, split-screen detection, Back blocked
- **screen kept awake**
- device binding + attempt token, app-version gate, installed app only
- question and option shuffle, optional parallel sets, watermark, in-app keypad
- event log and teacher re-admit

| | Standard (default) | Strict | Proctored (opt-in) |
|---|---|---|---|
| Lockdown | not used | Android: app pinning required. iOS: assessment mode if Apple granted the entitlement, otherwise Guided Access required | as Strict |
| App integrity | checked, failure logged | required (teacher can override per student) | required |
| Unknown accessibility service, USB debugging | logged | must be off to start (override) | as Strict |
| Short leaves (2–10 s) | strike; 3rd strike pauses | strike; 2nd strike pauses | as Strict |
| Screenshot | strike | pause | pause |
| Teacher resumes per attempt | 3, then tuition owner only | 2 | 2 |
| Camera | not used | not used | start photo + 3–6 random snapshots |

Tuition owners set the default level; teachers can raise it per test (lower it only if the tuition allows).

## 4. Violation policy (server-side, `lib/exam-policy.ts`)

| Event | Standard | Strict / Proctored | The student sees |
|---|---|---|---|
| Left for < 2 s (notification shade, a mis-tap) | log | log | nothing |
| Left for 2–10 s | strike | strike | banner: "You left the test for 6 s. Warning 1 of 3." |
| Left for > 10 s, or no heartbeat for 10 s | pause (`away`) | pause | paused screen |
| Connection lost (no heartbeat, no local interruption) | pause (`connection`) | pause | "Connection lost" paused screen |
| Split-screen / pop-up window still open after 5 s | pause (`multi-window`) | pause | countdown "Close the other window", then paused |
| Screenshot | strike | pause (`screenshot`) | banner / paused |
| Recording, casting, mirroring or an extra display for 3 s | pause (`recording`) | pause | "Stop screen recording to continue", then paused |
| Lockdown exited (unpinned, Guided Access off, assessment interrupted) | n/a | pause (`lockdown`) | paused |
| The attempt opened on another device | pause (`device`) | pause | "This test is open on another phone" |
| Integrity fails mid-test | log | pause (`integrity`) | paused |
| Strikes since the last resume reach the limit | pause (`strikes`) | pause | paused |

Strikes are counted **since the last resume**, so a re-admitted student isn't paused again by old warnings; the full history stays on the attempt.

## 5. Teacher re-admit (the teacher's privilege)

**Who:** the test's teacher and the tuition owner (the existing `controlAttempt` rule). The teacher and tuition logins use the classic kit (no neobrutalism).

### A student is paused during the test
1. **Paused screen (student).** It shows what happened, in plain words and with the time, and says "Your answers are saved. Your 23 minutes are frozen." Its button is **Ask my teacher to let me back in**, with reason chips: Phone call · Battery or phone died · Internet problem · App closed by mistake · Something else. There's one request per pause, and the screen then shows "Request sent to Mrs. Patil · waiting".
2. **Teacher alert.** A push ("Aarav asks to continue Physics Test 3 · phone call") and **Waiting for you (n)** at the top of the live monitor.
3. **Teacher sheet.** It shows:
   - the pause reason in plain words and the student's chip
   - a timeline ("10:31 screenshot · 10:42 left for 14 s → paused")
   - strikes, resumes used, any device change, answered count and remaining time
4. **Decide** (a reason chip is required and saved in the audit):
   - **Let back in** (exists as Resume): same attempt and phone; the remaining time restarts on confirm.
   - **Let back in on a new phone:** for a dead or broken phone. The device binding clears and the next phone that opens the attempt is bound.
   - **Let back in + extra minutes** (1–30): when the pause wasn't the student's fault.
   - **Keep paused** with a template message ("Come to my desk", "We'll talk after the test"), which the student sees.
   - **End the attempt** (exists as Finalize): saved answers are scored.
5. **Student resumes.** The paused screen checks status every 5 s while open, and a push arrives too: "Your teacher let you back in" → **Continue** (visibility check, then the runner).

- **Resume code (optional, for in-room tests):** "Let back in" shows the teacher a 6-digit code valid for 2 minutes, and the student types it on the paused screen. It proves the teacher is at the student's desk. After 5 wrong tries a new code is needed.
- **Bulk:** when the room's internet drops, the monitor offers "Let all 7 back in (connection lost)". It takes one confirmation and writes one audit entry per student. Only `connection` pauses qualify.
- **Limits:** resumes per attempt follow §3; after that only the tuition owner can resume. A test that was manually ended can't be resumed. Results release already finalizes open and paused attempts, so the release screen lists them first ("3 attempts are paused: decide or they'll be scored as they are").

### A student is blocked before starting

| Blocker | Teacher override |
|---|---|
| App too old | **no**: update required (old builds lack the protections) |
| Web browser, emulator | **no** |
| Integrity check failed or unavailable | **"Allow this phone"** (attempt marked `integrity: overridden`) |
| Lockdown unavailable (old Android, Guided Access not set up) | **"Allow without lockdown"** (Standard rules for this student) |
| Unknown accessibility service or USB debugging on | **"Allow"** (e.g. a student who uses TalkBack) |
| No camera consent (Proctored) | automatic: Strict rules for this student, no camera |
| Missed the start window | **"Let in late"**: a personal start window (≤ 30 min), only before results are released |
| Not assigned | the existing access-request flow |

Each blocker on the student's ready check has **Fix it** (opens the right setting) or **Ask my teacher** (same request flow; it appears under Waiting for you).

### Audit and after the test
- **Audit:** every decision is stored: who, when, what, reason and device. The tuition owner sees an **Exam audit** list. Teachers see "Resumed 1× (phone call) by Mrs. Patil" on the result row; students never see anyone else's record.
- **Integrity review (after the test closes):** a timeline and flags per attempt:
  - many identical wrong answers with another student (same set)
  - several answers changed within 30 s of coming back to the app
  - very fast correct answers on hard questions
  - overrides used

  The teacher marks **Looks fine**, **Don't count** (void: left out of marks lists, ranks and stats; the student sees "Not counted. Talk to your teacher") or **Retake** (a makeup test). The tuition owner can undo a void. Flags are prompts to look, never proof, and the screen says so.

## 6. Student experience

The neobrutalism student scope, but always calm: no stickers, celebrations or haptic bursts; motion only for state changes.

- **Test card:** a level chip ("Strict test") and a "What's checked" sheet in plain words.
- **Ready check** (before Start): ✓ / **Fix it** / **Ask my teacher** rows:
  - app up to date
  - this phone verified (integrity)
  - battery ≥ 20% or charging
  - internet OK
  - Do Not Disturb on (recommended; Android shows a real tick)
  - Strict: app pinned / Guided Access on (illustrated 3-step guide)
  - Proctored: camera allowed

  Start stays disabled with the reason shown (app-interactions `disabledReason`) until every required row passes.
- **Rules screen:** four short rules plus "I understand":
  - "Leaving the app for more than 10 seconds pauses your test."
  - "Screenshots and screen recording aren't allowed."
  - "Your answers save as you go."
  - "If your test pauses, your teacher can let you back in."
- **During the test:** server timer, palette (exists), watermark, in-app keypad, warning banners, screen kept awake. Nothing else.
- **Paused:** the §5 flow.

| Situation | Say | Never say |
|---|---|---|
| Paused for leaving | "Test paused: you left the app for 14 s at 10:42. Your answers are saved." | "Cheating detected", "Violation!" |
| Warning | "You left the test for 6 s. Warning 1 of 3." | "Last chance!", red flashing |
| Connection | "Connection lost. Your answers are saved. Ask your teacher to let you back in." | "You went offline on purpose" |
| Voided | "This test isn't counted. Talk to your teacher." | the reason, in front of anyone else |

## 7. Engagement interplay

- Test participation XP is awarded when an attempt **finishes** (submitted, auto-submitted or finalized), never while it's paused.
- A void adds a compensating ledger entry (`test.void`, key `void:<sid>:<testId>`, minus the participation XP) and removes the personal-best and exam-day streak protection for that test. Peers see nothing.
- No engagement surface appears in any test screen (§0.6).

## 8. Proctored level and consent

- It's off by default, and only the tuition owner can turn it on (tuition profile).
- **Consent:** India's DPDP Act 2023 and DPDP Rules 2025 treat everyone under 18 as a child. Processing their data needs verifiable parental consent, and tracking or behavioural monitoring of children is restricted unless an exemption applies.
  - Collect consent per student and store `{ by, at, method }`. A student without consent writes under Strict rules, with no camera.
  - Have a lawyer confirm whether the tuition qualifies for the educational-institution exemption. Don't assume it does.
- **Camera:**
  - a visible self-view in a corner, never hidden
  - a photo at start and 3–6 at random times, as small JPEGs
  - stored privately per tuition; only the test's teacher and the tuition owner can view them
  - deleted automatically 30 days after results release
- **Never:** audio, face recognition, automatic judgement. Teachers look at the photos.

## 9. Honest limits (tell teachers once, at test creation)

No phone app can see a second phone, an earpiece or a helper in the room. That's why supervision still matters, and why shuffles, sets, the watermark and the after-test review exist. One line in the create-test help says this, so nobody believes the app makes cheating impossible.
