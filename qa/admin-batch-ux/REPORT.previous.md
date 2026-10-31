# Tuition Admin batch UX — 31 October 2026

Status: focused frontend implementation complete; updated-device acceptance testing blocked. The emulator continues to show the original UI. Do not treat this report as final release acceptance.

## Runtime evidence and limits

- Desktop inventory identified `Android Emulator - Pixel_7:5554`. Screenshots showed a booted, interactive institute-admin interface for Sharma Classes. This is visual role evidence, not an ADB/authentication inspection.
- Android CLI plugin was not available. ADB was not in PATH; reading `%LOCALAPPDATA%/Android/Sdk/platform-tools/adb.exe` failed with Access denied. Android boot properties, API level, foreground package, and device hierarchy could not be verified.
- Windows accessibility exposed emulator controls, not React Native elements. Inspected screenshots and source together.
- Actual taps and scrolling inspected dashboard, Batches/list, Create Batch, JEE subject selection, Batch Details, subject/teacher assignments, Edit Batch, weekly timetable, schedule editor, existing-session edit state, and native Android time picker.
- No Create, Save, Add Session, Remove, or Delete data action was submitted. No MongoDB connection or modification was made.
- Running labels match `pcmb-paper`, but its active Metro connection was not proven. Ctrl+M did not expose a development menu. Source edits did not appear in the emulator. Launch type clarification was requested.

## Observations and implemented changes

| Observed problem | Focused change | Admin benefit |
|---|---|---|
| Create form had unmarked required fields; closing an edited form discarded it | Required markers, subject selection count, consistent Create Batch wording; close/back discard guard | Clear requirements and protection against accidental loss |
| Batch cards repeated long missing-teacher and setup descriptions | Short setup-steps summary; detailed information stays in Batch Details | Faster scanning |
| Schedule was below large setup/details sections; batch name repeated in every session | Admin-only schedule at the top of Batch Details, Today summary, compact day groups, subject and full AM/PM range, explicit empty days | Earlier access and less repeated information |
| Generic Change/Add schedule labels | Edit Schedule, Add Session, Save Changes, Start Time, End Time | Actions describe their purpose |
| Invalid start changes required looking below other fields for feedback | Time-range preview/error directly beneath time fields | Immediate feedback |
| Edited batch/session could be closed without warning | Guards on sheet close, Done, and Android modal back | Protects unsaved changes |

Preserved native picker, 1-hour minimum, 6-hour maximum, same-day rule, existing overlap checks, subject rules, multi-day controls, API contracts, schemas, authorization, and existing question-bank separation. No shared Student or Teacher screen/component was edited. No dependencies added. Creation still uses the existing batch-then-sessions API flow.

## Screenshots

Original screens captured and examined during navigation are in the conversation. Saved evidence:

- [Edit Batch](before-edit-batch.png)
- [Schedule editor](before-schedule-editor.png)
- [Weekly sessions](before-weekly-schedule.png)
- [Seven-hour range rejected](before-duration-rejection.png)

After screenshots are unavailable: the running app has not loaded these changes. No simulated image is presented as emulator evidence.

## Executed checks

- `node --experimental-strip-types --test --test-reporter=spec tests/admin-schedule-boundaries.test.mjs tests/tuition-admin.test.mjs tests/academic-programs.test.mjs`: 33 passed, 0 failed.
- New boundary checks cover equal times, under one hour, exactly one/six hours, over six hours, overnight rejection, noon/midnight, empty weekdays, multi-day overlap, adjacent sessions, and editing exclusion.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `npm run lint`: passed.
- ESLint on all three changed frontend files: passed.
- `git diff --check`: passed (line-ending warning only).
- Existing `tests/step25.test.mjs`: 10 passed, 1 failed. Its overlap test uses a 30-minute fixture that encounters the existing 1-hour minimum before overlap validation. Neither that test nor the underlying duration/overlap module was changed.

Actual original-app checks: native start hour changed from 10 to 11 AM; equal 11–11 range produced a warning and disabled Add. Native end picker selection of 5 PM with 10 AM start was rejected and retained 11 AM. Selecting a saved Monday session entered edit state without saving. These are original-app observations; changed guards and layout remain unverified on device.

## Files

- `src/screens/tuition/tuition-batches.tsx`
- `src/screens/tuition/timetable-sheet.tsx`
- `src/screens/tuition/batch-schedule.tsx` (new, admin-only)
- `tests/admin-schedule-boundaries.test.mjs` (new)
- This report and screenshot evidence.

`package-lock.json` was already modified when work began and was not edited by this task. The alternate `pcmb-paper-admin-ux` checkout was not changed. Nothing was pushed.

## Remaining acceptance work

1. Open a development build connected to this checkout's Metro, reload, and repeat navigation with after screenshots.
2. Verify draft guards, subject toggling/empty selection, keyboard behavior, smaller viewport layout, weekday shortcuts, valid and invalid native time ranges, and schedule display on device.
3. Use isolated development fixtures for create/save/update/remove round trips. No safe database fixture environment was established, so these were deliberately not performed.
4. Existing-session selection leaves the editor above the current viewport. Consider an admin-only editor sheet or scroll-to-form control in a follow-up.
5. Check dirty-draft handling when switching between sessions inside the editor; the new guard covers leaving the sheet, not every internal selection.
6. Server-side cross-batch teacher conflict behavior was not exercised or verified. No backend changes were made.
7. Correct the older overlap-test fixture separately without weakening its one-hour restriction.
