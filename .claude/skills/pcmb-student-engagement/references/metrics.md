# Measuring retention and learning (and the guardrails)

The `XpEvent` ledger + `DailyActivity` already record every learning action, so most metrics need **no extra tracking SDK**. Add a small `AppEvent` collection only for the UI events the ledger can't see (app opened, screen viewed, nudge opened, recap shared). Keep it anonymous-aggregatable and free of personal content.

## North star and core metrics

| Metric | Definition | Why |
|---|---|---|
| **Weekly Learning Students (north star)** | students with ≥ 3 goal days in the IST week | habit *and* learning, not just opens |
| D1 / D7 / D30 retention | % of students active (≥ 1 learning action) on day 1/7/30 after their first action | habit formation |
| Stickiness | DAU / MAU (learning-active) | daily habit |
| Goal completion | goal days / active days | is the goal well calibrated? |
| Streak health | share with a streak ≥ 7; freezes used per week | consistency |
| Questions per active day | median and p90 | volume |
| Mistakes fixed per week | revision items moved up or cleared | effective learning |
| **Accuracy trend** | weekly accuracy on topics practised ≥ 2 weeks in a row | learning, not just volume |
| **Weak → strong conversions** | topics crossing 40% → 70% | the Comeback signal |
| **Test outcomes** | change in released test % for engaged vs. low-engagement students (same batch and test) | the real goal: marks |
| Teacher adoption | batches with ≥ 1 challenge or shout-out a month | the social engine |

## Guardrail metrics (watch these as closely as growth)

| Guardrail | Alarm when |
|---|---|
| Late-night share | > 10% of learning actions between 00:00 and 05:00 IST |
| Notification fatigue | > 15% of students turn nudges off in their first 2 weeks |
| League anxiety | > 40% of a batch hides from the league, or the bottom half's activity drops after league launch |
| Speed-tap rate | > 5% of answers hit the speed guard (XP is being chased instead of learning) |
| Very long sessions | sessions > 3 h on school days (check copy and caps) |
| Accuracy drop | volume up but accuracy down for engaged students (they're grinding easy XP) |

## Secure-test health (per tuition, per test)

| Metric | Watch for |
|---|---|
| Pauses per 100 attempts, by reason | a spike in `away` or `connection` after a release means a fairness bug (keep-awake, a network-heavy screen) |
| Share of pauses the teacher resumed | > 80% means the rules are catching honest students; look at reasons and devices |
| Median time from "Ask my teacher" to a decision | > 3 min hurts students; improve teacher alerts |
| Integrity `unavailable` / `failed` rate by device model | old phones or build problems, not cheaters |
| Flags dismissed as "Looks fine" vs. voided | tune review thresholds so teachers aren't flooded |
| Ready-check drop-off (opened, but never started) | a confusing step, usually lockdown setup |

## Dashboards

- **Teacher (in-app, F8):** their batch only. Active this week, goal days, streaks, challenge progress, weak chapters, inactive list.
- **Tuition owner:** all batches, the same tiles, plus feature adoption.
- **Product (admin console in `papers`):** cohorts, retention curves, funnel (opened → started Today's 5 → completed → goal met), guardrails. Build with simple aggregation routes on `DailyActivity`/`XpEvent`; there's no need for an external tool to start.

## Experiments

- Change one number at a time in `lib/engagement/config.ts`, behind a per-tuition flag (`Tuition.engagement.variant`), comparing similar batches.
- Minimum 2 weeks per test, judged on Weekly Learning Students, accuracy trend and the guardrails, never on opens alone.
- Good first experiments: default goal (Regular vs. Chill), daily challenge size (5 vs. 7), reminder default time (6:30 PM vs. 8 PM), league visible by default vs. opt-in.

## Review ritual (monthly)

1. Read the north star and guardrails per tuition.
2. Run the three personas (student-psychology.md) through the current app and see if anything hurts Sneha or loses Rohit.
3. Tune numbers in config, keeping the balancing checklist (engagement-system.md §9) green.
