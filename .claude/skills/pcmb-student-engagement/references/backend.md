# Backend (papers): models, award engine, hooks, APIs, notifications, tests

Follow the backend's own conventions (discover.md §4): `route()` handlers, `requireUser(req, role)`, Mongoose models in `src/models`, logic in `src/lib`, `todayInIndia()` for IST days, `npm test` with tsx + mongodb-memory-server. Read `AGENTS.md` in the repo (Next.js changed; check its bundled docs before using framework APIs). **Everything here is additive:** existing routes keep their responses and only gain fields.

Folder: `src/lib/engagement/` (config, time, award, streak, mastery, badges, daily, revision, league, push) and one model file per collection.

## 1. Config and time

```ts
// src/lib/engagement/config.ts: every tunable number in one place
export const ENGAGEMENT = {
  xp: {
    practiceCorrect: 10, practiceWrong: 2, difficulty: { Easy: 1, Medium: 1.5, Hard: 2 } as Record<string, number>,
    mistakeFixed: 15, dailyChallenge: 40, dailyPerfect: 20, selfPerQuestion: 3, selfMax: 120,
    testSubmitted: 80, personalBest: 50, revisionCleared: 20, duelFinished: 25, duelWin: 15,
  },
  caps: { practicePerDay: 400, duelsWithXpPerDay: 3 },
  speedGuard: { minGapMs: 4000, streakOfFast: 3 },
  lateNight: { fromHour: 0, toHour: 5 },                       // IST; XP counts but not in the league
  goals: { chill: 50, regular: 100, serious: 200, beast: 300 } as const,
  streak: { freezeEvery: 7, maxFreezes: 2, repairWindowDays: 30 },
  revisionDays: [1, 3, 7, 14, 30],                             // Leitner boxes 1..5
  league: { minVisible: 4, top: 10 },
  nudges: { perDay: 1, quietFrom: 22, quietTo: 7 },
} as const;

export const levelForXp = (xp: number) => Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2); // inverse of 50·L·(L−1)
export const xpForLevel = (level: number) => 50 * level * (level - 1);
```

```ts
// src/lib/engagement/time.ts: IST calendar helpers (reuse todayInIndia's offset)
const IST_MS = 5.5 * 3600 * 1000;
export const istDate = (d = new Date()) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);       // 'YYYY-MM-DD'
export const istHour = (d = new Date()) => new Date(d.getTime() + IST_MS).getUTCHours();
export function istWeekKey(d = new Date()) {                                                                  // ISO week, IST
  const t = new Date(d.getTime() + IST_MS);
  const day = (t.getUTCDay() + 6) % 7;                       // Mon=0
  t.setUTCDate(t.getUTCDate() - day + 3);                    // Thursday of this week
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
```

## 2. Models (new collections)

```ts
// src/models/XpEvent.ts: the append-only ledger (truth for XP, league, challenges, metrics)
const XpEventSchema = new Schema({
  key: { type: String, required: true, unique: true },       // idempotency: 'practice:<sid>:<qid>:first'
  studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tuitionId: { type: Schema.Types.ObjectId, ref: 'Tuition', required: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'Batch', default: null },
  kind: { type: String, required: true },                    // 'practice.correct' | 'mistake.fixed' | 'daily.complete' | …
  xp: { type: Number, required: true },                      // after caps/guards (may be 0; still recorded)
  date: { type: String, required: true },                    // IST 'YYYY-MM-DD'
  weekKey: { type: String, required: true },                 // '2026-W46'
  league: { type: Boolean, default: true },                  // false for late-night XP
  meta: { type: Schema.Types.Mixed, default: {} },           // questionId, chapter, topic, subject, difficulty, testId…
  at: { type: Date, required: true },
});
XpEventSchema.index({ batchId: 1, weekKey: 1, league: 1 });
XpEventSchema.index({ studentId: 1, date: 1 });
```

```text
// src/models/StudentEngagement.ts: one per student (fast reads for Home)
{
  studentId (unique), tuitionId, batchId,
  totalXp: Number, level: Number,
  goal: 'chill' | 'regular' | 'serious' | 'beast', goalNext?: same|null,  // a change applies tomorrow
  streak: { current, longest, lastGoalDate: String|null, freezes, lastRepairDate: String|null },
  settings: { leagueHidden: Boolean, allowDuels: Boolean, nudges: Boolean, nudgeTime: 'HH:mm', eventPushes: Boolean, weeklyRecap: Boolean, frame?: String, accent?: String },
  lastAnswerAt: Date|null, fastRun: Number,                  // speed guard state
}
```

```text
// src/models/DailyActivity.ts: per student per IST day (goal ring, metrics, teacher view)
{ studentId, tuitionId, batchId, date, xp, practiceXp, questions, correct, mistakesFixed, goalMet: Boolean, goalXp, firstAt, lastAt }
// index { studentId: 1, date: 1 } unique; { batchId: 1, date: 1 }
```

Other collections (fields in features.md): `DailyChallenge` (unique studentId+date), `RevisionItem` (unique studentId+questionId; index studentId+dueOn+clearedAt), `StudentBadge` (unique studentId+badgeId+tier), `BatchChallenge`, `Shoutout`, `Duel`, `Squad`, `SquadInvite`. Additive fields: `Tuition.examDates[]`, `Tuition.engagement.enabled`.

## 3. The award engine (the only way XP is granted)

```ts
// src/lib/engagement/award.ts
export type AwardInput = {
  student: { _id: Types.ObjectId; tuitionId: Types.ObjectId; batchId?: Types.ObjectId | null };
  kind: string; key: string; xp: number; meta?: Record<string, unknown>; at?: Date;
  practice?: boolean;                                         // counts toward the daily practice cap + speed guard
};
export type AwardResult = { xpAwarded: number; duplicate: boolean; today: TodaySummary; streak: StreakSummary; levelUp?: number; badges?: string[] };

export async function award(input: AwardInput): Promise<AwardResult> {
  if (!(await engagementEnabled(input.student.tuitionId))) return emptyResult();
  const at = input.at ?? new Date();
  const date = istDate(at), weekKey = istWeekKey(at);
  const eng = await ensureEngagement(input.student);          // upsert StudentEngagement, roll streak to today (lazy, no cron)
  let xp = input.xp;
  if (input.practice) xp = applySpeedGuard(eng, at, xp);     // updates eng.fastRun / lastAnswerAt
  if (input.practice) xp = Math.min(xp, await remainingPracticeCap(input.student._id, date));
  const late = istHour(at) >= ENGAGEMENT.lateNight.fromHour && istHour(at) < ENGAGEMENT.lateNight.toHour;
  try {
    await XpEvent.create({ key: input.key, studentId: input.student._id, tuitionId: input.student.tuitionId, batchId: input.student.batchId ?? null,
      kind: input.kind, xp, date, weekKey, league: !late, meta: input.meta ?? {}, at });
  } catch (e) {
    if (isDuplicateKey(e)) return { ...(await summaryFor(eng, date)), xpAwarded: 0, duplicate: true };
    throw e;
  }
  const day = await DailyActivity.findOneAndUpdate(
    { studentId: input.student._id, date },
    { $inc: { xp, ...(input.practice ? { practiceXp: xp } : {}) }, $setOnInsert: { tuitionId: input.student.tuitionId, batchId: input.student.batchId ?? null, goalXp: goalXpFor(eng), firstAt: at }, $set: { lastAt: at } },
    { upsert: true, new: true },
  );
  const before = eng.level;
  eng.totalXp += xp; eng.level = levelForXp(eng.totalXp);
  if (!day.goalMet && day.xp >= day.goalXp) { day.goalMet = true; await day.save(); markGoalDay(eng, date); }
  await eng.save();
  const badges = await evaluateBadges(eng, input);            // idempotent, returns newly earned ids
  return { xpAwarded: xp, duplicate: false, today: todayOf(day, eng), streak: streakOf(eng), levelUp: eng.level > before ? eng.level : undefined, badges };
}
```

Rules:
- **Never award XP anywhere else.** Routes call `award()` with a deterministic `key`.
- The engine never throws into the learning flow: wrap hook calls so a gamification failure can't break answering or submitting (`await safeAward(…)` logs and returns an empty result).
- **Streak rolls lazily:** `ensureEngagement` compares `streak.lastGoalDate` with today, spends freezes for missed days, or resets `current` (keeping `longest`). No cron needed.
- **Exam-day protection:** `test.submitted` calls `markGoalDay` for the streak even if the XP goal isn't met.
- **Compensations** (`test.void` / `unvoid`) are the only awards with negative or restoring XP. They:
  - skip `DailyActivity`, goals, the speed guard and badges
  - are written with `league: false`
  - never take `totalXp` below 0
  - never trigger a level-up or level-down message

  The ledger stays append-only.

## 4. Hooks into existing routes (one line each, additive)

```ts
// POST /api/pyq/answer, after the PracticeAnswer upsert (only for students):
const prev = existingBefore;          // read the old PracticeAnswer before the upsert to know first-try vs. fix
const engagement = await safeAward(practiceAward(session.user, q, { correct, prev }));
await recordRevision(session.user, q, { correct, source: 'practice' });   // wrong → box 1; correct on a due item → next box
return { ...existingResponse, engagement };                               // additive field
```

`practiceAward` decides kind, key and xp: first try correct → `practice:<sid>:<qid>:first` with `10 × difficulty`; first try wrong → 2; previously wrong now correct → `fix:<sid>:<qid>:<date>` with 15; otherwise no award.

Same pattern for:
- `self-assessments/[id]/submit`: 3 × attempted, max 120; revision items for wrong answers.
- **The test-finish path** in `lib/attempts.ts` (submitted, auto-submitted or teacher-finalized; never while paused): 80, `test:<sid>:<testId>`, streak protection. A teacher void (secure-tests.md §7) adds `award({ kind: 'test.void', key: 'void:<sid>:<testId>', xp: -80 })` and removes personal-best eligibility. Undoing a void adds `unvoid:<sid>:<testId>` (+80).
- **The release path** in `lib/test-completion.ts`: personal best `pb:<sid>:<testId>` + test revision items, only when review is allowed and the attempt isn't voided.

## 5. API (new routes under `src/app/api/engagement/`)

| Route | Role | Purpose |
|---|---|---|
| `GET /engagement/me` | student | XP, level (+ progress to next), today (xp, goal, goalMet), streak, freezes, settings, unseen celebrations |
| `PATCH /engagement/settings` | student | goal (applies tomorrow), leagueHidden, allowDuels, nudges, nudgeTime (07:00–21:30), eventPushes, weeklyRecap, frame, accent |
| `GET /engagement/daily` · `POST /engagement/daily/answer` | student | today's 5 (created on first GET) and answering |
| `GET /engagement/revision` · `POST /engagement/revision/answer` | student | due/all mistakes; answering moves boxes |
| `GET /engagement/outlook` | student | exam countdown, expected-marks range, subject mastery |
| `GET /student/roadmap?subject=` (extended) | student | + mastery, state, youAreHere, next[], milestones |
| `GET /engagement/league?week=current\|previous` | student | top 10 + me, or "not enough members" |
| `GET /engagement/badges` | student | earned + locked with progress |
| `GET /engagement/recap?week=previous` | student | weekly recap data |
| `POST/GET /engagement/challenges` | teacher, tuition / student | batch challenges |
| `POST /engagement/shoutouts` · `GET /engagement/shoutouts` | teacher, tuition / student | shout-outs (≤ 5 per teacher per day) |
| `GET /engagement/batch/[id]` | teacher, tuition | engagement view of a batch |
| `POST /engagement/duels` · `POST /engagement/duels/[id]/(accept\|decline\|answer)` · `GET /engagement/duels` | student | duels |
| `POST/GET /engagement/squads` · `POST /engagement/squads/[id]/(invite\|accept\|leave\|nudge)` | student, teacher | squads |
| `PATCH /tuition/profile` (extended) | tuition | `examDates`, `engagement.enabled` |

Authorization: students only see their own data, their batch's league (visible members), and squad/duel data they're part of; teachers only the batches they teach (reuse the existing batch membership helpers in `lib/teaching.ts`/`lib/members.ts`); the tuition sees all its batches.

## 6. League query

```ts
// Weekly XP per visible batchmate; hidden students are excluded for peers but still get their own rank.
const rows = await XpEvent.aggregate([
  { $match: { batchId, weekKey, league: true } },
  { $group: { _id: '$studentId', xp: { $sum: '$xp' }, reachedAt: { $max: '$at' } } },
  { $sort: { xp: -1, reachedAt: 1 } },
]);
// Join names/levels; remove leagueHidden students (except me); if visible < minVisible → { available: false }.
```

## 7. Engagement push (gentle policy)

```ts
// src/lib/engagement/push.ts
export async function engagePush(studentId: Types.ObjectId, message: PushMessage) {
  const now = new Date(), hour = istHour(now);
  const { quietFrom, quietTo } = ENGAGEMENT.nudges;
  if (hour >= quietFrom || hour < quietTo) return false;                     // quiet hours: drop, don't queue
  if (await hasActiveAttempt(studentId)) return false;                       // never during a test (TestAttempt started, not submitted)
  const eng = await StudentEngagement.findOne({ studentId }).select('settings').lean();
  if (eng && eng.settings?.eventPushes === false) return false;
  return pushOnce(`engage:${studentId}:${istDate(now)}`, [studentId], message); // at most 1 event push per day
}
```

The daily practice nudge is **local** (app-side `armReminders`, app-experience.md). The server sends only event pushes (duel invite, shout-out, challenge launched, squad nudge) through `engagePush`, at most 1 a day. Existing test/announcement pushes are untouched.

## 8. Tests (`tests/engagement-*.test.ts`, run with `npm test`)

Cover at least:
- award idempotency (the same key twice → one event, `duplicate: true`)
- practice first-try vs. fix vs. re-answer XP; the difficulty multiplier
- the daily practice cap and the speed guard (fast taps → 0 XP but answers still saved)
- late-night XP excluded from the league
- streak across IST midnight, freezes used, repair at 2× goal, exam-day protection
- level boundaries (`levelForXp(xpForLevel(L)) === L`)
- revision box transitions and IST due dates; test items only after release
- daily challenge stable for the day, correct composition, fallback when the bank is small
- league visibility (hidden, minimum members, ties) and authorization (no cross-batch reads)
- engagePush: quiet hours, active-attempt skip, 1/day dedupe
- existing route responses still contain all their old fields (regression)

## 9. Performance and data

- Indexes as above; `XpEvent` grows fast (~50/day per active student), so query by `studentId+date` or `batchId+weekKey` only. Consider a TTL or archiving after 18 months, keeping `DailyActivity` and `StudentEngagement` as the long-term summary.
- `/engagement/me` should be one indexed read of `StudentEngagement` + today's `DailyActivity`.
- Mastery: compute per student on demand from the existing topic stats (cached per request); precompute nightly only if it gets slow.
- Feature flag per tuition: `Tuition.engagement.enabled` (default true) is checked in `award()` and the student routes.
