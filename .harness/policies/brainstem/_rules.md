# Brainstem Rules

- No destructive command, schema reset, or forceful infra change without explicit user approval.
- Authentication and authorization invariants outrank implementation convenience.
- Do not trust client-provided `user_id`, prices, roles, or admin state.
- Run the relevant evaluator before claiming completion.
- Keep edits inside the requested scope unless the dependency chain makes expansion necessary.
