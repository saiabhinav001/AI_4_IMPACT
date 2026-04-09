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

function sanitizeParticipant(participant) {
  return {
    uid: clean(participant?.uid),
    name: clean(participant?.name),
    email: clean(participant?.email).toLowerCase(),
    phone: clean(participant?.phone),
    college: clean(participant?.college),
  };
}

export async function POST(request) {
  try {
    const { authUser, profile } = await verifyRequestWithProfile(request);
    if (!authUser || !profile) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (![ROLES.TEAM_LEAD, ROLES.PARTICIPANT].includes(profile.role)) {
      return NextResponse.json({ success: false, error: "Invalid user role for this action." }, { status: 403 });
    }

    const config = await getHackathonConfig();
    if (config.currentPhase !== PHASES.REGISTRATION) {
      return NextResponse.json(
        { success: false, error: "Hackathon team registration is currently closed." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const teamName = clean(body?.teamName);
    const paymentScreenshotUrl = clean(body?.paymentScreenshotUrl);
    const paymentReference = clean(body?.paymentReference);
    const members = Array.isArray(body?.members) ? body.members.map(sanitizeParticipant) : [];

    if (!teamName || !paymentScreenshotUrl || !paymentReference) {
      return NextResponse.json(
        { success: false, error: "teamName, paymentScreenshotUrl, paymentReference are required." },
        { status: 400 }
      );
    }
    if (members.length < 1) {
      return NextResponse.json(
        { success: false, error: "At least one team member is required." },
        { status: 400 }
      );
    }

    const teamRef = adminDb.collection("teams").doc();
    await teamRef.set({
      teamName,
      leadUid: authUser.uid,
      memberUids: members.map((m) => m.uid).filter(Boolean),
      members,
      payment: {
        screenshotUrl: paymentScreenshotUrl,
        reference: paymentReference,
        status: "PENDING",
      },
      psSelection: {
        selected: false,
        problemStatementId: "",
        selectedAt: null,
        selectedBy: "",
        locked: false,
      },
      submission: {
        submitted: false,
        githubUrl: "",
        pptUrl: "",
        submittedAt: null,
        submittedBy: "",
        locked: false,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("users").doc(authUser.uid).set(
      {
        role: ROLES.TEAM_LEAD,
        teamId: teamRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, teamId: teamRef.id });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to register hackathon team." },
      { status: 500 }
    );
  }
}
