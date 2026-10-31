# Admin UX Step 2.5: Batches, Timetable, Onboarding, Migration, Local Integration

Date: 2026-10-30. Repos: `papers` (backend) and `pcmb-paper` (app).
Nothing was committed, pushed or deployed. The production database was **only read**. The migration was never applied to it.

## Outcome

- **Programs:** new batches and new students can only be JEE or NEET, 11th or 12th. Existing MHT-CET, HSC and General records are kept as they are and stay editable.
- **Timetable:** a new timetable sheet.
  - Monday–Saturday are picked by default; Sunday is off but selectable.
  - Times use the native picker and show in 12-hour AM/PM; they're stored in 24-hour form as before.
  - Overlapping classes are refused.
  - Nothing is saved until **Save timings** is tapped.
- **Onboarding:** students need a program and a class. Teachers and students can be added before any timetable exists.
- **Migration:** a versioned, idempotent migration script. Its dry run against the live `pcmb` database plans 4 field additions and flags 1 record for manual review.
- **Local integration:** the app can point at a local API through an environment setting. A new `npm run dev:local` runs the API against a local database, so local testing never touches Atlas.
- **End-to-end check:** the full Tuition Admin flow passed against the local API (17/17 steps).

## Files modified

**`papers`**
- `src/lib/school.ts`: `OFFERED_PROGRAMS` (JEE, NEET), `isOffered`, `notOffered`.
- `src/lib/tuition.ts`:
  - new batches and program changes only to offered programs (requests that name a `program`)
  - `readNewStudent` requires an offered program and a class
  - `readSchedule` rejects overlapping class slots
- Routes:
  - `tuition/students` (create)
  - `tuition/students/[id]` (no moving a student to a program that isn't offered)
  - `tuition/join-requests/[id]/accept`
- New:
  - `scripts/migrations/2026-10-30-step25-academic-programs.mjs`
  - `scripts/dev-local.mjs`
  - `scripts/e2e-local-flow.mjs`
  - `tests/migration-step25.test.ts`
- `tests/academic-programs.test.ts`: updated for this release, plus timing tests.
- `package.json`: `dev:local` script.
- `.gitignore`: `/.local-mongo/`.

**`pcmb-paper`**
- New:
  - `src/services/api-origin.ts`
  - `src/screens/tuition/timetable-draft.ts`
  - `src/screens/tuition/time-field.tsx`
  - `src/screens/tuition/timetable-sheet.tsx`
  - `.env.example`
  - `tests/step25.test.mjs`
- `src/services/apiService.ts`: API origin from `resolveApiOrigin`.
- `src/constants/school.ts`: `OFFERED_PROGRAMS`, `programChoices`.
- `src/screens/tuition/tuition-batches.tsx`:
  - JEE/NEET only in New batch
  - the edit form offers JEE/NEET plus the batch's own program
  - timings moved to the timetable sheet
  - the edit form no longer sends the schedule
- `src/screens/tuition/tuition-students.tsx`:
  - JEE/NEET for new students; a student keeps their own program
  - class required for new students
  - "Add student" from a batch's list starts in that batch
- `src/screens/tuition/join-requests.tsx`: JEE/NEET only, class required.

The changes from Steps 1 and 2 are still uncommitted, as is the earlier `package-lock.json` change. All were left as they were.

## Batch timing UX

The **Timings** sheet opens from the batch's *Weekly timings › Add/Change* and from *Set class timings*.

- **Days:** chips Mon…Sun, with Mon–Sat picked to start, plus quick links: Mon–Sat, Mon–Fri, Every day, None.
- **Times:** Starts and Ends fields, shown as "4:00 PM":
  - Android: the system time dialog in 12-hour mode.
  - iOS: the system compact time picker.
  - Expo Go and web (no native module): a built-in chooser for hour, minute in 5-minute steps, and AM/PM.
  - The native picker comes from `@expo/ui`, which was already a dependency. No new packages were added.
- **Adding:** a live preview line ("Mon–Sat · 4:00 PM – 6:00 PM (2 h)"), then **Add to 6 days**. One range goes to every picked day; add again for different times on other days.
- **The week:** grouped by day, Monday first, with the weekly total. Each class has **Edit**, which loads it into the form as **Update class**, and **Remove**.
- **Validation:** client and server. The start must be before the end, and same-day classes can't overlap (back-to-back is fine; the same slot twice counts as an overlap).
- **Saving:** only on **Save timings**. Closing with changes asks "Discard the timing changes?".
- **Existing schedules:**
  - They load unchanged.
  - Editing other batch details no longer sends the schedule.
  - A batch saved before overlaps were checked keeps its schedule (tested).

## Student and teacher onboarding

All of these are stored on the existing collections; no new ones were added.

- **Student:**
  - `tuitionId`
  - `program` (JEE/NEET for new students) with its legacy `track`
  - `standard` (required for new students)
  - `batchId` (optional; it must match the student's program and class)
  - `active` (account status)
- **Teacher:**
  - `tuitionId`
  - `subjects`
  - batch assignments in `Batch.teachers`, shown on the teacher's page
  - `active`
- Neither students nor teachers need a timetable first.
- The hierarchy, authentication and authorization are unchanged. Every route still uses `requireUser(req, "tuition")` scoped by `tuitionId`.
- No invitation codes were added.
- Older-app requests (track only) keep their old rules. That includes "General" batches and students, which the currently deployed app can still create.

## Existing database records identified

The inventory used read-only commands only and printed counts only. Connected database: **`pcmb`** (verified with `dbStats`), 19 collections.

| | Count | Shape |
|---|---|---|
| Users | 5 | 1 tuition admin, 1 teacher (1 subject, active), 2 students (both track JEE, active, in a batch), 1 account with no role or tuition yet |
| Students | 2 | JEE 12th in the JEE 12th batch; **JEE 11th in the JEE 12th batch** |
| Batches | 1, then **2** at the time of the dry run | track JEE, active; no `program`, no `academicYear` |
| Tuitions | 1 | active |
| Join requests | 2 | accepted (1 student, 1 teacher) |

None of these problems were found:
- Records pointing at missing tuitions, batches or teachers.
- Teachers assigned outside their tuition or subject.
- Overlapping schedules.
- Teachers with student fields.

Not migration subjects (counts only): 278,034 questions, 1,465 papers, 2 test attempts, 17 practice answers. The legacy `students` collection is empty.

**The live database is in use.** A second batch appeared between the inventory and the dry run, so re-run the dry run immediately before any apply.

## Migration dry-run results

Run read-only against `pcmb` (refs are anonymized):

```
Would set program on: 2 batches, 2 students (already set: 0 batches, 0 students)
  B-b000a575  batches  program: (none) -> JEE  [only if still: track=JEE, no program]
  B-f2a28beb  batches  program: (none) -> JEE  [only if still: track=JEE, no program]
  S-70908c2a  users    program: (none) -> JEE  [only if still: role=student, track=JEE, no program]
  S-a1e683be  users    program: (none) -> JEE  [only if still: role=student, track=JEE, no program]
Notes (no change): B-b000a575, B-f2a28beb: no academic year; not filled in
```

**What the migration does:**
- It writes only `program`, on `users` (students) and `batches`, and only where the existing track is JEE or NEET and matches the student's batch.
- It never fills in a class, subject, academic year, tuition or batch.
- It never deletes, drops or renames anything, and never touches questions, papers, test attempts, practice answers or syllabus records.

**Safety:**
- The default mode is a read-only dry run.
- `--apply` / `--rollback` need `--confirm-db pcmb`, plus `--allow-remote` for Atlas.
- Each update is conditional (`program` absent, track unchanged), so re-runs change nothing.
- Every run is recorded in `schemamigrations`: the changed ids, and a digest of each document's protected fields.

**Verification** (`--verify`) checks that:
- every changed record holds its new value
- protected fields are unchanged (credentials, role, tuition, batch, track, class)
- no records are missing
- nothing is still pending

**Rollback** (`--rollback`) removes only the `program` values the migration set, and only while they still hold that value.

**Tested:**
- In memory (9 tests): the dry run writes nothing, apply changes only `program`, a second apply is a no-op, verify passes and catches tampering, rollback restores the exact prior data.
- Rehearsed on the local database in the end-to-end run: apply, verify, logins still working, rollback.

## Ambiguous records (manual review)

| Ref | Issue | Suggested action |
|---|---|---|
| S-70908c2a | Student class **11th**, but their batch is **12th** | Fix the student's class or move them to an 11th batch. The migration still sets `program: JEE`, which is certain. The class is left alone. |
| B-b000a575, B-f2a28beb | No academic year | Set it in *Edit batch*. Not filled in automatically. |

A ref → `_id` map for these was written only to my local scratchpad (`step25-dry-run-refs.local.json`). Regenerate it with `--reveal <file>`, and don't commit it.

## Local API setup

1. **Backend:** in `papers`, run `npm run dev:local`.
   - Starts MongoDB on `127.0.0.1:27027`, database `pcmb_local`, data in `.local-mongo/`.
   - Uses its own JWT secret and admin key, and email is off.
   - `next dev` listens on the network and prints the LAN address.
   - Add `--fresh` to start from an empty database.
2. **Create a tuition:** `ADMIN_API_KEY=<printed key> node scripts/create-tuition.mjs --name "Local Classes" --email owner@local.test --password local-pass-123`.
3. **App:** add `EXPO_PUBLIC_API_URL=local` to `pcmb-paper/.env.local` (see `.env.example`), then `npx expo start --clear`.
   - **Physical Android device:** same Wi-Fi; it uses the address Metro shows.
   - **Android emulator:** `10.0.2.2`.
   - **iOS simulator:** `localhost`.
   - `local:4000` sets another port; a full `http://…` address also works.
4. **Release builds:** they ignore the setting and always use `https://papers-jet.vercel.app`. The release Android bundle was checked: it contains only that URL, and no database URI.
5. **End-to-end check:** `node scripts/e2e-local-flow.mjs`. It refuses any server other than localhost.

Notes:
- Development builds and Expo Go allow plain `http` to LAN addresses. Release builds don't need to.
- `pcmb-paper/.env.local` currently holds server secrets (`MONGODB_URI`, `JWT_SECRET`, SMTP). They're not bundled, because only `EXPO_PUBLIC_*` variables are, but they don't belong in the app folder. Consider removing them.

## Tests and build results

All run in this session on the final code.

| Check | Result |
|---|---|
| Backend `npm test` (in-memory MongoDB) | **134/134 pass** |
| Backend `npx tsc --noEmit`, `npm run lint` | pass, pass |
| Backend `npm run build` (Next.js 14 production) | **pass** |
| App unit tests (`node --experimental-strip-types --test tests/*.test.mjs`) | **99/99 pass** |
| App `npx tsc --noEmit`, `npx expo lint` | pass, pass |
| Android bundle (`EXPO_OFFLINE=1 npx expo export --platform android`) | builds |
| End-to-end against the local API and local database (`scripts/e2e-local-flow.mjs`) | **17/17 steps pass** |

The end-to-end run covered:
1. Super Admin creates a tuition.
2. The Tuition Admin logs in.
3. An older-app (track-only) batch and student are created.
4. Create Batch (NEET 11th, current year).
5. A non-offered program is refused.
6. Set timings (Mon–Sat 4–6 PM plus Saturday 9–11 AM).
7. An overlap is refused and the saved timings kept.
8. Add a teacher.
9. Assign the teacher.
10. Add a student (missing class and wrong-class batch refused).
11. Verify the batch.
12. The teacher logs in and sees the batch.
13. The student logs in and sees their batch and NEET practice.
14. The older-app student still logs in.
15. Migration rehearsal: dry run, apply, verify, rollback.

**Not done:**
- No device or simulator testing: I didn't run the app UI, the native time pickers, or the fallback chooser on a phone.
- `expo-doctor` (no registry access).
- Existing *production* accounts weren't logged into. Their compatibility is covered by tests and the local rehearsal.

## Remaining issues

1. **The UI is not device-tested**, including the native time pickers on Android and iOS and the Expo Go fallback.
2. **The deployed app can still create General batches and students** through the legacy track path. Refuse that path once old app versions are retired.
3. **Legacy fallbacks stay** (`programOf` derives the program from the track) until the migration is applied and verified, as required.
4. **One manual-review record:** the 11th student in a 12th batch. While they stay in it, the batch's class can't change.
5. Teacher batch assignment is still done from the batch, not from the teacher's page.
6. Live data is changing, so the dry-run counts can drift.

## Exact steps before migration, Git push and deployment

**Git**
1. Review the diffs in both repos. Both still include the Step 1 and Step 2 work.
2. Make a branch in each repo, then commit `papers` and `pcmb-paper` separately.
3. Don't add `.env.local`, `.local-mongo/`, or any `--reveal` output.
4. Push only when you decide to.

**Deploy the backend first**
5. Deploy `papers` to Vercel. No environment changes are needed. The backend works with unmigrated data through the legacy fallbacks.
6. Smoke-test on a device against production with the current admin login: create JEE/NEET batches, set timings, add a teacher and a student.

**Migration** (after a separate go-ahead)
7. Back up `users` and `batches` (an Atlas snapshot, or `mongodump --db pcmb --collection users/batches`).
8. Fix or accept the manual-review item (S-70908c2a).
9. Re-run the dry run, read-only:
   `node --env-file=.env.local scripts/migrations/2026-10-30-step25-academic-programs.mjs --db pcmb --out plan.json`
   Confirm the changes match what you expect.
10. Apply:
    `node --env-file=.env.local scripts/migrations/2026-10-30-step25-academic-programs.mjs --apply --confirm-db pcmb --allow-remote`
11. Verify: `… --verify`, which must report `ok: true`.
12. If anything is wrong, roll back: `… --rollback --confirm-db pcmb --allow-remote`, then restore from the backup if needed.

**App**
13. Build and release the app (EAS) after the backend is live.
14. Only after the migration is verified in production, remove the legacy fallback paths in a separate step.
