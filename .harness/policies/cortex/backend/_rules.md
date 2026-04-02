# Backend Rules

- New protected routes must derive identity from trusted auth context.
- New tables or policy-sensitive tables require access-control review before completion.
- Avoid silent contract drift in API payloads.
- Migrations must be reversible or explicitly marked as irreversible with approval.
