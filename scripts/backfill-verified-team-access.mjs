import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";

const TEAM_ID_PREFIX = "ai4i";
const TEAM_ID_PAD = 3;
const MIN_PASSWORD_LENGTH = 20;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq < 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
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

async function reserveNextTeamAccessId(adminDb) {
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

async function getTeamLead(adminDb, registrationData) {
  const memberIds = Array.isArray(registrationData?.member_ids)
    ? registrationData.member_ids
    : [];

  const leaderParticipantId = memberIds[0];
  if (!leaderParticipantId) {
    throw new Error("Missing member_ids[0] for team leader");
  }

  const leaderDoc = await adminDb.collection("participants").doc(leaderParticipantId).get();
  if (!leaderDoc.exists) {
    throw new Error("Team leader participant record not found");
  }

  const leaderData = leaderDoc.data() || {};
  const leaderName = asTrimmedString(leaderData.name);
  const leaderEmail = asNormalizedEmail(leaderData.email);
  const leaderPhone = asTrimmedString(leaderData.phone);

  if (!leaderName || !leaderEmail || !leaderPhone) {
    throw new Error("Team leader details incomplete");
  }

  return {
    participantId: leaderDoc.id,
    name: leaderName,
    email: leaderEmail,
    phone: leaderPhone,
  };
}

async function ensureTeamLeadAuthAccount(adminAuth, {
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
    throw new Error("Leader email belongs to admin account");
  }

  if (userRecord) {
    const payload = {
      password,
      displayName: displayName || userRecord.displayName || teamAccessId,
      disabled: false,
    };

    const currentEmail = asNormalizedEmail(userRecord.email);
    if (!currentEmail || currentEmail !== email) {
      payload.email = email;
    }

    await adminAuth.updateUser(userRecord.uid, payload);
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

function toCsv(rows) {
  if (!rows.length) return "";

  const headers = ["registration_doc_id", "team_access_id", "leader_name", "leader_email", "leader_phone", "temporary_password", "auth_uid"];
  const lines = [headers.join(",")];

  for (const row of rows) {
    const values = headers.map((key) => {
      const value = String(row[key] || "");
      return `"${value.replace(/"/g, '""')}"`;
    });

    lines.push(values.join(","));
  }

  return lines.join("\n");
}

async function main() {
  const shouldApply = process.argv.includes("--apply");

  loadEnvFile(path.resolve(".env.local"));
  const { adminAuth, adminDb } = await import("../firebaseAdmin.js");

  const snapshot = await adminDb
    .collection("hackathon_registrations")
    .where("payment_verified", "==", true)
    .get();

  const results = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const existingTeamId = asTrimmedString(data?.team_access_id || data?.access_credentials?.team_id).toLowerCase();
    const existingAuthUid = asTrimmedString(data?.team_lead_auth_uid || data?.access_credentials?.auth_uid);

    if (existingTeamId && existingAuthUid) {
      results.push({
        registration_doc_id: doc.id,
        status: "already_provisioned",
        team_access_id: existingTeamId,
      });
      continue;
    }

    const leader = await getTeamLead(adminDb, data);
    const teamAccessId = existingTeamId || (shouldApply ? await reserveNextTeamAccessId(adminDb) : "DRY_RUN_TEAM_ID");
    const temporaryPassword = generateStrongPassword();

    let authUid = existingAuthUid || "";

    if (shouldApply) {
      authUid = await ensureTeamLeadAuthAccount(adminAuth, {
        existingAuthUid,
        email: leader.email,
        password: temporaryPassword,
        displayName: leader.name,
        teamAccessId,
        participantId: leader.participantId,
        registrationRefId: doc.id,
      });

      const currentVersion = Number(data?.access_credentials?.password_version || 0);
      const nextVersion = Number.isFinite(currentVersion) && currentVersion > 0
        ? currentVersion + 1
        : 1;

      await doc.ref.update({
        team_access_id: teamAccessId,
        team_lead_auth_uid: authUid,
        "access_credentials.team_id": teamAccessId,
        "access_credentials.leader_name": leader.name,
        "access_credentials.leader_email": leader.email,
        "access_credentials.leader_phone": leader.phone,
        "access_credentials.auth_uid": authUid,
        "access_credentials.password_version": nextVersion,
        "access_credentials.password": FieldValue.delete(),
        "access_credentials.updated_at": FieldValue.serverTimestamp(),
        "access_credentials.generated_at": data?.access_credentials?.generated_at || FieldValue.serverTimestamp(),
      });
    }

    results.push({
      registration_doc_id: doc.id,
      status: shouldApply ? "provisioned" : "would_provision",
      team_access_id: teamAccessId,
      leader_name: leader.name,
      leader_email: leader.email,
      leader_phone: leader.phone,
      temporary_password: temporaryPassword,
      auth_uid: authUid,
    });
  }

  const summary = {
    mode: shouldApply ? "apply" : "dry-run",
    total_verified_docs: snapshot.size,
    provisioned_or_would_provision: results.filter((item) => item.status === "provisioned" || item.status === "would_provision").length,
    already_provisioned: results.filter((item) => item.status === "already_provisioned").length,
  };

  console.log(JSON.stringify(summary, null, 2));

  const credentials = results.filter((item) => item.status === "provisioned" || item.status === "would_provision");
  if (credentials.length) {
    console.log("\nCredential rows:\n");
    for (const row of credentials) {
      console.log(JSON.stringify(row));
    }

    if (shouldApply) {
      const outDir = path.resolve("scripts", "output");
      fs.mkdirSync(outDir, { recursive: true });
      const filename = `team-access-credentials-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
      const outPath = path.join(outDir, filename);
      fs.writeFileSync(outPath, toCsv(credentials), "utf8");
      console.log(`\nSaved credential CSV: ${outPath}`);
    }
  }
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
