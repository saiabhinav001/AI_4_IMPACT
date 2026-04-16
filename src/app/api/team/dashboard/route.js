import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../../firebaseAdmin";
import { readRuntimeIdTokenFromRequest } from "../../../../../lib/runtime-auth";
import {
  EVENT_TIME_ZONE,
  EVENT_TIME_ZONE_LABEL,
  buildPublicEventState,
} from "../../../../../lib/server/event-controls";
import { readEventControlsFromDb } from "../../../../../lib/server/registration-gate";
import {
  getProblemStatementCatalog,
  mapProblemStatementsWithCapacity,
  MAX_TEAMS_PER_PROBLEM,
  readProblemStatementCapacitySnapshot,
  readTeamProblemSelection,
} from "../../../../../lib/server/problem-statements";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

function unauthorized(message) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(message) {
  return NextResponse.json({ error: message }, { status: 403 });
}

function toIsoString(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toIstDateLabel(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "N/A";

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

function normalizeRole(role) {
  const normalized = String(role || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "TEAMLEAD" || normalized === "TEAM_LEADER" || normalized === "LEAD") {
    return "TEAM_LEAD";
  }

  return normalized;
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
    console.error("Team dashboard token verification failed:", error);
    return { error: unauthorized("Invalid or expired Firebase ID token.") };
  }
}

async function loadMembers(memberIds) {
  const memberDocs = await Promise.all(
    memberIds.map((participantId) => adminDb.collection("participants").doc(participantId).get())
  );

  return memberDocs
    .filter((doc) => doc.exists)
    .map((doc) => {
      const data = doc.data();
      return {
        participant_id: doc.id,
        name: data?.name || "",
        email: data?.email || "",
        phone: data?.phone || "",
      };
    });
}

async function loadTeamSelection(teamId, problemCatalog) {
  const selectedProblem = await readTeamProblemSelection(adminDb, teamId);
  if (!selectedProblem) {
    return null;
  }

  const matchedProblem = (problemCatalog || []).find(
    (problem) => problem.id === selectedProblem.problem_id
  );

  return {
    ...selectedProblem,
    problem_title: selectedProblem.problem_title || matchedProblem?.title || null,
    problem_description:
      selectedProblem.problem_description || matchedProblem?.description || "",
  };
}

function buildUpdates(payment, selectedProblem, problemStatementsCount, effectiveState, teamFrozen) {
  const updates = [];

  if (payment?.status === "verified") {
    updates.push("Payment has been verified by admin.");
  } else if (payment?.status === "rejected") {
    updates.push("Payment was rejected. Contact support for correction.");
  } else {
    updates.push("Payment is pending verification.");
  }

  const problemStatus = String(effectiveState?.problemStatements?.status || "DISABLED").toUpperCase();
  const problemReleaseAt = effectiveState?.problemStatements?.releaseAt;

  if (problemStatus === "SCHEDULED") {
    updates.push(
      `Problem statements will be released at ${toIstDateLabel(problemReleaseAt)} (${EVENT_TIME_ZONE_LABEL}).`
    );
  } else if (problemStatus === "DISABLED") {
    updates.push("Problem statements are currently disabled by admin controls.");
  } else if (selectedProblem?.problem_id || selectedProblem?.problem_title) {
    updates.push("Problem statement selected by your team.");
  } else if (problemStatementsCount > 0) {
    updates.push("Problem statements are available. Please complete your selection.");
  } else {
    updates.push("Problem statements are not published yet.");
  }

  const freezeStatus = String(effectiveState?.freeze?.status || "DISABLED").toUpperCase();
  const freezeOpenAt = effectiveState?.freeze?.openAt;
  const freezeCloseAt = effectiveState?.freeze?.closeAt;

  if (teamFrozen) {
    updates.push("Your team workspace is frozen and no further team edits are allowed.");
  } else if (freezeStatus === "OPEN") {
    updates.push("Freeze window is open. Team lead can lock the workspace now.");
  } else if (freezeStatus === "SCHEDULED") {
    updates.push(
      `Freeze window starts at ${toIstDateLabel(freezeOpenAt)} (${EVENT_TIME_ZONE_LABEL}).`
    );
  } else if (freezeStatus === "CLOSED") {
    updates.push(
      `Freeze window closed at ${toIstDateLabel(freezeCloseAt)} (${EVENT_TIME_ZONE_LABEL}).`
    );
  }

  return updates;
}

export async function GET(request) {
  const authResult = await verifyRequestUser(request);
  if (authResult.error) {
    return authResult.error;
  }

  const decodedToken = authResult.decodedToken;
  const email = String(decodedToken?.email || "").trim().toLowerCase();
  const role = normalizeRole(decodedToken?.role);

  if (!email) {
    return forbidden("No email found in the authenticated token.");
  }

  try {
    const participantSnapshot = await adminDb
      .collection("participants")
      .where("email", "==", email)
      .where("registration_type", "==", "hackathon")
      .limit(5)
      .get();

    if (participantSnapshot.empty) {
      return NextResponse.json(
        { error: "No hackathon registration found for this account." },
        { status: 404 }
      );
    }

    for (const participantDoc of participantSnapshot.docs) {
      const participantData = participantDoc.data();
      const teamId = participantData?.registration_ref;
      if (!teamId) {
        continue;
      }

      const teamDoc = await adminDb.collection("hackathon_registrations").doc(teamId).get();
      if (!teamDoc.exists) {
        continue;
      }

      const teamData = teamDoc.data();
      const memberIds = Array.isArray(teamData?.member_ids) ? teamData.member_ids : [];
      const participantId = participantDoc.id;
      const isMember = memberIds.includes(participantId);

      if (!isMember) {
        continue;
      }

      const isLeadByOrder = memberIds[0] === participantId;
      const hasLeadRole = role === "TEAM_LEAD";
      const isAdmin = decodedToken?.admin === true;

      if (!isLeadByOrder && !hasLeadRole && !isAdmin) {
        return forbidden("This account is not authorized as the team lead.");
      }

      if (teamData?.payment_verified !== true && !isAdmin) {
        return forbidden("Your team payment is not verified yet. Access will be enabled after admin verification.");
      }

      const members = await loadMembers(memberIds);

      let payment = null;
      if (teamData?.transaction_id) {
        const txDoc = await adminDb
          .collection("transactions")
          .doc(teamData.transaction_id)
          .get();

        if (txDoc.exists) {
          const txData = txDoc.data();
          payment = {
            transaction_id: txDoc.id,
            upi_transaction_id: txData?.upi_transaction_id || null,
            screenshot_url: txData?.screenshot_url || null,
            amount: txData?.amount || 800,
            status: txData?.status || "pending",
            created_at: toIsoString(txData?.created_at),
            verified_at: toIsoString(txData?.verified_at),
          };
        }
      }

      const controls = await readEventControlsFromDb(adminDb);
      const effectiveState = buildPublicEventState(controls);
      const problemStatementsLive = effectiveState?.problemStatements?.isLive === true;
      const problemCatalog = getProblemStatementCatalog();

      const [capacitySnapshot, selectedProblem] = await Promise.all([
        problemStatementsLive
          ? readProblemStatementCapacitySnapshot(adminDb, problemCatalog)
          : Promise.resolve({
              maxTeamsPerProblem: MAX_TEAMS_PER_PROBLEM,
              counts: Object.fromEntries(problemCatalog.map((problem) => [problem.id, 0])),
            }),
        loadTeamSelection(teamDoc.id, problemCatalog),
      ]);

      const problemStatements = problemStatementsLive
        ? mapProblemStatementsWithCapacity({
            catalog: problemCatalog,
            capacitySnapshot,
          })
        : [];

      const teamFreeze =
        teamData?.freeze && typeof teamData.freeze === "object" ? teamData.freeze : {};
      const teamFrozen = teamFreeze?.locked === true;

      const updates = buildUpdates(
        payment,
        selectedProblem,
        problemStatements.length,
        effectiveState,
        teamFrozen
      );

      return NextResponse.json({
        success: true,
        dashboard: {
          role: hasLeadRole ? "TEAM_LEAD" : isLeadByOrder ? "TEAM_LEAD" : "PARTICIPANT",
          lead_email: email,
          team: {
            team_id: teamDoc.id,
            team_name: teamData?.team_name || "",
            college: teamData?.college || "",
            team_size: teamData?.team_size || memberIds.length,
            created_at: toIsoString(teamData?.created_at),
            freeze: {
              locked: teamFrozen,
              locked_at: toIsoString(teamFreeze?.locked_at || teamFreeze?.lockedAt),
              locked_by_uid: String(teamFreeze?.locked_by_uid || teamFreeze?.lockedByUid || ""),
              locked_by_email: String(teamFreeze?.locked_by_email || teamFreeze?.lockedByEmail || ""),
              source: String(teamFreeze?.source || ""),
            },
          },
          members: members.map((member, index) => ({
            ...member,
            is_leader: index === 0,
          })),
          payment,
          event_controls: {
            timezone: EVENT_TIME_ZONE,
            timezone_label: EVENT_TIME_ZONE_LABEL,
            problem_statements: {
              ...(effectiveState?.problemStatements || {}),
              max_teams_per_problem:
                capacitySnapshot?.maxTeamsPerProblem || MAX_TEAMS_PER_PROBLEM,
            },
            freeze: effectiveState?.freeze || null,
          },
          selected_problem: selectedProblem,
          problem_statements: problemStatements,
          updates,
        },
      });
    }

    return NextResponse.json(
      { error: "No team registration could be linked to this account." },
      { status: 404 }
    );
  } catch (error) {
    console.error("Failed to load team dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch team dashboard data." },
      { status: 500 }
    );
  }
}
