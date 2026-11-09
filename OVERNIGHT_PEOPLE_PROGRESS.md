# Overnight People Management progress

## Scope and safeguards
- 2026-11-04. Read root AGENTS.md and CLAUDE.md (which references AGENTS.md). No nested instructions in affected paths. Inspected parent design skills; their web styling guidance does not fit this native app. Reuse the existing native theme and components.
- Expo SDK 58 confirmed; consulted versioned Router API and navigation docs before changes.
- Existing unrelated changes in package-lock.json, config, student exam security/runner, and untracked files are preserved.
- No database records, environment files, backend code, question-bank content, builds, or remote Git operations touched.
- Git checkpoints are skipped: this session explicitly grants read-only access to .git and prohibits escalation. No permission workaround or repeated write attempts.

## Phase 1 — completed (static verification)
- Added reusable StudentDetailsScreen and /student/[studentId] route.
- People and Batch Management student rows push the same route, preserving their real caller/history. StackScreen handles header Back; router stack retains Android Back and native gesture behavior. No dismissAll in the new flow.
- Reused detail content, performance insights, reset-password and account actions; included academic and contact details. Editing and batch sheets remain usable pending Phase 2.
- Added tuitionApi.student using the existing GET endpoint; verified backend source read-only for authorization and response shape. This avoids the 500-student list limit for direct links.
- Files: src/screens/tuition/{tuition-students.tsx,student-details-screen.tsx,person-nav.ts,batch-screens.tsx}, src/services/tuition-api.ts, src/app/student/[studentId]/index.tsx.
- Checks: npx tsc --noEmit PASS; targeted npx eslint on all affected TS/TSX PASS; diff review and git diff --check PASS (line-ending notices only); existing tuition-admin focused tests 16/16 PASS.
- Test environment: node --test failed with spawn EPERM; --test-isolation unsupported by installed Node; direct node --experimental-strip-types tests/tuition-admin.test.mjs passed in process.
- Remaining: emulator/iOS gestures, layout, keyboard and API write round trips not tested; no claim of device acceptance. No live mutation used for verification.
- Checkpoint: report saved; Git commit skipped under read-only .git restriction.

## Phase 2 — completed (static verification)
- Added /student/new, /student/[studentId]/edit and /student/[studentId]/batch; reused student validation and existing create/update APIs.
- Forms load their starting values before mounting and hold a stable draft. Legacy students with no program keep that state unless explicitly changed. ID, login state and enrollment workflows are preserved.
- Reused keyboard-aware FormPage/StackScreen. Batch choices use the searchable OptionPicker dropdown; Manage Batch supports a matching batch or No batch.
- Added shared usePersonFormGuard: prompts for unsaved changes through router removal events (header/system/gesture), blocks leaving while saving, permits successful return. Failed saves retain the draft.
- Added accessible, dismissible success notices on the calling student detail/list/batch screens. Add Student preserves a batch supplied by its caller.
- Replaced Batch Students' history-clearing Manage in People shortcut with direct Add Student; per-student routes handle editing and moving without losing the batch caller.
- Additional files: src/screens/tuition/{student-form-screen.tsx,person-form-guard.ts,person-notice.tsx}; routes above. Updated tuition-students.tsx and batch-screens.tsx.
- Checks: npx tsc --noEmit PASS; targeted ESLint PASS; diff review and git diff --check PASS; focused academic-program tests 14/14 PASS (fit, class/program and legacy-batch behavior).
- Device discovery: absolute adb devices found emulator-5554. Device behavior and write round trips remain unverified at this checkpoint; no database changes made.
- Checkpoint: saved here; Git commit skipped under read-only .git restriction.

## Phase 3 — completed (static verification)
- Added TeacherDetailsScreen and /teacher/[teacherId]. People and Batch Management teacher rows push this same screen without clearing history.
- Reused profile, contact, teaching subjects, login/account and reset-password functionality. Assigned batches display their own subjects and link to the existing /batch/[batchId]/assign-teacher?teacherId=... editor.
- Added tuitionApi.teacher around the existing GET endpoint; inspected backend source read-only to confirm tuition authorization and preserved batch relationships. No assignment backend APIs changed, and no account-creation action runs on details access.
- Files: src/screens/tuition/{tuition-teachers.tsx,teacher-details-screen.tsx,person-nav.ts,batch-screens.tsx}, src/services/tuition-api.ts, src/app/teacher/[teacherId]/index.tsx. Student loading label normalized to ASCII after noticing shell encoding loss in inserted text.
- Checks: npx tsc --noEmit PASS; targeted ESLint PASS; changed-file review and git diff --check PASS. Existing grouping/filter tests passed 16/16 in Phase 1; no new grouping algorithm introduced.
- Remaining: device navigation verification pending; teacher edit sheet remains usable until Phase 4. No API mutations performed.
- Checkpoint: saved here; Git commit skipped under read-only .git restriction.

## Phase 4 — completed (static verification)
- Added /teacher/[teacherId]/edit and TeacherFormScreen; teacher details push it and saving returns to the actual caller.
- Extracted TeacherProfileFields so routed editing and the existing Add Teacher sheet reuse the same field/subject controls. Unrelated teacher-role screens unchanged.
- Stable initialized draft, keyboard-aware FormPage, shared router discard/save guard, retained validation and success notice.
- PATCH sends name/email/phone/subjects only. Assigned batches and login permissions are retained. Current per-batch subject assignments remain visible while editing; warning explains profile subjects outside those assignments do not remove relationships.
- Files: src/screens/tuition/{tuition-teachers.tsx,teacher-form-screen.tsx}, src/app/teacher/[teacherId]/edit.tsx.
- Checks: npx tsc --noEmit PASS; targeted ESLint PASS; changed-file review and git diff --check PASS. Existing backend PATCH semantics reviewed read-only in Phase 3 confirm assignments are retained. No account creation or mutations run for verification.
- Remaining: Android device smoke checks pending; iOS/native gesture and API save round trips unverified.
- Checkpoint: saved here; Git commit skipped under read-only .git restriction.
