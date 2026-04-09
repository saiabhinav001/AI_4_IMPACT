import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../../firebaseAdmin";
import { requireAdmin } from "../_utils/auth";

export const runtime = "nodejs";

export async function POST(request) {
  const authResult = await requireAdmin(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const summaryRef = adminDb.collection("analytics").doc("summary");
    const summaryDoc = await summaryRef.get();

    if (summaryDoc.exists) {
      return NextResponse.json({
        success: true,
        message: "Already initialized",
      });
    }

    await summaryRef.set({
      total_workshop: 0,
      total_hackathon: 0,
      team_size_3: 0,
      team_size_4: 0,
      colleges: {},
      updated_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: "Database initialized",
    });
  } catch (error) {
    console.error("Init DB failed:", error);
    return NextResponse.json(
      { error: "Failed to initialize database." },
      { status: 500 }
    );
  }
}
