# PCMB app map (generated 2026-11-11 18:58 UTC)
App: `/Users/chinmayshrimanwar/Desktop/pamu dada/devne/pcmb-paper`  ·  Backend: `/Users/chinmayshrimanwar/Desktop/pamu dada/devne/papers`

## App stack

- expo ^58.0.0 · react-native 0.88.1
- relevant packages: expo-font, expo-image, expo-image-picker, expo-notifications, expo-secure-store, expo-sharing, react-native-gesture-handler, react-native-pager-view, react-native-reanimated
- missing (install with `npx expo install` if a feature needs them): expo-haptics, react-native-svg, react-native-view-shot

## Roles and tabs

Source: `src/navigation/role-tabs.tsx`
- **TEACHER_TABS**: Home (TeacherHomeScreen) · Batches (TeacherBatchesScreen) · Tests (TeacherTestsScreen) · Papers (QuestionsScreen) · PROFILE_TAB (TeacherProfileScreen)
- **TUITION_TABS**: Home (TuitionHomeScreen) · Batches (TuitionBatchesScreen) · People (TuitionPeopleScreen) · Tests (TuitionTestsScreen) · PROFILE_TAB (TuitionProfileScreen)
- **STUDENT_TABS**: Home (StudentHomeScreen) · Tests (StudentTestsScreen) · Syllabus (StudentRoadmapScreen) · Practice (StudentPracticeScreen) · PROFILE_TAB (StudentProfileScreen)

## Student screens

- `src/screens/student/answer-saver.ts` (166 lines): Sends changed answers to the server; rejects when that fails.
- `src/screens/student/answer-sync.ts` (25 lines): Legacy drafts may only fill an untouched question. Versioned drafts must match exactly; a newer server answer wins even when the phone was offline.
- `src/screens/student/assessment-session.tsx` (1232 lines): Keeps a column readable on tablets: content stays phone-width, centred.
- `src/screens/student/attempt-draft.ts` (53 lines): Identifies the attempt: a draft from an earlier attempt is ignored.
- `src/screens/student/attempt-status.ts` (11 lines): Reject responses from another attempt or older control generations. Answer reconciliation separately preserves edits based on current versions.
- `src/screens/student/exam-app-state.ts` (28 lines): AppState follows the foreground Activity. Window blur, route changes and lack of touches do not prove that the application entered the background.
- `src/screens/student/exam-guard.ts` (141 lines): How long the app may be away before the attempt ends. The server owns this rule (AWAY_LIMIT_MS in papers/src/lib/attempts.ts) and does the ending; the app only uses it to lock the screen while it waits for the server's w
- `src/screens/student/exam-sections.ts` (54 lines): Places in the questions array, in the order the server sent them.
- `src/screens/student/exam-security.ts` (59 lines): Whether this build has the Android calls (a development or release build; false in Expo Go).
- `src/screens/student/exam-visibility.ts` (110 lines): Run before loading the examination: a killed process cannot erase its persisted hidden interval by opening the same attempt again.
- `src/screens/student/home-next-up.ts` (58 lines): Days from today: 0 today … 7 the same weekday next week.
- `src/screens/student/practice-session.ts` (75 lines): Whole-percent accuracy of answered questions; null when nothing was answered.
- `src/screens/student/practice/continue-card.tsx` (113 lines): "Continue where you left off" (Zeigarnik): one card, the most useful unfinished thing. An unfinished self-assessment comes first (its clock may be running); otherwise the topic practised last, while it still has question
- `src/screens/student/practice/practice-links.ts` (25 lines): Remembered on this phone per student, so Continue works after the app restarts.
- `src/screens/student/practice/practice-parts.tsx` (446 lines): For programs without a question bank: say so plainly, never show another program's questions.
- `src/screens/student/practice/practice-place.ts` (48 lines): The `topic` query value for "every question of the chapter".
- `src/screens/student/practice/practice-screens.tsx` (166 lines): The subject's practice tree, shared by every practice screen of that subject.
- `src/screens/student/progress-header.tsx` (194 lines): A progress ring from plain Views (no SVG needed): two half-windows, each showing a half ring rotated into view. `fill` is 0–1.
- `src/screens/student/question-options.ts` (37 lines): Which option rows a multiple-choice question shows. Display only: answering, saving and marking are unchanged. Every option up to the last one that has text or a figure is shown, so a gap in the data (A and C filled, B e
- `src/screens/student/question-view.tsx` (204 lines): A question to answer or review: its text and figures, then options to tap (or a box for a numerical answer). With `reveal`, the right answer is marked and the solution shown. Marks are never shown by colour alone: a sele
- `src/screens/student/self-assessment-flow.tsx` (773 lines): Self-assessment, full screen over the Practice tab: the student's past self-assessments, making a new one (chapters, topics, size, difficulty mix, time), taking it and the topic-by-topic result.
- `src/screens/student/self-assessment.ts` (293 lines): The fewest questions a self-assessment can have (the server checks the same).
- `src/screens/student/student-home.tsx` (540 lines): The time now, refreshed every minute, so today's classes move from next to on now to done.
- `src/screens/student/student-practice.tsx` (351 lines): The tab's key in role-tabs.
- `src/screens/student/student-profile.tsx` (237 lines): The student's profile: who they are, what and where they study, settings for this phone (appearance, class reminders), and their account.
- `src/screens/student/student-roadmap.tsx` (235 lines): From this text size up, a subject's coverage bar goes under its name instead of beside it.
- `src/screens/student/student-tests.tsx` (281 lines): The time now, refreshed every `everyMs`, so labels like "closes in 3 h" and each test's status stay true.
- `src/screens/student/test-access.tsx` (58 lines): Shared by the visible restricted-test row and its detail view. Never starts an attempt.
- `src/screens/student/test-format.ts` (135 lines): The test's status at `now`, the same rule as the server's, so a list stays right while it's open.
- `src/screens/student/test-runner.tsx` (1358 lines): Screenshots and screen recording are blocked while a test is being taken, and only then. Android's Modal copies the window's secure flag when it is created, so the Modal is only drawn once the flag is on (or off again, f
- `src/screens/student/topic-practice-sheet.tsx` (586 lines): A checked answer, as the server marked and saved it.
- `src/screens/student/topic-practice.ts` (220 lines): Which of a node's questions to load.
- `src/screens/student/use-exam-visibility.ts` (47 lines): The controller keeps generations and callback refs current without a remount. eslint-disable-next-line react-hooks/exhaustive-deps

## Shared screens (rendered for several roles)

- `src/screens/shared/announcements.tsx` used by: student, teacher, tuition
- `src/screens/shared/batch-analysis.tsx` used by: teacher, tuition
- `src/screens/shared/notification-bell.tsx` used by: tuition
- `src/screens/shared/result-format.ts` used by: shared, student, teacher
- `src/screens/shared/syllabus-progress.tsx` used by: teacher
- `src/screens/shared/timetable.tsx` used by: student, teacher
- `src/screens/shared/topic-performance.tsx` used by: student, teacher

## Routes (Expo Router, src/app)

`_layout.tsx` · `batch/[batchId]/assign-teacher.tsx` · `batch/[batchId]/index.tsx` · `batch/[batchId]/invitations.tsx` · `batch/[batchId]/schedule/[entryId].tsx` · `batch/[batchId]/schedule/index.tsx` · `batch/[batchId]/schedule/new.tsx` · `batch/[batchId]/settings.tsx` · `batch/[batchId]/students.tsx` · `batch/[batchId]/teachers.tsx` · `batch/new.tsx` · `create-test/_layout.tsx` · `create-test/index.tsx` · `create-test/setup.tsx` · `dev/question-preview.tsx` · `explore.tsx` · `index.tsx` · `practice/[subject]/[chapter].tsx` · `practice/[subject]/index.tsx` · `profile.tsx` · `questions.tsx` · `student/[studentId]/batch.tsx` · `student/[studentId]/edit.tsx` · `student/[studentId]/index.tsx` · `student/new.tsx` · `teach/[batchId].tsx` · `teacher/[teacherId]/edit.tsx` · `teacher/[teacherId]/index.tsx` · `test/[testId].tsx` · `timetable.tsx`

## UI kit exports

`src/components/kit.tsx`: usePalette, Icon, Screen, Card, SectionTitle, Muted, StatTile, StatGrid, ListRow, Badge, ProgressBar, LoadingView, ErrorView, EmptyView, ErrorText, Field, PasswordField, Button, Chips, MultiChips, Segmented, Notice, FormSheet, DetailSheet, DetailRow, useLoad, CodeInput
- design scope branching in kit: no (single look)

## Student API client

- `src/services/api-client.ts`: (no literal endpoints)
- `src/services/school-api.ts`: (no literal endpoints)
- `src/services/student-api.ts`: (no literal endpoints)

## Engagement features already in the app (search hits)

`src/app/_layout.tsx`, `src/app/explore.tsx`, `src/app/profile.tsx`, `src/app/questions.tsx`, `src/components/account-section.tsx`, `src/components/explanation.tsx`, `src/components/kit.tsx`, `src/components/my-pdfs-screen.tsx`, `src/components/web-badge.tsx`, `src/engagement/engagement-store.ts`, `src/engagement/progress-format.ts`, `src/screens/shared/announcements.tsx`, `src/screens/shared/batch-analysis.tsx`, `src/screens/shared/notification-bell.tsx`, `src/screens/shared/topic-performance.tsx`, `src/screens/student/assessment-session.tsx`, `src/screens/student/attempt-status.ts`, `src/screens/student/practice/practice-parts.tsx`, `src/screens/student/progress-header.tsx`, `src/screens/student/self-assessment-flow.tsx`, `src/screens/student/student-home.tsx`, `src/screens/student/student-profile.tsx`, `src/screens/student/student-roadmap.tsx`, `src/screens/student/student-tests.tsx`, `src/screens/student/test-runner.tsx`, `src/screens/student/topic-practice-sheet.tsx`, `src/screens/teacher/student-insight.tsx`, `src/screens/teacher/student-performance-sheet.tsx`, `src/screens/teacher/teach-batch-screen.tsx`, `src/screens/teacher/teacher-profile.tsx`, `src/screens/teacher/teacher-tests.tsx`, `src/screens/teacher/teacher-timetable.tsx`, `src/screens/teacher/test-management-screen.tsx`, `src/screens/teacher/test-monitor-section.tsx`, `src/screens/teacher/test-results-section.tsx`, `src/screens/tuition/admin-ui.tsx`, `src/screens/tuition/batch-invitations.tsx`, `src/screens/tuition/batch-screens.tsx`, `src/screens/tuition/join-requests.tsx`, `src/screens/tuition/new-batch-screen.tsx`, `src/screens/tuition/pending-enrollments.tsx`, `src/screens/tuition/schedule-form.tsx`, `src/screens/tuition/timetable-sheet.tsx`, `src/screens/tuition/tuition-batches.tsx`, `src/screens/tuition/tuition-home.tsx`, `src/screens/tuition/tuition-profile.tsx`, `src/screens/tuition/tuition-students.tsx`, `src/screens/tuition/tuition-teachers.tsx`, `src/screens/tuition/tuition-tests.tsx`, `src/screens/tuition/weekly-timetable.tsx`, `src/services/student-api.ts`

## Backend API routes (papers)

- `/api/admin/overview` GET · roles: n/a · The whole network at a glance: totals, sign-ups over the last 30 days, last week's activity, and the largest tuitions.
- `/api/admin/session` GET/POST/DELETE · roles: n/a · Whether this browser is logged in to the admin console.
- `/api/admin/tuitions/[id]/password` POST · roles: n/a · Sets a new password for the tuition's own login: { password }. Logs it out everywhere.
- `/api/admin/tuitions/[id]` GET/PATCH · roles: n/a · Everything about one tuition: its login, batches, teachers, students and tests.
- `/api/admin/tuitions` GET/POST · roles: n/a · Every tuition, newest first, with its login email and how many people it has.
- `/api/admin/users/[id]/password` POST · roles: n/a · Sets a new password for anyone (and unlocks them): { password }. Logs them out everywhere.
- `/api/admin/users/[id]` PATCH · roles: n/a · Turns a user's login off or on: { active }. Turning it off logs them out everywhere.
- `/api/admin/users` GET · roles: n/a · Finds anyone across all tuitions, for support: ?q= (name, email or phone), ?role=. At most 50, recently active first.
- `/api/analysis/batch/[id]` GET · roles: tuition,teacher · Student profile analysis, batch-wise: every student's average score, tests taken, accuracy and strong/weak topic counts, and the batch's wea
- `/api/analysis/student/[id]` GET · roles: any · A student's profile analysis: accuracy per subject, chapter and topic, their strong and weak topics, and every test they've taken. For the t
- `/api/analysis/test/[id]` GET · roles: tuition,teacher · How a batch did on one test: the spread of scores, topic understanding (accuracy per topic across everyone), and the questions most got wron
- `/api/announcements/[id]` DELETE · roles: tuition,teacher · Deletes an announcement: the tuition may delete any, a teacher their own.
- `/api/announcements` GET/POST · roles: any | tuition,teacher · Announcements the user should see, newest first: all of the tuition's for its own account; for a teacher or student, those to the whole tuit
- `/api/auth/change-password` POST · roles: n/a · Changes the user's own password. Every other device is signed out; this one gets a fresh token so it stays logged in.
- `/api/auth/forgot-password` POST · roles: n/a · Emails a password reset code: { email }. Answers the same whether or not the email has an account, so it can't be used to find out who's reg
- `/api/auth/login` POST · roles: n/a · Email + password → a login token and the user's details.
- `/api/auth/me` GET/PATCH · roles: n/a · The signed-in user; the app calls it on start to check the saved login.
- `/api/auth/register` POST · roles: n/a · Anyone creates an account: { name, email, phone?, password }. It has no role or tuition until a tuition accepts their join request; they're 
- `/api/auth/reset-password` POST · roles: n/a · Sets a new password with the emailed code: { email, code, newPassword }. Logs out every device; the email counts as verified.
- `/api/auth/verify-email` POST · roles: n/a · Checks the code from the email: { code }. Marks the email verified.
- `/api/auth/verify-email/send` POST · roles: n/a · Emails (another) verification code to the signed-in user.
- `/api/batches/[id]/progress` GET/POST/DELETE · roles: any | tuition,teacher · What the batch has been taught. With ?subject=, that subject's whole syllabus, each topic marked with when it was covered; always the latest
- `/api/batches/[id]` GET · roles: any · A batch for anyone who may see it: its timings, teachers and syllabus coverage; its students for the tuition and its teachers; and the subje
- `/api/dashboard`  · roles: n/a · Counts change with every upload; never serve a build-time snapshot.
- `/api/engagement/me` GET · roles: student · The student's progress for the Home header: XP, level and progress to the next level, today's XP / goal / goalMet, streak and freezes. { ena
- `/api/files/[id]`  · roles: n/a · Serves an uploaded PDF or diagram from the StoredFile collection. Ids are never reused, so responses can be cached indefinitely by browser a
- `/api/filters`  · roles: n/a · Chapters and topics grow with every upload. Without this, Next pre-renders the route at build time and keeps serving that (often empty) snap
- `/api/join-requests/mine` GET/DELETE · roles: n/a · The person's latest join request and its state, with the tuition's name (and the batch, for a batch's code).
- `/api/join-requests` POST · roles: n/a · Asks a tuition to let the person in: { code, subjects? }. The code decides the role: a batch's joining code makes a student request for that
- `/api/join-requests/validate` POST · roles: n/a · Checks a joining code for someone who hasn't joined a tuition: { code }. Answers with the institute and batch it leads to, so they can confi
- `/api/make-pdf/options` POST · roles: teacher,tuition · The chapters, topics, PYQ years and matching MCQ count for the one-page Make PDF screen's choices. Read-only; teachers and tuition accounts,
- `/api/make-pdf/pick` POST · roles: teacher,tuition · Two ways to get the exact questions for a PDF, both inside the chosen scope: - `ids`: the questions the teacher picked, checked against the 
- `/api/make-pdf/questions` POST · roles: teacher,tuition · One page of the matching MCQs (never more than MAX_PAGE), for the on-screen browser.
- `/api/papers/[id]/attempt-questions`  · roles: n/a · Used by the mobile app when a student starts attempting a paper. The correct answer — and the worked explanation, which states it — are with
- `/api/papers/[id]` DELETE · roles: n/a · Deletes a paper with its questions and stored files: platform admin only, and only while no student history uses it. Attempts are never dele
- `/api/papers`  · roles: n/a · Database-backed results must be read at request time, not during a build.
- `/api/papers/upload` POST · roles: n/a · The largest PDF accepted: the PDF is kept in one Mongo document, which can't pass 16 MB. (Vercel itself refuses request bodies over 4.5 MB.)
- `/api/push` POST/DELETE · roles: n/a · Registers this phone for notifications: { token: "ExponentPushToken[…]", platform }.
- `/api/pyq/answer` POST · roles: any · Checks a practice answer: { questionId, selected }. Returns whether it's right, the answer and the solution; a student's answer is kept for 
- `/api/pyq/chapters` GET · roles: any · The chapters of a subject that have past-year questions for the student's track (?subject=Physics), how many each has, and how many the stud
- `/api/pyq/questions` GET · roles: student · A page of past-year questions from one chapter or topic: ?subject=Physics&standard=11th&chapter=…[&topic=…][&status=…][&after=<id>][&limit=1
- `/api/pyq` GET · roles: any · Past-year questions to practise: ?subject=Physics[&chapter=…][&skip=0]. Newest papers first; each with the student's last answer if they tri
- `/api/pyq/topics` GET · roles: student · Topic practice for one subject (?subject=Physics): the student's syllabus (the same chapters and topics as the Syllabus tab, with what their
- `/api/question-paper-pdf` POST · roles: teacher,tuition · A 300-question paper with solutions is well under 2 MB of JSON; Vercel refuses bodies over 4.5 MB.
- `/api/questions/[id]` PATCH/DELETE · roles: n/a · The text fields that may be edited, with their longest allowed length.
- `/api/questions/pick` POST · roles: teacher,tuition · Picks questions at random for a PDF: a number of them (or a number of each level) from one exam's questions in a subject and chapters. Retur
- `/api/questions`  · roles: n/a · Page size: the question bank holds hundreds of thousands of questions, and an unbounded "everything" response would be hundreds of megabytes
- `/api/self-assessments/[id]/answers` PUT · roles: student · Saves answers as the student goes: { answers: [{ index, selected }] }.
- `/api/self-assessments/[id]` GET/DELETE · roles: student · One of the student's self-assessments: questions once started, answers, solutions and the report once submitted.
- `/api/self-assessments/[id]/start` POST · roles: student · Starts the clock (once) and returns the questions. Starting again just carries on.
- `/api/self-assessments/[id]/submit` POST · roles: student · Submits it, with any last answers ({ answers?: [{ index, selected }] }), and returns the result: answers, solutions and the topic-by-topic r
- `/api/self-assessments/plan` POST · roles: student · What a self-assessment with these choices would be (the same body as creating one), without making it: questions available, how many of each
- `/api/self-assessments` GET/POST · roles: student · The student's self-assessments, newest first (?subject= for one subject).
- `/api/student/overview` GET · roles: student · A student's home: their batch and its syllabus coverage, today's classes and the week's timetable, topics covered lately, open tests, their 
- `/api/student/roadmap` GET · roles: student · A student's roadmap for one subject (?subject=Physics): every chapter of 11th and 12th with the marks the tuition says it carries, what the 
- `/api/syllabus` GET · roles: any · A subject's chapters and their topics, from the question bank. ?subject=Physics[&standard=11th] — both classes when no standard is given.
- `/api/teacher/overview` GET · roles: teacher · A teacher's home and profile numbers: the batches they teach (with the subjects they teach in each), today's classes, and their weekly hours
- `/api/tests/[id]/access` POST · roles: any
- `/api/tests/[id]/answers` PUT · roles: student · Saves answers as the student goes: { answers: [{ index, selected }] }.
- `/api/tests/[id]/attempt-control` POST · roles: teacher,tuition
- `/api/tests/[id]/events` POST · roles: student · The phone reports the app was away during the test: { type: "away", awayMs, answers?: [{ index, selected }] }. Away longer than the limit en
- `/api/tests/[id]/monitor` GET · roles: tuition,teacher · Who has started, is answering or has finished a test, for the tuition and the teachers of its batch (testFor checks the tuition and the batc
- `/api/tests/[id]/results/[studentId]` GET · roles: tuition,teacher · One student's attempt at a test, question by question, for the tuition and the teachers of the test's batch. Students are refused; a student
- `/api/tests/[id]/results` GET · roles: tuition,teacher · How a batch did on a test: the summary, the ranking of those who took it, who didn't, each question's statistics and topic performance. For 
- `/api/tests/[id]` GET/PATCH/DELETE · roles: any | tuition,teacher · A test with its questions and answers, and every student of the batch with their result (or that they haven't taken it), for the tuition and
- `/api/tests/[id]/start` POST · roles: student · A student starts the test (or carries on with it): their clock starts now.
- `/api/tests/[id]/status` GET · roles: student · No question payload, scoring analytics, or client-controlled resumption.
- `/api/tests/[id]/submit` POST · roles: student · Submits the test, with any last answers ({ answers?: [{ index, selected }] }), and returns the result. Answers, correctness and solutions co
- `/api/tests/[id]/visibility` POST · roles: student · A report after the student's time ran out finishes the attempt: participation XP after the lock (idempotent, never throws).
- `/api/tests/audience` POST · roles: teacher,tuition
- `/api/tests/batches` GET · roles: tuition,teacher · Every batch of the user's tuition that a test can be set for. A teacher may set a test for any of them, not only the batches they teach. Rea
- `/api/tests` GET/POST · roles: any | tuition,teacher · Tests the user should see, newest first: the tuition's all, a teacher's batches', a student's batch's. ?batchId= narrows to one batch. Stude
- `/api/timetable/[id]` PATCH/DELETE · roles: tuition,teacher · The class, if the user may change it: the tuition any, a teacher their own.
- `/api/timetable` GET/POST · roles: any | tuition,teacher · The weekly timetable the user should see, by day and time: every class for the tuition, the classes of a teacher's batches, a student's batc
- `/api/tuition/batches/[id]/invite` GET/POST · roles: tuition · The batch's joining code (made on first use) with its status and expiry. Tuition accounts only.
- `/api/tuition/batches/[id]` GET/PATCH/DELETE · roles: tuition · A batch with its students and syllabus coverage. Coverage scans the question bank, so screens that don't show it ask with ?coverage=0 and ge
- `/api/tuition/batches/[id]/teachers` PUT/DELETE · roles: tuition · Assigns a teacher of this tuition to the batch, or changes their subjects there: { teacherId, subjects: [...] } (at least one, all of them t
- `/api/tuition/batches` GET/POST · roles: tuition · The tuition's batches, by name, with their teachers and student counts.
- `/api/tuition/enrollments/decide` POST · roles: tuition · Approves or rejects students' requests to join a batch, one or many: { ids: string[], action: "approve" | "reject" }. Tuition accounts only.
- `/api/tuition/enrollments` GET · roles: tuition · Student enrollment requests waiting for a decision, oldest first: - join-code requests (student used a batch code, no tuitionId yet) - admin
- `/api/tuition/join-requests/[id]/accept` POST · roles: tuition · Approves a pending teacher request. The person becomes a teacher of this tuition with the subjects they asked with; no batch is assigned. St
- `/api/tuition/join-requests/[id]/reject` POST · roles: tuition · Turns a teacher request down; the person can ask again (or ask another tuition).
- `/api/tuition/join-requests` GET · roles: tuition · Teachers waiting to join with the institute's teacher code, oldest first. (Students' batch codes: see /tuition/enrollments.)
- `/api/tuition/logo` GET/PUT/DELETE · roles: tuition,teacher | tuition · The JSON body of a logo upload: its image as base64, a third larger than the image.
- `/api/tuition/overview` GET · roles: tuition · The tuition's home: how many students, teachers and batches it has, and for each batch its students and how much of each subject it has cove
- `/api/tuition/profile` GET/PATCH · roles: any | tuition · The tuition's own details. Teachers and students may read them too.
- `/api/tuition/students/[id]/password` POST · roles: tuition · Sets a new password for a student who forgot theirs; signs them out everywhere.
- `/api/tuition/students/[id]/resend-invitation` POST · roles: tuition · Resends the invitation email for an admin-created student who hasn't activated their account yet. Generates a new temporary password, invali
- `/api/tuition/students/[id]` GET/PATCH/DELETE · roles: tuition · Edits a student, moves them to another batch, or turns their login off/on. When the program, class or batch changes, the batch must be of th
- `/api/tuition/students/check-email` GET · roles: tuition · Quick check whether an email is available for a new student account. Returns { available: false, reason } when the email is already taken.
- `/api/tuition/students` GET/POST · roles: tuition · The tuition's students, by name. ?batchId= narrows to one batch (?batchId=none: students without one); ?q= searches names and emails.
- `/api/tuition/teacher-invite` GET/POST · roles: tuition · The institute's teacher joining code (made on first use) with its status and expiry. Tuition accounts only.
- `/api/tuition/teachers/[id]/password` POST · roles: tuition · Sets a new password for a teacher who forgot theirs; signs them out everywhere.
- `/api/tuition/teachers/[id]` GET/PATCH/DELETE · roles: tuition · Edits a teacher: name, email, phone, subjects, or turns their login off/on.
- `/api/tuition/teachers` GET/POST · roles: tuition · The tuition's teachers, by name, each with the batches and subjects they teach. `self` is the admin's own account, which can be assigned to 
- `/api/tuition/weightage` GET/PUT · roles: any | tuition · Each chapter of a track's subject, with the marks the tuition says it carries (null when not set). ?track=NEET&subject=Physics. Anyone in th

## Backend models (fields)

- **Announcement**: tuitionId, batchIds, kind, title, body, authorId, createdAt  ·  indexes {tuitionId:1,createdAt:-1}
- **Attempt**: questionId, selected
- **Batch**: day, start, end  ·  indexes {"teachers.teacherId":1} {tuitionId:1,nameKey:1}
- **BatchInvite**: tuitionId, kind, batchId, status, codeHash, codeCipher, expiresAt, createdBy, rotatedAt, revokedAt, createdAt  ·  indexes {tuitionId:1}
- **ChapterWeightage**: tuitionId, track, subject, standard, chapter, marks  ·  indexes {tuitionId:1,track:1,subject:1,standard:1,chapter:1}
- **DailyActivity**: studentId, tuitionId, batchId, date, xp, practiceXp, questions, correct, mistakesFixed, goalXp, goalMet, testDay, firstAt, lastAt  ·  indexes {studentId:1,date:1} {batchId:1,date:1}
- **EmailCode**: email, purpose, codeHash, attempts, expiresAt, createdAt  ·  indexes {email:1,purpose:1,createdAt:-1}
- **InstituteLogo**: tuitionId, contentType, size, width, height, data, updatedBy, updatedAt
- **JoinRequest**: userId, tuitionId, status, role, batchId, subjects, acceptedAs, decidedAt, source, createdAt  ·  indexes {tuitionId:1,status:1,createdAt:-1} {userId:1}
- **NotificationLog**: key, sentAt
- **Paper**: title, examType, examCategory, standard, chapter, topic, difficulty, year, subjects, totalQuestions, pdfUrl, uploadedDate
- **PracticeAnswer**: tuitionId, studentId, questionId, subject, standard, chapter, topic, selected, correct, answeredAt  ·  indexes {studentId:1,questionId:1}
- **Question**: paperId, questionNumber, subject, examCategory, standard, chapter, topic, section, questionText, optionA, optionB, optionC, optionD, correctAnswer, answerType, difficulty, explanation, source, diagramUrls, explanationDiagramUrls, optionDiagramUrls, vedclassId, pyqPaper, bankCopy  ·  indexes {paperId:1,questionNumber:1} {paperId:1,subject:1} {standard:1,subject:1,chapter:1,topic:1} {vedclassId:1}
- **SelfAssessment**: standard, chapter, topics  ·  indexes {studentId:1,createdAt:-1}
- **StoredFile**: paperId, kind, filename, contentType, size, data, createdAt
- **Student**: name, email, targetExam, joinedDate
- **StudentEngagement**: studentId, tuitionId, batchId, totalXp, level, goal, streak, lastAnswerAt, fastRun, createdAt, updatedAt
- **SyllabusProgress**: tuitionId, batchId, subject, standard, chapter, topic, coveredOn, teacherId, note, createdAt  ·  indexes {batchId:1,subject:1,standard:1,chapter:1,topic:1}
- **TestAttempt**: index, selected, correct, version  ·  indexes {testId:1,studentId:1}
- **TestRoom**: sourceId, subject, standard, chapter, topic, difficulty, questionText, optionA, optionB, optionC, optionD, answerType, correctAnswer, explanation, diagramUrls, optionDiagramUrls, explanationDiagramUrls  ·  indexes {tuitionId:1,createdAt:-1} {tuitionId:1,teacherId:1,creationRequestId:1} {tuitionId:1,batchIds:1,opensAt:-1} {tuitionId:1,batchId:1,opensAt:-1}
- **TimetableEntry**: tuitionId, batchId, teacherId, subject, day, start, end, note, createdAt, updatedAt
- **Tuition**: name, address, phone, email, active, engagement, createdAt, updatedAt
- **User**: email, passwordHash, role, name, phone, tuitionId, active, emailVerified, tokenVersion, mustChangePassword, accountStatus, invitationStatus, invitedAt, failedLogins, lockedUntil, joinCodeFailures, joinCodeLockedUntil, lastLoginAt, pushTokens, subjects, program, track, standard, batchId, parentPhone, createdAt, updatedAt  ·  indexes {tuitionId:1,role:1} {"pushTokens.token":1}
- **XpEvent**: key, studentId, tuitionId, batchId, kind, xp, date, weekKey, league, practice, meta, at  ·  indexes {studentId:1,date:1} {batchId:1,weekKey:1,league:1}

## Backend helpers worth reusing

- `src/lib/http.ts`: badRequest, notFound, readJson, readBody, route, text, email, MIN_PASSWORD, password, oneOf, listOf, isObjectId, objectId
- `src/lib/auth.ts`: signToken, checkLogin, requireAccount, requireUser, publicUser
- `src/lib/push.ts`: pushToUsers, pushOnce, membersOf
- `src/lib/topic-stats.ts`: MIN_ANSWERS, STRONG_FROM, WEAK_BELOW, levelOf, topicStatsByStudent, byChapter, combine, schoolSubjectOf
- `src/lib/teaching.ts`: batchFor, batchForTest, subjectsTaught, mustTeach, todayInIndia
- `src/lib/pyq.ts`: pyqFilter, pyqBankFilter, practiceBankOf, readSubject
- `src/lib/marking.ts`: cleanAnswer, isCorrect, scoreAnswers
- scheduled jobs (vercel.json crons): none
- tests: 33 files (`npm test`, tsx --test + mongodb-memory-server)

## Engagement collections already in the backend

`DailyActivity.ts`, `XpEvent.ts`
