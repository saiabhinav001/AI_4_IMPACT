# Firebase App Hosting Cutover Runbook

## Verified current state (2026-04-13)
- Live traffic is currently on Firebase Hosting static export: https://ai4impact.web.app
- App Hosting backend already exists: `ai4impact-backend`
- Backend currently has no linked repository, and no app is being served at its hosted domain yet
- This is why pushing commits to GitHub does not auto-deploy your live app

## What this repository now includes
- `apphosting.yaml` for Cloud Run runtime sizing
- `.firebaserc` with default project binding (`ai4impact-cc315`)
- `deploy-apphosting.ps1` for both source deploy and branch rollout
- `scripts/check-runtime-endpoints.mjs` to verify runtime APIs are active
- NPM helpers in `package.json`

## Safety-first migration (no registration disruption)

### Phase 1: Keep production unchanged
- Keep using current static deploy for public traffic.
- Do not switch user-facing links yet.

### Phase 2: One-time App Hosting setup (required from your side)
In Firebase Console > Hosting & Serverless > App Hosting:
1. Open backend `ai4impact-backend`.
2. Add environment variables from your local env (same names, same values).
3. Keep automatic rollout disabled until validation is complete.

Required environment variable keys:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_ADMIN_EMAILS`
- `ADMIN_EMAILS`
- `FIREBASE_EMAIL_QUEUE_COLLECTION`
- `NEXT_PUBLIC_APP_URL`
- `TEAM_PASSWORD_SETUP_CONTINUE_URL`
- `CREDENTIAL_EMAIL_INFLIGHT_STALE_MINUTES`

### Phase 3: Create first App Hosting deployment from local source
Run from repo root:

```powershell
npm run apphosting:backend:get
npm run apphosting:deploy:source
```

Then validate runtime endpoints on the hosted domain:

```powershell
$env:APP_BASE_URL = "https://ai4impact-backend--ai4impact-cc315.us-central1.hosted.app"
npm run health:runtime
```

Expected result: all checks pass and API routes return JSON responses (not Hosting 404 HTML).

### Phase 4: Enable GitHub-driven rollouts (for auto deploy on push)
In Firebase Console > App Hosting backend settings:
1. Connect the GitHub repository for this project.
2. Set live branch to `main`.
3. Keep automatic rollout disabled until one manual branch rollout succeeds.

Then run:

```powershell
npm run apphosting:rollout:main
```

After this succeeds, enable automatic rollouts in backend settings.

### Phase 5: Smoke test critical journeys on hosted domain
- Registration page load and submit flow
- Admin login and registration list fetch
- Verify payment path for hackathon
- Team ID login resolve and team dashboard load

### Phase 6: Controlled cutover
- Move your public domain to App Hosting only after Phase 3 through Phase 5 are clean.
- Keep static Hosting deployment path available as immediate rollback.

## Rollback plan
If runtime issues appear after cutover:
1. Revert domain traffic to previous static Hosting endpoint.
2. Continue registrations on static deployment.
3. Fix App Hosting env/config and create a new rollout.
4. Re-run runtime health checks before retrying cutover.
