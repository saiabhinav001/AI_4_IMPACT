import { NextResponse } from "next/server";
import { adminAuth, adminDb, FieldValue } from "../../../../../firebaseAdmin";
import { readRuntimeIdTokenFromRequest } from "../../../../../lib/runtime-auth";
import {
  EVENT_TIME_ZONE,
  EVENT_TIME_ZONE_LABEL,
  buildPublicEventState,
} from "../../../../../lib/server/event-controls";
import { readEventControlsFromDb } from "../../../../../lib/server/registration-gate";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

function unauthorized(message) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(message) {
  return NextResponse.json({ error: message }, { status: 403 });
}

function conflict(message) {
  return NextResponse.json({ error: message }, { status: 409 });
}

function asTrimmedString(value) {
  return String(value || "").trim();
}

function normalizeRole(role) {
  const normalized = asTrimmedString(role)
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "TEAMLEAD" || normalized === "TEAM_LEADER" || normalized === "LEAD") {
    return "TEAM_LEAD";
  }

  return normalized;
}

function toIstDateLabel(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) {
    return "configured schedule";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: EVENT_TIME_ZONE,
    timeZoneName: "short",
  });
}

async function verifyRequestUser(request) {
  const idToken = readRuntimeIdTokenFromRequest(request);
  if (!idToken) {
    return { error: unauthorized("Missing Firebase ID token.") };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return { decodedToken };
  } catch (error) {
    console.error("Team freeze token verification failed:", error);
    return { error: unauthorized("Invalid or expired Firebase ID token.") };
  }
}

async function resolveTeamContext(decodedToken) {
  const actorUid = asTrimmedString(decodedToken?.uid);
  const actorEmail = asTrimmedString(decodedToken?.email).toLowerCase();
  const role = normalizeRole(decodedToken?.role);
  const isAdmin = decodedToken?.admin === true;

  if (!actorEmail) {
    return { error: forbidden("No email found in the authenticated token.") };
  }

  const participantSnapshot = await adminDb
    .collection("participants")
    .where("email", "==", actorEmail)
    .where("registration_type", "==", "hackathon")
    .limit(5)
    .get();

  if (participantSnapshot.empty) {
    return { error: forbidden("No hackathon registration found for this account.") };
  }

  for (const participantDoc of participantSnapshot.docs) {
    const participantData = participantDoc.data();
    const teamId = asTrimmedString(participantData?.registration_ref);
    if (!teamId) {
      continue;
    }

    const teamDoc = await adminDb.collection("hackathon_registrations").doc(teamId).get();
    if (!teamDoc.exists) {
      continue;
    }

    const teamData = teamDoc.data() || {};
    const memberIds = Array.isArray(teamData?.member_ids) ? teamData.member_ids : [];
    const participantId = participantDoc.id;
    const isMember = memberIds.includes(participantId);

    if (!isMember) {
      continue;
    }

    const isLeadByOrder = memberIds[0] === participantId;
    const hasLeadRole = role === "TEAM_LEAD";

    if (!isLeadByOrder && !hasLeadRole && !isAdmin) {
      return { error: forbidden("Only the team lead can freeze this team.") };
    }

    if (teamData?.payment_verified !== true && !isAdmin) {
      return {
        error: forbidden(
          "Your team payment is not verified yet. Freeze action is enabled after admin verification."
        ),
      };
    }

    return {
      teamDoc,
      teamData,
      actorUid,
      actorEmail,
      isAdmin,
    };
  }

  return { error: forbidden("No team registration could be linked to this account.") };
}

function buildFreezeClosedMessage(freezeState) {
  const status = asTrimmedString(freezeState?.status).toUpperCase();

  if (status === "SCHEDULED") {
    return `Freeze window has not started yet. It opens at ${toIstDateLabel(
      freezeState?.openAt
    )} (${EVENT_TIME_ZONE_LABEL}).`;
  }

  if (status === "CLOSED") {
    return "Freeze window is closed. Contact admin if reopening is required.";
  }

  if (status === "DISABLED") {
    return "Freeze window is currently disabled by admin controls.";
  }

  return "Freeze action is unavailable right now. Please try again later.";
}

export async function POST(request) {
  const authResult = await verifyRequestUser(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const contextResult = await resolveTeamContext(authResult.decodedToken);
    if (contextResult.error) {
      return contextResult.error;
    }

    const { teamDoc, teamData, actorUid, actorEmail, isAdmin } = contextResult;

    const existingFreeze =
      teamData?.freeze && typeof teamData.freeze === "object" ? teamData.freeze : {};

    if (existingFreeze?.locked === true) {
      return conflict("Your team is already frozen.");
    }

    const controls = await readEventControlsFromDb(adminDb);
    const effectiveState = buildPublicEventState(controls);
    const freezeState = effectiveState?.freeze || {};
    const freezeStatus = asTrimmedString(freezeState?.status).toUpperCase();

    const allowAdminOverride =
      isAdmin && controls?.freeze?.adminOverrideEnabled === true && freezeStatus !== "OPEN";

    if (freezeStatus !== "OPEN" && !allowAdminOverride) {
      return NextResponse.json(
        {
          error: buildFreezeClosedMessage(freezeState),
          freeze_window: freezeState,
        },
        { status: 403 }
      );
    }

    const freezeSource = allowAdminOverride ? "ADMIN_OVERRIDE" : "TEAM_LEAD";

    await teamDoc.ref.update({
      freeze: {
        locked: true,
        locked_at: FieldValue.serverTimestamp(),
        locked_by_uid: actorUid,
        locked_by_email: actorEmail,
        source: freezeSource,
      },
      updated_at: FieldValue.serverTimestamp(),
    });

    try {
      await adminDb.collection("admin_audit_logs").add({
        action: "TEAM_FREEZE_LOCKED",
        target: `hackathon_registrations/${teamDoc.id}`,
        actor_uid: actorUid || null,
        actor_email: actorEmail || null,
        freeze_window_status: freezeStatus || "UNKNOWN",
        source: freezeSource,
        created_at: FieldValue.serverTimestamp(),
      });
    } catch (auditError) {
      console.error("Failed to write team freeze audit log:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: "Team workspace has been frozen successfully.",
      freeze: {
        locked: true,
        source: freezeSource,
      },
    });
  } catch (error) {
    console.error("Failed to freeze team workspace:", error);
    return NextResponse.json(
      { error: "Failed to freeze the team workspace." },
      { status: 500 }
    );
  }
}
