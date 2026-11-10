---
name: pcmb-student-engagement
description: Project skill for the PCMB app (Expo app pcmb-paper + Next.js/MongoDB backend papers). It builds the student experience that keeps 11th–12th JEE/NEET/CET students (16–20, Gen Z) practising daily and scoring more: student psychology, gamification (XP, goals, streaks, levels, badges, a batch league), Today's 5, a mistakes notebook, a learning roadmap, teacher challenges, duels, squads, nudges and recaps. It owns secure tests (layered anti-cheating and the teacher's power to let a paused or blocked student back in), Guideway in-app guides, a four-level test plan with security tested in every combination, and the bundled design guides neobrutalism-expo, app-interactions and human-friendly-ux. It reads code only when the user asks. Use it for any student feature, redesign, structure, look, animation, loading state, gamification, notification, test-security, testing or teacher test-control work in this app.
---

# PCMB student engagement + secure tests

This skill makes the PCMB app's student login something students **want to open every day, because it makes them better at PCMB**, and makes its tests **as hard to cheat in as a phone allows, while staying fair**. It is specific to this app and its backend. Every feature uses real data: practice answers, tests, syllabus coverage, chapter weightage.

**Guiding ideas.** Engaging, never manipulative: usage is a means, marks are the goal. Secure, never accusatory: the server pauses, a teacher decides. Many users are minors, so every screen and notification must be one a parent and a teacher would be glad to see. The ethics rules in student-psychology.md are non-negotiable.

## Decisions already made by the product owner
- **Code access:** Claude reads the code **only when the user says so**. Otherwise it works from the saved map (discover.md).
- **Leaderboard:** weekly, **batch-only, effort-based (XP)**. It resets every week, shows the top 10 + you, can be hidden, and never shows marks.
- **Teachers:** see engagement **and** run batch challenges and shout-outs.
- **Features (v1):**
  - streaks, XP, levels, badges
  - Today's 5 + mistakes revision
  - mastery, expected marks, exam countdown
  - **learning roadmap** ("what I've done and what's next")
  - duels and study squads
- **Notifications:** **gentle**. At most 1 practice nudge a day at the student's chosen time, quiet 10 PM–7 AM, none during tests.
- **Tests:** **the most secure we can make them.** Every layer in secure-tests.md, with a level the teacher picks per test (Standard / Strict / Proctored). **Whenever a student is paused or blocked, the test's teacher (or the tuition owner) can let them back in**, with a reason and an audit trail.
- **Order: foundation → redesign → features → secure tests → full testing.** Phase 0 (foundations) is done. **Phase 1 is the redesign:**
  - neobrutalism for the student login only (neobrutalism-expo scoped-adoption); teacher and tuition keep their look
  - the interactions and structure pass for all three logins
  - the Guideway guide system

  From Phase 2, every new student screen is built **directly in neobrutalism**, and every new feature ships with its **Guideway** guide.
- **Guides:** Guideway is the app's own in-app guide system (spotlight + step cards), not a third-party package. Guides are short, contextual and skippable, can be replayed from Help & guides, and never appear in tests.

## Reference files

| File | Read before… |
|---|---|
| `references/discover.md` | **anything**: the code-access rules, the saved map, conventions, hook points |
| `references/student-psychology.md` | designing any screen, copy, notification or reward (ethics rules, personas, voice) |
| `references/engagement-system.md` | anything involving XP, goals, streaks, levels, badges, league or mastery (numbers and anti-gaming) |
| `references/features.md` | building a feature: F1 progress core · F2 Today's 5 · F3 mistakes · F4 roadmap · F5 outlook · F6 badges · F7 league · F8 teacher tools · F9 duels · F10 squads · F11 nudges + recap |
| `references/backend.md` | changing the `papers` repo for engagement: models, the award engine, route hooks, APIs, pushes, tests |
| `references/app-experience.md` | changing the app: IA, client architecture, screen compositions, motion graphics, teacher screens |
| `references/secure-tests.md` | **anything in the test flow**: what exists, threat model, levels, violation policy, teacher re-admit, student copy, consent |
| `references/secure-tests-build.md` | building secure tests: steps S1–S7, data, policy code, routes, binding, shuffles, integrity, native module, tests, cheat drills |
| `references/guideway.md` | building or changing any guide, and **every new feature** (each ships with its guide): principles, architecture, registry, placement, catalogue per phase |
| `references/testing.md` | **writing or running any test**: the four levels (unit → integration → system → UAT), the security matrices M1–M13 and how to cover every combination, exit criteria, defects |
| `references/metrics.md` | measuring retention and learning, guardrails, experiments |
| `scripts/map-app.mjs` | **only when the user asks** to map, scan or refresh (discover.md §3) |

**Bundled design guides** (part of this skill, in `design/`; read the GUIDE.md before using one):

| Guide | Owns | Start with |
|---|---|---|
| `design/neobrutalism-expo/` | the student **look**: presets, tokens, components, patterns, graphics, scoped adoption (`audit.sh --leaks`), art export | `design/neobrutalism-expo/GUIDE.md` |
| `design/app-interactions/` | **behaviour** in every role: motion budget, haptics, states, async buttons, skeletons, toasts, offline, responsive | `design/app-interactions/GUIDE.md` |
| `design/human-friendly-ux/` | **structure**: behaviour principles, restructure playbook, Expo Router recipes, `structure-audit.mjs` | `design/human-friendly-ux/GUIDE.md` |

Paths inside each guide (`references/…`, `scripts/…`) are relative to that guide's folder. Whenever this skill or its references name one of these three, use the bundled copy, even if a user-level copy exists.

User-level skills still used: **canvas-design** (artwork), **apple-design** (motion feel).

## Rules
1. **Read code only when asked.** Plan from the saved map. Open only the files named in the approved plan, ask before opening anything else, and never run the mapper or browse folders unless the user says so (discover.md §1).
2. **The server is the source of truth.** XP, streaks, levels, badges and the league are computed only in `papers` (`lib/engagement/*`, through one `award()` engine). Exam clocks, strikes, pauses and decisions live only in `lib/exam-*` / `lib/attempt*`. The app displays and reports; it never decides.
3. **Additive and safe.** Existing routes keep their responses (new fields only). Gamification failures never break answering, submitting or tests (`safeAward`). There's a per-tuition on/off flag. Tests created before a change keep their old rules.
4. **Tests are sacred and secure.**
   - No engagement UI in any test screen.
   - Never weaken an existing exam protection.
   - Pause, don't punish: only a teacher resumes, ends or voids an attempt.
   - Test XP is participation-only, after the attempt finishes; marks-based rewards come only after release, as a personal best.
5. **Learning actions earn rewards.** Time in the app, opens and speed-tapping don't. Caps, the speed guard and the late-night guard apply (engagement-system.md §2).
6. **Privacy.** Peers see name, level, weekly XP and badges, never marks, accuracy or exam flags. No free-text messaging between students. No audio or face recognition; the camera only in Proctored with parental consent.
7. **Gentle by default.** Quiet hours, the 1/day budgets, forgiving streaks, and opt-outs for the league, duels and notifications.
8. **Honest numbers.** No invented data; estimates are labelled as estimates; no countdown without a real exam date. Exam flags are "worth a look", never verdicts.
9. **Every surface has every state:** empty, loading (skeleton), error, offline, and the "engagement off" fallback.
10. **Verify like a student.** Run each change past the three personas (Aarav, Sneha, Rohit). For test changes, also run the cheat drills (secure-tests-build.md §11).
11. **Test in levels, security in every combination.** Unit, then integration, in every phase; system and UAT in Phase 9 (testing.md). Security rules and routes are tested with the full matrices (exhaustive, pairwise + full risky groups, property-based or model-based), against an independent oracle. Every bug gets a failing test first.
12. **Every feature teaches itself.** From Phase 2, a feature isn't done until its Guideway guide is in the registry, wired to real targets and tested (guideway.md §5).

## Workflow

For each phase or step: **plan from the saved map** (show the user screens, API, data, risks and the files you'll open) → **wait for the go-ahead** → backend (models, engine, routes, tests) → app (API client, state, screens) → teacher side → verify → commit.
- Backend checks: `npm test` in papers.
- App checks: `npx tsc --noEmit` and `npx expo lint` in pcmb-paper.

**Phases, in order** (each ships on its own):

| Phase | Ships | Features |
|---|---|---|
| 0. Foundations ✓ | `lib/engagement` config/time/award/streak, ledger + profile + daily models, hooks in pyq/answer, self-assessment submit and test finish, `GET /engagement/me`, the progress header | F1 (no UI celebrations yet) |
| 1. Redesign + Guideway | **structure redesign first** (human-friendly-ux: jobs, frequency and behaviour principles per role → new information architecture with homes for every planned feature → approved by the user → implemented); then the neobrutalism student scope (neobrutalism-expo steps 0–9) and every student screen restyled, including the Phase 0 header; the app-interactions + human-friendly-ux pass over all three logins (states, skeletons, async buttons, responsive, page structure); Guideway engine + Help & guides + the first guides; one native build with fonts, expo-haptics, react-native-svg and react-native-view-shot | look and feel, guideway.md |
| 2. Daily habit | Today's 5, mistakes notebook + spaced revision, goal settings, XP toasts, goal ring and streak celebrations, local practice nudge, and their guides | F2, F3, F11 (nudge) |
| 3. Direction | Roadmap tab (path, You-are-here, Next 3, milestones), mastery states, expected marks + exam countdown (tuition exam dates), and their guides | F4, F5 |
| 4. Recognition | levels + titles + cosmetics, badges shelf + unlock moments, generated badge/level art, and their guides | F1 (levels UI), F6 |
| 5. Social | weekly batch league, teacher engagement view, batch challenges, shout-outs, and their guides | F7, F8 |
| 6. Friends | duels, study squads, event notifications, and their guides | F9, F10, F11 (events) |
| 7. Ritual | weekly recap story + share, celebration polish, metrics dashboards, first experiments | F11 (recap), metrics |
| 8. Secure tests | steps S1–S6 in order (S7 Proctored only if the tuition wants it), the ready-check and teacher guides, then the full cheat drills on real phones | secure-tests.md, secure-tests-build.md |
| 9. Full testing | the four levels in order across the whole app: complete unit run → complete integration run (every security matrix) → system testing on real phones + staging (incl. cheat drills, load, accessibility, guides) → UAT in a pilot tuition → staged rollout | testing.md |

Phase 8 steps (details in secure-tests-build.md §0):

| Step | Ships |
|---|---|
| S1 Fairness | keep-awake, pause reasons, "Ask my teacher", teacher sheet v2, bulk resume, pushes |
| S2 Content | question + option shuffle, watermark, in-app keypad, (S2b) parallel sets |
| S3 Binding | tracking mandatory, device binding + attempt token, protocol gate, installed app only, levels + policy |
| S4 Detection | screenshots, recording/casting/mirroring/displays, accessibility, USB debugging, DND |
| S5 Lockdown + integrity | Android pinning, iOS assessment mode / Guided Access, Play Integrity / App Attest, ready check, pre-start overrides |
| S6 Review | integrity report, similar answers, void / retake, exam audit |
| S7 Proctored | only if the tuition wants it, with consent |

S1 is small and fixes unfair pauses that happen today. The user may pull it forward to any point; do that only when asked.

**Phase 1 rules.**
- **Structure before style.** Redesign the information architecture of all three logins first; restyle after the user approves the new structure. Base it on human behaviour (human-friendly-ux behavior-principles.md):
  - **Jobs and frequency:** list each role's top jobs and how often they happen (daily, weekly, rarely). The daily ones go one tap from Home, the rare ones live in Profile or More.
  - **Home answers "what should I do now?":** one primary action at the top. Next up, then today's work, then progress; announcements and history come later.
  - **Fewer choices per screen** (Hick's law): one job per screen, at most 5 tabs, at most about 6 blocks visible on Home, details behind taps (progressive disclosure).
  - **Recognition over recall:** clear labels in students' and teachers' own words, status visible on cards (due, done, new), no hidden gestures for important actions.
  - **Thumb reach** (Fitts's law): primary actions in the bottom half and large; destructive actions away from primary ones.
  - **Good defaults and few steps:** pre-filled forms, the last-used subject or batch remembered, sensible defaults for teachers creating tests.
  - **Momentum and closure:** show progress ("3 of 5"), finish flows on a clear end state, resume where people left off (Zeigarnik), and end sessions on a good note (peak-end).
  - **Calm under stress:** test flows stay linear with no distractions; errors explain what to do next.
- **The behaviour lens applies to every part of Phase 1,** not only the structure plan. That covers building screens, the look, the restyle and the guides. Every screen must pass this check before it's done:
  1. **One clear primary action**, visually the strongest thing on the screen (Von Restorff), in thumb reach.
  2. **At most 3–5 choices** in view; everything else behind a tap (Hick, progressive disclosure, chunking: groups of 3–5).
  3. **Status visible without remembering:** due / done / new / locked on the card itself (recognition over recall).
  4. **Order by importance:** the most important first, the second most important last on long lists (serial position).
  5. **Feedback within 100 ms** for every tap (press state, haptic where it matters); progress for anything over 1 s.
  6. **A clear end state:** every flow finishes on "done" with the next step offered (goal-gradient, peak-end), and unfinished work is offered back ("Continue where you left off", Zeigarnik).
  7. **Defaults that do the right thing** for most people (last subject or batch remembered, sensible test settings).
  8. **Labels in users' words** (PYQ, chapter, mock, backlog for students; batch, attendance, release results for teachers), never internal terms.
  9. **Calm under stress:** test and result screens have no distractions, no red alarm states, and errors say what to do next.
  10. **Gen Z students and busy teachers:** short sessions (sub-10-minute loops), scannable cards, no walls of text. Teachers get the fewest steps for frequent jobs.
- **Validate with people, not only with checklists.** Before the restyle is final, run quick tests:
  - a **5-second test** (show Home for 5 s; can they say what to do next?)
  - a **first-click test** (where would you tap to start practice, see results, re-admit a student?)
  - walk the three personas (Aarav, Sneha, Rohit) and one teacher through the main flows

  If real students or teachers are available, use 3–5 of each; otherwise do the persona walkthroughs and report them. Fix what fails before moving on.
- **Plan for the future features.** The new structure must already have homes for Phases 2–8 (app-experience.md §1): Home = "Today", Syllabus → Roadmap, Practice = practice hub, Profile = "You", the teacher's batch Engagement view and test monitor. Empty slots stay hidden until their feature ships.
- **Show before building.** Present per role: the jobs/frequency table, the current vs. proposed tab and screen map, what moves where and why (the behaviour principle behind each move), and simple wireframes of the main screens. Implement only after the user approves.
- **Don't break people's habits needlessly.** Keep labels and locations people rely on unless the move clearly helps. Never change what any API returns.
- Restyle through the kit switch (scoped-adoption.md), not screen by screen, and run `audit.sh --leaks` on teacher and tuition screens.
- Exam screens get the new look but stay calm (secure-tests.md §6), with no engagement UI.
- Restructure crowded pages with human-friendly-ux, but don't change what any API returns.
- Put the native packages that later phases need into this phase's single build, to avoid extra store releases.

Before starting, confirm with the user:
- the backend path (start Claude Code with `--add-dir` if it's a sibling repo)
- any exam dates to preset
- whether they want the map refreshed first; refresh only if they say yes

## Definition of done (per feature or step)
- [ ] Unit and integration tests cover everything the phase built, including the security matrices (testing.md §3) for every rule and route it touched; the inventory guards pass; the existing suites stay green.
- [ ] New student screens pass the neobrutalism-expo checklist (from Phase 1). Every new screen has every state (app-interactions) and passes the human-friendly-ux screen checklist.
- [ ] From Phase 2: the feature's Guideway guide is done (guideway.md §5).
- [ ] Any teacher screen uses the classic kit with no neo leak (`audit.sh … --leaks`).
- [ ] It works offline or degraded, with the feature flag off, at max font size, on a 320px phone, and with Reduce Motion on.
- [ ] Copy follows the voice guide: no shame, fake urgency or gambling mechanics, and never "cheating detected".
- [ ] Metrics events exist for the feature's success and guardrail metrics.
- [ ] Test changes pass the cheat drills on the device matrix.
- [ ] If the user asked for a map refresh, `docs/app-map.md` is saved. When a phase ships, offer to update `PRODUCT.md`.

## Anti-patterns (reject)
- Scanning, grepping or opening files the user didn't approve; running the mapper unprompted.
- Computing XP, streaks, strikes or pauses on the device; trusting client-sent XP or exam state; awarding XP outside `award()`.
- Rewards for marks rank, opens or time spent; leaderboards showing marks, bottom ranks or other batches.
- Loot boxes, spins, mystery rewards, paid currency, pay-to-skip.
- Guilt copy, crying mascots, red "streak dying" warnings, notifications in quiet hours or during tests, more than 1 nudge a day.
- Any engagement UI in a test screen; test-question revision before results release.
- Weakening exam security for convenience: optional tracking, client-decided pauses, auto-resume without a teacher, a TextInput in the runner.
- Automatic cheating verdicts or public penalties; audio recording, face recognition, or a camera without parental consent.
- Free-text chat between students; duels or squads across batches.
- Locking roadmap chapters; showing a countdown with a guessed exam date.
- Breaking or reshaping existing API responses; forking screens per role instead of using the scoped kit.
- Testing security with a few hand-picked cases instead of the matrices; a route without authorization rows; expected results computed by the code under test.
- Building new student screens in the old look after Phase 1; hard-coded styles instead of design tokens.
- Long first-launch tours, guides that can't be skipped, guides during tests, or a feature shipped without its guide.
