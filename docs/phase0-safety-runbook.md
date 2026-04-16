# Phase 0 Safety Runbook

This runbook establishes the non-disruptive safety baseline before any optimization rollout.

## Scope

- No registration flow behavior changes.
- No schema migration writes.
- No read-path cutover.
- Backup + integrity + rollback preparedness only.

## Commands

Run from project root.

1. Firestore backup (all collections, includes nested subcollections by default)

```bash
npm run backup:firestore
```

Optional collection-scoped backup:

```bash
npm run backup:firestore -- --collections=transactions,participants,hackathon_registrations,workshop_registrations
```

Optional fast snapshot mode (top-level docs only):

```bash
npm run backup:firestore -- --collections=transactions,participants,workshop_registrations,hackathon_registrations,mail,credential_export_events,users,admin_audit_logs --max-depth=0
```

2. Storage metadata backup (default prefix: payments/)

```bash
npm run backup:storage
```

Optional custom prefix:

```bash
npm run backup:storage -- --prefix=payments/
```

3. Verify checksum and JSON integrity for backup artifacts

```bash
npm run backup:verify
```

Optional single-manifest verification:

```bash
npm run backup:verify -- --manifest=scripts/output/backups/firestore-backup-<timestamp>.manifest.json
```

## Output artifacts

Artifacts are written to `scripts/output/backups/`.

- `firestore-backup-<timestamp>.json`
- `firestore-backup-<timestamp>.manifest.json`
- `storage-metadata-backup-<timestamp>.json`
- `storage-metadata-backup-<timestamp>.manifest.json`

Each manifest stores SHA256 for tamper/integrity verification.

## Rollback preparedness

- Keep previous production branch/revision tag before changes.
- Do not delete historical backup artifacts.
- During future phases, keep cutovers behind feature flags from `lib/server/feature-flags.js`.
- If any migration phase fails, rollback strategy is:
  1. Revert feature flag to prior state.
  2. Redeploy previous stable branch.
  3. Re-run runtime health checks (`npm run health:runtime -- <base_url>`).

## Acceptance criteria for Phase 0

- At least one valid Firestore backup + manifest created.
- At least one valid storage metadata backup + manifest created.
- `npm run backup:verify` passes with zero failures.
- No production registration route behavior changed.
