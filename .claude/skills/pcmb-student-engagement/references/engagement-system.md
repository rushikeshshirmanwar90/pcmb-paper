# The engagement system: loop, XP, goals, streaks, levels, badges, league

One coherent economy that rewards **learning actions**, paces itself over the two-year 11th–12th journey, and can't be farmed. All numbers live in **one config file on the server** (`lib/engagement/config.ts`) so they can be tuned without touching logic. The app only displays what the server returns.

## 1. The core loop

```
 Cue (gentle nudge at the student's time / teacher shout-out / today's 5 ready)
   → Start in 1 tap (Daily challenge: 5 questions, ~6 min)
     → Quick feedback (correct pop · explanation · mistake saved for revision)
       → Visible reward (XP, goal ring fills, streak +1, mastery bar grows)
         → Investment (mistakes queued for spaced revision, roadmap shows the next chapter, squad goal moves)
           → tomorrow's cue is personal (due revisions + weak topics + today's class topic)
```

Weekly loop: Monday recap → league resets → teacher's weekly batch challenge → squad goal → Sunday "league ends tonight" (only if they're in reach of a better rank).

Long loop (months): levels, chapter mastery, expected marks rising, roadmap milestones ("11th Physics mastered"), and the countdown to the exam.

## 2. XP: earned only by learning actions (server-side, idempotent)

| Event (source) | XP | Rules |
|---|---|---|
| Practice answer, **first try ever**, correct | 10 × difficulty (Easy 1, Medium 1.5, Hard 2) | from `POST /api/pyq/answer`; only the first answer to a question counts |
| Practice answer, first try, wrong | 2 | effort credit; the question goes to Mistakes |
| A previously wrong question now correct (revision) | 15 | once per question per day; this is "fixing a mistake" |
| Re-answering an already-correct question | 0 | no farming |
| Daily challenge completed | +40, +20 more for 5/5 | once per IST day |
| Self-assessment submitted | 3 per attempted question (max 120) | skipped questions earn nothing |
| Assigned test submitted | +80 participation | **never based on marks**; only once the attempt is submitted |
| Personal best on a test (after results are released) | +50 | the % beats their average of the previous 3 released tests |
| Revision item cleared (graduates from box 5) | +20 | |
| Duel finished | +25 each, +15 to the winner | max 3 duels a day earn XP |
| Batch challenge completed (teacher) | the challenge's reward (default 100) | to students who contributed |
| Badge earned | 0 | badges are recognition, not XP pumps |

**Anti-gaming (all enforced on the server):**
- **Daily cap:** practice-answer XP stops at **400/day** (≈ 30–40 good questions); other sources still count. The cap message is friendly: "Max practice XP for today. Anything more is pure skill 💪".
- **Speed-tap guard:** answers arriving < 4 s after the previous one, more than 3 in a row → 0 XP for those answers (still marked and saved). Never punish; just don't reward.
- **Late-night guard:** answers between 00:00 and 05:00 IST earn XP but don't count towards the league (no midnight grinding race).
- **Idempotency:** every award has a unique `key` (e.g. `practice:<studentId>:<questionId>:first`). Replays, retries and double taps award once.
- **Server authority:** the client never sends XP amounts, only learning actions the server already validates.

## 3. Daily goal

The student picks a goal (changeable anytime; a change applies from the next day):

| Goal | XP/day | Feels like |
|---|---|---|
| Chill | 50 | the daily challenge alone |
| Regular (default) | 100 | daily challenge + ~6 questions |
| Serious | 200 | ~20 minutes of practice |
| Beast | 300 | ~35 minutes |

The home shows a **goal ring** filling in real time. When it completes: one celebration (motion budget), and the day counts for the streak.

## 4. Streak

- **A streak day** = the daily goal is met by IST midnight, **or** an assigned test was submitted that day (exam-day protection).
- **Freezes:** earn 1 for every 7 consecutive days, hold at most 2. A missed day automatically uses one ("Freeze used, streak safe ❄️").
- **Repair:** if the streak broke yesterday, today it can be repaired by reaching **2× the daily goal**, once per 30 days.
- **Milestones:** 3, 7, 14, 30, 50, 100, 200, 365 days → a badge and a small celebration.
- **Display:** a flame with the count. It animates only when the day is secured, never pulses as a warning.
- The **longest streak** is kept forever, so a broken streak never erases achievement.

## 5. Levels (two-year pacing)

Total XP to reach level L: **50 × L × (L − 1)**. At a typical ~150 XP/day:

| Level | Total XP | ≈ days | Title |
|---|---|---|---|
| 1 | 0 | 0 | Atom ⚛️ (L1–4) |
| 5 | 1,000 | 7 | Molecule 🧪 (L5–9) |
| 10 | 4,500 | 30 | Compound ⚗️ (L10–14) |
| 15 | 10,500 | 70 | Catalyst 🔥 (L15–19) |
| 20 | 19,000 | ~4 months | Reactor ⚡ (L20–24) |
| 25 | 30,000 | ~7 months | Quantum 🌀 (L25–29) |
| 30 | 43,500 | ~10 months | Nova ✨ (L30–39) |
| 40 | 78,000 | ~17 months | Supernova 🌟 (L40+) |

Each new **title** unlocks a cosmetic: a profile frame, an accent color for their profile card, or a roadmap path theme. **Cosmetics only:** nothing that affects learning, and nothing purchasable.

## 6. Badges (recognition for meaningful milestones)

| Badge | Criteria | Tier |
|---|---|---|
| First Steps | first 10 practice questions | common |
| Century | 100 / 500 / 1,000 / 5,000 questions answered | bronze/silver/gold/legend |
| Mistake Hunter | 10 / 50 / 200 mistakes fixed | bronze/silver/gold |
| Comeback | a topic went from weak (< 40%) to strong (≥ 70%) | silver |
| Chapter Master | first chapter mastered; then 5, 15, all of a subject | bronze → legend |
| PYQ Explorer | answered PYQs from 5 different exam years | silver |
| All-Rounder | practised every one of their subjects in the same week | bronze |
| Streak 7 / 30 / 100 / 365 | streak milestones | bronze → legend |
| Perfect Five | 5/5 on the daily challenge (×1, ×10, ×50) | bronze → gold |
| Early Bird | 10 goal days completed before 9 AM | bronze |
| Duelist | 10 duels finished (win or lose) | bronze |
| Squad Goals | the squad hit its weekly goal 4 times | silver |
| Teacher's Shout-out | received a shout-out | special |
| Personal Best | beat their own test average | silver |

Rules: badges are shown upfront with their criteria (no secrets), progress toward each badge is visible, and **no badge rewards late-night study, raw time-in-app or marks rank**.

## 7. Weekly batch league (effort-based)

- **Members:** students in the same batch who haven't hidden themselves (`league.hidden`). Hidden students still see their own rank privately.
- **Score:** XP earned Monday 00:00 → Sunday 23:59 IST, excluding late-night (00:00–05:00) XP.
- **Board:** top 10 + "you" (with your rank). Never show the bottom of the board. Ties go to whoever reached the score first.
- **Minimum size:** shown only when ≥ 4 visible members (otherwise "League starts when 4 batchmates join").
- **Reset:** no job needed. The week key (`2026-W46`, IST) is part of each ledger entry, so a new week is simply a new key.
- **Monday result card:** "Last week: #4 of 23 · 640 XP (+120 vs your previous week)". Top 3 get a small league badge.
- **No promotion/relegation tiers** in v1 (it adds pressure). Revisit with data.

## 8. Mastery (the learning truth behind everything)

Per topic, from PracticeAnswer + self-assessment + released test answers, recomputed on write or nightly:

| State | Rule (tunable) |
|---|---|
| Not started | 0 answers |
| Learning | < 5 answers, or accuracy < 40% |
| Practising | 40–74% accuracy, or < 10 answers |
| **Mastered** | ≥ 75% over ≥ 10 answers, including ≥ 3 Medium/Hard, last answer within 45 days |
| Fading | was mastered, but nothing answered in the last 45 days → revision suggested |

Chapter mastery = average over its topics (mastered 1 · practising 0.6 · learning 0.3 · fading 0.7 · not started 0). Reuse `lib/topic-stats.ts` for accuracy and extend it; don't build a second statistic.

## 9. Balancing checklist (run before shipping any change to numbers)

- [ ] A "Regular" student (daily challenge + 6 questions) reaches Level 5 in about a week and Level 10 in about a month.
- [ ] A spammer (fast random tapping) earns ≤ 2 XP per question and hits the speed guard. Their league score stays below an honest Regular student's.
- [ ] A student who only takes assigned tests and practises 3 days a week still keeps a streak with freezes about 80% of the time.
- [ ] Nothing gives more XP for a high *mark* than for honest participation, except the personal-best bonus.
- [ ] Simulate 30 days for the three personas (student-psychology.md) and check that league spreads aren't extreme (#1 ≤ ~3× the median).
