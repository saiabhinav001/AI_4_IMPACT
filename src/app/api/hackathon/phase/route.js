import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/admin";
import { FieldValue } from "firebase-admin/firestore";
import { PHASE_LIST } from "../../../../../lib/constants/phases";
import { ROLES } from "../../../../../lib/constants/roles";
import { verifyRequestWithProfile, isAdmin } from "../../../../../lib/server/auth";
import { getHackathonConfig, getHackathonConfigRef } from "../../../../../lib/server/hackathon";

export async function GET() {
  try {
    const config = await getHackathonConfig();
    return NextResponse.json({ success: true, config });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to load hackathon phase config." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const { authUser, profile } = await verifyRequestWithProfile(request);
    if (!authUser || (!isAdmin(profile, authUser) && profile?.role !== ROLES.ADMIN)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const nextPhase = body?.currentPhase;
    const psSelectionLocked = body?.psSelectionLocked;
    const submissionLocked = body?.submissionLocked;
    const submissionDeadline = body?.submissionDeadline;
    const timelineEvents = body?.timelineEvents;

    const updates = {};

    if (typeof nextPhase !== "undefined") {
      if (!PHASE_LIST.includes(nextPhase)) {
        return NextResponse.json({ success: false, error: "Invalid phase value." }, { status: 400 });
      }
      updates.currentPhase = nextPhase;
    }

    if (typeof psSelectionLocked !== "undefined") {
      updates.psSelectionLocked = Boolean(psSelectionLocked);
    }
    if (typeof submissionLocked !== "undefined") {
      updates.submissionLocked = Boolean(submissionLocked);
    }
    if (typeof submissionDeadline !== "undefined") {
      updates.submissionDeadline = submissionDeadline || null;
    }
    if (typeof timelineEvents !== "undefined") {
      if (!Array.isArray(timelineEvents)) {
        return NextResponse.json({ success: false, error: "timelineEvents must be an array." }, { status: 400 });
      }
      updates.timelineEvents = timelineEvents;
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ success: false, error: "No updates provided." }, { status: 400 });
    }

    updates.updatedAt = FieldValue.serverTimestamp();

    await getHackathonConfigRef().set(updates, { merge: true });
    const config = await getHackathonConfig();
    return NextResponse.json({ success: true, config });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to update hackathon phase config." },
      { status: 500 }
    );
  }
}
