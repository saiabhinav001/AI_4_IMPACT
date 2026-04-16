import { NextResponse } from "next/server";
import { adminDb, FieldValue } from "../../../../../lib/admin";
import { ROLES } from "../../../../../lib/constants/roles";
import { verifyRequestWithProfile } from "../../../../../lib/server/auth";
import { getHackathonConfig, isSubmissionOpen } from "../../../../../lib/server/hackathon";
import { resolveTeamEditingGate } from "../../../../../lib/server/team-editing-gate";
import {
  attemptTeamSheetExportSync,
  buildTeamSubmissionSheetExportEvent,
  createTeamSheetExportEventRef,
} from "../../admin/_utils/team-sheet-export";

export const dynamic = "force-static";

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

    const editingGate = await resolveTeamEditingGate(adminDb, {
      teamId,
      actorEmail: authUser?.email || "",
    });

    if (!editingGate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: editingGate.message,
          freeze_window: editingGate.freezeWindow,
          team_freeze: editingGate.teamFreeze,
        },
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

    const members = Array.isArray(team?.members) ? team.members : [];
    const leadUid = clean(team?.leadUid);
    const leadMember =
      members.find((member) => clean(member?.uid) === leadUid) || members[0] || {};

    let teamSheetExportEventId = null;

    try {
      const sheetEventRef = createTeamSheetExportEventRef();
      teamSheetExportEventId = sheetEventRef.id;

      await sheetEventRef.set(
        buildTeamSubmissionSheetExportEvent({
          teamId,
          teamName: clean(team?.teamName || team?.team_name),
          teamLeadName: clean(leadMember?.name),
          teamLeadEmail: clean(leadMember?.email || authUser?.email || ""),
          teamLeadPhone: clean(leadMember?.phone),
          githubLink: githubUrl,
          pptDriveLink: pptUrl,
          source: "api/teams/submit",
        })
      );

      const sheetSyncResult = await attemptTeamSheetExportSync({
        eventId: sheetEventRef.id,
      });

      if (!sheetSyncResult?.success && !sheetSyncResult?.skipped) {
        console.error("Submission sheet sync failed:", sheetSyncResult.error);
      }
    } catch (sheetError) {
      console.error("Submission sheet export enqueue failed:", sheetError);
    }

    return NextResponse.json({
      success: true,
      team_sheet_export_event_id: teamSheetExportEventId,
    });
  } catch (error) {
    console.error("Final submission save failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit final project entry." },
      { status: 500 }
    );
  }
}
