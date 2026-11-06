# Student Joining Code: implementation report

Date: 2026-10-31. Nothing committed or pushed. No production data touched.

## What it does

1. The Tuition Admin opens **Invite Students** (Batch Details, or People › Students › pick a batch). Both open the same sheet: institute, batch, class/program, the 8-character code, **Copy Code**, **Share Code**, **Manage Code**.
2. A student registers and verifies their email as before. With no tuition membership they see **only** the Join tuition screen: code field, **Continue**, **Log out**. A valid code shows institute, batch, class and program, then **Confirm Join**.
3. They land on **Waiting for approval** (institute, batch, "Pending approval", **Refresh Status**, **Cancel request**, **Log out**). It rechecks every 20 s and switches to the existing Student Home on approval. There is no tab bar before approval.
4. People › Students shows **Pending Enrollments** (name, batch, how long ago). Tick one, several or **Select all**, then **Approve (n)** or **Reject (n)**.
5. Approval sets the same fields every Student API reads (`tuitionId`, `role: "student"`, `batchId`, `program`, `track`, `standard`). The student appears in the batch and gets the normal app.

Handled: wrong/expired/revoked code (one generic message), already a member, existing pending request (same code returns it, another code replaces it), rejected (message, can enter another code), network failure (inline error), expired session (the existing global 401 handling).

## Reused

`JoinRequest` model and `/join-requests*` routes, `requireAccount`/`requireUser`, `join-code.ts` (alphabet and generator, now exporting `newCode`), `findBatch`, `pushToUsers`, `JoinTuitionScreen`, and the kit/admin-ui components (`DetailSheet`, `ActionRow`, `Chips`, `Badge`, `Avatar`, `useFlash`, `copyText`, `confirmAction`). No new dependencies.

## Files

Backend `papers/` (new): `src/models/BatchInvite.ts`, `src/lib/batch-invite.ts`, `src/lib/enrollment.ts`, `src/app/api/tuition/batches/[id]/invite/route.ts`, `src/app/api/join-requests/validate/route.ts`, `src/app/api/tuition/enrollments/route.ts`, `.../enrollments/decide/route.ts`, `tests/student-joining-code.test.ts`.
Backend (edited, additive): `models/JoinRequest.ts`, `models/User.ts`, `lib/join-code.ts`, `api/join-requests/route.ts`, `api/join-requests/mine/route.ts`, `api/tuition/join-requests/route.ts`, `api/tuition/join-requests/[id]/accept/route.ts`.
App `pcmb-paper/` (new): `src/screens/tuition/invite-students.tsx`, `src/screens/tuition/pending-enrollments.tsx`.
App (edited): `src/screens/join-tuition-screen.tsx`, `src/screens/tuition/tuition-students.tsx`, `src/screens/tuition/tuition-batches.tsx`, `src/services/tuition-api.ts`.
(`package-lock.json` was already modified before this work.)

## API and database

- `GET/POST /api/tuition/batches/:id/invite` (tuition only). GET creates the code on first use and returns the same one afterwards. POST `{action: regenerate | revoke | extend, expiresInDays}`.
- `POST /api/join-requests/validate` returns names only. `POST /api/join-requests` accepts a batch code (a tuition's older code still works). `GET /api/join-requests/mine` now includes the batch.
- `GET /api/tuition/enrollments` and `POST /api/tuition/enrollments/decide {ids, action}` (1–100 ids; the single and bulk paths are the same).
- New collection `batchinvites` (one document per batch). `JoinRequest.batchId` (optional). `User.joinCodeFailures` and `User.joinCodeLockedUntil` (hidden fields). New indexes: unique `batchId`, unique sparse `codeHash`, and `one_pending_per_user` (partial unique on `userId` where status is pending). No existing data is changed or removed.
- Batch-code requests are hidden from the older "accept as student or teacher" list, and that endpoint refuses them, so a code can never produce a teacher.

## Security

- Codes: 8 characters from the unambiguous alphabet, `crypto.randomInt`, case-insensitive, dashes ignored. Stored as an HMAC hash (lookup) plus AES-256-GCM ciphertext bound to the batch id (so the admin can read it again). The plain code is never stored or logged (tested). Keys come from `JOIN_CODE_SECRET`, falling back to `JWT_SECRET`.
- Collisions are blocked by the unique index and retried. Regenerating replaces the hash, so the old code stops at once. Revoking deletes hash and ciphertext. Expiry defaults to 180 days (30/90/180/none selectable).
- Brute force: 10 wrong codes lock code entry for 15 minutes per account, plus a 400 ms delay per miss. Email must be verified first. Every invalid state gives the same message.
- Institute, role and batch always come from the server. Tuition ID comes from the session. Bulk calls refuse the whole request (404) if any id is not a pending batch request of that tuition.
- Approval claims the request atomically, then updates the user only if `tuitionId` is null and `role` is null, so a member is never moved and double decisions or races approve once.
- Pending or rejected students have no role or tuition, so `requireUser` returns 403 on every protected API (tested, and checked live: 403 on the Student overview).
- The pending list shows names only: no email or phone is revealed before approval.

## Tests (each run once after implementation)

- `papers`: `npm test` 204/204 pass (169 existing + 35 new in `student-joining-code.test.ts`); `tsc --noEmit` clean; `npm run lint` clean.
- `pcmb-paper`: `node --experimental-strip-types --test tests/*.test.mjs` 112/112; `tsc --noEmit` clean; `expo lint` clean.
- New tests cover code generation and format, no plaintext storage, collisions, regeneration, revocation, expiry, brute-force lockout, invalid/duplicate/concurrent requests, unauthorized roles, cross-tuition isolation (single and bulk), pending/rejected access, individual/bulk approve and reject, concurrent double approval, a member who joined elsewhere, a batch turned off mid-way, and existing members.
- One real bug found by the tests and fixed: the partial index had the same default name as the existing `userId_1` index and would have failed to build.
- No new frontend unit tests: the new app code is UI over the API, covered by the emulator run. Existing frontend suite was run as regression.
- Baseline caveat: the backend baseline (169/169) was run after my first small additive model edits, not on a pristine tree. No frontend baseline was run before changing code.

## Android verification (Pixel_7, Expo Go)

Metro for this checkout was already on 8081 (untouched). I started a second Metro on 8082 with `EXPO_PUBLIC_API_URL=local`, a local backend on port 3000, and an **in-memory MongoDB** fixture (since deleted). Production was not contacted. Five screenshots were taken; the rest was checked from UI text dumps.

- Batch Details › Invite Students: shows the code, and the code is stable across reopen (also tested).
- People › Students › Invite Students: batch picker, then the same sheet with that batch's code; Manage Code shows status, expiry, regenerate, update expiry, disable.
- Pending Enrollments: selected 2 of 3, **Approve (2)** worked; they moved into the batch list.
- Student: wrong code error; lowercase code accepted; confirmation screen; Waiting screen; admin approved; **Refresh Status** switched to the existing Student Home with all five tabs.
- An existing approved student logged in and went straight to Home.

Emulator notes: the emulator's autofill filled a saved credential into the login form and it was submitted once, to the local fixture backend only, which rejected it. I turned autofill off during testing and restored it afterwards. The final approval of the new test student was done with the admin API call (the bulk approval itself was done in the app UI).

## Limitations and follow-ups

- **Deploy first.** The app's API origin is the deployed backend; until `papers/` is deployed, the new screens get 404s there.
- Before deploying, check production for duplicate pending `JoinRequest` rows per user. If any exist, building `one_pending_per_user` will fail and the race protection is lost (the app logic still works).
- Rate limit is per account, not per IP.
- Only JEE and NEET batches can have codes (others show "isn't offered yet"), matching the existing accept rules. A batch with no class set creates students without a class.
- Changing `JWT_SECRET` (or `JOIN_CODE_SECRET`) makes stored codes unreadable; the next admin open silently issues a new code. Set `JOIN_CODE_SECRET` to avoid that.
- The old institute-wide join code on Home still exists (teachers use it); its requests keep the old accept flow.
- A rejected student can ask again immediately; there is no cooldown.
- "Add student" is now a secondary button beneath "Invite Students".
