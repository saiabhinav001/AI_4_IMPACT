import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { adminAuth, adminDb, FieldValue } from "../../../../../firebaseAdmin";
import { requireAdmin } from "../_utils/auth";
import { invalidateAdminRegistrationsCache } from "../_utils/runtime-cache-invalidation";
import { upsertAdminReadModelForTransaction } from "../../../../../lib/server/admin-read-model.js";
import {
  attemptCredentialSheetExportSync,
  buildCredentialSheetExportEvent,
  createCredentialSheetExportEventRef,
} from "../_utils/credential-sheet-export";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 20;

function badRequest(error) {
  return NextResponse.json({ error }, { status: 400 });
}

function asTrimmedString(value) {
  return String(value || "").trim();
}

function asNormalizedEmail(value) {
  return asTrimmedString(value).toLowerCase();
}

function randomFromCharset(charset) {
  return charset[crypto.randomInt(0, charset.length)];
}

function shuffleChars(chars) {
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(0, index + 1);
    const temp = chars[index];
    chars[index] = chars[swapIndex];
    chars[swapIndex] = temp;
  }

  return chars;
}

function generateStrongPassword(length = MIN_PASSWORD_LENGTH) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*()-_=+[]{}";
  const all = `${upper}${lower}${digits}${symbols}`;
  const targetLength = Math.max(length, 12);

  const chars = [
    randomFromCharset(upper),
    randomFromCharset(lower),
    randomFromCharset(digits),
    randomFromCharset(symbols),
  ];

  while (chars.length < targetLength) {
    chars.push(randomFromCharset(all));
  }

  return shuffleChars(chars).join("");
}

function readExistingTeamAccess(registrationData) {
  const rawAccess = registrationData?.access_credentials || {};
  const teamId = asTrimmedString(
    registrationData?.team_access_id || rawAccess?.team_id
  ).toLowerCase();
  const authUid = asTrimmedString(
    registrationData?.team_lead_auth_uid || rawAccess?.auth_uid
  );
  const passwordVersionRaw = Number(rawAccess?.password_version || 0);

  return {
    rawAccess,
    teamId,
    authUid,
    passwordVersion:
      Number.isFinite(passwordVersionRaw) && passwordVersionRaw > 0
        ? Math.floor(passwordVersionRaw)
        : 0,
  };
}

async function getTeamLeadFromRegistration(registrationData) {
  const memberIds = Array.isArray(registrationData?.member_ids)
    ? registrationData.member_ids
    : [];

  const leaderParticipantId = memberIds[0];
  if (!leaderParticipantId) {
    throw new Error("Team registration is missing member_ids[0] for team leader.");
  }

  const leaderDoc = await adminDb.collection("participants").doc(leaderParticipantId).get();
  if (!leaderDoc.exists) {
    throw new Error("Team leader participant record not found.");
  }

  const leaderData = leaderDoc.data();
  const leaderName = asTrimmedString(leaderData?.name);
  const leaderEmail = asNormalizedEmail(leaderData?.email);
  const leaderPhone = asTrimmedString(leaderData?.phone);

  if (!leaderName || !leaderEmail || !leaderPhone) {
    throw new Error("Team leader details are incomplete (name/email/phone). Please fix participant data.");
  }

  return {
    participantId: leaderDoc.id,
    name: leaderName,
    email: leaderEmail,
    phone: leaderPhone,
  };
}

async function ensureTeamLeadAuthAccount({
  existingAuthUid,
  email,
  password,
  displayName,
  teamAccessId,
  participantId,
  registrationRefId,
}) {
  let userRecord = null;

  if (existingAuthUid) {
    try {
      userRecord = await adminAuth.getUser(existingAuthUid);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") {
        throw error;
      }
    }
  }

  if (!userRecord) {
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") {
        throw error;
      }
    }
  }

  if (userRecord?.customClaims?.admin === true) {
    throw new Error("Team leader email belongs to an admin account. Use a non-admin email for team access.");
  }

  if (userRecord) {
    const updatePayload = {
      password,
      displayName: displayName || userRecord.displayName || teamAccessId,
      disabled: false,
    };

    const currentEmail = asNormalizedEmail(userRecord.email);
    if (!currentEmail || currentEmail !== email) {
      updatePayload.email = email;
    }

    await adminAuth.updateUser(userRecord.uid, updatePayload);
  } else {
    userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: displayName || teamAccessId,
      disabled: false,
    });
  }

  const existingClaims = userRecord.customClaims || {};
  await adminAuth.setCustomUserClaims(userRecord.uid, {
    ...existingClaims,
    role: "TEAM_LEAD",
    team_access_id: teamAccessId,
    participant_id: participantId,
    registration_ref: registrationRefId,
    must_reset_password: true,
  });

  return userRecord.uid;
}

export async function POST(request) {
  const authResult = await requireAdmin(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const transactionId = asTrimmedString(body?.transaction_id);

    if (!transactionId) {
      return badRequest("transaction_id is required.");
    }

    const transactionRef = adminDb.collection("transactions").doc(transactionId);
    const transactionDoc = await transactionRef.get();

    if (!transactionDoc.exists) {
      return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    }

    const transactionData = transactionDoc.data();
    if (transactionData?.registration_type !== "hackathon") {
      return badRequest("Credentials can be regenerated only for hackathon registrations.");
    }

    const registrationRefId = asTrimmedString(transactionData?.registration_ref);
    if (!registrationRefId) {
      return badRequest("Transaction is missing registration_ref.");
    }

    const registrationRef = adminDb.collection("hackathon_registrations").doc(registrationRefId);
    const registrationDoc = await registrationRef.get();

    if (!registrationDoc.exists) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    const registrationData = registrationDoc.data();
    if (registrationData?.payment_verified !== true) {
      return badRequest("Payment must be verified before regenerating credentials.");
    }

    const existingAccess = readExistingTeamAccess(registrationData);
    if (!existingAccess.teamId) {
      return badRequest("Team access ID is missing. Verify payment first to provision credentials.");
    }

    const teamLead = await getTeamLeadFromRegistration(registrationData);
    const temporaryPassword = generateStrongPassword();

    const authUid = await ensureTeamLeadAuthAccount({
      existingAuthUid: existingAccess.authUid,
      email: teamLead.email,
      password: temporaryPassword,
      displayName: teamLead.name,
      teamAccessId: existingAccess.teamId,
      participantId: teamLead.participantId,
      registrationRefId,
    });

    const nextPasswordVersion = existingAccess.passwordVersion > 0
      ? existingAccess.passwordVersion + 1
      : 2;

    const credentialPayload = {
      team_id: existingAccess.teamId,
      password: temporaryPassword,
      leader_name: teamLead.name,
      leader_email: teamLead.email,
      leader_phone: teamLead.phone,
      auth_uid: authUid,
      password_issued: true,
      password_version: nextPasswordVersion,
    };

    const credentialSheetEventRef = createCredentialSheetExportEventRef();
    const batch = adminDb.batch();

    batch.update(registrationRef, {
      team_access_id: existingAccess.teamId,
      team_lead_auth_uid: authUid,
      "access_credentials.team_id": existingAccess.teamId,
      "access_credentials.leader_name": teamLead.name,
      "access_credentials.leader_email": teamLead.email,
      "access_credentials.leader_phone": teamLead.phone,
      "access_credentials.auth_uid": authUid,
      "access_credentials.password_version": nextPasswordVersion,
      "access_credentials.password": FieldValue.delete(),
      "access_credentials.updated_at": FieldValue.serverTimestamp(),
      "access_credentials.generated_at": registrationData?.access_credentials?.generated_at || FieldValue.serverTimestamp(),
    });

    batch.set(
      credentialSheetEventRef,
      buildCredentialSheetExportEvent({
        eventType: "REGENERATE",
        transactionId,
        registrationRef: registrationRefId,
        registrationType: "hackathon",
        issuedByAdminUid: authResult.decodedToken.uid,
        issuedByAdminEmail: authResult.decodedToken.email || "",
        credential: credentialPayload,
        registration: {
          college_name: registrationData?.college || "",
          team_size:
            registrationData?.team_size ||
            (Array.isArray(registrationData?.member_ids)
              ? registrationData.member_ids.length
              : null),
        },
        source: "api/admin/regenerate-team-credentials",
        notes: "Credentials regenerated by admin action.",
      })
    );

    await batch.commit();

    const sheetSyncResult = await attemptCredentialSheetExportSync({
      eventId: credentialSheetEventRef.id,
    });

    if (!sheetSyncResult?.success && !sheetSyncResult?.skipped) {
      console.error("Credential sheet sync failed after regeneration:", sheetSyncResult.error);
    }

    try {
      await upsertAdminReadModelForTransaction(transactionId);
    } catch (readModelError) {
      console.error(
        "Failed to upsert admin read model after regenerate-team-credentials:",
        readModelError
      );
    }

    invalidateAdminRegistrationsCache();

    return NextResponse.json({
      success: true,
      access_credentials: {
        team_id: credentialPayload.team_id,
        password: credentialPayload.password,
        leader_name: credentialPayload.leader_name,
        leader_email: credentialPayload.leader_email,
        leader_phone: credentialPayload.leader_phone,
        auth_uid: credentialPayload.auth_uid,
        password_issued: credentialPayload.password_issued,
        password_version: credentialPayload.password_version,
      },
      credential_export_event_id: credentialSheetEventRef.id,
    });
  } catch (error) {
    console.error("Team credential regeneration failed:", error);
    return NextResponse.json(
      { error: "Failed to regenerate team credentials." },
      { status: 500 }
    );
  }
}
