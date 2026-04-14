import {
  EVENT_TIME_ZONE,
  EVENT_TIME_ZONE_LABEL,
  buildPublicEventState,
} from "./event-controls";
import { readEventControlsFromDb } from "./registration-gate";

function asTrimmedString(value) {
  return String(value || "").trim();
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

function asTeamFreezeState(teamData) {
  const freezeData =
    teamData?.freeze && typeof teamData.freeze === "object" ? teamData.freeze : {};

  return {
    locked: freezeData?.locked === true,
    lockedAt: freezeData?.locked_at || freezeData?.lockedAt || null,
    source: asTrimmedString(freezeData?.source || ""),
  };
}

async function findHackathonRegistrationByActorEmail(adminDb, actorEmail) {
  const email = asTrimmedString(actorEmail).toLowerCase();
  if (!email) {
    return null;
  }

  const participantSnapshot = await adminDb
    .collection("participants")
    .where("email", "==", email)
    .where("registration_type", "==", "hackathon")
    .limit(5)
    .get();

  if (participantSnapshot.empty) {
    return null;
  }

  for (const participantDoc of participantSnapshot.docs) {
    const participantData = participantDoc.data() || {};
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

    if (!memberIds.includes(participantDoc.id)) {
      continue;
    }

    return {
      teamId: teamDoc.id,
      teamData,
    };
  }

  return null;
}

async function resolveHackathonTeamFreezeState(adminDb, teamId, actorEmail) {
  const normalizedTeamId = asTrimmedString(teamId);

  if (normalizedTeamId) {
    const directTeamDoc = await adminDb
      .collection("hackathon_registrations")
      .doc(normalizedTeamId)
      .get();

    if (directTeamDoc.exists) {
      const directTeamData = directTeamDoc.data() || {};
      return {
        teamId: directTeamDoc.id,
        teamFreeze: asTeamFreezeState(directTeamData),
      };
    }
  }

  const actorTeam = await findHackathonRegistrationByActorEmail(adminDb, actorEmail);
  if (actorTeam) {
    return {
      teamId: actorTeam.teamId,
      teamFreeze: asTeamFreezeState(actorTeam.teamData),
    };
  }

  return {
    teamId: normalizedTeamId,
    teamFreeze: {
      locked: false,
      lockedAt: null,
      source: "",
    },
  };
}

export async function resolveTeamEditingGate(adminDb, { teamId = "", actorEmail = "" } = {}) {
  const controls = await readEventControlsFromDb(adminDb);
  const effectiveState = buildPublicEventState(controls);
  const freezeWindow = effectiveState?.freeze || {};
  const freezeStatus = asTrimmedString(freezeWindow?.status).toUpperCase() || "DISABLED";

  const { teamId: resolvedTeamId, teamFreeze } = await resolveHackathonTeamFreezeState(
    adminDb,
    teamId,
    actorEmail
  );

  if (teamFreeze.locked === true) {
    return {
      allowed: false,
      reason: "TEAM_FROZEN",
      message: "Team workspace is frozen. No further team edits are allowed.",
      teamId: resolvedTeamId,
      teamFreeze,
      freezeWindow,
      freezeStatus,
    };
  }

  if (freezeStatus === "CLOSED") {
    return {
      allowed: false,
      reason: "FREEZE_WINDOW_CLOSED",
      message: `Team edits are now closed. Freeze window ended at ${toIstDateLabel(
        freezeWindow?.closeAt
      )} (${EVENT_TIME_ZONE_LABEL}).`,
      teamId: resolvedTeamId,
      teamFreeze,
      freezeWindow,
      freezeStatus,
    };
  }

  return {
    allowed: true,
    reason: "ALLOWED",
    message: "",
    teamId: resolvedTeamId,
    teamFreeze,
    freezeWindow,
    freezeStatus,
  };
}
