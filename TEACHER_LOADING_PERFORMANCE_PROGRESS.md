# Teacher loading performance: progress

Branch `feature/teacher-performance` in both worktrees:
- App: `_wt/pcmb-paper-teacher-performance`
- API: `_wt/papers-teacher-performance`

Base verified: multi-subject Make PDF / Create Test / student test are merged (app `cbc3804`, API `ab7e56d`).
Nothing committed (as instructed).

## Status

- [x] Teacher Home (code done)
- [x] My Tests (code done)
- [x] Manage Test (code done)
- [x] Teacher Batches (code done)
- [x] Create Test (code done)
- [x] Backend API optimization (`/teacher/overview`, `coverageFor`)
- [x] Shared loading/caching
- [x] Final verification (static checks; no device run)

## Key findings (static, from code)

- `AppTabs` mounts all 5 Teacher tabs at once (`PagerView offscreenPageLimit = tabs.length - 1`).
  Home, Batches, Tests and Profile each called `GET /teacher/overview` with no cache key, so login sent
  **4 identical overview requests**, and every `bumpDataVersion()` (any edit) sent 4 again.
- Existing infra already does dedup + in-memory cache + stale-answer protection:
  `useLoad({ cacheKey })` → `src/services/load-cache.ts`. Cache clears on login change,
  workspace switch (`api-client.ts`) and any data change (`bumpDataVersion`). Reused, not replaced.

## Shared pieces (new)

- `src/components/kit.tsx`: `SkeletonGroup` (fades in after 150 ms, so quick loads don't flash;
  announced as busy), `SkeletonLine`, `SkeletonStats` (StatTile-sized), `SkeletonRows` (ListRow-sized),
  `SkeletonCards`, `SectionError` (section-level message + Try again). No animation, theme tokens only.
  Skeletons only render when a section has no data yet (`useLoad.loading`), so refreshes keep content.
- `src/services/cache-keys.ts` + `src/hooks/use-cache-keys.ts`: one key per request, prefixed with
  workspace (role) + institute + user. Belt-and-braces on top of the clear-on-switch behaviour.

## Teacher Home — `src/screens/teacher/teacher-home.tsx`, `src/screens/shared/announcements.tsx`

- Bottleneck: full-screen spinner until `/teacher/overview`; Announcements mounted only after it, so its
  request was serialized; overview duplicated by 3 other tabs.
- Changes: header immediate; stats / today / timetable each with size-matched skeleton; section error + retry;
  Announcements mounts immediately (parallel request), skeleton + retry, cached; overview shared by cache key.
- Requests at Teacher login: overview 4 → 1. Home's critical path: overview → announcements (serial) → now parallel.

## My Tests — `src/screens/teacher/teacher-tests.tsx`

- Changes: overview via shared key; test list cached per batch filter (switching back is instant, refreshes quietly);
  skeleton cards; status counts/filtered list memoized; `TestCard` memoized with stable `openTest`.
  Status filters (Ongoing/Completed/etc.) were and remain client-side over one list: no request on tab change.
  Edit wizard's `/tests/batches` cached.
- Not done: virtualization. The list lives in the shared `Screen` ScrollView; a FlatList would need a `Screen`
  change. Teacher lists are capped at 200 by the API.

## Manage Test — `src/screens/teacher/test-management-screen.tsx`

- Test detail deliberately **not cached** (status and controls must be fresh). Monitor polling (15 s, foreground
  only, stops when closed) unchanged.
- Changes: page skeleton (heading + controls + student rows); student list skeleton; filtered rows memoized
  per monitor update/search/group; per-row `accessStudents.find` (O(n²)) → `Map` lookup; Edit test's overview
  via the shared key (usually already loaded).

## Teacher Batches — `src/screens/teacher/teacher-batches.tsx`, `teacher-profile.tsx`

- Cards already use lightweight summaries from the overview (counts + coverage, no student records).
- Changes: shared overview key; skeleton cards; batch detail (`batch` + `progress`, already parallel, only on open)
  cached per batch with skeleton. Profile uses the shared overview key.

## Create Test — `create-test/{details,setup}-screen.tsx`, `create-test/question-picker.tsx`, `question-selection/subject-selector.tsx`

- Already had keyed stale-response guards, server pagination, and a tuned FlatList in the multi-subject selector.
- Changes: `/tests/batches` shared between page 1 and 2 (one request); bank filter options cached per exact scope
  (going back to a seen filter: no request); question-card skeletons on first page load; `selected.some` per card
  → Set lookup; spinners → skeletons for batches/students/test details.
- Student audience (eligibility) deliberately **not cached**.

## Backend — `papers`: `src/app/api/teacher/overview/route.ts`, `src/lib/syllabus.ts`

- `/teacher/overview` built the timetable twice (`entriesOut` for week and again for today: 2 extra Mongo queries,
  run sequentially after coverage). Now: one `entriesOut`, today filtered from it, run in parallel with coverage.
  Mongo queries per call (warm syllabus cache): 9 → 7, and two serial round-trips removed.
- `coverageFor` (also used by tuition/student/batch routes): syllabus lookups for all batches in parallel instead of
  batch by batch; progress rows grouped once instead of rescanned per batch×subject. Same output.
- Investigated, not changed: `GET /tests` loads each test's questions (needed by `hydrateCompletion`, which
  finalizes attempts at closing → attempt lifecycle; out of scope).
- Deployment: the app calls the deployed backend; backend gains apply once `papers` is deployed. App changes
  don't depend on them (no contract change).

## Tests (run this session, after `npm ci` in both worktrees)

App (`pcmb-paper-teacher-performance`):
- `node --experimental-strip-types --test tests/*.test.mjs`: **469/469 pass**.
  - New `tests/teacher-loading.test.mjs` (6): one overview request across tabs, refresh still fresh,
    key isolation by user/institute/workspace, admin→teacher switch, per-parameter keys, stale answer after a change.
  - `create-test-start-now`, `question-selection-refinement`, `make-pdf-subjects` run screens in a sandbox with an
    import allowlist; added a stub for `@/hooks/use-cache-keys` to each (harness wiring only, no assertion changed).
- `npx expo lint`: clean.
- `npx tsc --noEmit`: initially 2 errors from the missing generated `expo-env.d.ts`; 0 after generating it (see review).

API (`papers-teacher-performance`):
- `npm test`: 631/635. The 4 failures (`step1-security` student start 500; `student-joining-code` ×2;
  `teacher-joining-code` ×1) **also fail with the original `syllabus.ts` and overview route**, so pre-existing.
  New test "today's classes are the week's classes for today, built once" passes.
- `npm run lint`: clean. `npx tsc --noEmit`: clean.

Not run: emulator/device checks (`adb devices` showed no device), so no runtime timings.

## Measurements

Static (from code, not a trace):
- Teacher login: `/teacher/overview` requests 4 → 1. Same after every data change (4 → 1).
- Teacher Home: Announcements request no longer waits for the overview (serial → parallel).
- Create Test: `/tests/batches` 2 → 1 per flow; bank options: 0 requests when returning to a seen filter scope.
- Revisits (batch detail, test list per batch filter, overview, announcements): cached answer shown at once,
  refreshed quietly.
- `/teacher/overview` server work: Mongo queries 9 → 7, two serial round-trips removed.
No runtime timings were measured.

## Remaining work

- Measure on a device: time to first content on Home/Tests, request counts via a network log.
- My Tests virtualization would need `Screen` to support a FlatList body (left out: shared component, larger change).
- `GET /tests` reads full question arrays for up to 200 tests; trimming needs care because `hydrateCompletion`
  finalizes attempts (attempt lifecycle).
- Backend gains only reach the app once `papers` is deployed.
- Pre-existing failures above (joining codes, step1 student start, CSS type decls) are outside this task.

## Final review (2026-11-11)

1. **Five tabs mounted at once** (`PagerView offscreenPageLimit`): with the overview shared, login's background
   work is `/tests` (Tests tab) and `/tuition/profile` (Profile), sent in parallel with Home's. The Questions tab
   fetches the bank only in browse mode. Not changed: lazy pages would show blank while swiping, and the cost is
   two small parallel requests.
2. **`coverageFor`** (Teacher, Tuition overview, Tuition batch, Batch, Student callers): authorization is in the
   callers (unchanged); the function only receives already-authorized batches and its single
   `SyllabusProgress` query is unchanged. Only concurrency and grouping changed. New test in
   `batch-assignment.test.ts`: several batches together = each alone, and no mixing between batches.
   Focused backend tests (batch-assignment, timetable-subjects, academic-programs, topic-practice): **84/84 pass**.
3. **App TypeScript errors**: caused by the missing generated `expo-env.d.ts` (gitignored, written by `expo start`).
   Generated with a short `npx expo start`; `npx tsc --noEmit` now **0 errors**. Not committed (gitignored).
4. **4 backend failures**: confirmed last session to fail identically with the original `syllabus.ts` and overview
   route; they are in joining codes and a student test start, neither of which calls the changed code. Not rerun.
5. **Cache isolation**: keys carry workspace (role) + institute + user; filters are in the keys (`tests(batchId)`,
   `batch(id)`, `bankOptions(bankKey)` where `bankKey = JSON.stringify(bankBody(scope))`, i.e. every filter);
   cache cleared on login, workspace switch and every data change. Covered by `teacher-loading.test.mjs`.
6. **Active test monitoring**: the monitor (15 s poll), test detail, results and student audience are never cached.
   Only lists/summaries are (shown at once, refreshed immediately).
7. **Progressive loading**: skeletons render only while a section has no data; they leave on success or error
   (error shows `SectionError` / `ErrorView` with Try again). Sections load independently; refresh keeps content.
   - **Fixed**: `useLoad` read the cache only on mount, so switching to a filter/scope already loaded showed the
     *previous* key's data until the request returned (and the progress note's "switching back is instant" was
     not true). Now a pending load shows the kept answer for the current key when there is one
     (`kit.tsx`, 3 lines). Also benefits Tuition Admin screens whose key changes while open.

Checks this review: focused app tests **113/113**; `tsc` 0 errors; `expo lint` clean; focused backend **84/84**.
Android: **NOT TESTED** (no device in `adb devices`).

## Next action

Device check of Teacher Home / Tests / Manage Test / Create Test; measure request counts and time to first content.
