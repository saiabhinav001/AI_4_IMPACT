# AI_4_IMPACT — Codex Agent Instructions

> ⚠️ BEFORE WRITING ANY CODE: Read `node_modules/next/dist/docs/` for the current Next.js
> API conventions. Do NOT rely on training data. This project uses Next.js 16.2.2 with the
> App Router (`src/app/`). APIs, file conventions, and routing may differ from what you know.

---

## COLLABORATION RULES (READ FIRST — NON-NEGOTIABLE)

1. **NEVER change any UI file** — no edits to any `.jsx`, `.tsx`, `.css`, or page/layout
   component unless explicitly told to. UI is already designed and must not be touched.
2. **NEVER change existing logic** unless explicitly instructed. If something already works,
   leave it alone.
3. **DO NOT proceed with assumptions on ambiguous points.** If you are unsure about
   anything — a field name, a collection path, a behavior — STOP and ask the user before
   writing code. List your questions clearly and wait for answers.
4. **One task at a time.** Complete and verify each task before moving to the next.
5. **When you write a new file or modify an existing one, state clearly what you changed
   and why.** No silent edits.
6. **If a file already exists (e.g., `firebaseAdmin.js`, `middleware.js`, `firestore.rules`),
   read it fully before deciding whether to edit or replace it.**

---

## PROJECT OVERVIEW

**AI_4_IMPACT** is a hackathon + workshop registration platform. Users register via a public
form (no user login). Admins manage registrations, verify payments, upload problem statements,
and view analytics through a secure admin dashboard.

**Tech stack:**
- Next.js 16.2.2, App Router (`src/app/`)
- React 19.2.4
- Firebase client SDK v12.11.0 (for public writes only)
- firebase-admin v13.7.0 (for all admin/server operations)
- recharts (charts in admin dashboard)
- Firestore (database)
- Firebase Storage (payment screenshots, submission files)

---

## AUTHENTICATION MODEL

**Users (workshop/hackathon registrants): NO authentication whatsoever.**
- Public users submit registration forms without any login.
- All public writes go through a Next.js API Route Handler (server-side) using the
  Admin SDK, NOT through direct client-side Firestore writes.
- This means the public-facing Firestore rules block all direct client reads/writes.

**Admins: Firebase Authentication + custom claim.**
- Admins log in via Firebase Auth (email/password).
- Admin accounts have a custom claim: `{ admin: true }`.
- All admin operations go through Next.js API Route Handlers that verify the Firebase
  ID token and check `decodedToken.admin === true` before proceeding.
- The `firebaseAdmin.js` (root-level) initializes the Admin SDK. Use it in all API routes.
- Middleware (`middleware.js`) may protect `/admin/*` routes — read it before touching it.

---

## FIRESTORE DATABASE SCHEMA

The database is freshly created and empty. Implement exactly the collections below.
Do not create any other collections without asking first.

---

### Collection: `workshop_registrations`

One document per individual workshop registrant.

```
workshop_registrations/{workshop_id}   ← auto-generated doc ID

Fields:
  workshop_id        string   (same as doc ID, stored redundantly for easy reference)
  participant_id     string   (doc ID of corresponding doc in `participants` collection)
  transaction_id     string   (doc ID of corresponding doc in `transactions` collection)
  payment_verified   boolean  (default: false)
  created_at         Timestamp
```

---

### Collection: `hackathon_registrations`

One document per team.

```
hackathon_registrations/{team_id}   ← auto-generated doc ID

Fields:
  team_id            string   (same as doc ID, stored redundantly)
  team_name          string
  college            string
  team_size          number   (must be 3 or 4)
  member_ids         string[] (array of participant_ids from `participants` collection)
  transaction_id     string   (doc ID of corresponding doc in `transactions` collection)
  payment_verified   boolean  (default: false)
  created_at         Timestamp
```

---

### Collection: `participants`

One document per individual person — whether workshop or hackathon.
This is the single source of truth for personal info (name, email, phone).

```
participants/{participant_id}   ← auto-generated doc ID

Fields:
  participant_id       string    (same as doc ID, stored redundantly)
  name                 string
  email                string    (must be unique across this collection)
  phone                string
  registration_type    string    ("workshop" | "hackathon")
  registration_ref     string    (doc ID in workshop_registrations or hackathon_registrations)
  created_at           Timestamp
```

**Why separate:** Firestore cannot query inside nested arrays. A flat `participants`
collection allows simple email uniqueness checks:
`db.collection('participants').where('email', '==', email)`

---

### Collection: `transactions`

One document per payment submission.

```
transactions/{transaction_id}   ← auto-generated doc ID

Fields:
  transaction_id         string    (same as doc ID, stored redundantly)
  registration_type      string    ("workshop" | "hackathon")
  registration_ref       string    (doc ID in workshop_registrations or hackathon_registrations)
  upi_transaction_id     string    (the transaction ID typed in by the user)
  screenshot_url         string    (Firebase Storage public URL)
  amount                 number    (150 for workshop, 800 for hackathon)
  status                 string    ("pending" | "verified" | "rejected")
  verified_by            string    (admin uid — set when verified/rejected, else null)
  verified_at            Timestamp (set when verified/rejected, else null)
  created_at             Timestamp
```

---

### Collection: `analytics`

A single aggregated document. Updated as a counter every time a new registration
is created. Never scanned — always direct lookup.

```
analytics/summary   ← fixed document path

Fields:
  total_workshop     number   (default: 0)
  total_hackathon    number   (default: 0)
  team_size_3        number   (default: 0)
  team_size_4        number   (default: 0)
  colleges           map      ({ "College Name": count, ... })
  updated_at         Timestamp
```

---

### Collections planned for later phases (DO NOT implement yet):

- `problem_statements` — admin uploads problem statements with scheduled release
- `team_problem_selection` — teams select one problem
- `submissions` — teams submit PPT + GitHub link
- `hackathon_config` — hackathon timing configuration

**Ask before touching any of these.**

---

## FIREBASE STORAGE STRUCTURE

```
/payments/{registration_id}.jpg   ← payment screenshots
                        or .png
```

- File size limit: 5MB
- Allowed formats: jpg, png only
- Storage returns a public URL which is saved in `transactions.screenshot_url`

---

## FIRESTORE SECURITY RULES

Replace the existing `firestore.rules` with the following logic.
The old rules covered a single `registrations` collection — those must be replaced.

Rules to implement:

```
- workshop_registrations: public create blocked (all writes go through Admin SDK server-side)
  admin read/write: allowed if request.auth.token.admin == true

- hackathon_registrations: same as above

- participants: no public access; admin read only

- transactions: no public access; admin read/write

- analytics: no public access; admin read only

- all other collections: deny everything
```

Since all public registration writes go through Next.js API Routes using the Admin SDK,
the Firestore client-side rules for create can be `allow create: if false` — the Admin SDK
bypasses rules entirely. This is intentional and secure.

---

## API ROUTE HANDLERS TO IMPLEMENT

All routes live under `src/app/api/`. Use Next.js App Router Route Handler conventions
(i.e., `route.js` files with exported `GET`, `POST` functions). Read
`node_modules/next/dist/docs/` for the exact current convention before writing.

### Public Routes (no auth required — but validate inputs server-side)

#### `POST /api/register/workshop`
Handles workshop registration.

Steps:
1. Validate all required fields: `name`, `email`, `phone`, `college`,
   `upi_transaction_id`, `screenshot_url` (Storage URL already uploaded by client).
2. Check email uniqueness: query `participants` where `email == email`. If found, return
   400 with message "Email already registered."
3. In a logical batch (use Admin SDK batch writes):
   a. Create doc in `participants`
   b. Create doc in `workshop_registrations` (with `participant_id` and `transaction_id`)
   c. Create doc in `transactions` (status: "pending", amount: 150)
   d. Update `analytics/summary`: increment `total_workshop`, increment
      `colleges[collegeName]` by 1
4. Return 200 with `{ success: true, workshop_id, participant_id }`.

Validation rules:
- All string fields must be non-empty.
- Email must match basic email regex.
- Phone must be 10 digits.

---

#### `POST /api/register/hackathon`
Handles hackathon team registration.

Steps:
1. Validate required fields: `team_name`, `college`, `team_size` (3 or 4),
   `members` (array of `{ name, email, phone }`), `upi_transaction_id`,
   `screenshot_url`.
2. Validate `members.length == team_size`.
3. For each member email, check uniqueness in `participants`. If any email already
   exists, return 400 with message "Email {email} is already registered."
4. In a logical batch:
   a. Create one `participants` doc per member
   b. Create `hackathon_registrations` doc (with `member_ids[]` and `transaction_id`)
   c. Create `transactions` doc (status: "pending", amount: 800)
   d. Update `analytics/summary`: increment `total_hackathon`, increment
      `team_size_3` or `team_size_4` based on team_size, increment `colleges[college]`
5. Return 200 with `{ success: true, team_id }`.

---

#### `POST /api/upload/payment-screenshot`
Handles file upload to Firebase Storage before registration is submitted.

Steps:
1. Accept multipart form data with the image file.
2. Validate file type (jpg/png) and size (max 5MB).
3. Generate a temporary filename (e.g., `payments/temp_{uuid}.jpg`) — the file will be
   renamed/moved when registration is confirmed if needed, or kept as-is.
4. Upload to Firebase Storage using Admin SDK.
5. Return `{ success: true, screenshot_url }`.

> ❓ ASK THE USER: Should the file be uploaded before or after registration form submission?
> (i.e., does the user upload the screenshot first and then get a URL to include in the
> form POST, or should the screenshot and form data be sent together in one request?)
> This affects whether the upload route is separate or part of register routes.

---

### Admin Routes (require valid Firebase ID token with `admin == true` claim)

All admin routes must:
1. Extract the `Authorization: Bearer <idToken>` header.
2. Call `adminAuth.verifyIdToken(idToken)`.
3. Check `decodedToken.admin === true`. If not, return 403.

---

#### `GET /api/admin/registrations`
Returns all registrations for the admin dashboard.

Query params (optional):
- `type`: "workshop" | "hackathon" — filter by type
- `status`: "pending" | "verified" | "rejected" — filter by payment status

Steps:
1. Query `transactions` (optionally filtered by `status`).
2. For each transaction, fetch the corresponding registration doc from
   `workshop_registrations` or `hackathon_registrations` (use `registration_type` and
   `registration_ref`).
3. For workshop: also fetch the `participants` doc via `participant_id`.
4. For hackathon: also fetch all `participants` docs via `member_ids[]`.
5. Return assembled list with all needed fields for admin display.

Response shape per item:
```json
{
  "transaction_id": "...",
  "registration_type": "workshop" | "hackathon",
  "status": "pending" | "verified" | "rejected",
  "amount": 150 | 800,
  "upi_transaction_id": "...",
  "screenshot_url": "...",
  "created_at": "...",
  "verified_at": "...",
  "registration": {
    // workshop: { workshop_id, participant: { name, email, phone, college } }
    // hackathon: { team_id, team_name, college, team_size, members: [...] }
  }
}
```

---

#### `POST /api/admin/verify-payment`
Verifies or rejects a payment.

Body: `{ transaction_id, action: "verify" | "reject" }`

Steps:
1. Verify admin token.
2. Fetch the `transactions/{transaction_id}` doc.
3. If action is "verify":
   - Set `transactions.status = "verified"`, `verified_by = adminUid`, `verified_at = now()`
   - Set `payment_verified = true` on the corresponding registration doc
     (in `workshop_registrations` or `hackathon_registrations`)
4. If action is "reject":
   - Set `transactions.status = "rejected"`, `verified_by = adminUid`, `verified_at = now()`
   - Set `payment_verified = false` on the registration doc
5. Return `{ success: true }`.

---

#### `GET /api/admin/analytics`
Returns aggregated analytics data.

Steps:
1. Fetch `analytics/summary` (single doc read — no scanning).
2. Also fetch count of pending/verified/rejected from `transactions` collection
   (these aren't in the aggregated doc — query by status).
3. Return combined analytics object.

Response shape:
```json
{
  "total_workshop": 0,
  "total_hackathon": 0,
  "total_participants": 0,
  "team_size_3": 0,
  "team_size_4": 0,
  "colleges": {},
  "payments": {
    "pending": 0,
    "verified": 0,
    "rejected": 0
  }
}
```

---

## INITIALIZATION TASK

Before the API routes work, the `analytics/summary` document must exist in Firestore.
Create a one-time setup script or an admin API route:

#### `POST /api/admin/init-db`
(Admin auth required)

Creates `analytics/summary` with all counters set to 0 if it doesn't already exist.
Returns `{ success: true, message: "Already initialized" }` if it exists.

This must be idempotent — safe to call multiple times.

---

## `firebaseAdmin.js` USAGE

The root-level `firebaseAdmin.js` exports the initialized Admin SDK instances.
Before using it in API routes, read the file to understand what it exports.
Expected exports (verify before assuming):
- `adminDb` — Firestore instance
- `adminAuth` — Auth instance
- `adminStorage` — Storage instance

If these aren't exported yet, add them to `firebaseAdmin.js`. Do NOT create a second
admin initialization file.

---

## ENVIRONMENT VARIABLES

Read `.env.example` to see what variables are currently expected. Required variables:

```
# Firebase Client SDK (public — already in .env.example presumably)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin SDK (server-side only — NEVER expose to client)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=
```

Do NOT hardcode any credentials. All secrets go in `.env.local` (gitignored).

---

## WHAT TO IMPLEMENT IN THIS SESSION (PHASE 1)

Focus only on the following. Do not implement anything outside this list without asking.

**Phase 1: Admin Registration Flow**

- [ ] 1. Read and understand existing `firebaseAdmin.js`, `middleware.js`, `firestore.rules`
         before touching anything.
- [ ] 2. Update `firebaseAdmin.js` if needed to export `adminDb`, `adminAuth`, `adminStorage`.
- [ ] 3. Rewrite `firestore.rules` for the new collection structure.
- [ ] 4. Create `POST /api/admin/init-db` route (initialize `analytics/summary`).
- [ ] 5. Create `POST /api/upload/payment-screenshot` route.
         **ASK the user first about upload flow (before or after form fill).**
- [ ] 6. Create `POST /api/register/workshop` route.
- [ ] 7. Create `POST /api/register/hackathon` route.
- [ ] 8. Create `GET /api/admin/registrations` route.
- [ ] 9. Create `POST /api/admin/verify-payment` route.
- [ ] 10. Create `GET /api/admin/analytics` route.

**Do NOT implement** problem statements, team problem selection, submissions, hackathon
timeline, or any admin dashboard UI in this session.

---

## QUESTIONS CODEX MUST ASK BEFORE STARTING

Before writing a single line of code, ask the user the following:

1. **Screenshot upload flow:** Should `POST /api/upload/payment-screenshot` be a
   separate pre-upload step (user uploads image first, gets a URL, then submits the
   form with that URL included), or should the entire form + image be sent as
   multipart in a single request to `/api/register/workshop` and `/api/register/hackathon`?

2. **`firebaseAdmin.js` current exports:** Please share the contents of `firebaseAdmin.js`
   so I can understand what's already initialized before modifying it.

3. **`middleware.js` current contents:** Please share the contents of `middleware.js`
   so I understand existing route protection before touching it.

4. **Admin account setup:** Is there already an admin user created in Firebase Auth,
   or do you need a script/route to set the `admin: true` custom claim on an existing
   user?

5. **Storage bucket name:** Confirm your Firebase Storage bucket name so it can be
   set correctly in the Admin SDK initialization and environment variables.

---

## NOTES ON CODE STYLE

- Use `async/await`, not `.then()` chains.
- Use Admin SDK's `batch()` for multi-document writes that must be atomic.
- All API route handlers must return proper HTTP status codes (200, 400, 403, 404, 500).
- Wrap all Firestore/Storage operations in try/catch and return `{ error: message }` with
  appropriate status on failure.
- Do not use `console.log` for debugging in production paths — use `console.error` for
  actual errors only.
- Follow the existing file naming convention in `src/app/`.