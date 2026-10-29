# TuitionApp — UX Improvement Plan (UX-0)

_Date: 2026-10-27 · Scope: `pcmb-paper/` (mobile, three roles) and `papers/src/app/admin` (Super Admin web) · Review only: no application code, navigation, packages or APIs were changed._

This plan reviews the current implementation (after Steps 1, 1.5 and 2A) and proposes improvements for approval. Nothing here is built yet.

**How to read the recommendations.** Each has an ID (`S` Student, `T` Teacher, `A` Tuition Admin, `SA` Super Admin, `D` shared design, `N` navigation) and:

| Field | Values |
|---|---|
| Priority | **P0** fix first (a usability problem or bug) · **P1** high value · **P2** worth doing later |
| Backend | **No** (UI only, uses existing APIs) · **Small** (extend an existing endpoint) · **Yes** (new endpoint or model) |
| Complexity | **S** under a day · **M** 1–3 days · **L** more than 3 days |
| Type | **UI** (visual only) · **Usability** (flow, feedback, structure) · **Feature** (new capability) |

---

## Contents

1. [Current UI assessment](#1-current-ui-assessment)
2. [Existing role capabilities](#2-existing-role-capabilities)
3. [Missing or weak functionality](#3-missing-or-weak-functionality)
4. [Student recommendations](#4-student-recommendations)
5. [Teacher recommendations](#5-teacher-recommendations)
6. [Tuition Admin recommendations](#6-tuition-admin-recommendations)
7. [Super Admin recommendations](#7-super-admin-recommendations)
8. [Shared visual design system](#8-shared-visual-design-system)
9. [Navigation and icons](#9-navigation-and-icons)
10. [Prioritized roadmap](#10-prioritized-roadmap)
11. [Suggested screen layouts](#11-suggested-screen-layouts)
12. [Files likely to change](#12-files-likely-to-change)
13. [Decisions needed before implementation](#13-decisions-needed-before-implementation)

---

## 1. Current UI assessment

### 1.1 What is already good — keep it

- **One shared kit.** `src/components/kit.tsx` gives every role screen the same `Screen`, `Card`, `ListRow`, `StatTile`, `Badge`, `ProgressBar`, `Field`, `Button`, `Chips`, `FormSheet`, `DetailSheet`, `LoadingView` / `ErrorView` / `EmptyView` and `useLoad`. The Tuition, Teacher and Student screens are consistent because of it. **Extend it rather than replace it.**
- **A calm, warm palette** (`constants/theme.ts`): cream background, white cards, one terracotta accent, soft semantic tints, and a full dark palette with matching tokens. It suits a study app.
- **Honest states.** Nearly every list has a loading, error-with-retry and written empty state ("Your teachers mark topics here as they teach them."). Pull to refresh is on every tab.
- **Plain, friendly copy.** Labels say what happens ("Turn login off — stops them logging in, keeps their details").
- **Confirmation before destructive actions** (`confirmAction`) for delete, remove, log out, close test and submit test.
- **Platform icons.** `expo-symbols` gives SF Symbols on iOS and Material Symbols on Android/web, with filled variants for selected tabs.
- **Accessibility basics.** Roles and states on buttons, chips (`radio` / `checkbox`), progress bars and headers; live regions on errors; 46–52 pt minimum heights on inputs, buttons and rows.
- **Super Admin console** (`papers/src/app/admin`) has its own small kit (`ui.tsx`: `PageHeader`, `Panel`, `Table`, `Dialog`, `Field`, `Choice`, `Status`), a clear sidebar, confirmations for turning a tuition off, and good empty states.

### 1.2 What holds the product back

| # | Issue | Where | Effect |
|---|---|---|---|
| 1 | **Home screens are long stacks of equal-weight sections.** Student Home has 7 sections (tests, today, recent topics, coverage, insight, week, announcements); Teacher and Tuition Home are similar. | `student-home.tsx`, `teacher-home.tsx`, `tuition-home.tsx` | The one thing to do next is not obvious; lots of scrolling. |
| 2 | **No success feedback.** After saving a student, posting an announcement or creating a batch, the sheet just closes. | All `FormSheet` users | Users can't tell whether it worked. |
| 3 | **Dates and times are typed as text** ("2026-10-27", "09:30", "16:00"). | `teacher-tests.tsx` (`NewTestFlow`), `timetable.tsx` (`ClassFormSheet`), `schedule-editor.tsx` | Slow, error-prone, especially on phones. `@expo/ui` (already a dependency) ships a `DateTimePicker`. |
| 4 | **Modals open inside modals, up to three deep** (Batch → Mark topics; Students → Student → Insight / Edit / Move / Reset). | `tuition-students.tsx`, `teacher-batches.tsx`, `tuition-batches.tsx` | Users lose their place; Android back closes one layer at a time. |
| 5 | **Long chip lists.** Batches, teachers and filters render as wrapping chips. With 10+ batches they become a block of buttons. | `tuition-students.tsx`, `tuition-batches.tsx` (teacher per subject), `teacher-tests.tsx` | Crowded forms and filters. An unused `dropdown-select.tsx` already exists. |
| 6 | **Action errors appear at the top of a sheet** while the button that failed is in the footer. | `TestDetail`, `BatchDetail`, `StudentDetail`, `TeacherDetail` | Errors are missed when scrolled. |
| 7 | **The same data is loaded several times.** `teacherOverview` is fetched by Home, Batches, Tests and Profile, and all tabs mount at once (`offscreenPageLimit = tabs - 1`). | `app-tabs.tsx`, teacher screens | Slow first load on weak connections; four spinners. |
| 8 | **No type scale.** 15 different font sizes (10–40) are written inline; spacing literals ignore the `Spacing` tokens. | All screens | Small inconsistencies everywhere; harder to keep consistent. |
| 9 | **Accent and danger colours look alike.** Primary `#C6613F` and danger `#B84E45` are both red-orange; coverage bars use the accent. | `theme.ts`, `ProgressBar` | Low coverage can read as "bad"; primary and delete actions are hard to tell apart at a glance. |
| 10 | **No appearance setting.** Light/Dark/System exists (`AppearanceProvider`) but only the legacy `app/index.tsx` exposes it; role Profile screens don't. | `account-section.tsx` | Users can't choose dark mode in the app. |
| 11 | **Two looks in the teacher's question tools.** `create-exam-modal.tsx` (2,037 lines) and `app/questions.tsx` have their own chips, buttons and inputs instead of the kit's. | Teacher "Questions" tab and the New test picker | Feels like a different app inside the app. |
| 12 | **Three brand identities.** Mobile: warm cream + terracotta. Super Admin: cool grey "OMR sheet" + pink (`#C8326B`). Paper Reader: slate + indigo. | `theme.ts`, `tailwind.config.ts`, `(site)/layout.tsx` | The product doesn't read as one brand. |

### 1.3 Small defects found during the review

These are UI bugs, not design questions. All are **UI only**, size **S**.

| Defect | File |
|---|---|
| Student Home lists open tests with `mine: null`, so a test already **in progress shows "Start"** instead of "Continue". (Use the state from `studentApi.tests()` or add it to the overview; the latter is a Small backend change.) | `student-home.tsx` |
| Android back button does nothing during a test (`onRequestClose={() => {}}`) — no message, the app feels frozen. | `test-runner.tsx` |
| Batch detail shows **"Edit batch" twice** (body button and footer). The batch list also has an Edit pill *and* opens the detail on tap. | `tuition-batches.tsx` |
| PYQ practice: **"Skip" is disabled on the last question** and "Finish" closes without a summary. | `student-pyq.tsx` |
| Teacher test results list is **not tappable** (a teacher can't open the student's insight from a test). | `teacher-tests.tsx` |
| `AppHeader` menu icon is hard-coded `#000000` (invisible in dark mode). Only reachable from legacy screens today, but `AppHeader` is shared. | `app-header.tsx` |
| PYQ tab icon has the same SF Symbol for default and selected, so its selected state doesn't fill like the other tabs. | `role-tabs.tsx` |
| Super Admin: **turning a person's login off has no confirmation** (it does for a whole tuition). | `admin/(console)/tuitions/[id]/page.tsx`, `support/page.tsx` |

### 1.4 Legacy UI still in the app (for the separate cleanup step)

`_layout.tsx` renders `SignedInGate` and never a router `<Slot />`, so these routes and components are not reachable from any role: `app/index.tsx`, `app/explore.tsx`, `app/profile.tsx`, `context/rooms-context.tsx`, `components/edit-room-modal.tsx`, `exam-room-details-modal.tsx`, `edit-paper-modal.tsx`, `pdf-builder-screen.tsx`, and the "exam room / room code" branch inside `create-exam-modal.tsx`. `PRODUCT.md` also still describes demo rooms and a "Papers" tab. They are out of scope for UX-0; flagging so the cleanup step can confirm and remove them, and so `PRODUCT.md` can be updated once this direction is approved.

---

## 2. Existing role capabilities

### Student (5 tabs: Home · Tests · Syllabus · PYQs · Profile)

| Area | Implemented |
|---|---|
| Home | Greeting with batch; open tests; today's classes; recently covered topics; syllabus coverage per subject; last test score; strong / weak topic chips; week timetable; announcements; local class reminders 15 min before each class. |
| Tests | To-do and past lists; start / continue / score / missed badges; full-screen runner with timer, autosave (0.8 s debounce), question palette, submit confirmation with unanswered count, auto-submit at zero; review with score, right/wrong/skipped and every solution. |
| Syllabus | Subject chips; covered %, strong and weak counts; chapter cards with marks weightage, coverage bar, accuracy level, expandable topics with "covered on" dates. |
| PYQs | Subject chips; per-chapter counts with done/right; "Practise all"; one-at-a-time practice with check answer, solution, session score and "you got this wrong before" hints. |
| Profile | Account (edit details, change password, log out); track, class, batch, subjects; tuition contact. |
| Onboarding | Register → verify email (6-digit code) → join a tuition with a code → wait for acceptance. |

### Teacher (5 tabs: Home · Batches · Tests · Questions · Profile)

| Area | Implemented |
|---|---|
| Home | Batches / students / weekly hours tiles; today's classes; weekly timetable with add / edit / delete class; announcements (post to own batches). |
| Batches | Batch cards with coverage per subject; detail with track, venue, schedule; **mark topics covered**; recently covered; per-student analysis (tests, average, weak topics); batch's weakest topics; tap a student for full insight. |
| Tests ("Test Room") | Filter by batch; new test (batch, time limit, negative marking, open now / later, auto-close) → question picker (class, subject, chapters, topics, levels, count, auto-select, edit question); detail with status, results per student, average; analysis: score spread, topic understanding, hardest questions with option choices; close now; delete. |
| Questions | Make a PDF paper (same picker, question paper / answers / solutions); browse the whole bank with filters and make a PDF of the results; My PDFs (open, share, print). |
| Profile | Totals, subjects, batches, tuition, link to My PDFs, account. |

### Tuition Admin (5 tabs: Home · Batches · Teachers · Students · Profile)

| Area | Implemented |
|---|---|
| Home | Notification bell with join-request count (polled every 30 s); "N people want to join" row; students / teachers / batches tiles; unassigned-students note; batch cards with coverage; announcements (all batches or chosen ones). |
| Batches | Create / edit / delete; track, class, subjects, venue, weekly schedule, a teacher per subject; detail with timings, teachers, coverage, student analysis. |
| Teachers | Add with starting password, edit, subjects; detail with batches; reset password; login on/off; remove. |
| Students | Search; filter by batch or "No batch"; enroll with starting password; edit; move / take out of batch; insight; reset password; login on/off; remove. |
| Profile | Tuition details; **chapter weightage editor** per track and subject; account. |
| Join requests | Accept as student (track, class, batch) or teacher (subjects); reject; join code to share and renew (inside the notifications sheet). |

### Super Admin (web: Dashboard · Tuitions · Support)

| Area | Implemented |
|---|---|
| Dashboard | Network totals (tuitions, teachers, students, batches, tests set / taken); 30-day sign-up chart; last-7-days activity; largest tuitions. |
| Tuitions | Search; table with status, login email, counts, joined date; add tuition with generated password and copyable login details. |
| Tuition detail | Edit details; turn tuition off / on (with confirmation); owner's login and reset; contact; tabs for batches, teachers, students, tests; reset passwords and login on/off per person. |
| Support | Search anyone by name, email or phone; filter by role or "not in a tuition"; unlock and reset; login on/off; first 50 results. |

---

## 3. Missing or weak functionality

Grouped by how often it hurts. Attendance is intentionally excluded.

**Daily friction (every role, every day)**
- No clear "what's next" at the top of Home (all roles).
- No confirmation that a save worked.
- Typing dates and times.
- Deeply nested sheets.

**Teacher workflows that are incomplete**
- A test can't be edited after creation (rename, change time, extend the deadline) — **the API already supports it** (`schoolApi.updateTest` accepts `title`, `durationMinutes`, `opensAt`, `closesAt`); only "Close now" is exposed.
- Results can't be sorted, filtered (not taken / in progress) or opened per student.
- No way to nudge students who haven't taken a test.
- No way to re-use a test for another batch.
- Creating a test asks for the class and subject even though the batch already implies them; the test name is on the second screen.

**Tuition Admin gaps**
- **No view of tests at all**, although `GET /api/tests` already returns every test in the tuition for this role.
- The join code is hidden inside the notifications sheet.
- After enrolling a student or teacher there is no way to share their login details.
- No bulk actions (assign several students to a batch, import a class list).
- Teacher ↔ batch assignment is only possible from the batch's edit form.

**Student gaps**
- Weak topics are shown but there is no "practise this" action next to them.
- No "mark for review" in tests, no time warnings, no visible save status.
- Test review can't filter to wrong or skipped answers; no comparison with the batch.
- PYQs can't be filtered by exam or year, bookmarked, or retried by "only the ones I got wrong".
- No way to switch light / dark theme.

**Super Admin gaps**
- No "needs attention" list (inactive tuitions, tuitions with no batches or tests).
- No last-activity column, status filter or sorting on the Tuitions table.
- People lists stop at 50 with no pagination.
- No record of who changed what (audit log).
- No success notices after actions.

---

## 4. Student recommendations

### UI-only improvements

| ID | Current problem | Proposed solution | Expected benefit | Priority | Backend | Complexity |
|---|---|---|---|---|---|---|
| S-1 | In-progress tests show "Start" on Home (see 1.3). | Show the student's state: Continue / Start, and "closes in 2 h" when near. | Correct and reassuring. | P0 | No (or Small to add state to overview) | S |
| S-2 | Test list shows only raw info; no sense of urgency or result quality. | To-do sorted by closing time with "closes today / in 3 h"; past tests show score **and** a tone badge (≥70 % green, <40 % red, as in teacher views). | Students see what's urgent and how they did at a glance. | P1 | No | S |
| S-3 | Results screen is a long list of every question. | Add a segmented filter **All · Wrong · Skipped** and a per-subject / per-chapter mini summary above it; keep the existing cards. | Faster learning from mistakes. | P1 | No | M |
| S-4 | Syllabus roadmap is alphabetical; weak chapters are buried. | Sort toggle **Syllabus order · Weakest first**; group headings for 11th / 12th. | Finds what to revise quickly. | P2 | No | S |

### Usability improvements

| ID | Current problem | Proposed solution | Expected benefit | Priority | Backend | Complexity |
|---|---|---|---|---|---|---|
| S-5 | Home has 7 equal sections; the next action is unclear. | Restructure Home: **Next up** card (open test, else next class) → **Today** → **Your progress** (last result + up to 3 weak topics, each with "Practise") → latest 2 announcements → "Full week timetable" row that opens a sheet. Covered-lately list moves into the Syllabus tab. See layout 11.1. | One-glance Home; less scrolling. | P0 | No | M |
| S-6 | Test runner: no warnings, no save status, Android back silently ignored, palette hidden by default with only 2 states. | 1) Toast at 5 min and 1 min left. 2) Small "Saved · Saving… · Offline, will retry" label under the timer. 3) Android back → dialog "Submit now or keep going?". 4) Palette legend with **Answered / Not answered / Marked / Current**. 5) **Mark for review** toggle (kept on the phone for this attempt). | Fewer anxious students; fewer lost answers; standard exam UX (NTA-style). | P0 | No (marks are local; Small if they should survive a phone switch) | M |
| S-7 | Weak topics have no follow-up action. | "Practise" button on each weak topic (Home and Syllabus) opens PYQ practice for that chapter. | Turns analysis into practice. | P1 | No (chapter level) · Small (topic level filter on `/pyq`) | S |
| S-8 | PYQ session ends abruptly; Skip disabled on last question. | End-of-session summary: answered, right, accuracy, "Practise the wrong ones again" (session-only list). Keep Skip enabled; it goes to the summary. | Closure and a clear next step. | P1 | No | S |
| S-9 | No theme choice. | Add **Appearance: System · Light · Dark** to Profile (shared `AccountSection`, all roles). | Comfort at night; uses existing provider. | P1 | No | S |
| S-10 | Class reminders are always on. | "Class reminders" switch in Profile (stores locally, calls existing `syncClassReminders` / cancel). | Respects user preference. | P2 | No | S |

### New features requiring backend work

| ID | Current problem | Proposed solution | Expected benefit | Priority | Backend | Complexity |
|---|---|---|---|---|---|---|
| S-11 | A score alone has no context. | On the result screen: batch average, highest, and the student's rank (e.g. "7th of 32"), shown only after the test closes. | Motivation and realistic self-assessment. | P1 | Small (`/tests/:id` for students: add batch stats after close) | M |
| S-12 | PYQs can't be filtered by exam or year. | Filter chips for exam (NEET / JEE Main / JEE Adv / state CETs from `source`) and year range. | Targeted exam prep. | P1 | Small (`/pyq` filters) | M |
| S-13 | Can't keep hard questions to revisit. | **Bookmark** on any PYQ or reviewed test question; "Saved questions" list in the PYQs tab. | Personal revision list. | P2 | Yes (new collection) | M |
| S-14 | "Retry only my wrong PYQs" is impossible across sessions. | "Mistakes" practice mode per subject from `PracticeAnswer` where last answer was wrong. | High-value revision with data already stored. | P2 | Small (query on existing model) | M |

---

## 5. Teacher recommendations

### UI-only improvements

| ID | Current problem | Proposed solution | Expected benefit | Priority | Backend | Complexity |
|---|---|---|---|---|---|---|
| T-1 | Results list is unsorted, not tappable, mixes taken and not taken. | Segmented **Submitted (n) · In progress (n) · Not taken (n)**; submitted sorted by score with rank; tap opens `StudentInsightSheet`. | Faster marking review; reaches individual analysis in one tap. | P0 | No | S |
| T-2 | Profile repeats Home's stat tiles. | Keep the tiles on Home only (or replace them, see T-5); Profile shows subjects, batches, tuition, account. | Less duplication. | P2 | No | S |
| T-3 | Test list shows status as a badge only. | Sub-line by status: Scheduled → "opens Mon 9:30"; Open → "18/32 submitted · closes in 2 d" with a thin progress bar; Closed → "avg 54 %". | Status and progress without opening each test. | P1 | No | S |

### Usability improvements

| ID | Current problem | Proposed solution | Expected benefit | Priority | Backend | Complexity |
|---|---|---|---|---|---|---|
| T-4 | A test can't be changed after creation (only Close / Delete). | **Edit test** sheet: name, time limit, opens at, closes at (with "Extend by 1 day"); scheduled tests editable in full, open tests can only extend. | Fixes mistakes without deleting results. | P0 | No (`updateTest` already accepts these; verify "reopen a closed test" rules) | M |
| T-5 | Home shows totals and a full timetable but not what needs attention. | Home: **Today** (classes, each with "Mark topic covered") → **Needs attention** (open tests with low submissions, tests closing today, scheduled tests) → **Weak topics across my batches** (top 3) → announcements. Timetable editing moves to a "Weekly timetable" row/sheet. See 11.3. | Home leads to the next teaching action. | P1 | No (combines `/teacher/overview`, `/tests`, `/analysis/batch`) — Small if a single summary endpoint is preferred | M |
| T-6 | New test asks for batch and timing on one sheet, then name, class and subject again on the picker. | One flow, three clear steps with a step indicator: **1 Details** (name, batch → class and subject prefilled from the batch, time limit, marking) → **2 Questions** (existing picker) → **3 Schedule & publish** (opens / closes with date-time pickers, summary). | Fewer fields, fewer mistakes. | P1 | No | M |
| T-7 | Dates and times typed as text (tests, timetable). | Use `DateTimePicker` from `@expo/ui/community/datetime-picker` (already installed) via a kit `DateTimeField`; keep text fallback on web if needed. | Faster, no format errors. | P0 | No | M |
| T-8 | "Questions" tab label doesn't match its content (opens "Make a PDF paper"); My PDFs is reachable via a hidden mode and from Profile. | Rename the tab **Papers**; segmented control at the top: **Make paper · Question bank · My PDFs**. | Discoverable tools, honest label. | P1 | No | S |
| T-9 | Marking topics covered opens a sheet on top of the batch sheet. | From Today's class row: "Mark covered" opens the syllabus picker already filtered to that batch and subject; in batch detail, show it inline under a **Syllabus** segment instead of a nested sheet. | Fewer layers; marking becomes a 2-tap daily habit. | P1 | No | M |
| T-10 | The question picker (`create-exam-modal.tsx`) uses its own chips, inputs and buttons. | Re-skin with kit components (`Chips`, `Field`, `Button`, `Card`), keep its logic. Split the file by step while doing it. | Consistent look; easier maintenance. | P2 | No | L |

### New features requiring backend work

| ID | Current problem | Proposed solution | Expected benefit | Priority | Backend | Complexity |
|---|---|---|---|---|---|---|
| T-11 | No way to remind students who haven't taken an open test. | "Remind 12 students" button on an open test → push notification (push infra exists in `lib/push.ts`). Rate-limit to once per few hours. | Higher completion without phone calls. | P1 | Yes (new endpoint using existing push) | M |
| T-12 | Re-using a test for another batch means rebuilding it. | **Duplicate to batch…** on a test: copies questions and settings to a new scheduled test. | Saves the most repetitive teacher task. | P1 | Small (server-side copy endpoint) | M |
| T-13 | Hardest questions are shown but can't be acted on. | "Make a practice PDF of these" / "Set a re-test on weak topics" from the analysis. | Closes the teach → test → re-teach loop. | P2 | Small (return question ids in analysis) | M |
| T-14 | Results can't leave the app. | "Share results" → PDF of the results table using the existing PDF pipeline. | Parent meetings, records. | P2 | Small | M |

---

## 6. Tuition Admin recommendations

### UI-only improvements

| ID | Current problem | Proposed solution | Expected benefit | Priority | Backend | Complexity |
|---|---|---|---|---|---|---|
| A-1 | "Edit batch" appears twice in batch detail; list rows have an Edit pill and also open the detail. | One Edit button in the detail footer; rows just open the detail. | Cleaner, less ambiguous. | P0 | No | S |
| A-2 | Batch / teacher choices render as wrapping chips (students filter, batch form "teacher per subject", accept-join sheet). | Chips up to ~5 options; above that, a kit `Select` built on the existing `dropdown-select.tsx` (searchable). | Short, scannable forms. | P1 | No | M |
| A-3 | After enrolling a student or adding a teacher, the admin must relay the password manually; there's no Generate button (the web admin has one). | **Generate** button on the password field; after save, a "Login details" card with **Share** (native share sheet) and Copy. | Faster onboarding; fewer typos. | P0 | No | S |
| A-4 | Join code is hidden inside the notifications sheet. | An **Invite** card on Home (and People tab) with the code, Share and Renew. Rename the bell sheet "Join requests". | Growth action is visible. | P1 | No | S |

### Usability improvements

| ID | Current problem | Proposed solution | Expected benefit | Priority | Backend | Complexity |
|---|---|---|---|---|---|---|
| A-5 | Home is totals + full batch cards; the unassigned-students note isn't actionable. | Home: **Needs attention** list (join requests · N students with no batch → opens Students filtered "No batch" · batches missing a teacher for a subject · batches without timings) → compact totals → **This week** (tests set / taken) → batch list (one line each with coverage bar) → announcements. See 11.4. | Admin sees and fixes problems in one tap each. | P0 | No (overview + batches + tests) — Small to return "missing teacher" in overview | M |
| A-6 | No view of tests, although the API returns all tuition tests for this role. | Add a **Tests** tab (read-only): filter by batch, status; open test → results and analysis (reuse teacher `TestDetail` without edit actions). | Owners can follow academic activity. | P1 | No | M |
| A-7 | Teachers and Students are two tabs with the same shape; no room for Tests. | Merge into **People** with a segmented control **Students · Teachers** (search, filters and actions unchanged). Tabs become Home · Batches · People · Tests · Profile. | Keeps 5 tabs while adding Tests. | P1 | No | M |
| A-8 | Student detail opens Insight, Edit, Move and Reset as sheets on top of a sheet. | Student detail becomes one page with segments **Details · Performance**; Edit / Move / Reset stay as sheets (max 2 levels). | Fewer stacked modals. | P1 | No | M |
| A-9 | Assigning a teacher to a batch is only possible from the batch form. | In teacher detail: "Assign to batch" → pick batch and subject (calls `updateBatch` with the new teacher). | Matches how owners think ("give Riya the NEET batch"). | P2 | No | M |
| A-10 | Moving many students is one at a time (4 taps each). | Multi-select mode in the Students list → "Move to batch…" (sequential calls at first). | Start-of-term setup in minutes. | P1 | No (Small for a bulk endpoint later) | M |

### New features requiring backend work

| ID | Current problem | Proposed solution | Expected benefit | Priority | Backend | Complexity |
|---|---|---|---|---|---|---|
| A-11 | Enrolling a class means one form per student. | **Import students**: paste rows (name, email, phone, parent phone) or pick a CSV; preview, then create with generated passwords and a shareable login list. | Onboarding a tuition goes from hours to minutes. | P1 | Yes (bulk create with validation) | L |
| A-12 | No overview of how batches compare. | Batch comparison on Home or Tests: average score last 30 days, tests taken, coverage. | Spots a struggling batch early. | P2 | Small (aggregate in `/tuition/overview`) | M |
| A-13 | Student list loads everyone at once. | Paginate / infinite scroll beyond ~100 students. | Stays fast for large tuitions. | P2 | Small | M |

---

## 7. Super Admin recommendations

The console keeps its existing structure (sidebar, `Panel`, `Table`, `Dialog`).

### UI-only improvements

| ID | Current problem | Proposed solution | Expected benefit | Priority | Backend | Complexity |
|---|---|---|---|---|---|---|
| SA-1 | Turning a person's login off has no confirmation; no success notice after any action. | Confirmation dialog for login off (matching the tuition one); a small toast ("Password reset", "Login turned off") in `ui.tsx`. | Prevents mis-clicks; confirms results. | P0 | No | S |
| SA-2 | Tuition detail has no summary; the Students tab can be long with no search. | Summary strip under the title (students, teachers, batches, tests last 30 days, owner last login); search box above People tables (client-side). | Health at a glance; fast lookup. | P1 | No | S |
| SA-3 | Mobile top bar uses a text "Menu" button. | Icon button with `aria-label`, current page name in the bar. | Tidier on phones. | P2 | No | S |
| SA-4 | Tuitions table can't be filtered by status. | Status filter **All · Active · Turned off** (`Choice` component), client-side on the loaded list. | Quick support triage. | P2 | No | S |

### Usability improvements and features

| ID | Current problem | Proposed solution | Expected benefit | Priority | Backend | Complexity |
|---|---|---|---|---|---|---|
| SA-5 | Dashboard lists the largest tuitions but not the ones in trouble. | **Needs attention** panel: tuitions with no owner login in 14 days, no batches, no tests in 30 days, or many locked accounts. Replaces or sits above "Largest tuitions". | Proactive support. | P1 | Small (extend `/api/admin/overview`) | M |
| SA-6 | Tuitions table has no activity signal or sorting. | "Last active" column (latest login of anyone in the tuition) and sortable columns. | Finds dormant customers. | P1 | Small | M |
| SA-7 | Support search stops at 50 people. | Pagination ("Next 50") or "load more". | Works at network scale. | P2 | Small | S |
| SA-8 | No record of admin actions (resets, logins off, tuitions off). | **Activity log** page: who, what, when, target; filter by tuition. | Accountability and debugging support cases. | P2 | Yes (new model + writes in admin routes) | L |
| SA-9 | Tests tab in tuition detail is read-only text. | Status column and average score; link to a read-only results view. | Lets support answer "did students take it?" | P2 | Small | M |

---

## 8. Shared visual design system

### 8.1 Design direction: "Calm study desk"

One direction for all three surfaces, built on what the mobile app already has.

- **Surfaces:** warm paper background (`#FAF9F5` / dark `#262624`), white cards with 1 px hairline borders, no shadows except the tab bar. No gradients.
- **One accent for action.** Terracotta (`primary`) is reserved for primary buttons, selected states, links and the current tab. It is **not** used for data.
- **Semantic colour for data only.** Success green = strong / done / ≥70 %; warning amber = needs work / closing soon; danger = wrong / destructive; neutral ink for coverage and progress. Violet stays for subject tags only.
- **Typography:** system fonts (SF Pro, Roboto) — no new font packages. A fixed scale (8.2), numbers in tabular figures (already used).
- **Density:** comfortable — 16 pt screen padding, 12–16 pt between cards, one primary action per screen, secondary actions as text buttons or list rows.
- **Motion:** only functional (sheet slide, tab pill). No decorative animation.
- **Super Admin web:** keep its layout and `Public Sans`. Align its accent with the mobile terracotta and its neutrals with the warm palette so the product reads as one brand (decision 13.2). The "bubble" status marks can stay.

### 8.2 Tokens to add to `constants/theme.ts`

Add tokens; migrate the kit first, then screens gradually.

| Token | Values | Notes |
|---|---|---|
| `Type` | `caption 12/16` · `footnote 13/18` · `body 15/21` · `callout 16/22` · `headline 17/22 semibold` · `title 22/28 bold` · `display 28/34 bold` · `score 40 heavy` | Replaces 15 ad-hoc sizes. Weights: 400, 600, 700, 800 for numbers only. |
| `Space` | 4 · 8 · 12 · 16 · 24 · 32 | Kit already uses these values as literals. |
| `Radius` | `sm 8` (inputs, small chips) · `md 12` (buttons, options) · `lg 14` (cards) · `pill 999` | Matches current kit. |
| `Touch` | `min 44` | Apply to icon-only buttons (announcement delete, Edit pill, close). |
| Colour roles | `accent` (= primary), `data.good/mid/bad/neutral`, `progress` (neutral ink, success when complete) | Fixes issue 1.2 #9 without changing the palette. |

Dark mode: the dark palette is complete; check each new token in both themes. Remove the hard-coded `#000000` / `#C6613F` in `app-header.tsx`.

### 8.3 Kit components to add (no new dependencies)

| Component | Built from | Replaces / used by |
|---|---|---|
| `Toast` (+ `useToast`) | RN `Animated`, a provider in `_layout.tsx` | Success notices after every save; test time warnings. |
| `DateTimeField` | `@expo/ui/community/datetime-picker` (installed) | Test scheduling, timetable, batch timings. Verify it is in the current dev build before use. |
| `Select` | existing `components/dropdown-select.tsx` | Long batch / teacher lists. |
| `Segmented` | existing `ChipRow` styling, `tablist` role | People tab, results filters, Papers tab modes. |
| `SearchField` | style already inline in `tuition-students.tsx` | Students, teachers, question bank. |
| `NextUpCard` | `Card` + `Button` | Top of every Home. |
| `AttentionRow` | `ListRow` + count badge + tone | Teacher / Tuition Home "Needs attention". |
| `Notice` | `Card` with info / warning tone | Replaces loose `Muted` hints such as "You're not in a batch yet". |
| `Avatar` | moves from `account-section.tsx` | Student and teacher lists, results. |

Keep `Card`, `ListRow`, `StatTile`, `Badge`, `ProgressBar`, `FormSheet`, `DetailSheet`, `useLoad` as they are.

### 8.4 State patterns

| State | Rule |
|---|---|
| Loading | First load: `LoadingView` in place of the content, header stays. Refresh: keep content (already done by `useLoad`). |
| Empty | Always `EmptyView` with icon, one-line reason and, where possible, the action that fills it. Replace bare `Muted` empties. |
| Error (load) | `ErrorView` with retry (already consistent). |
| Error (action) | Show next to the action (sheet footer, above the button), not at the top of the sheet. |
| Success | `Toast` ("Student enrolled", "Test scheduled for Mon 9:30") — never silent. |
| Destructive | Keep `confirmAction`; name the object and the consequence (already good). |

### 8.5 Accessibility checklist

- Tab buttons: `accessibilityRole="tab"` and a `tablist` container (currently `button`).
- Icon-only controls ≥ 44 pt (announcement delete, Edit pill, sheet close).
- Test the main screens at the largest text size: `TAB_BAR_HEIGHT`, the 6-box code input, chip rows and `StatTile` (`adjustsFontSizeToFit`) are fixed-height risks.
- Colour is never the only signal: keep text labels on result tones ("Weak · 32 %") — already mostly done; add icons to the test palette legend.
- Timer: announce at 5 and 1 minute via the toast's live region rather than every second.
- Contrast: muted text on cream is ~4.6:1 (passes AA for body); keep it off tinted backgrounds.

---

## 9. Navigation and icons

### 9.1 Tab structure (proposed — not changed yet)

| Role | Today | Proposed | Why |
|---|---|---|---|
| Student | Home · Tests · Syllabus · PYQs · Profile | Home · Tests · Syllabus · **Practice** · Profile | "Practice" is clearer than "PYQs" and leaves room for Mistakes / Saved questions. |
| Teacher | Home · Batches · Tests · Questions · Profile | Home · Batches · Tests · **Papers** · Profile | Label matches the content (make paper, bank, My PDFs). |
| Tuition Admin | Home · Batches · Teachers · Students · Profile | Home · Batches · **People** · **Tests** · Profile | Adds test oversight without a 6th tab. |
| Super Admin (web) | Dashboard · Tuitions · Support | Dashboard · Tuitions · Support · (later) Activity | Activity log when SA-8 is built. |

Five tabs is the limit; none of the proposals adds a sixth.

### 9.2 Navigation behaviour

| ID | Problem | Proposal | Priority | Backend | Complexity |
|---|---|---|---|---|---|
| N-1 | All tabs mount and fetch at once; `teacherOverview` is fetched by four tabs. | Share one overview result per role through a small context (or `useLoad` cache keyed by URL), invalidated by `bumpDataVersion`. | P1 | No | M |
| N-2 | Sheets stack up to three deep. | Rule: at most **page → sheet → one form sheet**. Detail pages with sections use `Segmented` instead of opening another detail sheet. Longer term, consider Expo Router stack routes for detail pages (already installed) — separate decision. | P1 | No | M |
| N-3 | Swiping horizontally anywhere changes tab. | Keep swipe (users may rely on it), but disable it while a horizontal control is touched, and consider turning it off for the Tuition role where forms are common. Decision 13.4. | P2 | No | S |
| N-4 | Notification taps open a tab, not the item. | Pass the test / announcement id and open its detail. | P2 | Small (payload) | S |
| N-5 | Android back inside full-screen flows (test runner, question picker) is ignored or loses work. | Handle back explicitly: confirm before leaving, never no-op. | P0 | No | S |

### 9.3 Icons

Add `src/constants/icons.ts`: one semantic map (`batch`, `student`, `teacher`, `test`, `syllabus`, `practice`, `paper`, `announcement`, `timetable`, `analysis`, `invite`, …) to `{ ios, android }` pairs, each with a default and selected (filled) form. Screens import names instead of repeating symbol pairs (the same pairs are written 40+ times today).

| Concept | iOS (default / selected) | Android / web | Change |
|---|---|---|---|
| Home | `house` / `house.fill` | `home` | — |
| Batches | `square.grid.2x2` / `.fill` | `grid_view` | — |
| Tests | `list.clipboard` / `.fill` | `assignment` | — |
| Syllabus | `map` / `map.fill` | `map` | — |
| Practice (PYQs) | `pencil.and.list.clipboard` / same + tint, or `clock.arrow.circlepath` with `circle.fill` badge | `history_edu` | Gives the selected state a visible change. |
| Papers | `doc.text` / `doc.text.fill` | `description` | Replaces `questionmark.circle`, which reads as "help". |
| People | `person.2` / `person.2.fill` | `group` | New tab. |
| Teacher (row) | `person.crop.rectangle` | `co_present` | — |
| Student (row) | `person` / initials avatar | `person` | Avatar instead of the generic icon in lists. |
| Profile | `person.crop.circle` / `.fill` | `account_circle` | — |

Rules: 17–18 pt in rows, 25 pt in the tab bar, always tinted with a palette token, never decorative.

---

## 10. Prioritized roadmap

Each phase is shippable on its own and ordered so the first one needs no backend changes.

### Phase 0 — Approve direction (this document)
Decide items in section 13.

### Phase 1 — Foundations and quick fixes · UI only · ~1 week
| Order | Items |
|---|---|
| 1 | Tokens (8.2) and kit additions: `Toast`, `DateTimeField`, `Select`, `Segmented`, `Notice`, `Avatar`. |
| 2 | Defects in 1.3 (in-progress "Start", Android back, duplicate Edit, PYQ Skip, tappable results, header colour, admin confirmations). |
| 3 | Success toasts on every save (all roles) and action errors next to their button. |
| 4 | Date-time pickers: T-7. |
| 5 | Appearance setting: S-9. |
| 6 | A-3 (generate + share login details), SA-1. |

### Phase 2 — Core workflows · mostly UI only · ~2 weeks
| Order | Items |
|---|---|
| 1 | Test runner: S-6. Results filters: S-3. |
| 2 | Teacher tests: T-1, T-3, T-4 (edit / extend), T-6 (one flow). |
| 3 | Home restructure for all three app roles: S-5, T-5, A-5. |
| 4 | Practise from weak topics: S-7, PYQ summary S-8. |
| 5 | Tuition: A-1, A-2, A-4, A-6 (Tests tab), A-7 (People), A-8. |
| 6 | Navigation: N-1, N-2, N-5; icon map 9.3; tab label changes 9.1. |

### Phase 3 — Backend-backed features · ~3–4 weeks
| Order | Items |
|---|---|
| 1 | T-11 remind non-submitters, T-12 duplicate test. |
| 2 | S-11 batch stats on results, S-12 PYQ exam/year filters. |
| 3 | A-11 student import, A-10 bulk move (bulk endpoint). |
| 4 | SA-5 needs-attention, SA-6 last-active and sorting, SA-7 pagination. |

### Phase 4 — Later
S-13 bookmarks, S-14 mistakes mode, T-13, T-14, A-12, A-13, SA-8 activity log, SA-9, T-10 re-skin of the question picker, N-3, N-4, S-10, S-4, T-2.

---

## 11. Suggested screen layouts

Wireframes show structure only; they use existing kit pieces.

### 11.1 Student Home

```
┌──────────────────────────────────────┐
│ Hi, Aarav               NEET Morning │  header (unchanged)
├──────────────────────────────────────┤
│ NEXT UP                              │
│ ┌──────────────────────────────────┐ │
│ │ Physics weekly test              │ │  NextUpCard
│ │ 30 Q · 60 min · closes in 3 h    │ │  (else: next class)
│ │ [ Continue test ]                │ │
│ └──────────────────────────────────┘ │
│ TODAY                                │
│ 16:00  Chemistry · Room 2 · Mr Rao   │  ClassRow
│ 17:30  Physics   · Room 2 · Ms Iyer  │
│ YOUR PROGRESS                        │
│ ┌──────────────────────────────────┐ │
│ │ Last test  68/120 · avg 61       │ │
│ │ Needs work                       │ │
│ │  Rotational motion 32%  Practise │ │  S-7
│ │  Electrochemistry  38%  Practise │ │
│ └──────────────────────────────────┘ │
│ ANNOUNCEMENTS                See all │
│  No class on Friday · 2 h ago        │
│ ──────────────────────────────────── │
│  Weekly timetable                  › │  opens sheet
└──────────────────────────────────────┘
```

### 11.2 Test runner

```
┌──────────────────────────────────────┐
│ Physics weekly test        ⏱ 42:10   │
│ Saved · Q 7 of 30 · 6 answered       │  save status (S-6)
│ [■1][■2][□3][◆4][■5][□6][●7] …  ▾   │  ■ answered □ not ◆ marked ● current
├──────────────────────────────────────┤
│ Q7 · Kinematics                      │
│ A particle moves …                   │
│ ( A ) …                              │
│ ( B ) …   ✓ selected                 │
│ ( C ) …                              │
│ ( D ) …                              │
│ ☐ Mark for review                    │
├──────────────────────────────────────┤
│ [ Back ]              [ Next ]       │
│           Submit test                │  text button
└──────────────────────────────────────┘
```

### 11.3 Teacher Home

```
┌──────────────────────────────────────┐
│ Hello, Priya            Sharma Class │
├──────────────────────────────────────┤
│ TODAY                                │
│ 16:00  NEET Morning · Physics        │
│        [ Mark topic covered ]        │  T-9
│ NEEDS ATTENTION                      │
│  ● Physics test · 12/32 submitted  › │  AttentionRow (T-5)
│  ● Chem quiz closes today          › │
│  ○ Bio test opens Mon 9:30         › │
│ WEAK ACROSS YOUR BATCHES             │
│  Rotational motion   34%           › │
│  Thermodynamics      41%           › │
│ [ + New test ]                       │  primary action
│ ANNOUNCEMENTS               See all  │
│  Weekly timetable                  › │
└──────────────────────────────────────┘
```

### 11.4 Tuition Admin Home

```
┌──────────────────────────────────────┐
│ Sharma Classes                  🔔 3 │
├──────────────────────────────────────┤
│ NEEDS ATTENTION                      │
│  3 people want to join             › │
│  5 students have no batch          › │  opens People, "No batch"
│  NEET Evening has no Biology teacher›│
│ ┌────────┬─────────┬────────┐        │
│ │ 142    │ 9       │ 6      │        │  compact StatGrid
│ │students│teachers │batches │        │
│ └────────┴─────────┴────────┘        │
│ THIS WEEK  4 tests set · 96 taken    │
│ BATCHES                              │
│  NEET Morning   ▓▓▓▓▓░░ 62%        › │
│  JEE 12th       ▓▓▓░░░░ 41%        › │
│ INVITE  Code SHR-4821  [Share]       │  A-4
│ ANNOUNCEMENTS     [ New ]   See all  │
└──────────────────────────────────────┘
```

### 11.5 Tuition Admin People

```
┌──────────────────────────────────────┐
│ People                               │
│ [ Students | Teachers ]   [+ Enroll] │  Segmented
│ 🔍 Search name or email              │
│ Batch: [ All batches ▾ ]   [Select]  │  Select (A-2), multi-select (A-10)
├──────────────────────────────────────┤
│ (AK) Aarav Kumar                   › │
│      NEET · 12th · NEET Morning      │
│ (RS) Riya Shah                     › │
│      No batch                [Notice]│
└──────────────────────────────────────┘
```

### 11.6 Teacher test detail

```
┌──────────────────────────────────────┐
│ Physics weekly test            Open  │
│ NEET Morning · 30 Q · 120 marks      │
│ Closes Thu 18:00   [Edit] [Extend]   │  T-4
│ ▓▓▓▓▓▓░░░░ 18 of 32 submitted        │
│ [ Remind 14 students ]               │  T-11 (Phase 3)
│ [ Submitted 18 | In progress 2 | Not taken 12 ]
│  1  Aarav Kumar         96/120     › │  tap → insight (T-1)
│  2  Riya Shah           88/120     › │
│ SCORE SPREAD · TOPICS · HARDEST Qs   │  existing analysis
├──────────────────────────────────────┤
│ [ Delete ]            [ Close now ]  │
└──────────────────────────────────────┘
```

### 11.7 Super Admin dashboard

```
┌──────────┬───────────────────────────────────────────────┐
│ PCMB     │ Dashboard                     [Add a tuition] │
│ Admin    │ ┌──────┬──────┬──────┬──────┬──────┬──────┐   │
│          │ │Tuit. │Teach.│Stud. │Batch.│Tests │Taken │   │ totals (kept)
│ ● Dash   │ └──────┴──────┴──────┴──────┴──────┴──────┘   │
│ ○ Tuit.  │ NEEDS ATTENTION                               │ SA-5
│ ○ Support│  Apex Classes   no owner login 21 days     ›  │
│          │  Bright Minds   no tests in 30 days        ›  │
│          │  Vidya Tutorial 4 locked accounts          ›  │
│          │ ┌ New people, 30 days ─────┐ ┌ Last 7 days ┐  │
│          │ │ ▁▂▅▃▁▇▂ …                │ │ …            │  │
│          │ └──────────────────────────┘ └─────────────┘  │
└──────────┴───────────────────────────────────────────────┘
```

---

## 12. Files likely to change

### Mobile (`pcmb-paper/src`)

| File | Changes | IDs |
|---|---|---|
| `constants/theme.ts` | Type, space, radius and colour-role tokens. | 8.2 |
| `components/kit.tsx` | Use tokens; add `Toast`, `DateTimeField`, `Select`, `Segmented`, `SearchField`, `NextUpCard`, `AttentionRow`, `Notice`, `Avatar`; footer error placement in `FormSheet` / `DetailSheet`. Could be split into `components/kit/*` if it grows past ~1,000 lines. | 8.3, 8.4 |
| `constants/icons.ts` (new) | Semantic icon map. | 9.3 |
| `navigation/role-tabs.tsx` | Tab labels / icons; Tuition People + Tests tabs. | 9.1 |
| `components/app-tabs.tsx` | `tab` roles; swipe rule. | 8.5, N-3 |
| `components/app-header.tsx` | Remove hard-coded colours. | 1.3 |
| `components/account-section.tsx` | Appearance setting, reminders switch; `Avatar` moves to kit. | S-9, S-10 |
| `app/_layout.tsx` | Toast provider; shared overview provider. | 8.3, N-1 |
| `context/tab-context.tsx` | Papers mode segment; open-item-from-notification. | T-8, N-4 |
| `screens/student/student-home.tsx` | Home restructure; in-progress fix. | S-1, S-5 |
| `screens/student/student-tests.tsx` | Sorting, urgency, tones. | S-2 |
| `screens/student/test-runner.tsx` | Warnings, save status, back handling, palette legend, mark for review, review filters. | S-6, S-3 |
| `screens/student/student-pyq.tsx` | Practise from topic, session summary, later filters. | S-7, S-8, S-12 |
| `screens/student/student-roadmap.tsx` | Sort, grouping, Practise action; receives "covered lately". | S-4, S-7 |
| `screens/student/student-profile.tsx` | (via `AccountSection`) appearance. | S-9 |
| `screens/teacher/teacher-home.tsx` | Today / Needs attention / Weak topics. | T-5 |
| `screens/teacher/teacher-tests.tsx` | One-flow creation, edit / extend, results segments, list sub-lines; extract `TestDetail` for reuse by Tuition. | T-1, T-3, T-4, T-6 |
| `screens/teacher/teacher-batches.tsx` | Inline syllabus segment. | T-9 |
| `screens/teacher/teacher-profile.tsx` | Remove duplicate stats. | T-2 |
| `screens/shared/timetable.tsx` | Date-time fields; "Mark covered" on class rows. | T-7, T-9 |
| `screens/shared/syllabus-progress.tsx` | Open pre-filtered by batch and subject. | T-9 |
| `screens/shared/batch-analysis.tsx` | Avatars; fewer nested sheets. | N-2 |
| `screens/shared/announcements.tsx` | Success toast; larger delete target. | 8.4, 8.5 |
| `app/questions.tsx` | Papers segmented header. | T-8 |
| `components/create-exam-modal.tsx` | Prefill from batch; step indicator; later kit re-skin and split. | T-6, T-10 |
| `components/dropdown-select.tsx` | Wrapped by kit `Select`. | A-2 |
| `screens/tuition/tuition-home.tsx` | Needs attention, invite card, compact batches. | A-5, A-4 |
| `screens/tuition/tuition-batches.tsx` | Single Edit; `Select` for teachers; date-time fields via schedule editor. | A-1, A-2 |
| `screens/tuition/schedule-editor.tsx` | Time pickers. | T-7 |
| `screens/tuition/tuition-students.tsx` | People segment, `Select` filter, multi-select move, generate + share login, detail segments. | A-3, A-7, A-8, A-10 |
| `screens/tuition/tuition-teachers.tsx` | People segment, generate + share login, assign to batch. | A-3, A-7, A-9 |
| `screens/tuition/tuition-tests.tsx` (new) | Read-only tests tab reusing `TestDetail`. | A-6 |
| `screens/tuition/tuition-notifications.tsx`, `join-requests.tsx` | Rename sheet; invite card reuse. | A-4 |
| `services/*-api.ts` | Only for Phase 3 endpoints. | Phase 3 |

### Super Admin web (`papers/src/app/admin`)

| File | Changes | IDs |
|---|---|---|
| `ui.tsx` | `Toast`; `ConfirmDialog` helper; sortable `Table` header. | SA-1, SA-6 |
| `(console)/layout.tsx` | Icon menu button on phones; Activity nav item later. | SA-3, SA-8 |
| `(console)/page.tsx` | Needs-attention panel. | SA-5 |
| `(console)/tuitions/page.tsx` | Status filter, last-active column, sorting. | SA-4, SA-6 |
| `(console)/tuitions/[id]/page.tsx` | Summary strip, people search, confirmations, tests columns. | SA-1, SA-2, SA-9 |
| `(console)/support/page.tsx` | Confirmation, pagination. | SA-1, SA-7 |
| `tailwind.config.ts` | Accent / neutral alignment if decision 13.2 is approved. | 8.1 |

### Backend (Phase 3 only, `papers/src`)

`app/api/tests/[id]` (batch stats for students; duplicate; remind), `app/api/pyq` (exam / year / mistakes filters), `app/api/tuition/students` (bulk import, pagination), `app/api/tuition/overview` (missing teachers, batch comparison), `app/api/admin/overview` and `admin/tuitions` (needs attention, last active, sorting), `app/api/admin/users` (pagination), new bookmark and admin-activity models.

---

## 13. Decisions needed before implementation

1. **Design direction.** Approve "Calm study desk" (8.1): keep the warm palette and terracotta accent, add tokens and the listed kit components, no new packages.
2. **Super Admin brand.** Align the console's pink accent and cool greys with the mobile terracotta and warm neutrals — or keep the console visually separate as an internal tool. _Recommendation: align (one-file change in `tailwind.config.ts`, low risk)._
3. **Tab changes.** Approve the label changes (Student **Practice**, Teacher **Papers**) and the Tuition restructure (**People** + **Tests**). _Recommendation: approve all three; none adds a sixth tab._
4. **Swipe between tabs.** Keep swipe for all roles, or turn it off for the Tuition role where forms dominate. _Recommendation: keep for Student and Teacher, decide for Tuition after testing._
5. **Home pattern.** Approve the "Next up / Needs attention" structure for all three app roles (11.1, 11.3, 11.4).
6. **Mark for review.** Keep marks on the phone only (no backend) or save them with the attempt. _Recommendation: phone only for Phase 2._
7. **Phase 3 scope.** Which backend features to schedule first. _Recommendation: T-12 duplicate test, T-11 remind, A-11 import, S-11 batch stats._
