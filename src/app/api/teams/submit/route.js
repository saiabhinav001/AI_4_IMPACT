import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../../lib/admin";
import { ROLES } from "../../../../../lib/constants/roles";
import { verifyRequestWithProfile } from "../../../../../lib/server/auth";
import { getHackathonConfig, isSubmissionOpen } from "../../../../../lib/server/hackathon";

function clean(value) {
  return String(value || "").trim();
}

export async function POST(request) {
  try {
    const { authUser, profile } = await verifyRequestWithProfile(request);
    if (!authUser || !profile) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (profile.role !== ROLES.TEAM_LEAD) {
      return NextResponse.json(
        { success: false, error: "Only TEAM_LEAD can submit final entries." },
        { status: 403 }
      );
    }

    const config = await getHackathonConfig();
    if (!isSubmissionOpen(config)) {
      return NextResponse.json(
        { success: false, error: "Submission window is closed." },
        { status: 400 }
      );
    }

    const teamId = clean(profile.teamId);
    const body = await request.json();
    const githubUrl = clean(body?.githubUrl);
    const pptUrl = clean(body?.pptUrl);

    if (!teamId || !githubUrl || !pptUrl) {
      return NextResponse.json(
        { success: false, error: "teamId, githubUrl, and pptUrl are required." },
        { status: 400 }
      );
    }

    const teamRef = adminDb.collection("teams").doc(teamId);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) {
      return NextResponse.json({ success: false, error: "Team not found." }, { status: 404 });
    }
    const team = teamSnap.data();
    if (team?.leadUid !== authUser.uid) {
      return NextResponse.json(
        { success: false, error: "Only the team lead can perform this action." },
        { status: 403 }
      );
    }
    if (team?.submission?.locked) {
      return NextResponse.json(
        { success: false, error: "Submission is locked for this team." },
        { status: 400 }
      );
    }

    await teamRef.update({
      "submission.submitted": true,
      "submission.githubUrl": githubUrl,
      "submission.pptUrl": pptUrl,
      "submission.submittedAt": FieldValue.serverTimestamp(),
      "submission.submittedBy": authUser.uid,
      "submission.locked": true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to submit final project entry." },
      { status: 500 }
    );
  }
}
