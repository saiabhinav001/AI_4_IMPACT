import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "../../../../../firebaseAdmin";

const ENV = globalThis?.process?.env || {};

export const EMAIL_QUEUE_COLLECTION =
  String(ENV.FIREBASE_EMAIL_QUEUE_COLLECTION || "mail").trim() || "mail";

const IN_FLIGHT_STATES = new Set(["PENDING", "PROCESSING"]);
const RETRYABLE_STATES = new Set(["ERROR", "RETRY"]);

const MIN_STALE_MINUTES = 1;
const MAX_STALE_MINUTES = 240;
const DEFAULT_STALE_MINUTES = 20;

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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLoginUrl(requestOrigin) {
  const explicitBase = asTrimmedString(
    ENV.NEXT_PUBLIC_APP_URL || ENV.APP_BASE_URL
  );

  if (explicitBase) {
    return `${explicitBase.replace(/\/$/, "")}/auth`;
  }

  const origin = asTrimmedString(requestOrigin);
  if (origin) {
    return `${origin.replace(/\/$/, "")}/auth`;
  }

  return "/auth";
}

async function generateSetupLink(email, loginUrl) {
  const explicitContinueUrl = asTrimmedString(
    ENV.TEAM_PASSWORD_SETUP_CONTINUE_URL
  );

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
      url: loginUrl,
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
  const leaderEmail = asNormalizedEmail(rawAccess.leader_email);
  const leaderName = asTrimmedString(rawAccess.leader_name);

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
    leaderEmail,
    leaderName,
    rawAccess,
  };
}

async function readCurrentDeliveryState({ rawDelivery, transaction }) {
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
  const queueDoc = await transaction.get(queueRef);

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
    const registrationIdentity = parseCredentialIdentity(registrationDoc.data());

    const loginUrl = buildLoginUrl(requestOrigin);
    const setupLink = await generateSetupLink(registrationIdentity.leaderEmail, loginUrl);
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
      return {
        success: false,
        status: error.status,
        code: error.code,
        error: error.message,
        ...(error.details || {}),
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

    return {
      success: false,
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Failed to queue credential email.",
    };
  }
}
