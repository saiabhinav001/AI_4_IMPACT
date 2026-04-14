# Credential Sheets Sync Runbook

This runbook covers safe rollout of credential export to Google Sheets for hackathon teams.

## Trigger points

A credential export event is created when:

- admin marks hackathon payment as `verify` (`POST /api/admin/verify-payment`)
- admin regenerates credentials (`POST /api/admin/regenerate-team-credentials`)

Each successful action creates one event document in Firestore collection `credential_export_events`.

## Safety properties

- Credential issuance and event creation are committed in the same Firestore batch.
- Admin action success does not depend on Google Sheets availability.
- Sheets sync is best-effort and retryable.
- Deterministic sequence allocation maps each event to a fixed sheet row to avoid duplicate rows on retries.

## Required environment variables

Set these on App Hosting backend before enabling:

- `CREDENTIAL_SHEET_SYNC_ENABLED=true`
- `GOOGLE_SHEETS_SPREADSHEET_ID=<spreadsheet_id>`
- `GOOGLE_SHEETS_WORKSHEET=Sheet1`

Credentials for Google Sheets auth can be provided either as:

- `GOOGLE_SHEETS_CLIENT_EMAIL` + `GOOGLE_SHEETS_PRIVATE_KEY`

or fallback to existing backend Firebase Admin credentials:

- `FIREBASE_ADMIN_CLIENT_EMAIL` + `FIREBASE_ADMIN_PRIVATE_KEY`

Optional tuning:

- `CREDENTIAL_EXPORT_EVENTS_COLLECTION=credential_export_events`
- `CREDENTIAL_EXPORT_COUNTER_DOC=credential_sheet_sync`
- `CREDENTIAL_SHEET_HEADER_ROWS=1`
- `CREDENTIAL_SHEET_SYNC_TIMEOUT_MS=3500`
- `CREDENTIAL_SHEET_SYNC_MAX_RETRIES=15`
- `CREDENTIAL_SHEET_SYNC_RETRY_BASE_SECONDS=30`
- `CREDENTIAL_SHEET_SYNC_RETRY_MAX_SECONDS=3600`

## Sheet schema (A:Z)

1. sequence_no
2. event_id
3. event_type
4. event_created_at
5. transaction_id
6. registration_ref
7. registration_type
8. college_name
9. team_size
10. team_id
11. credential_version
12. password_issued
13. temporary_password
14. leader_name
15. leader_email
16. leader_phone
17. issued_by_admin_uid
18. issued_by_admin_email
19. source
20. request_id
21. sheet_sync_status
22. sheet_synced_at
23. mail_status
24. mail_sent_at
25. mail_error
26. notes

Header management:

- Sync worker auto-writes canonical headers to row 1 (`A1:Z1`) if missing or mismatched.

## Rollout steps

1. Keep `CREDENTIAL_SHEET_SYNC_ENABLED=false` and deploy code.
2. Verify admin verify/regenerate actions still work normally.
3. Configure service-account env vars in App Hosting.
4. Set `CREDENTIAL_SHEET_SYNC_ENABLED=true`.
5. Run a controlled verify/regenerate action on a test team.
6. Confirm row appears in Google Sheet.

## Replay pending/failed events

Use:

```bash
npm run sheets:sync:pending -- 100
```

Force retry including dead-letter:

```bash
npm run sheets:sync:pending -- 100 --force
```

## Monitoring checks

- Firestore: count events with `sheet_sync.status in ["FAILED", "DEAD_LETTER"]`.
- Google Sheets: sequence continuity (no missing rows in active range).
- Admin flows: verify/regenerate response times remain acceptable.
