# Admin UX Step 2: Academic Programs and Batch Creation

Date: 2026-10-30. Repos: `pcmb-paper` (app) and `papers` (backend). Nothing committed or pushed. No database writes outside the app's own request handlers.

## Outcome

- **Programs:** a Tuition Admin can create 11th and 12th batches for six programs: JEE, NEET, MHT-CET PCM, MHT-CET PCB, HSC Science and General Tuition.
- **Quick creation:** the new-batch form has five fields. Teachers, classroom and timings come afterwards and are optional.
- **Question banks:** only JEE and NEET students get past-year questions. Every other program, including legacy *General*, gets a clear "not available yet" state and never falls back to JEE/NEET questions.
- **Compatibility:** existing batches, students, teachers, tests and attempts keep working unchanged.

## Features implemented

**Academic programs**
- The program is separate from its question bank: JEE → JEE bank, NEET → NEET bank, all others → none.
- Classes are 11th and 12th only.
- Subject rules:
  - JEE and MHT-CET PCM: any subset of PCM.
  - NEET and MHT-CET PCB: any subset of PCB.
  - HSC Science: PCM, PCB or PCMB (Physics and Chemistry, plus Maths and/or Biology).
  - General Tuition: any subset of PCMB.

**New batch** (Batches → *New batch*)
- Fields:
  1. Program
  2. Class (11th or 12th)
  3. Academic year: defaults to the session in progress and is editable as last, this or next year. A new session starts on 1 April, Indian time.
  4. Batch name: suggested, e.g. `NEET 11th A`, with the next free letter after that. Editable, with "Use …" to go back to the suggestion.
  5. Subjects: preselected from the program, editable within its limits.
- Primary action: **Create Batch**.
- After creating, the form shows the new batch with optional next steps:
  - **Assign teachers** and **Set class timings** open the edit form at that section.
  - **Manage students** opens People filtered to the batch.
  - **Open the batch**.
- **Create another batch** keeps the program, class and year and suggests the next name. The Batches list behind the form refreshes straight away.

**Batch management**
- Cards show:
  - the name
  - program, class and academic year badges
  - student count
  - teachers assigned (x/y)
  - class days
  - setup status: "Ready", or "Setup 1/3 · No teacher for Biology · No class timings"
- Filters by program and class appear when there's more than one option. Legacy batches for both classes get a "11th & 12th" filter.
- Batch details add:
  - program, academic year and classroom rows
  - a note on which question bank the batch's students use
  - a **Finish setting up** list
  - "Assign / Change / Manage" links on each section
- **Edit batch** keeps every advanced setting: program, class, year, name, subjects, teachers, classroom and timings. No new screens were added; everything uses the existing sheets.

**Consistency (app side)**
- Students panel:
  - The program filter replaces the track filter.
  - In the student form, picking a batch sets the student's program and class to the batch's.
  - "Change batch" lists only batches that fit the student.
- Join-request accept: chooses a program, and lists only fitting batches.

**Small compatibility changes elsewhere**
- Students, teachers and the Super Admin console now show the program instead of the legacy track. This covers the student profile, teacher batch badges, student insight, the Super Admin tuition page, and the tuition Home cards.
- Student Practice shows "*MHT-CET PCB practice isn't available yet*" (and similar) without loading anything.
- Home hides the *Practise* buttons for programs without a bank.

## Files changed

**`papers` (backend)**
- `src/lib/school.ts`: programs, banks, subject rules, `programOf`, student/batch fit, academic year.
- `src/lib/tuition.ts`: `readProgram`, new `readBatch` rules, `mustKeepStudentsFitting`, `readStudentBatch`, `mustFit`; `program` and `academicYear` added to `batchOut`, `program` to `studentOut`.
- `src/lib/pyq.ts`, `src/lib/practice.ts`: keyed by question bank. The "any exam" path is removed.
- `src/models/Batch.ts`, `src/models/User.ts`: optional `program` (both) and `academicYear` (Batch).
- Routes:
  - `tuition/batches/[id]` (PATCH guard)
  - `tuition/students`, `tuition/students/[id]`
  - `tuition/join-requests/[id]/accept`
  - `pyq`, `pyq/chapters`, `pyq/questions`, `pyq/topics`, `pyq/answer`
  - `student/overview`, `student/roadmap`
  - `analysis/student/[id]`
  - `admin/tuitions/[id]`
  - also `src/lib/auth.ts` (`publicUser` adds `program`)
- `src/app/admin/(console)/tuitions/[id]/page.tsx`: shows the program.
- New: `tests/academic-programs.test.ts`.

**`pcmb-paper` (app)**
- `src/constants/school.ts`: mirror of the backend rules, plus year choices and formatting.
- `src/services/tuition-api.ts`:
  - new fields
  - fills `program` from `track` when an older server omits it
  - sends the matching legacy `track` alongside `program`
- `src/services/student-api.ts`, `src/services/school-api.ts`, `src/context/auth-context.tsx`: optional `program` and `available` types.
- `src/screens/tuition/`:
  - `tuition-batches.tsx`: rewritten.
  - `admin-filters.ts`: batch filter, `setupOf`, `suggestBatchName`; the student filter moves from track to program.
  - `admin-ui.tsx`: `programTone`.
  - `tuition-students.tsx`, `join-requests.tsx`, `tuition-home.tsx`.
- `src/screens/student/`: `student-practice.tsx`, `student-home.tsx`, `student-roadmap.tsx`, `student-profile.tsx`.
- `src/screens/teacher/`: `teacher-batches.tsx`, `student-insight.tsx`.
- Tests: new `tests/academic-programs.test.mjs`; `tests/tuition-admin.test.mjs` switched from the track filter to the program filter.

Step 1 changes that are still uncommitted, and the earlier `package-lock.json` change, were left as they were.

## Backend/API changes

All changes are additive. Every existing field is still sent.

| Endpoint | Change |
|---|---|
| `POST /tuition/batches` | Accepts `program`, `academicYear`. With `program`, `standard` (11th/12th) is required and `academicYear` defaults to the current session. Track-only requests (older apps) keep the old rules, including "11th & 12th". `program` + `track` must agree. |
| `PATCH /tuition/batches/:id` | Same fields. An older app sending `track: "General"` keeps an MHT-CET/HSC batch's program. A program or class change is **refused while any student in the batch wouldn't fit**; students are never changed for it. |
| `POST /tuition/students`, `PATCH /tuition/students/:id`, `POST /tuition/join-requests/:id/accept` | Accept `program` (or legacy `track`). The batch must match the student's program and, when both are set, their class. Checked only when the program, class or batch changes, so legacy mismatches can still be edited. |
| Batch, student and user payloads | Add `program` (always set, derived from `track` for legacy records). Batch payloads also add `academicYear` (`null` for legacy batches). |
| `/pyq/topics`, `/pyq/questions`, `/pyq`, `/pyq/chapters` | Add `available` (and `program` where a track was already returned). With no bank: `available: false`, empty lists. |
| `/pyq/answer` | 404 when the user's program has no bank. |

Tenant isolation is unchanged: every lookup is still scoped by the session's `tuitionId`. Tests cover another tuition's batch and student.

## Data compatibility

- **No migration and no automatic writes.** Legacy records keep `track` only, and `programOf()` derives JEE→JEE, NEET→NEET, General→General Tuition. A record gets `program` stored only when an admin saves it.
- New records store both `program` and the matching legacy `track`: JEE/NEET for those programs, General for the rest. Older app versions therefore keep working, though they show MHT-CET and HSC batches as "General".
- Teacher and student assignments, tests (`TestRoom`), attempts (`TestAttempt`), practice answers and PDFs are untouched; a test checks this.
- No Question or Paper documents were modified.

## Question-bank safety

- `pyq.ts` now knows only two banks, JEE and NEET; it uses the same exam patterns as before. Practice is keyed by the program's bank.
- The old `General: null` path, which matched **any** exam's past questions, is gone.
- Students with no program and no track (and teachers, who have no program) also get no bank.
- Tests confirm:
  - JEE students see only JEE/AIEEE sources.
  - NEET students see only NEET/AIPMT sources.
  - Legacy JEE students practise as before.
  - MHT-CET PCM/PCB, HSC, General Tuition, legacy-General and no-program students get `available: false` with empty lists from all four list routes.
  - Those same students get a 404 when checking answers on known JEE or NEET question ids.
  - Cross-bank answer checks are refused.
- The existing topic-practice suite (JEE) passes unchanged.

## Test results

All of these were run on the final code in this session.

| Check | Result |
|---|---|
| Backend `npm test` (in-memory MongoDB) | **122/122 pass** (83 before + 39 new) |
| Backend `npx tsc --noEmit`, `npm run lint` | pass, pass |
| App `node --experimental-strip-types --test tests/*.test.mjs` | **86/86 pass** (72 before + 14 new) |
| App `npx tsc --noEmit`, `npx expo lint` | pass, pass |
| Android bundle (`EXPO_OFFLINE=1 npx expo export --platform android`, output in the scratchpad) | builds (5.6 MB) |

**Not run:**
- `expo-doctor` (the machine can't reach the npm registry).
- Device or simulator UI testing.
- A Next.js production build of `papers`.

## Unresolved issues

1. **Behaviour change for existing General-track students:** they lose past-year practice, which used to show questions from any exam. This is required by the brief; they see the "not available yet" state.
2. **Chapter weightage is still keyed by track.** MHT-CET, HSC and General Tuition students' roadmaps show the tuition's *General* weightage. The Profile weightage editor still offers NEET/JEE/General.
3. **Teacher tests can still use JEE/NEET bank questions for any batch.** That's a deliberate teacher choice, not a fallback, but it may need a rule.
4. **`/api/questions`, `/api/papers` and `/api/filters` are unauthenticated** (existing; used by the website and the teacher tools). This exposes the bank publicly, but no student screen uses them.
5. **Student subjects come from the program, not the batch.** An HSC PCB student's roadmap still lists Mathematics.
6. Older app versions can still create "11th & 12th" batches and batches without a year (through the legacy track path).
7. Batch names aren't unique on the server. The app only suggests free ones.

## Deployment requirements

1. **Deploy the backend first** (`papers`, production at `papers-jet.vercel.app`). No migration is needed: the new fields are optional and existing indexes are unchanged.
2. Then ship the app (EAS update/build). As a safety net, the app sends the matching legacy `track` with every `program`, so an app that reaches users before the backend still saves batches and students. They are saved as JEE/NEET/General, and the server falls back to the 11th & 12th and no-year rules.
3. Smoke-test on a device:
   - Create MHT-CET PCB 12th A, then "Create another".
   - Enroll a student into it.
   - Log in as that student: Practice should show the unavailable state.
   - Log in as a JEE student: practice should work as before.

## Recommendations for Step 3

1. Key `ChapterWeightage` by program. This needs a new index; add it alongside the existing one, without a destructive migration.
2. Decide the teacher-test rule for programs without a bank (allow JEE/NEET questions explicitly, or label them).
3. Student and teacher invitation codes, ideally per batch, so the program, class and batch are set by the code. Today an admin chooses them when accepting.
4. Use batch subjects for students of configurable programs (HSC, General Tuition).
5. Archive batches (`active` already exists) rather than deleting them, given the delete cascade.
6. Add login checks to the public question-bank routes, coordinated with the website.
