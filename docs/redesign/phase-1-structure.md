# Phase 1A · Structure redesign plan (all three logins)

_10 Nov 2026 · branch `redesign/phase-1` · **approved 10 Nov** (answers in §4). Sources: `docs/app-map.md` (refreshed today), `UX_STRUCTURE_PROPOSAL.md` (5 Nov), the structure audit run today, and student Home as read for Phase 0. No other code was opened._

**How to read this:** each role has (1) jobs and frequency, (2) problems with the behaviour principle each breaks, (3) current → proposed map, (4) homes for future features, (5) wireframes, (6) what stays. §4 lists the decisions I need from you; §5 is the 1B file list for your go-ahead.

**Since the 5 Nov proposal.** On 6 Nov, main added real routes for `test/[testId]`, `student/[studentId]` (index · edit · batch), `teacher/[teacherId]` (index · edit) and a two-page `create-test` flow with a draft. So proposal findings N-1 (sheets stacked on sheets), T-C (new test lost on ✕) and T-D (steps) may be **partly fixed already**. They are marked **[check in 1B]**: I confirm them when I open the approved files and only change what's still wrong.

**Structure audit today (overloaded files, score):** `create-exam-modal.tsx` 13.8 · `assessment-session.tsx` 5.0 · `test-runner.tsx` 4.9 (a test runner, allowed, **not touched**) · `tuition-students.tsx` 4.3 · `teacher-tests.tsx` 3.0 · `student-practice.tsx` 2.6 · `my-pdfs-screen.tsx` 2.2 · `app/questions.tsx` 2.1 · `app/explore.tsx` 1.6 (unreachable) · `topic-practice-sheet.tsx` 1.5.

**Rules applied everywhere:**
- Max 5 tabs.
- Home answers "what should I do now?" with one primary action, at most about 6 blocks visible.
- Daily jobs are one tap from Home; rare jobs live in Profile.
- One job per screen: tab → push (≤ 3 levels) → at most one sheet.
- Details sit behind taps.
- Labels in users' words.
- Unfinished work is offered back.
- Test flows stay linear and calm.

---

## 1. Student

### 1.1 Jobs and frequency (students' own words)

| Job | How often | Where today | Taps today |
|---|---|---|---|
| "What should I do now?" | **daily** | Home → Next up | 1 |
| "Practise PYQs from a topic" | **daily** | Practice → scroll past self-assessments → subject → chapter → topic | 5–6 |
| "Carry on where I stopped" | **daily** | no entry point; re-find the topic | 6 |
| "When's my next class?" | **daily** | Home → Today | 1 |
| "Keep my streak / hit today's goal" (Phase 0 header) | **daily** | Home header | 1 |
| "Take the test my teacher set" | weekly (daily in test weeks) | Home → Next up → Start, or Tests | 2 |
| "See my test result" | weekly | Tests → Past → test | 2–3 |
| "Make a self-test before an exam" | weekly | Practice → New → 5 sections on one scroll → Plan → Start | ~10 |
| "What's weak / how much syllabus is done" | weekly | Home → Your progress, or Syllabus | 1–2 |
| Appearance, class reminders, password, log out | **rarely** | Profile | 2+ |

### 1.2 Problems today

| # | Problem | Principle broken | Freq × severity |
|---|---|---|---|
| S-1 | **Practice drill-down is built inside the tab.** Subject → chapter → topic replaces the tab's content, with its own back rows and Android Back handler. There's no swipe-back and no deep link | Jakob's law (platform back), mental models | daily · high |
| S-2 | **Topic practice (the daily habit) sits below the whole self-assessment block** | Serial position, Hick | daily · high |
| S-3 | **No "carry on" entry point** for a topic half done or an unfinished self-assessment | Zeigarnik, recognition over recall | daily · medium |
| S-4 | **Home's "Your progress" mixes four kinds of data:** last test result, weak topics, strong topics, plus the syllabus coverage gauge and "covered lately" (already on the Syllabus tab). With the header, notices, Next up, Today and announcements, Home already has about 7 blocks before any Phase 2 card arrives | Chunking, Hick, progressive disclosure | daily · medium |
| S-5 | **The self-assessment builder asks 5 things on one scroll** before anything starts | Hick, choice overload, good defaults | weekly · medium |
| S-6 | **The self-assessment result puts "What to do next" after 4 sections** | Peak-end, goal-gradient | weekly · medium |
| S-7 | **Profile has nowhere for the coming settings** (Vibration, Help & guides, goal, reminders) | Information scent: a "settings" pile grows | rarely · low |
| — | The test runner (score 4.9) is a task runner and **stays exactly as it is** (exam security) | Calm under stress | — |

### 1.3 New structure: tabs unchanged

```
Current                                   Proposed
Home      Next up · Today · Your progress  Home      ★ header · Next up · Today · ★ Needs work (last test + 3 weak topics)
          (result + weak + strong +                  · Announcements (2) · row "Syllabus covered 42 %" → Syllabus
          syllabus + covered lately) · Ann.
Tests     To do · Upcoming · Past          Tests     unchanged (runner, results, security untouched)
Syllabus  subject chips → chapters         Syllabus  ★ + coverage gauge and "covered in class lately" (moved from Home)
Practice  New SA · To finish · Results     Practice  ★ Continue · Practise by topic · Self-assessments
          · Subjects {in-tab drill-down}             (To finish · 3 results · See all · New)
Profile   details · appearance ·           Profile   ★ You · Settings (appearance, class reminders, ★ vibration)
          reminders · account                        · ★ Help & guides · Account
```

**New routes** (pushed above the tabs: native back, swipe-back, deep links):
- `/practice/[subject]` → `/practice/[subject]/[chapter]`: replaces the in-tab drill-down. The practice session itself stays a full-screen focus modal.
- `/self-check/new`: **Quick start** (one screen, defaults) or **Customise** (Topics → Size & difficulty → Time & marking, "Step n of 3") → Plan → Start.
- The self-assessment result is reordered: score + **What to do next** → `[Topics | Answers]`.

**What moves and why:**

| Move | From → to | Why (principle) |
|---|---|---|
| Syllabus coverage gauge + "covered lately" | Home → Syllabus tab (Home keeps a one-line link with the %) | Home ≤ 6 blocks (Hick); one home for one kind of data; frees room for Today's 5 and Mistakes |
| Strong topics | Home → Syllabus (per chapter, where they already show) | Progressive disclosure; Home shows what to act on, not praise lists |
| Last test result | stays on Home, as the first row of **Needs work** | A result plus its next step together (peak-end) |
| Topic practice | below self-assessments → first in Practice | Serial position: the daily job comes first |
| Drill-down | in-tab state → routes | Platform back works (Jakob); links from Home "Practise" go to the exact chapter |
| Self-assessment setup | 5 sections → Quick start / Customise | Good defaults; fewer choices at once |

**Home order and the 6-block rule.** Blocks are ranked, and Home shows the first 6 that have something to say. The rest collapse into one row, "More on Home (n)" (progressive disclosure, serial position: announcements stay last):
1. Progress header (Phase 0)
2. Next up: a test due today always wins; else the next class
3. ▢ Today's 5 (Phase 2)
4. ▢ Mistakes due (Phase 2, only if any)
5. Continue (only if unfinished practice or a self-assessment, and no test in Next up)
6. ▢ Teacher shout-out / batch challenge (Phase 5)
7. Today's classes
8. Needs work (last test + 3 weak topics)
9. ▢ League snapshot (Phase 5, only if shown)
10. ▢ Weekly recap (Phase 7, Mondays)
11. Announcements (2 + See all)

▢ = slot exists in code but renders nothing until its feature ships.

### 1.4 Homes for future features (student)

| Feature (phase) | Home | Route / place | Hidden until |
|---|---|---|---|
| Today's 5 (2) | Home card #3 · Practice "Daily" row | `/engagement/daily` (focus, full screen) | Phase 2 + `enabled` |
| Mistakes notebook (2) | Home card #4 (when due) · Practice "Daily" row | `/engagement/revision` | Phase 2 |
| Goal + reminder settings (2) | Profile → Settings | sheet | Phase 2 |
| Roadmap (3) | **Syllabus tab becomes Roadmap** (label renamed then, not now) | tab content: countdown → Next 3 → subject switcher → path | Phase 3 |
| Mastery, expected marks, countdown (3) | top of the Roadmap tab | — | Phase 3 + a real exam date |
| Levels + badges (4) | header chip · Profile "You" card + badges shelf | `/engagement/badges` | Phase 4 |
| League (5) | Home card #9 | `/engagement/league` | Phase 5 + not hidden |
| Shout-outs / challenges (5) | Home card #6 | — | Phase 5 |
| Duels, squads (6) | Practice "With friends" row · Profile squad | `/engagement/duels/[id]`, `/engagement/squad` | Phase 6 |
| Weekly recap (7) | Home card #10 (Mondays) | `/engagement/recap` (story) | Phase 7 |
| Celebrations (2–4) | — | `/engagement/celebrate` (transparent modal, queued) | Phase 2 |
| Secure tests: ready check, "Ask my teacher" (8) | **inside the test flow only**: Intro → Ready check → runner; paused screen inside the runner | runner modal (linear) | Phase 8 |
| Help & guides (1E) | Profile → Help & guides · "?" in headers | `help-guides` screen | Phase 1E |

### 1.5 Wireframes (student)

**Home** (no test today, Phase 1)
```
┌────────────────────────────────────┐
│ Hi, Aarav                     🔔   │
│ Tuesday, 10 Nov · NEET 12th A      │
├────────────────────────────────────┤
│ 🔥 12      ◔ 60/100     ★ L4       │  progress header (Phase 0)
│ day streak  XP today   ▬▬▬▭ 60 to L5│
├────────────────────────────────────┤
│ NEXT UP                            │
│ ┌────────────────────────────────┐ │
│ │ Physics · Next class           │ │
│ │ Today, 5:00 PM · Room 2        │ │
│ └────────────────────────────────┘ │
│ ▢ Today's 5        (Phase 2 slot)  │
│ CONTINUE                           │
│ ┌────────────────────────────────┐ │
│ │ Kinematics · 12 of 40 PYQs  ▶  │ │  only if unfinished
│ └────────────────────────────────┘ │
│ TODAY                              │
│ ● 3:00 Chemistry  Done             │
│ ○ 5:00 Physics    Next             │
│   Weekly timetable              ›  │
│ NEEDS WORK                         │
│ 3 topics to fix      [ Practise ]  │  next step first
│ Rotational motion · Physics      › │
│ Electrostatics · Physics         › │
│ Mole concept · Chemistry         › │
│ Last test: Unit 3 · 54/80          │  small, calm, no red
│ Syllabus covered 42 %           ›  │  → Syllabus tab
│ ANNOUNCEMENTS (2)          See all │
└────────────────────────────────────┘
  Home · Tests · Syllabus · Practice · Profile
```
When a test is open, Next up is the test card with **Start test** as the only filled button (unchanged), and Continue hides.

**Practice**
```
┌────────────────────────────────────┐
│ Practice                           │
│ ┌ CONTINUE ──────────────────────┐ │
│ │ Kinematics · 12 of 40 done   ▶ │ │  or "Self-assessment · 14 min left"
│ └────────────────────────────────┘ │
│ ▢ Daily: Today's 5 · Mistakes (P2) │
│ PRACTISE BY TOPIC                  │
│ Physics     212 PYQs · 18 % done › │
│ Chemistry   190 PYQs · 9 % done  › │
│ Biology     340 PYQs · 4 % done  › │
│ SELF-ASSESSMENTS                   │
│ To finish: Organic basics · 8/20   │
│ Unit test 2   14/20  · 2 days ago  │
│ Kinematics    11/20  · last week   │
│ See all (7)                     ›  │
│ ▢ With friends: Duels · Squad (P6) │
│        [ + New self-assessment ]   │  primary, bottom
└────────────────────────────────────┘
```

**/practice/[subject] → /practice/[subject]/[chapter]**
```
‹ Practice     Physics                ‹ Physics     Kinematics
──────────────────────────           ──────────────────────────
11th                                  40 PYQs · 12 done · 58 % right
Units & measurement  24 · 50 %  ›     Covered in class: 3 Nov
Kinematics          40 · 30 %  ›     TOPICS
Laws of motion      36 · —     ›     Projectile motion  14 · 4 done ›
12th                                  Relative velocity   9 · new    ›
Electrostatics      44 · 10 %  ›     Graphs             17 · 8 done ›
                                         [ Practise whole chapter ]
```

**/self-check/new: Quick start**
```
‹ Back   New self-assessment
──────────────────────────
Subject   [Physics ▾]
Covers    Topics covered in class (14)   Change ›
Size      20 questions · ~30 min · smart mix
          [ Start (Quick start) ]          primary
          Customise ›                      3 short steps
```

**Self-assessment result**
```
Score 14/20 · 70 %   "Strong on graphs, shaky on projectiles"
WHAT TO DO NEXT
[ Retake weak topics (6 Qs) ]   Practise Projectile motion ›
[ Topics | Answers ]
… (topic strength, chapter tree, difficulty fold into Topics)
                        [ Done ]
```

**Profile**
```
YOU         Aarav Patil · NEET · 12th · NEET 12th A
            ▢ level card + badges shelf (P4)
SETTINGS    Appearance › · Class reminders › · Vibration ● (1C)
            ▢ Daily goal & practice reminder (P2)
HELP        Help & guides › (1E)
ACCOUNT     Change password › · Log out
```

### 1.6 What stays the same (student)
- Tab count, names, order and icons. Syllabus is renamed only when the Roadmap ships.
- Next up and Today cards, and their behaviour.
- The Tests tab, test runner, results screen, and every exam rule and protection.
- The topic practice session screen and the self-assessment runner (only their entry points and the result order change).
- The 7 Nov login and sign-up screens. API responses are unchanged.

---

## 2. Teacher

### 2.1 Jobs and frequency (teachers' words)

| Job | How often | Where today |
|---|---|---|
| "What's on today, which class is next?" | **daily** | Home: today's classes (no action on them) |
| "Mark what I taught in class" | **daily** (after each class) | Batches → batch sheet → Mark topics (sheet on sheet) → subject/chapter/topic (~8 taps) |
| "How's the live test going? Who's paused?" | **daily in test weeks** | Tests → test → live (monitor) |
| "Let a paused student back in" | when it happens: **must be instant** | Tests → test → live → student → Resume |
| "Set a test for my batch" | weekly | Tests → New test (4 steps) **[check in 1B: `/create-test` 2-page flow + draft exists]** |
| "See who struggled on the test" | weekly | Tests → test → past 10 fact rows → results |
| "Make a printable paper" | weekly | Questions tab → ~12-field form |
| "Find and share a paper I made" | weekly | Questions → My PDFs link, or Profile → Your PDFs (jumps tabs) |
| "Post an announcement" | weekly | Home → Announcements |
| Edit timetable, subjects, profile, password | **rarely** | Home week editor / Profile |

### 2.2 Problems today

| # | Problem | Principle broken | Freq × severity |
|---|---|---|---|
| T-1 | **Home is a dashboard of totals, not "what's next".** 3 stat tiles (repeated on Profile), classes with no action, the whole week's timetable editor, announcements. Live tests, paused students and new results aren't on Home | Good defaults (next step first), serial position, Hick | daily · high |
| T-2 | **Marking topics means re-finding the batch and subject Home already knows,** and it opens a sheet on a sheet | Recognition over recall, Tesler, one modal max | daily · high |
| T-3 | **A teacher's batch is a sheet** holding info, a nested Mark-topics sheet, recent topics and analysis | Mental model "class → students / tests", chunking | daily · medium |
| T-4 | **The test screen shows 10 fact rows before any result;** the live monitor and results are buried | Progressive disclosure, serial position | weekly · high **[check in 1B: `/test/[testId]` exists]** |
| T-5 | **Paused students waiting for a decision aren't surfaced anywhere** outside the monitor, though main now keeps them pending | Visibility of status, Zeigarnik, fairness (calm under stress for the student) | test weeks · high |
| T-6 | **The "Questions" tab opens on a PDF form;** the bank and My PDFs are hidden modes reached by back links or from Profile | Information scent (label doesn't predict content), recognition | weekly · medium |
| T-7 | **The PDF form shows about 12 inputs at once** (`create-exam-modal.tsx`, 2,571 lines, 20 modes) | Hick, chunking, one job per screen | weekly · medium |
| T-8 | **New test:** steps and drafts **[check in 1B]**. `teacher-tests.tsx` still shows 10 inputs and 8 modes in the audit | Chunking, Zeigarnik | weekly · ? |
| T-9 | **Profile repeats Home's stat tiles** and links to My PDFs in another tab | Simplicity, mental models | rarely · low |

### 2.3 New structure: one tab renamed (Questions → Papers)

```
Current                                       Proposed
Home       3 stats · today's classes ·         Home     ★ Today (each class: Mark covered) · ★ Needs attention
           week editor · announcements                  (waiting to continue · live tests · results ready · draft)
                                                        · Announcements (2) · row Weekly timetable → /timetable
Batches    cards → [sheet] batch → [sheet]     Batches  one row per batch → ★ /teach/[batchId]
           Mark topics / student                        [Syllabus | Students | Tests]   (▢ Engagement, P5)
Tests      New test · filters · cards →        Tests    ★ Continue draft · [Live | Upcoming | Done] · batch filter
           [sheet] test → [sheet] student               · Set a test → /create-test · test → /test/[testId]
Questions  {PDF form}{bank}{My PDFs}           ★Papers  Recent papers · row Question bank · [ Make a paper ] (bottom)
Profile    3 stats · subjects · batches ·      Profile  subjects · batches · tuition · settings · ★ Help & guides
           tuition · Your PDFs · account                · account   (no stat tiles, no PDF jump)
```

**New or changed routes:**
- `/teach/[batchId]`: Syllabus (inline tick-to-mark) · Students → `/student/[studentId]` · Tests (primary **Set a test**, batch pre-filled).
- `/test/[testId]`, segments by status **[check in 1B]**:
  - scheduled → summary + **Edit**
  - open → `[Live | Questions]`, primary **Close now**, with "Waiting for you (n)" at the top of Live
  - closed → `[Results | Analysis | Questions]`
  - the 10 facts go behind a "Test details" row; Cancel and Edit in a ⋯ menu
- `/timetable`: the week editor moves off Home; add or edit a class as one sheet.
- `/papers/new`: **What** (class, subject, chapters, topics, levels) → **Questions** → **Paper** (name pre-filled; set, date, duration under "More options") → outcome **Open · Share**. This splits `create-exam-modal.tsx` along those steps.
- `/papers/bank`: the question bank with a filters sheet.
- **Mark covered** sheet: from a Home class row or the batch Syllabus segment, opened on that batch and subject. One sheet; Done → toast "3 topics marked".

**What moves and why:**

| Move | Why (principle) |
|---|---|
| Stat tiles off Home and Profile (kept inside each batch) | Next step over overview; no repeats (Hick) |
| Week editor → `/timetable` row | Rare job leaves Home (frequency) |
| "Mark covered" onto today's class row | Recognition: batch and subject are already known (Tesler); daily job one tap away |
| Needs attention block on Home | Status visible without remembering (recognition); unfinished work offered back (Zeigarnik) |
| Questions → **Papers**, landing on recent papers | Label predicts content (information scent); the weekly "find and share" job is one tap |

### 2.4 Homes for future features (teacher)

| Feature (phase) | Home |
|---|---|
| Batch Engagement view (5) | 4th segment of `/teach/[batchId]`: `[Syllabus \| Students \| Tests \| Engagement]` |
| Batch challenges (5) | Engagement segment → "Start a challenge" stepper sheet |
| Shout-outs (5) | a student row (Engagement segment, `/student/[studentId]`) |
| "Ask my teacher" requests, bulk let-back-in (8) | Home **Needs attention** "Waiting for you (n)" + top of `/test/[testId]` Live |
| Security level per test (8) | `/create-test` Timing step → "More options" (Standard default) |
| Ready-check overrides (8) | `/test/[testId]` Live → student row |
| Integrity report, void / retake (8) | `/test/[testId]` Results → "Worth a look" section |
| Help & guides (1E) | Profile + "?" in headers |

### 2.5 Wireframes (teacher)

**Home**
```
┌────────────────────────────────────┐
│ Good afternoon, Mrs Patil          │
│ Tuesday, 10 Nov                    │
│ TODAY                              │
│ 3:00 NEET 12th A · Physics  Done   │
│      [ Mark covered ]              │  primary on the just-finished class
│ 5:00 JEE 11th B · Physics   Next   │
│ NEEDS ATTENTION                    │
│ ⏸ 2 waiting to continue · Unit 3 › │  paused students, always first
│ ● Live: Unit 3 · 18/32 submitted › │
│ ✓ Results ready: Mock 4 · avg 54 % │
│ ✎ Continue draft: Kinematics wk 2 ›│
│ ANNOUNCEMENTS (2)   Post · See all │
│ Weekly timetable · 9 classes     › │
└────────────────────────────────────┘
  Home · Batches · Tests · Papers · Profile
```

**/teach/[batchId]**
```
‹ Batches   NEET 12th A · 32 students · Physics
[ Syllabus | Students | Tests ]        (▢ Engagement, P5)
Physics covered 46 % ▬▬▬▬▭▭▭▭
Kinematics       ☑ Projectile ☑ Relative ☐ Graphs
Laws of motion   ☐ …                       (tick = mark covered)
```

**/test/[testId]** (open test)
```
‹ Tests   Unit 3 · NEET 12th A
Live · 18/32 submitted · closes 6:00 PM
[ Live | Questions ]
WAITING FOR YOU (2)
Aarav P · paused 4:12 PM (app in background)   Let back in ›
…
IN PROGRESS (12) · SUBMITTED (18) · NOT STARTED (2)
Test details ›                          ⋯ Edit / Cancel
                          [ Close now ]
```

**Papers**
```
Papers
RECENT PAPERS
Kinematics practice · 30 Qs · yesterday   ⋯ share / print
Mole concept · 25 Qs · 3 Nov              ⋯
Question bank                             ›
              [ Make a paper ]                 primary, bottom
```

**/papers/new** (step 1 of 3)
```
‹ Papers   Make a paper · Step 1 of 3: What
Class [12th ▾]  Subject [Physics ▾]
Chapters  Kinematics ✕  Laws of motion ✕  + Add
Levels    Easy ● Medium ● Hard ○
                        [ Next: questions ]
```

### 2.6 What stays the same (teacher)
- Tab count, order and icons. Only the "Questions" label changes, if you approve.
- The live monitor's polling, Extend / Resume / Finalize controls, audit, and every exam rule.
- The create-test flow, apart from what the 1B check finds missing (draft on ✕, steps).
- Announcements, PDF output and the Smart PDF layout. API responses are unchanged.

---

## 3. Tuition (admin)

### 3.1 Jobs and frequency

| Job | How often | Where today |
|---|---|---|
| "Let in people who asked to join" | **daily** | teachers: Home row / bell / People › Teachers; students: People › Students only; the bell counts only teachers |
| "What needs fixing?" (no batch, no teacher, no timings) | **daily** | muted link text on Home |
| "Add a student" | weekly | People → Add → 8 fields in one sheet |
| "Reset a password" | weekly | People → search → student → Reset (stacked) **[check in 1B: `/student/[studentId]`]** |
| "Give students a batch" | weekly | Home link → student → Change batch |
| "See a test's results" | weekly | Tests → test → student |
| Post an announcement | weekly | Home |
| Batch setup (timings, teachers, invitations) | rarely | Batches → `/batch/[id]` (real routes ✓) |
| Institute profile, logo, chapter weightage | rarely | Profile |

### 3.2 Problems today

| # | Problem | Principle broken | Freq × severity |
|---|---|---|---|
| A-1 | **Home is totals plus every batch in full;** problems hide as muted link text | Good defaults (next step), Von Restorff (the problem should stand out), Hick | daily · high |
| A-2 | **Join requests live in 4 places,** and the bell counts only teachers | Mental models (one inbox), recognition | daily · high |
| A-3 | **People › Students shows Invite, Add, requests, search and 3 filter rows before the first student** (`tuition-students.tsx`: score 4.3, 10 sections) | Hick, filter wall | weekly · medium |
| A-4 | **Add student shows 8 fields in one sheet** | Chunking (≤ 5 per step), good defaults | weekly · medium |
| A-5 | **Student and teacher detail stacked sheets** **[check in 1B: routes exist]** | One modal max, Jakob | weekly · ? |
| A-6 | **The batch hub repeats the full weekly schedule;** settings sit in the body | Simplicity, progressive disclosure | rarely · low |

### 3.3 New structure: tabs unchanged

```
Current                                     Proposed
Home     requests row · 3 stats · "no       Home    ★ Needs attention (requests · no batch · no teacher · no timings)
         batch" link · every batch in full          · 3 totals (one row) · batches one line each · Announcements (2)
         · announcements · bell (teachers)          · bell counts students + teachers → /requests
Batches  /batch/[id] routes ✓               Batches unchanged (hub: schedule summary line only; settings in ⋯)
People   [Students|Teachers] · 2 buttons ·  People  [Students | Teachers] · search · Filters (n) sheet · "3 waiting
         requests · search · 3 filter rows          to join" row → /requests · list · [ Add student ] (bottom)
Tests    filters · list → test → student    Tests   unchanged, using the shared /test/[testId] and /student/[studentId]
Profile  institute · weightage · appearance Profile institute · logo · chapter weightage · ▢ exam dates (P3) ·
         · account                                  ▢ engagement switch (P5) · ▢ test-security defaults (P8) ·
                                                    appearance · ★ Help & guides · account
```

**New routes:**
- `/requests`: `[Students | Teachers]` with counts, plus the join-code card (Share · Renew); Accept and Reject per row.
- Add student becomes 2 steps: **Student** (name, email, phone, parent's phone) → **Studies & login** (program, class, batch pre-filled from context, starting password).

### 3.4 Homes for future features (tuition)

| Feature | Home |
|---|---|
| Exam dates per program (3, F5) | Profile → Exam dates |
| Engagement on/off (5) | Profile → Engagement features |
| Batch Engagement view (5) | `/batch/[id]` hub → Engagement row (same component as the teacher's segment) |
| Test-security defaults, pause requests (8) | Profile → Test security · Home Needs attention "Waiting for a teacher (n)" |
| Help & guides (1E) | Profile |

### 3.5 Wireframes (tuition)

**Home**
```
┌────────────────────────────────────┐
│ Shree Classes                 🔔 3 │
│ NEEDS ATTENTION                    │
│ 3 want to join (2 students, 1 teacher)   › │ → /requests
│ 5 students have no batch            › │ → People, filtered
│ NEET 11th A has no Chemistry teacher › │ → batch Teachers
│ 2 batches have no timings           › │ → batch Schedule
│ 412 students · 18 teachers · 14 batches  │
│ BATCHES                                   │
│ NEET 12th A · 32 · Physics 46 %        ›  │
│ JEE 11th B · 28 · Maths 30 %           ›  │
│ ANNOUNCEMENTS (2)          Post · See all │
└────────────────────────────────────┘
  Home · Batches · People · Tests · Profile
```
When nothing needs attention, the block is one line: "All set ✓".

**People**
```
[ Students | Teachers ]
🔎 Search students         Filters (2) ▾
NEET ✕  12th ✕
3 waiting to join                         ›
Aarav Patil · NEET 12th A                 ›
…
                    [ Add student ]          options: one by one · share joining code
```

**/requests**
```
‹ Home   Join requests
[ Students (2) | Teachers (1) ]
Joining code  K7QX-M2PA   Share · Renew
Riya S · NEET 12th A (code) · 2 h ago   Accept · Reject
```

### 3.6 What stays the same (tuition)
- Tabs, order and icons.
- The batch routes (`/batch/...`), the Tests list and results, announcements, the institute profile and logo.
- The Teacher workspace switch. API responses are unchanged.

---

## 4. Decisions (answered 10 Nov)

**Answers:**
1. Rename to **Papers**, with the question bank **one tap** from the Papers screen.
2. Topic practice first.
3. Move them to Syllabus, with a one-line link on Home.
4. Keep "Syllabus" until Phase 3.
5. `create-exam-modal` last, as its own slice. Keep the saved draft and every API call exactly as they are, and **stop before starting it**.
6. Remove the legacy screens in their own commit, after confirming no push-notification route, deep link or other screen opens them.

**Change to student Home:** "Needs work" leads with the next step ("3 topics to fix → Practise"). The last test score is smaller and calm (neutral colour, no red, no percentage badge). A low score is never the loudest thing on Home.

**Original questions:**

1. **Teacher tab rename:** "Questions" → **Papers**, opening on recent papers + Make a paper. _Recommended._
2. **Practice order:** Continue → **topic practice** → self-assessments. Today's order puts self-assessments first. _Recommended: topic first, the daily habit._
3. **Home slimming:** move the syllabus gauge, "covered lately" and strong topics from student Home to the Syllabus tab, leaving a one-line link. _Recommended: makes room for Phase 2 without crossing 6 blocks._
4. **Syllabus label:** keep "Syllabus" now; rename to "Roadmap" in Phase 3 when the content changes. _Recommended._
5. **Scope of 1B:** splitting `create-exam-modal.tsx` (2,571 lines) into `/papers/new` is the riskiest piece. _Recommended:_ include it as the **last** 1B slice, after everything else is committed, so it can be dropped without losing the rest.
6. **Unreachable legacy screens** (`app/explore.tsx`, `app/profile.tsx`, the old side-drawer Home, the exam-room modals): remove in 1B, or leave for later? _Recommended: remove, as its own commit, after checking nothing links to them._

## 5. Part 1B: order and files (for your go-ahead when 1A is approved)

**Order** (one commit per slice, app shippable after each; a slice whose problem the check shows is already fixed shrinks to states only):
1. **Shared:**
   - routes and the stack in `_layout.tsx`
   - the provider moved to the student root
   - app-interactions basics in the kit: `useAsyncAction` / `AsyncButton`, `AsyncView` + skeletons, toasts, `useOnline`, `useLayout` / `Container`
2. **Student:** Home order + Needs work · Syllabus additions · Practice hub + routes + Continue · self-check Quick start / Customise · result order · Profile sections.
3. **Teacher:** Home (Today + Mark covered + Needs attention) · `/teach/[batchId]` · `/timetable` · `/test/[testId]` segments **[check]** · create-test draft / steps **[check]** · Papers tab + `/papers/bank` · Profile.
4. **Tuition:** Home Needs attention · `/requests` + bell · People filters sheet · Add student in 2 steps · batch hub tidy.
5. `/papers/new` (splits `create-exam-modal.tsx`), if decision 5 is yes.
6. Legacy removal, if decision 6 is yes.

**Files I'd open** (beyond those already read):
- **Shared:** `src/app/_layout.tsx`, `src/app/index.tsx`, `src/navigation/tabs.ts(x)`, `src/components/app-tabs.tsx`, `src/context/tab-context.tsx`, `src/context/practice-target.ts(x)`, `src/hooks/use-tab-bar-height.ts`, `src/services/load-cache.ts`
- **Student:** `student-practice.tsx`, `self-assessment-flow.tsx`, `self-assessment.ts`, `topic-practice-sheet.tsx`, `topic-practice.ts`, `student-roadmap.tsx`, `student-profile.tsx`, `student-tests.tsx` (read only, for consistency)
- **Teacher:** `teacher-home.tsx`, `teacher-batches.tsx`, `teacher-tests.tsx`, `teacher-profile.tsx`, `test-management-screen.tsx`, `test-monitor-section.tsx`, `test-results-section.tsx`, `student-insight.tsx`, `student-performance-sheet.tsx`, `create-test/*`, `src/app/create-test/*`, `src/app/test/[testId].tsx`, `src/app/questions.tsx`, `components/my-pdfs-screen.tsx`, `components/create-exam-modal.tsx` (slice 5), `screens/shared/syllabus-progress.tsx`, `screens/shared/timetable.tsx`
- **Tuition:** `tuition-home.tsx`, `tuition-people.tsx`, `tuition-students.tsx`, `tuition-teachers.tsx`, `tuition-profile.tsx`, `join-requests.tsx`, `pending-enrollments.tsx`, `batch-screens.tsx`, `screens/shared/notification-bell.tsx`, `src/app/student/[studentId]/*`, `src/app/teacher/[teacherId]/*`
- **Never opened or changed:** `test-runner.tsx`, `assessment-session.tsx` (except its result order, if the result lives there), and every `exam-*`, `answer-*`, `attempt-*` and `use-exam-visibility` file.

## 6. Before / after (top tasks, taps)

| Task | Before | After | Main change |
|---|---|---|---|
| Student: carry on topic practice | 6 | 2 | Continue card |
| Student: start a self-assessment | ~10 | 3 | Quick start |
| Student: act on a self-assessment result | 1 + long scroll | 1 | next step under the score |
| Student: practise a weak topic from Home | 3 | 2 | goes straight to the chapter route |
| Teacher: mark topics after class | ~8 · 2 sheets | ~3 · 1 sheet | Mark covered on today's class |
| Teacher: let a paused student back in | 4 + find | 2 | Needs attention → Waiting for you |
| Teacher: see how a test went | 4 + scroll | 1–2 | Results ready row → Results first |
| Teacher: share a saved paper | 4 | 2 | Papers tab = recent papers |
| Admin: accept join requests | 1–2, 4 places | 1, one place | `/requests` |
| Admin: add a student | 8 fields at once | 2 steps × 4 | chunked, batch pre-filled |

## 7. Persona walkthrough (quick check of this plan)
- **Aarav** (JEE, 12th, ambitious): Home → header + test or Continue in the first screen; topic practice is first in Practice. ✓ Gets to PYQs in 2 taps.
- **Sneha** (NEET, 11th, anxious): Needs work shows 3 weak topics with a calm "Practise", not a red list; the self-assessment result leads with what to do next. ✓ League and duels are hidden slots, nothing comparative in Phase 1.
- **Rohit** (CET, inconsistent): returning after a gap, the Continue card picks up where he stopped; Home stays short. ✓
- **Teacher** (Mrs Patil): opens the app after class → Mark covered is the first button; paused students come first under Needs attention. ✓
- The 5-second and first-click tests run on the built screens before the restyle is final (end of 1D), with real students and teachers if you can arrange 3–5 of each.
