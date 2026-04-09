import { NextResponse } from "next/server";
import { adminDb } from "../../../../../firebaseAdmin";
import { requireAdmin } from "../_utils/auth";

export const runtime = "nodejs";

async function countPaymentsByStatus(status) {
  const snapshot = await adminDb
    .collection("transactions")
    .where("status", "==", status)
    .count()
    .get();

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

    const [pending, verified, rejected] = await Promise.all([
      countPaymentsByStatus("pending"),
      countPaymentsByStatus("verified"),
      countPaymentsByStatus("rejected"),
    ]);

    const totalWorkshop = Number(summary.total_workshop || 0);
    const totalHackathon = Number(summary.total_hackathon || 0);
    const teamSize3 = Number(summary.team_size_3 || 0);
    const teamSize4 = Number(summary.team_size_4 || 0);

    const totalParticipants = totalWorkshop + teamSize3 * 3 + teamSize4 * 4;

    return NextResponse.json({
      total_workshop: totalWorkshop,
      total_hackathon: totalHackathon,
      total_participants: totalParticipants,
      team_size_3: teamSize3,
      team_size_4: teamSize4,
      colleges: summary.colleges && typeof summary.colleges === "object" ? summary.colleges : {},
      payments: {
        pending,
        verified,
        rejected,
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
