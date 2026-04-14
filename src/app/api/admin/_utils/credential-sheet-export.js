import { randomUUID } from "node:crypto";
import { adminDb, FieldValue, Timestamp } from "../../../../../firebaseAdmin.js";

const ENV = globalThis?.process?.env || {};

export const CREDENTIAL_EXPORT_EVENTS_COLLECTION =
  String(ENV.CREDENTIAL_EXPORT_EVENTS_COLLECTION || "credential_export_events").trim() ||
  "credential_export_events";

const CREDENTIAL_EXPORT_COUNTER_DOC =
  String(ENV.CREDENTIAL_EXPORT_COUNTER_DOC || "credential_sheet_sync").trim() ||
  "credential_sheet_sync";

const DEFAULT_WORKSHEET =
  String(
    ENV.CREDENTIAL_SHEET_WORKSHEET ||
      ENV.GOOGLE_SHEETS_WORKSHEET ||
      "CredentialEvents"
  ).trim() ||
  "CredentialEvents";

const SHEET_HEADER_ROWS = Number.parseInt(
  String(ENV.CREDENTIAL_SHEET_HEADER_ROWS || "1"),
  10
);

const DEFAULT_SYNC_TIMEOUT_MS = Number.parseInt(
  String(ENV.CREDENTIAL_SHEET_SYNC_TIMEOUT_MS || "3500"),
  10
);

const DEFAULT_MAX_RETRIES = Number.parseInt(
  String(ENV.CREDENTIAL_SHEET_SYNC_MAX_RETRIES || "15"),
  10
);

const RETRY_BASE_SECONDS = Number.parseInt(
  String(ENV.CREDENTIAL_SHEET_SYNC_RETRY_BASE_SECONDS || "30"),
  10
);

const RETRY_MAX_SECONDS = Number.parseInt(
  String(ENV.CREDENTIAL_SHEET_SYNC_RETRY_MAX_SECONDS || "3600"),
  10
);

const SHEET_COLUMN_END = "Z";
const SHEET_HEADERS = [
  "sequence_no",
  "event_id",
  "event_type",
  "event_created_at",
  "transaction_id",
  "registration_ref",
  "registration_type",
  "college_name",
  "team_size",
  "team_id",
  "credential_version",
  "password_issued",
  "temporary_password",
  "leader_name",
  "leader_email",
  "leader_phone",
  "issued_by_admin_uid",
  "issued_by_admin_email",
  "source",
  "request_id",
  "sheet_sync_status",
  "sheet_synced_at",
  "mail_status",
  "mail_sent_at",
  "mail_error",
  "notes",
];

let sheetsClientPromise = null;

const MAIL_DELIVERY_STATES = new Set([
  "NOT_READY",
  "UNSENT",
  "PENDING",
  "PROCESSING",
  "RETRY",
  "SUCCESS",
  "ERROR",
]);

function asTrimmedString(value) {
  return String(value || "").trim();
}

function parseBoolean(value) {
  const normalized = asTrimmedString(value).toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

function isRunningInGoogleCloud() {
  return (
    Boolean(ENV.K_SERVICE) ||
    Boolean(ENV.FUNCTION_TARGET) ||
    Boolean(ENV.GOOGLE_CLOUD_PROJECT) ||
    Boolean(ENV.GCLOUD_PROJECT)
  );
}

function normalizePrivateKey(value) {
  return asTrimmedString(value).replace(/\\n/g, "\n");
}

function toNonNegativeInteger(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }

  return Math.floor(numeric);
}

function sanitizeSheetCell(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  return String(value);
}

function withTimeout(promise, timeoutMs, timeoutLabel) {
  const targetTimeout = toNonNegativeInteger(timeoutMs, DEFAULT_SYNC_TIMEOUT_MS);

  if (!targetTimeout) {
    return promise;
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${timeoutLabel} timed out after ${targetTimeout}ms`));
    }, targetTimeout);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function readServiceAccountFromEnv() {
  const rawJson = asTrimmedString(
    ENV.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON || ENV.GOOGLE_SERVICE_ACCOUNT_JSON || ""
  );

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      const clientEmail = asTrimmedString(parsed?.client_email);
      const privateKey = normalizePrivateKey(parsed?.private_key);

      if (clientEmail && privateKey) {
        return {
          projectId: asTrimmedString(parsed?.project_id),
          clientEmail,
          privateKey,
        };
      }
    } catch {
      // Fallback to split env vars.
    }
  }

  const clientEmail = asTrimmedString(
    ENV.GOOGLE_SHEETS_CLIENT_EMAIL ||
      ENV.FIREBASE_ADMIN_CLIENT_EMAIL ||
      ENV.FIREBASE_CLIENT_EMAIL ||
      ""
  );
  const privateKey = normalizePrivateKey(
    ENV.GOOGLE_SHEETS_PRIVATE_KEY ||
      ENV.FIREBASE_ADMIN_PRIVATE_KEY ||
      ENV.FIREBASE_PRIVATE_KEY ||
      ""
  );
  const projectId = asTrimmedString(
    ENV.GOOGLE_SHEETS_PROJECT_ID ||
      ENV.FIREBASE_ADMIN_PROJECT_ID ||
      ENV.FIREBASE_PROJECT_ID ||
      ""
  );

  if (!clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function getWorksheetName(eventData) {
  const candidate = asTrimmedString(eventData?.sheet_sync?.worksheet || "");
  return candidate || DEFAULT_WORKSHEET;
}

function getMaxRetries() {
  const parsed = toNonNegativeInteger(DEFAULT_MAX_RETRIES, 15);
  return Math.max(1, parsed);
}

function getRetryDelaySeconds(attemptCount) {
  const normalizedAttempt = Math.max(1, toNonNegativeInteger(attemptCount, 1));
  const base = Math.max(5, toNonNegativeInteger(RETRY_BASE_SECONDS, 30));
  const max = Math.max(base, toNonNegativeInteger(RETRY_MAX_SECONDS, 3600));

  const exponential = base * Math.pow(2, Math.max(0, normalizedAttempt - 1));
  return Math.min(max, exponential);
}

function parseTimestampMillis(value) {
  if (!value) return NaN;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  const date = new Date(value);
  const millis = date.getTime();
  return Number.isNaN(millis) ? NaN : millis;
}

function toIsoString(value) {
  if (!value) return "";

  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function toSheetRange(worksheetName, startRow, endRow = startRow) {
  return `${worksheetName}!A${startRow}:${SHEET_COLUMN_END}${endRow}`;
}

function shouldAttemptSync(eventData, { force = false } = {}) {
  const status = asTrimmedString(eventData?.sheet_sync?.status || "PENDING").toUpperCase();

  if (status === "SYNCED") {
    return force;
  }

  if (status === "DEAD_LETTER" && !force) {
    return false;
  }

  const nextRetryAtMillis = parseTimestampMillis(eventData?.sheet_sync?.next_retry_at);
  if (!Number.isFinite(nextRetryAtMillis)) {
    return true;
  }

  return Date.now() >= nextRetryAtMillis;
}

function normalizeMailDeliveryStatus(value) {
  const normalized = asTrimmedString(value).toUpperCase();
  return MAIL_DELIVERY_STATES.has(normalized) ? normalized : "PENDING";
}

function toTimestampValue(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return Timestamp.fromDate(parsed);
}

function eventSortMillis(eventData) {
  const createdIsoMillis = parseTimestampMillis(eventData?.created_at_iso);
  if (Number.isFinite(createdIsoMillis)) {
    return createdIsoMillis;
  }

  const createdAtMillis = parseTimestampMillis(eventData?.created_at);
  if (Number.isFinite(createdAtMillis)) {
    return createdAtMillis;
  }

  const updatedAtMillis = parseTimestampMillis(eventData?.updated_at);
  if (Number.isFinite(updatedAtMillis)) {
    return updatedAtMillis;
  }

  return 0;
}

function toSafeErrorMessage(error) {
  const message = asTrimmedString(error?.message || "Unknown Sheets sync failure.");
  return message.slice(0, 1500);
}

function getSpreadsheetId() {
  return asTrimmedString(ENV.GOOGLE_SHEETS_SPREADSHEET_ID || "");
}

function isSheetSyncEnabled() {
  return parseBoolean(ENV.CREDENTIAL_SHEET_SYNC_ENABLED || "false");
}

function isSheetSyncConfigured() {
  return Boolean(
    getSpreadsheetId() && (readServiceAccountFromEnv() || isRunningInGoogleCloud())
  );
}

async function getSheetsClient() {
  if (sheetsClientPromise) {
    return sheetsClientPromise;
  }

  sheetsClientPromise = (async () => {
    const serviceAccount = readServiceAccountFromEnv();

    const { google } = await import("googleapis");

    let auth;
    if (serviceAccount) {
      auth = new google.auth.JWT({
        email: serviceAccount.clientEmail,
        key: serviceAccount.privateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
    } else if (isRunningInGoogleCloud()) {
      auth = new google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
    } else {
      throw new Error(
        "Missing Google Sheets credentials. Set GOOGLE_SHEETS_* env vars locally or run in Google Cloud with ADC."
      );
    }

    return google.sheets({ version: "v4", auth });
  })();

  return sheetsClientPromise;
}

async function ensureSheetHeader({ sheets, spreadsheetId, worksheetName, timeoutMs }) {
  const headerRange = toSheetRange(worksheetName, 1);

  const response = await withTimeout(
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: headerRange,
    }),
    timeoutMs,
    "Google Sheets header read"
  );

  const currentHeader = Array.isArray(response?.data?.values?.[0])
    ? response.data.values[0].map((value) => asTrimmedString(value))
    : [];

  const headerMatches =
    currentHeader.length === SHEET_HEADERS.length &&
    SHEET_HEADERS.every((column, index) => currentHeader[index] === column);

  if (headerMatches) {
    return;
  }

  await withTimeout(
    sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: "RAW",
      requestBody: {
        majorDimension: "ROWS",
        values: [SHEET_HEADERS],
      },
    }),
    timeoutMs,
    "Google Sheets header write"
  );
}

function buildSheetRow(eventId, eventData, sequence, options = {}) {
  const credential = eventData?.credential || {};
  const registration = eventData?.registration || {};
  const mailDelivery = eventData?.mail_delivery || {};

  const sheetSyncStatus = asTrimmedString(options?.sheetSyncStatus || "PENDING") || "PENDING";
  const sheetSyncedAt = asTrimmedString(options?.sheetSyncedAt || "");
  const mailStatus = asTrimmedString(mailDelivery?.status || "PENDING") || "PENDING";
  const mailSentAt = toIsoString(mailDelivery?.sent_at || mailDelivery?.sent_at_iso);
  const mailError = asTrimmedString(mailDelivery?.last_error || "");
  const notes = asTrimmedString(eventData?.notes || "");

  return [
    sequence,
    asTrimmedString(eventId),
    asTrimmedString(eventData?.event_type || ""),
    asTrimmedString(eventData?.created_at_iso || ""),
    asTrimmedString(eventData?.transaction_id || ""),
    asTrimmedString(eventData?.registration_ref || ""),
    asTrimmedString(eventData?.registration_type || ""),
    asTrimmedString(registration?.college_name || ""),
    asTrimmedString(registration?.team_size || ""),
    asTrimmedString(credential?.team_id || ""),
    asTrimmedString(credential?.password_version || ""),
    credential?.password_issued === true ? "true" : "false",
    asTrimmedString(credential?.temporary_password || ""),
    asTrimmedString(credential?.leader_name || ""),
    asTrimmedString(credential?.leader_email || ""),
    asTrimmedString(credential?.leader_phone || ""),
    asTrimmedString(eventData?.issued_by_admin_uid || ""),
    asTrimmedString(eventData?.issued_by_admin_email || ""),
    asTrimmedString(eventData?.source || ""),
    asTrimmedString(eventData?.request_id || ""),
    sheetSyncStatus,
    sheetSyncedAt,
    mailStatus,
    mailSentAt,
    mailError,
    notes,
  ].map(sanitizeSheetCell);
}

async function allocateSequenceIfMissing(eventRef, eventData) {
  const currentSequence = Number(eventData?.sheet_sync?.sequence || 0);
  if (Number.isFinite(currentSequence) && currentSequence > 0) {
    return Math.floor(currentSequence);
  }

  return adminDb.runTransaction(async (transaction) => {
    const freshEventDoc = await transaction.get(eventRef);

    if (!freshEventDoc.exists) {
      throw new Error("Credential export event not found.");
    }

    const freshEventData = freshEventDoc.data() || {};
    const freshSequence = Number(freshEventData?.sheet_sync?.sequence || 0);

    if (Number.isFinite(freshSequence) && freshSequence > 0) {
      return Math.floor(freshSequence);
    }

    const counterRef = adminDb.collection("analytics").doc(CREDENTIAL_EXPORT_COUNTER_DOC);
    const counterDoc = await transaction.get(counterRef);
    const currentCounter = Number(
      counterDoc.exists ? counterDoc.get("last_sequence") || 0 : 0
    );

    const nextSequence = Number.isFinite(currentCounter) && currentCounter > 0
      ? Math.floor(currentCounter) + 1
      : 1;

    transaction.set(
      counterRef,
      {
        last_sequence: nextSequence,
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    transaction.update(eventRef, {
      "sheet_sync.sequence": nextSequence,
      "sheet_sync.sequence_allocated_at": FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    return nextSequence;
  });
}

async function markSyncSuccess({ eventRef, sequence, worksheetName, updatedRange, syncedAtIso }) {
  await eventRef.update({
    "sheet_sync.status": "SYNCED",
    "sheet_sync.sequence": sequence,
    "sheet_sync.worksheet": worksheetName,
    "sheet_sync.target_range": asTrimmedString(updatedRange || ""),
    "sheet_sync.last_error": FieldValue.delete(),
    "sheet_sync.next_retry_at": FieldValue.delete(),
    "sheet_sync.attempt_count": FieldValue.increment(1),
    "sheet_sync.synced_at": FieldValue.serverTimestamp(),
    "sheet_sync.synced_at_iso": asTrimmedString(syncedAtIso || new Date().toISOString()),
    updated_at: FieldValue.serverTimestamp(),
  });
}

async function markSyncFailure({ eventRef, eventData, error }) {
  const currentAttempts = toNonNegativeInteger(eventData?.sheet_sync?.attempt_count, 0);
  const nextAttempts = currentAttempts + 1;
  const maxRetries = getMaxRetries();
  const exceeded = nextAttempts >= maxRetries;

  const retryDelaySeconds = getRetryDelaySeconds(nextAttempts);
  const nextRetryAt = exceeded
    ? null
    : Timestamp.fromMillis(Date.now() + retryDelaySeconds * 1000);

  await eventRef.update({
    "sheet_sync.status": exceeded ? "DEAD_LETTER" : "FAILED",
    "sheet_sync.last_error": toSafeErrorMessage(error),
    "sheet_sync.last_error_at": FieldValue.serverTimestamp(),
    "sheet_sync.attempt_count": FieldValue.increment(1),
    "sheet_sync.next_retry_at": nextRetryAt || FieldValue.delete(),
    updated_at: FieldValue.serverTimestamp(),
  });
}

async function writeEventToSheet({ eventId, eventRef, eventData, timeoutMs }) {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID.");
  }

  const sequence = await allocateSequenceIfMissing(eventRef, eventData);
  const worksheetName = getWorksheetName(eventData);
  const rowNumber =
    Math.max(1, Number.isFinite(SHEET_HEADER_ROWS) ? SHEET_HEADER_ROWS : 1) + sequence;
  const targetRange = toSheetRange(worksheetName, rowNumber);
  const syncedAtIso = new Date().toISOString();
  const rowValues = buildSheetRow(eventId, eventData, sequence, {
    sheetSyncStatus: "SYNCED",
    sheetSyncedAt: syncedAtIso,
  });

  const sheets = await getSheetsClient();

  await ensureSheetHeader({
    sheets,
    spreadsheetId,
    worksheetName,
    timeoutMs,
  });

  const response = await withTimeout(
    sheets.spreadsheets.values.update({
      spreadsheetId,
      range: targetRange,
      valueInputOption: "RAW",
      requestBody: {
        majorDimension: "ROWS",
        values: [rowValues],
      },
    }),
    timeoutMs,
    "Google Sheets sync"
  );

  const updatedRange = asTrimmedString(
    response?.data?.updatedRange || response?.data?.updates?.updatedRange || targetRange
  );

  await markSyncSuccess({
    eventRef,
    sequence,
    worksheetName,
    updatedRange,
    syncedAtIso,
  });

  return {
    success: true,
    eventId,
    sequence,
    targetRange: updatedRange,
  };
}

export function createCredentialSheetExportEventRef() {
  return adminDb.collection(CREDENTIAL_EXPORT_EVENTS_COLLECTION).doc();
}

export function buildCredentialSheetExportEvent({
  eventType,
  transactionId,
  registrationRef,
  registrationType = "hackathon",
  issuedByAdminUid,
  issuedByAdminEmail,
  credential,
  registration,
  source,
  notes,
}) {
  const normalizedCredential = credential || {};
  const normalizedRegistration = registration || {};

  return {
    event_type: asTrimmedString(eventType || ""),
    source: asTrimmedString(source || "admin-api"),
    request_id: randomUUID(),
    transaction_id: asTrimmedString(transactionId || ""),
    registration_ref: asTrimmedString(registrationRef || ""),
    registration_type: asTrimmedString(registrationType || "hackathon"),
    issued_by_admin_uid: asTrimmedString(issuedByAdminUid || ""),
    issued_by_admin_email: asTrimmedString(issuedByAdminEmail || "").toLowerCase(),
    notes: asTrimmedString(notes || ""),
    created_at: FieldValue.serverTimestamp(),
    created_at_iso: new Date().toISOString(),
    updated_at: FieldValue.serverTimestamp(),
    registration: {
      college_name: asTrimmedString(normalizedRegistration.college_name || ""),
      team_size: toNonNegativeInteger(normalizedRegistration.team_size, 0) || null,
    },
    credential: {
      team_id: asTrimmedString(normalizedCredential.team_id || "").toLowerCase(),
      password_version: toNonNegativeInteger(normalizedCredential.password_version, 0),
      password_issued: normalizedCredential.password_issued === true,
      temporary_password: asTrimmedString(normalizedCredential.password || ""),
      leader_name: asTrimmedString(normalizedCredential.leader_name || ""),
      leader_email: asTrimmedString(normalizedCredential.leader_email || "").toLowerCase(),
      leader_phone: asTrimmedString(normalizedCredential.leader_phone || ""),
      auth_uid: asTrimmedString(normalizedCredential.auth_uid || ""),
    },
    sheet_sync: {
      status: "PENDING",
      worksheet: DEFAULT_WORKSHEET,
      sequence: null,
      attempt_count: 0,
    },
    mail_delivery: {
      status: "PENDING",
      sent_at: null,
      last_error: null,
    },
  };
}

export async function updateLatestCredentialEventMailDelivery({
  transactionId,
  status,
  sentAt = null,
  lastError = "",
  syncSheet = true,
  timeoutMs = DEFAULT_SYNC_TIMEOUT_MS,
}) {
  const normalizedTransactionId = asTrimmedString(transactionId);
  if (!normalizedTransactionId) {
    return {
      updated: false,
      reason: "missing-transaction-id",
    };
  }

  const eventsSnapshot = await adminDb
    .collection(CREDENTIAL_EXPORT_EVENTS_COLLECTION)
    .where("transaction_id", "==", normalizedTransactionId)
    .limit(50)
    .get();

  if (eventsSnapshot.empty) {
    return {
      updated: false,
      reason: "event-not-found",
    };
  }

  const latestDoc = [...eventsSnapshot.docs].sort(
    (leftDoc, rightDoc) =>
      eventSortMillis(rightDoc.data() || {}) - eventSortMillis(leftDoc.data() || {})
  )[0];

  const normalizedStatus = normalizeMailDeliveryStatus(status);
  const normalizedError = asTrimmedString(lastError);
  const updates = {
    "mail_delivery.status": normalizedStatus,
    updated_at: FieldValue.serverTimestamp(),
  };

  if (normalizedStatus === "SUCCESS") {
    const sentAtValue = toTimestampValue(sentAt);
    updates["mail_delivery.sent_at"] = sentAtValue || FieldValue.serverTimestamp();
    updates["mail_delivery.last_error"] = FieldValue.delete();
  } else {
    if (normalizedError) {
      updates["mail_delivery.last_error"] = normalizedError;
    } else {
      updates["mail_delivery.last_error"] = FieldValue.delete();
    }

    const sentAtValue = toTimestampValue(sentAt);
    if (sentAtValue) {
      updates["mail_delivery.sent_at"] = sentAtValue;
    } else {
      updates["mail_delivery.sent_at"] = FieldValue.delete();
    }
  }

  await latestDoc.ref.update(updates);

  let sheetSyncResult = {
    success: false,
    skipped: true,
    reason: "sheet-sync-skipped",
  };

  if (syncSheet) {
    sheetSyncResult = await attemptCredentialSheetExportSync({
      eventId: latestDoc.id,
      force: true,
      timeoutMs,
    });
  }

  return {
    updated: true,
    eventId: latestDoc.id,
    sheetSync: sheetSyncResult,
  };
}

export async function attemptCredentialSheetExportSync({
  eventId,
  force = false,
  timeoutMs = DEFAULT_SYNC_TIMEOUT_MS,
}) {
  const normalizedEventId = asTrimmedString(eventId);

  if (!normalizedEventId) {
    return {
      success: false,
      skipped: true,
      reason: "missing-event-id",
    };
  }

  if (!isSheetSyncEnabled()) {
    return {
      success: false,
      skipped: true,
      reason: "sheet-sync-disabled",
    };
  }

  if (!isSheetSyncConfigured()) {
    return {
      success: false,
      skipped: true,
      reason: "sheet-sync-not-configured",
    };
  }

  const eventRef = adminDb
    .collection(CREDENTIAL_EXPORT_EVENTS_COLLECTION)
    .doc(normalizedEventId);

  const eventDoc = await eventRef.get();
  if (!eventDoc.exists) {
    return {
      success: false,
      skipped: true,
      reason: "event-not-found",
    };
  }

  const eventData = eventDoc.data() || {};

  if (!shouldAttemptSync(eventData, { force })) {
    return {
      success: false,
      skipped: true,
      reason: "retry-window-not-reached",
    };
  }

  try {
    return await writeEventToSheet({
      eventId: normalizedEventId,
      eventRef,
      eventData,
      timeoutMs,
    });
  } catch (error) {
    await markSyncFailure({ eventRef, eventData, error });

    return {
      success: false,
      skipped: false,
      reason: "sheet-sync-failed",
      error: toSafeErrorMessage(error),
    };
  }
}
