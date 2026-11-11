# Make PDF — multi-subject sections: progress

## Phases
- [x] 1. Subject selection and architecture
- [x] 2. Multi-subject Exam PDF layout (verified: tests + visual)
- [x] 3. Subject-wise answer keys and solutions (verified: tests + visual)
- [x] 4. Multi-subject Smart PDF (verified: tests + visual)
- [x] 5. Final integration and verification (backend HTTP verified; Android NOT TESTED; broader `npm test` not green for environmental reasons, see Phase 5)

## Follow-up: Make PDF subject UI simplified (supersedes Phase 1's Automatic/Manual toggle)
- **Removed:** the `Subjects: Automatic | Manual` toggle, its explanation text, the conflict notice with "Add These Subjects" / "Switch to Automatic", and all of the mode state (`subjectMode`, `onSubjectMode`) and the old model code (`resolveSubjects`, `includeExcluded`, `conflictMessage`, `SubjectMode`).
- **One selector:** the existing `SubjectSelector` dropdown (a searchable `MultiSelectDropdown`, no chips) is the only subject control, labelled "Select Subjects". It takes two new optional props, `label` (default "Subjects") and `searchable`. Make PDF passes `label="Select Subjects" searchable`, and Create Test's selector is unchanged.
- **PDF subjects:** derived from the picked questions, which are already in the teacher's subject order (`flow.tsx`: `subjectHeader(deriveSubjects(selected))`). The request is unchanged: questions in order, each with its `subject`, plus the same header text. No backend, API or renderer change.
- **Subject removal:** removing a subject that has picked questions asks first. The message names the subjects and the number of questions, and says other subjects are kept. Cancel changes nothing, and confirming removes only that subject's questions. The confirmation text is in the shared `SubjectSelector`, so Create Test's removal prompt now shows the same count.
- **Final review:** new `make-pdf/subject-review.tsx` shows a read-only card above the PDF settings (each subject with its count, then the total) with a compact Edit button that goes back to the selection step (state kept). The settings screens don't ask for subjects.
- **Files (pcmb-paper):** `src/screens/teacher/make-pdf/pdf-subjects.ts` (reduced to `subjectCounts`, `deriveSubjects`, `subjectHeader`), `make-pdf/subject-review.tsx` (new), `make-pdf/one-page.tsx`, `make-pdf/flow.tsx`, `question-selection/subject-selector.tsx`, `tests/make-pdf-subjects.test.mjs` (rewritten, 14 tests). Teammate edits in these files were kept.
- **Tests (run this session):** the full `pcmb-paper` suite `node --experimental-strip-types --test tests/*.test.mjs` gives 442 pass, 0 fail. `npx tsc --noEmit` and `npx expo lint` are clean. The `papers` suites were not re-run, since the backend is unchanged.
- **Covered by the tests:** no toggle text or leftover state; exactly one subject dropdown (no second one); one, two and three subjects distribute targets; removal asks first with a count; Cancel keeps all questions; confirming keeps the other subjects' questions in order; reordering keeps the PDF subject order; the review lists subjects and the total and Edit calls back.
- **Android verification:** NOT TESTED. The handlers were exercised with a small React harness, not a native renderer, and the layout of the new review card has not been seen on a device. The app still needs the deployed backend to be tested end to end.

## Status: all five phases done. Remaining work is deployment and device testing (below).

## Remaining tasks
1. Deploy `papers` (the backend). The app calls the deployed backend, so none of the multi-subject PDF output appears until then. It needs no migration.
2. Test on a device against the deployed backend: Make PDF → Exam PDF and Smart PDF → download/open (Android NOT TESTED, see Phase 5).
3. Optional, noncritical: the limitations listed under Phase 5.

**Resume instructions:** read this file, run `git status` in both repos, run `npx tsx --test tests/multi-subject-paper.test.ts tests/smart-pdf.test.ts tests/multi-subject-route.test.ts` in `papers`.

## Phase 5 — Final integration and verification — done (with the caveats below)
Subtasks: [x] contract trace · [x] subject-order fix · [x] real-route tests · [x] quality checks · [ ] Android (NOT TESTED) · [x] limitations review

**Contract trace (read from the code, not run on a device)**
- Selection → `selected`: `one-page.tsx` verifies each subject's picks through `POST /api/make-pdf/pick`. `verifyQuestions` returns questions in the order of the ids sent, so reorder and replace survive, and the order is subjects in session order, then picks in order.
- `flow.tsx` sends `subject = subjectHeader(resolveSubjects(mode, sessions, selected).subjects)`. Automatic mode lists subjects in question order. Manual mode lists question-order subjects first, then manual extras.
- `question-pdf.ts requestBody` sends the questions in that order with their own `subject`, `marksPerQuestion` from the standard, the title, `paper` details, `style`, `format: smart` + `slides` for Smart, and `content` → `questionPaper/answerKey/solutions`.
- Total marks are `questions.length * marksPerQuestion` on the server, and the title, set, date and duration are unchanged.
- Saved Smart layout preferences are unchanged and sent as `slides`.

**Subject-order investigation and fix (papers `src/lib/questionPaper/html.ts`)**
- The header text is cut to fit 80 characters ("A, B +N more", or "N subjects"). A cut list could not match names, so I made the header list ignored when it ends in `+N more` or reads `N subjects`.
- The order then comes from the questions themselves, which the app already sends in the teacher's order. A complete list still sets the order for older or other clients.
- `arrangeQuestions` serves both Exam and Smart, so both are fixed. No new request field and no schema change.
- In the app's own flow the header list is always in question order, so it cannot disagree with the questions.

**Real-route tests (new `papers/tests/multi-subject-route.test.ts`, 12 tests, pass)**
- These call `POST /api/question-paper-pdf` with the real route handler, real Chrome and a throwaway in-memory MongoDB (the same harness as `step2a-pdf.test.ts`). No Atlas, no production data. The payload mirrors `question-pdf.ts requestBody` by reading it, not by running app code.
- Exam: single subject, two subjects, three subjects (questions only), + answer key, + solutions, separate answer key, everything on with long equations / an unloadable figure / a blank explanation / a numerical answer, a truncated header list, and the over-80-character header (400).
- Smart: single subject, three subjects (15 slides, labels, all options on each slide, no divider slides), and manual order with a different theme/area/layout plus a blank solving slide for a long question.
- Real figure fetching is not covered over HTTP (no network). Embedded images are covered by the unit tests in `multi-subject-paper.test.ts` and `smart-pdf.test.ts`.
- Sample PDFs from these runs are in `...\scratchpad\phase5-samples\` . I read their text but did not re-inspect them visually, because rendering was unchanged since Phases 2-4.

**Android / mobile: NOT TESTED.** The emulator (emulator-5554) is online but has only Expo Go. The app's API origin is hard-coded to the deployed backend (`src/lib/config`), which does not have these changes yet. Pointing it at a local backend would mean changing app config and logging in with a real account. I did not do either. Nothing here claims on-device verification.

**Tests and checks (run this session)**
- `papers` focused: smart-pdf, multi-subject-paper, step2a-pdf, pdf-layout, make-pdf, multi-subject-route all pass (Phase 4 ran 136 pass, 0 fail for the first five; the route file adds 12 pass).
- `papers` `npx tsc --noEmit` and `npx eslint` on `src/lib/questionPaper`, `src/lib/smartSlides` and the three PDF test files: clean.
- `pcmb-paper`: `node --experimental-strip-types --test tests/*.test.mjs` 433 pass, 0 fail. `npx tsc --noEmit` and `npx expo lint`: clean.
- `papers` `npm test` (full) was run once: 632 tests, 433 pass, 14 fail, 185 cancelled. The failures are `mongodb-memory-server` "Instance failed to start within 10000ms" while many DB suites start `mongod` at once (academic-programs, batches, question-bank isolation, and also my route suite when launched in that crowd). They are environmental and unrelated to the PDF code; the same route suite passes alone. I did not retry. A serial run (`--test-concurrency=1`) or a full-suite run on the CI/deploy machine is still owed. I did not run `npm run lint` (the full-repo lint).

**Limitations reviewed (not changed)**
- Single-subject boxed "SECTION A - PHYSICS (MCQ)" heading: kept. It is the existing single-subject layout, not a correctness defect.
- Multi-subject papers no longer subdivide each subject into MCQ and Numerical sections. This is a design choice from Phase 2. Adding exam-pattern sections would need a new setting.
- Smart PDF title: a very long title is ellipsized to make room for the subject label.
- Missing or ambiguous subject metadata: on the server a blank subject becomes "Other" once there are several subjects. In the app, `toQuestion` (`apiService.ts`) turns a blank bank subject into "Physics" before it reaches the PDF code. That is existing behaviour outside this work.
- A subject name containing a comma would be split when a complete header list is used for ordering.

## Files changed in Phase 5
- papers: `src/lib/questionPaper/html.ts` (the header-list guard), new `tests/multi-subject-route.test.ts`.
- pcmb-paper: this file only.

## Phase 4 — Multi-subject Smart PDF — done
Subtasks: [x] reuse subject order · [x] small subject label · [x] fitting untouched · [x] tests · [x] visual check

**Changes (papers)**
- `src/lib/smartSlides/html.ts`:
  - `smartSlidesHtml` now runs `arrangeQuestions()` first, so slides use the exam paper's subject order and continuous numbering. A manual order comes from the request's `subject` list, and automatic is first appearance.
  - Each slide header gets a small `.subj` label (SUBJECT, bold, 0.85em, muted colour) placed before the institute. The institute keeps its place at the right, and the question number stays its own `Q#` label.
  - This replaces the uncommitted teammate edit that wrote `Q1 · Physics` inside `.qno`. It had broken the existing "page is labelled Q1" test expectation.
  - No divider slides were added. The header height is unchanged, so the fitting maths, plan and blank-solving-slide logic did not change.
- `src/lib/questionPaper/html.ts`: new exported `subjectLabels(questions)`. Botany/Zoology print as Biology. A question with no subject is labelled "Other" only when the paper has several subjects, and gets no label with one or none.
- Reused: `arrangeQuestions`, the Botany/Zoology normalisation, the slide settings and themes, and `renderSlides`. No circular import (`questionPaper/html.ts` imports only a type from `smartSlides/layout`).
- Single-subject slides now carry the subject name as the same small label (the teammate's uncommitted edit already did this in a different form).
- Not touched: Exam PDF layout, selection, Create Test, student exam, the Smart PDF request API and settings, storage and download.

**Files modified in this phase**
- papers: `src/lib/smartSlides/html.ts`, `src/lib/questionPaper/html.ts`, `tests/smart-pdf.test.ts` (extended).
- pcmb-paper: this file only.

**Tests (run this session, papers)**
- `npx tsx --test tests/smart-pdf.test.ts tests/multi-subject-paper.test.ts tests/step2a-pdf.test.ts tests/pdf-layout.test.ts tests/make-pdf.test.ts`: 136 pass, 0 fail.
- `smart-pdf.test.ts` now has 30 tests. The 9 new ones cover:
  - 1, 2 and 3 subjects and unequal counts
  - automatic and manual order
  - interleaved input (grouped, nothing lost or repeated)
  - continuous numbering, per-slide labels, no divider slides
  - Botany/Zoology → Biology, and "Other"
  - institute placement, and hiding the institute keeps the label
  - a real Chrome print of 9 questions in 3 subjects: every question on one page, all four options together, only its own subject label, and blank solving slides for oversized questions
  - another theme, area and options layout
  - a too-long question still refused, with nothing printed
- `npx tsc --noEmit` and `npx eslint src/lib/questionPaper src/lib/smartSlides tests/smart-pdf.test.ts tests/multi-subject-paper.test.ts` (papers): clean.
- pcmb-paper was unchanged, so its checks were not re-run.

**Sample PDFs (synthetic, outside the repo)**
- Folder: `<local scratchpad folder, not committed>`
- Files: `three-subjects-smart.pdf` (11 slides), `three-subjects-smart-white.pdf` (white theme, 40% area, grid options), `two-subjects-smart.pdf`, plus page PNGs and contact sheets.

**Visual check (done)**
- I looked at a contact sheet of all 11 slides of the 3-subject sample, and opened slide 1 of the white-theme sample at full size.
- Seen: the small subject label next to the institute, the label switching PHYSICS → CHEMISTRY → MATHEMATICS at the transitions, a long Physics question and a squeezed 22-statement Chemistry question kept whole with all options, and blank solving slides after both.
- Not opened at full size: the other individual slides and `two-subjects-smart.pdf` (covered by the automated checks).

**Known limitations**
- The subject order depends on the header `subject` text. A text shortened to "A, B +N more" (over 80 characters) only orders the names it lists.
- The label is also shown on single-subject slides.
- A very long title can be shortened with an ellipsis to make room for the label, as it already could for the institute.
- This needs a backend deploy before the app shows any of this, and it was not tested through the HTTP route.

## Phase 3 — Subject-wise answer key and solutions — done
Subtasks: [x] key tables per subject · [x] solutions verified · [x] subject order check · [x] compatibility · [x] tests · [x] visual check

**Changes (papers, `src/lib/questionPaper/html.ts` only)**
- **Answer key:** with 2+ subjects it prints one compact table per subject, titled with the subject name (no Section A/B). Numbering is continuous and in question-paper order, and the cell format stays `N - answer`. Answers print exactly as stored, so "A, C", numerical values ("42", "0.5") and blank (shown as "–") all work. Single-subject keys keep their existing per-kind SECTION tables.
- **Solutions:** no code change needed. They share `columns(true)`, so they already have subject headings, the same numbering, the correct answer, and a graceful missing-explanation message.
- **Subject order:** `arrangeQuestions` used to ignore the request's subject list. It now orders subjects by the header `subject` text the app writes ("Physics, Chemistry"), with Botany/Zoology normalised to Biology. Subjects the list doesn't name follow in first-appearance order, and with no list the order is first appearance. It is stable and never drops or duplicates questions.
- `Section.kind` became optional, so subject tables carry no "(MCQ)" tag.
- Not touched: Smart PDF, selection, storage/download, question-bank fields.

**Files modified in this phase**
- papers: `src/lib/questionPaper/html.ts`, `tests/multi-subject-paper.test.ts` (extended).
- pcmb-paper: this file only.

**Tests (run this session, papers)**
- `npx tsx --test tests/pdf-layout.test.ts tests/step2a-pdf.test.ts tests/make-pdf.test.ts tests/smart-pdf.test.ts tests/multi-subject-paper.test.ts`: 127 pass, 0 fail.
- The multi-subject file now has 25 tests, covering:
  - the subject-wise key (1, 2 and 3 subjects, unequal counts)
  - manual vs automatic order
  - reordered questions with matching answers
  - multiple-correct, numerical and blank answers
  - subject-wise solutions and missing explanations
  - single-subject compatibility
  - separate answer-key export
  - a questions-only paper has no key
  - a real Chrome print of key + solutions and of the key alone
- I changed the Phase 2 test "manual and automatic subject lists give the same paper" to check that a manual list sets the order. The `paperOf` helper now writes the header subject list the way the app does (question order).
- `npx tsc --noEmit` and `npx eslint src/lib/questionPaper tests/multi-subject-paper.test.ts` (papers): clean.
- pcmb-paper was unchanged this phase, so its checks were not re-run.

**Sample PDFs (synthetic, outside the repo)**
- Folder: `<local scratchpad folder, not committed>`
- Files: `answer-key-and-solutions.pdf` (7 pages: questions 1-3, key 4, solutions 5-7) and `answer-key-only.pdf`, plus page PNGs.

**Visual check (done):** I opened the key page (p4) and solutions pages 5 and 7 of the combined sample.
- Subject tables are in order with continuous numbering.
- "A, C" and numerical answers fit, and there are no stray Section labels.
- Solutions show subject headings, the correct options highlighted, and the answer and explanation under each question.
- The MATHEMATICS heading sits mid-column, not stranded.
- Not opened: solutions page 6 and `answer-key-only.pdf` (automated checks only).

**Known issues**
- The subject order depends on the header `subject` text. If it was shortened to "A, B +N more" (over 80 characters), only the names it lists are ordered.
- Subject answer tables keep the key's existing boxed title style.
- Single-subject papers whose questions carry a subject still print the existing boxed "SECTION A - PHYSICS (MCQ)" heading (from Phase 2).
- This needs a backend deploy before the app sees it, and it was not tested through the HTTP route.

## Phase 2 — Multi-subject Exam PDF layout — done
Subtasks: [x] subject grouping · [x] heading rendering · [x] question numbering · [x] two-column pagination · [x] single-subject compatibility · [x] PDF visual verification · [x] focused tests

**What changed (papers only).** The app already sends per-question `subject` in selection order.
- `src/lib/questionPaper/html.ts`:
  - `arrangeQuestions()` groups questions by subject: case-insensitive, first-appearance order, stable inside each subject. Botany and Zoology print as Biology, as the existing code already did.
  - It is exported and runs at the start of `questionPaperHtml`, so the questions, answer key and solutions share one order and one continuous numbering.
  - With 2+ subjects, `columns()` prints a compact `.subject-title` before each group. It shows SUBJECT NAME, "N Questions" and a thin rule, with `break-after: avoid`. It replaces the Section A/B headings.
  - Questions with no subject go under "Other". Nothing is dropped and no empty sections appear.
  - One subject (or none): code path unchanged (no subject heading, same section layout and header).
- `src/lib/questionPaper/layoutFit.ts`: `.subject-name, .subject-count` added to the overflow-fit selector list.
- Reused, with no new fields and no schema or API change:
  - `PaperQuestion.subject`
  - `QuestionPaper.subject`, `title`, `standard`, `paperSet`, `date`, `marksPerQuestion`
  - the existing header and the `.columns` two-column CSS
  - the fit/check pipeline
- Total marks are still `questions.length * marksPerQuestion`.
- Not touched: Answer Key / Solutions design, Smart PDF, selection, Create Test, watermark.

**Files modified in this phase**
- papers: `src/lib/questionPaper/html.ts`, `src/lib/questionPaper/layoutFit.ts`, new `tests/multi-subject-paper.test.ts`.
- pcmb-paper: this file only.
- `html.ts` already carried uncommitted teammate edits (subject/topic fields and `sectionsOf` subject splitting). They were kept.

**Tests (run this session, papers)**
- `npx tsx --test tests/pdf-layout.test.ts tests/step2a-pdf.test.ts tests/make-pdf.test.ts tests/smart-pdf.test.ts tests/multi-subject-paper.test.ts`: 117 pass, 0 fail.
- Baseline before the edit (pdf-layout + step2a only): 39 pass.
- The new file has 15 tests:
  - 1, 2 and 3 subjects, unequal counts, interleaved and reordered input
  - manual vs automatic subject list
  - no-subject questions, Botany/Zoology
  - single-subject unchanged, header totals, shared numbering with key and solutions
  - real Chrome prints: 35 questions on 3 pages; a heading is never alone at a column bottom across 11 positions; long math with key and solutions; no layout errors
- `npx tsc --noEmit` and `npx eslint src/lib/questionPaper tests/multi-subject-paper.test.ts` (papers): clean.
- pcmb-paper was unchanged this phase, so its checks were not re-run.

**Sample PDFs (synthetic, outside the repo)**
- Folder: `<local scratchpad folder, not committed>`
- Files: `three-subjects.pdf`, `two-subjects.pdf`, `single-subject.pdf`, `heading-near-boundary.pdf`, `long-math.pdf`, plus page PNGs.
- Regenerate with `PAPER_SAMPLES_DIR=<dir> npx tsx --test tests/multi-subject-paper.test.ts`.

**Visual check (done, from rendered PNGs)**
- I opened: all 3 pages of three-subjects, page 1 of heading-near-boundary, page 1 of long-math, and page 1 of single-subject.
- That covers the first page, subject transitions, column and page boundaries, and the last page (page 3 of three-subjects).
- I saw no overlap, clipping or orphaned headings.
- The other pages were covered by the automated checks only.

## Known issues / limitations
- A single-subject paper whose questions carry a subject still prints the teammate's existing boxed "SECTION A - PHYSICS (MCQ)" heading. HEAD printed "Physics - Section A". I left it so single-subject output stays unchanged. Decide separately whether to slim it.
- In a multi-subject paper, MCQ and Numerical runs no longer get their own headings on the question pages.
- The answer key still uses the old per-kind "SECTION A - SUBJECT" tables (Phase 3). Its numbering already matches the arranged order.
- This needs a backend deploy before the app sees it. It was not tested through the HTTP route (no DB used).

## Phase 1 — done
**Behaviour**
- `Subjects: Automatic` (default) / `Subjects: Manual` toggle in the Make PDF select screen.
- Automatic: PDF subjects are the distinct `question.subject` values, in first-appearance order.
- Manual: the existing searchable `MultiSelectDropdown` in `SubjectSelector` (no chips) is the one subject choice, so subjects are not asked twice. PDF subjects are those chosen there.
- Conflict (picked questions whose subject is not in the manual list): a notice with "Add These Subjects" (target 0) and "Switch to Automatic". Continue is blocked until fixed. Questions are never removed.
- The mode resets to Automatic on Start over or a new PDF.

**Backend contract (verified):** `POST /api/question-paper-pdf` keeps `questions[]` order. Each question has `subject` (<= 40 chars). The header `subject` is <= 80 chars and is rejected, not truncated, if longer. The client sends `subjectHeader(subjects)`, which fits in 80.

**Files:** pcmb-paper new `src/screens/teacher/make-pdf/pdf-subjects.ts`, `tests/make-pdf-subjects.test.ts` (as `.mjs`); edited `make-pdf/flow.tsx`, `make-pdf/one-page.tsx`.
**Tests:** pcmb-paper full suite 433 pass, `tsc` and `expo lint` clean.
