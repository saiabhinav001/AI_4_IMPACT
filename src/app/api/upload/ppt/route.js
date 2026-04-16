import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { adminStorage, adminDb } from "../../../../../lib/admin";
import { ROLES } from "../../../../../lib/constants/roles";
import { verifyRequestWithProfile } from "../../../../../lib/server/auth";
import { resolveTeamEditingGate } from "../../../../../lib/server/team-editing-gate";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

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
        { success: false, error: "Only TEAM_LEAD can upload submission files." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const requestedTeamId = clean(formData.get("teamId"));
    const profileTeamId = clean(profile?.teamId);
    const teamId = profileTeamId || requestedTeamId;

    if (!file || !teamId) {
      return NextResponse.json(
        { success: false, error: "file and teamId are required." },
        { status: 400 }
      );
    }

    if (profileTeamId && requestedTeamId && requestedTeamId !== profileTeamId) {
      return NextResponse.json(
        { success: false, error: "Requested teamId does not match your team profile." },
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

    const validTypes = [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/pdf",
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Only PPT, PPTX or PDF is allowed." },
        { status: 400 }
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: "File too large. Max 20MB." },
        { status: 400 }
      );
    }

    const ext = file.type.includes("presentationml") ? "pptx" : file.type.includes("powerpoint") ? "ppt" : "pdf";
    const objectPath = `submissions/${teamId}/${Date.now()}-${randomUUID()}.${ext}`;
    const blob = adminStorage.file(objectPath);
    const buffer = Buffer.from(await file.arrayBuffer());
    await blob.save(buffer, {
      resumable: false,
      metadata: { contentType: file.type },
    });

    const [signedUrl] = await blob.getSignedUrl({
      action: "read",
      expires: "2100-01-01",
    });

    return NextResponse.json({ success: true, url: signedUrl, path: objectPath });
  } catch {
    return NextResponse.json(
      { success: false, error: "PPT upload failed." },
      { status: 500 }
    );
  }
}
