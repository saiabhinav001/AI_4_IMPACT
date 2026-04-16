import { adminAuth, adminDb } from "../firebaseAdmin.js";
import {
  PROBLEM_STATEMENT_SELECTION_COLLECTION,
} from "../lib/server/problem-statements.js";
import {
  TEAM_SHEET_EXPORT_EVENTS_COLLECTION,
} from "../src/app/api/admin/_utils/team-sheet-export.js";
import {
  asTrimmedString,
  getBooleanFlag,
  getNumberFlag,
  getStringFlag,
  parseCliFlags,
} from "./_problem-selection-test-utils.mjs";

function toPrefixList(flags) {
  const raw = getStringFlag(flags, "prefixes", "ps-e2e-team-,ps-race-team-");
  return raw
    .split(",")
    .map((value) => asTrimmedString(value))
    .filter(Boolean);
}

function startsWithAny(value, prefixes) {
  const text = asTrimmedString(value).toLowerCase();
  return prefixes.some((prefix) => text.startsWith(prefix.toLowerCase()));
}

async function main() {
  const flags = parseCliFlags();
  const limit = Math.max(1, Math.floor(getNumberFlag(flags, "limit", 200)));
  const dryRun = getBooleanFlag(flags, "dry-run", false);
  const prefixes = toPrefixList(flags);

  const eventsSnapshot = await adminDb
    .collection(TEAM_SHEET_EXPORT_EVENTS_COLLECTION)
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();

  const eventDocs = eventsSnapshot.docs;
  const targetEventIds = [];
  const targetTeamIds = new Set();

  for (const doc of eventDocs) {
    const data = doc.data() || {};
    const teamId = asTrimmedString(data?.payload?.team_id || "");

    if (!teamId || !startsWithAny(teamId, prefixes)) {
      continue;
    }

    targetEventIds.push(doc.id);
    targetTeamIds.add(teamId);
  }

  const teamIds = Array.from(targetTeamIds);

  if (teamIds.length === 0 && targetEventIds.length === 0) {
    console.log("No matching runtime test artifacts found.");
    return;
  }

  console.log(`cleanup_targets teams=${teamIds.length} events=${targetEventIds.length} dry_run=${dryRun}`);

  if (dryRun) {
    for (const teamId of teamIds) {
      console.log(`team_target=${teamId}`);
    }
    for (const eventId of targetEventIds) {
      console.log(`event_target=${eventId}`);
    }
    return;
  }

  const participantIdsToDelete = new Set();
  const authUidsToDelete = new Set();

  for (const teamId of teamIds) {
    const participants = await adminDb
      .collection("participants")
      .where("registration_ref", "==", teamId)
      .limit(20)
      .get();

    for (const participantDoc of participants.docs) {
      participantIdsToDelete.add(participantDoc.id);
      const email = asTrimmedString(participantDoc.data()?.email || "").toLowerCase();
      if (email.endsWith("@example.ai4impact.test")) {
        authUidsToDelete.add(email.replace(/@example\.ai4impact\.test$/, ""));
      }
    }
  }

  const operations = [];

  for (const teamId of teamIds) {
    operations.push(
      adminDb.collection(PROBLEM_STATEMENT_SELECTION_COLLECTION).doc(teamId).delete(),
      adminDb.collection("hackathon_registrations").doc(teamId).delete()
    );
  }

  for (const participantId of participantIdsToDelete) {
    operations.push(adminDb.collection("participants").doc(participantId).delete());
  }

  for (const eventId of targetEventIds) {
    operations.push(
      adminDb.collection(TEAM_SHEET_EXPORT_EVENTS_COLLECTION).doc(eventId).delete()
    );
  }

  await Promise.allSettled(operations);

  const authDeletes = [];
  for (const uid of authUidsToDelete) {
    authDeletes.push(adminAuth.deleteUser(uid));
  }

  await Promise.allSettled(authDeletes);

  console.log(
    `cleanup_complete teams=${teamIds.length} participants=${participantIdsToDelete.size} events=${targetEventIds.length} auth_users=${authUidsToDelete.size}`
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(`Cleanup failed: ${error.message}`);
    process.exit(1);
  });
