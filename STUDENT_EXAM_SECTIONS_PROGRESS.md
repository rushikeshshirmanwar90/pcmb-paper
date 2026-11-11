# Student exam subject sections: progress

## Done
- `src/screens/student/exam-sections.ts` (new, pure): `buildSections` (from each question's existing `subject`, first-appearance order, "General" fallback), `walkOrder`, `stepFrom`, `sectionOf`, `landingFor` (last visited per subject), `answeredIn`.
- `src/screens/student/test-runner.tsx`:
  - `SubjectTabs`: one subject shows a single line "Subject · n/N answered"; 2-3 share the width; 4+ scroll horizontally. Each tab shows `done/total answered`.
  - `goTo` records the last question visited per subject (`lastInSection` ref); tapping a tab lands there.
  - `QuestionPalette` grouped by subject with per-subject counts; status colours and navigation unchanged.
  - Previous / Next use `stepFrom(order, ...)`, so they cross subject boundaries. Submit only appears on the very last question or via "Submit test".
  - Submit confirmation lists per-subject answered counts when there is more than one subject.
- `tests/exam-sections.test.mjs` (new).
- Not touched: heartbeat, exam security, grading, answer saver, drafts, question data, other screens. Nothing committed.

## Checks (this session)
- `node --experimental-strip-types --test tests/*.test.mjs`: 428 pass, 0 fail.
- `npx tsc --noEmit`: clean.
- `npx expo lint src/screens/student`: clean.
- Not verified on an Android emulator or Maestro (not attempted).

## Next
- Visual check on emulator with a multi-subject test (3 subjects and 4+ subjects, large font scale, dark mode).
- Review the working tree's other uncommitted changes in `test-runner.tsx` (teammates') before committing.
