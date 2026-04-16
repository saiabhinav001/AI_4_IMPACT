import process from "node:process";
import { randomUUID } from "node:crypto";
import { adminAuth, adminDb, FieldValue } from "../firebaseAdmin.js";
import { RUNTIME_ID_TOKEN_HEADER } from "../lib/runtime-auth.js";
import {
  EVENT_CONTROLS_COLLECTION,
  EVENT_CONTROLS_DOC_ID,
  buildDefaultEventControls,
  normalizeStoredEventControls,
} from "../lib/server/event-controls.js";
import {
  MAX_TEAMS_PER_PROBLEM,
  PROBLEM_STATEMENT_CAPACITY_COLLECTION,
  PROBLEM_STATEMENT_CAPACITY_DOC_ID,
  PROBLEM_STATEMENT_SELECTION_COLLECTION,
  getProblemStatementCatalog,
} from "../lib/server/problem-statements.js";

export function asTrimmedString(value) {
  return String(value || "").trim();
}

export function parseCliFlags(argv = process.argv.slice(2)) {
  const flags = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const raw = asTrimmedString(argv[index]);
    if (!raw.startsWith("--")) {
      continue;
    }

    const withoutPrefix = raw.slice(2);
    if (!withoutPrefix) {
      continue;
    }

    const equalsIndex = withoutPrefix.indexOf("=");
    if (equalsIndex > -1) {
      const key = asTrimmedString(withoutPrefix.slice(0, equalsIndex));
      const value = asTrimmedString(withoutPrefix.slice(equalsIndex + 1));
      if (key) {
        flags.set(key, value || "true");
      }
      continue;
    }

    const next = asTrimmedString(argv[index + 1]);
    if (next && !next.startsWith("--")) {
      flags.set(withoutPrefix, next);
      index += 1;
      continue;
    }

    flags.set(withoutPrefix, "true");
  }

  return flags;
}

export function getStringFlag(flags, key, fallback = "") {
  if (!flags?.has(key)) {
    return asTrimmedString(fallback);
  }

  return asTrimmedString(flags.get(key));
}

export function getNumberFlag(flags, key, fallback) {
  const raw = getStringFlag(flags, key, "");
  if (!raw) {
    return fallback;
  }

  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return numeric;
}

export function getBooleanFlag(flags, key, fallback = false) {
  if (!flags?.has(key)) {
    return fallback;
  }

  const value = asTrimmedString(flags.get(key)).toLowerCase();
  if (!value) {
    return true;
  }

  if (["1", "true", "yes", "y", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "n", "off"].includes(value)) {
    return false;
  }

  return true;
}

export function resolveBaseUrl(flags, fallback = "https://ai4impact.web.app") {
  const fromFlags = getStringFlag(flags, "base-url", "");
  const fromEnv = asTrimmedString(process.env.APP_BASE_URL || "");
  const baseUrl = fromFlags || fromEnv || fallback;
  return baseUrl.replace(/\/$/, "");
}

export function resolveApiKey(flags) {
  return (
    getStringFlag(flags, "api-key", "") ||
    asTrimmedString(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "") ||
    asTrimmedString(process.env.FIREBASE_WEB_API_KEY || "")
  );
}

export function isLikelyLiveUrl(baseUrl) {
  return !/https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(
    asTrimmedString(baseUrl)
  );
}

export function assertLiveMutationAllowed(flags, baseUrl) {
  const allowLiveMutation = getBooleanFlag(flags, "allow-live-mutation", false);

  if (isLikelyLiveUrl(baseUrl) && !allowLiveMutation) {
    throw new Error(
      "Refusing to mutate non-local target without --allow-live-mutation=true"
    );
  }
}

export function toIso(value) {
  if (!value) {
    return "";
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function truncateText(value, maxLength = 220) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

export async function signInWithCustomToken({ apiKey, customToken }) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(
      apiKey
    )}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    }
  );

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Custom token sign-in failed (${response.status}): ${truncateText(responseText)}`
    );
  }

  const payload = responseText ? JSON.parse(responseText) : {};
  const idToken = asTrimmedString(payload?.idToken);

  if (!idToken) {
    throw new Error("Custom token sign-in response did not include idToken.");
  }

  return idToken;
}

export async function createRuntimeIdToken({ apiKey, uid, claims = {} }) {
  const customToken = await adminAuth.createCustomToken(uid, claims);
  return signInWithCustomToken({ apiKey, customToken });
}

export async function fetchJson(url, {
  method = "GET",
  idToken = "",
  headers = {},
  body,
  expectedStatuses = [200],
} = {}) {
  const requestHeaders = {
    ...headers,
  };

  if (idToken) {
    requestHeaders[RUNTIME_ID_TOKEN_HEADER] = idToken;
  }

  let requestBody;
  if (body !== undefined) {
    requestHeaders["content-type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: requestBody,
  });

  const responseText = await response.text();
  const contentType = asTrimmedString(response.headers.get("content-type") || "").toLowerCase();

  let json = null;
  if (contentType.includes("application/json") && responseText) {
    try {
      json = JSON.parse(responseText);
    } catch {
      json = null;
    }
  }

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `Unexpected status ${response.status} for ${method} ${url}: ${truncateText(responseText)}`
    );
  }

  return {
    status: response.status,
    headers: response.headers,
    text: responseText,
    json,
  };
}

export function createDisposableIdentity(prefix, label) {
  const suffix = randomUUID().slice(0, 8).toLowerCase();
  const normalizedPrefix = asTrimmedString(prefix || "ps-test").toLowerCase();
  const normalizedLabel = asTrimmedString(label || "a").toLowerCase();

  const uid = `${normalizedPrefix}-${normalizedLabel}-${suffix}`;
  const participantId = `${normalizedPrefix}-participant-${normalizedLabel}-${suffix}`;
  const teamId = `${normalizedPrefix}-team-${normalizedLabel}-${suffix}`;
  const email = `${uid}@example.ai4impact.test`;

  return {
    uid,
    participantId,
    teamId,
    email,
    label: normalizedLabel,
  };
}

export async function createTeamLeadFixture(identity, options = {}) {
  const displayIndex = Number(options?.displayIndex || 1);
  const teamName =
    asTrimmedString(options?.teamName) || `Runtime Test Team ${displayIndex}`;
  const leadName =
    asTrimmedString(options?.leadName) || `Runtime Lead ${displayIndex}`;
  const leadPhone =
    asTrimmedString(options?.leadPhone) || `9000000${String(displayIndex).padStart(3, "0")}`;

  const participantRef = adminDb.collection("participants").doc(identity.participantId);
  const teamRef = adminDb.collection("hackathon_registrations").doc(identity.teamId);

  await participantRef.set(
    {
      name: leadName,
      email: identity.email,
      phone: leadPhone,
      registration_type: "hackathon",
      registration_ref: identity.teamId,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: false }
  );

  await teamRef.set(
    {
      team_name: teamName,
      college: asTrimmedString(options?.college || "Runtime Verification College"),
      team_size: 1,
      member_ids: [identity.participantId],
      payment_verified: true,
      freeze: {
        locked: false,
      },
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: false }
  );

  return {
    participantId: identity.participantId,
    teamId: identity.teamId,
  };
}

export async function deleteTeamLeadFixture(identity) {
  await Promise.allSettled([
    adminDb.collection(PROBLEM_STATEMENT_SELECTION_COLLECTION).doc(identity.teamId).delete(),
    adminDb.collection("hackathon_registrations").doc(identity.teamId).delete(),
    adminDb.collection("participants").doc(identity.participantId).delete(),
    adminAuth.deleteUser(identity.uid),
  ]);
}

export async function readEventControlsRawSnapshot() {
  const ref = adminDb.collection(EVENT_CONTROLS_COLLECTION).doc(EVENT_CONTROLS_DOC_ID);
  const doc = await ref.get();

  return {
    exists: doc.exists,
    data: doc.exists ? doc.data() : null,
  };
}

export async function restoreEventControlsRawSnapshot(snapshot) {
  const ref = adminDb.collection(EVENT_CONTROLS_COLLECTION).doc(EVENT_CONTROLS_DOC_ID);

  if (!snapshot?.exists) {
    await ref.delete();
    return;
  }

  await ref.set(snapshot.data || buildDefaultEventControls(), { merge: false });
}

export async function readNormalizedEventControls() {
  const snapshot = await readEventControlsRawSnapshot();
  return snapshot?.exists
    ? normalizeStoredEventControls(snapshot.data)
    : buildDefaultEventControls();
}

export async function writeEventControlsWithVersion(nextControls, actorEmail = "runtime-script@local") {
  const currentControls = await readNormalizedEventControls();
  const currentVersion = Number(currentControls?.metadata?.version || 0);

  const payload = {
    ...normalizeStoredEventControls(nextControls),
    metadata: {
      ...normalizeStoredEventControls(nextControls).metadata,
      version: Number.isFinite(currentVersion) ? currentVersion + 1 : 1,
      updatedByUid: "runtime-script",
      updatedByEmail: asTrimmedString(actorEmail).toLowerCase(),
      updatedAt: FieldValue.serverTimestamp(),
    },
  };

  const ref = adminDb.collection(EVENT_CONTROLS_COLLECTION).doc(EVENT_CONTROLS_DOC_ID);
  await ref.set(payload, { merge: false });

  return payload;
}

export async function readCapacityRawSnapshot() {
  const ref = adminDb
    .collection(PROBLEM_STATEMENT_CAPACITY_COLLECTION)
    .doc(PROBLEM_STATEMENT_CAPACITY_DOC_ID);

  const doc = await ref.get();

  return {
    exists: doc.exists,
    data: doc.exists ? doc.data() : null,
  };
}

export async function restoreCapacityRawSnapshot(snapshot) {
  const ref = adminDb
    .collection(PROBLEM_STATEMENT_CAPACITY_COLLECTION)
    .doc(PROBLEM_STATEMENT_CAPACITY_DOC_ID);

  if (!snapshot?.exists) {
    await ref.delete();
    return;
  }

  await ref.set(snapshot.data || {}, { merge: false });
}

export async function updateCapacityCount(problemId, nextCount, maxTeamsPerProblem = MAX_TEAMS_PER_PROBLEM) {
  const normalizedProblemId = asTrimmedString(problemId).toUpperCase();
  if (!normalizedProblemId) {
    throw new Error("problemId is required to update capacity count.");
  }

  const ref = adminDb
    .collection(PROBLEM_STATEMENT_CAPACITY_COLLECTION)
    .doc(PROBLEM_STATEMENT_CAPACITY_DOC_ID);

  const doc = await ref.get();
  const raw = doc.exists ? doc.data() || {} : {};
  const existingCounts = raw?.counts && typeof raw.counts === "object" ? raw.counts : {};

  await ref.set(
    {
      max_teams_per_problem: Number.isFinite(Number(raw?.max_teams_per_problem))
        ? Number(raw.max_teams_per_problem)
        : Number(maxTeamsPerProblem),
      counts: {
        ...existingCounts,
        [normalizedProblemId]: Math.max(0, Math.floor(Number(nextCount) || 0)),
      },
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export function getDefaultProblemId() {
  const catalog = getProblemStatementCatalog();
  return asTrimmedString(catalog?.[0]?.id || "PS_DEMO_01").toUpperCase();
}

export function getProblemCountFromSnapshot(snapshot, problemId) {
  const normalizedProblemId = asTrimmedString(problemId).toUpperCase();
  const counts = snapshot?.data?.counts && typeof snapshot.data.counts === "object"
    ? snapshot.data.counts
    : {};

  const value = Number(counts[normalizedProblemId]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function buildLiveWindowControls(currentControls, {
  releaseOffsetSeconds = -20,
  freezeDurationMinutes = 30,
} = {}) {
  const safeDurationMinutes = Math.max(1, Math.floor(Number(freezeDurationMinutes) || 30));
  const releaseAt = new Date(Date.now() + Math.floor(Number(releaseOffsetSeconds) || 0) * 1000);
  const closeAt = new Date(releaseAt.getTime() + safeDurationMinutes * 60 * 1000);

  return {
    ...normalizeStoredEventControls(currentControls),
    problemStatements: {
      enabled: true,
      releaseAt: releaseAt.toISOString(),
    },
    freeze: {
      ...normalizeStoredEventControls(currentControls).freeze,
      enabled: true,
      openAt: releaseAt.toISOString(),
      closeAt: closeAt.toISOString(),
    },
  };
}

export function printEffectiveState(label, controls, { now = new Date() } = {}) {
  const effective = normalizeStoredEventControls(controls);
  const publicState = {
    ...effective,
  };
  const evaluated = {
    now: now.toISOString(),
    problemStatements: {
      enabled: publicState.problemStatements.enabled,
      releaseAt: publicState.problemStatements.releaseAt,
    },
    freeze: {
      enabled: publicState.freeze.enabled,
      openAt: publicState.freeze.openAt,
      closeAt: publicState.freeze.closeAt,
    },
  };

  console.log(`${label}: ${JSON.stringify(evaluated, null, 2)}`);
}
