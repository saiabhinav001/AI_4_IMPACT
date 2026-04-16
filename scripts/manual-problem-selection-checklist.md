# Problem Selection Final Validation Checklist

Use this checklist after running automated scripts to complete production-grade signoff.

## 1) Timer And Public Release

- Confirm current control state:
  - `npm run ps:timer -- --mode status`
- Arm timer for test window (example: release in 2 minutes):
  - `npm run ps:timer -- --mode arm --release-in-seconds 120 --freeze-duration-minutes 45 --save-snapshot true`
- Verify timer transition through public API:
  - `npm run ps:timer:verify -- --timeout-seconds 240 --poll-interval-ms 3000 --expect-transition true`
- Verify landing CTA and public board manually:
  - Open `/` and click problem statements CTA.
  - Confirm countdown before release.
  - Confirm list appears automatically after release.

## 2) Authenticated Team Lead Flow

- Run full API-level E2E (creates disposable data, restores controls/capacity, cleans test entities):
  - `npm run ps:test:e2e -- --base-url https://ai4impact.web.app --allow-live-mutation true --problem-id PS_DEMO_01 --force-sheet-sync true`
  - If deployed catalog differs from local static catalog, add:
  - `--allow-unknown-problem-id true --problem-id <DEPLOYED_PROBLEM_ID>`
- Manual browser validation with real account:
  - Login as actual team lead.
  - Open team dashboard and verify problem cards/counts.
  - Select problem via modal and confirm freeze text.
  - Refresh dashboard and confirm selected problem persists.

## 3) Strict Concurrency Race

- Run two-lead race for last available slot:
  - `npm run ps:test:race -- --base-url https://ai4impact.web.app --allow-live-mutation true --problem-id PS_DEMO_01 --force-sheet-sync true`
  - If deployed catalog differs from local static catalog, add:
  - `--allow-unknown-problem-id true --problem-id <DEPLOYED_PROBLEM_ID>`
- Expected outcome:
  - Exactly one success and one conflict.
  - Capacity increments by exactly 1 from pre-race state.
  - Exactly one selection document is created.

## 4) Google Sheets Export Integrity

- Verify recent team export events:
  - `npm run ps:sheets:verify -- --limit 20`
- Force retry + require SYNCED (strict mode):
  - `npm run ps:sheets:verify -- --limit 20 --force-sync true --require-synced true`
- Verify targeted event only:
  - `npm run ps:sheets:verify -- --event-id <EVENT_ID> --force-sync true --require-synced true`
- Enforce strict sheet status directly inside E2E/race:
  - Add `--require-sheet-synced true`

## 5) Post-Test Cleanup

- Restore original timer controls using snapshot created by `ps:timer`:
  - `npm run ps:timer -- --mode restore`
- If you no longer need demo problem statements, replace catalog entries in `lib/server/problem-statements.js` with final event statements.
- Re-run static validation before deployment:
  - `npm run lint`
  - `npm run build`

## 6) No-Go Criteria

Do not deploy if any one of the following is true:

- Timer does not transition from `SCHEDULED` to `LIVE`.
- Race test does not produce exactly one winner.
- Capacity counts differ from expected value.
- Any export event status is `FAILED` or `DEAD_LETTER`.
- Dashboard selected problem does not persist after refresh.
