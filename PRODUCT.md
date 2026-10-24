# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

Android and iPhone matter equally; each should feel at home on its own platform. A web build exists (Expo static output) but is not a priority.

## Users

Teachers and coaching institutes teaching Class 9–12 Physics, Chemistry, Mathematics, Biology and Science (Foundation for 9th–10th, JEE/NEET for 11th–12th). Their job in the app: create classrooms, manage the students in each classroom, run tests for them, and analyse how those tests went.

Students reach the app only through what a teacher shares (a room code). Whether students take tests inside this same app or elsewhere is undecided.

## Product Purpose

Gives a teacher a ready, topic-organised bank of Class 9–12 PCMB questions with solutions, so they can set a test for a classroom in minutes and then see how each student did. Success: a teacher opens the app, gets to their classroom's next step at once, and understands their students' results without assembling them by hand.

## Positioning

The bank is already loaded and organised the way a teacher plans: class → subject → chapter → topic, with each question's level and the past exams it appeared in (e.g. "WBJEE 2016", "AIPMT 2003"). A test is built from that bank rather than typed in.

## Operating Context

- Classes and tracks: 9th and 10th (Foundation: Science, Mathematics), 11th and 12th (JEE/NEET: Physics, Chemistry, Mathematics, Biology).
- Tests run in exam rooms identified by a short room code (e.g. NEET-7842) that the teacher shares through the phone's share sheet.
- Printable question papers come out of the PDF builder.
- Content is served by the Papers backend (Next.js API at papers-jet.vercel.app, MongoDB database `pcmb`), also managed through the Papers website and the class-admin app.

## Capabilities and Constraints

- Built today: Questions tab (filter by track, class, subject, chapter, topic, level, search); Papers & Exams tab (browse papers; create, edit, share and delete exam rooms); PDF builder; Profile (name, grade, track, subjects; not saved); side drawer with Academy and Manage entries, most of which have no screen yet; light and dark themes.
- Backend data that exists: papers, questions, students (name, email, target exam JEE/NEET, joined date) and attempts (one student × one paper: score, correct, wrong, skipped, time taken, the answer given to each question), plus overall counts at `/api/dashboard`.
- Not built yet (open product decisions): a classroom that groups students and tests; saving exam rooms to the backend (they are local demo data today); linking students and attempts to a room; teacher sign-in.
- The app should remember on the device the teacher's classes and subjects and what they last opened, so home opens on their own work.
- Stack: Expo SDK 57, Expo Router, React Native 0.86, a swipeable four-tab pager (Home, Questions, Papers, Profile).

## Brand Commitments

- Name: "PCMB Practice" (store name in app.json); share text and the drawer say "PCMB Paper".
- The home redesign keeps the app's current look (warm cream background, terracotta accent, the existing tab bar) so home matches Questions, Papers and Profile. Only home's structure and content change.

## Evidence on Hand

- Question bank, as loaded on 2026-10-23: 256,684 questions across 1,345 topics. 9th: 11,797 · 10th: 23,025 · 11th: 115,119 · 12th: 106,743. 232,662 multiple-choice, 24,022 descriptive.
- No real classrooms, students or test results exist yet; the two exam rooms in the app are demo data. Product screens must not show invented students, scores or counts.

## Product Principles

1. The classroom is the unit: a teacher's students, tests and results all belong to a classroom.
2. Next step over overview: opening the app should lead straight to what the teacher does next with a classroom, not to totals.
3. Real numbers only: show counts and results the data actually holds; empty is honest, invented is not.
4. Teachers are short of time: every common action is one or two taps from where they land.
