# QuantumLearn game transformation — implementation TODOs

Updated 2026-10-23 against the current `dde1806-instructor-dashboard` worktree and the supplied master prompt. Status is evidence-based; all pre-existing uncommitted work was preserved.

## Completed in the current worktree

- [x] Game shell: academy navigation, HUD, explorer profile entry points, and quick access to Forge/Lab are present.
- [x] World map and curriculum prerequisite utility are implemented and locally unit-tested.
- [x] Circuit Builder, local simulation, circuit repair scenarios, and Quantum Lab framework flows exist.
- [x] Notebook, cosmetics, and event UI/migration scaffolding exist.
- [x] Notebook persistence is now connected to migration 18's `research_notes` table, with an explicit local-only fallback.
- [x] Server-validated XP ledger and streak/badge logic are implemented in migration 20 and the backend reward service; production/RLS validation remains gated.
- [x] Repair page, private server-side challenge scoring, UTC daily challenge, and approved alias route are implemented; backend/API and browser validation remain blocked.
- [x] Eight-zone Command Hub and persistent ordered sector/mission catalog are implemented; migrations 21-22 are unapplied.
- [x] Lesson mission status now reflects the app's existing `module_progress` records; this display status does not award XP. Migration 22 explicitly revokes public/anonymous/authenticated write privileges before granting authenticated read access.
- [x] AI Tutor Edge Function now requires a verified user, configured origin allowlist, bounded input, and a persistent per-user quota; provider credentials remain server-side.
- [x] Contest leaderboard scoping/pagination and no-QPU score normalization are implemented; backend tests remain unrun.
- [x] Post-MVP feature boundaries are documented in [POST_MVP_ROADMAP.md](./POST_MVP_ROADMAP.md).

## Next implementation priorities

- [ ] Reconcile production schema and migration history; apply required migrations only to an approved non-production project, then run authenticated persistence/RLS checks. Production stays frozen until explicit authorization.
- [x] Replace the Event Calendar runtime feed with `learning_events` reads, loading/error/empty states, and route-safe entry actions. Displayed XP is informational only and is never awarded by the client.
- [ ] Add an authorized admin/instructor event-management path. The current RLS policy intentionally permits learner reads only; publish/edit/delete must be server-side or protected by a role policy.
- [ ] Make cosmetic equip/unlock persistence use `user_cosmetics`; award unlocks only from the server-side reward pipeline.
- [ ] Complete trusted streak updates and quest completion in a database RPC/service transaction; test duplicate and concurrent reward attempts.
- [ ] Implement durable boss/challenge resume against the migration 17 schema and verify ownership.
- [ ] Add a real keyboard/mobile accessibility audit for HUD, sidebar, circuit controls, and map nodes; honour reduced motion.
- [ ] Add authenticated E2E coverage for sign-in, a mission checkpoint, circuit verification, reward history, refresh persistence, and cross-user isolation.
- [ ] Verify Google OAuth, IBM/qBraid providers, Render deployment configuration, and the deployed commit after owner credentials/access are available.

## Verified baseline

- [x] `npm run build` passed on 2026-10-23 after the current UI changes.
- [x] `npm test` passed: 32 tests, 0 failures.
- [ ] Backend pytest cannot execute: the workspace interpreter resolves to a Python executable outside the allowed sandbox path and access is denied. Pylance syntax checks pass, but they are not runtime tests.
- [ ] Playwright E2E does not reach assertions because its Chromium executable is missing from the isolated runner.

## PRD alignment update (2026-10-22)

- [x] Reduced-motion preference is honoured globally; no learning result depends on animation.
- [~] Repair Circuit has a hidden backend catalogue, server-side Qiskit state-fidelity evaluator, authenticated alias, UTC daily selection, and tests. Backend execution, migration/RLS, browser, and user-token privacy verification remain.
- [x] Migration 20 reconciles the existing `gamification_rewards` ledger to `xp_events`; migration application is still blocked pending approved schema reconciliation.
- [x] The owner confirmed that the shared daily circuit ships in the MVP.

## Phase 1 audit and plan (2026-10-22)

- The selected worktree branch is `dde1806-instructor-dashboard`.
- The product must be game-first: learning actions restore Quantum Station, and Repair success is server-simulator validated.
- The owner's enumerated list contains 45 topics. A header in the master prompt said 46; the enumerated list is authoritative.
- Repository migration files reach 19. The repository is the source of truth for migration numbering; new migrations start at 20.
- User-supplied production migration-list evidence shows numbered migrations 01-19 are not recorded in production, while four production-only timestamped migrations are applied. Their exact SQL and schema equivalence must be reconciled before any production migration push; the separate branch database remains unverified. Details and a safe reconciliation sequence are in [the discrepancy register](./phase1-discrepancy-register.md).
- Phase 1 audit and Phase 2 plan were approved. Implementation for Phase 2 and partial Phase 3-5A work is recorded in [the Phase 1 audit plan](./PHASE1_AUDIT_PLAN.md), including the 45-topic traceability matrix.
- Phase 2/3 and new Phase 4/5A code are not gate-passed until backend tests, browser E2E, database/RLS checks, and regression evidence are available.
- No production migration, migration-history repair, deployment, or commit was performed.
