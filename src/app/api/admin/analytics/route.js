import { NextResponse } from "next/server";
import { adminDb } from "../../../../../firebaseAdmin";
import { requireAdmin } from "../_utils/auth";

export const dynamic = "force-static";

export const runtime = "nodejs";

function readObjectMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function mergeObjectMaps(primary, secondary) {
  const merged = { ...secondary };

  Object.entries(primary).forEach(([key, value]) => {
    const numeric = Number(value || 0);
    const fallback = Number(merged[key] || 0);
    merged[key] = numeric + fallback;
  });

  return merged;
}

async function countPaymentsByStatus(status, registrationType = null) {
  let query = adminDb
    .collection("transactions")
    .where("status", "==", status);

  if (registrationType) {
    query = query.where("registration_type", "==", registrationType);
  }

  const snapshot = await query.count().get();

  return Number(snapshot.data().count || 0);
}

export async function GET(request) {
  const authResult = await requireAdmin(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const summaryRef = adminDb.collection("analytics").doc("summary");
    const summaryDoc = await summaryRef.get();

    if (!summaryDoc.exists) {
      return NextResponse.json(
        { error: "Analytics not initialized. Call /api/admin/init-db first." },
        { status: 404 }
      );
    }

    const summary = summaryDoc.data() || {};

    const [
      pending,
      verified,
      rejected,
      pendingHackathon,
      verifiedHackathon,
      rejectedHackathon,
      pendingWorkshop,
      verifiedWorkshop,
      rejectedWorkshop,
    ] = await Promise.all([
      countPaymentsByStatus("pending"),
      countPaymentsByStatus("verified"),
      countPaymentsByStatus("rejected"),
      countPaymentsByStatus("pending", "hackathon"),
      countPaymentsByStatus("verified", "hackathon"),
      countPaymentsByStatus("rejected", "hackathon"),
      countPaymentsByStatus("pending", "workshop"),
      countPaymentsByStatus("verified", "workshop"),
      countPaymentsByStatus("rejected", "workshop"),
    ]);

    const totalWorkshop = Number(summary.total_workshop || 0);
    const totalHackathon = Number(summary.total_hackathon || 0);
    const teamSize3 = Number(summary.team_size_3 || 0);
    const teamSize4 = Number(summary.team_size_4 || 0);
    const workshopParticipants = totalWorkshop;
    const hackathonParticipants = teamSize3 * 3 + teamSize4 * 4;

    const collegesByTypeHackathon = readObjectMap(summary.colleges_hackathon);
    const collegesByTypeWorkshop = readObjectMap(summary.colleges_workshop);
    const legacyColleges = readObjectMap(summary.colleges);

    const combinedColleges = Object.keys(legacyColleges).length > 0
      ? legacyColleges
      : mergeObjectMaps(collegesByTypeHackathon, collegesByTypeWorkshop);

    const totalParticipants = workshopParticipants + hackathonParticipants;

    return NextResponse.json({
      total_workshop: totalWorkshop,
      total_hackathon: totalHackathon,
      total_participants: totalParticipants,
      team_size_3: teamSize3,
      team_size_4: teamSize4,
      participants: {
        workshop: workshopParticipants,
        hackathon: hackathonParticipants,
        combined: totalParticipants,
      },
      colleges: combinedColleges,
      colleges_by_type: {
        workshop: collegesByTypeWorkshop,
        hackathon: collegesByTypeHackathon,
      },
      payments: {
        pending,
        verified,
        rejected,
        by_type: {
          workshop: {
            pending: pendingWorkshop,
            verified: verifiedWorkshop,
            rejected: rejectedWorkshop,
          },
          hackathon: {
            pending: pendingHackathon,
            verified: verifiedHackathon,
            rejected: rejectedHackathon,
          },
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics." },
      { status: 500 }
    );
  }
}
