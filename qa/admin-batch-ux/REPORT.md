# Tuition Admin batch UX — Android acceptance report

**Acceptance result: passed for the non-destructive Admin workflows on the Pixel_7 Android emulator.** The updated front end was verified running in Expo Go from this `pcmb-paper` checkout. Three additional UX defects were reproduced, fixed, and retested on the emulator. Database persistence and release APK behavior were not tested.

## Emulator and Metro verification

- ADB reported `emulator-5554 device`; boot status was `1`.
- The foreground app was `host.exp.exponent/.experience.ExperienceActivity`, Expo Go version 58.0.5. It was not the standalone package `com.codewithrushi.pcmb`.
- Android API 36; display override 720 × 1600 (physical 1080 × 2400).
- Metro's manifest identified this checkout as its project root: `C:\Users\Vaibhav Mandhani\OneDrive\Desktop\devne_classes\pcmb-paper`; SDK runtime `exposdk:58.0.0`; port 8081.
- Earlier code changes initially failed to appear through Fast Refresh. ADB logs showed the running experience had connected to `exp://10.127.54.58:8081`. Expo Go was reopened at `exp://127.0.0.1:8081` through the existing reverse port mapping. Login remained intact. New behavior was then verified on-screen, and subsequent edits appeared through Fast Refresh.
- [Runtime evidence](runtime-evidence.json), [batch list](after-batch-list.png), and [updated schedule editor](after-edit-autoscroll.png) are saved in this folder.

## Original UX problems and implementation

The earlier implementation addressed the issues found in the original review:

- Batch creation did not mark required fields clearly and did not explain subject selection requirements. It now marks required values, suggests a batch name, shows the selected-subject count, and explains when all subjects are removed.
- Batch cards repeated long setup explanations. They now show a compact remaining-steps summary.
- Schedule details were hard to find and repeated batch names per session. Batch Details now puts an admin-only schedule near the top, summarizes today's sessions, and groups the week by day with concise subjects and AM/PM ranges.
- Schedule actions and fields were unclear. Labels now say Edit Schedule, Add Session, Save Changes, Start Time, and End Time; time range feedback is shown with the controls.
- Leaving edited batch/session forms could discard work without warning. The forms now warn before discarding drafts.
- The native Android time picker is retained. Existing 1–6 hour, strictly-later end time, same-day, overlap, and subject rules remain enforced.

Additional implemented files include `src/screens/tuition/batch-schedule.tsx` and `tests/admin-schedule-boundaries.test.mjs`. No backend API or database schema changed.

## Three additional defects fixed and verified

1. **Editing a saved session left its form off-screen.** Selecting a saved session now scrolls the editor form into view. Evidence: [before](before-edit-offscreen.png), [after](after-edit-autoscroll.png).
2. **Switching sessions silently replaced an unsaved draft.** Switching to another session now prompts before discarding; Cancel retains the draft, Discard loads the selected session, and reselecting the current session preserves edits. Evidence: [before](before-switch-no-warning.png), [after](after-switch-warning.png), [preserved draft](after-reselect-keeps-draft.png).
3. **Time-picker rejection feedback was below the viewport.** The rejected choice retains the last accepted time and now shows the reason directly below the time preview. Evidence: [before](before-max-rejection-visibility.png), [after](after-max-feedback-visible.png).

The existing overlap regression fixture was also corrected: its 31-minute class was rejected by the one-hour minimum before overlap validation ran. The fixture now has a valid one-hour duration.

## Android workflows accepted

Actual ADB taps, swipes, text entry, picker interaction, and UI hierarchy/screenshot inspection covered:

- Batch list and compact summaries.
- Create Batch, required-field markers, suggested name, year and class selection.
- JEE and NEET subject selection, changing subjects, and empty-subject validation. Invalid Create stayed on the form; no batch was created.
- Batch Details, today's schedule, the full week, and empty schedule states. Saved JEE 11th B remained six Physics sessions from Monday through Saturday, 10:00–11:00 AM; Sunday was empty.
- Add Session, weekday shortcuts, clear selection, valid Sunday draft, and disabled Add when no day is selected or when a Monday session overlaps.
- Edit Schedule, session selection, native Android clock picker, and AM/PM display.
- Draft warnings for Create Batch, Edit Batch, Edit Schedule, Android Back, Done, Cancel, and switching between new and saved sessions. Cancel retained drafts; confirmed discard exited or switched as requested.

## Timing rules observed on device

All test edits were discarded and left unsaved.

| Rule | Emulator result |
|---|---|
| Minimum 1 hour | 10:00–11:00 AM accepted; 10:55 AM end rejected |
| Maximum 6 hours | 10:00 AM–4:00 PM accepted; 4:05 PM end rejected |
| End strictly after start | Equal 11:00 AM times showed an error and disabled Save |
| Same-day scheduling | 11:00 PM start with 12:00 AM end was rejected |
| Existing overlap check | A Monday 10:00–11:00 AM Physics overlap displayed and disabled Add |
| AM/PM | Native picker and fields showed AM and PM values, including 4 PM and 11 PM; midnight selection was exercised |

Automated boundary coverage also checks one-minute-below/above limits, noon/midnight conversion, adjacent sessions, multi-day overlaps, and excluding the session being edited. Screenshots: [one hour](after-one-hour.png), [under-hour rejection](after-under-hour-rejected.png), [six hours](after-six-hours.png), [visible maximum error](after-max-feedback-visible.png), [equal times](after-equal-save-disabled.png), [overnight rejection](after-overnight-rejected.png), and [overlap rejection](after-overlap-disabled.png).

## Tests and validation

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit` — passed, exit 0 ([log](typecheck.log)).
- ESLint: `npm run lint` — passed, exit 0 ([log](lint.log)).
- Focused Admin, academic-program, and schedule-boundary/regression set: 44 passed, 0 failed.
- Full `tests/*.test.mjs` suite: 108 passed, 0 failed ([log](tests.log)).
- `git diff --check`: passed; Git emitted only LF/CRLF conversion warnings.
- Android emulator acceptance was performed through ADB on the actual emulator. The screenshots in this folder are saved device captures, not mockups.

## Files and working-tree changes

Implementation changes from this task:

- Modified `src/screens/tuition/tuition-batches.tsx` and `src/screens/tuition/timetable-sheet.tsx`.
- Added `src/screens/tuition/batch-schedule.tsx` and `tests/admin-schedule-boundaries.test.mjs`.
- Modified `src/components/kit.tsx` with an optional ScrollView ref used only by the Admin timetable.
- Modified `tests/step25.test.mjs` to use a duration-valid overlap fixture.
- Added/updated `qa/admin-batch-ux/` documentation, screenshots, UI dumps, capture helper, runtime evidence, and test logs.

The working tree also reports `package-lock.json` modified when this task began; this implementation did not require or edit it. It is listed for visibility and its prior change was preserved. Do not interpret that unrelated lockfile change as part of this UX work.

## Limits and untested operations

- No successful Create Batch, Save Changes, Add Session, Remove Session, or Delete operation was submitted. No MongoDB connection or write was made. Persistence round trips require an isolated development institute/backend, which was not established for this acceptance pass.
- Server-side cross-batch teacher conflict behavior and release-build/standalone APK behavior remain unverified.
- Expo Go's floating Gboard and text entry were inspected. A separately docked keyboard configuration, rotation, other display sizes, and iOS were not qualified; no keyboard defect was confirmed in the tested configuration.
- No APK was built, and nothing was committed or pushed.
