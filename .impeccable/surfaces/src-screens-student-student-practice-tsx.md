---
version: 1
slug: "src-screens-student-student-practice-tsx"
primary_target: "src/screens/student/student-practice.tsx"
related_targets: []
---

# Student Practice tab

Scope: the student's Practice tab (src/screens/student/student-practice.tsx). Mode: Operate.
Audience: Class 11–12 JEE/NEET students in a teacher's batch. Job: see how the last self-assessment went, fix weak topics, start the next test. Topic practice (subject → chapter → topic) stays on the page, lower and quieter.
User's answers (2026-10-31): current page looks generic, results don't stand out, topic list is cluttered; first thing = last result + weak topics; keep topic practice, lower and quieter. Structure locked: Progress scorecard.
Constraints: keep the app's world (cream ground, terracotta accent, existing tab bar, kit components); real numbers only; native safe areas and back behaviour.

## Direction contract

THESIS: The latest self-assessment is the page, read as a scorecard with its own history; refuses the stack of equal cards (intro card, list card, list card).
OWN-WORLD: App palette unchanged. Strength in display numerals (tabular, 800), tone carried by ink colours (success/warning/danger ink), never colour alone. One terracotta filled button per view. Hairline rows, no badges, no icon tiles.
STORY: Student sees their latest strength and whether it rose, sees the 2–3 topics dragging it down, retakes them in one tap or starts a new test; earlier tests and topic practice wait below.
FIRST VIEWPORT: Scorecard card full width: test title + subject/date line; 56pt strength % left, trend dot plot of the subject's tests right with a delta line; weakest topics as bars with %; Retake weak topics (filled) + New test (outlined) at the card's foot, above the fold.
FORM: Progress scorecard, position 5 on the ordered list, seed key 2417b6df.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
