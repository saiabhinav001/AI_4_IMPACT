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

const TEAM_ID_PREFIX = "ai4i";
const TEAM_ID_PAD = 3;
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

function formatTeamAccessId(sequence) {
  return `${TEAM_ID_PREFIX}${String(sequence).padStart(TEAM_ID_PAD, "0")}`;
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

function hasStoredCredentials(accessCredentials) {
  return Boolean(asTrimmedString(accessCredentials?.team_id));
}

function isScreenshotPathCompatibleWithType(screenshotUrl, registrationType) {
  const normalizedType = asTrimmedString(registrationType).toLowerCase();
  if (!screenshotUrl || !normalizedType) {
    return true;
  }

  try {
    const parsed = new URL(screenshotUrl);
    if (parsed.hostname !== "firebasestorage.googleapis.com") {
      return true;
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    const objectIndex = segments.indexOf("o");
    if (objectIndex === -1 || objectIndex + 1 >= segments.length) {
      return true;
    }

    const objectPath = decodeURIComponent(segments.slice(objectIndex + 1).join("/"));
    if (!objectPath) {
      return true;
    }

    // Keep legacy temp uploads valid while enforcing separated workshop/hackathon buckets.
    if (objectPath.startsWith("payments/temp_")) {
      return true;
    }

    if (objectPath.startsWith(`payments/${normalizedType}/`)) {
      return true;
    }

    if (
      objectPath.startsWith("payments/workshop/") ||
      objectPath.startsWith("payments/hackathon/")
    ) {
      return false;
    }

    return true;
  } catch {
    return true;
  }
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

async function reserveNextTeamAccessId() {
  const analyticsRef = adminDb.collection("analytics").doc("summary");

  return adminDb.runTransaction(async (transaction) => {
    const analyticsDoc = await transaction.get(analyticsRef);
    const currentCounter = Number(
      analyticsDoc.exists ? analyticsDoc.get("team_access_counter") || 0 : 0
    );
    const nextCounter = Number.isFinite(currentCounter) && currentCounter > 0
      ? currentCounter + 1
      : 1;

    transaction.set(
      analyticsRef,
      {
        team_access_counter: nextCounter,
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return formatTeamAccessId(nextCounter);
  });
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
  forcePasswordUpdate,
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
      displayName: displayName || userRecord.displayName || teamAccessId,
      disabled: false,
    };

    const currentEmail = asNormalizedEmail(userRecord.email);
    if (!currentEmail || currentEmail !== email) {
      updatePayload.email = email;
    }

    if (forcePasswordUpdate && password) {
      updatePayload.password = password;
    }

    await adminAuth.updateUser(userRecord.uid, {
      ...updatePayload,
    });
  } else {
    if (!password) {
      throw new Error("Missing temporary password for new team leader auth account.");
    }

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
    must_reset_password: forcePasswordUpdate === true,
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
    const transactionId = String(body?.transaction_id || "").trim();
    const action = String(body?.action || "").trim().toLowerCase();

    if (!transactionId || !["verify", "reject"].includes(action)) {
      return badRequest("transaction_id and action (verify|reject) are required.");
    }

    const transactionRef = adminDb.collection("transactions").doc(transactionId);
    const transactionDoc = await transactionRef.get();

    if (!transactionDoc.exists) {
      return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    }

    const transactionData = transactionDoc.data();
    const registrationType = transactionData?.registration_type;
    const registrationRefId = transactionData?.registration_ref;

    if (!isScreenshotPathCompatibleWithType(transactionData?.screenshot_url, registrationType)) {
      return badRequest(
        "Transaction screenshot path does not match registration_type. Keep workshop and hackathon uploads separate."
      );
    }

    let registrationCollection = null;
    if (registrationType === "workshop") {
      registrationCollection = "workshop_registrations";
    } else if (registrationType === "hackathon") {
      registrationCollection = "hackathon_registrations";
    } else {
      return badRequest("Transaction has an invalid registration_type.");
    }

    if (!registrationRefId) {
      return badRequest("Transaction is missing registration_ref.");
    }

    const registrationRef = adminDb.collection(registrationCollection).doc(registrationRefId);
    const registrationDoc = await registrationRef.get();

    if (!registrationDoc.exists) {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }

    const registrationData = registrationDoc.data();

    const status = action === "verify" ? "verified" : "rejected";
    const paymentVerified = action === "verify";

    let accessCredentials = null;
    let credentialSheetEventRef = null;

    if (action === "verify" && registrationType === "hackathon") {
      const teamLead = await getTeamLeadFromRegistration(registrationData);
      const existingAccess = readExistingTeamAccess(registrationData);
      const teamAccessId = existingAccess.teamId || (await reserveNextTeamAccessId());
      const shouldIssuePassword = !existingAccess.teamId || !existingAccess.authUid;
      const teamPassword = shouldIssuePassword ? generateStrongPassword() : null;

      const authUid = await ensureTeamLeadAuthAccount({
        existingAuthUid: existingAccess.authUid,
        email: teamLead.email,
        password: teamPassword,
        displayName: teamLead.name,
        teamAccessId,
        participantId: teamLead.participantId,
        registrationRefId,
        forcePasswordUpdate: shouldIssuePassword,
      });

      const nextPasswordVersion = shouldIssuePassword
        ? (existingAccess.passwordVersion > 0 ? existingAccess.passwordVersion + 1 : 1)
        : (existingAccess.passwordVersion > 0 ? existingAccess.passwordVersion : 1);

      accessCredentials = {
        team_id: teamAccessId,
        password: teamPassword,
        leader_name: teamLead.name,
        leader_email: teamLead.email,
        leader_phone: teamLead.phone,
        auth_uid: authUid,
        password_issued: shouldIssuePassword,
        password_version: nextPasswordVersion,
      };
    }

    const batch = adminDb.batch();
    batch.update(transactionRef, {
      status,
      verified_by: authResult.decodedToken.uid,
      verified_at: FieldValue.serverTimestamp(),
    });

    const registrationUpdates = {
      payment_verified: paymentVerified,
    };

    if (accessCredentials) {
      registrationUpdates.team_access_id = accessCredentials.team_id;
      registrationUpdates.team_lead_auth_uid = accessCredentials.auth_uid;
      registrationUpdates["access_credentials.team_id"] = accessCredentials.team_id;
      registrationUpdates["access_credentials.leader_name"] = accessCredentials.leader_name;
      registrationUpdates["access_credentials.leader_email"] = accessCredentials.leader_email;
      registrationUpdates["access_credentials.leader_phone"] = accessCredentials.leader_phone;
      registrationUpdates["access_credentials.auth_uid"] = accessCredentials.auth_uid;
      registrationUpdates["access_credentials.password_version"] = accessCredentials.password_version;
      registrationUpdates["access_credentials.updated_at"] = FieldValue.serverTimestamp();
      registrationUpdates["access_credentials.password"] = FieldValue.delete();

      if (!hasStoredCredentials(registrationData?.access_credentials)) {
        registrationUpdates["access_credentials.generated_at"] = FieldValue.serverTimestamp();
      }
    } else if (registrationType === "hackathon") {
      registrationUpdates["access_credentials.password"] = FieldValue.delete();
    }

    batch.update(registrationRef, registrationUpdates);

    if (action === "verify" && registrationType === "hackathon" && accessCredentials) {
      const memberCount = Array.isArray(registrationData?.member_ids)
        ? registrationData.member_ids.length
        : 0;

      credentialSheetEventRef = createCredentialSheetExportEventRef();
      batch.set(
        credentialSheetEventRef,
        buildCredentialSheetExportEvent({
          eventType: "VERIFY_ISSUE",
          transactionId,
          registrationRef: registrationRefId,
          registrationType,
          issuedByAdminUid: authResult.decodedToken.uid,
          issuedByAdminEmail: authResult.decodedToken.email || "",
          credential: accessCredentials,
          registration: {
            college_name: registrationData?.college || "",
            team_size: registrationData?.team_size || memberCount || null,
          },
          source: "api/admin/verify-payment",
          notes: "Credentials issued during payment verification.",
        })
      );
    }

    await batch.commit();

    if (credentialSheetEventRef) {
      const sheetSyncResult = await attemptCredentialSheetExportSync({
        eventId: credentialSheetEventRef.id,
      });

      if (!sheetSyncResult?.success && !sheetSyncResult?.skipped) {
        console.error("Credential sheet sync failed after verify action:", sheetSyncResult.error);
      }
    }

    try {
      await upsertAdminReadModelForTransaction(transactionId);
    } catch (readModelError) {
      console.error("Failed to upsert admin read model after verify-payment:", readModelError);
    }

    invalidateAdminRegistrationsCache();

    return NextResponse.json({
      success: true,
      access_credentials: accessCredentials,
      credential_export_event_id: credentialSheetEventRef?.id || null,
    });
  } catch (error) {
    console.error("Payment verification update failed:", error);
    return NextResponse.json(
      { error: "Failed to update payment status." },
      { status: 500 }
    );
  }
}
