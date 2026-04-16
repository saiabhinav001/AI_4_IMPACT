import { randomUUID } from "node:crypto";
import { adminAuth, adminDb, FieldValue } from "../../../../../firebaseAdmin";
import { updateLatestCredentialEventMailDelivery } from "./credential-sheet-export";
import { invalidateAdminRegistrationsCache } from "./runtime-cache-invalidation";
import { upsertAdminReadModelForTransaction } from "../../../../../lib/server/admin-read-model.js";

const ENV = globalThis?.process?.env || {};

export const EMAIL_QUEUE_COLLECTION =
  String(ENV.FIREBASE_EMAIL_QUEUE_COLLECTION || "mail").trim() || "mail";

const IN_FLIGHT_STATES = new Set(["PENDING", "PROCESSING"]);
const RETRYABLE_STATES = new Set(["ERROR", "RETRY"]);

const MIN_STALE_MINUTES = 1;
const MAX_STALE_MINUTES = 240;
const DEFAULT_STALE_MINUTES = 20;
const BOOTSTRAP_PASSWORD_SUFFIX = "Aa1!";
const DEFAULT_AUTH_RETRY_ATTEMPTS = 3;
const DEFAULT_AUTH_RETRY_BASE_MS = 250;

const RETRYABLE_AUTH_CODES = new Set([
  "auth/internal-error",
  "auth/network-request-failed",
  "auth/too-many-requests",
  "auth/quota-exceeded",
]);

const EVENT_MAIL_ERROR_CODES = new Set([
  "AUTH_RATE_LIMIT",
  "AUTH_BACKEND_ERROR",
  "AUTH_CREDENTIALS_ERROR",
  "AUTH_PROJECT_CONFIG_ERROR",
  "TEAM_LOGIN_NOT_PROVISIONED",
  "INVALID_LEADER_EMAIL",
  "LEADER_EMAIL_CONFLICT",
  "LEADER_EMAIL_IS_ADMIN",
  "PASSWORD_PROVIDER_DISABLED",
  "INTERNAL_ERROR",
]);

class CredentialEmailError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function asTrimmedString(value) {
  return String(value || "").trim();
}

function asNormalizedEmail(value) {
  return asTrimmedString(value).toLowerCase();
}

function parseNonNegativeInteger(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }

  return Math.floor(numeric);
}

function parseStaleMinutes() {
  const configured = parseNonNegativeInteger(
    ENV.CREDENTIAL_EMAIL_INFLIGHT_STALE_MINUTES,
    DEFAULT_STALE_MINUTES
  );

  if (configured < MIN_STALE_MINUTES) {
    return MIN_STALE_MINUTES;
  }

  if (configured > MAX_STALE_MINUTES) {
    return MAX_STALE_MINUTES;
  }

  return configured;
}

function parseAuthRetryAttempts() {
  const configured = parseNonNegativeInteger(
    ENV.CREDENTIAL_EMAIL_AUTH_RETRY_ATTEMPTS,
    DEFAULT_AUTH_RETRY_ATTEMPTS
  );

  return Math.max(1, configured);
}

function parseAuthRetryBaseMs() {
  const configured = parseNonNegativeInteger(
    ENV.CREDENTIAL_EMAIL_AUTH_RETRY_BASE_MS,
    DEFAULT_AUTH_RETRY_BASE_MS
  );

  return Math.max(100, configured);
}

function shouldMarkMailDeliveryError(code) {
  return EVENT_MAIL_ERROR_CODES.has(asTrimmedString(code).toUpperCase());
}

function isRetryableAuthCode(code) {
  return RETRYABLE_AUTH_CODES.has(asTrimmedString(code).toLowerCase());
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runWithAuthRetry(action) {
  const maxAttempts = parseAuthRetryAttempts();
  const baseMs = parseAuthRetryBaseMs();
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      const code = toAuthErrorCode(error);
      const canRetry = isRetryableAuthCode(code) && attempt < maxAttempts;

      if (!canRetry) {
        throw error;
      }

      const delayMs = Math.min(2000, baseMs * Math.pow(2, attempt - 1));
      await sleep(delayMs);
    }
  }

  throw lastError;
}

async function syncLatestEventMailDeliveryBestEffort({
  transactionId,
  status,
  lastError = "",
}) {
  const normalizedTransactionId = asTrimmedString(transactionId);
  if (!normalizedTransactionId) {
    return;
  }

  try {
    await updateLatestCredentialEventMailDelivery({
      transactionId: normalizedTransactionId,
      status,
      lastError,
      syncSheet: true,
    });
  } catch (error) {
    console.error("Failed to sync credential event mail delivery:", {
      transaction_id: normalizedTransactionId,
      status,
      message: error?.message || "unknown",
    });
  }
}

function normalizeDeliveryState(value) {
  const normalized = asTrimmedString(value).toUpperCase();

  if (
    [
      "NOT_READY",
      "UNSENT",
      "PENDING",
      "PROCESSING",
      "RETRY",
      "SUCCESS",
      "ERROR",
    ].includes(normalized)
  ) {
    return normalized;
  }

  return "UNSENT";
}

function parseDeliveryError(value) {
  if (!value) return "";
  if (typeof value === "string") return value;

  if (typeof value === "object") {
    if (typeof value.message === "string") return value.message;
    if (typeof value.error === "string") return value.error;

    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  return "";
}

function toDateSafe(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(value) {
  const date = toDateSafe(value);
  return date ? date.toISOString() : null;
}

function toAuthErrorCode(error) {
  return asTrimmedString(error?.code).toLowerCase();
}

function mapAuthErrorToCredentialEmailError(error) {
  const code = toAuthErrorCode(error);

  if (!code.startsWith("auth/")) {
    return null;
  }

  if (code === "auth/user-not-found") {
    return new CredentialEmailError(
      409,
      "TEAM_LOGIN_NOT_PROVISIONED",
      "Team login account was not found. Regenerate credentials and retry email dispatch."
    );
  }

  if (code === "auth/invalid-email") {
    return new CredentialEmailError(
      400,
      "INVALID_LEADER_EMAIL",
      "Leader email in access credentials is invalid."
    );
  }

  if (code === "auth/email-already-exists") {
    return new CredentialEmailError(
      409,
      "LEADER_EMAIL_CONFLICT",
      "Leader email is already associated with another auth account."
    );
  }

  if (code === "auth/operation-not-allowed") {
    return new CredentialEmailError(
      503,
      "PASSWORD_PROVIDER_DISABLED",
      "Email/password authentication is disabled in Firebase Auth."
    );
  }

  if (code === "auth/too-many-requests") {
    return new CredentialEmailError(
      429,
      "AUTH_RATE_LIMIT",
      "Firebase Auth rate limit reached while generating reset link. Retry shortly."
    );
  }

  if (code === "auth/quota-exceeded") {
    return new CredentialEmailError(
      429,
      "AUTH_RATE_LIMIT",
      "Firebase Auth quota exceeded. Retry shortly."
    );
  }

  if (code === "auth/invalid-credential" || code === "auth/insufficient-permission") {
    return new CredentialEmailError(
      503,
      "AUTH_CREDENTIALS_ERROR",
      "Firebase Admin credentials are not authorized for Auth operations."
    );
  }

  if (code === "auth/project-not-found") {
    return new CredentialEmailError(
      503,
      "AUTH_PROJECT_CONFIG_ERROR",
      "Firebase Auth project configuration is invalid."
    );
  }

  return new CredentialEmailError(
    503,
    "AUTH_BACKEND_ERROR",
    "Firebase Auth is temporarily unavailable. Retry shortly."
  );
}

function buildBootstrapPassword() {
  return `${randomUUID()}${BOOTSTRAP_PASSWORD_SUFFIX}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function appendQueryParam(urlText, key, value) {
  const normalized = asTrimmedString(urlText);
  if (!normalized) {
    return "";
  }

  try {
    const parsed = new URL(normalized);
    parsed.searchParams.set(key, value);
    return parsed.toString();
  } catch {
    const hashIndex = normalized.indexOf("#");
    const base = hashIndex >= 0 ? normalized.slice(0, hashIndex) : normalized;
    const hash = hashIndex >= 0 ? normalized.slice(hashIndex) : "";
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hash}`;
  }
}

function buildLoginUrl(requestOrigin) {
  const explicitBase = asTrimmedString(
    ENV.NEXT_PUBLIC_APP_URL || ENV.APP_BASE_URL
  );

  if (explicitBase) {
    return appendQueryParam(
      `${explicitBase.replace(/\/$/, "")}/auth`,
      "intent",
      "team-login"
    );
  }

  const origin = asTrimmedString(requestOrigin);
  if (origin) {
    return appendQueryParam(
      `${origin.replace(/\/$/, "")}/auth`,
      "intent",
      "team-login"
    );
  }

  return "/auth?intent=team-login";
}

function appendTeamResetFlow(urlText) {
  return appendQueryParam(urlText, "flow", "team-password-reset");
}

async function generateSetupLink(email, loginUrl) {
  const explicitContinueUrl = appendTeamResetFlow(
    asTrimmedString(ENV.TEAM_PASSWORD_SETUP_CONTINUE_URL)
  );
  const defaultContinueUrl = appendTeamResetFlow(loginUrl);

  if (explicitContinueUrl) {
    try {
      return await adminAuth.generatePasswordResetLink(email, {
        url: explicitContinueUrl,
        handleCodeInApp: false,
      });
    } catch (error) {
      if (error?.code !== "auth/invalid-continue-uri") {
        throw error;
      }
    }
  }

  try {
    return await adminAuth.generatePasswordResetLink(email, {
      url: defaultContinueUrl || loginUrl,
      handleCodeInApp: false,
    });
  } catch (error) {
    if (error?.code !== "auth/invalid-continue-uri") {
      throw error;
    }

    return adminAuth.generatePasswordResetLink(email);
  }
}

function buildEmailContent({ leaderName, teamId, loginUrl, setupLink }) {
  const safeName = leaderName || "Team Leader";

  const subject = "AI4Impact Team Dashboard Access";
  const text = [
    `Hello ${safeName},`,
    "",
    "Your team registration has been verified.",
    "",
    `Team ID: ${teamId}`,
    `Login URL: ${loginUrl}`,
    "",
    "Set your password using this secure link:",
    setupLink,
    "",
    "After setting your password, log in with your Team ID and the new password.",
    "",
    "Regards,",
    "AI4Impact Admin",
  ].join("\n");

  const safeNameHtml = escapeHtml(safeName);
  const teamIdHtml = escapeHtml(teamId);
  const loginUrlHtml = escapeHtml(loginUrl);
  const setupLinkHtml = escapeHtml(setupLink);

  const html = `
    <p>Hello ${safeNameHtml},</p>
    <p>Your team registration has been verified.</p>
    <p><strong>Team ID:</strong> ${teamIdHtml}<br/><strong>Login URL:</strong> <a href="${loginUrlHtml}">${loginUrlHtml}</a></p>
    <p><strong>Set your password using this secure link:</strong><br/><a href="${setupLinkHtml}">${setupLinkHtml}</a></p>
    <p>After setting your password, log in with your Team ID and the new password.</p>
    <p>Regards,<br/>AI4Impact Admin</p>
  `;

  return { subject, text, html };
}

function parseQueueContext(transactionId, transactionData) {
  if (!transactionData) {
    throw new CredentialEmailError(404, "TRANSACTION_NOT_FOUND", "Transaction not found.");
  }

  if (transactionData.registration_type !== "hackathon") {
    throw new CredentialEmailError(
      400,
      "INVALID_REGISTRATION_TYPE",
      "Credential email is supported only for hackathon registrations."
    );
  }

  if (transactionData.status !== "verified") {
    throw new CredentialEmailError(
      400,
      "PAYMENT_NOT_VERIFIED",
      "Payment must be VERIFIED before sending credential email."
    );
  }

  const registrationRefId = asTrimmedString(transactionData.registration_ref);
  if (!registrationRefId) {
    throw new CredentialEmailError(
      400,
      "MISSING_REGISTRATION_REF",
      "Transaction is missing registration_ref."
    );
  }

  return {
    transactionId,
    registrationRefId,
  };
}

function parseCredentialIdentity(registrationData) {
  if (!registrationData) {
    throw new CredentialEmailError(404, "REGISTRATION_NOT_FOUND", "Registration not found.");
  }

  if (registrationData.payment_verified !== true) {
    throw new CredentialEmailError(
      400,
      "REGISTRATION_NOT_VERIFIED",
      "Registration payment is not verified."
    );
  }

  const rawAccess = registrationData.access_credentials || {};
  const teamId = asTrimmedString(
    registrationData.team_access_id || rawAccess.team_id
  ).toLowerCase();
  const authUid = asTrimmedString(
    registrationData.team_lead_auth_uid || rawAccess.auth_uid
  );
  const leaderEmail = asNormalizedEmail(rawAccess.leader_email);
  const leaderName = asTrimmedString(rawAccess.leader_name);
  const leaderParticipantId = asTrimmedString(
    Array.isArray(registrationData.member_ids)
      ? registrationData.member_ids[0]
      : ""
  );

  if (!teamId) {
    throw new CredentialEmailError(
      400,
      "MISSING_TEAM_ID",
      "Team access ID is missing. Verify payment first."
    );
  }

  if (!leaderEmail) {
    throw new CredentialEmailError(
      400,
      "MISSING_LEADER_EMAIL",
      "Leader email is missing in team access credentials."
    );
  }

  return {
    teamId,
    authUid,
    leaderEmail,
    leaderName,
    leaderParticipantId,
    rawAccess,
  };
}

async function getAuthUserByUid(uid) {
  const normalizedUid = asTrimmedString(uid);
  if (!normalizedUid) return null;

  try {
    return await runWithAuthRetry(() => adminAuth.getUser(normalizedUid));
  } catch (error) {
    if (toAuthErrorCode(error) === "auth/user-not-found") {
      return null;
    }

    const mapped = mapAuthErrorToCredentialEmailError(error);
    if (mapped) {
      throw mapped;
    }

    throw error;
  }
}

async function getAuthUserByEmail(email) {
  const normalizedEmail = asNormalizedEmail(email);
  if (!normalizedEmail) return null;

  try {
    return await runWithAuthRetry(() => adminAuth.getUserByEmail(normalizedEmail));
  } catch (error) {
    if (toAuthErrorCode(error) === "auth/user-not-found") {
      return null;
    }

    const mapped = mapAuthErrorToCredentialEmailError(error);
    if (mapped) {
      throw mapped;
    }

    throw error;
  }
}

function assertNonAdminAuthUser(userRecord) {
  if (userRecord?.customClaims?.admin === true) {
    throw new CredentialEmailError(
      409,
      "LEADER_EMAIL_IS_ADMIN",
      "Leader email belongs to an admin account. Use a non-admin team leader email."
    );
  }
}

async function ensureCredentialEmailAuthUser({
  registrationIdentity,
  registrationRefId,
}) {
  let userRecord = null;

  if (registrationIdentity.authUid) {
    const uidUser = await getAuthUserByUid(registrationIdentity.authUid);
    if (
      uidUser &&
      asNormalizedEmail(uidUser.email) === registrationIdentity.leaderEmail
    ) {
      userRecord = uidUser;
    }
  }

  if (!userRecord) {
    userRecord = await getAuthUserByEmail(registrationIdentity.leaderEmail);
  }

  let created = false;
  if (!userRecord) {
    try {
      userRecord = await runWithAuthRetry(() =>
        adminAuth.createUser({
          email: registrationIdentity.leaderEmail,
          password: buildBootstrapPassword(),
          displayName: registrationIdentity.leaderName || registrationIdentity.teamId,
          disabled: false,
        })
      );
      created = true;
    } catch (error) {
      const mapped = mapAuthErrorToCredentialEmailError(error);
      if (mapped) {
        throw mapped;
      }

      throw error;
    }
  }

  assertNonAdminAuthUser(userRecord);

  if (created) {
    try {
      const existingClaims = userRecord.customClaims || {};
      const claims = {
        ...existingClaims,
        role: "TEAM_LEAD",
        team_access_id: registrationIdentity.teamId,
        registration_ref: registrationRefId,
        must_reset_password: true,
      };

      if (registrationIdentity.leaderParticipantId) {
        claims.participant_id = registrationIdentity.leaderParticipantId;
      }

      await runWithAuthRetry(() => adminAuth.setCustomUserClaims(userRecord.uid, claims));
    } catch (error) {
      const mapped = mapAuthErrorToCredentialEmailError(error);
      if (mapped) {
        throw mapped;
      }

      throw error;
    }
  }

  return {
    ...registrationIdentity,
    authUid: userRecord.uid,
  };
}

async function createSetupLinkWithRecovery({
  registrationIdentity,
  registrationRefId,
  loginUrl,
}) {
  let effectiveIdentity = registrationIdentity;

  try {
    const setupLink = await runWithAuthRetry(() =>
      generateSetupLink(effectiveIdentity.leaderEmail, loginUrl)
    );

    return {
      setupLink,
      registrationIdentity: effectiveIdentity,
    };
  } catch (error) {
    if (toAuthErrorCode(error) !== "auth/user-not-found") {
      const mapped = mapAuthErrorToCredentialEmailError(error);
      if (mapped) {
        throw mapped;
      }

      throw error;
    }
  }

  effectiveIdentity = await ensureCredentialEmailAuthUser({
    registrationIdentity: effectiveIdentity,
    registrationRefId,
  });

  try {
    const setupLink = await runWithAuthRetry(() =>
      generateSetupLink(effectiveIdentity.leaderEmail, loginUrl)
    );

    return {
      setupLink,
      registrationIdentity: effectiveIdentity,
    };
  } catch (error) {
    const mapped = mapAuthErrorToCredentialEmailError(error);
    if (mapped) {
      throw mapped;
    }

    throw error;
  }
}

async function readCurrentDeliveryState({ rawDelivery, transaction = null }) {
  const queueDocId = asTrimmedString(rawDelivery?.queue_doc_id);
  const queueCollection = asTrimmedString(rawDelivery?.collection) || EMAIL_QUEUE_COLLECTION;

  let requestedAt = toDateSafe(rawDelivery?.requested_at);
  let state = normalizeDeliveryState(rawDelivery?.state);
  let error = asTrimmedString(rawDelivery?.error);

  if (!queueDocId) {
    return {
      state,
      queueDocId: "",
      queueCollection,
      requestedAt,
      error,
    };
  }

  const queueRef = adminDb.collection(queueCollection).doc(queueDocId);
  const queueDoc = transaction
    ? await transaction.get(queueRef)
    : await queueRef.get();

  if (!queueDoc.exists) {
    return {
      state,
      queueDocId,
      queueCollection,
      requestedAt,
      error,
    };
  }

  const queueData = queueDoc.data() || {};
  const deliveryData = queueData.delivery || {};

  state = normalizeDeliveryState(
    deliveryData.state || queueData.delivery_state || state
  );
  requestedAt =
    requestedAt ||
    toDateSafe(
      queueData.createdAt || queueData.created_at || deliveryData.attemptTime
    );
  error =
    parseDeliveryError(deliveryData.error || deliveryData.info?.error || queueData.error) ||
    error;

  return {
    state,
    queueDocId,
    queueCollection,
    requestedAt,
    error,
  };
}

function toSerializableDelivery(delivery) {
  return {
    state: normalizeDeliveryState(delivery?.state),
    queue_doc_id: asTrimmedString(delivery?.queueDocId) || null,
    collection: asTrimmedString(delivery?.queueCollection) || EMAIL_QUEUE_COLLECTION,
    recipient: asNormalizedEmail(delivery?.recipient) || null,
    requested_at: toIso(delivery?.requestedAt),
    error: asTrimmedString(delivery?.error) || null,
    request_id: asTrimmedString(delivery?.requestId) || null,
    request_count: parseNonNegativeInteger(delivery?.requestCount),
    retry_count: parseNonNegativeInteger(delivery?.retryCount),
  };
}

function evaluateQueueDecision({ currentDelivery, force }) {
  const now = Date.now();
  const staleMs = parseStaleMinutes() * 60 * 1000;
  const requestedAtMs = currentDelivery?.requestedAt?.getTime?.() || null;
  const inFlightAgeMs =
    typeof requestedAtMs === "number" && Number.isFinite(requestedAtMs)
      ? Math.max(0, now - requestedAtMs)
      : null;

  if (currentDelivery.state === "SUCCESS" && force !== true) {
    throw new CredentialEmailError(
      409,
      "ALREADY_SENT",
      "Credential email is already delivered. Use resend with force=true to send again.",
      {
        email_delivery: toSerializableDelivery(currentDelivery),
      }
    );
  }

  if (IN_FLIGHT_STATES.has(currentDelivery.state)) {
    if (
      force !== true &&
      inFlightAgeMs !== null &&
      Number.isFinite(inFlightAgeMs) &&
      inFlightAgeMs >= staleMs
    ) {
      return {
        reason: "STALE_IN_FLIGHT_AUTO_RETRY",
        countAsRetry: true,
      };
    }

    if (force !== true) {
      const retryAfterSeconds =
        inFlightAgeMs === null
          ? null
          : Math.max(5, Math.ceil((staleMs - inFlightAgeMs) / 1000));

      throw new CredentialEmailError(
        409,
        "IN_FLIGHT",
        "Credential email is already queued. Please wait before retrying.",
        {
          retry_after_seconds:
            retryAfterSeconds !== null && Number.isFinite(retryAfterSeconds)
              ? retryAfterSeconds
              : null,
          email_delivery: toSerializableDelivery(currentDelivery),
        }
      );
    }

    if (inFlightAgeMs !== null && inFlightAgeMs < staleMs) {
      const retryAfterSeconds = Math.max(
        5,
        Math.ceil((staleMs - inFlightAgeMs) / 1000)
      );

      throw new CredentialEmailError(
        409,
        "IN_FLIGHT_RECENT",
        "Latest credential email request is still in-flight. Retry later or resend after stale window.",
        {
          retry_after_seconds: retryAfterSeconds,
          email_delivery: toSerializableDelivery(currentDelivery),
        }
      );
    }

    return {
      reason: "STALE_IN_FLIGHT_OVERRIDE",
      countAsRetry: true,
    };
  }

  if (currentDelivery.state === "SUCCESS" && force === true) {
    return {
      reason: "FORCED_RESEND",
      countAsRetry: true,
    };
  }

  if (RETRYABLE_STATES.has(currentDelivery.state)) {
    return {
      reason: "RETRY_FROM_FAILURE",
      countAsRetry: true,
    };
  }

  return {
    reason: "INITIAL_SEND",
    countAsRetry: false,
  };
}

export async function queueCredentialEmail({
  transactionId,
  adminUid,
  force = false,
  requestOrigin = "",
  source = "single",
}) {
  try {
    const normalizedTransactionId = asTrimmedString(transactionId);
    const normalizedAdminUid = asTrimmedString(adminUid);

    if (!normalizedTransactionId) {
      throw new CredentialEmailError(400, "MISSING_TRANSACTION_ID", "transaction_id is required.");
    }

    if (!normalizedAdminUid) {
      throw new CredentialEmailError(403, "MISSING_ADMIN_UID", "Admin identity is required.");
    }

    const transactionRef = adminDb.collection("transactions").doc(normalizedTransactionId);
    const transactionDoc = await transactionRef.get();
    const queueContext = parseQueueContext(normalizedTransactionId, transactionDoc.data());

    const registrationRef = adminDb
      .collection("hackathon_registrations")
      .doc(queueContext.registrationRefId);
    const registrationDoc = await registrationRef.get();
    let registrationIdentity = parseCredentialIdentity(registrationDoc.data());

    const preflightDelivery = await readCurrentDeliveryState({
      rawDelivery: registrationIdentity.rawAccess?.email_delivery || {},
    });
    preflightDelivery.recipient = registrationIdentity.leaderEmail;
    evaluateQueueDecision({
      currentDelivery: preflightDelivery,
      force,
    });

    const loginUrl = buildLoginUrl(requestOrigin);
    const setupLinkResult = await createSetupLinkWithRecovery({
      registrationIdentity,
      registrationRefId: queueContext.registrationRefId,
      loginUrl,
    });
    registrationIdentity = setupLinkResult.registrationIdentity;
    const setupLink = setupLinkResult.setupLink;
    const emailContent = buildEmailContent({
      leaderName: registrationIdentity.leaderName,
      teamId: registrationIdentity.teamId,
      loginUrl,
      setupLink,
    });

    const requestId = randomUUID();
    const mailRef = adminDb.collection(EMAIL_QUEUE_COLLECTION).doc();
    let queuedMeta = {
      requestCount: 0,
      retryCount: 0,
      requestedAt: new Date().toISOString(),
    };

    await adminDb.runTransaction(async (transaction) => {
      const txDoc = await transaction.get(transactionRef);
      const txData = txDoc.data();
      const txContext = parseQueueContext(normalizedTransactionId, txData);

      const txRegistrationRef = adminDb
        .collection("hackathon_registrations")
        .doc(txContext.registrationRefId);
      const txRegistrationDoc = await transaction.get(txRegistrationRef);
      const txRegistrationData = txRegistrationDoc.data();
      const identity = parseCredentialIdentity(txRegistrationData);

      const rawDelivery = identity.rawAccess?.email_delivery || {};
      const currentDelivery = await readCurrentDeliveryState({
        rawDelivery,
        transaction,
      });
      currentDelivery.recipient = identity.leaderEmail;

      const decision = evaluateQueueDecision({
        currentDelivery,
        force,
      });

      const requestCount = parseNonNegativeInteger(rawDelivery.request_count) + 1;
      const retryCount =
        parseNonNegativeInteger(rawDelivery.retry_count) +
        (decision.countAsRetry ? 1 : 0);

      queuedMeta = {
        requestCount,
        retryCount,
        requestedAt: new Date().toISOString(),
      };

      transaction.set(mailRef, {
        to: [identity.leaderEmail],
        message: {
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
        },
        createdAt: FieldValue.serverTimestamp(),
        credential_email: {
          transaction_id: normalizedTransactionId,
          registration_ref: txContext.registrationRefId,
          team_id: identity.teamId,
          auth_uid: registrationIdentity.authUid || null,
          recipient_email: identity.leaderEmail,
          requested_by: normalizedAdminUid,
          request_id: requestId,
          source: asTrimmedString(source) || "single",
          force: force === true,
          decision_reason: decision.reason,
        },
      });

      const updates = {
        "access_credentials.team_id": identity.teamId,
        "access_credentials.leader_email": identity.leaderEmail,
        "access_credentials.leader_name": identity.leaderName || null,
        "access_credentials.email_delivery.collection": EMAIL_QUEUE_COLLECTION,
        "access_credentials.email_delivery.queue_doc_id": mailRef.id,
        "access_credentials.email_delivery.recipient": identity.leaderEmail,
        "access_credentials.email_delivery.state": "PENDING",
        "access_credentials.email_delivery.requested_by": normalizedAdminUid,
        "access_credentials.email_delivery.requested_at": FieldValue.serverTimestamp(),
        "access_credentials.email_delivery.request_id": requestId,
        "access_credentials.email_delivery.request_count": requestCount,
        "access_credentials.email_delivery.retry_count": retryCount,
        "access_credentials.email_delivery.last_request_source":
          asTrimmedString(source) || "single",
        "access_credentials.email_delivery.last_request_force": force === true,
        "access_credentials.email_delivery.last_state_before_request": currentDelivery.state,
        "access_credentials.email_delivery.last_decision_reason": decision.reason,
        "access_credentials.email_delivery.last_attempt_at": FieldValue.delete(),
        "access_credentials.email_delivery.sent_at": FieldValue.delete(),
        "access_credentials.email_delivery.error": FieldValue.delete(),
        "access_credentials.email_delivery.retry_after_seconds": FieldValue.delete(),
        "access_credentials.updated_at": FieldValue.serverTimestamp(),
      };

      if (registrationIdentity.authUid) {
        updates.team_lead_auth_uid = registrationIdentity.authUid;
        updates["access_credentials.auth_uid"] = registrationIdentity.authUid;
      }

      if (currentDelivery.queueDocId) {
        updates["access_credentials.email_delivery.previous_queue_doc_id"] =
          currentDelivery.queueDocId;
      } else {
        updates["access_credentials.email_delivery.previous_queue_doc_id"] =
          FieldValue.delete();
      }

      if (currentDelivery.error) {
        updates["access_credentials.email_delivery.last_error_before_request"] =
          currentDelivery.error;
      } else {
        updates["access_credentials.email_delivery.last_error_before_request"] =
          FieldValue.delete();
      }

      transaction.update(txRegistrationRef, updates);
    });

    await syncLatestEventMailDeliveryBestEffort({
      transactionId: normalizedTransactionId,
      status: "PENDING",
      lastError: "",
    });

    try {
      await upsertAdminReadModelForTransaction(normalizedTransactionId);
    } catch (readModelError) {
      console.error("Failed to upsert admin read model after email queue:", readModelError);
    }

    invalidateAdminRegistrationsCache();

    return {
      success: true,
      status: 200,
      code: "QUEUED",
      email_delivery: {
        state: "PENDING",
        queue_doc_id: mailRef.id,
        collection: EMAIL_QUEUE_COLLECTION,
        recipient: registrationIdentity.leaderEmail,
        requested_at: queuedMeta.requestedAt,
        request_id: requestId,
        request_count: queuedMeta.requestCount,
        retry_count: queuedMeta.retryCount,
      },
    };
  } catch (error) {
    if (error instanceof CredentialEmailError) {
      if (shouldMarkMailDeliveryError(error.code)) {
        await syncLatestEventMailDeliveryBestEffort({
          transactionId,
          status: "ERROR",
          lastError: error.message,
        });
      }

      return {
        success: false,
        status: error.status,
        code: error.code,
        error: error.message,
        ...(error.details || {}),
      };
    }

    const mapped = mapAuthErrorToCredentialEmailError(error);
    if (mapped) {
      if (shouldMarkMailDeliveryError(mapped.code)) {
        await syncLatestEventMailDeliveryBestEffort({
          transactionId,
          status: "ERROR",
          lastError: mapped.message,
        });
      }

      return {
        success: false,
        status: mapped.status,
        code: mapped.code,
        error: mapped.message,
        ...(mapped.details || {}),
      };
    }

    console.error("Credential email queue request failed:", {
      transaction_id: asTrimmedString(transactionId),
      admin_uid: asTrimmedString(adminUid),
      source: asTrimmedString(source) || "single",
      force: force === true,
      message: error?.message || "unknown",
      stack: error?.stack || null,
    });

    await syncLatestEventMailDeliveryBestEffort({
      transactionId,
      status: "ERROR",
      lastError: "Failed to queue credential email.",
    });

    return {
      success: false,
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Failed to queue credential email.",
    };
  }
}
