# Human behavior principles → mobile rules

Each principle is how people actually perceive, decide and remember, turned into a rule you can check on a screen. Cite the principle by name when you explain a change to the user ("Hick's law: 9 equal buttons → 1 primary + a menu"), because it makes the reasoning reviewable.

This builds on the **apple-design** skill's foundations (purpose, agency, familiarity, simplicity, wayfinding, grouping and mapping, specific labels) and doesn't repeat them. Where that skill covers motion feel, defer to it.

## A. Attention & decisions

| Principle | What people do | Rule for the app | Check |
|---|---|---|---|
| **Hick's law** | Decision time grows with the number of equal choices | ≤ 5 bottom tabs. Per screen: **1 primary action**, ≤ 2 secondary, the rest in an overflow menu or a sheet. Filters live in a sheet, not as a wall of chips | Count equal-weight buttons in view: > 4 is a smell |
| **Choice overload / decision fatigue** | Too many options → no decision, or a worse one | Offer **presets and templates first** ("Quick test: 20 mixed questions, 30 min"), with "Customise" one level deeper | Can a first-time user finish the task without making a single choice? |
| **Von Restorff (isolation)** | The one different thing gets noticed | Exactly **one** visually distinct element per screen: the primary action. Badges and colors must not compete with it | Squint test: what stands out first? It should be the primary action |
| **Serial position** | People remember and look at the first and last items | The most-used item goes **first** in lists, menus and tabs; the important exit/next action goes **last** (bottom) | Is the most frequent task the first thing on the screen? |
| **Selective attention / banner blindness** | Banner-shaped, decorative or repeated blocks get ignored | Put important status in the content flow (the hero card), not in banners. Use a maximum of 1 alert per screen | Are critical messages shaped like ads? |
| **Information scent** | People follow labels that *predict* what's behind them | Specific nouns for places ("Results", "Question bank"), verbs for actions ("Create test", "Share code"). Never "Submit", "Manage" or "More stuff" | Read the label alone: can you predict the next screen? |

## B. Memory & understanding

| Principle | What people do | Rule | Check |
|---|---|---|---|
| **Working-memory limit / chunking (Miller, Cowan ~4±1)** | People hold ~4 chunks at once | Groups of **3–7 items**. Forms ≤ **5 fields per step**. Long codes chunked (`NEET-7842`, `48 21 97`) | Any group over 7 items without sub-grouping? |
| **Recognition over recall** | Recognising is easier than remembering | Show **recents, current context and defaults**: the selected class/subject in the header, recently used topics first, filters remembered per screen | Does any step ask users to remember something from a previous screen? |
| **Progressive disclosure** | People cope with complexity when it arrives in layers | Summary first, details on demand: 3 items + "See all", "More options" rows, expandable rows, detail screens | Is anything rarely used visible by default? |
| **Mental models** | People expect the app to mirror how they already think | Mirror the user's world: a teacher thinks *class → students / tests → results*, a student thinks *today → practise → see progress*. The navigation follows that order | Draw the user's model and the app's map: do they match? |
| **Jakob's law (familiarity)** | People spend most time in *other* apps | Use platform conventions: bottom tabs, back swipe, pull-to-refresh, swipe actions on rows, sheets with Cancel/Done, long-press menus. Don't invent navigation | Would a first-time user know how to go back and cancel? |
| **Gestalt proximity & common region** | Things that are close or boxed together look related | Space *between* groups (24) is larger than space *within* groups (8–12). One card = one topic | Do any two unrelated things share a card? |

## C. Motivation & progress (learning apps)

| Principle | What people do | Rule | Check |
|---|---|---|---|
| **Goal-gradient effect** | Effort increases as the goal gets closer | Always show **progress in multi-step flows and tests** ("Step 2 of 4", "12/30 answered") and how close a goal is ("2 topics left to master Kinematics") | Does every multi-step flow show where you are? |
| **Zeigarnik effect** | Unfinished tasks stay on the mind and pull people back | A **"Continue" card** on home for any unfinished test, draft or lesson, showing exactly where they left off. Save drafts automatically | Does closing the app mid-task lose anything? |
| **Peak–end rule** | Experiences are judged by the peak and the end | Design the end moments (test submitted, results, class created) with care: a clear outcome, one next step, gentle celebration. Never end on an error or a dead end | What's the very last screen of each top task? |
| **Self-determination (autonomy, competence, relatedness)** | Motivation lasts when people feel in control, capable and connected | Autonomy: let students choose topics and difficulty. Competence: show mastery growth, not just scores. Relatedness: show the teacher's notes and class announcements | Does the app ever force a single path or only show failures? |
| **Habit loop (cue → routine → reward), ethical** | Habits form from small repeated wins | Cue: an optional reminder at a time *they* choose. Routine: a 5-minute practice that starts in 1 tap. Reward: visible progress. **No guilt, no fake streak pressure** (offer streak freezes) | Can a student start practising in ≤ 2 taps from opening the app? |
| **Loss aversion (careful)** | Losses feel ~2× stronger than gains | Use it only to **protect** users (unsaved changes, irreversible deletes). Never as pressure ("You'll lose your streak!") | Any copy that uses fear to drive engagement? Remove it |

## D. Effort & physical use

| Principle | What people do | Rule | Check |
|---|---|---|---|
| **Fitts's law + thumb zone** | Big, near targets are faster. Thumbs reach the bottom of the screen best | Primary actions in the **bottom third** (pinned bottom button), ≥ 44pt targets, destructive actions away from primary ones | Can the main action be reached one-handed? |
| **Tesler's law (conservation of complexity)** | Complexity has to live somewhere | The **app** absorbs it: pre-fill from context (current class, subject, last settings), auto-calculate (total marks, duration), infer instead of asking | How many fields could be pre-filled? |
| **Default effect** | Most people keep the defaults | Default to the most common, safest choice. Defaults must serve the user, never the business at their expense | Is every default the choice you'd recommend to a friend? |
| **Doherty threshold (< 400ms)** | Productivity and trust collapse when responses are slow | Instant feedback on tap, optimistic updates, skeletons for loads over 300ms, progress for anything over 2s | Any tap with no visible response? |
| **Interruptions (mobile reality)** | People are interrupted constantly (calls, notifications, app switches) | Persist state across backgrounding: test answers, drafts, scroll position, filters | Background the app mid-task and come back: is everything still there? |
| **Error prevention & forgiveness** | People slip; they don't read confirmations | Prevent (disable impossible options *with a reason*, inline validation, constraints). Forgive (Undo snackbar over confirmation dialogs). Confirm only irreversible actions | How many "Are you sure?" dialogs? Replace with undo where possible |

## E. Trust & emotion

| Principle | Rule |
|---|---|
| **Aesthetic-usability effect** | Consistent, crafted visuals make people more patient with friction. Never use them to hide friction: fix the structure first |
| **Visibility of system status** | Always show what's happening: saving / saved, syncing, offline, "Last updated 2 min ago" |
| **Exam anxiety (student context)** | Calm language during tests. Never flash red or shake for wrong answers during a timed test. Give the timer a calm default, warn once, and offer a "hide timer" option |
| **No dark patterns** | Forbidden: confirmshaming, fake urgency or scarcity, nagging, hidden costs, preselected upsells, roach-motel flows (easy in, hard out), disguised ads, forced continuity |

## Using the principles in a review

For each screen, write findings as: **Principle → observation → change**. Example:
- *Hick's law → 9 equal buttons at the top of the batch screen → keep "Add student" as primary; move Export, Settings and Archive into the ⋯ menu.*
- *Zeigarnik → a half-done test is only reachable from the Tests tab → add a "Continue Test 4 (12/30)" card at the top of Home.*
- *Chunking → the create-exam form shows 10 inputs at once → a 4-step flow with ≤ 4 fields each.*

Prioritise changes by **frequency × severity** (how often the problem is hit × how badly it blocks): fix daily-task friction first, rare-settings polish last.
