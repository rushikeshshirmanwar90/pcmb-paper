# Building secure tests (papers + app)

The rules, levels and teacher flows are in `secure-tests.md`; this file is how to build them. Everything is **additive**: existing routes keep working, and tests created before a step ships keep their old rules. Follow the repos' conventions (discover.md §4) and AGENTS.md (check Expo SDK 58 docs, `npx expo install`).

## 0. Build order (each step ships on its own)

| Step | What | Native code |
|---|---|---|
| **S1 Fairness** | keep the screen awake while running · reason codes on pauses (`away`, `connection`, …) · paused screen v2 with "Ask my teacher" · teacher sheet v2 (timeline, reason chips, new phone, extra minutes, keep paused) · bulk resume for `connection` · pushes both ways | no |
| **S2 Content** | question + option shuffle per attempt · watermark · in-app numeric keypad · (S2b) parallel sets | no |
| **S3 Binding** | tracking mandatory · device id + attempt token · exam protocol gate · installed app only · levels + policy table + strikes | no |
| **S4 Detection** | screenshot listener · recording / casting / mirroring / extra display · accessibility services, USB debugging, DND readings | yes: extend `modules/exam-security`, add iOS |
| **S5 Lockdown + integrity** | Android pinning · iOS assessment mode / Guided Access · `@expo/app-integrity` + server verification · ready check · pre-start overrides | yes |
| **S6 Review** | integrity report · similar-answer pairs · void / retake · exam audit list | no |
| **S7 Proctored** | only if the tuition wants it (secure-tests.md §8) | yes: expo-camera |

S1 fixes real unfairness today (auto-lock pauses honest students), so ship it first.

## 1. Data (additive fields)

```ts
// TestRoom.security (new tests get it; old tests read as level 'standard' with today's behavior)
interface TestSecurity {
  level: 'standard' | 'strict' | 'proctored';
  shuffleQuestions: boolean;      // default true
  shuffleOptions: boolean;        // default true (per-question opt-out: keepOptionOrder)
  sets: number;                   // 1–4 parallel papers (S2b)
  resumeNeedsCode: boolean;       // in-room tests
  minProtocol: number;            // exam protocol the client must speak (§4); set at creation
}
```

```text
TestRoom.questions[]      + keepOptionOrder?: boolean, set?: number
TestAttempt               + deviceId, device { platform, model, osVersion, protocol }
                          + integrity: 'passed' | 'failed' | 'unavailable' | 'overridden' | 'not-checked'
                          + tokenHash (Buffer), order [number], optionOrder [string], set
                          + pauseReason: 'away'|'connection'|'multi-window'|'screenshot'|'recording'|'lockdown'|'device'|'integrity'|'strikes'
                          + strikes [{ at, kind }], strikesSinceResume, resumeCount
                          + readmit { at, reason, suspendedAt, status: 'waiting'|'answered', reply? }
                          + resumeCode { hash, expiresAt, tries, requestId }
                          + review { status: 'none'|'ok'|'void'|'retake', by, at, reason }
                          + flags [{ kind, at, detail }]
TestAttempt.answers[]     + savedAt, changes
TestAttempt.events[].type + 'screenshot'|'recording'|'display'|'multi-window'|'lockdown'|'device'|'integrity'|'accessibility'|'adb'|'connection'
TestAttempt.controls[]    + reason, newDevice, minutes (on resume), action 'hold'|'override'|'void'|'unvoid'
ExamPreflight (new, TTL)  { testId, studentId, deviceId, challenge, expiresAt, result, ticketHash }       index TTL on expiresAt
ExamOverride (new)        { tuitionId, testId, studentId, kinds: ('integrity'|'lockdown'|'accessibility'|'adb'|'late')[], until?, teacherId, reason, at }
                          unique { testId, studentId }
Tuition                   + examDefaults { level, allowLower }, proctoring { enabled }
ProctorConsent (new, S7)  { tuitionId, studentId, by, at, method }
```

Map today's `reconcileVisibilityLocked` reason `visibility-unconfirmed` (no heartbeat, no reported interruption) to `pauseReason: 'connection'`; interruptions longer than the grace map to `away`. Keep `endedReason: 'violation'` for old clients.

## 2. The policy, as code (`papers/src/lib/exam-policy.ts`)

```ts
import { VISIBILITY_GRACE_MS } from '@/lib/exam-visibility-policy';

export type ExamLevel = 'standard' | 'strict' | 'proctored';
export type PauseReason = 'away' | 'connection' | 'multi-window' | 'screenshot' | 'recording' | 'lockdown' | 'device' | 'integrity' | 'strikes';
export type ExamEvent =
  | { kind: 'away'; ms: number }
  | { kind: 'connection' }
  | { kind: 'multi-window'; ms: number }
  | { kind: 'screenshot' }
  | { kind: 'recording'; ms: number }            // recording, casting, mirroring or an extra display
  | { kind: 'lockdown-exit' }
  | { kind: 'device' }
  | { kind: 'integrity-fail' };
export type Decision = { action: 'log' } | { action: 'strike' } | { action: 'pause'; reason: PauseReason };

export const EXAM = {
  graceMs: VISIBILITY_GRACE_MS,                  // one source of truth (10 s today)
  blipMs: 2_000,
  multiWindowMs: 5_000,
  recordingMs: 3_000,
  strikeLimit: { standard: 3, strict: 2, proctored: 2 },
  maxResumes: { standard: 3, strict: 2, proctored: 2 },
  resumeCode: { ttlMs: 120_000, tries: 5 },
  lateWindowMaxMin: 30,
  pausedPollMs: 5_000,
} as const;

const strict = (level: ExamLevel) => level !== 'standard';

/** What one event does at a level. The only place these rules live; the app never decides. */
export function decide(event: ExamEvent, level: ExamLevel): Decision {
  switch (event.kind) {
    case 'away':
      if (event.ms < EXAM.blipMs) return { action: 'log' };
      return event.ms <= EXAM.graceMs ? { action: 'strike' } : { action: 'pause', reason: 'away' };
    case 'connection':
      return { action: 'pause', reason: 'connection' };
    case 'multi-window':
      return event.ms > EXAM.multiWindowMs ? { action: 'pause', reason: 'multi-window' } : { action: 'log' };
    case 'screenshot':
      return strict(level) ? { action: 'pause', reason: 'screenshot' } : { action: 'strike' };
    case 'recording':
      return event.ms >= EXAM.recordingMs ? { action: 'pause', reason: 'recording' } : { action: 'log' };
    case 'lockdown-exit':
      return strict(level) ? { action: 'pause', reason: 'lockdown' } : { action: 'log' };
    case 'device':
      return { action: 'pause', reason: 'device' };
    case 'integrity-fail':
      return strict(level) ? { action: 'pause', reason: 'integrity' } : { action: 'log' };
  }
}

/** Counts a strike since the last resume; reaching the level's limit turns it into a pause. */
export function withStrikes(decision: Decision, strikesSinceResume: number, level: ExamLevel): Decision & { strikes: number } {
  if (decision.action !== 'strike') return { ...decision, strikes: strikesSinceResume };
  const strikes = strikesSinceResume + 1;
  return strikes >= EXAM.strikeLimit[level] ? { action: 'pause', reason: 'strikes', strikes } : { action: 'strike', strikes };
}
```

Every evidence path (visibility reports, `/events`, binding and integrity checks) goes through `decide` → `withStrikes` inside the existing `withTestLock` transaction, then reuses today's suspend update (`suspendedAt`, `remainingMs`) plus `pauseReason`. A resume sets `strikesSinceResume: 0`.

## 3. Routes

| Route | Who | New or changed |
|---|---|---|
| `GET /tests/[id]/preflight` | student | **new**: a challenge (random, 2 min) for the integrity check |
| `POST /tests/[id]/preflight` | student | **new**: `{ checks, integrity }` → `{ level, blockers: [{ kind, overridable }], warnings, ticket }`; applies `ExamOverride` |
| `POST /tests/[id]/start` | student | **tracking required** for every test (no `visibility: false` path); a fresh attempt needs a passed preflight ticket (≤ 2 min); binds `deviceId`; creates `order`, `optionOrder`, `set`; returns `attemptToken` **once** |
| `/visibility`, `/answers`, `/events`, `/submit`, `/status` | student | require `x-device-id` + `x-attempt-token`; a mismatch during a running attempt pauses it with `device`; `/events` accepts the S4 kinds |
| `POST /tests/[id]/readmit` | student | **new**: `{ reason }` (enum), once per pause; `pushOnce('readmit:<attemptId>:<suspendedAt>')` to the test's teacher |
| `POST /tests/[id]/resume-code` | student | **new**: `{ code }` → resumes when it matches (hash compare, TTL, 5 tries, single use) |
| `POST /tests/[id]/attempt-control` | teacher, tuition | `resume` gains `reason` (old clients → `'unspecified'`), `newDevice`, `minutes` (0–30), `withCode` (returns `{ code, expiresAt }` once); new actions `hold` (template reply), `override` (pre-start kinds), `void`, `unvoid` (tuition only); enforces `maxResumes` (tuition owner beyond it) |
| `POST /tests/[id]/attempt-control/bulk` | teacher, tuition | **new**: resume many, **only** `connection` pauses; one `controls` entry per attempt |
| `GET /tests/[id]/monitor` | teacher, tuition | rows gain `pauseReason`, `readmit`, `strikes`, `resumeCount`, `deviceChanged`, `flagCount`; top-level `waiting` |
| `GET /tests/[id]/integrity` | teacher, tuition (after close) | **new**: per-attempt timeline + flags, similar pairs |
| `POST /tests/[id]/review` | teacher (void needs a reason), tuition (undo) | **new** |
| `GET /tests/[id]` (student) | student | gains `security: { level, rules }` for the card and ready check |

On resume, push the student: `pushOnce('resumed:<attemptId>:<resumeVersion>')`, data `{ route: '/tests/<id>' }`. Quiet hours don't apply to live-test pushes (the student is waiting).

## 4. Binding, token and the exam protocol (`papers/src/lib/exam-client.ts`)

The **exam protocol** is a small integer for the protections a client has (S3 = 3, S4 = 4, S5 = 5). The app sends the lower of its JS constant and the native module's exported `PROTOCOL`, so an over-the-air JS update can't claim native protections the build doesn't have. Headers are easy to fake; integrity (§6) is what proves the app is genuine, which is why Strict requires it.

```ts
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from '@/lib/http';

export type ExamClient = { platform: 'ios' | 'android'; protocol: number; deviceId: string };

/** Reads the headers every exam route needs. Web, unknown platforms and old clients are refused. */
export function examClient(req: Request, minProtocol: number): ExamClient {
  const platform = req.headers.get('x-platform');
  const protocol = Number(req.headers.get('x-exam-protocol'));
  const deviceId = req.headers.get('x-device-id') ?? '';
  if (platform !== 'ios' && platform !== 'android') throw new HttpError(403, 'Tests can only be taken in the PCMB app on a phone or tablet.');
  if (!Number.isInteger(protocol) || protocol < minProtocol) throw new HttpError(426, 'Update the app to take this test.');
  if (!/^[0-9a-f-]{36}$/i.test(deviceId)) throw new HttpError(400, 'This phone could not be identified. Restart the app and try again.');
  return { platform, protocol, deviceId };
}

export const newAttemptToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest();

/** Constant-time check of the attempt token a request carries. */
export function tokenMatches(stored: Buffer | null | undefined, sent: string | null): boolean {
  if (!stored || !sent) return false;
  const sentHash = hashToken(sent);
  return sentHash.length === stored.length && timingSafeEqual(sentHash, stored);
}
```

Binding rules:
- The token is issued **once** at start, and again only after a teacher's "new phone" resume. The app keeps it in SecureStore, so killing the app doesn't lose it.
- Asking for a token while an attempt is running (reinstall, cleared data, another phone) pauses it with `device`. The teacher decides between "same phone" (re-issue) and "new phone" (re-bind).
- Device id: `Crypto.randomUUID()` from expo-crypto, stored in SecureStore (`exam.deviceId`).

## 5. Shuffles (`papers/src/lib/exam-shuffle.ts`)

Answers are **stored in canonical form** (the teacher's question index and letters), so scoring, results, analytics and the monitor don't change. Only what the student sees and sends is mapped.

```ts
import { randomInt } from 'node:crypto';

const LETTERS = ['A', 'B', 'C', 'D'] as const;
type Letter = (typeof LETTERS)[number];
const isLetter = (v: string | null): v is Letter => v !== null && (LETTERS as readonly string[]).includes(v);

/** A uniform random order of 0..n-1 (Fisher–Yates with crypto randomness). Stored on the attempt, so resumes keep it. */
export function permutation(n: number, rand: (max: number) => number = (max) => randomInt(max)): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** "All of the above", "Both A and B"… only make sense in the original order. */
const REFERS_TO_OTHERS = /\b(all|none|both|neither)\b[^.]*\b(above|these|of them)\b|\b[A-D]\s*(and|&|or)\s*[A-D]\b/i;

type Q = { answerType: string; keepOptionOrder?: boolean; optionA?: string; optionB?: string; optionC?: string; optionD?: string };

/** Per question: canonical letters in display order ('CADB' = the student's A shows option C). 'ABCD' keeps it. */
export function optionOrders(questions: Q[], shuffle: boolean, rand?: (max: number) => number): string[] {
  return questions.map((q) => {
    const options = [q.optionA, q.optionB, q.optionC, q.optionD];
    const fixed = !shuffle || q.answerType !== 'MCQ' || q.keepOptionOrder || options.some((o) => !!o && REFERS_TO_OTHERS.test(o));
    return fixed ? 'ABCD' : permutation(4, rand).map((i) => LETTERS[i]).join('');
  });
}

/** What the student tapped → the test's own letter. Numerical answers pass through. */
export const toCanonical = (order: string, selected: string | null) => (isLetter(selected) ? order[LETTERS.indexOf(selected)] : selected);

/** A stored letter → where this student saw it (saved answers, and the key after release). */
export const toDisplay = (order: string, canonical: string | null) => (isLetter(canonical) ? LETTERS[order.indexOf(canonical)] : canonical);
```

- `attempt.order[displayIndex] = canonicalIndex`. `questionsFor(test, reveal, attempt)` walks `attempt.order` and gives display option X the text and `optionDiagramUrls` of `optionOrder[q][X]`.
- Saving maps `index → order[index]` and the letter with `toCanonical`. `attemptOut` maps back with `toDisplay`. After release the student reviews in their own order.
- Teachers always see the canonical paper.
- **S2b parallel sets:** questions carry `set`, and the attempt gets one (round-robin by roll number). Scoring, `maxScore` and results read only that set. Build every set with the same count, marks and chapter/difficulty mix (reuse `lib/assessment-pick.ts`). It touches scoring, so ship it after the shuffles, with its own tests.

## 6. App integrity (`papers/src/lib/integrity.ts`)

Client: `@expo/app-integrity` (`npx expo install @expo/app-integrity`).
- **Android, Play Integrity standard requests:**
  - call `prepareIntegrityTokenProviderAsync(cloudProjectNumber)` once per app run
  - then `requestIntegrityCheckAsync(requestHash)` with `requestHash = sha256(testId + deviceId + challenge)`
- **iOS, App Attest:**
  - check `isSupported`
  - call `generateKeyAsync()` once and store the key id
  - call `attestKeyAsync(keyId, challenge)` once per key
  - after that, `generateAssertionAsync(keyId, challengeOrRequestHash)` at preflight, resume and submit

Server:
- **Android:** decode the token with Google's `decodeIntegrityToken` API (service account, package `com.codewithrushi.pcmb`). Require:
  - `requestDetails.requestHash` equals the expected hash, and the timestamp is under 2 minutes old
  - `appIntegrity.appRecognitionVerdict === 'PLAY_RECOGNIZED'`
  - `deviceIntegrity.deviceRecognitionVerdict` includes `MEETS_DEVICE_INTEGRITY`
- **iOS:** verify the attestation once against Apple's App Attest root, app id `TEAMID.bundleId`, the nonce and counter 0. Store the public key and counter. Verify each assertion's signature and an increasing counter. Use a maintained verifier library or Apple's documented steps, and keep it in this one file.
- **Verdict:**
  - `passed`
  - `failed`: Standard records it; Strict makes it a blocker the teacher can override
  - `unavailable`: Google/Apple outage, old device or simulator; same handling as `failed`
  - `not-checked`: development and internal builds (Play-unrecognized APKs fail `PLAY_RECOGNIZED`), behind an env flag that's never set in production
- **Env:** `PLAY_INTEGRITY_SERVICE_ACCOUNT`, `PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER`, `APPLE_TEAM_ID`, `IOS_BUNDLE_ID`, `EXAM_INTEGRITY_DEV_BYPASS`.

## 7. Review signals (`papers/src/lib/exam-review.ts`, after close)

```ts
type ReviewRow = { studentId: string; set: number; answers: (string | null)[]; key: string[] };   // canonical, cleaned (lib/marking cleanAnswer)

/** Pairs in the same set sharing unusually many identical WRONG answers. A prompt for a teacher, never proof. */
export function similarPairs(rows: ReviewRow[], minShared = 5, minShare = 0.6) {
  const pairs: { a: string; b: string; sharedWrong: number; share: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (a.set !== b.set) continue;
      let sharedWrong = 0;
      let wrongA = 0;
      let wrongB = 0;
      a.key.forEach((key, q) => {
        const x = a.answers[q];
        const y = b.answers[q];
        const xWrong = x !== null && x !== key;
        const yWrong = y !== null && y !== key;
        if (xWrong) wrongA++;
        if (yWrong) wrongB++;
        if (xWrong && yWrong && x === y) sharedWrong++;
      });
      const share = sharedWrong / Math.max(1, Math.min(wrongA, wrongB));
      if (sharedWrong >= minShared && share >= minShare) pairs.push({ a: a.studentId, b: b.studentId, sharedWrong, share });
    }
  }
  return pairs.sort((p, q) => q.sharedWrong - p.sharedWrong);
}
```

Other flags:
- `changed-after-return`: 2 or more answers changed within 30 s after an interruption's `returnedAt`.
- `fast-hard`: a correct Hard question saved within 8 s of the previous save. This is approximate, so label it that way.
- `override-used`.

Compute them once on close and cache them on the attempt (`flags`). A test of 300 students is about 45k pairs, which is fine.

## 8. App (pcmb-paper)

**Packages:** `npx expo install expo-keep-awake expo-battery @expo/app-integrity` (S7 adds `expo-camera`). Remember the `expo-image-picker` plugin sets `cameraPermission: false`; the camera's permission text must explain proctoring.

### Native module (`modules/exam-security`): add to the existing Kotlin and add iOS

| Platform | Function / event | API | Notes |
|---|---|---|---|
| Android | `watchRecording(on)` → `onRecording { recorded }` | `WindowManager.addScreenRecordingCallback` (API 35), permission `DETECT_SCREEN_RECORDING` | returns the current state; register per activity, remove on stop |
| Android | `displayCount()` | `DisplayManager.getDisplays()` | > 1 = casting / HDMI |
| Android | `accessibilityServices()` | `AccessibilityManager.getEnabledAccessibilityServiceList(FEEDBACK_ALL_MASK)` | package names; the server keeps the allowlist (TalkBack, Select to Speak, makers' screen readers) |
| Android | `adbEnabled()`, `devOptionsEnabled()` | `Settings.Global.ADB_ENABLED`, `DEVELOPMENT_SETTINGS_ENABLED` | |
| Android | `dndOn()` | `NotificationManager.getCurrentInterruptionFilter()` | reading needs no permission |
| Android | `startPinning()`, `stopPinning()`, `pinState()` | `Activity.startLockTask()` / `stopLockTask()`, `ActivityManager.getLockTaskModeState()` | without device-owner rights Android asks the student to confirm; some phones need "App pinning" on in Settings first; verify per maker |
| Android | `setRecentsHidden(on)` | `Activity.setRecentsScreenshotEnabled(false)` (API 33) | FLAG_SECURE already blanks it; belt and braces |
| iOS | `isCaptured()` → `onCapture { captured }` | iOS 17+: `UITraitCollection.sceneCaptureState`; older: `UIScreen.isCaptured` + `capturedDidChangeNotification` | true for recording, AirPlay and mirroring |
| iOS | `guidedAccess()` → `onGuidedAccess` | `UIAccessibility.isGuidedAccessEnabled`, `guidedAccessStatusDidChangeNotification` | Strict fallback |
| iOS | `beginAssessment()`, `endAssessment()` → `onAssessment { state }` | `AEAssessmentSession` (iOS 13.4+) + delegate | needs the `com.apple.developer.automatic-assessment-configuration` entitlement, which Apple grants on request; show questions only after `assessmentSessionDidBegin`; on `wasInterruptedWithError`, hide questions, `end()`, report `lockdown-exit` |
| both | `PROTOCOL` constant | | the native half of the exam protocol (§4) |

```kotlin
// Sketch; build and test on devices. Class level: private var recordingCallback: java.util.function.Consumer<Int>? = null
// Imports: android.app.ActivityManager, android.content.Context, android.view.WindowManager
// Inside ExamSecurityModule.definition(), next to the existing functions:
Events("onRecording")

Function("watchRecording") { on: Boolean ->
  if (Build.VERSION.SDK_INT < 35) return@Function false
  val activity = appContext.currentActivity ?: return@Function false
  val wm = activity.windowManager
  recordingCallback?.let { wm.removeScreenRecordingCallback(it) }
  recordingCallback = null
  if (!on) return@Function false
  val callback = java.util.function.Consumer<Int> { state ->
    sendEvent("onRecording", mapOf("recorded" to (state == WindowManager.SCREEN_RECORDING_STATE_VISIBLE)))
  }
  recordingCallback = callback
  wm.addScreenRecordingCallback(activity.mainExecutor, callback) == WindowManager.SCREEN_RECORDING_STATE_VISIBLE
}

Function("startPinning") {
  val activity = appContext.currentActivity ?: return@Function false
  activity.runOnUiThread { activity.startLockTask() }
  true
}

Function("pinState") {
  val am = appContext.reactContext?.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
  am?.lockTaskModeState ?: ActivityManager.LOCK_TASK_MODE_NONE   // 2 = LOCK_TASK_MODE_PINNED
}
```

```swift
// modules/exam-security/ios/ExamSecurityModule.swift (sketch). In expo-module.config.json add "apple" to "platforms"
// and "apple": { "modules": ["ExamSecurityModule"] }, plus a podspec for the folder (verify against Expo's module docs).
import ExpoModulesCore
import UIKit

public class ExamSecurityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExamSecurity")
    Constants(["PROTOCOL": 5])
    Events("onCapture", "onGuidedAccess", "onAssessment")

    AsyncFunction("isCaptured") { () -> Bool in
      UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.contains { $0.screen.isCaptured }
    }.runOnQueue(.main)

    AsyncFunction("guidedAccess") { () -> Bool in
      UIAccessibility.isGuidedAccessEnabled
    }.runOnQueue(.main)

    OnStartObserving {
      NotificationCenter.default.addObserver(forName: UIScreen.capturedDidChangeNotification, object: nil, queue: .main) { [weak self] note in
        self?.sendEvent("onCapture", ["captured": (note.object as? UIScreen)?.isCaptured ?? false])
      }
      NotificationCenter.default.addObserver(forName: UIAccessibility.guidedAccessStatusDidChangeNotification, object: nil, queue: .main) { [weak self] _ in
        self?.sendEvent("onGuidedAccess", ["enabled": UIAccessibility.isGuidedAccessEnabled])
      }
    }
    // OnStopObserving: remove both observers (keep the tokens addObserver returns).
    // beginAssessment / endAssessment: an NSObject helper that owns the AEAssessmentSession and implements
    // AEAssessmentSessionDelegate (didBegin, failedToBeginWithError, wasInterruptedWithError, didEnd) → "onAssessment".
  }
}
```

- `isCaptured` on `UIScreen` is deprecated in newer iOS. Prefer the `sceneCaptureState` trait where available, and check Apple's current docs when building.
- The entitlement goes in `app.json` → `ios.entitlements` **only after Apple grants it**. Gate it with an env var in `app.config.js`, because builds with an ungranted entitlement fail signing.
- Android: add `DETECT_SCREEN_RECORDING` to the module's `AndroidManifest.xml`, next to `HIDE_OVERLAY_WINDOWS`.

### JS pieces

| File | Job |
|---|---|
| `src/services/exam-client.ts` | device id; attempt token per attempt in SecureStore (`exam.token.<attemptId>`); headers `x-platform`, `x-exam-protocol`, `x-device-id`, `x-attempt-token` on exam routes only |
| `src/screens/student/exam-guard.ts` (pure, tested) | extend: ready-check decisions, lockdown requirement per level and platform, banner copy, keypad `nextValue` |
| `src/screens/student/use-exam-lockdown.ts` | while running: keep awake (`activateKeepAwakeAsync('exam')` / `deactivateKeepAwake('exam')`); screenshot listener (`addScreenshotListener` from expo-screen-capture) → `/events`; recording, display, Guided Access and assessment events → `/events`; pinning on start, unpin after the server confirms submission |
| `ready-check.tsx`, `exam-rules.tsx` | §6 of secure-tests.md; GET challenge → local checks → integrity → POST preflight → Start with the ticket |
| `paused-screen.tsx` | reason, frozen time, Ask my teacher (reason chips) → `/readmit`, waiting state, teacher's template reply, code entry if required; polls `/status` every 5 s while visible for up to 15 min (reuse `createPoller`) |
| `exam-watermark.tsx`, `exam-keypad.tsx` | below |

```tsx
// src/screens/student/exam-watermark.tsx: faint, tiled, untouchable; says whose screen a photo came from.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { usePalette } from '@/components/kit';

export function ExamWatermark({ name, code }: { name: string; code: string }) {
  const p = usePalette();
  const { width, height } = useWindowDimensions();
  const rows = useMemo(() => Array.from({ length: Math.ceil(height / 120) + 1 }, (_, i) => i), [height]);
  const line = `${name} · ${code}     `.repeat(4);
  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {rows.map((i) => (
        <Text key={i} numberOfLines={1} style={[styles.line, { top: i * 120 - 40, left: i % 2 ? -width * 0.3 : -width * 0.1, width: width * 1.6, color: p.ink }]}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { pointerEvents: 'none', overflow: 'hidden' },
  line: { position: 'absolute', fontSize: 13, fontWeight: '600', opacity: 0.07, transform: [{ rotate: '-24deg' }] },
});
```

`code` = the last 6 characters of the attempt id, upper-cased. Put the watermark above the question content and below the timer bar, and check contrast doesn't hurt reading (opacity ≤ 0.08).

```ts
// In exam-guard.ts (pure, tested): the in-app keypad's rules. The answer is shown in a Text, never a TextInput,
// so no system keyboard (AI suggestions, clipboard, search, dictation) ever opens during a test.
export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | '-' | 'del' | 'clear';

export function nextValue(value: string, key: KeypadKey, max = 10): string {
  if (key === 'clear') return '';
  if (key === 'del') return value.slice(0, -1);
  if (value.length >= max) return value;
  if (key === '-') return value === '' ? '-' : value;                         // a minus only first
  if (key === '.') return value.includes('.') ? value : `${value === '' || value === '-' ? `${value}0` : value}.`;
  if (value === '0') return key;                                               // no leading zeros
  if (value === '-0') return `-${key}`;
  return value + key;
}
```

The keypad is a 4×3 grid of large keys (`1–9`, `-`, `0`, `.`) plus Delete and Clear. It uses the student-scope `PressableNeo`, with a light haptic `select` on each key and no sound. The server still validates with `cleanAnswer`.

**Lockdown sequence (Strict):**
- **Android:** Start → `startPinning()` → the student confirms → poll `pinState()` until pinned (≤ 10 s, then explain and offer "Ask my teacher") → start.
- **iOS, assessment mode entitled:** `beginAssessment()` → wait for the began event → start.
- **iOS, otherwise:** Start stays disabled until `guidedAccess()` is true. Guide the student: Settings → Accessibility → Guided Access → on; back in the app, triple-click the side button → Start.
- **Leaving lockdown mid-test** → `/events` `lockdown-exit`.
- **On submit,** end the lockdown only after the server confirms submission.

## 9. Teacher and tuition app (classic kit, no neobrutalism)

- **Create test, new "Security" step:**
  - level (Proctored only if the tuition enabled it)
  - shuffle questions (on), shuffle options (on), parallel sets (S2b), resume code (off)
  - a "What students will see" preview and the honest-limits line
- **Live monitor:**
  - a **Waiting for you** section first
  - reason chips on rows ("Left 14 s", "Recording", "Other phone", "Connection"), strikes, device changed
  - "Let all n back in (connection lost)"
  - polling stays at 15 s, plus a refresh when a readmit push arrives
- **Attempt sheet v2** (`attempt-controls.tsx`):
  - timeline, reason chips and the §5 actions
  - with a resume code: big digits and a 2-minute countdown
  - keep the `requestId` idempotency and the `suspendedAt` check
- **Release:** list paused and open attempts before confirming.
- **After close, an Integrity tab beside Results:**
  - flagged attempts first
  - pair cards ("Aarav and Rohit share 7 identical wrong answers in Set A")
  - Looks fine / Don't count / Retake
- **Tuition profile:** default level, whether teachers may lower it, the Proctored switch with a consent register (S7), and the Exam audit list.

## 10. Tests

The full strategy (levels, matrices M1–M13, model-based lifecycle test, exit criteria) is in testing.md. The lists below are the minimum per step.

**Backend** (`tests/exam-security-*.test.ts`, `npm test`):
- **Policy:** every event × level gives the table's decision; strikes since resume; the limit pauses; a resume resets the counter.
- **Start:**
  - refuses a missing `visibility`, web or unknown platforms, an old protocol (426), and a missing or expired ticket
  - integrity failure blocks under Strict and is recorded under Standard; an override lets the student in and marks the attempt
- **Binding:**
  - a wrong or missing token while running pauses with `device`
  - a token request while running pauses
  - after a "new phone" resume, the next device binds
- **Shuffles:**
  - order and option order are stored and survive resumes
  - `toCanonical`/`toDisplay` round-trip
  - "all of the above" questions keep their order
  - scores equal the unshuffled scoring for the same canonical answers
- **Re-admit:**
  - one request per pause; push key deduped
  - resume with a reason; `maxResumes`, then tuition owner only
  - resume code: TTL, 5 tries, single use
  - bulk accepts only `connection`
  - a stale `suspendedAt` is rejected (exists)
- **Review:**
  - a void excludes the attempt from stats and ranks; only the tuition owner can undo it
  - the `test.void` ledger entry is idempotent
- **Regression:** `phase2b-secure-exam`, `phase2c-live-monitor` and `phase2-individual-controls` stay green, and old tests (no `security`) behave as today.

**App** (pure rules, the `tests/secure-exam.test.mjs` style): keypad `nextValue`, ready-check decisions, lockdown requirement per level/platform, banner copy, and that the app's thresholds equal the server's (or come from the server in `security.rules`).

## 11. Cheat drills (manual, before any release that touches tests)

**Devices:** Android 10, 12, 14 and 15/16, including:
- Samsung One UI (Edge panel, pop-up view)
- Xiaomi HyperOS (floating windows)
- Oppo/Realme/Vivo (smart sidebar)

Plus an iPhone on iOS 17/18/26 and one tablet. Record the results in `docs/exam-security-drills.md` (date, device, pass/fail).

| Try | Expected |
|---|---|
| Phone left idle 2 min on a question | screen stays on, no pause |
| Pull the notification shade for 1 s | nothing |
| Open WhatsApp for 6 s, come back | warning 1 of 3 (Standard) |
| Open Chrome for 15 s | paused `away`; Ask my teacher → teacher resumes → continue with the same answers and time |
| Split-screen / pop-up window | countdown, then paused if not closed in 5 s |
| AI chat bubble / floating app | hidden (Android 12+) |
| Circle to Search / screen assistant / Lens | sees a blank screen or nothing useful; leaving is counted |
| Screenshot | blocked or blank; strike (Standard) / paused (Strict) |
| Start the screen recorder, cast, AirPlay, HDMI | black content; paused after 3 s |
| Airplane mode for 15 s | paused `connection`; bulk resume works |
| Kill the app for 5 s, reopen | warning; same attempt resumes |
| Open the attempt on a second phone | paused `device`; "new phone" resume binds the second phone |
| Reinstall mid-test | paused `device` |
| Answer a numerical question | in-app keypad only; no system keyboard |
| Sideloaded or modified APK on a Strict test | blocked at the ready check |
| Strict, Android: unpin (Back + Overview) | paused `lockdown` |
| Strict, iOS: turn Guided Access off mid-test | paused `lockdown` |
| Web build tries to start | refused |
