import { randomUUID } from "node:crypto";
import { adminDb, FieldValue, Timestamp } from "../../../../../firebaseAdmin.js";

const ENV = globalThis?.process?.env || {};

export const TEAM_SHEET_EXPORT_EVENTS_COLLECTION =
  String(ENV.TEAM_SHEET_EXPORT_EVENTS_COLLECTION || "team_sheet_export_events").trim() ||
  "team_sheet_export_events";

const TEAM_SHEET_EXPORT_COUNTER_DOC =
  String(ENV.TEAM_SHEET_EXPORT_COUNTER_DOC || "team_sheet_sync").trim() ||
  "team_sheet_sync";

const PROBLEM_SELECTION_WORKSHEET =
  String(
    ENV.TEAM_PS_SHEET_WORKSHEET_OVERRIDE ||
      ENV.TEAM_PS_SHEET_WORKSHEET ||
      "ProblemSelections"
  ).trim() ||
  "ProblemSelections";

const SUBMISSION_WORKSHEET =
  String(
    ENV.TEAM_SUBMISSION_SHEET_WORKSHEET_OVERRIDE ||
      ENV.TEAM_SUBMISSION_SHEET_WORKSHEET ||
      "FinalSubmissions"
  ).trim() ||
  "FinalSubmissions";

const SHEET_HEADER_ROWS = Number.parseInt(String(ENV.TEAM_SHEET_HEADER_ROWS || "1"), 10);

const DEFAULT_SYNC_TIMEOUT_MS = Number.parseInt(
  String(ENV.TEAM_SHEET_SYNC_TIMEOUT_MS || "3500"),
  10
);

const DEFAULT_MAX_RETRIES = Number.parseInt(
  String(ENV.TEAM_SHEET_SYNC_MAX_RETRIES || "15"),
  10
);

const RETRY_BASE_SECONDS = Number.parseInt(
  String(ENV.TEAM_SHEET_SYNC_RETRY_BASE_SECONDS || "30"),
  10
);

const RETRY_MAX_SECONDS = Number.parseInt(
  String(ENV.TEAM_SHEET_SYNC_RETRY_MAX_SECONDS || "3600"),
  10
);

const SHEET_COLUMN_END = "Z";

const EVENT_TYPES = Object.freeze({
  PROBLEM_SELECTION: "PROBLEM_SELECTION",
  TEAM_SUBMISSION: "TEAM_SUBMISSION",
});

const PROBLEM_SELECTION_HEADERS = Object.freeze([
  "sequence_no",
  "event_id",
  "event_type",
  "event_created_at",
  "ps_id",
  "ps_title",
  "team_id",
  "team_name",
  "team_lead_name",
  "mobile_no",
  "mail",
  "selected_teams_count",
  "max_teams_allowed",
  "sheet_sync_status",
  "sheet_synced_at",
  "notes",
]);

const TEAM_SUBMISSION_HEADERS = Object.freeze([
  "sequence_no",
  "event_id",
  "event_type",
  "event_created_at",
  "team_id",
  "team_name",
  "team_lead_name",
  "mobile_no",
  "mail",
  "github_link",
  "ppt_drive_link",
  "sheet_sync_status",
  "sheet_synced_at",
  "notes",
]);

let sheetsClientPromise = null;

function asTrimmedString(value) {
  return String(value || "").trim();
}

function parseBoolean(value) {
  const normalized = asTrimmedString(value).toLowerCase();
  return ["1", "true", "yes", "y", "on", "enabled"].includes(normalized);
}

function toNonNegativeInteger(value, fallbackValue = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallbackValue;
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

function parseTimestampMillis(value) {
  if (!value) return NaN;

  if (typeof value?.toMillis === "function") {
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

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
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

function toSafeErrorMessage(error) {
  const message = asTrimmedString(error?.message || "Unknown team sheet sync failure.");
  return message.slice(0, 1500);
}

function normalizePrivateKey(value) {
  return asTrimmedString(value).replace(/\\n/g, "\n");
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

function isRunningInGoogleCloud() {
  return (
    Boolean(ENV.K_SERVICE) ||
    Boolean(ENV.FUNCTION_TARGET) ||
    Boolean(ENV.GOOGLE_CLOUD_PROJECT) ||
    Boolean(ENV.GCLOUD_PROJECT)
  );
}

function getSpreadsheetId() {
  return asTrimmedString(
    ENV.TEAM_SHEET_SPREADSHEET_ID || ENV.GOOGLE_SHEETS_SPREADSHEET_ID || ""
  );
}

function isTeamSheetSyncEnabled() {
  return parseBoolean(ENV.TEAM_SHEET_SYNC_ENABLED || "false");
}

function isTeamSheetSyncConfigured() {
  return Boolean(
    getSpreadsheetId() && (readServiceAccountFromEnv() || isRunningInGoogleCloud())
  );
}

function getEventType(value) {
  const normalized = asTrimmedString(value).toUpperCase();
  if (normalized === EVENT_TYPES.PROBLEM_SELECTION) {
    return EVENT_TYPES.PROBLEM_SELECTION;
  }

  if (normalized === EVENT_TYPES.TEAM_SUBMISSION) {
    return EVENT_TYPES.TEAM_SUBMISSION;
  }

  return "";
}

function getWorksheetForEventType(eventType) {
  if (eventType === EVENT_TYPES.TEAM_SUBMISSION) {
    return SUBMISSION_WORKSHEET;
  }

  return PROBLEM_SELECTION_WORKSHEET;
}

function getHeadersForEventType(eventType) {
  if (eventType === EVENT_TYPES.TEAM_SUBMISSION) {
    return TEAM_SUBMISSION_HEADERS;
  }

  return PROBLEM_SELECTION_HEADERS;
}

function getWorksheetName(eventData) {
  const eventType = getEventType(eventData?.event_type);

  const forceProblemWorksheet = asTrimmedString(
    ENV.TEAM_PS_SHEET_WORKSHEET_FORCE_OVERRIDE || ""
  );
  if (eventType === EVENT_TYPES.PROBLEM_SELECTION && forceProblemWorksheet) {
    return forceProblemWorksheet;
  }

  const forceSubmissionWorksheet = asTrimmedString(
    ENV.TEAM_SUBMISSION_SHEET_WORKSHEET_FORCE_OVERRIDE || ""
  );
  if (eventType === EVENT_TYPES.TEAM_SUBMISSION && forceSubmissionWorksheet) {
    return forceSubmissionWorksheet;
  }

  const candidate = asTrimmedString(eventData?.sheet_sync?.worksheet || "");
  if (candidate) {
    return candidate;
  }

  return getWorksheetForEventType(eventType);
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

async function ensureSheetHeader({
  sheets,
  spreadsheetId,
  worksheetName,
  timeoutMs,
  headers,
}) {
  const headerRange = toSheetRange(worksheetName, 1);

  const response = await withTimeout(
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: headerRange,
    }),
    timeoutMs,
    "Team sheet header read"
  );

  const currentHeader = Array.isArray(response?.data?.values?.[0])
    ? response.data.values[0].map((value) => asTrimmedString(value))
    : [];

  const headerMatches =
    currentHeader.length === headers.length &&
    headers.every((column, index) => currentHeader[index] === column);

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
        values: [headers],
      },
    }),
    timeoutMs,
    "Team sheet header write"
  );
}

function buildProblemSelectionRow(eventId, eventData, sequence, options = {}) {
  const payload = eventData?.payload || {};
  const sheetSyncStatus = asTrimmedString(options?.sheetSyncStatus || "PENDING") || "PENDING";
  const sheetSyncedAt = asTrimmedString(options?.sheetSyncedAt || "");

  return [
    sequence,
    asTrimmedString(eventId),
    EVENT_TYPES.PROBLEM_SELECTION,
    asTrimmedString(eventData?.created_at_iso),
    asTrimmedString(payload?.problem_id),
    asTrimmedString(payload?.problem_title),
    asTrimmedString(payload?.team_id),
    asTrimmedString(payload?.team_name),
    asTrimmedString(payload?.team_lead_name),
    asTrimmedString(payload?.team_lead_phone),
    asTrimmedString(payload?.team_lead_email),
    asTrimmedString(payload?.selected_teams_count),
    asTrimmedString(payload?.max_teams_allowed),
    sheetSyncStatus,
    sheetSyncedAt,
    asTrimmedString(eventData?.notes),
  ].map(sanitizeSheetCell);
}

function buildSubmissionRow(eventId, eventData, sequence, options = {}) {
  const payload = eventData?.payload || {};
  const sheetSyncStatus = asTrimmedString(options?.sheetSyncStatus || "PENDING") || "PENDING";
  const sheetSyncedAt = asTrimmedString(options?.sheetSyncedAt || "");

  return [
    sequence,
    asTrimmedString(eventId),
    EVENT_TYPES.TEAM_SUBMISSION,
    asTrimmedString(eventData?.created_at_iso),
    asTrimmedString(payload?.team_id),
    asTrimmedString(payload?.team_name),
    asTrimmedString(payload?.team_lead_name),
    asTrimmedString(payload?.team_lead_phone),
    asTrimmedString(payload?.team_lead_email),
    asTrimmedString(payload?.github_link),
    asTrimmedString(payload?.ppt_drive_link),
    sheetSyncStatus,
    sheetSyncedAt,
    asTrimmedString(eventData?.notes),
  ].map(sanitizeSheetCell);
}

function buildSheetRow(eventId, eventData, sequence, options = {}) {
  const eventType = getEventType(eventData?.event_type);

  if (eventType === EVENT_TYPES.TEAM_SUBMISSION) {
    return buildSubmissionRow(eventId, eventData, sequence, options);
  }

  return buildProblemSelectionRow(eventId, eventData, sequence, options);
}

async function allocateSequenceIfMissing(eventRef, eventData) {
  const currentSequence = Number(eventData?.sheet_sync?.sequence || 0);
  if (Number.isFinite(currentSequence) && currentSequence > 0) {
    return Math.floor(currentSequence);
  }

  return adminDb.runTransaction(async (transaction) => {
    const freshEventDoc = await transaction.get(eventRef);
    if (!freshEventDoc.exists) {
      throw new Error("Team sheet export event not found.");
    }

    const freshData = freshEventDoc.data() || {};
    const freshSequence = Number(freshData?.sheet_sync?.sequence || 0);

    if (Number.isFinite(freshSequence) && freshSequence > 0) {
      return Math.floor(freshSequence);
    }

    const counterRef = adminDb.collection("analytics").doc(TEAM_SHEET_EXPORT_COUNTER_DOC);
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
    throw new Error("Missing spreadsheet id for team sheet sync.");
  }

  const eventType = getEventType(eventData?.event_type);
  if (!eventType) {
    throw new Error("Unsupported team sheet export event type.");
  }

  const sequence = await allocateSequenceIfMissing(eventRef, eventData);
  const worksheetName = getWorksheetName(eventData);
  const headers = getHeadersForEventType(eventType);
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
    headers,
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
    "Team sheet sync"
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

export function createTeamSheetExportEventRef() {
  return adminDb.collection(TEAM_SHEET_EXPORT_EVENTS_COLLECTION).doc();
}

function buildBaseSheetExportEvent({ eventType, source, notes }) {
  const normalizedEventType = getEventType(eventType);

  if (!normalizedEventType) {
    throw new Error("Invalid team sheet export event_type.");
  }

  return {
    event_type: normalizedEventType,
    source: asTrimmedString(source || "team-api"),
    request_id: randomUUID(),
    notes: asTrimmedString(notes || ""),
    created_at: FieldValue.serverTimestamp(),
    created_at_iso: new Date().toISOString(),
    updated_at: FieldValue.serverTimestamp(),
    sheet_sync: {
      status: "PENDING",
      worksheet: getWorksheetForEventType(normalizedEventType),
      sequence: null,
      attempt_count: 0,
    },
  };
}

export function buildProblemSelectionSheetExportEvent({
  teamId,
  teamName,
  problemId,
  problemTitle,
  teamLeadName,
  teamLeadEmail,
  teamLeadPhone,
  selectedTeamsCount,
  maxTeamsAllowed,
  source,
  notes,
}) {
  return {
    ...buildBaseSheetExportEvent({
      eventType: EVENT_TYPES.PROBLEM_SELECTION,
      source,
      notes,
    }),
    payload: {
      team_id: asTrimmedString(teamId).toLowerCase(),
      team_name: asTrimmedString(teamName),
      problem_id: asTrimmedString(problemId).toUpperCase(),
      problem_title: asTrimmedString(problemTitle),
      team_lead_name: asTrimmedString(teamLeadName),
      team_lead_email: asTrimmedString(teamLeadEmail).toLowerCase(),
      team_lead_phone: asTrimmedString(teamLeadPhone),
      selected_teams_count: toNonNegativeInteger(selectedTeamsCount, 0),
      max_teams_allowed: toNonNegativeInteger(maxTeamsAllowed, 0),
    },
  };
}

export function buildTeamSubmissionSheetExportEvent({
  teamId,
  teamName,
  teamLeadName,
  teamLeadEmail,
  teamLeadPhone,
  githubLink,
  pptDriveLink,
  source,
  notes,
}) {
  return {
    ...buildBaseSheetExportEvent({
      eventType: EVENT_TYPES.TEAM_SUBMISSION,
      source,
      notes,
    }),
    payload: {
      team_id: asTrimmedString(teamId).toLowerCase(),
      team_name: asTrimmedString(teamName),
      team_lead_name: asTrimmedString(teamLeadName),
      team_lead_email: asTrimmedString(teamLeadEmail).toLowerCase(),
      team_lead_phone: asTrimmedString(teamLeadPhone),
      github_link: asTrimmedString(githubLink),
      ppt_drive_link: asTrimmedString(pptDriveLink),
    },
  };
}

export async function attemptTeamSheetExportSync({
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

  if (!isTeamSheetSyncEnabled()) {
    return {
      success: false,
      skipped: true,
      reason: "team-sheet-sync-disabled",
    };
  }

  if (!isTeamSheetSyncConfigured()) {
    return {
      success: false,
      skipped: true,
      reason: "team-sheet-sync-not-configured",
    };
  }

  const eventRef = adminDb
    .collection(TEAM_SHEET_EXPORT_EVENTS_COLLECTION)
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
      reason: "team-sheet-sync-failed",
      error: toSafeErrorMessage(error),
    };
  }
}
