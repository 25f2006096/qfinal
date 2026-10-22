# Post-MVP feature stubs

These items are explicitly outside the current MVP implementation. Existing UI or schema fragments are not evidence that a production-ready feature has shipped.

| Feature | Current stub / evidence | Deferred completion gate |
|---|---|---|
| Opt-in rankings and leaderboards | Weekly leaderboard API/UI exists; participation consent and privacy controls remain undefined. | Add explicit opt-in/out, exclusion from all aggregate queries when opted out, and cross-user privacy tests. |
| Notifications | In-app notification schema and UI exist. Email, push, delivery retries, and user preferences are not implemented. | Choose delivery provider, consent model, retention policy, and retry/dead-letter behavior. |
| Avatar uploads | Profile page has upload UI and a storage helper. | Validate storage bucket policy, content type/size, ownership, deletion, and abuse handling before production readiness. |
| Cosmetics | Catalog/equip utilities and user-cosmetics schema exist. | Tie unlock/equip authorization to server-owned rewards; test persistence and inventory ownership. |
| Experiments | Quantum Lab supports simulators and algorithm examples. Research-grade experiments and reproducible result records are not a shipped feature. | Define experiment scopes and validation against known reference outcomes. |
| Quantum races | Existing race screen is illustrative, not a measured hardware-performance comparison. | Rebuild using reproducible simulator runs, disclosed shot counts, and tests preventing unsupported speedup claims. |
| Boss capstone | Saved challenge APIs and repair puzzles provide foundations, not a complete boss/capstone progression. | Design a server-validated multi-step objective with ownership, resume, retries, and reward idempotency. |
| Learner-facing analytics | Profile and instructor/admin analytics exist. Learner-facing longitudinal analytics are not implemented. | Define a learner-controlled data view, retention, and export/privacy behavior. |

Production deployment and database migration application are independently gated and are not authorized by this roadmap.
