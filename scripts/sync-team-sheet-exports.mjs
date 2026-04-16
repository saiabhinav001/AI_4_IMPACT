import { adminDb } from "../firebaseAdmin.js";
import {
  attemptTeamSheetExportSync,
  TEAM_SHEET_EXPORT_EVENTS_COLLECTION,
} from "../src/app/api/admin/_utils/team-sheet-export.js";

function asTrimmedString(value) {
  return String(value || "").trim();
}

function parseLimitArg() {
  const raw = asTrimmedString(process.argv[2] || "50");
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 50;
  }

  return Math.min(parsed, 500);
}

function parseForceFlag() {
  return process.argv.includes("--force");
}

function parseTimestampMillis(value) {
  if (!value) return NaN;

  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  const date = new Date(value);
  const millis = date.getTime();
  return Number.isNaN(millis) ? NaN : millis;
}

function isDueForRetry(eventData, force) {
  if (force) {
    return true;
  }

  const nextRetryMillis = parseTimestampMillis(eventData?.sheet_sync?.next_retry_at);
  if (!Number.isFinite(nextRetryMillis)) {
    return true;
  }

  return Date.now() >= nextRetryMillis;
}

async function main() {
  const limit = parseLimitArg();
  const force = parseForceFlag();

  const statuses = force
    ? ["PENDING", "FAILED", "DEAD_LETTER"]
    : ["PENDING", "FAILED"];

  const snapshot = await adminDb
    .collection(TEAM_SHEET_EXPORT_EVENTS_COLLECTION)
    .where("sheet_sync.status", "in", statuses)
    .limit(limit)
    .get();

  if (snapshot.empty) {
    console.log("No team sheet export events to sync.");
    return;
  }

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    const eventData = doc.data() || {};

    if (!isDueForRetry(eventData, force)) {
      skipped += 1;
      continue;
    }

    const result = await attemptTeamSheetExportSync({
      eventId: doc.id,
      force,
    });

    if (result?.success) {
      synced += 1;
      console.log(`SYNCED | ${doc.id} | ${result.targetRange || ""}`);
      continue;
    }

    if (result?.skipped) {
      skipped += 1;
      console.log(`SKIPPED | ${doc.id} | ${result.reason || "unknown"}`);
      continue;
    }

    failed += 1;
    console.log(`FAILED | ${doc.id} | ${result?.error || result?.reason || "unknown"}`);
  }

  console.log(`Summary: synced=${synced}, skipped=${skipped}, failed=${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Team sheet export sync failed: ${error.message}`);
  process.exit(1);
});
