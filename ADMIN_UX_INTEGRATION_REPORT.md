# Admin UX Integration Report — STEP 1

Date: 2026-10-30
Destination: `pcmb-paper` (branch `main`)
Source: `pcmb-paper-admin-ux` (git worktree of `pcmb-paper`, branch `feature/admin-independent-ux`)

## 1. Summary

The Tuition Admin UX work from `pcmb-paper-admin-ux` is now in `pcmb-paper`. The tuition admin's tabs are now **Home · Batches · People · Tests · Profile** (previously Home · Batches · Teachers · Students · Profile). Student and teacher screens are unchanged. No dependencies, environment files, backend code, databases or question data were touched.

- Type check: **pass** (was pass before).
- Lint: **pass** (was pass before).
- Unit tests: **72/72 pass** (56 existing + 16 new admin tests).
- Android production bundle (`expo export`): **builds**.
- `expo-doctor`: **not run**. The machine can't reach the npm registry (`EHOSTUNREACH`), which is an environment issue.

## 2. Workspace and destination

| Folder | What it is |
|---|---|
| `pcmb-paper` | Main Expo app (`main`). **Destination.** |
| `pcmb-paper-admin-ux` | Source. A worktree of the same repo; all admin work is **uncommitted** there. |
| `papers` | Backend: Next.js 14-style app router + MongoDB (Mongoose). Also hosts the Super Admin web console. Separate git repo (`rushikeshshirmanwar90/papers`). |
| `exambank-engine` | Independent Python project. Not touched. |
| `pyq-examwise-beta-backup-report` | Older backup/patch report. Not touched. |

The brief named `pcmb-admin` as the destination. That folder does not exist. This was reported, and the owner chose `pcmb-paper`.

## 3. Project inspection

| Area | `pcmb-paper` (destination) | `pcmb-paper-admin-ux` (source) |
|---|---|---|
| Expo SDK | **58** (`expo ^58`, RN 0.88.1, React 19.3) | 57 (`expo ~57.0.31`, RN 0.86.3, React 19.2.3) at its committed HEAD |
| Installed `node_modules` | SDK 58 | Symlink to `pcmb-paper/node_modules`, so it already ran on SDK 58 |
| Git position | `main` @ `e4294b4` | `aafccb6`: 0 commits ahead, **6 behind** `main` |
| Entry point | `expo-router/entry`, `src/app/_layout.tsx` | same |

**Navigation.** Expo Router hosts a single shell. `src/app/_layout.tsx` calls `tabsFor(user.role)` from `src/navigation/role-tabs.tsx`. That gives each role its own swipeable bottom-tab set (`TabProvider` / `goToTab(key)` in `src/context/tab-context.tsx`). Detail views are in-tab sheets (`DetailSheet`), not routes.

**Authentication.**
- The app keeps a JWT in `expo-secure-store` (`src/services/session-store.ts`) and sends it as `Authorization: Bearer` (`src/services/api-client.ts`).
- The server (`papers/src/lib/auth.ts`, `jose`) signs `{role, tid, v: tokenVersion}`. `requireUser(req, ...roles)` enforces the role and supplies `tuitionId` for institute isolation.
- Accounts start with no role or tuition, then join with a code (`join-tuition-screen.tsx`).

**Roles and screens:**

| Role | Tabs / screens |
|---|---|
| Super Admin | **Not in the mobile app.** Web console in `papers/src/app/admin` + `/api/admin/*`. Uses the `ADMIN_API_KEY` header or an admin session cookie. Creates and manages tuitions and users. |
| Tuition Admin | `src/screens/tuition/*` (changed in this step) |
| Teacher | `src/screens/teacher/*`: home, batches, Test Room (`teacher-tests`), questions/PDF tools, profile |
| Student | `src/screens/student/*`: home, tests + `test-runner`, roadmap, topic practice (PYQs), profile. "My PDFs" uses `pdf-library` / `question-pdf` |

**API.**
- The origin is **hard-coded** to `https://papers-jet.vercel.app` (`src/services/apiService.ts:3`).
- Typed clients: `tuition-api.ts`, `school-api.ts`, `student-api.ts`, `email-api.ts`, plus the question-bank calls in `apiService.ts`.
- `tuition-api.ts`, `school-api.ts` and `api-client.ts` are byte-identical in source and destination.

**Shared UI.** `src/components/kit.tsx` provides Screen, Card, Button, Chips, Segmented, DetailSheet, Notice, StatTile, `useLoad`, `usePalette`, and others. The only difference between the two copies is SDK 58's `TextInputInstance` ref type in the destination. The source's admin code doesn't depend on that difference.

**Data structures (server):**
- **Batch:** `{tuitionId, name, track, standard?, subjects[], venue, schedule[{day,start,end}], teachers[{teacherId, subject}], active}`.
- **User:** one document per person; `role ∈ {tuition, teacher, student, null}`.
  - Teachers: `subjects[]`.
  - Students: `track`, `standard`, `batchId`, `parentPhone`.
- **JoinRequest:** `{userId, tuitionId, status, acceptedAs}`.
- **Tuition:** `joinCode` (one per institute).
- **Invitations:** none exist yet. Joining is code + request + admin approval.

## 4. Files inspected

**Mobile (both copies):**
- `package.json`, `tsconfig.json`, `app.json`, `AGENTS.md`
- `src/navigation/role-tabs.tsx`, `src/context/tab-context.tsx`, `src/context/data-version.ts`
- `src/constants/school.ts`, `src/constants/syllabus.ts`, `src/types/pcmb.ts`
- `src/components/kit.tsx`
- `src/services/{api-client,apiService,school-api,tuition-api,session-store}.ts`
- every file in `src/screens/tuition/`
- `tests/*.test.mjs`

**Backend (read only):**
- `src/models/{Batch,User,Question,Paper,Student,ChapterWeightage,TestRoom}.ts`
- `src/lib/{school,tuition,join-code,pyq,practice,tests,auth,admin,syllabus}.ts`
- `src/app/api/tuition/batches/**`, `tuition/join-code`, `tuition/join-requests/[id]/accept`
- `src/app/api/join-requests`, `src/app/api/tests/**`, `src/app/api/analysis/{test,student}/[id]`, `src/app/api/filters`, the `src/app/api/pyq/*` routes

**Git history:**
- `git diff aafccb6 main`: what `main` gained since the source branched.
- `git diff` in the worktree: the uncommitted admin work.

## 5. Source vs destination: classification

`main`'s 6 newer commits touched SDK 58, math rendering, topic practice and the student Practice tab. Of the admin-UX files, they changed only `role-tabs.tsx`, and that in the student section. Every tuition screen in `main` was byte-identical to the source's base, so no newer destination code was overwritten.

| Item | Classification | Action |
|---|---|---|
| Tuition Home: join-code card (copy / share / renew), "Assign them in People" link, Android back → Home | Useful improvement | Integrated |
| Batches: cards with track tone, day strip, missing-teacher warnings, week schedule, grouped form | Useful improvement | Integrated |
| People tab (Students + Teachers under one segmented tab) | Useful improvement | Integrated |
| Students panel: search, track / class / batch filters, batch picker that lists the student's own track first | Useful improvement | Integrated |
| Teachers panel: search, subject filter, 2×2 subject picker, warning about batches lost when subjects are removed | Useful improvement | Integrated |
| Tests tab (view-only: every test, participation, per-student results, analysis) | Useful improvement. Backend already supports the tuition role | Integrated |
| Profile: grouped Institute / Syllabus / Settings (appearance) / Account; weightage editor polish | Useful improvement | Integrated |
| Shared admin pieces (`admin-ui.tsx`, `admin-filters.ts`, `people-nav.ts`) + unit tests | Useful improvement | Integrated |
| Join requests sheet, schedule editor, reset-password sheet, notifications | Already present (unchanged in source) | No change |
| Student PYQ tab (`student-pyq.tsx`) in the source's `role-tabs` | **Obsolete.** `main` replaced it with topic Practice | Kept `main`'s version |
| Source `package.json` / lockfile (SDK 57) | **Obsolete / older** | Not copied |
| `pcmb-paper-admin-ux.zip`, `.impeccable/`, `.claude/` in the source | Unrelated | Not copied |
| Admin UX requiring new endpoints | None found | n/a |

## 6. Files changed in `pcmb-paper`

Modified:
- `src/navigation/role-tabs.tsx`: the tuition tabs are now Home, Batches, People, Tests, Profile. Hand-merged so `main`'s student Practice tab stays.
- `src/screens/tuition/tuition-home.tsx`
- `src/screens/tuition/tuition-batches.tsx`
- `src/screens/tuition/tuition-students.tsx`: exports `StudentsPanel` (replaces `TuitionStudentsScreen`).
- `src/screens/tuition/tuition-teachers.tsx`: exports `TeachersPanel` (replaces `TuitionTeachersScreen`).
- `src/screens/tuition/tuition-profile.tsx`

Added:
- `src/screens/tuition/admin-filters.ts`
- `src/screens/tuition/admin-ui.tsx`
- `src/screens/tuition/people-nav.ts`
- `src/screens/tuition/tuition-people.tsx`
- `src/screens/tuition/tuition-tests.tsx`
- `tests/tuition-admin.test.mjs`
- `ADMIN_UX_INTEGRATION_REPORT.md` (this file)

Copied files were converted to CRLF to match the working copy (`core.autocrlf=true`). The diff (1,356 insertions, 405 deletions) is identical to the source's.

Nothing was committed. Nothing was pushed. The existing uncommitted `package-lock.json` change in `pcmb-paper` was there before this step and is untouched.

## 7. Intentionally not integrated

- Source `package.json` / `package-lock.json`: SDK 57, older than `main`.
- Source `student-pyq.tsx` route wiring: superseded by `main`'s topic Practice.
- Student / teacher invitation codes, bulk import, onboarding redesign: out of scope for STEP 1.
- Comment-only nit: `src/context/data-version.ts:4` still says "Teachers tab". Left alone to keep the change set minimal.

## 8. Validation

| Check | Command | Before | After |
|---|---|---|---|
| TypeScript | `npx tsc --noEmit` | exit 0 | **exit 0** |
| Lint | `npx expo lint` | exit 0 | **exit 0** |
| Unit tests | `node --experimental-strip-types --test tests/*.test.mjs` | 56/56 pass | **72/72 pass** |
| Bundle / navigation imports | `EXPO_OFFLINE=1 npx expo export --platform android` (output in scratchpad, not the repo) | — | **builds** (5.6 MB Hermes bundle) |
| Expo dependency health | `npx expo-doctor` | — | **Not run.** `EHOSTUNREACH` to registry.npmjs.org (environment, not code) |
| Navigation references | grep for `TuitionStudentsScreen`, `TuitionTeachersScreen`, `goToTab('students'\|'teachers')` | — | No remaining references. `goToTab('tests')` in `student-home.tsx` targets the student's own tab set, so it is unaffected |

Not executed: on-device or simulator interaction tests (none exist in the repo, and no device was available).

## 9. API compatibility and backend dependencies

Every call in the integrated screens exists in the local `papers` backend and is allowed for `role: tuition`:

| Call | Endpoint | Server rule |
|---|---|---|
| `tuitionApi.*` (batches, students, teachers, joinCode, renewJoinCode, profile, weightage, overview, passwords) | `/api/tuition/**` | `requireUser(req, "tuition")`, scoped by `tuitionId` |
| `schoolApi.tests(batchId?)` | `GET /api/tests` | any member. The tuition gets all of its own tests (max 200) |
| `schoolApi.test(id)` | `GET /api/tests/:id` | `testFor` checks `tuitionId` + batch membership |
| `TestAnalysisSection` | `GET /api/analysis/test/:id` | `requireUser(req, "tuition", "teacher")` |
| `StudentInsightSheet` | `GET /api/analysis/student/:id` | the student's tuition only |

No backend change was needed or made.

Caveats:
- The app always calls the **deployed** server (`papers-jet.vercel.app`). This review covers the local `papers` source. If production is behind local, re-check `/api/tests` for the tuition role there.
- The server gives the tuition **edit** rights on tests (`canEdit`). The new Tests tab is deliberately view-only, so this is a UX choice, not a permission change.
- `Clipboard` (join-code copy) comes from `react-native` core. It's deprecated in RN 0.88 and warns when first used. `expo-clipboard` is not installed, so it wasn't added (no dependency changes).

## 10. Batch system audit (investigation only)

| Aspect | Current behaviour | Where |
|---|---|---|
| Schema | see §3 | `papers/src/models/Batch.ts` |
| Tracks | `NEET`, `JEE`, `General` (Mongo enum) | `papers/src/lib/school.ts`, mirrored in `pcmb-paper/src/constants/school.ts` |
| Classes | `11th`, `12th`, or none ("both") | `STANDARDS` |
| Subjects | Physics, Chemistry, Mathematics, Biology. Must be a non-empty subset of `SUBJECTS_BY_TRACK[track]` | `readBatch` in `papers/src/lib/tuition.ts` |
| Teacher assignment | `teachers[{teacherId, subject}]`, one teacher per subject. Must be a teacher of the same tuition. Removing a subject drops its teacher | `readBatchTeachers` |
| Student assignment | On the student: `User.batchId` (one batch per student). `readBatchId` checks the batch belongs to the tuition | `User.ts`, `tuition.ts` |
| Joining code | **One per institute** (`Tuition.joinCode`, 8 chars, no look-alikes). It isn't tied to a batch or role: the admin picks student/teacher, track, class and batch when accepting. Renewing invalidates the old code. Wrong guesses wait 800 ms | `lib/join-code.ts`, `api/join-requests`, `api/tuition/join-requests/[id]/accept` |
| Permissions | Batch CRUD: tuition only. Teachers see the batches they're assigned to (`batchIdsOf`). Students see their own | `lib/members.ts`, `lib/teaching.ts` |
| Delete cascade | Deleting a batch removes its timetable, tests, attempts, syllabus progress and batch-only announcements. Students are kept with no batch | `api/tuition/batches/[id]` DELETE |
| Test dependency | `TestRoom.batchId`. `subject` / `standard` are **free text** (≤40 / ≤10 chars), not tied to track | `api/tests` POST |
| Question-bank dependency | Indirect. A student's practice pool is derived from `User.track` (not the batch) via `pyqTrackFilter` | `lib/pyq.ts` |
| Weightage | `ChapterWeightage` keyed by `(tuitionId, track, subject, standard, chapter)` | `models/ChapterWeightage.ts` |

Limitations:
1. The track is a closed enum that conflates three things: the exam goal, the subject set, and the question-bank filter.
2. Classes are limited to 11th / 12th (`Foundation` 9th / 10th exists only in the question bank).
3. Subjects are fixed to PCMB. There's no Board / English / custom subject.
4. A student belongs to at most one batch.
5. A batch has one teacher per subject.
6. The student's `track` and their batch's `track` are stored separately and can disagree.
7. The join code is institute-wide only.
8. There's no academic year or session on a batch.
9. `active` exists on the batch but isn't exposed in the UI.

## 11. Question-bank limitations (record only, nothing changed)

Only JEE / NEET questions exist. Hard-coded exam / track values:

| Location | Hard-coded value | Effect of adding a program |
|---|---|---|
| `papers/src/lib/school.ts` + `pcmb-paper/src/constants/school.ts` | `TRACKS`, `SUBJECTS_BY_TRACK`, `STANDARDS` | Must change together. Both are mirrored by hand |
| `papers/src/models/{Batch,User,ChapterWeightage}.ts` | `enum: TRACKS` | Widening the enum is safe for existing data |
| `papers/src/lib/pyq.ts` `EXAMS: Record<Track, …>` | `NEET` / `JEE` source regexes; **`General: null` = any exam** | **Highest risk.** A new track left `null` (or `General`-like) would serve JEE / NEET PYQs as, for example, CET practice. New tracks need an explicit "no question bank yet" state |
| `papers/src/lib/pyq.ts` `trackFilter` | `examCategory: "JEE/NEET"` | All practice is pinned to the JEE / NEET bank |
| `papers/src/models/{Question,Paper}.ts`, `shared/types.ts`, `api/filters` | `examCategory ∈ {Foundation, JEE/NEET}`, `examType ∈ {JEE, NEET, Foundation}` | Bank taxonomy. Leave unchanged until real CET / HSC data exists |
| `papers/src/models/Student.ts` | `targetExam ∈ {JEE, NEET}` | Legacy model (used only by `api/dashboard`) |
| `pcmb-paper/src/constants/syllabus.ts`, `src/types/pcmb.ts` | `'JEE/NEET'` category, 11th / 12th | Question browser / PDF builder filters |
| `pcmb-paper/src/screens/tuition/admin-ui.tsx` `trackTone` | JEE → primary, NEET → success, else neutral | New tracks fall back to neutral (safe) |
| `pcmb-paper/src/screens/tuition/join-requests.tsx` | Default track `'NEET'` on accept | Should become "choose" or the institute's default |
| `pcmb-paper/src/screens/teacher/teacher-tests.tsx` | "−1 mark (NEET/JEE style)" label | Copy only |
| `pcmb-paper/src/services/apiService.ts`, `src/context/rooms-context.tsx` | Mock JEE / NEET questions and rooms | Demo data. Not shown for new tracks |
| Student overview / roadmap / pyq routes | `user.track ?? "General"` | A student without a track gets every subject and any-exam PYQs |

## 12. Recommended data-model changes for STEP 2

1. **Split "program" from "question-bank source".** Add a `Program` concept: either a server constant list or a per-tuition collection for custom programs. Give it `{key, label, subjects[], standards[], questionBank: "JEE" | "NEET" | null}`. Existing `NEET` / `JEE` / `General` map one-to-one. MHT-CET PCM/PCB, HSC Board, Foundation and Custom start with `questionBank: null`. The UI then says "No question bank yet" instead of borrowing JEE / NEET questions.
2. **Make `pyq.ts` refuse unknown banks.** Any track without an explicit bank returns an empty pool, never "any exam". Decide deliberately whether `General` keeps "any".
3. **Widen classes**, ideally to a per-program `standards[]`: 9th, 10th, 11th, 12th, Repeater/Dropper, plus "Custom".
4. **Subjects:** keep PCMB as the bank-backed set, and allow additional non-bank subjects per program (e.g. English for HSC) that don't enable PYQs or bank-sourced tests.
5. **Batch additions:** `program` (replacing or alongside `track`), `academicYear`, and expose `active` (archive instead of delete, given the destructive cascade).
6. **Student ↔ batch consistency:** derive the student's practice program from their batch, or validate that they match on assignment.
7. **Invitation codes (STEP 2+):** a new `Invitation` collection `{tuitionId, role, batchId?, program?, code, expiresAt, maxUses, uses}`, alongside the existing institute join code. Don't repurpose `Tuition.joinCode`.
8. **One source of truth for constants:** generate or serve `school.ts` from the server (e.g. `GET /api/school/config`) so mobile and server can't drift.
9. Migration: widening enums is non-destructive. Back-fill `program = track` for existing batches and users. No question data changes.

## 13. Risks to Student and Teacher functionality

- **Students / Teachers:** no shared file they use was changed (`kit`, services, contexts and their screens are untouched). Their tab sets in `role-tabs.tsx` are unchanged. Risk: low.
- **Tuition admins:** tab keys changed (`teachers`/`students` → `people`/`tests`). Push notifications that deep-link with `data.tab: "students"` or `"teachers"` would now fall back to Home (`goToTab` uses index 0 for unknown keys). The server's pushes use only `tab: "home"` and `tab: "tests"`. Neither breaks: a `"tests"` push now opens the tuition's new Tests tab, where it used to fall back to Home.
- **Android back button:** `useBackToHome` runs only inside the tuition Home screen. Other roles are unaffected.
- **Deployed backend drift:** see §9.
- **Deprecated `Clipboard`:** a future RN upgrade may remove it. Switch to `expo-clipboard` (via `npx expo install`) when dependencies are next updated.
- **Lists are capped:** students at 500, tests at 200 per request. The UI shows a notice past the cap. Very large institutes need server paging.

## 14. Suggested next steps for STEP 2

1. Commit this integration on a branch in `pcmb-paper` and smoke-test the tuition login on a device. Check People switching, the join-code copy/share, and the Tests tab against the deployed server.
2. Implement the `Program` model (§12.1–12.2) on the server first, with `questionBank: null` for non-JEE/NEET programs. Then drive the mobile Batch / Student forms from it.
3. Then design the onboarding and invitation flow on top of `Program` and `Invitation`.
