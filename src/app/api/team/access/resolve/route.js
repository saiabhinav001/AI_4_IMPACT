import { NextResponse } from "next/server";
import { adminDb } from "../../../../../../firebaseAdmin";

export const runtime = "nodejs";

function badRequest(error) {
  return NextResponse.json({ error }, { status: 400 });
}

function asTrimmedString(value) {
  return String(value || "").trim();
}

function asNormalizedTeamId(value) {
  return asTrimmedString(value).toLowerCase();
}

function isValidTeamId(value) {
  return /^ai4i\d{3,}$/i.test(value || "");
}

async function findRegistrationByTeamAccessId(teamId) {
  const topLevelSnapshot = await adminDb
    .collection("hackathon_registrations")
    .where("team_access_id", "==", teamId)
    .limit(1)
    .get();

  if (!topLevelSnapshot.empty) {
    return topLevelSnapshot.docs[0];
  }

  const nestedSnapshot = await adminDb
    .collection("hackathon_registrations")
    .where("access_credentials.team_id", "==", teamId)
    .limit(1)
    .get();

  if (!nestedSnapshot.empty) {
    return nestedSnapshot.docs[0];
  }

  return null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const teamId = asNormalizedTeamId(body?.team_id);

    if (!teamId) {
      return badRequest("team_id is required.");
    }

    if (!isValidTeamId(teamId)) {
      return badRequest("Invalid team ID format.");
    }

    const registrationDoc = await findRegistrationByTeamAccessId(teamId);
    if (!registrationDoc?.exists) {
      return NextResponse.json(
        { error: "Invalid team ID or access is not enabled yet." },
        { status: 404 }
      );
    }

    const registrationData = registrationDoc.data();
    if (registrationData?.payment_verified !== true) {
      return NextResponse.json(
        { error: "Invalid team ID or access is not enabled yet." },
        { status: 403 }
      );
    }

    let leaderEmail = asTrimmedString(registrationData?.access_credentials?.leader_email).toLowerCase();

    if (!leaderEmail) {
      const memberIds = Array.isArray(registrationData?.member_ids)
        ? registrationData.member_ids
        : [];
      const leaderParticipantId = memberIds[0];

      if (leaderParticipantId) {
        const participantDoc = await adminDb.collection("participants").doc(leaderParticipantId).get();
        if (participantDoc.exists) {
          leaderEmail = asTrimmedString(participantDoc.data()?.email).toLowerCase();
        }
      }
    }

    if (!leaderEmail) {
      return NextResponse.json(
        { error: "Unable to resolve login account for this team ID." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      team_id: teamId,
      leader_email: leaderEmail,
    });
  } catch (error) {
    console.error("Failed to resolve team access ID:", error);
    return NextResponse.json(
      { error: "Failed to resolve team login identifier." },
      { status: 500 }
    );
  }
}
