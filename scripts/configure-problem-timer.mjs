import fs from "node:fs/promises";
import path from "node:path";
import {
  asTrimmedString,
  buildLiveWindowControls,
  getBooleanFlag,
  getNumberFlag,
  getStringFlag,
  parseCliFlags,
  readEventControlsRawSnapshot,
  readNormalizedEventControls,
  restoreEventControlsRawSnapshot,
  writeEventControlsWithVersion,
} from "./_problem-selection-test-utils.mjs";
import { buildPublicEventState } from "../lib/server/event-controls.js";

function formatCountdown(msRemaining) {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (days > 0) {
    return `${days}D ${hh}:${mm}:${ss}`;
  }

  return `${hh}:${mm}:${ss}`;
}

function toAbsolutePath(inputPath) {
  const cleaned = asTrimmedString(inputPath);
  if (!cleaned) {
    return path.resolve("scripts", "output", "problem-timer-snapshot.json");
  }

  if (path.isAbsolute(cleaned)) {
    return cleaned;
  }

  return path.resolve(cleaned);
}

async function saveSnapshot(filePath, snapshot) {
  const dirPath = path.dirname(filePath);
  await fs.mkdir(dirPath, { recursive: true });

  const payload = {
    captured_at: new Date().toISOString(),
    snapshot,
  };

  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function readSnapshot(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed?.snapshot || typeof parsed.snapshot !== "object") {
    throw new Error("Snapshot file is invalid or missing snapshot payload.");
  }

  return parsed.snapshot;
}

function printStateSummary(state, title) {
  const problem = state?.problemStatements || {};
  const freeze = state?.freeze || {};
  const releaseAtMs = Date.parse(problem.releaseAt || "");
  const nowMs = Date.now();

  console.log(`\n${title}`);
  console.log(`problem.status=${problem.status || "N/A"}`);
  console.log(`problem.enabled=${problem.enabled === true}`);
  console.log(`problem.releaseAt=${problem.releaseAt || "null"}`);

  if (Number.isFinite(releaseAtMs) && releaseAtMs > nowMs) {
    console.log(`problem.release_in=${formatCountdown(releaseAtMs - nowMs)}`);
  }

  console.log(`freeze.status=${freeze.status || "N/A"}`);
  console.log(`freeze.enabled=${freeze.enabled === true}`);
  console.log(`freeze.openAt=${freeze.openAt || "null"}`);
  console.log(`freeze.closeAt=${freeze.closeAt || "null"}`);
}

async function main() {
  const flags = parseCliFlags();
  const mode = getStringFlag(flags, "mode", "status").toLowerCase();
  const snapshotPath = toAbsolutePath(getStringFlag(flags, "snapshot", ""));
  const actorEmail =
    getStringFlag(flags, "actor-email", "") ||
    asTrimmedString(process.env.ADMIN_TEST_EMAIL || "") ||
    "runtime-script@local";

  if (mode === "status") {
    const controls = await readNormalizedEventControls();
    const state = buildPublicEventState(controls);
    printStateSummary(state, "Current Event State");
    return;
  }

  if (mode === "restore") {
    const snapshot = await readSnapshot(snapshotPath);
    await restoreEventControlsRawSnapshot(snapshot);

    const controls = await readNormalizedEventControls();
    const state = buildPublicEventState(controls);

    printStateSummary(state, "Restored Event State");
    console.log(`snapshot_restored_from=${snapshotPath}`);
    return;
  }

  const saveSnapshotBeforeChange = getBooleanFlag(flags, "save-snapshot", true);
  const releaseInSeconds = getNumberFlag(flags, "release-in-seconds", 120);
  const freezeDurationMinutes = getNumberFlag(flags, "freeze-duration-minutes", 45);

  const currentControls = await readNormalizedEventControls();

  if (saveSnapshotBeforeChange) {
    const rawSnapshot = await readEventControlsRawSnapshot();
    await saveSnapshot(snapshotPath, rawSnapshot);
    console.log(`snapshot_saved_to=${snapshotPath}`);
  }

  let nextControls;

  if (mode === "arm") {
    nextControls = buildLiveWindowControls(currentControls, {
      releaseOffsetSeconds: releaseInSeconds,
      freezeDurationMinutes,
    });
  } else if (mode === "live-now") {
    nextControls = buildLiveWindowControls(currentControls, {
      releaseOffsetSeconds: -10,
      freezeDurationMinutes,
    });
  } else if (mode === "disable") {
    nextControls = {
      ...currentControls,
      problemStatements: {
        enabled: false,
        releaseAt: null,
      },
      freeze: {
        ...currentControls.freeze,
        enabled: false,
      },
    };
  } else {
    throw new Error("Unsupported mode. Use status, arm, live-now, disable, or restore.");
  }

  const persistedControls = await writeEventControlsWithVersion(nextControls, actorEmail);
  const effectiveState = buildPublicEventState(persistedControls);

  printStateSummary(effectiveState, "Updated Event State");
  console.log(`mode=${mode}`);
}

main().catch((error) => {
  console.error(`Problem timer configuration failed: ${error.message}`);
  process.exit(1);
});
