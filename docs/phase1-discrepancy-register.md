# Phase 1 Discrepancy Register

**Status:** Phase 1 audit and plan sign-off are closed. Production migration reconciliation and Repair release verification remain gated.  
**Worktree branch:** `dde1806-instructor-dashboard`  
**Scope:** Documentation update only. The session record shows no application-code or SQL-migration changes were made as part of the Phase 1 audit. The user-supplied working-tree status lists uncommitted code changes, including `repair_service.py` and migration 19; their prior provenance and purpose are not established here. They were left untouched, not reverted or stashed.

## Confirmed scope decisions

- Product branch: `dde1806-instructor-dashboard`.
- The shared daily circuit ships in the MVP.
- Enumerated topics: 45. A header in the master prompt said 46; the enumerated list is authoritative.
- The product is game-first: learning actions restore Quantum Station, and repair success comes from the real server-side simulator. This is not a separate arcade game.
- Deployment is MVP-prepared. Production deployment requires separate approval.

## Three Phase 1 findings

### 1. Does the authenticated Repair handler use state-vector fidelity?

**Yes, code-verified.** The authenticated `POST /api/challenges/repair/{challenge_id}/attempt` handler calls `evaluate_attempt()`. That evaluator builds Qiskit `Statevector` instances and compares them with `state_fidelity()`. It is not histogram-only. `public_challenge()` returns target probabilities but does not return `correct_ops`. The solution catalogue is currently a private backend module constant.

**Evidence:** `quantum_backend/app/routers/challenges.py`, `quantum_backend/app/services/repair_service.py`, and `quantum_backend/app/security.py`.

**Scope effect:** State-vector validation is already present, so adding it is not a Phase 3 scope increase. Phase 3 still needs to prove phase-only fault behavior with tests and enforce solution privacy against a learner token.

### 2. Are migrations 15-19 applied in production, on the branch only, or both?

The user supplied the output of `npx supabase migration list --linked` and identified the linked Supabase project `ratxvcoaogyfnwrcxjhz` as the production project on the `main` / `PRODUCTION` branch. According to that output, none of the repository's numbered migrations 01-19 are recorded in production's migration history. Production instead has four applied timestamped versions that have no matching migration files in this worktree. This is a known history divergence, not an unknown migration-history status. The output does not establish whether any numbered migration's schema effects were applied manually or through another path; schema effects must be diffed separately. The audit agent did not independently connect to Supabase; the evidence below is user-supplied.

The status of a separate branch-linked/non-production database remains unknown. Do not push numbered migrations to production until the divergence is reconciled and reviewed.

| Migration version | Worktree file present | Separate branch database | Production project `ratxvcoaogyfnwrcxjhz` | Evidence |
|---|---|---|---|---|
| 01-14 | Yes, numbered local migration files | Not verified | Not recorded in migration history; schema effects unknown | User-supplied linked production migration-list output; Remote column blank. |
| 15 | Yes: `supabase/migrations/15_gamification.sql` | Not verified | Not recorded in migration history; schema effects unknown | User-supplied linked production migration-list output; Remote column blank. |
| 16 | Yes: `supabase/migrations/16_gamification_leaderboard.sql` | Not verified | Not recorded in migration history; schema effects unknown | User-supplied linked production migration-list output; Remote column blank. |
| 17 | Yes: `supabase/migrations/17_notifications_and_challenges.sql` | Not verified | Not recorded in migration history; schema effects unknown | User-supplied linked production migration-list output; Remote column blank. |
| 18 | Yes: `supabase/migrations/18_research_notes_and_inventory.sql` | Not verified | Not recorded in migration history; schema effects unknown | User-supplied linked production migration-list output; Remote column blank. |
| 19 | Yes in the supplied worktree inventory: `supabase/migrations/19_repair_circuit_attempts.sql` | Not verified | Not recorded in migration history; schema effects unknown | User-supplied linked production migration-list output; Remote column blank. The file is listed as untracked in the supplied `git status`; provenance is not established by this audit. |
| 20261006143615 | No matching local file identified | Not verified | Applied, 2026-10-06 14:36:15 UTC | User-supplied linked production migration-list output. |
| 20261006143635 | No matching local file identified | Not verified | Applied, 2026-10-06 14:36:35 UTC | User-supplied linked production migration-list output. |
| 20261006145718 | No matching local file identified | Not verified | Applied, 2026-10-06 14:57:18 UTC | User-supplied linked production migration-list output. |
| 20261006150122 | No matching local file identified | Not verified | Applied, 2026-10-06 15:01:22 UTC | User-supplied linked production migration-list output. |

#### Recommended production migration reconciliation (no commands run)

1. Freeze all migration pushes and schema changes to production until a reviewed reconciliation plan is approved.
2. Treat the four timestamped versions as authoritative production history, not as disposable “rogue” entries. Recover their exact SQL and order from the original deployment source, Supabase dashboard/API history, CI artifacts, backups, or the responsible developer. Preserve the original versions and contents in the migration source of truth; do not invent replacement SQL from version names.
3. Take/verify a production backup and compare the live production schema, policies, functions, triggers, and relevant data with a clean local database built from the numbered migrations. Determine which numbered migration effects are absent, equivalent, or conflicting.
4. Do not run numbered migrations 01-19 against production merely because their Remote cells are blank. Do not delete or rewrite the four applied production versions. Rehearse the complete local numbered chain against a production-like copy. If production already has the cumulative effects of a numbered migration, consider recording that version as applied in history only (for example, `supabase migration repair --status applied`) after exact schema/data equivalence is demonstrated and the owner approves. History repair does not apply the SQL.
5. If a numbered migration's effects are absent, partial, or conflicting, do not mark it applied and do not blindly replay it. First design and rehearse an explicit production baseline/reconciliation path that preserves production data and the four timestamped history entries; apply only reviewed forward changes after separate approval. Future local migrations remain 20 or later, but the number alone does not make a migration safe to run. Keep the non-production branch database assessment separate; its status is currently unknown.

No migration repair, application, schema edit, or production operation has been performed in this audit. Phase 1 remains open until the four SQL definitions and schema equivalence/divergence are reviewed and the owner approves the reconciliation approach.

### 3. Is the seven-region map static or wired to real progress?

**It is wired to learner progress, not a static completion map (code-verified).** `WorldMap` reads `progress` from `useProgress()`. `ProgressProvider` loads progress for the authenticated user through `storage.getProgress(user.id)`. That method reads `module_progress` for the user and derives `completedModules`; `getWorldMap()` calculates region completion, lock state, and progress from those module IDs.

If Supabase is unavailable or records are absent, the storage layer can return default progress. The live data path has not been re-tested in this Phase 1 audit. The current page remains a seven-region curriculum map, not the PRD's Command Hub with eight game zones and Study mode.

**Evidence:** `src/pages/WorldMap/WorldMap.jsx`, `src/utils/worldMap.js`, `src/context/ProgressContext.jsx`, and `src/utils/storage.js`.

## Discrepancy register

| PRD claim | Repo fact | Resolution | Evidence |
|---|---|---|---|
| Migration history ends at 14 and new work begins at 15. | Worktree has numbered migrations 01-22. Production history does not record numbered 01-19 and instead has four production-only timestamped applied versions; whether numbered migration effects exist in production schema is unknown. Separate non-production branch DB status is also unknown. Local migrations 20-22 are unapplied. | Repo numbering remains source for new migrations. Production is frozen pending recovery of four SQL definitions and schema comparison. Consider history-only repair only after proven equivalence; otherwise plan forward-only reconciliation. Never blindly push local migrations. | User-supplied `npx supabase migration list --linked` output for project `ratxvcoaogyfnwrcxjhz`; local migration inventory. |
| Repair refers to the existing browser `CircuitPuzzle` and has no authenticated server endpoint. | A backend-only catalogue has two challenges, a Qiskit state-vector fidelity evaluator, authenticated GET/POST APIs, and attempt persistence schema. The daily endpoint selects one public challenge deterministically by UTC date. | Keep one evaluator and one scoring path. The approved alias uses the same authenticated handler. Backend/API behavior remains unverified because pytest could not run in the sandbox. | `src/components/CircuitPuzzle.jsx`; `quantum_backend/app/services/repair_service.py`; `quantum_backend/app/routers/challenges.py`; `quantum_backend/app/schemas.py`; `supabase/migrations/19_repair_circuit_attempts.sql`. |
| The game world map is a proposed/new map. | Seven progress-aware regions now appear alongside an eight-zone Command Hub; Study remains reachable through the Training Grounds zone. | Preserve existing progress derivation. The World Map now renders persistent campaign sectors/missions from an authenticated API; its new migration and responsive/keyboard behavior still need non-production and E2E validation. | `src/pages/WorldMap/WorldMap.jsx`; `src/utils/worldMap.js`; `src/utils/commandZones.js`; `supabase/migrations/22_ordered_game_missions.sql`. |
| Missions do not exist. | The backend verifies circuit objectives. Migration 22 adds ordered sector/mission/step tables and seed catalog; authenticated API derives completion from server-owned XP events. | Keep mission completion and XP server-authoritative. Apply migration only after owner-approved non-production schema review and test API persistence. | `quantum_backend/app/services/gamification_service.py`; `quantum_backend/app/routers/gamification.py`; `supabase/migrations/22_ordered_game_missions.sql`. |
| The master-prompt line says migrations start at 15. | This repository now has local migration files through 22. | Explicit override: repository numbering wins; do not edit or renumber existing migrations. Migrations 20-22 remain unapplied pending approved database reconciliation. | `supabase/migrations/15_gamification.sql` through `22_ordered_game_missions.sql`. |
| Profile and AI hint wording are POST-MVP in the original topic labels. | Profile editing, instructor analytics, and AI Tutor client surfaces exist. The Edge Function now contains authentication, exact-origin allowlisting, bounded inputs, and DB-backed per-user quota enforcement. | These specified surfaces are Phase 5A MVP scope. Runtime integration, 50-question quality set, database quota/RLS, and role privacy tests remain open. Custom avatar production readiness and learner analytics stay deferred. | `src/pages/Profile/Profile.jsx`; `src/pages/Instructor/InstructorDashboard.jsx`; `supabase/functions/ai-tutor/index.ts`; `supabase/migrations/21_ai_tutor_quotas.sql`. |
| The PRD asks for `POST /api/game/repair/{id}/attempt`. | The authenticated alias `/api/game/repair/{challenge_id}/attempt` and original `/api/challenges/repair/{challenge_id}/attempt` now share one handler and scorer. | Owner-approved contract implemented; route tests are present but have not run. No second scoring implementation. | `quantum_backend/app/routers/challenges.py`; `quantum_backend/app/schemas.py`; `quantum_backend/app/services/repair_service.py`. |
| Repair is an MVP user-facing surface at `src/pages/RepairCircuit/RepairCircuit.jsx`. | The authenticated Repair page now exists and uses the daily challenge API plus server-side attempt scoring. Hint usage is capped at four in the UI and payload schema. | Implementation is present; Phase 3 gate remains open for backend tests, live privacy/RLS verification, browser E2E, accessibility, and responsiveness. | `src/App.jsx`; `src/pages/RepairCircuit/RepairCircuit.jsx`; `src/services/quantumApi.js`; backend router/service. |

## Repair route contract proposal (RFC-style)

**Status:** Approved by owner and implemented; verification remains open.

Retain `POST /api/challenges/repair/{challenge_id}/attempt` for compatibility and expose `POST /api/game/repair/{id}/attempt` as an alias to the same authenticated handler. Both paths must use `require_configured_auth`, the same `RepairAttemptSubmission` schema, `evaluate_attempt()`, and `store.record_repair_attempt()`; there must be one scoring path only.

Request body: `operations` (1-40 gate-operation objects) and `hints_used` (integer 0-4). Response: `{success, result, reward}`, where `result` contains `passed`, `fidelity`, `threshold`, submitted-circuit probabilities, and feedback; `reward` is null for a failed attempt and contains the server award result on a pass. The correct operation sequence remains backend-only in the current private challenge catalogue. If moved to Postgres, the solution column must only be available to the service role, and public challenge responses must omit it.

## Phase 1 closure conditions

- Record linked-environment migration status and schema equivalence before any migration-history repair or production push.
- Preserve this register and update it at each later phase gate.
- The route contract is approved; preserve the one-scorer invariant when extending it.
- Phase 1 contains no production source changes, SQL changes, migration application, or deployment.
