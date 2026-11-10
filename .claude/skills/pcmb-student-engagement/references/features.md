# Feature specs

Each feature lists: the job · the student experience · the teacher side · data and API (details in backend.md) · motion and notifications · edge cases · acceptance criteria. Build in the order of SKILL.md's phases. **Before building, check the saved map (`docs/app-map.md` → "engagement features already in the app/backend") for an existing version of the feature.** If there's no saved map, or it's old, ask the user whether to refresh it; don't scan on your own.

---

## F1. Progress core: XP, daily goal, streak, levels

**Job:** "When I open the app, I want to see in one glance how today is going and what's left, so I know a few minutes now counts."

**Student:**
- Home starts with a compact **progress header**: streak flame + count · daily goal ring (XP today / goal) · level chip ("L12 Compound") with a thin bar to the next level. Tap → a Progress sheet (XP history for 7 days, freezes held, goal setting).
- XP toasts after learning actions ("+15 · mistake fixed") appear at the bottom, at most one at a time, merged if several land within 2 s.
- Profile: level card, longest streak, total questions, badges shelf (F6), goal + reminder time settings (F11).
- **Never inside the secure test runner.** Test XP shows on the results screen after release.

**Teacher:** sees each student's streak, weekly XP and goal days in the batch engagement view (F8).

**Data/API:** `XpEvent` ledger, `StudentEngagement` profile, `DailyActivity`; `GET /api/engagement/me`, `PATCH /api/engagement/settings`. Existing write routes also return `engagement: { xpAwarded, today, streak, levelUp?, badges? }` so the app updates without another request.

**Motion:** goal ring fill (`useFill`), streak flame bump once when the day is secured, a level-up moment (full screen ≤ 1.2 s, play-once art) at most once per session; reduced motion → static states.

**Edge cases:** IST midnight while practising (the award lands on the server's day); offline answers (XP appears when they sync; never estimate XP on the client); a changed goal applies tomorrow; students without a batch still get XP, streak and goal, but no league.

**Acceptance:** awards are idempotent under retries; the streak is correct across IST midnight; test answers never show XP before release; header numbers match `GET /api/engagement/me`.

---

## F2. Daily challenge ("Today's 5")

**Job:** "When I have 5–10 minutes, I want the most useful questions picked for me, so I don't waste time choosing."

**Student:** Home card "Today's 5 · ~6 min · Kinematics, Mole concept". One tap → a focused 5-question session (reuse `question-view.tsx`), with instant feedback and an explanation after each. End screen: score, XP, the goal ring, and "Fixed 2 old mistakes". Completed → the card shows ✓ and tomorrow's teaser ("Tomorrow: Electrostatics").

**Selection (server, per student per IST day, generated on first open, then fixed):**
1. Up to 2 **due revision items** (F3).
2. Up to 2 from **weak or learning topics** in chapters the tuition has covered (`SyllabusProgress`).
3. 1 from a topic **covered in class in the last 7 days**.
4. Fill the rest from the student's program bank (`practiceBankOf` + `pyqBankFilter`): Medium difficulty, unanswered questions first.
Mix subjects across days; avoid 5 questions from one chapter unless it's due revision.

**Teacher:** batch completion rate in the engagement view.

**Data/API:** `DailyChallenge {studentId, date, questionIds, answers, completedAt}`; `GET /api/engagement/daily` (creates it if missing), `POST /api/engagement/daily/answer` (marks with `isCorrect`, also upserts `PracticeAnswer` so topic stats stay one truth).

**Edge cases:** the student's program has no bank (GENERAL) → hide the feature and explain; fewer than 5 eligible questions → shorter challenge; a challenge left half-done keeps its answers and resumes.

**Acceptance:** the same 5 all day (re-opening doesn't reshuffle); answers count in topic stats; completion awards once.

---

## F3. Mistakes notebook + spaced revision

**Job:** "When I get something wrong, I want it to come back at the right time until I've really got it, so the same mistake doesn't cost me marks in the exam."

**Student:** Practice tab section "Mistakes · 7 due today" → a list grouped by subject → chapter, each showing the question snippet, when it was missed, and its box (1–5 dots). "Revise due" runs them as a session. A correct answer moves the item up a box; a wrong one sends it to box 1. Clearing box 5 → "Fixed for good ✓ +20 XP".

**Schedule (Leitner):** box 1 → due next day · box 2 → 3 days · box 3 → 7 · box 4 → 14 · box 5 → 30, then cleared.

**Sources:** wrong practice answers (immediately) · wrong self-assessment answers (on submit) · wrong test answers **only after results are released and the test allows reviewing questions** (respect the existing visibility rules; restricted tests never feed revision).

**Teacher:** "most-missed questions this week" for the batch (anonymous counts).

**Data/API:** `RevisionItem {studentId, questionId, source, box, dueOn, lastAnsweredAt, clearedAt}`; `GET /api/engagement/revision?due=1`, `POST /api/engagement/revision/answer`.

**Acceptance:** an item never duplicates per question; test-sourced items appear only after release; due counts match the IST date.

---

## F4. Learning roadmap: "where I am and what's next"

**Job:** "When I think about the whole syllabus, I want to see what I've finished, where I am, and the next best thing to study, so the exam feels doable instead of overwhelming."

This upgrades the existing **Syllabus tab** (`student-roadmap.tsx`, `GET /api/student/roadmap`) into the **Roadmap** tab. Keep the data it already shows (weightage, coverage, strong/weak) and add mastery and recommendations.

**Student:**
- A subject switcher (segmented control) → a **vertical path** of chapters, 11th then 12th, in syllabus order. Each node shows the chapter name, its weightage chip ("~12 marks"), a mastery ring, and a state: *Not started · Covered in class · Learning · Practising · Mastered ✓ · Fading ↺*.
- A **"You are here"** marker on the chapter they practised or that was covered in class most recently.
- **"Next 3 for you"** card at the top, each with a reason:
  - "Start *Current Electricity*: covered in class yesterday"
  - "Revise *Thermodynamics*: mastery fading, ~8 marks"
  - "Master *Rotational Motion*: high weight, you're at 45%"
  Ranked by `weightage × (1 − mastery) × boosts` (covered recently ×1.5, fading ×1.3, upcoming test chapter ×2).
- **Milestones** on the path: 25/50/75/100% of a subject mastered, "11th Physics complete", with a small celebration the first time.
- Tap a chapter → a sheet listing topics with mastery chips, PYQ count, "Practise weakest topic" (opens topic practice), "Add to today" (pins it into tomorrow's daily challenge).
- **No locking:** every chapter is open. The path *recommends*; the student decides (autonomy).

**Teacher:** the batch's mastery heatmap per chapter (aggregate) next to the existing syllabus progress.

**Data/API:** extend `GET /api/student/roadmap` with `mastery`, `state`, `youAreHere`, `next[]`, `milestones` (additive fields), computed from topic stats + SyllabusProgress + ChapterWeightage + upcoming tests.

**Motion:** a node fills when it becomes mastered (once), the path scrolls to "You are here" on open (no auto-scroll after the first visit), and milestone art plays once.

**Acceptance:** recommendations always carry a reason; nothing is locked; it works without weightage data (falls back to topic counts and hides marks).

---

## F5. Mastery map, expected marks, exam countdown

**Job:** "When I'm worried about the exam, I want an honest estimate of where I stand and how many days I have, so I can plan."

**Student (top of Roadmap):**
- **Exam countdown:** "NEET in 142 days". The date comes from the tuition's settings per program; with no date set, the countdown is hidden (never guess dates).
- **Expected marks (estimate):** Σ chapter weightage × chapter mastery, shown as a range ("~140–170 / 300") labelled "estimate from your practice", with "+12 since last week" when it rises. Hidden when weightage isn't configured or under 50 answers in total.
- **Subject bars:** mastery % per subject; tap → that subject's path.

**Teacher/tuition:** set exam dates per program (Profile/settings in the tuition app); see expected-marks distribution per batch (aggregate only).

**Data/API:** `Tuition.examDates: [{ program, label, date }]` (additive); `GET /api/engagement/outlook` → countdown + expected range + subject mastery.

**Edge cases:** dropper/other programs; multiple exams (JEE Main + Advanced: show the nearest); a passed date rolls to the next one or hides.

**Acceptance:** never shows a countdown without a real date; the estimate is labelled as one; there's no ranking of expected marks between students.

---

## F6. Badges and cosmetics

**Job:** "When I hit a real milestone, I want it recognised, so my effort feels seen."

**Student:** a badge unlock sheet appears once when a badge is earned (art + criteria + "Nice!"). Profile has a badges shelf showing earned badges and locked ones with visible progress ("Mistake Hunter: 34/50"). Level titles unlock frames and accent colors, chosen in Profile.

**Data/API:** `StudentBadge {studentId, badgeId, tier, earnedAt}`; the badge catalog lives in server config (engagement-system.md §6); evaluation runs after awards (`lib/engagement/badges.ts`); `GET /api/engagement/badges`.

**Graphics:** each badge is original art generated with canvas-design under neobrutalism-expo's App Art Contract (graphics.md), in the student scope's neobrutalism preset, exported as WebP stills + a play-once unlock animation for gold/legend tiers.

**Acceptance:** badges are awarded exactly once per tier; criteria are visible; no hidden badges and no marks-rank badges.

---

## F7. Weekly batch league (effort)

**Job:** "When I see my batchmates putting in work, I want a friendly reason to push a bit more this week."

**Student:** a Home card "This week: #4 · 80 XP to #3" (only when the league is shown) → a League screen with the top 10 + you, avatars, levels and weekly XP, plus a countdown to Sunday 23:59 IST. Settings: "Show me in my batch league" (default on, explained once). The Monday result card and top-3 badge are described in engagement-system.md §7.

**Teacher:** sees the full batch list in the engagement view (including hidden students: hiding is only from peers).

**Data/API:** `GET /api/engagement/league?week=current|previous` (aggregates `XpEvent` by `weekKey`, excluding late-night XP); `PATCH /api/engagement/settings { leagueHidden }`.

**Acceptance:** marks never appear; hidden students are invisible to peers; it isn't shown below 4 visible members; ranks are stable on ties.

---

## F8. Teacher: batch challenges, shout-outs, engagement view

**Job (teacher):** "When my batch slacks off before a test, I want to rally them and recognise the ones putting in effort, without extra work."

**Teacher app (classic look, teacher login):**
- **Batch engagement view** (inside the batch screen): active this week, average streak, daily-challenge completion, goal days, and "Not active for 3+ days" (to check in personally, not to shame). Weak chapters across the batch, from existing analysis.
- **Create a challenge** (≤ 4 fields): template → target → dates → reward. Templates: *Batch solves N questions from chapter X* · *Everyone completes the daily challenge on M days* · *Batch fixes N mistakes* · *Master chapter X (K students)*. Progress is visible to students.
- **Shout-out:** pick a student → a template ("Great comeback in Organic!", "Most consistent this week", "Top mistake-fixer") or a short custom note (≤ 140 chars) → it appears on the student's Home and as a push (counts toward the nudge cap).
- Tuition owners can turn engagement features on or off per tuition (`Tuition.engagement.enabled`, default on).

**Student:** a challenge card with a shared progress bar ("Batch: 640/1,000 Kinematics questions · 2 days left") and their own contribution; a shout-out card (the teacher's name, message and date) that can be pinned to their profile.

**Data/API:** `BatchChallenge`, `Shoutout`; `POST /api/engagement/challenges` (teacher/tuition), `GET /api/engagement/challenges?batchId=`, `POST /api/engagement/shoutouts`, `GET /api/engagement/batch/[id]` (teacher view).

**Acceptance:** only teachers assigned to the batch (or the tuition) can create; challenge progress updates from the same ledger; shout-outs are rate-limited (≤ 5 per teacher per day).

---

## F9. Duels (async 1v1 within the batch)

**Job:** "When I want to make practice fun with a friend, I want a quick head-to-head on a chapter we both study."

**Student:** Practice → Duels → "Challenge a batchmate" → pick a person (batchmates who allow duels) → pick a chapter covered by the tuition → 5 questions, the same for both, answered on each player's own time within 24 h. The result shows both scores (correct count, then total time) and the explanations. Rematch in one tap. React with preset emoji only (👏 🔥 😅 🤝).

**Rules:** max 3 open duels, 5 new per day; decline anytime without the challenger being told why; questions come from covered chapters at Medium; duel answers also update topic stats and revision; XP per engagement-system.md §2.

**Data/API:** `Duel {tuitionId, batchId, challengerId, opponentId, chapter, questionIds, answers{}, status, expiresAt}`; `POST /api/engagement/duels`, `POST …/[id]/accept|decline|answer`, `GET /api/engagement/duels`.

**Safety:** same batch only; students can turn off "Allow duel invites"; no chat; teachers can see duel counts, not content.

**Acceptance:** both players get identical questions; expiry handled; the push goes only to the opponent and respects quiet hours and the daily cap.

---

## F10. Study squads

**Job:** "When I study with friends, I want us to keep each other going."

**Student:** create a squad (name + emoji) and invite 2–4 batchmates (they accept), or join one the teacher made. The squad card shows a weekly squad goal (sum of members' XP, target scaled by size), each member's contribution (XP only), the squad streak in weeks, and a "nudge a squadmate" button with preset messages (max 1 per pair per day, respecting quiet hours). Leave anytime.

**Teacher:** can auto-form squads (balanced by activity) or let students self-form; sees squad goal completion.

**Data/API:** `Squad {tuitionId, batchId, name, emoji, memberIds, createdBy, weeklyGoal}`, `SquadInvite`; `POST/GET /api/engagement/squads`, `POST …/[id]/invite|accept|leave|nudge`.

**Acceptance:** 3–5 members within one batch; one squad per student; no free text; leaving never breaks other members' data.

---

## F11. Gentle nudges + weekly recap

**Nudges (the "Gentle" policy the product owner chose):**
- **Practice nudge: at most 1 per day,** at the time the student picks (default 6:30 PM), and only if today's goal isn't done. **Quiet hours 10 PM–7 AM.** Nothing while a test attempt is active.
- **Local first:** the app arms dated one-off reminders with expo-notifications (`armReminders`, app-experience.md) and cancels today's the moment the goal is met. No server is needed. Today's copy is personal ("Today's 5 are ready, about 6 min · Kinematics first"); copy for later days stays generic.
- **Event notifications** (duel invite, shout-out, batch challenge launched, squad nudge) are a separate, also gentle budget: at most 1 per student per day through `engagePush` (`pushOnce('engage:<studentId>:<date>')`), never in quiet hours, never during an active test, and with their own switch ("Notify me about duels, shout-outs and challenges").
- Existing pushes (new test, announcements, class reminders) are separate and unchanged.
- Settings: practice reminder on/off + time picker (07:00–21:30 only), event notifications on/off, weekly recap on/off.

**Weekly recap (Monday):** a Home card that opens a 4–5 slide story: XP and questions · accuracy trend on the most-practised chapter · mistakes fixed · chapters that moved up · badges and streak. The last slide is "This week's plan" (from roadmap F4). **Share** produces an image of their own stats only (no other names), via `react-native-view-shot` + `expo-sharing` (verify against the current Expo docs, and install with `npx expo install`).

**Acceptance:** at most 1 practice nudge and 1 event notification a day; nothing in quiet hours or during tests; the practice nudge is cancelled once the goal is met; shared images contain no one else's data.
