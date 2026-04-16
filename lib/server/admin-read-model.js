import { FieldValue, adminDb } from "../../firebaseAdmin.js";

const ENV = globalThis?.process?.env || {};

const EMAIL_QUEUE_COLLECTION =
  String(ENV.FIREBASE_EMAIL_QUEUE_COLLECTION || "mail").trim() || "mail";

export const ADMIN_READ_MODEL_COLLECTION =
  String(ENV.ADMIN_READ_MODEL_COLLECTION || "admin_registrations_read_model").trim() ||
  "admin_registrations_read_model";

const ADMIN_READ_MODEL_VERSION = 1;

function asTrimmedString(value) {
  return String(value || "").trim();
}

function asNormalizedEmail(value) {
  return asTrimmedString(value).toLowerCase();
}

function normalizeDeliveryState(value) {
  const normalized = asTrimmedString(value).toUpperCase();
  if (
    ["NOT_READY", "UNSENT", "PENDING", "PROCESSING", "RETRY", "SUCCESS", "ERROR"].includes(
      normalized
    )
  ) {
    return normalized;
  }

  return "UNSENT";
}

function readDeliveryError(value) {
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

function toIsoString(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toEpochMs(value) {
  const isoString = asTrimmedString(value);
  if (!isoString) {
    return 0;
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return date.getTime();
}

function toOptionalPositiveLimit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.floor(numeric);
}

function parseCursorDate(cursor) {
  const normalized = asTrimmedString(cursor);
  if (!normalized) {
    return null;
  }

  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric > 0) {
    const numericDate = new Date(numeric);
    return Number.isNaN(numericDate.getTime()) ? null : numericDate;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseCursorEpochMs(cursor) {
  const normalized = asTrimmedString(cursor);
  if (!normalized) {
    return null;
  }

  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric);
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getTime();
}

async function loadWorkshopRegistration(registrationRef) {
  const workshopDoc = await adminDb.collection("workshop_registrations").doc(registrationRef).get();

  if (!workshopDoc.exists) {
    return null;
  }

  const workshopData = workshopDoc.data();
  const participantId = workshopData?.participant_id;
  let participant = null;

  if (participantId) {
    const participantDoc = await adminDb.collection("participants").doc(participantId).get();
    if (participantDoc.exists) {
      const participantData = participantDoc.data();
      participant = {
        name: participantData?.name || null,
        email: participantData?.email || null,
        phone: participantData?.phone || null,
        roll: participantData?.roll_number || participantData?.roll || null,
        branch:
          participantData?.branch ||
          participantData?.department ||
          workshopData?.branch ||
          workshopData?.department ||
          null,
        year_of_study:
          participantData?.year_of_study ||
          participantData?.yearOfStudy ||
          workshopData?.year_of_study ||
          workshopData?.yearOfStudy ||
          null,
        state: participantData?.state || workshopData?.state || null,
        college: workshopData?.college || null,
      };
    }
  }

  return {
    workshop_id: workshopDoc.id,
    participant,
  };
}

async function resolveEmailDeliveryStatus({
  accessCredentials,
  paymentVerified,
}) {
  const rawDelivery = accessCredentials?.email_delivery || {};
  const queueDocId = asTrimmedString(rawDelivery?.queue_doc_id);
  const queueCollection = asTrimmedString(rawDelivery?.collection) || EMAIL_QUEUE_COLLECTION;
  const recipient = asNormalizedEmail(rawDelivery?.recipient || accessCredentials?.leader_email);

  let state = normalizeDeliveryState(rawDelivery?.state);
  let requestedAt = toIsoString(rawDelivery?.requested_at);
  let lastAttemptAt = toIsoString(rawDelivery?.last_attempt_at);
  let sentAt = toIsoString(rawDelivery?.sent_at);
  let attempts = Number(rawDelivery?.attempts || 0);
  let error = asTrimmedString(rawDelivery?.error);
  let requestId = asTrimmedString(rawDelivery?.request_id);
  let requestCount = Number(rawDelivery?.request_count || 0);
  let retryCount = Number(rawDelivery?.retry_count || 0);
  let decisionReason = asTrimmedString(rawDelivery?.last_decision_reason);

  if (queueDocId) {
    const queueDoc = await adminDb.collection(queueCollection).doc(queueDocId).get();
    if (queueDoc.exists) {
      const queueData = queueDoc.data() || {};
      const deliveryData = queueData?.delivery || {};

      state = normalizeDeliveryState(deliveryData?.state || queueData?.delivery_state || state);
      requestedAt = requestedAt || toIsoString(queueData?.createdAt || queueData?.created_at);
      lastAttemptAt =
        toIsoString(
          deliveryData?.attemptTime ||
            deliveryData?.lastAttemptTime ||
            deliveryData?.last_attempt_at ||
            deliveryData?.endTime
        ) || lastAttemptAt;
      sentAt = toIsoString(deliveryData?.endTime || deliveryData?.sentAt || deliveryData?.sent_at) || sentAt;

      const attemptCount = Number(deliveryData?.attempts);
      attempts = Number.isFinite(attemptCount) && attemptCount >= 0 ? attemptCount : attempts;
      error = readDeliveryError(deliveryData?.error || deliveryData?.info?.error || queueData?.error) || error;
    } else if (state === "UNSENT") {
      state = "PENDING";
    }
  }

  if (!paymentVerified || !recipient) {
    state = "NOT_READY";
  } else if (!queueDocId && state !== "SUCCESS") {
    state = "UNSENT";
  }

  return {
    state,
    can_send: paymentVerified && Boolean(recipient) && state !== "SUCCESS",
    queue_doc_id: queueDocId || null,
    collection: queueCollection,
    recipient: recipient || null,
    requested_at: requestedAt,
    last_attempt_at: lastAttemptAt,
    sent_at: sentAt,
    attempts: Number.isFinite(attempts) && attempts > 0 ? attempts : 0,
    request_id: requestId || null,
    request_count:
      Number.isFinite(requestCount) && requestCount > 0 ? Math.floor(requestCount) : 0,
    retry_count:
      Number.isFinite(retryCount) && retryCount > 0 ? Math.floor(retryCount) : 0,
    last_decision_reason: decisionReason || null,
    error: error || null,
  };
}

async function loadHackathonRegistration(registrationRef, paymentVerified) {
  const teamDoc = await adminDb.collection("hackathon_registrations").doc(registrationRef).get();

  if (!teamDoc.exists) {
    return null;
  }

  const teamData = teamDoc.data();
  const memberIds = Array.isArray(teamData?.member_ids) ? teamData.member_ids : [];

  const memberDocs = await Promise.all(
    memberIds.map((participantId) => adminDb.collection("participants").doc(participantId).get())
  );

  const members = memberDocs
    .filter((doc) => doc.exists)
    .map((doc) => {
      const data = doc.data();
      return {
        participant_id: doc.id,
        name: data?.name || null,
        email: data?.email || null,
        phone: data?.phone || null,
        roll: data?.roll_number || data?.roll || null,
        branch: data?.branch || data?.department || null,
        year_of_study: data?.year_of_study || data?.yearOfStudy || null,
        state: data?.state || teamData?.state || null,
      };
    });

  const rawAccessCredentials = teamData?.access_credentials || null;
  const normalizedAccessCredentials =
    rawAccessCredentials || teamData?.team_access_id
      ? {
          team_id: teamData?.team_access_id || rawAccessCredentials?.team_id || null,
          leader_name: rawAccessCredentials?.leader_name || null,
          leader_email: rawAccessCredentials?.leader_email || null,
          leader_phone: rawAccessCredentials?.leader_phone || null,
          auth_uid: teamData?.team_lead_auth_uid || rawAccessCredentials?.auth_uid || null,
          password_version: rawAccessCredentials?.password_version || null,
          generated_at: toIsoString(rawAccessCredentials?.generated_at),
          updated_at: toIsoString(rawAccessCredentials?.updated_at),
          email_delivery: rawAccessCredentials?.email_delivery || null,
        }
      : null;

  const emailDelivery = normalizedAccessCredentials
    ? await resolveEmailDeliveryStatus({
        accessCredentials: normalizedAccessCredentials,
        paymentVerified: paymentVerified === true,
      })
    : {
        state: paymentVerified === true ? "UNSENT" : "NOT_READY",
        can_send: false,
        queue_doc_id: null,
        collection: EMAIL_QUEUE_COLLECTION,
        recipient: null,
        requested_at: null,
        last_attempt_at: null,
        sent_at: null,
        attempts: 0,
        error: null,
      };

  const accessCredentials =
    rawAccessCredentials || teamData?.team_access_id
      ? {
          team_id: teamData?.team_access_id || rawAccessCredentials?.team_id || null,
          leader_name: rawAccessCredentials?.leader_name || null,
          leader_email: rawAccessCredentials?.leader_email || null,
          leader_phone: rawAccessCredentials?.leader_phone || null,
          auth_uid: teamData?.team_lead_auth_uid || rawAccessCredentials?.auth_uid || null,
          password_version: rawAccessCredentials?.password_version || null,
          generated_at: toIsoString(rawAccessCredentials?.generated_at),
          updated_at: toIsoString(rawAccessCredentials?.updated_at),
          email_delivery: emailDelivery,
        }
      : null;

  return {
    team_id: teamDoc.id,
    team_name: teamData?.team_name || null,
    college: teamData?.college || null,
    state: teamData?.state || null,
    team_size: teamData?.team_size || null,
    members,
    access_credentials: accessCredentials,
  };
}

export async function buildAdminRegistrationItem(transaction) {
  let registration = null;

  if (transaction?.registration_type === "workshop") {
    registration = await loadWorkshopRegistration(transaction.registration_ref);
  } else if (transaction?.registration_type === "hackathon") {
    registration = await loadHackathonRegistration(
      transaction.registration_ref,
      transaction.status === "verified"
    );
  }

  return {
    transaction_id: transaction?.transaction_id || transaction?.id || null,
    registration_type: transaction?.registration_type || null,
    status: transaction?.status || null,
    amount: transaction?.amount || null,
    upi_transaction_id: transaction?.upi_transaction_id || null,
    screenshot_url: transaction?.screenshot_url || null,
    created_at: toIsoString(transaction?.created_at),
    verified_at: toIsoString(transaction?.verified_at),
    registration,
  };
}

async function listTransactionsFromSource({ type, status, limit, cursor } = {}) {
  let query = adminDb.collection("transactions");

  if (status) {
    query = query.where("status", "==", status);
  }

  if (type) {
    query = query.where("registration_type", "==", type);
  }

  query = query.orderBy("created_at", "desc");

  const cursorDate = parseCursorDate(cursor);
  if (cursorDate) {
    query = query.startAfter(cursorDate);
  }

  const pageLimit = toOptionalPositiveLimit(limit);
  if (pageLimit !== null) {
    query = query.limit(pageLimit + 1);
  }

  const transactionsSnapshot = await query.get();
  const transactions = transactionsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  if (pageLimit === null) {
    return {
      transactions,
      pagination: null,
    };
  }

  const hasMore = transactions.length > pageLimit;
  const pageTransactions = hasMore ? transactions.slice(0, pageLimit) : transactions;
  const lastItem = pageTransactions.length > 0 ? pageTransactions[pageTransactions.length - 1] : null;

  return {
    transactions: pageTransactions,
    pagination: {
      limit: pageLimit,
      cursor: asTrimmedString(cursor) || null,
      next_cursor: hasMore ? toIsoString(lastItem?.created_at) : null,
      has_more: hasMore,
    },
  };
}

export async function buildAdminRegistrationsPayloadFromSource({
  type,
  status,
  limit,
  cursor,
} = {}) {
  const listed = await listTransactionsFromSource({ type, status, limit, cursor });
  const transactions = Array.isArray(listed?.transactions) ? listed.transactions : [];
  const registrations = await Promise.all(
    transactions.map((transaction) => buildAdminRegistrationItem(transaction))
  );

  return {
    success: true,
    registrations,
    pagination: listed?.pagination || null,
  };
}

function buildReadModelDoc(item) {
  return {
    transaction_id: item.transaction_id,
    registration_type: item.registration_type,
    status: item.status,
    created_at: item.created_at,
    created_at_epoch_ms: toEpochMs(item.created_at),
    verified_at: item.verified_at,
    item,
    read_model_version: ADMIN_READ_MODEL_VERSION,
    updated_at: FieldValue.serverTimestamp(),
  };
}

function matchesReadModelFilter(item, { type, status }) {
  if (type && item?.registration_type !== type) {
    return false;
  }

  if (status && item?.status !== status) {
    return false;
  }

  return true;
}

export async function readAdminRegistrationsPayloadFromReadModel({
  type,
  status,
  limit,
  cursor,
} = {}) {
  let query = adminDb.collection(ADMIN_READ_MODEL_COLLECTION);

  if (type) {
    query = query.where("registration_type", "==", type);
  }

  if (status) {
    query = query.where("status", "==", status);
  }

  query = query.orderBy("created_at_epoch_ms", "desc");

  const cursorEpochMs = parseCursorEpochMs(cursor);
  if (cursorEpochMs !== null) {
    query = query.startAfter(cursorEpochMs);
  }

  const pageLimit = toOptionalPositiveLimit(limit);
  if (pageLimit !== null) {
    query = query.limit(pageLimit + 1);
  }

  const snapshot = await query.get();
  const docs = snapshot.docs;

  const hasMore = pageLimit !== null ? docs.length > pageLimit : false;
  const pageDocs = pageLimit !== null && hasMore ? docs.slice(0, pageLimit) : docs;

  const registrations = pageDocs
    .map((doc) => doc.data()?.item)
    .filter(Boolean)
    .filter((item) => matchesReadModelFilter(item, { type, status }));

  const lastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;
  const nextCursor =
    pageLimit !== null && hasMore
      ? Number(lastDoc?.data()?.created_at_epoch_ms || 0) || null
      : null;

  return {
    success: true,
    registrations,
    pagination:
      pageLimit !== null
        ? {
            limit: pageLimit,
            cursor: asTrimmedString(cursor) || null,
            next_cursor: nextCursor,
            has_more: hasMore,
          }
        : null,
  };
}

async function hasAnySourceTransactions() {
  const snapshot = await adminDb.collection("transactions").limit(1).get();
  return !snapshot.empty;
}

export async function loadAdminRegistrationsPayload({
  type,
  status,
  preferReadModel = false,
  limit,
  cursor,
} = {}) {
  if (preferReadModel) {
    try {
      const readModelPayload = await readAdminRegistrationsPayloadFromReadModel({
        type,
        status,
        limit,
        cursor,
      });
      const isFirstPage = !asTrimmedString(cursor);

      if (readModelPayload.registrations.length > 0 || !isFirstPage) {
        return {
          payload: readModelPayload,
          source: "read-model",
        };
      }

      const hasSourceData = await hasAnySourceTransactions();
      if (!hasSourceData) {
        return {
          payload: readModelPayload,
          source: "read-model-empty",
        };
      }
    } catch (error) {
      console.error("Failed to read admin registrations from read model:", error);
    }
  }

  return {
    payload: await buildAdminRegistrationsPayloadFromSource({ type, status, limit, cursor }),
    source: "source",
  };
}

export async function upsertAdminReadModelForTransaction(transactionId) {
  const normalizedTransactionId = asTrimmedString(transactionId);
  if (!normalizedTransactionId) {
    return {
      updated: false,
      reason: "missing-transaction-id",
    };
  }

  const transactionRef = adminDb.collection("transactions").doc(normalizedTransactionId);
  const transactionDoc = await transactionRef.get();

  if (!transactionDoc.exists) {
    await adminDb.collection(ADMIN_READ_MODEL_COLLECTION).doc(normalizedTransactionId).delete();
    return {
      updated: false,
      deleted: true,
    };
  }

  const item = await buildAdminRegistrationItem({
    id: transactionDoc.id,
    ...transactionDoc.data(),
  });

  await adminDb
    .collection(ADMIN_READ_MODEL_COLLECTION)
    .doc(normalizedTransactionId)
    .set(buildReadModelDoc(item), { merge: true });

  return {
    updated: true,
    transactionId: normalizedTransactionId,
  };
}

export async function deleteAdminReadModelForTransaction(transactionId) {
  const normalizedTransactionId = asTrimmedString(transactionId);
  if (!normalizedTransactionId) {
    return {
      deleted: false,
      reason: "missing-transaction-id",
    };
  }

  await adminDb.collection(ADMIN_READ_MODEL_COLLECTION).doc(normalizedTransactionId).delete();

  return {
    deleted: true,
    transactionId: normalizedTransactionId,
  };
}
