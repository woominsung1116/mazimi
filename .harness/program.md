# Program

## Goal

Use the harness to prevent repeat regressions in security, auth, recommendation quality, ingestion, and deployment-sensitive paths.

## Loop

1. Define the change and the affected surface.
2. Load relevant memory from `memory-bank/facts.tsv` and any open incidents.
3. Run the smallest valid evaluator set for the touched area.
4. If the run fails, write an incident in `incidents/` and add a distilled fact when the failure teaches a durable lesson.
5. If the same failure class repeats, add a replay case under `replay/`.
6. Promote only machine-checkable rules into `policies/`.
7. Re-run replay cases before treating the rule as active.

## Change Classes

- Backend or auth change: `cargo check --workspace`, `cargo test --workspace`
- Frontend change: `pnpm --dir apps/web build`
- Recommendation or ingest change: backend checks plus one replay fixture from `replay/`
- Infra or migration change: evaluator set plus explicit human approval if destructive

## Memory Bank Discipline

- Store episodes in `incidents/` with concrete evidence: prompt, diff, command, failure mode.
- Store only distilled facts in `memory-bank/facts.tsv`.
- A fact should be stable enough to apply to future work.

## Policy Promotion Discipline

Promote a rule only when all of the following hold:

- The failure is repeated or severe.
- The rule is specific enough to enforce.
- A replay case exists or can be written.
- The rule does not overfit one bug and block normal development.
