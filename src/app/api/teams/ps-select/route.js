import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../../lib/admin";
import { PHASES } from "../../../../../lib/constants/phases";
import { ROLES } from "../../../../../lib/constants/roles";
import { verifyRequestWithProfile } from "../../../../../lib/server/auth";
import { getHackathonConfig } from "../../../../../lib/server/hackathon";

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
        { success: false, error: "Only TEAM_LEAD can select problem statements." },
        { status: 403 }
      );
    }

    const config = await getHackathonConfig();
    if (config.currentPhase !== PHASES.PS_SELECTION) {
      return NextResponse.json(
        { success: false, error: "Problem statement selection is not active." },
        { status: 400 }
      );
    }
    if (config.psSelectionLocked) {
      return NextResponse.json(
        { success: false, error: "Problem statement selection is currently locked." },
        { status: 400 }
      );
    }

    const teamId = clean(profile.teamId);
    const body = await request.json();
    const problemStatementId = clean(body?.problemStatementId);

    if (!teamId || !problemStatementId) {
      return NextResponse.json(
        { success: false, error: "teamId and problemStatementId are required." },
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
    if (team?.psSelection?.selected || team?.psSelection?.locked) {
      return NextResponse.json(
        { success: false, error: "Problem statement already selected and locked." },
        { status: 400 }
      );
    }

    await teamRef.update({
      "psSelection.selected": true,
      "psSelection.problemStatementId": problemStatementId,
      "psSelection.selectedAt": FieldValue.serverTimestamp(),
      "psSelection.selectedBy": authUser.uid,
      "psSelection.locked": true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to save problem statement selection." },
      { status: 500 }
    );
  }
}
