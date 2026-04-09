import { NextResponse } from "next/server";
import { adminDb } from "../../../../../firebaseAdmin";
import { requireAdmin } from "../_utils/auth";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["workshop", "hackathon"]);
const ALLOWED_STATUSES = new Set(["pending", "verified", "rejected"]);

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

async function loadHackathonRegistration(registrationRef) {
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
          registration = await loadHackathonRegistration(transaction.registration_ref);
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
