# Incident Ledger

Create one incident file per meaningful failure:

- filename: `YYYY-MM-DD-short-slug.md`
- include touched paths, evaluator used, exact failure, root cause, and proposed replay case

Severity guide:

- `critical`: security, auth, data loss, destructive command risk
- `high`: deploy blocker, broken recommendation path, broken ingest
- `medium`: test or build regressions with contained scope
- `low`: workflow misses, non-user-facing friction
