# QuantumLearn Game-First Phase Plan

**Audit date:** 2026-10-22  
**Selected worktree branch:** `dde1806-instructor-dashboard`  
**Status:** Phase 1 is closed. Phase 2/3 implementations and Phase 4/5A additions are in the worktree, but release gates remain open. Latest frontend build and 32 unit tests pass. Backend pytest is blocked because the sandbox denies the configured Python executable. Playwright could not launch because Chromium is unavailable to the runner. Database migrations 19-22 have not been applied; production reconciliation and deployment remain explicitly gated.

Read the [Phase 1 discrepancy register](./phase1-discrepancy-register.md) for evidence, migration status, and the approved Repair API contract. Post-MVP items are explicitly recorded in [POST_MVP_ROADMAP.md](./POST_MVP_ROADMAP.md).

## Product direction

Build a game where the learning action is the game action. Learners restore Quantum Station by studying, building circuits, and repairing quantum systems; repair success and all rewards come from server-validated learning events. Do not add a separate arcade game.

**What the MVP demo will show:** sign-in and placement assessment, a Quantum World Command Hub, a reachable Study mode, sector 1-2 learning missions, an actual Repair Circuit puzzle, Qiskit state-vector validation, event-backed XP and badges, and a clear next learning action. The shared daily circuit is included in MVP and must be deterministic from a date seed without exposing its repair solution.

**What the MVP demo will not show:** IBM Quantum hardware results, AI-selected learning plans, compulsory rankings or leaderboards, delivered email/push notifications, cosmetic purchases, a generalized boss-battle framework, or race animations represented as measured quantum speedups. Production deployment is gated by separate owner approval. Deployment remains MVP-prepared and must be locally build/serve verified or verified on an approved preview/staging URL.

## Phase 1 findings

1. **Repair scoring:** The current authenticated handler calls Qiskit's `Statevector` and `state_fidelity`, not histogram overlap. This is code-verified; the API behavior and learner-token privacy still require tests.
2. **Migrations:** User-supplied `npx supabase migration list --linked` output identifies the linked target as production project `ratxvcoaogyfnwrcxjhz`. None of local numbered migrations 01-19 are recorded in its migration history; four production-only timestamped versions are recorded as applied. The output does not prove whether numbered migration effects were applied manually. A separate non-production branch DB remains unverified. Production migration pushes are frozen pending recovery of the timestamped SQL and schema reconciliation.
3. **World map:** The existing seven-region map is dynamic and derives its progress from the signed-in learner's completed-module records through `ProgressContext` and `storage.getProgress()`. It is not yet the eight-zone Command Hub and does not provide Study mode.
4. **Missions:** Three server-checked circuit mission definitions currently exist as hard-coded backend constants. Persistent ordered mission/step records for sectors 1-2 are still planned.
5. **Migration baseline:** The prompt's baseline says 14, but the repository contains 19 migration files. Repo wins; new migrations begin at 20.
6. **Repair API:** The approved authenticated alias `/api/game/repair/{challenge_id}/attempt` now points to the same scorer as `/api/challenges/repair/{challenge_id}/attempt`. Backend route tests are present but have not run.
7. **Repair UI path:** The authenticated Repair Circuit page now loads the server-selected UTC-daily challenge, uses the existing attempt API, and caps client hint reporting at four. Server-side state-vector scoring keeps solutions private. The production build passes; browser interaction and learner-token privacy are not E2E-verified.

## Todo ledger

Eight work items are listed below. Phase 1 and its plan sign-off are approved and closed; Phase 2 is active. Production migration reconciliation remains a release/deployment prerequisite, not permission to apply or repair migrations. The feature traceability matrix below is separate and has one row per enumerated topic.

| # | Todo | Status | Exit condition |
|---|---|---|---|
| 1 | Complete Phase 1 audit and discrepancy register | Done; production reconciliation remains gated | Record the migration-list evidence and discrepancies; owner approved the reconciliation plan. Recover/review the four timestamped definitions and prove schema equivalence before any migration-history repair or production push. |
| 2 | Implement Phase 2 server-validated gamification | In progress; validation blocked | Build passes and all 32 frontend tests pass. Backend pytest and Playwright remain unverified because sandbox restrictions blocked the configured Python executable and required browser/service paths. Validate API identity binding, live non-production RLS, idempotency, no client XP writes, real badge actions, and regression before closing. Do not apply migration 20 to production. |
| 3 | Implement Phase 3 verified repair learning | Implementation in progress; gate open | Repair UI, authenticated API alias, daily UTC challenge selection, state-vector scorer, and phase-only/private-solution tests are present. Run backend/API tests and verify hint rewards, accessibility, responsiveness, and browser regression before closing. |
| 4 | Implement Phase 4 game-world missions | Implementation in progress; migration/evidence gates open | Ordered sectors, missions, steps, RLS, seeded content, authenticated API, and World Map catalog UI are implemented. Apply only in an approved non-production environment and verify keyboard/mobile first-session behavior. |
| 5 | Complete Phase 5A MVP surfaces | Implementation in progress; security/evidence gates open | AI Tutor now validates user tokens, applies an origin allowlist and DB-backed quotas, bounds payloads, and keeps provider secrets server-side. Contest scoring/leaderboard fixes are implemented. Profile editing and instructor analytics already exist. Verify integration, role privacy, content quality, and regression. |
| 6 | Record Phase 5B post-MVP stubs | Roadmap documented; optional participation/control work remains | [POST_MVP_ROADMAP.md](./POST_MVP_ROADMAP.md) names rankings, notifications, avatar upload, cosmetics, experiments, races, boss capstone, and learner analytics; confirm existing partial implementations remain clearly labeled and gated. |
| 7 | Verify Phase 6 release gates and traceability | Pending | Test suites, API/RLS security, accessibility, device checks, regression, and evidence matrix are recorded. |
| 8 | Sign off the revised Phase 2 plan after Phase 1 | Done | Owner approved the 26-42 day estimate, Phase 2, and the single-scorer Repair route alias contract. |

## Phases, files, gates, and estimates

Estimates are engineering effort, not calendar duration. They exclude owner review delays, unavailable Supabase access, content-authoring time beyond the stated challenge set, and production deployment.

| Phase | Scope and planned files | Gate / evidence | Estimate |
|---|---|---|---:|
| 1. Audit and foundation | `docs/phase1-discrepancy-register.md`, this plan, migration inventory 15-19, auth/config/RLS/test/deployment-path source review. No production code or SQL. | Three audit questions answered with evidence/owner; four production timestamped SQL definitions recovered and reviewed; schema divergence/equivalence documented; route RFC recorded; discrepancy register complete. | 1-2 days, excluding external recovery/access waits. |
| 2. Server-validated gamification | Implemented candidate areas: `quantum_backend/app/services/gamification_service.py`, gamification APIs, XP/streak displays, and `supabase/migrations/20_server_validated_xp_events.sql`. | Build and 32 frontend tests pass. Backend tests exist but cannot run in this sandbox; Playwright and live RLS remain unverified. Phase gate is not passed. Production remains frozen. | 4-6 days. |
| 3. Verified repair learning | Repair service, route alias, daily challenge, UI, and `supabase/migrations/19_repair_circuit_attempts.sql` are implemented. | State-vector scorer/private solution are implemented; tests are present but unrun. Learner-token privacy, reward consistency, broader reference tests, accessibility/device checks, and regression remain. | 7-11 days, including 1-2 days for the restored page. |
| 4. Game world and missions | Eight-zone Command Hub, World Map mission UI, authenticated mission API, and `supabase/migrations/22_ordered_game_missions.sql` are implemented. Lesson mission status reads the existing module-progress record; it does not award XP. | Requires approved non-production migration application, server/API tests, desktop/mobile first-session, keyboard-only, and regression verification. | 5-8 days. |
| 5A. MVP completions | AI Tutor auth/origin/quota/payload safeguards, contest score/leaderboard fixes, Profile editing, and instructor analytics exist in source; quota schema is `supabase/migrations/21_ai_tutor_quotas.sql`. | Backend/Edge Function integration, AI accuracy set, contest query tests, profile/analytics role privacy, XP floor, and regression remain unverified. | 5-8 days. |
| 5B. POST-MVP stubs | Named roadmap artifact in `docs/POST_MVP_ROADMAP.md`; existing partial UI/schema is not described as production-ready. | Preserve explicit deferral and secure participation/ownership controls before expanding any feature. | 1-2 days. |
| 6. Release verification | Unit tests, backend Pytest, Playwright first-session, 50-question AI comparison, security/RLS, accessibility, device and regression evidence, this matrix and discrepancy register. | Every topic has a passing evidence record or an explicit POST-MVP/DEFERRED stub. Production deployment remains separately gated. | 3-5 days. |

**Revised total:** approximately 26-42 engineering days, plus external waiting time. The estimate and Phase 2 authorization have been approved. Production migration reconciliation and deployment still require the approved evidence process and explicit owner authorization.

## Feature traceability matrix

Enumerated topics: 45. A header in the master prompt said 46; the enumerated list is authoritative. The fixed Label vocabulary is `MVP`, `POST-MVP`, `DEFERRED`. The fixed Evidence vocabulary is `code-verified`, `tested`, `verified in use`, `not verified`. No cells are blank. Current evidence is source inspection unless explicitly marked otherwise; the latest frontend build and unit tests passed, while backend pytest, browser E2E, and live services remain unverified. Post-MVP rows name their planned stub artifact.

| # | Topic | Label | Phase | Planned files / artifact | Test or evidence | Evidence | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Authentication | MVP | 1 | `src/context/AuthContext.jsx`, `src/App.jsx`, `quantum_backend/app/security.py` | Source paths read; API auth/RLS tests planned | code-verified | Live role and cross-user checks remain open. |
| 2 | Dashboard | MVP | 4 | `src/pages/Dashboard/Dashboard.jsx`, Command Hub components | Route/source audit; first-session E2E planned | code-verified | Existing dashboard is not yet the Command Hub. |
| 3 | Gamification | MVP | 2 | `quantum_backend/app/services/gamification_service.py`, `src/utils/gamification.js` | API identity/source tests added; execution blocked by sandbox | code-verified | Dynamic source IDs are server-validated; migration and runtime behavior remain unverified. |
| 4 | XP | MVP | 2 | `supabase/migrations/15_gamification.sql`, `19_repair_circuit_attempts.sql`, `20_server_validated_xp_events.sql`, gamification service | Idempotency/RLS/source-allowlist contract tests added; execution blocked | code-verified | Migration 20 is unapplied. Remote schema and live RLS remain unverified. |
| 5 | Levels | MVP | 2 | `gamification_service.py`, `src/utils/gamification.js` | XP threshold tests added; execution blocked by sandbox | code-verified | Backend and frontend retain the square-root progression formula; regression is pending. |
| 6 | Rankings | POST-MVP | 5B | Roadmap stub in this matrix and future rankings route note | Opt-in/privacy acceptance test after implementation | not verified | Stub artifact: this row in `docs/PHASE1_AUDIT_PLAN.md`. |
| 7 | Achievements | MVP | 2 | `Achievements.jsx`, `gamification_service.py`, migration 20 | Badge threshold/award-contract tests added; execution blocked | code-verified | Circuit Builder and Week Warrior are server-unlocked; runtime unlocks are not yet tested against a database. |
| 8 | Badges | MVP | 2 | `Achievements.jsx`, achievement service/migration | Persistence and event-ID tests planned | code-verified | Server awards must be authoritative. |
| 9 | Streaks | MVP | 2 | profile activity date and gamification service | UTC date-boundary/expiry tests added; execution blocked | code-verified | Only server-verified reward dates update streak state; live DB behavior remains unverified. |
| 10 | Quests | MVP | 4 | `gamification_service.py`, dashboard, quest persistence | Determinism/timezone/idempotency tests planned | code-verified | Current daily/weekly quests are derived from reward history, not the full PRD model. |
| 11 | Missions | MVP | 4 | `gamification_service.py`, mission APIs, migration 22 | Catalog and lesson-completion mapping tests added; execution blocked by Python environment access | code-verified | Ordered sectors/missions/steps are persisted by the unapplied migration; lesson completion reads `module_progress`, while circuit/repair completion uses XP events. |
| 12 | Challenges | MVP | 3 | `quantum_backend/app/routers/challenges.py`, repair service, migration 19 | Pytest wrong/duplicate/ownership cases planned | code-verified | Two repair definitions exist; 23 other challenges require audit/integration. |
| 13 | Rewards | MVP | 2 | `15_gamification.sql`, `19_repair_circuit_attempts.sql`, `20_server_validated_xp_events.sql`, reward service | Server event/duplicate tests added; backend execution and migration application remain blocked | code-verified | Migration 20 reconciles the reward ledger into `xp_events`; production schema/history remains frozen and unverified. |
| 14 | Leaderboards | POST-MVP | 5B | Roadmap stub; existing weekly leaderboard API audit | Alias/privacy/opt-out tests after implementation | code-verified | Stub artifact: this row in `docs/PHASE1_AUDIT_PLAN.md`; current API requires privacy audit. |
| 15 | Notifications | POST-MVP | 5B | `supabase/migrations/17_notifications_and_challenges.sql`, notification route | Opt-in/unsubscribe tests after implementation | code-verified | Stub artifact: migration 17 plus this roadmap row. |
| 16 | Personalization | MVP | 4 | `src/utils/adaptive.js`, roadmap/mission recommendation service | Reproducibility tests planned | code-verified | Rule-based recommendation only in MVP. |
| 17 | Avatar | POST-MVP | 5B | `src/pages/Profile/Profile.jsx`, migration 06/storage policy placeholder | Type/size/RLS tests after implementation | code-verified | Stub artifact: profile route and this roadmap row; upload is not MVP. |
| 18 | Customization | POST-MVP | 5B | `src/utils/cosmetics.js`, migration 18 `user_cosmetics` | Zero-stat-effect tests after implementation | code-verified | Stub artifact: existing cosmetics utility/table plus roadmap row. |
| 19 | Progression | MVP | 2/4 | `src/utils/worldMap.js`, `src/utils/adaptive.js` | Fixed-score/prerequisite tests planned | code-verified | Existing map progression uses module completion. |
| 20 | Skilltree | MVP | 2/4 | `src/pages/SkillMap/SkillMap.jsx`, skill utilities | Validated-event skill update tests planned | code-verified | Existing Skill Map is MVP tree; visual tree remains post-MVP. |
| 21 | Worldmap | MVP | 4 | `src/pages/WorldMap/WorldMap.jsx`, `src/utils/worldMap.js`, `src/utils/commandZones.js`, migration 22 | Frontend build and unit tests pass; browser and database checks remain blocked | tested | The seven-region progress map remains, with the eight-zone Command Hub and persistent mission catalog alongside it. |
| 22 | Lessons | MVP | 4 | `src/pages/Module/`, `src/data/modules.js`, topic data | Route and completion XP tests planned | code-verified | Preserve 24 modules/401 topics. |
| 23 | Simulations | MVP | 3 | `src/utils/quantum.js`, backend quantum services | At least 20 browser/Qiskit comparison tests planned | code-verified | Browser and server agreement threshold remains unverified. |
| 24 | CircuitBuilder | MVP | 3 | `src/pages/CircuitBuilder/CircuitBuilder.jsx`, `src/utils/quantum.js` | Save/load, invalid placement, embedded-mode tests planned | code-verified | PRD asks for shared circuit shape and undo/redo/step mode. |
| 25 | QuantumLab | MVP | 3 | `src/pages/QuantumLab/QuantumLab.jsx`, backend quantum routers | Saved-run mission validation tests planned | code-verified | Hardware remains level-8 gated and POST-MVP. |
| 26 | Quizzes | MVP | 4 | `src/pages/Module/`, `src/data/` | Misconception feedback and once-only XP tests planned | code-verified | Existing topic quizzes are client-side. |
| 27 | Assessments | MVP | 4 | `src/pages/KnowledgeTest/`, `src/utils/adaptive.js` | Placement/module pass and XP tests planned | code-verified | Do not claim machine learning. |
| 28 | AI Mentor | MVP | 3/5A | Supabase `ai-tutor` function, `src/components/ai/AITutor.jsx`, migration 21 | Auth/origin/quota/payload safeguards implemented; 50-question and Edge integration tests required | code-verified | Provider secrets stay server-side; live auth/quota deployment remains unverified. |
| 29 | Practice | MVP | 4 | mission steps, daily quests, question generator/revision paths | Always-available action test planned | code-verified | No separate practice screen required. |
| 30 | Contests | MVP | 5A | `src/pages/Contests/Contests.jsx`, contest service/router | Score-cap and pagination tests added; backend execution/live-provider tests remain unavailable | code-verified | QPU-unavailable score normalization and contest-scoped leaderboard pagination are implemented but not runtime-verified. |
| 31 | Races | POST-MVP | 5B | `src/pages/QuantumRace/QuantumRace.jsx`, [POST_MVP_ROADMAP.md](./POST_MVP_ROADMAP.md) | Real-run query-count tests after rebuild | code-verified | Existing page remains illustrative until rebuilt and tested. |
| 32 | BossBattles | POST-MVP | 5B | `src/pages/CircuitBuilder/`, saved challenge API, [POST_MVP_ROADMAP.md](./POST_MVP_ROADMAP.md) | Server-validated capstone test after implementation | code-verified | Existing routes are foundations, not a complete capstone. |
| 33 | Puzzles | MVP | 3 | `src/pages/RepairCircuit/RepairCircuit.jsx`, `src/components/CircuitPuzzle.jsx`, repair service | Phase-only test and tier 1-2 backend/API tests are present; execute with backend runner and browser | code-verified | Private server catalog and state-vector scorer implemented; verification remains blocked. |
| 34 | Experiments | POST-MVP | 5B | backend algorithm routes, Quantum Lab, [POST_MVP_ROADMAP.md](./POST_MVP_ROADMAP.md) | Fixed-example textbook outcome tests after implementation | code-verified | Research-grade experiments remain deferred. |
| 35 | Analytics | MVP | 5A | instructor/admin dashboard, protected reporting RPCs; learner analytics in [POST_MVP_ROADMAP.md](./POST_MVP_ROADMAP.md) | Student-token denial and aggregate reporting tests required | code-verified | Instructor reporting exists; learner-facing analytics remain deferred. |
| 36 | Profiles | MVP | 5A | `src/pages/Profile/Profile.jsx`, profile API/storage | Editable field and role/privacy tests required | code-verified | Profile editing exists; custom avatar production readiness remains deferred. |
| 37 | Persistence | MVP | 1/2/3/4/5A | storage/context/services and migrations 01-22 | Refresh/re-login state tests planned | code-verified | Production history records none of numbered 01-19; whether their schema effects exist is unknown. Four production-only timestamped migrations require reconciliation. Migrations 20-22 are local and unapplied. |
| 38 | Security | MVP | 1-5A | `quantum_backend/app/security.py`, Supabase RLS/functions, AI edge function | API/RLS/token/secret-leak tests planned | code-verified | Code review is not a live security test. |
| 39 | Responsiveness | MVP | 1/3/4 | `src/styles/index.css`, map and repair surfaces | Phone viewport checks at each gate | not verified | Repair narrow viewport and first-session path are explicit gates. |
| 40 | Accessibility | MVP | 1/3/4 | `src/styles/index.css`, map/repair/dashboard components | Keyboard, focus, reduced-motion, contrast/accessibility checks | not verified | Repair power meter may not use color alone. |
| 41 | Integration | MVP | 1 | `quantum_backend/app/main.py`, `render.yaml`, Supabase and quantum services | Local integration/preview check planned | code-verified | External credentials/provider results not tested in this audit. |
| 42 | Testing | MVP | 1/6 | `package.json`, `quantum_backend/tests/`, `tests/e2e/` | Unit/Pytest/Playwright/AI set required | code-verified | Test commands exist; not run in this audit. |
| 43 | Deployment | MVP | 1/6 | `render.yaml`, Dockerfiles, `quantum_backend/app/main.py`, `index.html` | Local production build plus local serve or approved preview/staging URL | code-verified | MVP-prepared; production deploy gated by separate approval. |
| 44 | Regression | MVP | every gate | `docs/TESTING_GUIDE.md`, regression checklist to maintain | Run at each phase gate and log pass/fail | not verified | Existing regression checklist needs per-gate evidence log. |
| 45 | Verification | MVP | every gate | this matrix and `docs/phase1-discrepancy-register.md` | Evidence vocabulary and per-topic tests/paths | code-verified | No feature is “verified in use” from this source-only audit. |

## Approval gate after Phase 1

The owner approved the revised plan and Phase 2, including the single-scorer Repair route alias. Production migration reconciliation, non-production RLS checks, and production deployment remain separately gated. Do not push migrations, repair production migration history, or deploy without explicit owner approval.
