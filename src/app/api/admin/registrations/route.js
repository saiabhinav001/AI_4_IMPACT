import { NextResponse } from "next/server";
import { adminDb } from "../../../../../firebaseAdmin";
import { requireAdmin } from "../_utils/auth";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["workshop", "hackathon"]);
const ALLOWED_STATUSES = new Set(["pending", "verified", "rejected"]);
const ENV = globalThis?.process?.env || {};
const EMAIL_QUEUE_COLLECTION =
  String(ENV.FIREBASE_EMAIL_QUEUE_COLLECTION || "mail").trim() || "mail";

function asTrimmedString(value) {
  return String(value || "").trim();
}

function asNormalizedEmail(value) {
  return asTrimmedString(value).toLowerCase();
}

function normalizeDeliveryState(value) {
  const normalized = asTrimmedString(value).toUpperCase();
  if (["NOT_READY", "UNSENT", "PENDING", "PROCESSING", "RETRY", "SUCCESS", "ERROR"].includes(normalized)) {
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

function badRequest(error) {
  return NextResponse.json({ error }, { status: 400 });
}

async function loadWorkshopRegistration(registrationRef) {
  const workshopDoc = await adminDb
    .collection("workshop_registrations")
    .doc(registrationRef)
    .get();

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

      state = normalizeDeliveryState(
        deliveryData?.state || queueData?.delivery_state || state
      );
      requestedAt =
        requestedAt ||
        toIsoString(queueData?.createdAt || queueData?.created_at);
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
      error =
        readDeliveryError(deliveryData?.error || deliveryData?.info?.error || queueData?.error) ||
        error;
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
  const teamDoc = await adminDb
    .collection("hackathon_registrations")
    .doc(registrationRef)
    .get();

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
      };
    });

  const rawAccessCredentials = teamData?.access_credentials || null;
  const normalizedAccessCredentials = rawAccessCredentials || teamData?.team_access_id
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

  const accessCredentials = rawAccessCredentials || teamData?.team_access_id
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
    team_size: teamData?.team_size || null,
    members,
    access_credentials: accessCredentials,
  };
}

export async function GET(request) {
  const authResult = await requireAdmin(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    if (type && !ALLOWED_TYPES.has(type)) {
      return badRequest("type must be workshop or hackathon.");
    }

    if (status && !ALLOWED_STATUSES.has(status)) {
      return badRequest("status must be pending, verified, or rejected.");
    }

    let query = adminDb.collection("transactions");
    if (status) {
      query = query.where("status", "==", status);
    }
    if (type) {
      query = query.where("registration_type", "==", type);
    }

    const transactionsSnapshot = await query.orderBy("created_at", "desc").get();

    const filteredTransactions = transactionsSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }));

    const registrations = await Promise.all(
      filteredTransactions.map(async (transaction) => {
        let registration = null;

        if (transaction.registration_type === "workshop") {
          registration = await loadWorkshopRegistration(transaction.registration_ref);
        } else if (transaction.registration_type === "hackathon") {
          registration = await loadHackathonRegistration(
            transaction.registration_ref,
            transaction.status === "verified"
          );
        }

        return {
          transaction_id: transaction.transaction_id || transaction.id,
          registration_type: transaction.registration_type || null,
          status: transaction.status || null,
          amount: transaction.amount || null,
          upi_transaction_id: transaction.upi_transaction_id || null,
          screenshot_url: transaction.screenshot_url || null,
          created_at: toIsoString(transaction.created_at),
          verified_at: toIsoString(transaction.verified_at),
          registration,
        };
      })
    );

    return NextResponse.json({ success: true, registrations });
  } catch (error) {
    console.error("Failed to load admin registrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch registrations." },
      { status: 500 }
    );
  }
}
