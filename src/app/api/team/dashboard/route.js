import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../../firebaseAdmin";

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
  const authHeader = request.headers.get("authorization") || "";

  if (!authHeader.startsWith("Bearer ")) {
    return { error: unauthorized("Missing or invalid Authorization header.") };
  }

  const idToken = authHeader.slice(7).trim();
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

async function loadProblemStatements() {
  try {
    const snapshot = await adminDb
      .collection("problem_statements")
      .orderBy("created_at", "desc")
      .limit(10)
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        problem_id: doc.id,
        title: data?.title || data?.name || "Untitled Problem Statement",
        description: data?.description || "",
        category: data?.category || "General",
        published_at: toIsoString(data?.published_at || data?.created_at),
      };
    });
  } catch {
    return [];
  }
}

async function loadTeamSelection(teamId) {
  try {
    const snapshot = await adminDb
      .collection("team_problem_selection")
      .where("team_id", "==", teamId)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
      selection_id: doc.id,
      team_id: teamId,
      problem_id: data?.problem_id || null,
      problem_title: data?.problem_title || null,
      selected_at: toIsoString(data?.selected_at || data?.created_at),
    };
  } catch {
    return null;
  }
}

function buildUpdates(payment, selectedProblem, problemStatementsCount) {
  const updates = [];

  if (payment?.status === "verified") {
    updates.push("Payment has been verified by admin.");
  } else if (payment?.status === "rejected") {
    updates.push("Payment was rejected. Contact support for correction.");
  } else {
    updates.push("Payment is pending verification.");
  }

  if (selectedProblem?.problem_id || selectedProblem?.problem_title) {
    updates.push("Problem statement selected by your team.");
  } else if (problemStatementsCount > 0) {
    updates.push("Problem statements are available. Please complete your selection.");
  } else {
    updates.push("Problem statements are not published yet.");
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

      const [problemStatements, selectedProblem] = await Promise.all([
        loadProblemStatements(),
        loadTeamSelection(teamDoc.id),
      ]);

      const updates = buildUpdates(payment, selectedProblem, problemStatements.length);

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
          },
          members: members.map((member, index) => ({
            ...member,
            is_leader: index === 0,
          })),
          payment,
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
