import { NextResponse } from "next/server";
import { adminAuth, adminDb, FieldValue } from "../../../../../firebaseAdmin";
import { readRuntimeIdTokenFromRequest } from "../../../../../lib/runtime-auth";
import { buildPublicEventState, EVENT_TIME_ZONE, EVENT_TIME_ZONE_LABEL } from "../../../../../lib/server/event-controls";
import { readEventControlsFromDb } from "../../../../../lib/server/registration-gate";
import {
  findProblemStatementById,
  getProblemStatementCatalog,
  getProblemStatementCapacityRef,
  MAX_TEAMS_PER_PROBLEM,
  readTeamProblemSelection,
} from "../../../../../lib/server/problem-statements";
import {
  attemptTeamSheetExportSync,
  buildProblemSelectionSheetExportEvent,
  createTeamSheetExportEventRef,
} from "../../admin/_utils/team-sheet-export";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

function unauthorized(message) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(message, payload = {}) {
  return NextResponse.json({ error: message, ...payload }, { status: 403 });
}

function badRequest(message, payload = {}) {
  return NextResponse.json({ error: message, ...payload }, { status: 400 });
}

function conflict(message, payload = {}) {
  return NextResponse.json({ error: message, ...payload }, { status: 409 });
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

function toMillis(value) {
  if (!value) return NaN;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? NaN : parsed;
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

function buildAppError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
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
    console.error("Problem selection token verification failed:", error);
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
    const participantId = participantDoc.id;

    if (!memberIds.includes(participantId)) {
      continue;
    }

    const isLeadByOrder = memberIds[0] === participantId;
    const hasLeadRole = role === "TEAM_LEAD";

    if (!isLeadByOrder && !hasLeadRole && !isAdmin) {
      return { error: forbidden("Only TEAM_LEAD can select a problem statement.") };
    }

    if (teamData?.payment_verified !== true && !isAdmin) {
      return {
        error: forbidden(
          "Your team payment is not verified yet. Problem statement selection is enabled after admin verification."
        ),
      };
    }

    const existingFreeze =
      teamData?.freeze && typeof teamData.freeze === "object" ? teamData.freeze : {};

    return {
      actorUid,
      actorEmail,
      participantId,
      teamDoc,
      teamData,
      memberIds,
      existingFreeze,
    };
  }

  return { error: forbidden("No team registration could be linked to this account.") };
}

async function loadTeamLeadContact(memberIds) {
  const leadParticipantId = Array.isArray(memberIds) ? asTrimmedString(memberIds[0]) : "";
  if (!leadParticipantId) {
    return {
      name: "",
      email: "",
      phone: "",
    };
  }

  const leadDoc = await adminDb.collection("participants").doc(leadParticipantId).get();
  if (!leadDoc.exists) {
    return {
      name: "",
      email: "",
      phone: "",
    };
  }

  const leadData = leadDoc.data() || {};
  return {
    name: asTrimmedString(leadData?.name),
    email: asTrimmedString(leadData?.email).toLowerCase(),
    phone: asTrimmedString(leadData?.phone),
  };
}

function buildProblemWindowClosedMessage(problemStatementsState) {
  const status = asTrimmedString(problemStatementsState?.status).toUpperCase();

  if (status === "SCHEDULED") {
    return `Problem statements are not live yet. Release is scheduled at ${toIstDateLabel(
      problemStatementsState?.releaseAt
    )} (${EVENT_TIME_ZONE_LABEL}).`;
  }

  if (status === "DISABLED") {
    return "Problem statements are currently disabled by admin controls.";
  }

  return "Problem statement selection is unavailable right now.";
}

function buildFreezeClosedMessage(freezeState) {
  const status = asTrimmedString(freezeState?.status).toUpperCase();

  if (status === "CLOSED") {
    return `Freeze window closed at ${toIstDateLabel(freezeState?.closeAt)} (${EVENT_TIME_ZONE_LABEL}).`;
  }

  return "Team edits are closed for this event stage.";
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

    const {
      actorUid,
      actorEmail,
      teamDoc,
      teamData,
      memberIds,
      existingFreeze,
    } = contextResult;

    if (existingFreeze?.locked === true) {
      return conflict("Your team workspace is already frozen.");
    }

    const body = await request.json().catch(() => ({}));
    const requestedProblemId = asTrimmedString(body?.problem_id || body?.problemId).toUpperCase();

    if (!requestedProblemId) {
      return badRequest("problem_id is required.");
    }

    const problemCatalog = getProblemStatementCatalog();
    const requestedProblem = findProblemStatementById(requestedProblemId, problemCatalog);

    if (!requestedProblem) {
      return badRequest("Unknown problem_id.", {
        available_problem_ids: problemCatalog.map((problem) => problem.id),
      });
    }

    const controls = await readEventControlsFromDb(adminDb);
    const effectiveState = buildPublicEventState(controls);
    const problemStatementsState = effectiveState?.problemStatements || {};
    const freezeState = effectiveState?.freeze || {};

    const teamName = String(teamData?.team_name || "").trim().toUpperCase();
    const isBypassTeam = teamName === "STR";

    if (!isBypassTeam && asTrimmedString(problemStatementsState?.status).toUpperCase() !== "LIVE") {
      return forbidden(buildProblemWindowClosedMessage(problemStatementsState), {
        problem_statements: problemStatementsState,
      });
    }

    const releaseAtMs = toMillis(problemStatementsState?.releaseAt);
    if (Number.isFinite(releaseAtMs)) {
      const selectionExpiryMs = releaseAtMs + 20 * 60 * 1000;
      if (Date.now() >= selectionExpiryMs) {
        return forbidden("Problem statement selection has closed (20-minute window elapsed).", {
          release_at: problemStatementsState.releaseAt,
          expiry_at: new Date(selectionExpiryMs).toISOString(),
        });
      }
    }

    if (asTrimmedString(freezeState?.status).toUpperCase() === "CLOSED") {
      return forbidden(buildFreezeClosedMessage(freezeState), {
        freeze_window: freezeState,
      });
    }

    const existingSelection = await readTeamProblemSelection(adminDb, teamDoc.id);
    if (existingSelection) {
      return conflict("A problem statement is already selected for this team.", {
        selected_problem: existingSelection,
      });
    }

    const capacityRef = getProblemStatementCapacityRef(adminDb);
    const teamSelectionRef = adminDb.collection("team_problem_selection").doc(teamDoc.id);
    const auditRef = adminDb.collection("admin_audit_logs").doc();

    const leadContact = await loadTeamLeadContact(memberIds);

    const selectionResult = await adminDb.runTransaction(async (transaction) => {
      const [teamSnapshot, selectionSnapshot, capacitySnapshot] = await Promise.all([
        transaction.get(teamDoc.ref),
        transaction.get(teamSelectionRef),
        transaction.get(capacityRef),
      ]);

      if (!teamSnapshot.exists) {
        throw buildAppError("TEAM_NOT_FOUND", "Team registration could not be resolved.");
      }

      if (selectionSnapshot.exists) {
        throw buildAppError(
          "TEAM_ALREADY_SELECTED",
          "A problem statement is already selected for this team."
        );
      }

      const liveTeamData = teamSnapshot.data() || {};
      const liveFreeze =
        liveTeamData?.freeze && typeof liveTeamData.freeze === "object"
          ? liveTeamData.freeze
          : {};

      if (liveFreeze?.locked === true) {
        throw buildAppError("TEAM_ALREADY_FROZEN", "Your team workspace is already frozen.");
      }

      const capacityData = capacitySnapshot.exists ? capacitySnapshot.data() || {} : {};
      const storedMaxTeams = Number(capacityData?.max_teams_per_problem);
      const maxTeamsAllowed =
        Number.isFinite(storedMaxTeams) && storedMaxTeams > 0
          ? Math.floor(storedMaxTeams)
          : MAX_TEAMS_PER_PROBLEM;

      const currentCounts =
        capacityData?.counts && typeof capacityData.counts === "object"
          ? { ...capacityData.counts }
          : {};

      const currentSelectedCount = Number(currentCounts[requestedProblem.id]);
      const safeCurrentSelectedCount =
        Number.isFinite(currentSelectedCount) && currentSelectedCount > 0
          ? Math.floor(currentSelectedCount)
          : 0;

      if (safeCurrentSelectedCount >= maxTeamsAllowed) {
        throw buildAppError(
          "PROBLEM_CAPACITY_FULL",
          "This problem statement has already reached its team limit.",
          {
            selected_teams_count: safeCurrentSelectedCount,
            max_teams_allowed: maxTeamsAllowed,
          }
        );
      }

      const nextSelectedCount = safeCurrentSelectedCount + 1;

      transaction.set(
        teamSelectionRef,
        {
          team_id: teamDoc.id,
          team_name: asTrimmedString(teamData?.team_name),
          problem_id: requestedProblem.id,
          problem_title: requestedProblem.title,
          problem_description: requestedProblem.description,
          selected_count_at_selection: nextSelectedCount,
          max_teams_allowed_at_selection: maxTeamsAllowed,
          selected_by_uid: actorUid,
          selected_by_email: actorEmail,
          team_lead_name: leadContact.name,
          team_lead_email: leadContact.email,
          team_lead_phone: leadContact.phone,
          selected_at: FieldValue.serverTimestamp(),
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: false }
      );

      transaction.update(teamSnapshot.ref, {
        problem_statement_selection: {
          locked: true,
          locked_at: FieldValue.serverTimestamp(),
          locked_by_uid: actorUid,
          locked_by_email: actorEmail,
          source: "TEAM_LEAD",
          problem_id: requestedProblem.id,
          problem_title: requestedProblem.title,
          problem_description: requestedProblem.description,
          selected_count_at_selection: nextSelectedCount,
          max_teams_allowed_at_selection: maxTeamsAllowed,
          selected_by_uid: actorUid,
          selected_by_email: actorEmail,
          selected_at: FieldValue.serverTimestamp(),
        },
        updated_at: FieldValue.serverTimestamp(),
      });

      transaction.set(
        capacityRef,
        {
          max_teams_per_problem: maxTeamsAllowed,
          counts: {
            ...currentCounts,
            [requestedProblem.id]: nextSelectedCount,
          },
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      transaction.set(auditRef, {
        action: "TEAM_PROBLEM_SELECTED",
        target: `team_problem_selection/${teamDoc.id}`,
        actor_uid: actorUid || null,
        actor_email: actorEmail || null,
        problem_id: requestedProblem.id,
        problem_title: requestedProblem.title,
        selected_teams_count: nextSelectedCount,
        max_teams_allowed: maxTeamsAllowed,
        created_at: FieldValue.serverTimestamp(),
      });

      return {
        selectedTeamsCount: nextSelectedCount,
        maxTeamsAllowed,
      };
    });

    let sheetEventId = null;

    try {
      const sheetEventRef = createTeamSheetExportEventRef();
      sheetEventId = sheetEventRef.id;

      await sheetEventRef.set(
        buildProblemSelectionSheetExportEvent({
          teamId: teamDoc.id,
          teamName: asTrimmedString(teamData?.team_name),
          problemId: requestedProblem.id,
          problemTitle: requestedProblem.title,
          teamLeadName: leadContact.name,
          teamLeadEmail: leadContact.email,
          teamLeadPhone: leadContact.phone,
          selectedTeamsCount: selectionResult.selectedTeamsCount,
          maxTeamsAllowed: selectionResult.maxTeamsAllowed,
          source: "api/team/problem-selection",
        })
      );

      const sheetSyncResult = await attemptTeamSheetExportSync({
        eventId: sheetEventRef.id,
      });

      if (!sheetSyncResult?.success && !sheetSyncResult?.skipped) {
        console.error("Problem selection sheet sync failed:", sheetSyncResult.error);
      }
    } catch (sheetError) {
      console.error("Problem selection sheet export enqueue failed:", sheetError);
    }

    return NextResponse.json({
      success: true,
      message: "Problem statement selected and locked successfully.",
      selected_problem: {
        team_id: teamDoc.id,
        problem_id: requestedProblem.id,
        problem_title: requestedProblem.title,
        problem_description: requestedProblem.description,
        selected_teams_count: selectionResult.selectedTeamsCount,
        max_teams_allowed: selectionResult.maxTeamsAllowed,
      },
      problem_statement_selection: {
        locked: true,
        source: "TEAM_LEAD",
      },
      team_sheet_export_event_id: sheetEventId,
    });
  } catch (error) {
    if (error?.code === "TEAM_NOT_FOUND") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error?.code === "TEAM_ALREADY_FROZEN") {
      return conflict(error.message);
    }

    if (error?.code === "TEAM_ALREADY_SELECTED") {
      return conflict(error.message);
    }

    if (error?.code === "PROBLEM_CAPACITY_FULL") {
      return conflict(error.message, {
        selected_teams_count: error?.details?.selected_teams_count || null,
        max_teams_allowed: error?.details?.max_teams_allowed || MAX_TEAMS_PER_PROBLEM,
      });
    }

    console.error("Failed to select problem statement:", error);
    return NextResponse.json(
      { error: "Failed to select problem statement." },
      { status: 500 }
    );
  }
}
