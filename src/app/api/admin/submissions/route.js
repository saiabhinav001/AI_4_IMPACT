import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/admin";
import { verifyRequestWithProfile, isAdmin } from "../../../../../lib/server/auth";
import { ROLES } from "../../../../../lib/constants/roles";

export async function GET(request) {
  try {
    const { authUser, profile } = await verifyRequestWithProfile(request);
    if (!authUser || (!isAdmin(profile, authUser) && profile?.role !== ROLES.ADMIN)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const teamsSnap = await adminDb.collection("teams").get();
    const submissions = teamsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((team) => Boolean(team?.submission?.submitted))
      .map((team) => ({
        teamId: team.id,
        teamName: team.teamName || "",
        leadUid: team.leadUid || "",
        githubUrl: team.submission?.githubUrl || "",
        pptUrl: team.submission?.pptUrl || "",
        submittedAt: team.submission?.submittedAt || null,
      }));

    return NextResponse.json({ success: true, submissions });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to load final submissions." },
      { status: 500 }
    );
  }
}
