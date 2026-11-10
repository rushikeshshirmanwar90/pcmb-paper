# Code access: read the code only when the user says so

The user decides when Claude reads the codebase. **By default, don't scan or browse.** Plan from the saved knowledge:
- `docs/app-map.md`, if the user generated one
- the last-known map in §4 below
- secure-tests.md §1 for the test system

## 1. Rules

1. **No automatic scans.** Never run the mapper, list folders, grep, or open files "to check" unless the user asked for it in this conversation. Examples: "map the code", "scan", "read the codebase", "refresh the map", "check the code", or a phase command that says to map.
2. **Plan from the saved map.** The plan names the exact files you expect to change. The user's go-ahead on that plan is permission to open **those files only**. The edit tool has to read a file before it can change it, and that is the only reading allowed.
3. **Ask before reading anything else.** If the work needs a file that isn't on the approved list (say, to find where something is saved), ask in one line: "I need to open `src/…/x.ts` to see how Y is saved. OK?" Or offer a map refresh.
4. **A stale map means stop and ask.** If a file isn't where the map says, or its contents don't match the map, stop: "The saved map looks out of date (`…` moved). Should I refresh it?" Never quietly go looking.
5. **After a refresh the user asked for,** save it to `docs/app-map.md` and say in a few lines what changed against §4 (moved, renamed, new; for example, streaks already added). Adapt the plan to the code, never the code to this file.

## 2. The two repos

- **App:** `pcmb-paper` (Expo SDK 58, React Native 0.88, Expo Router, `src/`). This skill lives in its `.claude/skills/`.
- **Backend:** `papers` (Next.js App Router API routes + Mongoose/MongoDB: `src/app/api`, `src/models`, `src/lib`).
- If a task needs backend changes and the backend isn't reachable in this session, ask the user for its path. Suggest starting Claude Code with `claude --add-dir ../papers` (or the right path). Access isn't permission: the rules in §1 still apply. Never invent backend behavior.

## 3. Refreshing the map (only when the user asks)

```bash
node ${CLAUDE_SKILL_DIR}/scripts/map-app.mjs --out docs/app-map.md        # from pcmb-paper; finds ../papers automatically
node ${CLAUDE_SKILL_DIR}/scripts/map-app.mjs --api /path/to/papers         # if the backend lives elsewhere
```

It's read-only. It reports:
- the app stack and missing packages
- roles and their tabs
- student screens and their purpose, shared screens and who uses them
- routes, and kit exports with design-scope presence
- the student API client's endpoints
- engagement features already present
- backend routes with methods and allowed roles
- model fields and indexes, reusable helpers, and whether cron jobs and tests exist

The mapper doesn't replace reading; after a refresh, still open only what the user approves.

## 4. Last-known map (Nov 2026): the default source

**Student app** (tabs from `src/navigation/role-tabs.tsx`): Home · Tests · Syllabus (`StudentRoadmapScreen`) · Practice · Profile.
- `student-home.tsx`: Next up (test or class) → Today → Your progress (weak/strong topics, last result) → announcements. The week timetable and recent coverage are behind taps.
- `student-tests.tsx` + `test-runner.tsx`: teacher-assigned exam rooms with a **secure runner**. Details and files are in secure-tests.md §1. Results show only after the test closes and is released.
- `student-roadmap.tsx`: per subject, chapters of 11th + 12th with marks weightage, coverage by the tuition, and strong/weak topics.
- `student-practice.tsx`:
  - self-assessments (`self-assessment-flow.tsx`, `assessment-session.tsx`)
  - topic practice of past-year questions, subject → chapter → topic (`topic-practice-sheet.tsx`, `question-view.tsx`)
  - retaking weak topics
- `student-profile.tsx`: details, appearance, class reminders, account.
- Services: `student-api.ts` (`studentApi`), `school-api.ts` (teacher/tuition), `api-client.ts`, `notifications.ts` (push registration + local class reminders via expo-notifications), `preferences.ts`, `attempt-store.ts`.
- Kit: `src/components/kit.tsx` (`usePalette`, `Screen`, `Card`, `Button`, `useLoad`, …), shared by all three roles.
- Native: `modules/exam-security` (Android only: overlay hiding, multi-window).
- Packages present: reanimated, gesture-handler, pager-view, expo-notifications, expo-image, expo-sharing, expo-secure-store, expo-screen-capture, expo-crypto, expo-device, expo-intent-launcher.
- **Not yet installed:** expo-haptics, react-native-svg, react-native-view-shot, expo-keep-awake, expo-battery, @expo/app-integrity, expo-camera.

**Teacher / tuition app:** test creation (`create-exam-modal.tsx`), test management, live monitor (`test-monitor.ts`, `test-monitor-section.tsx`), attempt controls (`attempt-controls.tsx`), results, student performance.

**Backend (`papers`)**
- **Conventions:**
  - every route is `export const GET/POST = route(async (req, ctx) => …)` (`lib/http.ts`): throw `badRequest`/`notFound`/`HttpError`; parse with `readJson`, `text`, `oneOf`, `objectId`
  - auth via `requireUser(req, 'student' | 'teacher' | 'tuition')` → `{ user, role, tuitionId }`
  - responses are plain objects, with `export const dynamic = "force-dynamic"`
- **Time:** India-day logic via `todayInIndia()` (`lib/teaching.ts`) → `{ day, date: 'YYYY-MM-DD' }`. **All streak and goal days use the IST date.**
- **Student identity:** `User` with `role: 'student'`, `tuitionId`, `batchId`, `program` (JEE, NEET, MHT_CET_PCM, MHT_CET_PCB, HSC_SCIENCE, GENERAL), `standard` (11th/12th), `subjects`, `pushTokens`.
- **Learning data:**
  - `PracticeAnswer`: one per student + question, the latest answer; written by `POST /api/pyq/answer`
  - `SelfAssessment`: custom tests; `…/[id]/submit`
  - `TestAttempt`: exam rooms; `tests/[id]/*`; logic in `lib/attempts.ts`, `lib/attempt-visibility.ts`, `lib/attempt-control.ts`, `lib/test-completion.ts`
  - `SyllabusProgress`: what the tuition covered
  - `ChapterWeightage`: marks per chapter, per tuition and track
  - `Question`: difficulty Easy/Medium/Hard, chapter, topic, source PYQ, `answerType` MCQ/Numerical/…
- **Analytics already there:** `lib/topic-stats.ts` (`topicStatsByStudent`, `levelOf`: strong ≥ 70%, weak < 40%, min 3 answers), `GET /api/student/overview`, `GET /api/student/roadmap?subject=`.
- **Question supply:** `lib/pyq.ts` (`practiceBankOf(user)`, `pyqBankFilter(bank)`), `lib/marking.ts` (`cleanAnswer`, `isCorrect`), `lib/questionPick.ts`, `lib/assessment-pick.ts`.
- **Notifications:** `lib/push.ts` (`pushToUsers`; `pushOnce(key, …)` deduped through `NotificationLog`, TTL 3 days; `membersOf`).
- **Jobs and tests:** **no cron** (no `vercel.json` crons). Run tests with `npm test` (tsx --test, mongodb-memory-server) in `tests/`.
- **Gamification:** **none** (no XP, streak, badge, league, challenge, duel, squad or revision collections).

## 5. Hook points for the engagement system (from the saved map; if one has moved, ask to refresh)

| Learning event | Where it's written today | What the engagement layer does there |
|---|---|---|
| Practice answer checked | `POST /api/pyq/answer` (PracticeAnswer upsert) | `award('practice.answer', …)` + revision item on a wrong answer |
| Self-assessment submitted | `POST /api/self-assessments/[id]/submit` | `award('self.submit')` + revision items for wrong answers |
| Test finished (submitted, auto-submitted, finalized) | `lib/attempts.ts` finalize path | `award('test.submit')` (participation only); revision items **after results are released**; a void adds `test.void` (secure-tests.md §7) |
| Class topic covered | `POST /api/batches/[id]/progress` | feeds the daily challenge and roadmap "covered in class" |
| Results released / test closed | `lib/test-completion.ts` | unlocks test-based revision items and the personal-best bonus |

**Always add, never replace.** Existing behavior and responses must keep working for the current app version. New fields in responses are additive. New work lives in `lib/engagement/*` (and `lib/exam-*` for secure tests) and is called from these routes in one line each.

## 6. Docs that are out of date

`PRODUCT.md` describes an older teacher-only app, so trust the saved map over it. After shipping a phase, offer to update `PRODUCT.md` with the student experience.
