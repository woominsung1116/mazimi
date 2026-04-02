# Harness System

This project uses a service-oriented harness with three layers:

1. `memory-bank/` stores recurring incidents, durable decisions, and promotion history.
2. `policies/` stores NeuronFS-style rules split into immutable brainstem rules and domain rules.
3. `replay/` stores regression cases that must stay green before a rule is promoted.

Use this harness when changing recommendation logic, auth, data ingestion, or deployment-critical code.

Primary entry points:

- `objective.yaml`
- `program.md`
- `results.tsv`
- `memory-bank/facts.tsv`
- `memory-bank/promotions.tsv`

This is intentionally lightweight. It borrows the roles of Memory Bank and NeuronFS without requiring those tools to be installed inside this repository.
