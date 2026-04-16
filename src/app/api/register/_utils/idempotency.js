import crypto from "node:crypto";
import { FieldValue, adminDb } from "../../../../../firebaseAdmin";

const ENV = globalThis?.process?.env || {};
const IDEMPOTENCY_COLLECTION =
  String(ENV.REGISTRATION_IDEMPOTENCY_COLLECTION || "registration_idempotency").trim() ||
  "registration_idempotency";

const IDEMPOTENCY_LOCK_TTL_MS = (() => {
  const rawValue = Number(ENV.REGISTRATION_IDEMPOTENCY_LOCK_TTL_MS || 120000);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 120000;
  }

  return Math.floor(rawValue);
})();

function asTrimmedString(value) {
  return String(value ?? "").trim();
}

function normalizeIdempotencyKey(value) {
  return asTrimmedString(value).slice(0, 240);
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

    const normalized = {};
    for (const [key, entryValue] of entries) {
      normalized[key] = canonicalize(entryValue);
    }

    return normalized;
  }

  return value;
}

function buildPayloadHash(body) {
  try {
    const canonicalPayload = canonicalize(body || {});
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(canonicalPayload))
      .digest("hex");
  } catch {
    return "";
  }
}

function timestampToMillis(value) {
  if (!value) {
    return 0;
  }

  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric);
  }

  return 0;
}

function buildRecordId(scope, idempotencyKey) {
  const normalizedScope = asTrimmedString(scope) || "register";
  return crypto
    .createHash("sha256")
    .update(`${normalizedScope}:${idempotencyKey}`)
    .digest("hex");
}

export async function beginRegistrationIdempotency({ request, body, scope }) {
  const headerKey = normalizeIdempotencyKey(request.headers.get("x-idempotency-key"));
  const bodyKey = normalizeIdempotencyKey(body?.idempotency_key);
  const idempotencyKey = headerKey || bodyKey;

  if (!idempotencyKey) {
    return {
      enabled: false,
      idempotencyKey: "",
      mode: "disabled",
      recordRef: null,
    };
  }

  const payloadHash = buildPayloadHash(body);
  const recordId = buildRecordId(scope, idempotencyKey);
  const recordRef = adminDb.collection(IDEMPOTENCY_COLLECTION).doc(recordId);
  const nowMs = Date.now();

  const beginResult = await adminDb.runTransaction(async (transaction) => {
    const recordDoc = await transaction.get(recordRef);

    if (recordDoc.exists) {
      const recordData = recordDoc.data() || {};
      const previousPayloadHash = asTrimmedString(recordData.payload_hash);

      if (previousPayloadHash && payloadHash && previousPayloadHash !== payloadHash) {
        return {
          mode: "payload-mismatch",
        };
      }

      const recordStatus = asTrimmedString(recordData.status).toLowerCase();

      if (recordStatus === "succeeded") {
        const replayStatus = Number(recordData.response_status || 200);
        const replayBody = recordData.response_body || { success: true };

        return {
          mode: "replay",
          replayStatus: Number.isFinite(replayStatus) ? replayStatus : 200,
          replayBody,
        };
      }

      if (recordStatus === "processing") {
        const startedAtMs = timestampToMillis(recordData.started_at);
        if (startedAtMs > 0 && nowMs - startedAtMs < IDEMPOTENCY_LOCK_TTL_MS) {
          return {
            mode: "in-progress",
          };
        }
      }
    }

    transaction.set(
      recordRef,
      {
        scope: asTrimmedString(scope) || "register",
        idempotency_key: idempotencyKey,
        payload_hash: payloadHash || null,
        status: "processing",
        started_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      mode: "started",
    };
  });

  return {
    enabled: true,
    idempotencyKey,
    payloadHash,
    mode: beginResult.mode,
    replayStatus: beginResult.replayStatus || null,
    replayBody: beginResult.replayBody || null,
    recordRef,
  };
}

export async function finalizeRegistrationIdempotency({
  context,
  status,
  responseBody,
  errorMessage,
}) {
  if (!context?.enabled || context.mode !== "started" || !context.recordRef) {
    return;
  }

  const numericStatus = Number(status || 500);
  const isSuccessResponse = Number.isFinite(numericStatus) && numericStatus > 0 && numericStatus < 500;

  const updatePayload = {
    status: isSuccessResponse ? "succeeded" : "failed",
    response_status: isSuccessResponse ? numericStatus : null,
    response_body: isSuccessResponse ? responseBody || { success: true } : null,
    last_error: isSuccessResponse ? null : asTrimmedString(errorMessage) || "Request failed.",
    completed_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };

  try {
    await context.recordRef.set(updatePayload, { merge: true });
  } catch (error) {
    console.error("Failed to finalize idempotency record:", error);
  }
}
