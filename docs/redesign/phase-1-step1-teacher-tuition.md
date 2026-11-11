# Step 1 · Teacher and tuition structure (re-plan for current main)

_12 Nov 2026 · branch `redesign/phase-1` (with main's multi-subject work) · **approved 12 Nov**._

**Decision on "Invited":** it becomes a Status filter in the Filters sheet, and People shows one row at the top, "3 invited, not joined yet", only while invitations are pending. This is the same pattern as "3 waiting to join". Tapping the row applies the filter.
Built on the approved Part 1A plan (`phase-1-structure.md`). The teacher slices already built in 1B are summarised and refined below. **My teammate owns Create Test, Make PDF and the test runner:** nothing inside them is restructured. Only the way teachers reach them, and their loading, error and empty states, change.

Behaviour principles named on every change: Hick, progressive disclosure, recognition over recall, serial position, Fitts/thumb reach, good defaults, Zeigarnik, peak-end, mental models (Jakob), chunking, calm under stress.

---

## 0. Multi-subject tests and papers: subject chips, not joined names

Today a multi-subject test's `subject` arrives as one text, "Physics, Chemistry", and a saved paper's `subject` the same. The plan:
- **`subjectsOf(text)`** (pure, tested) splits on `,` `+` `&` `/` into a clean list.
- **`SubjectChips`** (kit-level, classic look) shows up to 3 chips plus "+n".
- The icon is the subject's when there's one subject, else a "mixed" icon.

**Recognition over recall:** each subject is readable at a glance, and a long joined string never gets cut off ("Physics, Chemistr…").

| Where | Today | Planned |
|---|---|---|
| Teacher Home · Needs attention rows | "Live: Mock 3" + "18/32 submitted" | title + **[Physics] [Chemistry]** chips + status line |
| Teacher batch page · Tests | "Live · 18/32 submitted" | chips under the title |
| Teacher Tests tab · test cards (teammate's file, display only) | "Physics, Chemistry" | chips |
| Tuition Home · Needs attention test rows | – (new) | chips |
| Tuition Tests tab | joined name | chips |
| Papers tab · saved papers | "Physics, Chemistry · 12th" | chips + class |
| Student Home · Next up, Tests list (Step 4 restyle) | joined name, generic icon | chips, "mixed" icon |

---

## 1. Teacher

### 1.1 Jobs and frequency (unchanged from 1A)

| Daily | Weekly | Rarely |
|---|---|---|
| What's on today · mark what I taught · live test progress · **let a paused student continue** | set a test · see who struggled · make a paper · share a paper · announce | timetable edits · profile · password |

### 1.2 Before → after map

```
BEFORE (main)                                   AFTER (1B built ✓ · Step 2 refines ★)
Home     stats · today · week editor · ann.      Home   ✓ Today (Mark covered) · ✓ Needs attention · ✓ Ann.(2)
                                                         · ✓ row Weekly timetable → /timetable
                                                         ★ subject chips on attention rows
Batches  cards → [sheet] batch → [sheet]          Batches ✓ rows → /teach/[batchId] [Syllabus|Students|Tests]
                                                         ★ chips in its Tests view; ★ remembers last view
Tests    Create Test · filters · cards            Tests   ✓ skeleton/stale; ★ chips on cards (display only)
Questions {create}{bank}{pdfs}                    Papers  ✓ saved papers first · Make a paper · Question bank
                                                         ★ chips on saved papers; ★ empty/error/offline states
Profile  stats · subjects · batches · PDFs        Profile ✓ Teaching card · batches open their page
                                                         ★ slot: Help & guides (Step 5)
```

**About drafts:** a Create Test draft lives only in memory. Remembering it would mean changing Create Test (your teammate's), so **Needs attention has no "Continue draft" row**. I'd suggest it to your teammate as a follow-up.

### 1.3 Wireframes (★ = Step 2 change)

```
TEACHER HOME                                   PAPERS (front page)
┌──────────────────────────────────┐           ┌──────────────────────────────────┐
│ Hello, Mrs Patil · Thu 12 Nov    │           │ Papers                           │
│ TODAY                            │           │ [ + Make a paper ]   (primary)   │
│ 3:00 NEET 12A Physics [Mark cov.]│           │ Question bank                  › │
│ 5:00 JEE 11B Physics  [Plan]     │           │ 🔎 Search   Newest ▾  All subj.  │
│ NEEDS ATTENTION                  │           │ Mock 3 · 30 Qs · yesterday     ⋯ │
│ ⏸ Students waiting · Mock 3    › │           │  ★[Physics][Chemistry] · 12th    │
│  ★[Physics][Chemistry]           │           │ Kinematics practice · 25 Qs    ⋯ │
│ ● Live: Unit 4 · 18/32 submitted›│           │  ★[Physics] · 11th               │
│  ★[Biology]                      │           └──────────────────────────────────┘
│ ✓ Results ready: Mock 2 · avg 54›│
│ ANNOUNCEMENTS (2)   Post · See all│
│ Weekly timetable · 9 a week    › │
└──────────────────────────────────┘
```

---

## 2. Tuition (admin)

### 2.1 Jobs and frequency

| Daily | Weekly | Rarely |
|---|---|---|
| **let in people who asked to join** · what's missing (no batch / teacher / timetable) · **paused students in any test** | add a student · reset a password · move a student · check results · announce | institute profile, logo, weightage, batch setup |

### 2.2 Problems today (current main)

| # | Problem | Principle |
|---|---|---|
| A-1 | **Join requests live in two places:** students at the top of People › Students, teachers in the bell's sheet. The bell counts only teachers. | Mental models (one inbox), recognition |
| A-2 | **Home's Needs attention has no tests:** paused students waiting for a decision, live tests and fresh results are invisible. | Visibility of status, fairness (calm under stress), serial position |
| A-3 | **People › Students stacks Invite and Add buttons, the pending requests, a 3-way category switch, search and 3 filter rows** before the first student. | Hick, filter wall, progressive disclosure |
| A-4 | **Add student is one long form:** 8+ fields over Student, Studies and Initial password. | Chunking (≤ 5 per step), good defaults |
| A-5 | **The batch hub repeats the whole schedule;** settings sit in the body. | Simplicity, progressive disclosure (low priority) |

### 2.3 Before → after map

```
BEFORE (main)                                         AFTER (Step 2)
Home     Needs attention (join · no batch · no         Home   ★ Needs attention: requests (students+teachers, one row)
         teacher · no timetable) · totals strip ·             · paused students · live tests · results ready (chips)
         3 quick actions · today · ann. · batches             · no batch · no teacher · no timetable
         bell → [sheet] teacher requests only                 · totals strip · quick actions · today · ann.(2) · batches
                                                              ★ bell counts students + teachers → /requests
People   [Students|Teachers]                           People [Students|Teachers]
         Students: Invite · Add · PENDING REQUESTS ·          Students: 🔎 search · ★ Filters (n) · ★ "3 waiting to
         [Active|Pending|Unassigned] · search ·               join ›" row → /requests · list · ★ [Add student] (bottom,
         Program/Class/Batch filter rows · list               options: Add one by one · Invite with joining code)
         Teachers: PENDING TEACHERS · Add · list              Teachers: ★ "1 waiting ›" row → /requests · list · [Add]
  ★ /requests (new)                                    Requests [Students (2) | Teachers (1)] · accept / reject ·
                                                              joining codes (Invite) at the top
  /student/new  one long form                          ★ Add student: 1 Student → 2 Studies & login ("Step n of 2")
Tests    filters · list                                Tests  ★ chips · skeleton/stale/empty states
Batches  hub repeats schedule                          Batches ★ hub: schedule summary line; settings in ⋯ (small)
Profile  institute · logo · weightage · appearance     Profile unchanged · ★ slot: Help & guides (Step 5)
```

What stays: tabs, their order and icons, the batch routes, student and teacher detail pages, the forms' fields and validation, every API call.

### 2.4 Wireframes

```
TUITION HOME                                   REQUESTS  (/requests)
┌──────────────────────────────────┐           ┌──────────────────────────────────┐
│ Shree Classes                🔔3 │           │ ‹ Home   Join requests           │
│ NEEDS ATTENTION                  │           │ [ Students (2) | Teachers (1) ]  │
│ 3 want to join (2 st, 1 tch)   › │→/requests │ Invite students with a code    › │
│ ⏸ Students waiting · Mock 3    › │→ test     │ Riya S · NEET 12th A · 2 h ago   │
│  [Physics][Chemistry]            │           │      [ Accept ]   Reject         │
│ ● Live: Unit 4 · 18/32         › │           │ Aman K · JEE 11th B · 1 d ago    │
│ 5 students have no batch       › │           │      [ Accept ]   Reject         │
│ NEET 11A has no Chem teacher   › │           └──────────────────────────────────┘
│ 412 students · 18 tch · 14 batch │
│ [Invite] [Add student] [Batch]   │           PEOPLE › STUDENTS
│ TODAY'S CLASSES (4)              │           ┌──────────────────────────────────┐
│ ANNOUNCEMENTS (2)                │           │ [ Students | Teachers ]          │
│ SYLLABUS PROGRESS                │           │ 🔎 Search students   Filters (2)▾│
└──────────────────────────────────┘           │ [NEET ✕] [No batch ✕]            │
                                               │ 3 waiting to join              › │
FILTERS (sheet)                                │ Aarav Patil · NEET 12th A      › │
┌──────────────────────────────────┐           │ …                                │
│ Filters            Clear · Done  │           │        [ Add student ]  ▸ Add one│
│ Status   (Active)(Invited)       │           │                         ▸ Invite │
│ Program  (JEE)(NEET)(CET)…       │           └──────────────────────────────────┘
│ Class    (11th)(12th)            │
│ Batch    [Any ▾]  incl. No batch │           ADD STUDENT · Step 1 of 2: Student
└──────────────────────────────────┘           ┌──────────────────────────────────┐
                                               │ Name · Email · Phone · Parent's  │
                                               │              [ Next: studies ]   │
                                               └──────────────────────────────────┘
                                               Step 2 of 2: Studies & login
                                               Program · Class · Batch (pre-filled)
                                               · Initial password   [ Add student ]
```

---

## 3. Places that MOVED, per role (each gets a short "this moved here" guide in Step 5)

| Role | What | From → To | Guide id |
|---|---|---|---|
| Student | Syllabus gauge + "covered lately" | Home → Syllabus tab (Home keeps one line) | `moved-syllabus-gauge` |
| Student | Topic practice | under self-assessments → top of Practice; drill-down is now screens with Back | `moved-topic-practice` |
| Student | Continue | new: Practice (and Home when no test is due) | `moved-continue` |
| Student | New self-assessment | one long form → Quick start (+ Customise in 3 steps) | `moved-quick-start` |
| Student | Self-assessment result next step | bottom → right under the score; Topics / Answers | `moved-result-next-step` |
| Teacher | Mark topics covered | Batch sheet → Home "Mark covered" + batch page Syllabus | `moved-mark-covered` |
| Teacher | Batch details | sheet → its own page (Syllabus · Students · Tests) | `moved-batch-page` |
| Teacher | Weekly timetable editor | Home body → Home row → Timetable screen | `moved-timetable` |
| Teacher | Questions tab | renamed **Papers**; saved papers first; bank one tap | `moved-papers` |
| Teacher | Saved PDFs | Profile link → Papers front page | (in `moved-papers`) |
| Teacher | Stat tiles | Home and Profile → Profile "Teaching" card | `moved-teaching-card` |
| Tuition | Join requests | People top + bell sheet → **Requests** inbox (bell, Home, People rows) | `moved-requests` |
| Tuition | Student categories + 3 filter rows | People top → **Filters (n)** sheet | `moved-people-filters` |
| Tuition | Invite Students button | People top → Add student options (Home quick action stays) | (in `moved-people-filters`) |
| Tuition | Add student | one long form → 2 steps | `moved-add-student` |
| Tuition/Teacher | Paused students | test page only → Home Needs attention first | `needs-attention` |

---

## 4. Step 2 slices (one commit each, current look, all states, no API changes)

1. **Subject chips:** `src/shared/subjects.ts` (`subjectsOf`, tested) + `SubjectChips` in `src/components/subject-chips.tsx`. Used on teacher Home, the batch page and Papers.
2. **Teacher refinements:** chips on Needs attention and the batch page's Tests; the batch page remembers its last view; Papers states (empty, error, offline); chips on the Tests tab cards (display only).
3. **Tuition Home:** one join-requests row; test rows (shared `attentionRows`); the bell counts both kinds and opens `/requests`.
4. **Requests inbox:** `/requests` with Students | Teachers, reusing the existing accept and reject components unchanged; People shows a "n waiting to join" row instead of the stacked blocks; the bell's sheet is replaced.
5. **People filters:** search + Filters (n) sheet (Status, Program, Class, Batch incl. No batch) + removable chips, keeping the same server queries; Add student moves to the bottom with options.
6. **Add student in 2 steps:** same fields, validation and API call, split into Student → Studies & login, with the batch pre-filled from context.
7. **Tuition Tests and batch hub tidy:** chips and states; schedule summary only, settings in ⋯.
8. **Legacy removal** (own commit): `app/explore.tsx`, `app/profile.tsx` and the unused side-drawer Home, only after confirming no route, deep link or notification opens them. `create-exam-modal.tsx` stays, because the Tests edit flow (your teammate's) still uses it.

**Guide targets** (registered in Step 5; noted now so Step 2 adds a stable `nativeID` to each control): `teacher.home.needs-attention`, `teacher.home.mark-covered`, `teacher.papers.make`, `teacher.papers.bank`, `teacher.batch.views`, `tuition.home.needs-attention`, `tuition.requests.tabs`, `tuition.people.search`, `tuition.people.filters`, `tuition.people.add`, `tuition.add-student.steps`, plus a Help & guides row in each Profile.

---

## 5. Files Step 2 will touch

**Teacher:** `src/screens/teacher/attention.ts`, `teacher-home.tsx`, `teach-batch-screen.tsx`, `teacher-tests.tsx` (display only: a chips line on test cards), `src/components/my-pdfs-screen.tsx`, `src/app/questions.tsx` (states only).
**Tuition:** `tuition-home.tsx`, `admin-filters.ts`, `tuition-notifications.tsx`, `join-requests.tsx`, `pending-enrollments.tsx`, `invite-students.tsx` (reuse), `tuition-people.tsx`, `tuition-students.tsx`, `tuition-teachers.tsx`, `student-form-screen.tsx`, `people-nav.ts`, `tuition-tests.tsx`, `batch-screens.tsx`, `src/screens/shared/notification-bell.tsx`, new `src/app/requests.tsx` + `src/screens/tuition/requests-screen.tsx`.
**Shared:** new `src/shared/subjects.ts`, `src/components/subject-chips.tsx`, tests.
**Legacy slice:** `src/app/explore.tsx`, `src/app/profile.tsx`, `src/app/index.tsx` (only the unused legacy Home), `src/components/side-drawer.tsx`, after checking `src/services/notifications.ts`.
**New files to open** (not on the 1A list): `tuition-notifications.tsx`, `student-form-screen.tsx`, `invite-students.tsx`, `people-nav.ts`, `admin-filters.ts`, `src/services/pdf-library.ts` (read only), `src/services/tuition-api.ts` (read only, types).

---

## 6. For my teammate: files the redesign touches

**Inside your areas (small, display or entry-point changes only):**
- `src/screens/teacher/create-test/draft.tsx`: 2 lines. Create Test can start with a batch picked (`?batchId=`), and Back doesn't ask to discard an untouched draft. *(done in 1B)*
- `src/app/create-test/_layout.tsx`: reads `?batchId=`. *(done)*
- `src/screens/teacher/teacher-tests.tsx`: Tests tab only. Skeleton and stale note *(done)*; next, subject chips on test cards. TestWizard and the edit flow stay untouched.
- `src/app/questions.tsx`: Papers tab entry. Opens on saved papers, with "‹ Papers" links; Make PDF's flow is untouched. *(done)*
- `src/components/my-pdfs-screen.tsx`: the Papers front page *(done)*; next, chips and states.
- `src/context/tab-context.tsx`: the Papers tab opens on saved papers *(done)*. `src/navigation/role-tabs.tsx`: label "Papers" *(done)*.
- Later (Step 4, student look only, display only): `src/screens/student/test-runner.tsx` (colours, fonts and spacing, including the subject tabs; no timer, saving, visibility, capture or subject logic), `question-view.tsx`, `native-math.tsx`. Step 3: `src/components/kit.tsx` (a student-only look switch).

**Not touched:** `make-pdf/*`, `question-selection/*`, `create-test/details-screen.tsx`, `setup-screen.tsx`, `question-picker.tsx`, `scope.ts`, `exam-sections.ts`, every exam and answer file, `school-api.ts`, `question-pdf.ts`.
