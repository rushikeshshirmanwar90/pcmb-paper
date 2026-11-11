# TuitionApp Question Selection Progress

## Goal
Implement reusable subject-by-subject question selection for Create Test, Exam PDF and Smart PDF using existing supported data and APIs.

## Existing Database Fields Discovered
Question: _id, subject (Physics/Chemistry/Mathematics/Biology/Botany/Zoology/Science), examCategory (two enum values: Foundation and JEE/NEET), standard (9th/10th/11th/12th), chapter, topic, source (free text), answerType (MCQ/Numerical/Bonus/Descriptive), difficulty (Easy/Medium/Hard), bankCopy. No subtopic. Mobile maps Medium to Mid. No separate ExamBank collection in these flows; PYQ APIs query Question. Year/exam are classified from source, not independent Question fields.

## Existing APIs and Components
/make-pdf/options, /questions and /pick: readScope/scopeFilter; existing chapter/topic/year arrays, MCQ-only, exclude bankCopy. regular means all eligible MCQs including sourced questions; pyq narrows source to exactly the selected exam plus year, excluding rival/other exams. Preserve this overlap. Existing /questions supports search and MCQ/Numerical types, but active Create Test/one-page PDF UI has no type or difficulty filter; do not introduce those categories. Reuse MultiSelectDropdown, PickCard, QuestionPreview, CountField and questionPaper/smartSlides engines. TestQuestion already stores subject; TestRoom subject is unrestricted text. Existing test authorization permits teachers to set tests for any own-tuition batch (batchForTest); preserve it.

## Architectural Decisions
Preserve existing changes, single-subject compatibility and question-bank schemas. No database writes, branch merges, commits or pushes.
Selections live in parent flow/draft state, one ordered session per subject. Filters affect discovery/additions only; retained picks are verified against academic scope. Final progression requires selected counts equal editable targets (zero targets permitted if total is positive). Removing populated subjects/scope asks before clearing. Regular+PYQ is the existing regular superset; no ratios or new source metadata. Existing TestRoom subject text stores the joined labels; per-question subject already exists, so no schema extension. Multi-subject Test Management edit uses a small shared-selector adapter; original single-subject editor remains. Browser uses virtualized pages and a 200-question rolling window; selected snapshots are separate. KeyboardSafeView reused. No Expo/native dependencies added.

## Completed Phases
- [x] Phase 1: Inspect existing schema, APIs and UI
- [x] Phase 2: Shared selection state and multi-select filters
- [x] Phase 3: Subject screens, browsing and random fill
- [x] Phase 4: Create Test integration
- [x] Phase 5: Exam PDF and Smart PDF integration
- [x] Phase 6: Focused automated tests, lint/typecheck and PDF rendering validation (device check unavailable; see Known Issues)

## Current Phase
Implementation and focused automated validation complete. Device acceptance and deployment remain external follow-up work.

## Files Modified
- pcmb-paper/src/screens/teacher/question-selection/test-edit-selection.tsx
- pcmb-paper/src/screens/teacher/teacher-tests.tsx (combined-test editor adapter only)
- papers/src/app/api/tests/[id]/route.ts (combined-test validation only)
- papers/tests/question-selection.test.ts
- pcmb-paper/tests/make-pdf.test.mjs
- pcmb-paper/QUESTION_SELECTION_PROGRESS.md (created)
- pcmb-paper/src/screens/teacher/question-selection/model.ts
- pcmb-paper/src/screens/teacher/question-selection/subject-selector.tsx
- pcmb-paper/src/screens/teacher/make-pdf/bank-scope.ts
- papers/src/lib/makePdfBank.ts
- pcmb-paper/src/screens/teacher/create-test/{draft,details-screen,setup-screen}.tsx
- pcmb-paper/src/services/school-api.ts
- papers/src/lib/test-access.ts
- papers/src/app/api/tests/route.ts and tests/audience/route.ts
- pcmb-paper/src/screens/teacher/make-pdf/{one-page,flow}.tsx
- pcmb-paper/src/services/question-pdf.ts
- papers/src/lib/questionPaper/{html,parse}.ts
- papers/src/lib/smartSlides/html.ts
- pcmb-paper/tests/question-selection.test.mjs, tests/make-pdf-one-page.test.mjs
- papers/tests/make-pdf-bank.test.ts

## Tests Passed / Failed
Final results: mobile focused suite 120/120 passed. After final keyboard/pagination changes, shared selection tests 7/7 passed. Backend focused suite 133/133 passed; expanded final selection suite 9/9 passed, including combined Test Management PATCH with a throwaway replica set. Both repositories: npx tsc --noEmit and npm run lint exited 0 after final source changes. Targeted git diff --check passed. No currently failing checks.
PDF QA: Exam PDF (3 pages: questions/key/solutions), Smart PDF (3 slides), no rendering/layout errors. Rasterized and visually inspected all six pages: clean subject sections, continuous numbering, grouped answers/solutions, no watermark, blank slide writing area. QA artifacts: papers/qa/question-selection/. No renderer/teammate mathematical component rewrites.
Mobile command: node --experimental-strip-types --test tests/question-selection.test.mjs tests/create-test-flow.test.mjs tests/teacher-test-questions.test.mjs tests/make-pdf-one-page.test.mjs tests/make-pdf.test.mjs tests/smart-pdf.test.mjs tests/teacher-test-management.test.mjs
Backend command: node --import tsx --test tests/question-selection.test.ts tests/make-pdf-bank.test.ts tests/phase1-test-scheduling.test.ts tests/test-access-phase1.test.ts tests/smart-pdf.test.ts tests/make-pdf.test.ts. Final expanded selection suite rerun separately after adding multi-batch/Biology/edit cases. Logs: qa/question-selection-*.log in each repo.
Baseline mobile: 97 passed (create-test-flow, teacher-test-questions, make-pdf, smart-pdf). Backend: 106 passed (make-pdf, make-pdf-bank, smart-pdf, phase1-test-scheduling). Throwaway local Mongo only. Existing large dirty trees in both repos inspected and preserved.
Resolved intermediate failures: mobile old one-page label assertions updated for the shared browser; new backend test syntax corrected; unsupported pdf.js destroy call removed; FlatList empty-component typing corrected; four React hook lint errors corrected. All affected checks subsequently passed.

## Known Issues
Maestro list_devices exposes only disconnected Chromium, no Android emulator. Mobile Android/iOS, keyboard, accessibility, scrolling and light/dark behavior have not been verified on device. App calls deployed backend: local API changes must be deployed through a separately authorized release before live app use. No deployment, native build or production-write testing performed.
Installed Next 14.2.35 has no node_modules/next/dist/docs; existing installed APIs/routes inspected instead. SDK 58 Expo docs/llms index and RN FlatList docs consulted. Graphify mobile seed unavailable; backend graph queried; graph was not regenerated. Full unrelated test suites skipped per user request for targeted testing. No live DB inspection needed; tests used only newly created local Mongo instances. Existing TestRoom/security/dependency working-tree changes were present before this task and preserved.

## Remaining Tasks
- [ ] Focused Android emulator acceptance: choose batches/subjects, edit targets, tick questions, navigate subjects, fill remaining, review/replace/reorder, Back/Next, verify exclusions retained, and both PDF settings flows. Capture screenshot(s).
- [ ] After separate deployment authorization, release the backend compatibility changes and validate against the deployed API without touching question-bank data.

## Next Exact Action
When an Android emulator is available, run one focused Maestro flow for the shared selector against a safe local fixture backend; capture evidence. Do not use deployed production test-write flows. No further implementation is currently identified by the focused review.

## Resume Instructions
Read this file first. Preserve all pre-existing uncommitted changes. Follow instructions in both repositories. Do not modify question-bank data or run remote database writes. Continue from the next exact action and update this file after every phase and blocker.

## Mobile UI Refinement

- [x] Source options audited and restored
- [x] Correct-answer display fixed
- [x] Main question list refined
- [x] Question Details improved
- [x] View Selected redesigned
- [x] Random actions simplified
- [x] Focused tests completed

Source audit (2026-11-10): Question.source is free text, not an enum. Existing Create Test question-picker.tsx, original Make PDF bank-scope.ts and backend readScope support exactly `regular` and `pyq` selectors. No distinct ExamBank collection/selector exists in these flows. Regular includes all eligible MCQs (including sourced questions); PYQ uses the selected JEE/NEET exam, year and rival-exam exclusions. Exam aliases (JEE Main/Advanced/AIEEE/IIT-JEE, NEET/AIPMT) are provenance patterns, not additional selector values. The older exam-specific PDF API also recognizes BITSAT/AIIMS/JIPMER through its existing exam matching; its semantics remain untouched. Preserve scalar source requests and array union; never fabricate an ExamBank category.

Answer root cause: /make-pdf/questions and /pick already return correctAnswer/explanation on teacher/tuition-authorized routes. toQuestion retains them. QuestionPreview intentionally omitted both for PDF-style selection. Refinement adds an opt-in teacher display using existing fields; student question APIs and rendering remain untouched.

Baseline: mobile selection 7/7 passed; backend make-pdf-bank 19/19 passed. Maestro exposes only disconnected Chromium, no Android; no emulator retries. SDK 58 and RN docs checked. Seeded Graphify query could not locate the newly untracked selector; targeted source reads used; graph not regenerated.

Current task: implement compact teacher selection, details and selected rows; preserve existing mathematical renderer and pre-existing dirty trees.
Next exact action: finish interaction/UI changes, then focused regression/security tests and lint/typecheck in both repositories.

Completed implementation subtasks: teacher cards now use separate sibling checkbox/content controls; answers opt in through QuestionPreview, preserving its default and underlying MathText/Diagrams components. Details include Explanation and existing figures plus selection action. View Selected uses shared compact rows with overflow sheets and dedicated Reorder mode, plus inline removal feedback/undo. Custom random counts/actions removed; one pinned Fill Remaining uses existing backend sampling/exclusions, guarded against double taps and bounded to current target on response. Source options centralized from audited supported selectors; source changes retain chapter/topic/year filters and selected snapshots. Existing parent-state sessions, virtualized pagination and 200-item window retained.
Files so far: src/screens/teacher/question-selection/{answer.ts,question-card.tsx,subject-selector.tsx}; src/screens/teacher/make-pdf/{bank-scope.ts,question-preview.tsx}. No backend implementation or PDF output changes needed.
Current task: focused interaction/answer/security regressions and required static checks.
Next exact action: run new focused tests; fix only task-related failures, then update final results here.

### Final validation and handoff (2026-11-10)

All seven Mobile UI Refinement items above are complete at code level.

Final files changed by this refinement (existing modifications in shared files preserved):
- pcmb-paper/src/screens/teacher/question-selection/answer.ts (new stored-key validation/summary)
- pcmb-paper/src/screens/teacher/question-selection/question-card.tsx (new selection card and shared compact selected row)
- pcmb-paper/src/screens/teacher/question-selection/subject-selector.tsx (targeted browser, details, overflow/reorder/undo, pinned actions)
- pcmb-paper/src/screens/teacher/make-pdf/bank-scope.ts (centralized audited source choices)
- pcmb-paper/src/screens/teacher/make-pdf/question-preview.tsx (opt-in answers; default remains hidden; wrapping)
- pcmb-paper/src/components/explanation.tsx (optional showAnswer flag, default true; teacher details suppress the legacy explanation-inferred badge because the validated stored key is already shown above)
- pcmb-paper/tests/question-selection-refinement.test.mjs (new answer and actual TSX handler/hook harness checks)
- pcmb-paper/tests/make-pdf.test.mjs (update obsolete selector labels/assertions only)
- papers/tests/phase1-test-scheduling.test.ts (add teacher bank authorization and ongoing student answer-secrecy regressions)
- pcmb-paper/QUESTION_SELECTION_PROGRESS.md (append-only refinement notes; earlier progress retained)

Final results:
- Mobile focused regressions: 128/128 passed, 0 failed. Command: node --experimental-strip-types --test tests/question-selection.test.mjs tests/question-selection-refinement.test.mjs tests/create-test-flow.test.mjs tests/teacher-test-questions.test.mjs tests/make-pdf-one-page.test.mjs tests/make-pdf.test.mjs tests/smart-pdf.test.mjs tests/teacher-test-management.test.mjs
- Backend focused regressions: 47/47 passed, 0 failed. Command: node --import tsx --test tests/make-pdf-bank.test.ts tests/phase1-test-scheduling.test.ts
- Both repositories: npx tsc --noEmit exited 0; mobile npx expo lint exited 0; backend npm run lint exited 0.
- Targeted git diff --check passed; only Git line-ending notices. New code reviewed directly for retained role guards, source mapping, selected snapshots, random exclusions and stale-response handling.
- Logs: qa/mobile-refinement-{tests,typecheck,lint}.log in each repository.
- Intermediate failures resolved: the TSX test harness initially did not traverse FlatList header elements; an old Make PDF assertion expected the removed inline target/PickCard UI. Updated harness and targeted expectation, then reran the focused set. No final failing checks.

Additional details: checkbox and question content are sibling touch targets. Review rows use existing MathText; all formulas/figures/options use the incumbent renderers. Details show existing image-only solutions directly (Explanation returns null for empty text), and provide an unavailable state if neither text nor figures exist. No inferred answer is promoted from a solution. Existing preview/Explanation callers preserve their defaults. Multi-source selection no longer clears chapter/topic/year choices; bankBody still ignores years for the regular superset. Source-less and other sourced questions retain their existing regular-pool behavior.

Known limitations / skipped verification:
- No Android device or emulator exposed by Maestro (only disconnected Chromium). Small-screen layout, keyboard/navigation insets, gestures, larger font scale and light/dark appearance have no fresh device evidence. TSX harness checks interactions, not native layout.
- Existing bank discovery is MCQ-only and Create Test publication accepts a single MCQ key. Display helper supports multiple-key strings and Numerical snapshots where supplied, but this refinement intentionally does not expand format eligibility or change scoring/publication rules.
- Source audit is source-code/API-contract based, not a live database inventory; no academic data was read from or changed in production. No additional supported selector or separate ExamBank collection was found in the targeted paths.
- Full unrelated suites, Graphify regeneration, PDF generation/formatting checks, native builds, deployments and production-write flows were skipped per scope. Existing prior backend changes still require their separately authorized release; this refinement itself adds no API contract/implementation changes.
- Impeccable context reported an unset optional buildPath preference; no design context/config repair was performed during this targeted code refinement.

Current task: code implementation and focused verification complete; device acceptance outstanding.
Next exact action: when Android is available, run one focused Maestro flow against a safe local fixture backend to verify source multi-select, checkbox vs content taps, details/solution images, View Selected overflow/remove/undo/replace/reorder, Fill Remaining, subject navigation, pagination and keyboard-safe footer; capture screenshots. Do not use production test-write flows or reimplement completed changes.

## Selected Questions UX Refinement

### Duplicate control recheck (2026-11-11)

The requested fix is already present in the working tree: the original duplication came from rendering Reorder in both the top action area and the FlatList header. SubjectBrowser now renders only the top action area's Reorder/Done toggle; no additional source edit was needed. Existing uncommitted work was preserved.

Current-session verification: focused question-selection and refinement tests passed 20/20, including exactly one Reorder in normal mode, exactly one Done (and no Reorder) in reorder mode, return to normal mode, drop callback forwarding, ordering persistence and contextual menus. Targeted ESLint on subject-selector.tsx and the refinement test passed; targeted TypeScript with project options, the screen's imports and expo-env.d.ts passed with 0 diagnostics. No full suite or unrelated checks run.

Device limitation: Maestro exposed connected emulator-5554, but its current hierarchy shows a different screen with attempt/score statistics, not Selected Questions. Native drag gestures and visual layout were not verified; no account/session changes were made to reach the teacher screen. Source layout is unchanged in this recheck. Only this progress document was edited.

### Duplicate Reorder button fix (2026-11-10)

Removed the obsolete Reorder control and move-up/down hint from SubjectBrowser's FlatList header. The existing top action area remains the single Reorder/Done control. Drag handles, drag-drop callback, ordering updates, normal-mode three-dot menus, selection and other actions are unchanged. Existing uncommitted work retained; no dependency/backend/database changes.

Verification: focused question-selection and refinement tests passed 20/20 before and after the fix. Added assertions across normal -> reorder -> Done transitions: exactly one Reorder in normal mode, exactly one Done in reorder mode, no Reorder during reorder. Existing drag-drop callback and contextual-menu tests pass. Targeted ESLint on the screen/test passed. Targeted TypeScript using project options, the screen's imports and expo-env.d.ts passed with 0 diagnostics; the first narrow invocation omitted expo-env.d.ts and reported an unresolved global.css side-effect import, resolved by including the existing Expo ambient declarations. Full unrelated checks skipped per requested scope.

Android gestures and visual layout: NOT VERIFIED. Maestro list_devices exposed only disconnected Chromium, no Android emulator. Source review confirms the top action area/list layout is unchanged except removal of the redundant list-header control/hint; device layout and native drag acceptance remain pending.

- [x] Compact anchored action menu
- [x] Remove unnecessary full-screen action menu
- [x] Drag-and-drop reorder mode
- [x] Persistent question ordering
- [x] Correct numbering after reorder
- [x] Focused tests
- [ ] Android UI verification, if available

Baseline (2026-11-10): focused selection/model and TSX handler tests 15/15 passed. Existing uncommitted work preserved. Read workspace/project guidance and tuition-ui, tuition-feature, tuition-review skills; seeded graph query found no node for the untracked selector. Expo SDK 58 and current RN docs consulted. Existing dropdowns and DetailSheet are large selection/detail surfaces, not compact contextual popups. No existing drag list installed; adding react-native-reorderable-list 0.18.3 through expo install, reusing installed RNGH 3.3 and Reanimated 4.7. No new native module.
Ordering trace: SubjectSelection.questions -> selectedQuestions (subject-order flatMap) -> Create Test draft / PDF verification. Backend verifyQuestions explicitly restores incoming ID order; PDF and Smart PDF map questions in array order. No backend change identified.
Android: Maestro list_devices returned only disconnected Chromium; Android UI verification NOT TESTED, no environment retries.
Next exact action: implement anchored popup and handle-only reorder list, then focused regression checks, TypeScript, lint and review.

Implementation complete: question-selection/action-menu.tsx adds a content-sized popup anchored via measureInWindow, with edge clamping and a transparent outside-dismiss layer inside the existing subject modal. Android Back dismisses the popup first. Actions execute in an effect after popup removal; complete details, current filters/subject replacement, remove and undo retained. question-card.tsx keeps math/answer previews and 48dp controls; reorder rows hide overflow and disable details, highlight active rows, and expose bounded increment/decrement accessibility actions. reorder-list.tsx uses react-native-reorderable-list 0.18.3 (new small JS dependency) with installed RNGH/Reanimated, handle-only long press, virtualized rows and built-in edge autoscroll. GestureHandlerRootView is scoped to the existing modal. No native builds or teammate rendering changes.
Ordering implementation: the existing moveQuestion helper moves by array indices; SubjectBrowser immediately updates its live session ref and parent onChange for the current subject only. No new ordering fields/API/database changes. Current row index supplies numbering. Backend verification restores requested ID order; PDF bodies retain paired questions/answers.
Completed checks so far: updated focused interaction suite 18/18 passed; TypeScript and Expo lint exited 0. Expanded long-list/order and PDF request regressions and an Android JS bundle check are running. Android UI remains NOT TESTED (no emulator exposed).
Next exact action: finish focused checks and bundle validation, review only changed files, and record final results/blockers.


### Final refinement validation (2026-11-10)

Files changed in this task (earlier work retained):
- src/screens/teacher/question-selection/subject-selector.tsx
- src/screens/teacher/question-selection/question-card.tsx
- src/screens/teacher/question-selection/action-menu.tsx (new)
- src/screens/teacher/question-selection/reorder-list.tsx (new)
- tests/question-selection-refinement.test.mjs
- tests/make-pdf.test.mjs (one obsolete component-location assertion)
- package.json and package-lock.json (react-native-reorderable-list 0.18.3)
- QUESTION_SELECTION_PROGRESS.md
- qa/selected-questions-ux-{tests,typecheck,lint,bundle}.log (verification evidence)

Final focused tests: 128 passed, 0 failed, 0 skipped. Command: node --experimental-strip-types --test tests/question-selection.test.mjs tests/question-selection-refinement.test.mjs tests/create-test-flow.test.mjs tests/teacher-test-questions.test.mjs tests/make-pdf-one-page.test.mjs tests/make-pdf.test.mjs tests/smart-pdf.test.mjs.
Final npx tsc --noEmit and npx expo lint both exited 0. Android JS export (npx expo export --platform android --no-bytecode --output-dir <temporary directory>) exited 0, resolving and bundling the new library. Export preceded the final footer-only guard; final focused tests, typecheck and lint include that guard. No native build performed.
Test coverage includes actual TSX handlers for opening one popup, closing outside/Back, all three actions, remove/undo, drag-drop callback and Done; content-size edge-position calculations; handle-only rows with accessible moves; 200-question reorder retaining all IDs/answer snapshots and the other subject; subject reopen/flattened order; actual Exam/Smart PDF request serialization retaining reordered question/answer pairs. Native gesture physics/layout/autoscroll are not simulated by the hook harness.
One intermediate expanded-suite failure was an old assertion searching for Remove Question in subject-selector.tsx after the label moved into action-menu.tsx; updated the assertion to follow the component and reran the focused set successfully. Initial new ref typing errors and a library-omitted prop were corrected before final checks.
Focused review: popup has no action route/DetailSheet/opaque Modal; menu actions run after its removal commits. Reorder uses immediate parent state updates within the current subject; normal rows have one action control, reorder rows one handle. Fill/next footer is hidden during reorder; entering reorder is disabled while random fill is in flight, preventing concurrent additions during a drag. Existing source filters, sampling, math/diagram rendering, PDF layouts, test security and backend implementations were not changed. Tracked diff whitespace checks and changed untracked source whitespace scan passed.

Blockers / verification limits:
- Android UI verification: NOT TESTED. Maestro exposed only disconnected Chromium, no Android device. Actual Pixel 7/smaller-screen popup placement, TalkBack focus, native dragging, smoothness and long-list edge autoscroll still require device acceptance.
- Online-test creation/PDF generation were verified through focused automated regressions, request serialization and source tracing, without production writes or a fresh rendered PDF. No backend changes, DB operations or migrations.
- Full unrelated suites, backend checks (read-only backend), Graphify regeneration, commits and pushes were skipped per scope.

Next exact action: with an Android emulator available, use the current bundle and safe local fixture data to exercise popup edge/outside/Back, details/replace/remove, drag from first to last with edge autoscroll, Done and subject/navigation round-trip; confirm final review and test/PDF order without production writes, and capture screenshots. No additional code change is currently identified.

### Start Now restoration (2026-11-11)
- Start Now restored as the new-test default using the existing Segmented control and `startNow` API contract. Date/time inputs are hidden; submission omits scheduled opening and uses the existing duration-plus-hour closing suggestion, refreshed on submit. Backend owns the opening clock and existing access rules.
- Schedule for Later retains pickers, local timezone conversion and validation. Switching preserves form/schedule values; mode stays in the shared draft. Legacy drafts retain scheduled mode; existing-test editing is unchanged.
- Duplicate Reorder already fixed: no selection source changes. Exactly one Reorder/Done toggle and existing drag/drop/context actions pass focused tests.
- Files modified this task: create-test/draft.tsx, create-test/setup-screen.tsx, tests/create-test-start-now.test.mjs, this document; evidence: qa/start-now-focused-tests.log. Prior uncommitted work preserved; backend unchanged.
- Verification: baseline 33/33; final focused tests 57/57, TypeScript and Expo lint passed. Includes actual setup handlers/payloads and existing backend resolver executed without database/model loading. No full suite, Graphify, database writes, builds or Git publishing.
- Remaining: native layout/drag gestures and live end-to-end creation not verified. Maestro sees connected emulator-5554 on an existing results screen; no live creation or session changes performed.
