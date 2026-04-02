# Data Rules

- Ingestion changes must preserve source provenance and normalization assumptions.
- Do not silently discard unknown fields without logging or an explicit schema decision.
- Recommendation changes need at least one replay or benchmark case before promotion.
