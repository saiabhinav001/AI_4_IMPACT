# Phase 4 Read-Model Cutover Runbook

This runbook completes Phase 4 with a safe, non-disruptive cutover process for admin registrations reads.

## Safety principles

- Keep registration submissions unchanged.
- Keep legacy source reads available as fallback.
- Do not enable cutover flag before backfill + parity checks pass.
- Use instant rollback by disabling the read-model flag.

## Commands

Run from project root.

1. Backfill read model (limited first)

```bash
npm run readmodel:backfill -- --limit=200
```

2. Full backfill

```bash
npm run readmodel:backfill
```

3. Verify parity (read-only)

```bash
npm run readmodel:verify -- --fail-on-mismatch=true
```

Optional scoped parity checks:

```bash
npm run readmodel:verify -- --type=hackathon --status=verified --fail-on-mismatch=true
npm run readmodel:verify -- --type=workshop --status=pending --fail-on-mismatch=true
```

4. Check runtime readiness endpoint (admin-auth required)

```text
GET /api/admin/read-model-status
```

This endpoint returns:

- source/read-model counts
- coverage percentage
- latest-source vs latest-read-model lag
- feature flag state
- ready_for_cutover recommendation

## Cutover activation

1. Enable feature flag:

```text
FEATURE_ADMIN_READ_MODEL_ENABLED=true
```

2. Verify admin registrations responses include:

- `x-admin-data-source: read-model` or `read-model-empty`
- expected data in admin dashboard

3. Monitor for fallback cases (`x-admin-data-source: source`) and resolve by rerunning backfill/parity.

## Rollback

Disable the flag immediately:

```text
FEATURE_ADMIN_READ_MODEL_ENABLED=false
```

Because legacy source reads are still intact, rollback is instant and non-destructive.

## Acceptance criteria

- Backfill completed successfully.
- `readmodel:verify` reports zero mismatches.
- `/api/admin/read-model-status` reports `ready_for_cutover=true`.
- Admin dashboard functions normally with no registration flow impact.
