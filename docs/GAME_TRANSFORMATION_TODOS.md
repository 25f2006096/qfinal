# QuantumLearn game transformation — implementation TODOs

Audited 2026-10-20 against the current `dde1806-instructor-dashboard` worktree and the supplied master prompt. Status is intentionally evidence-based; existing uncommitted work was preserved.

## Completed in the current worktree

- [x] Game shell: academy navigation, HUD, explorer profile entry points, and quick access to Forge/Lab are present.
- [x] World map and curriculum prerequisite utility are implemented and locally unit-tested.
- [x] Circuit Builder, local simulation, circuit repair scenarios, and Quantum Lab framework flows exist.
- [x] Notebook, cosmetics, and event UI/migration scaffolding exist.
- [x] Notebook persistence is now connected to migration 18's `research_notes` table, with an explicit local-only fallback.

## Next implementation priorities

- [ ] Apply migrations 15–18 to an approved Supabase project, then run authenticated persistence/RLS checks. This is the gate for real rewards, notifications, leaderboard data, challenge resume, notes, cosmetics, and scheduled events.
- [x] Replace the Event Calendar runtime feed with `learning_events` reads, loading/error/empty states, and route-safe entry actions. Displayed XP is informational only and is never awarded by the client.
- [ ] Add an authorized admin/instructor event-management path. The current RLS policy intentionally permits learner reads only; publish/edit/delete must be server-side or protected by a role policy.
- [ ] Make cosmetic equip/unlock persistence use `user_cosmetics`; award unlocks only from the server-side reward pipeline.
- [ ] Complete trusted streak updates and quest completion in a database RPC/service transaction; test duplicate and concurrent reward attempts.
- [ ] Implement durable boss/challenge resume against the migration 17 schema and verify ownership.
- [ ] Add a real keyboard/mobile accessibility audit for HUD, sidebar, circuit controls, and map nodes; honour reduced motion.
- [ ] Add authenticated E2E coverage for sign-in, a mission checkpoint, circuit verification, reward history, refresh persistence, and cross-user isolation.
- [ ] Verify Google OAuth, IBM/qBraid providers, Render deployment configuration, and the deployed commit after owner credentials/access are available.

## Verified baseline

- [x] `npm run build` passed on 2026-10-20.
- [x] `npm test` passed: 29 tests, 0 failures.
- [ ] Backend/E2E baseline was not rerun in this pass; existing docs record external-service constraints.
