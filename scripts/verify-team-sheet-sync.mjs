import { adminDb } from "../firebaseAdmin.js";
import {
  TEAM_SHEET_EXPORT_EVENTS_COLLECTION,
  attemptTeamSheetExportSync,
} from "../src/app/api/admin/_utils/team-sheet-export.js";
import {
  asTrimmedString,
  getBooleanFlag,
  getNumberFlag,
  getStringFlag,
  parseCliFlags,
} from "./_problem-selection-test-utils.mjs";

function normalizeStatus(value) {
  return asTrimmedString(value).toUpperCase();
}

function normalizeEventType(value) {
  const normalized = asTrimmedString(value).toUpperCase();
  if (normalized === "PROBLEM_SELECTION" || normalized === "TEAM_SUBMISSION") {
    return normalized;
  }

  return "";
}

function toIso(value) {
  if (!value) {
    return "";
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

async function loadCandidateDocs({ eventId, limit }) {
  if (eventId) {
    const doc = await adminDb
      .collection(TEAM_SHEET_EXPORT_EVENTS_COLLECTION)
      .doc(eventId)
      .get();

    return doc.exists ? [doc] : [];
  }

  const snapshot = await adminDb
    .collection(TEAM_SHEET_EXPORT_EVENTS_COLLECTION)
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();

  return snapshot.docs;
}

async function main() {
  const flags = parseCliFlags();

  const limit = Math.max(1, Math.floor(getNumberFlag(flags, "limit", 20)));
  const eventId = getStringFlag(flags, "event-id", "");
  const requestedEventType = normalizeEventType(getStringFlag(flags, "event-type", ""));
  const forceSync = getBooleanFlag(flags, "force-sync", false);
  const requireSynced = getBooleanFlag(flags, "require-synced", false);
  const requireEvents = getBooleanFlag(flags, "require-events", false);

  const candidateDocs = await loadCandidateDocs({
    eventId,
    limit,
  });

  const filteredDocs = candidateDocs.filter((doc) => {
    const data = doc.data() || {};
    if (!requestedEventType) {
      return true;
    }

    return normalizeEventType(data?.event_type) === requestedEventType;
  });

  if (filteredDocs.length === 0) {
    if (requireEvents) {
      throw new Error("No matching team sheet export events were found.");
    }

    console.log("No matching team sheet export events were found.");
    console.log("sheet_sync_verification=ok checked=0");
    return;
  }

  const rows = [];

  for (const doc of filteredDocs) {
    const data = doc.data() || {};

    if (forceSync) {
      await attemptTeamSheetExportSync({
        eventId: doc.id,
        force: true,
      });
    }

    const refreshed = await adminDb
      .collection(TEAM_SHEET_EXPORT_EVENTS_COLLECTION)
      .doc(doc.id)
      .get();

    const nextData = refreshed.exists ? refreshed.data() || {} : data;
    const status = normalizeStatus(nextData?.sheet_sync?.status || "UNKNOWN");
    const attemptCount = Number(nextData?.sheet_sync?.attempt_count || 0);

    rows.push({
      id: doc.id,
      eventType: normalizeEventType(nextData?.event_type) || "UNKNOWN",
      status,
      attemptCount: Number.isFinite(attemptCount) ? attemptCount : 0,
      targetRange: asTrimmedString(nextData?.sheet_sync?.target_range || ""),
      createdAt: toIso(nextData?.created_at || nextData?.created_at_iso),
      syncedAt: toIso(nextData?.sheet_sync?.synced_at || nextData?.sheet_sync?.synced_at_iso),
      error: asTrimmedString(nextData?.sheet_sync?.last_error || ""),
      teamId: asTrimmedString(nextData?.payload?.team_id || ""),
      problemId: asTrimmedString(nextData?.payload?.problem_id || ""),
    });
  }

  for (const row of rows) {
    console.log(
      `${row.status.padEnd(10)} | ${row.eventType.padEnd(17)} | ${row.id} | team=${row.teamId || "N/A"} | problem=${row.problemId || "N/A"} | range=${row.targetRange || "N/A"} | attempts=${row.attemptCount}`
    );

    if (row.error) {
      console.log(`  last_error=${row.error}`);
    }
  }

  const summary = rows.reduce(
    (accumulator, row) => {
      const key = row.status || "UNKNOWN";
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    },
    {}
  );

  console.log(`summary=${JSON.stringify(summary)}`);

  const hardFailures = rows.filter((row) => row.status === "FAILED" || row.status === "DEAD_LETTER");
  if (hardFailures.length > 0) {
    throw new Error(`Found ${hardFailures.length} failed/dead-letter sheet sync events.`);
  }

  if (requireSynced) {
    const nonSynced = rows.filter((row) => row.status !== "SYNCED");
    if (nonSynced.length > 0) {
      throw new Error(`Found ${nonSynced.length} non-synced events while --require-synced=true.`);
    }
  }

  console.log(`sheet_sync_verification=ok checked=${rows.length}`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(`Team sheet sync verification failed: ${error.message}`);
    process.exit(1);
  });
