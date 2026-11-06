# App structure audit and proposal (UX-S)

_Date: 2026-11-05 · Scope: `pcmb-paper/` mobile app, all three roles (Student, Teacher, Tuition Admin) · Audit of the working copy, including uncommitted changes · **Proposal only: nothing has been changed.**_

This follows `UX_IMPROVEMENT_PLAN.md` (UX-0). Much of that plan has shipped: Student Home, Tests and the test runner, Practice replacing PYQs, the Admin People and Tests tabs, and the Admin batch screens as real stack routes. This audit covers **structure only**: what sits on which screen, in which container, and in what order. Visual style is unchanged.

---

## 1. Summary: the five biggest structural problems

| # | Problem | Who | How often | Severity |
|---|---|---|---|---|
| 1 | **Details open as sheets stacked on sheets.** A test, a student, a teacher's batch: each opens as a sheet, and the next detail opens as a second sheet on top (student insight, mark topics, reset password, move batch). The Admin batch screens already use real pushed routes; nothing else does. | All | Daily | High |
| 2 | **Teacher Home is a dashboard of totals, not "what's next".** 3 stat tiles (repeated on Profile), today's classes with no action, the whole weekly timetable with editing, then announcements. No tests at all. | Teacher | Daily | High |
| 3 | **A new test is lost without warning.** Tapping ✕ at any step of *New test* closes it with no question and no draft (`teacher-tests.tsx:320–343`: `changed()` returns `false` for new tests). Step 2 "Questions" is also two different screens under one step label. | Teacher | Weekly | High |
| 4 | **Teacher's "Questions" tab hides three tools in invisible modes.** It opens on a 12-field PDF form; the question bank and My PDFs are reached by back links or from Profile (`teacher-profile.tsx:61` jumps tabs). The tab label doesn't predict what's inside. | Teacher | Weekly | Medium |
| 5 | **Practice drill-down is hand-built inside one tab.** Subject → chapter → topic replaces the tab's content with custom back rows (no swipe-back, own Android back handler), and topic practice sits below the whole self-assessment block. | Student | Daily | Medium |

Smaller ones: Admin join requests live in three places for teachers and a fourth for students (§4, A-2); the self-assessment builder shows 5 sections on one scroll; the self-assessment result puts "What to do next" near the bottom; the People list has two buttons, a requests block, search and three filter rows before the first student; ~3,000 lines of unreachable legacy screens remain (`app/explore.tsx`, `app/profile.tsx`, the side-drawer Home in `app/index.tsx`, exam-room modals).

---

## 2. Current map

`[tab]` bottom tab · `[sheet]` DetailSheet/FormSheet · `[modal]` full-screen modal · `{mode}` in-screen mode · `→` pushed route

```
Root Stack (_layout: auth gate → role tab pager, swipeable, all 5 tabs mounted at once)

STUDENT
├─ Home [tab]       Next up · Today · Your progress · Announcements          ✓ already well ordered
│                    [sheet] week · [sheet] covered lately · [modal] test runner
├─ Tests [tab]      To do · Upcoming · Past → [modal] runner {intro}{questions}{review}
├─ Syllabus [tab]   subject chips → chapters
├─ Practice [tab]   New self-assessment · To finish · Earlier results · Subjects
│                    {subject}{chapter}{topic}            ← hand-built drill-down, replaces the tab
│                    [modal] self-assessment {home}{build: 5 sections, one scroll}{intro}{runner}{result}
│                    [modal] topic practice
└─ Profile [tab]

TEACHER
├─ Home [tab]       3 stat tiles · Today's classes · whole week timetable (+ edit) · Announcements
├─ Batches [tab]    batch cards → [sheet] batch {info · Mark topics · recent · analysis}
│                                      ├─ [sheet on sheet] Mark topics covered
│                                      └─ [sheet on sheet] student insight
├─ Tests [tab]      New test · batch chips · status chips · cards
│                    [modal] New test: 1 Details → 2 Questions {config}{pick} → 3 Marks & timing (8 inputs) → 4 Review → Done
│                    [sheet] test {10 fact rows → live / results / analysis}
│                         └─ [sheet on sheet] student performance
├─ Questions [tab]  {create: PDF form, ~12 inputs} {browse: question bank} {pdfs: My PDFs}   ← 3 hidden modes
└─ Profile [tab]    3 stat tiles (repeat) · subjects · batches · tuition · "Your PDFs" (jumps to Questions)

TUITION ADMIN
├─ Home [tab]       teacher-requests row · 3 stat tiles · "no batch" link text · every batch in full · Announcements
│                    bell → [sheet] "Notifications" = teacher requests only
├─ Batches [tab]    Create · filters · cards → /batch/new · /batch/[id] (hub)
│                       → students · invitations · teachers → assign-teacher · schedule → new/[entry] · settings   ✓ real routes
├─ People [tab]     [Students | Teachers]
│                    Students: Invite · Add · student requests · search · Program/Class/Batch filter rows · list
│                       [sheet] student → [sheet on sheet] edit · move · reset password · insight
│                    Teachers: Invite · Add · teacher requests · search · filter · list
│                       [sheet] teacher → [sheet on sheet] edit · reset password
├─ Tests [tab]      filters · grouped list → [sheet] test → [sheet on sheet] student
└─ Profile [tab]    institute · chapter weightage [sheet] · appearance · account

UNREACHABLE: app/explore.tsx, app/profile.tsx, legacy Home + SideDrawer in app/index.tsx,
             rooms-context, edit-room / exam-room-details / edit-paper modals, pdf-builder-screen,
             the "room" branch of create-exam-modal.tsx
```

Structure-audit scores (higher = more overloaded): `create-exam-modal.tsx` 13.0 · `assessment-session.tsx` 5.0 · `test-runner.tsx` 4.5 (a test runner, allowed) · `teacher-tests.tsx` 2.8 · `tuition-students.tsx` 2.7 · `student-practice.tsx` 2.6 · `my-pdfs-screen.tsx` 2.2 · `questions.tsx` 2.1.

---

## 3. Users and top tasks (baseline)

Roles come from `navigation/role-tabs.tsx` and `PRODUCT.md`. Taps are counted from opening the app; "stacked" = sheets open on top of each other at the deepest point.

### Teacher
| Job story | Today | Taps | Stacked | Notes |
|---|---|---|---|---|
| T1. *After a class, I want to mark the topics I covered, so students see them.* | Batches → batch → Mark topics covered → subject / chapter / topic → close ×2 | ~8 | 2 | Must remember which batch; Home already knows today's class. |
| T2. *When I want to test a batch, I want to set a test from the bank in a few minutes.* | Tests → New test → 4 steps (step 2 is two screens) | ~14 | modal | ✕ loses everything; 8 timing inputs on one screen. |
| T3. *When a test closes, I want to see who struggled, so I can plan the next lesson.* | Tests → Done → test → scroll past 10 fact rows → results → student | 4 + scroll | 2 | Nothing on Home says results are in. |
| T4. *When I need a printed paper, I want to make a PDF quickly.* | Questions → 12-field form → questions → Make PDF | ~10 | 0 | All options visible at once. |
| T5. *When I want to share a paper I made, I want to find it.* | Questions → (form) → My PDFs link → paper → Share | 4 | 0 | Or Profile → "Your PDFs", which jumps tabs. |

### Student
| Job story | Today | Taps | Stacked | Notes |
|---|---|---|---|---|
| S1. Take my next test | Home → Start test | 2 | modal | ✓ Good. |
| S2. Practise a weak topic | Home → weak topic → Start | 3 | modal | ✓ Good. |
| S3. *Pick up topic practice where I left off* | Practice → scroll past self-assessments → subject → chapter → topic → Continue | 6 | 0 | No resume entry point; custom back rows. |
| S4. Start a self-assessment | Practice → New → 5 sections on one scroll → plan → Start | ~10 | modal | Every choice up front. |
| S5. Act on a self-assessment result | Result → scroll past score, tiles, topic cards, chapter tree, difficulty → "What to do next" | 1 + long scroll | modal | The next step is near the end. |

### Tuition Admin
| Job story | Today | Taps | Stacked | Notes |
|---|---|---|---|---|
| A1. *When people ask to join, I want to accept them quickly.* | Teachers: Home row / bell / People › Teachers. Students: People › Students only | 1–2 | 1 | Bell count ignores students. |
| A2. Add a student | People → Add student → 8 fields in one sheet | 2 + 8 fields | 1 | |
| A3. Reset a student's password | People → search → student → Reset password | 3 + typing | 2 | |
| A4. Give students with no batch a batch | Home link text → student → Change batch → pick → Save | 5 each | 2 | |
| A5. See a test's results | Tests → test → student | 2 | 2 | |

---

## 4. Findings: principle → observation → change

Ordered by frequency × severity.

**Cross-cutting**
- **N-1 · Mental models, Jakob's law** → every detail is a modal sheet, and drilling deeper stacks another sheet (10 places: teacher batch → mark topics / student; teacher test → student; admin student → edit / move / reset / insight; admin teacher → edit / reset; admin test → student. Android back peels one at a time; no swipe-back). The Admin batch screens already prove the fix → **move "object" screens to Expo Router stack routes above the tab pager**, like `/batch/[id]`: `/test/[id]`, `/student/[id]`, `/teacher/[id]`, `/teach/[batchId]`, `/practice/...`, `/papers/...`. Rule: tab → push (≤ 3 levels) → at most **one** sheet for a short task.
- **N-2 · Visibility of state** → cross-tab jumps pass state through ad-hoc globals (`openPracticeAt`, `showStudents`, `setQuestionsMode`) and notifications can only open a tab → with routes, a jump is a link (`/test/abc`, `/practice/Physics/Kinematics`), and notification taps can open the item itself.
- **N-3 · Simplicity** → ~3,000 lines of unreachable legacy UI, and `app/explore.tsx` is still a reachable URL → remove in a cleanup step.

**Teacher**
- **T-A · Next step over overview (PRODUCT.md principle 2), serial position** → Home leads with totals (also on Profile) and a full timetable editor; tests aren't on Home → **Today** (each class with *Mark covered*) → **Needs attention** (live tests "18/32 submitted", tests with new results, scheduled tests, a saved draft) → Announcements (2 + See all). The weekly timetable becomes a row that pushes its own screen.
- **T-B · Recognition, Tesler** → marking topics needs the teacher to re-find the batch and subject Home already shows → *Mark covered* on a today's-class row opens the syllabus sheet set to that batch and subject (`SyllabusProgressView` already takes `batchId` + `subjects`).
- **T-C · Zeigarnik, error forgiveness** → a new test is thrown away on ✕ with no question → autosave a draft (title, batch, subject, picked question ids, timing) on every change; ✕ keeps the draft; Home and Tests show "Continue draft: *Kinematics weekly* · 20 questions".
- **T-D · Chunking, goal-gradient** → step 2 is two screens under one "Step 2 of 4" label; step 3 shows 8 inputs → 5 steps: **Details → Topics → Questions → Timing → Review**. Timing opens as a one-line summary ("Opens now · closes tomorrow 11 AM · 60 min · +4 / −0") with **Change**; the 8 fields sit behind it.
- **T-E · Progressive disclosure** → the test sheet shows 10 fact rows before any result → test screen leads with a one-line summary and the results; segments by status (open: **Live · Questions**; closed: **Results · Analysis · Questions**); facts go behind a "Test details" row; Edit / Cancel / Close in the header ⋯ with the one status-relevant action as the primary button.
- **T-F · Mental model "class → students / tests → results"** → a teacher's batch is a sheet holding info, a button to a nested sheet, recent topics and analysis → pushed batch screen with **Syllabus · Students · Tests** segments; marking happens inline under Syllabus; "Set a test" from the Tests segment pre-fills the batch.
- **T-G · Information scent** → tab "Questions" opens a PDF form; the bank and My PDFs are hidden modes → rename to **Papers**; landing = "Make a paper" (primary) + recent papers (My PDFs) + a "Question bank" row. Profile drops "Your PDFs" and the repeated stat tiles.
- **T-H · Hick, chunking** → the PDF form shows ~12 inputs → 3 steps: **What** (class, subject, chapters, topics, levels) → **Questions** → **Paper** (name pre-filled, "In the PDF"; set, date and duration under "More options").

**Student**
- **S-A · Jakob's law, Zeigarnik** → Practice drill-down is in-tab state with custom back rows; there's no resume point → routes `/practice/[subject]` → `/practice/[subject]/[chapter]` (topic node as the chapter's child) with native back; a **Continue** card at the top for the last topic practised or an unfinished self-assessment.
- **S-B · Serial position** → topic practice (likely the daily habit) sits below the whole self-assessment block → order: Continue → Practise by topic → Self-assessments (To finish + 3 results + See all). _Needs your call: see §8._
- **S-C · Choice overload, default effect** → the builder asks 5 things on one scroll → **Quick start** with the existing defaults (`DEFAULT_COUNT`, `suggestedMinutes`, covered topics) and **Customise** as 3 short steps (Topics → Size & difficulty → Time & marking) → plan → Start.
- **S-D · Peak–end** → "What to do next" sits after 4 sections → put it right under the score; the rest becomes **Topics · Answers** segments; difficulty breakdown folds into Topics.

**Tuition Admin**
- **A-A · Next step over overview** → Home is totals + every batch in full; problems hide as muted link text → **Needs attention** (join requests · students with no batch · batches missing a teacher · batches without timings) → 3 totals → batches one line each → Announcements (2 + See all).
- **A-B · Mental models** → teacher join requests appear in 3 places, student requests in a 4th, and the bell counts only teachers → one **Join requests** screen with **Students · Teachers**; the bell, the Home row and the People lists all open it; the bell counts both.
- **A-C · Hick, list patterns** → People › Students shows Invite, Add, requests, search and 3 filter rows before the list → search + "Filters (n)" opening a sheet (remembered); requests as one row with a count; **Add student** primary at the bottom, with "Share joining code" as an option inside it.
- **A-D · No modal on a modal** → student and teacher sheets open edit / move / reset / insight on top → pushed `/student/[id]` (**Details · Performance**) and `/teacher/[id]`; edit, move and reset are one sheet each from there.
- **A-E · Chunking** → Add student shows 8 fields in one sheet → 2 short steps: **Student** (name, email, phone, parent's phone) → **Studies & login** (program, class, batch pre-filled from context, starting password).
- **A-F · Simplicity** → the batch hub repeats the full weekly schedule under its own "Schedule" row → keep the summary line only; move Batch settings to the header ⋯.

---

## 5. Proposed map

`★` new or changed · everything else stays as it is.

```
Root Stack
├─ auth gate (unchanged)
├─ index → role tab pager (kept: swipeable, 5 tabs per role)
│
│  Routes above the tabs (push; tab bar hidden, native back + swipe-back):
├─ ★ /test/new            modal stack, draft autosaved: Details → Topics → Questions → Timing → Review → Outcome
├─ ★ /test/[id]           summary · open: [Live | Questions] · closed: [Results | Analysis | Questions] · ⋯ Edit / Cancel
├─ ★ /student/[id]        teacher: performance · admin: [Details | Performance] + one sheet each for edit / move / reset
├─ ★ /teacher/[id]        admin: details + one sheet each for edit / reset
├─ ★ /teach/[batchId]     teacher's batch: [Syllabus | Students | Tests]
├─ ★ /timetable           teacher's week; add / edit a class as one sheet
├─ ★ /papers/new          What → Questions → Paper → Outcome (open / share)
├─ ★ /papers/bank         question bank + filters sheet + "PDF of these"
├─ ★ /practice/[subject]  → /practice/[subject]/[chapter] (topics + practise node)
├─ ★ /self-check/new      Quick start | Customise: Topics → Size & difficulty → Time & marking → Plan
├─ ★ /requests            admin: [Students | Teachers]
└─   /batch/...           admin batch routes (unchanged)

TEACHER tabs
├─ Home      ★ Today (Mark covered per class) → Needs attention → Announcements (2 + See all) · row: Weekly timetable
├─ Batches   ★ one row per batch → /teach/[batchId]
├─ Tests     ★ Continue draft · [Live | Upcoming | Done] · batch filter · "Set a test" → /test/new
├─ ★ Papers  "Make a paper" · recent papers · row: Question bank
└─ Profile   ★ subjects · batches · tuition · appearance · account (no stat tiles, no PDF link)

STUDENT tabs (Home, Tests, Syllabus, Profile unchanged)
└─ Practice  ★ Continue card → Practise by topic → Self-assessments (To finish + 3 results + See all · New)
             ★ result: score + What to do next → [Topics | Answers]

ADMIN tabs (Batches, Tests, Profile unchanged except routes)
├─ Home      ★ Needs attention → 3 totals → batches one line each → Announcements (2 + See all)
└─ People    ★ [Students | Teachers] · search · Filters (n) sheet · requests row · list · Add (bottom)
```

Tab names stay the same except Teacher **Questions → Papers**. No role gets a sixth tab.

---

## 6. Screen specs

### Teacher · Home ★
- **Job:** "When I open the app, I want to see today's classes and anything waiting on me, so I know what to do next."
- **Primary action:** *Mark covered* on the current or just-finished class.
- **Content (in order):** greeting + date → **Today** (each class: time, batch, subject, *Mark covered*) → **Needs attention** (≤ 3 rows + See all: draft to continue, live test "18/32 submitted · closes 6 PM", results ready "avg 54 %", scheduled "opens Mon 9:30") → **Announcements** (latest 2, Post, See all) → row **Weekly timetable · 9 classes a week**.
- **States:** loading skeleton · no classes today ("No classes today" + timetable row) · nothing needs attention (row hidden) · not in a batch yet (one notice) · error with retry.
- **Exit:** each row pushes its screen. **Principles:** next step over overview, serial position, recognition.

### Teacher · Mark covered (sheet from Home or batch Syllabus) ★
- Opens on that batch and subject (`SyllabusProgressView`, editable). Done closes and shows "3 topics marked" as a toast. One sheet, nothing on top.

### Teacher · Batch `/teach/[batchId]` ★
- **Header:** batch name · track · students · subjects I teach.
- **Syllabus** (default): coverage per subject, chapters with tick-to-mark (inline), recently covered.
- **Students:** batch analysis, weakest topics, student list → `/student/[id]`.
- **Tests:** this batch's tests → `/test/[id]`; primary *Set a test* (batch pre-filled).
- **States:** each segment has its own loading, empty and error. Remembers the last segment.

### Teacher · New test `/test/new` ★ (5 steps, draft autosaved)
| Step | Fields (≤ 5) | Primary | Notes |
|---|---|---|---|
| 1 Details | Name · Batch · Subject (Class only if the batch has none) | Next | Batch and subject pre-filled when started from a batch. |
| 2 Topics | Chapters · Topics · Levels · Number of questions | Next | Today's step 2 "config". |
| 3 Questions | Pick list with "Auto-pick N" and "Selected (n)" | Next · n questions | Today's step 2 "pick". |
| 4 Timing | One summary row + **Change** (marks right / wrong, minutes, opens now / later + date and time, closes) | Review | Defaults: +4 / −0, 60 min, opens now, closes at the suggested time. |
| 5 Review | Summary with an *Edit* link per step + question preview | Publish now / Schedule | |
- **Outcome:** "Test published" + *View test* / *Done*. **Exit:** ✕ keeps the draft (no question); a toast says "Draft saved". *Discard draft* lives on the draft row.
- **Principles:** chunking, goal-gradient ("Step 3 of 5"), Zeigarnik, default effect.

### Teacher · Test `/test/[id]` ★
- **Header:** title · batch · status line ("Live · 18/32 submitted · closes 6 PM").
- **Segments by status:** scheduled → summary + *Edit* (primary); open → **Live | Questions**, primary *Close now*; closed → **Results | Analysis | Questions**.
- **Results:** submitted (sorted by score) · in progress · not taken; tap → `/student/[id]?test=…`.
- **Test details:** one disclosure row holding today's 10 fact rows. ⋯ menu: Edit, Cancel test (confirm: it can't be undone).

### Teacher · Papers tab ★ and `/papers/new` ★
- **Tab:** primary *Make a paper* (bottom) · **Recent papers** (My PDFs, newest first; tap = open, ⋯ = share / print / delete) · row **Question bank** → `/papers/bank`.
- **Make a paper:** 1 **What** (class, subject, chapters, topics, levels) → 2 **Questions** → 3 **Paper** (name pre-filled, "In the PDF"; More options: paper set, date, duration) → outcome *Open* / *Share*. The Smart PDF layout stays a step after Questions when chosen.

### Student · Practice tab ★
- **Order:** **Continue** card (last topic practised "Kinematics · 12 of 40 done", or an unfinished self-assessment with time left) → **Practise by topic** (subjects) → **Self-assessments** (To finish, 3 latest results, See all, *New self-assessment*).
- Subject → chapter → topic are pushed routes with native back; the practice session stays a full-screen modal (focus mode).

### Student · New self-assessment ★
- **Quick start** (primary): covered topics in the chosen subject, `DEFAULT_COUNT` questions, `suggestedMinutes` → Plan → Start.
- **Customise:** 1 Topics → 2 Size & difficulty → 3 Time & marking → Plan. "Step n of 3" in the header.

### Student · Self-assessment result ★
- Score card + headline → **What to do next** (Retake weak topics · Practise *topic*) → **Topics | Answers** segments (Topics holds strength, chapter tree and difficulty; Answers keeps the All · Wrong · Skipped filter) → *Done*.

### Admin · Home ★
- **Needs attention** (each row opens the fix): "3 want to join" → `/requests` · "5 students have no batch" → People filtered · "NEET 11th A has no Chemistry teacher" → batch Teachers · "2 batches have no timings" → batch Schedule.
- Then 3 totals (one row) → batches, one line each with coverage → Announcements (2 + See all). When nothing needs attention: "All set" in one line.

### Admin · Join requests `/requests` ★
- **Students | Teachers** with counts; each row: name, what they asked for, *Accept* (opens the existing accept sheet) / *Reject*. Join code card at the top with Share and Renew.

### Admin · People ★
- Segment **Students | Teachers** (unchanged) → search → *Filters (n)* (sheet with Program, Class, Batch; remembered; active filters shown as removable chips) → "2 waiting to join" row → list → primary *Add student* at the bottom (options: *Add one by one* · *Share joining code*).

### Admin · Student `/student/[id]` ★
- **Details | Performance**. Details: batch (Move · Take out), contact, login (Reset password · Turn login off · Remove). Each action opens **one** sheet or a confirm; nothing stacks.
- **Add / edit student** sheet in 2 steps: Student → Studies & login.

---

## 7. Before / after

| Task | Before (taps · stacked) | After (taps · stacked) | What changes |
|---|---|---|---|
| T1 Mark topics after class | ~8 · 2 | ~4 · 1 | Starts from today's class on Home, batch and subject known. |
| T2 Set a test | ~14 · modal, lost on ✕ | ~12 (≈10 from a batch) · modal, draft kept | 5 clear steps, timing as defaults + Change. |
| T3 See how a test went | 4 + scroll · 2 | 1–2 · 0 | Home row → results first; student is a push. |
| T4 Make a PDF paper | ~10, 12 fields on one screen | ~10, ≤ 5 fields per screen | Same taps, far fewer decisions at once. |
| T5 Share a saved paper | 4 | 2–3 | Recent papers are the Papers tab. |
| S3 Resume topic practice | 6 | 2 | Continue card. |
| S4 Start a self-assessment | ~10 | 3 (Quick start) | Defaults first, Customise optional. |
| S5 Act on a result | 1 + long scroll | 1 | Next step under the score. |
| A1 Accept join requests | 1–2, split across 4 places | 1, one place | One inbox; the bell counts students too. |
| A3 Reset a password | 3 + typing · 2 | 3 + typing · 1 | Student is a pushed screen. |
| A4 Give a student a batch | 5 · 2 | 5 · 1 | No stacking (bulk move is a separate feature idea). |
| A5 See a test's results | 2 · 2 | 2 · 0 | Shared `/test/[id]` and `/student/[id]`. |

---

## 8. Decisions needed before building

1. **Direction:** move test, student, teacher, teacher-batch, practice and papers detail screens to stack routes (as Admin batches already are), with at most one sheet on top. _Recommended._
2. **Teacher tab rename:** "Questions" → **Papers**, opening on recent papers + *Make a paper*. _Recommended._
3. **Practice order:** topic practice first (daily habit) or self-assessments first (today's order, which looks deliberate)? _Recommendation: Continue card → topic practice → self-assessments, but you know your students better._
4. **Where to start:** _Recommended order:_
   1. Teacher Home + Mark covered + `/test/[id]` + `/student/[id]` (daily, removes most stacking).
   2. New test draft + 5 steps (stops the silent data loss).
   3. Admin Home + one Join requests inbox.
   4. Student Practice routes + Continue card + self-assessment Quick start and result order.
   5. Papers tab + Make-a-paper steps (splits `create-exam-modal.tsx` along the steps).
   6. People filters sheet + Add student in 2 steps.
   7. Remove the unreachable legacy screens.

## 9. Kept out of this proposal (new features, propose separately)

Bulk "Move to batch", "Remind students who haven't taken it", "Duplicate test to another batch", a test-level "Share results" PDF. These are in `UX_IMPROVEMENT_PLAN.md` (A-10, T-11, T-12, T-14) and aren't needed for the restructure.

## 10. How each flow will be checked after it's built

Re-walk its tasks against §7 · re-run `structure-audit.mjs` (scores must drop, no new screen over budget) · wayfinding check on every new screen (where am I, where can I go, what's here, how do I get out) · background the app mid-flow and come back · `npx expo lint` and `npx tsc --noEmit`.
