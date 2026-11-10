# Testing: unit → integration → system → user acceptance (security at every level)

Read this before writing or running tests in either repo, and before Phase 9. Testing happens at **four levels, always in this order**:
1. **Unit:** pure logic in isolation.
2. **Integration:** real route handlers with a real database, and app services with a fake network.
3. **System:** the whole app on real phones against a staging backend.
4. **User acceptance (UAT):** real teachers and students in a pilot tuition.

A level starts only when the previous one has met its exit criteria. **Security is tested at every level.** At unit and integration level that means **every combination** of the security inputs (§3), not a few hand-picked cases.

## 0. How testing fits the phases

| When | What runs |
|---|---|
| **Every phase (0–8)** | Unit + integration tests for everything the phase builds, including the security matrices (§3) for every rule and route it touches. This is the merge gate. |
| **Phase 8** | The secure-test matrices in full, plus the cheat drills on real phones for S4–S5 (system level, early, because they need hardware). |
| **Phase 9: Full testing** (after the redesign, before releasing to all tuitions) | All four levels across the whole app, in order: complete unit run, complete integration run, system testing, then UAT. Then a staged rollout. |

Existing behavior counts too: every phase reruns all existing suites (`npm test` in papers, `tests/*.test.mjs` in the app) and they must stay green.

## 1. Tools and conventions (match the repos)

**Backend (`papers`)**
- Runner: `node:test` via `npm test` (`tsx --test "tests/**/*.test.ts"`).
- Integration tests call the **real route handlers** with `NextRequest`, against `MongoMemoryReplSet` (see `tests/phase2-individual-controls.test.ts`). Users are seeded per role and get tokens from `auth.signToken`.
- Name new files `unit-*.test.ts` and `int-*.test.ts` (the existing files stay as they are). Add scripts `test:unit` (`tsx --test "tests/unit-*.test.ts"`) and `test:int`.
- External services get test doubles injected through one seam each, never real calls: pushes are captured in an array; Play Integrity and App Attest use a stub verifier that returns a chosen verdict; the clock is an injectable `now()`.

**App (`pcmb-paper`)**
- Runner: `node --experimental-strip-types --test tests/*.test.mjs` on pure modules (see `tests/secure-exam.test.mjs`). Put new rules in pure files (`exam-guard.ts` style) so they can be tested this way.
- Component and screen integration (optional): `jest-expo` + `@testing-library/react-native`. These are new dev dependencies, so ask the user before adding them.

**Both**
- `fast-check` (dev dependency, ask first): property-based tests for inputs with too many values to list, and model-based tests for sequences of actions.
- Coverage: `node --test --experimental-test-coverage` (or `c8`). Targets: **≥ 90% of lines** in `lib/engagement/*`, `lib/exam-*`, `lib/attempt*` and `exam-guard.ts`, and **100% of the branches** in `exam-policy.ts`.
- **CI:** neither repo has one. Propose a GitHub Actions workflow per repo that runs lint, typecheck, unit and integration on every push and pull request, and add it only after the user agrees.

## 2. How to cover "all permutations and combinations"

1. **List the dimensions** of each security decision and the **values** of each. Use equivalence classes plus boundaries: for a 10 s limit that's 0, 1, 9 999, 10 000, 10 001 and a huge value.
2. **Choose the strategy by size:**
   - **Exhaustive** (every combination of every dimension) when the product is up to about 10,000 cases and each case is fast. That covers all pure functions and most single-route integration matrices.
   - **Pairwise + full risky groups** when the product is larger. Every pair of values appears at least once, **and** the dimensions that interact in security (actor × action, state × action, token × device) are always combined fully.
   - **Property-based** (`fast-check`) for continuous or huge inputs: times, durations, question orders, strings. Use at least 1,000 runs, and 5,000 for security properties.
   - **Model-based** (`fast-check` commands) for **sequences**, such as everything that can happen to an attempt in any order. Random sequences of 1–40 actions run against the real routes, and after every step the server must agree with a small model.
3. **Use an independent oracle.** Write the expected result in the test as a small table or function taken from the spec (secure-tests.md §4, engagement-system.md). Never compute it by calling the code under test.
4. **Fail loudly on gaps.** Generate test names from the case (`away 10001 ms · strict · 1 strike`). Add an **inventory test** that fails when a new route, event kind, state or action has no row in its matrix (§5).

```ts
// tests/helpers/combos.ts: every combination of the given dimensions (the cartesian product).
export function cases<T extends Record<string, readonly unknown[]>>(dims: T): { [K in keyof T]: T[K][number] }[] {
  return Object.entries(dims).reduce<Record<string, unknown>[]>(
    (acc, [key, values]) => acc.flatMap((c) => values.map((v) => ({ ...c, [key]: v }))),
    [{}],
  ) as { [K in keyof T]: T[K][number] }[];
}
```

## 3. The security matrices

| # | Matrix | Dimensions (values) | Level | Strategy |
|---|---|---|---|---|
| **M1** | Authorization (who can call what) | **actor** (anonymous, forged token, expired token, own student, student same batch, other batch, other tuition, test's teacher, colleague teacher, teacher of another tuition, tuition owner, other tuition's owner) × **every route × method** × **target** (own resource, same-tuition resource, other-tuition id in the path, other-tuition id in the body) | integration | exhaustive |
| **M2** | Exam event policy | **event kind** (8) × **duration** (boundaries: 0, 1 999, 2 000, 2 999, 3 000, 4 999, 5 000, 5 001, 9 999, 10 000, 10 001, 600 000) × **level** (3) × **strikes since resume** (0 … limit) | unit | exhaustive |
| **M3** | Attempt lifecycle | **state** (none, running, paused × each of the 9 reasons, submitted, auto-submitted, finalized, voided, test manually ended, test closed, results released) × **action** (start, save answer, visibility, event, submit, readmit, resume code, teacher resume / new phone / + minutes / with code, hold, finalize, void, unvoid, bulk resume, release) × **actor** | integration | exhaustive + model-based sequences |
| **M4** | Ready check / start | **platform** (ios, android, web, missing, garbage) × **exam protocol** (missing, below, equal, above) × **tracking flag** (true, false, missing) × **integrity** (passed, failed, unavailable, not-checked, missing, stale challenge, wrong request hash) × **level** (3) × **override** (none, matching, other kind, expired late window) × **lockdown available** (yes, no) | unit (pure decision), integration (route) | unit exhaustive; integration pairwise + full on platform × protocol × integrity |
| **M5** | Device binding | **device id** (bound, different, missing, malformed) × **token** (valid, wrong, missing, another attempt's, old after re-issue) × **attempt state** (running, paused, finished) × **route** (answers, visibility, events, submit, status) | integration | exhaustive |
| **M6** | Teacher controls | **action** × **actor** × **attempt state** × **resumes used** (0, limit − 1, limit, limit + 1) × **reason** (valid, missing, unknown) × **requestId** (new, repeated) × **suspendedAt** (current, stale) × **resume code** (right, wrong × 1–5, expired, reused) × **bulk reason filter** (connection, other) | integration | pairwise + full on actor × action, resumes × actor, code cases |
| **M7** | Shuffles and scoring | random papers (1–90 questions, MCQ/numerical mix, options that refer to others) × all 24 option orders × random question orders × random answers | unit + integration | property-based |
| **M8** | Engagement anti-gaming | **kind** × **first / repeat** × **right / wrong** × **difficulty** × **cap position** (below, at, crossing, above) × **speed streak** (0–4) × **IST time** (23:59:59, 00:00:00, 04:59:59, 05:00:00, Sunday → Monday) × **tuition flag** × **role**; plus **N parallel identical requests** | unit (rules), integration (award + routes) | exhaustive on rules; property-based timelines; concurrency |
| **M9** | Input hardening (every write route) | each body field × (Mongo operators `{"$gt":""}`, `{"$ne":null}`, wrong type, empty, huge string/array, NaN/Infinity/negative, invalid ObjectId, unicode/RTL) + **mass assignment** (client sends `xp`, `score`, `strikes`, `state`, `deviceId`, `review`, `tuitionId`) | integration | exhaustive per field; never 500, never a state change |
| **M10** | Data exposure | **every student-facing response** × **role** × **test state** (before start, running, closed, released): allowlist of keys. No correct answers or solutions before release; no other students' marks, accuracy or exam flags; no token or code hashes; no exam flags in peer views | integration | exhaustive |
| **M11** | Limits and replay | resume-code tries, readmit once per pause, preflight ticket single use and expiry, idempotent `requestId`, shout-out / duel / nudge limits, push dedupe keys | integration | exhaustive on limit boundaries |
| **M12** | Time | phone clock skew (−1 day, −1 h, 0, +1 h, +1 day) × deadline edge (−1 ms, 0, +1 ms, + grace) × IST midnight and week change × phone set to another time zone | unit + integration | exhaustive on edges; property-based random instants |
| **M13** | App-side rules | AppState sequences (active, inactive, background, focus loss, blur, multi-window) of any order and length; the in-app keypad's every key sequence; ready-check decisions; `armReminders` (enabled × goal met × time before/after now × date change) | unit | property-based sequences; exhaustive keypad up to 5 keys |
| **M14** | Guideway | **role** × **feature on/off** × **seen** (never, older version, this version) × **on the guide's screen** (yes, no) × **screen idle** (yes, sheet open, loading) × **test attempt** (none, running, paused) × **queue** (empty, celebration waiting, another guide) × **guides today** (0, 1, 2) × **start** (automatic, manual) → shows or not; plus `placeCard` with random targets and screens: the card always stays inside the gutters | unit | exhaustive; property-based for placement |

## 4. Level 1: Unit testing

- **Scope:** pure logic only, with no database or network:
  - `lib/engagement/*` rules and maths, `lib/exam-policy.ts`, the pure preflight decision, `lib/exam-shuffle.ts`, `lib/exam-review.ts`, IST helpers
  - app `exam-guard.ts` (away tracker, keypad, ready check, banners), reminder scheduling logic
- **Security:** M2, M4 (decision function), M7, M8 (rules), M12, M13, M14, all exhaustive or property-based.
- **Exit:** everything passes, coverage targets met (§1), every matrix fully generated (no skipped rows).

```ts
// tests/unit-exam-policy.test.ts: M2, every away duration × level × strikes, against an independent oracle.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decide, withStrikes, type ExamLevel } from '@/lib/exam-policy';
import { cases } from './helpers/combos';

const levels = ['standard', 'strict', 'proctored'] as const;
const awayMs = [0, 1, 1_999, 2_000, 2_001, 9_999, 10_000, 10_001, 600_000];

/** The policy table from secure-tests.md §4, written independently of the code. */
function expectedAway(ms: number, level: ExamLevel, strikes: number) {
  if (ms < 2_000) return { action: 'log', strikes };
  if (ms > 10_000) return { action: 'pause', reason: 'away', strikes };
  const next = strikes + 1;
  return next >= (level === 'standard' ? 3 : 2) ? { action: 'pause', reason: 'strikes', strikes: next } : { action: 'strike', strikes: next };
}

for (const c of cases({ ms: awayMs, level: levels, strikes: [0, 1, 2] })) {
  test(`away ${c.ms} ms · ${c.level} · ${c.strikes} strikes`, () => {
    assert.deepEqual(withStrikes(decide({ kind: 'away', ms: c.ms }, c.level), c.strikes, c.level), expectedAway(c.ms, c.level, c.strikes));
  });
}
```

```ts
// tests/unit-exam-shuffle.test.ts: M7 as properties. Shuffling never changes what an answer means or how it's scored.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { toCanonical, toDisplay } from '@/lib/exam-shuffle';

const LETTERS = ['A', 'B', 'C', 'D'] as const;
const permutations = (s: string): string[] => (s.length <= 1 ? [s] : [...s].flatMap((c, i) => permutations(s.slice(0, i) + s.slice(i + 1)).map((rest) => c + rest)));
const ORDERS = permutations('ABCD');                                  // all 24 option orders

const question = fc.record({
  key: fc.constantFrom(...LETTERS),
  picked: fc.option(fc.constantFrom(...LETTERS), { nil: null }),
  order: fc.constantFrom(...ORDERS),
});

test('display ↔ canonical round-trips, and shuffled scoring equals unshuffled scoring', () => {
  fc.assert(
    fc.property(fc.array(question, { minLength: 1, maxLength: 90 }), (paper) => {
      for (const q of paper) assert.equal(toCanonical(q.order, toDisplay(q.order, q.picked)), q.picked);
      const plain = paper.filter((q) => q.picked === q.key).length;
      const viaShuffle = paper.filter((q) => toCanonical(q.order, toDisplay(q.order, q.picked)) === q.key).length;
      assert.equal(viaShuffle, plain);
    }),
    { numRuns: 5_000 },
  );
});
```

```ts
// tests/keypad.test.mjs (app): M13, every key sequence up to 5 keys (≈ 580k sequences, under a second) gives a valid answer string.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextValue } from '../src/screens/student/exam-guard.ts';

const KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '-', 'del', 'clear'];
function* sequences(length, prefix = []) {
  yield prefix;
  if (prefix.length < length) for (const k of KEYS) yield* sequences(length, [...prefix, k]);
}

test('no key sequence can produce an invalid number', () => {
  for (const seq of sequences(5)) {
    const value = seq.reduce((v, k) => nextValue(v, k, 6), '');
    assert.match(value, /^-?(\d+(\.\d*)?)?$/, seq.join(' '));        // digits, at most one dot, minus only first
    assert.doesNotMatch(value, /^-?0\d/, seq.join(' '));             // no leading zeros
    assert.ok(value.length <= 6, seq.join(' '));
  }
});
```

## 5. Level 2: Integration testing

- **Backend scope:** real route handlers + in-memory MongoDB + test doubles for push, integrity verifiers and the clock. Cover every route that's new or changed, and the existing exam routes.
- **App scope:** API services + `EngagementProvider` + the paused-screen polling, with a fake `fetch`. Screens with jest-expo, if the user agreed to it.
- **Security:** M1, M3, M4 (route), M5, M6, M8 (award + concurrency), M9, M10, M11 and M12, plus the **model-based lifecycle test** below.
- **Inventory guards** (they fail when someone adds a route without security rows):

```ts
// tests/int-authz-inventory.test.ts: every API route file must have rows in the authorization matrix (M1).
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { MATRIX } from './helpers/authz-matrix';

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? routeFiles(full) : name === 'route.ts' ? [full] : [];
  });
}

test('every API route has authorization rows', () => {
  const routes = routeFiles('src/app/api').map((f) => '/' + relative('src/app', f).replace(/\/route\.ts$/, ''));
  const covered = new Set(MATRIX.map((row) => row.route));
  assert.deepEqual(routes.filter((r) => !covered.has(r)), [], 'add rows for these routes to tests/helpers/authz-matrix.ts');
});
```

`MATRIX` rows are `{ route, method, allow: Actor[], target }`. The M1 test runs every row × every actor: allowed actors must not get 401/403, anonymous and forged tokens get 401, and everyone else gets 403. For other-tuition ids, pick **one** convention (403 or 404, so existence isn't leaked) and assert it everywhere.

```ts
// tests/int-exam-lifecycle.test.ts (sketch): random action sequences against the real routes, checked against a tiny model (M3).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';

type Level = 'standard' | 'strict';
type Model = { state: 'running' | 'paused' | 'finished'; strikes: number; resumes: number; level: Level };
interface Real {                                   // thin helpers over the real route handlers (tests/helpers/exam-actor.ts)
  leave(ms: number): Promise<{ state: string }>;
  teacherResume(): Promise<{ status: number; state: string }>;
  answer(): Promise<{ status: number }>;
  submit(): Promise<{ status: number; state: string }>;
}
declare function freshAttempt(level: Level): Promise<Real>;   // seeds a test + a started attempt in the in-memory DB

const strikeLimit = (m: Model) => (m.level === 'standard' ? 3 : 2);
const resumeLimit = (m: Model) => (m.level === 'standard' ? 3 : 2);

class Leave implements fc.AsyncCommand<Model, Real> {
  constructor(readonly ms: number) {}
  check(m: Readonly<Model>) { return m.state === 'running'; }
  async run(m: Model, r: Real) {
    const got = await r.leave(this.ms);
    if (this.ms > 10_000) m.state = 'paused';
    else if (this.ms >= 2_000 && ++m.strikes >= strikeLimit(m)) m.state = 'paused';
    assert.equal(got.state, m.state);
  }
  toString() { return `leave(${this.ms})`; }
}

class TeacherResume implements fc.AsyncCommand<Model, Real> {
  check(m: Readonly<Model>) { return m.state === 'paused'; }
  async run(m: Model, r: Real) {
    const got = await r.teacherResume();
    if (m.resumes < resumeLimit(m)) { m.resumes++; m.strikes = 0; m.state = 'running'; }
    assert.equal(got.status, m.state === 'running' ? 200 : 403);   // past the limit only the tuition owner may resume
    assert.equal(got.state, m.state);
  }
  toString() { return 'teacherResume'; }
}

class Answer implements fc.AsyncCommand<Model, Real> {
  check() { return true; }
  async run(m: Model, r: Real) {
    const got = await r.answer();
    assert.equal(got.status === 200, m.state === 'running', `answer accepted while ${m.state}`);
  }
  toString() { return 'answer'; }
}

class Submit implements fc.AsyncCommand<Model, Real> {
  check(m: Readonly<Model>) { return m.state === 'running'; }
  async run(m: Model, r: Real) {
    const got = await r.submit();
    m.state = 'finished';
    assert.equal(got.state, 'finished');
  }
  toString() { return 'submit'; }
}

const commands = [
  fc.integer({ min: 0, max: 20_000 }).map((ms) => new Leave(ms)),
  fc.constant(new TeacherResume()),
  fc.constant(new Answer()),
  fc.constant(new Submit()),
];

test('any sequence of actions keeps the server and the model in agreement', async () => {
  await fc.assert(
    fc.asyncProperty(fc.constantFrom<Level>('standard', 'strict'), fc.commands(commands, { maxCommands: 40 }), async (level, cmds) => {
      const real = await freshAttempt(level);
      await fc.asyncModelRun(() => ({ model: { state: 'running', strikes: 0, resumes: 0, level }, real }), cmds);
    }),
    { numRuns: 300 },
  );
});
```

Extend the model with the other actions in M3 (new phone, + minutes, codes, hold, finalize, void, bulk, release) as they ship. Use the status codes the routes actually use (the existing routes use 409 for conflicts) and keep the oracle in step with secure-tests.md.

- **Concurrency:** fire 10 identical award-triggering requests in parallel (`Promise.all`). Exactly one XP event, one daily increment, one strike, one resume.
- **Exit:** all suites pass; the inventory guards are green; no 500 in any M9 row; the M10 allowlists hold for every role and state; the existing suites are green.

## 6. Level 3: System testing (whole app, real phones, staging backend)

**Entry:** levels 1–2 exited. A staging deployment of `papers` with its own MongoDB and a seed script: 2 tuitions, batches for JEE/NEET/CET, the 3 personas plus edge students (no batch, GENERAL program), and tests in every state. App builds (development and release) installed on the device matrix.

- **Functional end-to-end** with **Maestro** flows (YAML, run on emulators and real phones):
  - **Student:** log in → Today's 5 → mistakes → roadmap → badges/league → recap → share.
  - **Teacher:** create a Strict test → live monitor → resume a student → integrity review.
  - **Two devices:** student paused → "Ask my teacher" → teacher resumes → student continues; duel between two students.

```yaml
# .maestro/student-daily.yaml (sketch; use the app's testIDs)
appId: com.codewithrushi.pcmb
---
- launchApp
- tapOn: "Today's 5"
- tapOn: "Start"
- repeat:
    times: 5
    commands:
      - tapOn:
          id: "answer-option-A"
      - tapOn: "Next"
- assertVisible: "XP"
```

- **Security system tests** (real hardware is required):
  - **Cheat drills:** the full cheat-drill table (secure-tests-build.md §11) on every device in the matrix.
  - **Network chaos:** airplane mode mid-test, slow 3G, server restart during a test, switching Wi-Fi ↔ mobile data.
  - **Device events:** phone call, low battery, force-kill, reinstall, changing the phone's clock and time zone.
  - **Replay and tampering from a laptop:** replay captured requests without the device token or attestation, and edit request bodies through a proxy. Use your own staging accounts only. Everything must be refused or ignored.
- **Non-functional:**
  - **Load:** a class of 300 starting the same test in the same minute plus teachers' monitors polling (k6). Answer save p95 < 300 ms; no errors.
  - **Soak:** a 3-hour test with the screen awake: battery use and no memory growth.
  - **Accessibility:** TalkBack/VoiceOver, max font size, Reduce Motion, 320 px phones.
  - **Compatibility:** Android 10–16 (Samsung, Xiaomi, Oppo/Vivo/Realme), iPhone iOS 17–26, one tablet each; light and dark.
  - **Offline:** practice answers queued and synced; XP appears after sync.
- **Exit:**
  - every flow passes on every matrix device
  - every cheat drill gives the expected result
  - performance budgets met
  - **zero open Critical or High defects** (§8)

## 7. Level 4: User acceptance testing (pilot tuition)

**Entry:** system testing exited, and the tuition owner agreed to the pilot. Students are minors, so the tuition informs parents. Use pilot practice tests, not real marks.

- **Who:**
  - the tuition owner and 2–3 teachers
  - 20–40 students across the personas: Aarav (ambitious), Sneha (anxious), Rohit (inconsistent)
- **How long:** 1–2 weeks of normal use.
- **What:**
  - scripted scenarios per role (from each phase's "Done when" list)
  - free use
  - **a mock test day:** one Standard and one Strict test
  - **a supervised cheat challenge:** volunteers try to cheat in a practice test with the teacher's knowledge, and report what worked
- **Collect:** scenario sign-offs, a short feedback form (1–5 ratings + comments), the guardrail and engagement metrics (metrics.md), and bug reports with screenshots (none from exam screens).
- **Acceptance criteria:**
  - every scenario passes
  - teachers re-admit a paused student in under a minute without help
  - students explain the paused screen in their own words
  - no honest student lost answers or time
  - ≥ 80% of students rate Today's 5 useful
  - guardrails within limits
  - the cheat challenge found nothing that bypasses the protections (anything it found becomes a failing test at the lowest possible level, then a fix, then a retest)
- **Sign-off:** the tuition owner and the product owner. Then a **staged rollout** behind the tuition flag: pilot tuition → 25% of tuitions → all. Watch the metrics at each stage.

## 8. Defects and regression

| Severity | Examples | Rule |
|---|---|---|
| **Critical** | security bypass, data leak, lost answers, wrong marks, a student unable to finish a test | blocks the release; fix now |
| **High** | wrong XP or streak, a teacher unable to re-admit, a crash on a main flow | blocks the release |
| **Medium** | a wrong state shown, a layout broken on one device | fix before UAT ends |
| **Low** | copy, polish | backlog |

**Every bug gets a test first.** Reproduce it as a failing test at the **lowest level that can catch it** (unit if possible), fix it, and keep the test forever. Security findings also add a row to the matching matrix.

## 9. Reports

Save the plan and results in `docs/testing/` (one file per level and date): what ran, matrix sizes (cases per matrix), coverage, defects by severity, devices used, and sign-offs. Show the user a short summary after each level.
