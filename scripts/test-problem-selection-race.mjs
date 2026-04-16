import {
  TEAM_SHEET_EXPORT_EVENTS_COLLECTION,
  attemptTeamSheetExportSync,
} from "../src/app/api/admin/_utils/team-sheet-export.js";
import { adminDb } from "../firebaseAdmin.js";
import {
  MAX_TEAMS_PER_PROBLEM,
  getProblemStatementCatalog,
  getProblemStatementCapacityRef,
} from "../lib/server/problem-statements.js";
import {
  assertLiveMutationAllowed,
  asTrimmedString,
  buildLiveWindowControls,
  createDisposableIdentity,
  createRuntimeIdToken,
  createTeamLeadFixture,
  deleteTeamLeadFixture,
  fetchJson,
  getBooleanFlag,
  getDefaultProblemId,
  getNumberFlag,
  getProblemCountFromSnapshot,
  getStringFlag,
  parseCliFlags,
  readCapacityRawSnapshot,
  readEventControlsRawSnapshot,
  readNormalizedEventControls,
  resolveApiKey,
  resolveBaseUrl,
  restoreCapacityRawSnapshot,
  restoreEventControlsRawSnapshot,
  updateCapacityCount,
  writeEventControlsWithVersion,
} from "./_problem-selection-test-utils.mjs";

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readMaxTeamsPerProblem(snapshot) {
  const raw = Number(snapshot?.data?.max_teams_per_problem);
  if (!Number.isFinite(raw) || raw <= 0) {
    return MAX_TEAMS_PER_PROBLEM;
  }

  return Math.floor(raw);
}

async function readCapacityCount(problemId) {
  const capacityRef = getProblemStatementCapacityRef(adminDb);
  const capacityDoc = await capacityRef.get();

  const raw = capacityDoc.exists ? capacityDoc.data() || {} : {};
  const counts = raw?.counts && typeof raw.counts === "object" ? raw.counts : {};
  const value = Number(counts[problemId]);

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

async function main() {
  const flags = parseCliFlags();
  const baseUrl = resolveBaseUrl(flags);
  const apiKey = resolveApiKey(flags);

  assertCondition(apiKey, "Missing Firebase Web API key. Pass --api-key or set NEXT_PUBLIC_FIREBASE_API_KEY.");
  assertLiveMutationAllowed(flags, baseUrl);

  const catalog = getProblemStatementCatalog();
  const problemId = getStringFlag(flags, "problem-id", getDefaultProblemId()).toUpperCase();
  const allowUnknownProblemId = getBooleanFlag(flags, "allow-unknown-problem-id", false);
  const problemExists = catalog.some((item) => asTrimmedString(item.id).toUpperCase() === problemId);
  if (!allowUnknownProblemId) {
    assertCondition(problemExists, `problem_id '${problemId}' was not found in catalog.`);
  }

  const releaseOffsetSeconds = getNumberFlag(flags, "release-offset-seconds", -180);
  const freezeDurationMinutes = getNumberFlag(flags, "freeze-duration-minutes", 30);
  const actorEmail = getStringFlag(flags, "actor-email", "runtime-script@local");
  const forceSheetSync = getBooleanFlag(flags, "force-sheet-sync", true);
  const requireSheetSynced = getBooleanFlag(flags, "require-sheet-synced", false);

  const controlsSnapshot = await readEventControlsRawSnapshot();
  const capacitySnapshot = await readCapacityRawSnapshot();
  const maxTeams = readMaxTeamsPerProblem(capacitySnapshot);

  const identityA = createDisposableIdentity("ps-race", "a");
  const identityB = createDisposableIdentity("ps-race", "b");

  const createdSheetEventIds = [];

  try {
    const currentControls = await readNormalizedEventControls();
    const liveControls = buildLiveWindowControls(currentControls, {
      releaseOffsetSeconds,
      freezeDurationMinutes,
    });

    await writeEventControlsWithVersion(liveControls, actorEmail);

    await Promise.all([
      createTeamLeadFixture(identityA, {
        displayIndex: 1,
        teamName: "Race Team A",
        leadName: "Race Lead A",
        leadPhone: "9110002001",
      }),
      createTeamLeadFixture(identityB, {
        displayIndex: 2,
        teamName: "Race Team B",
        leadName: "Race Lead B",
        leadPhone: "9110002002",
      }),
    ]);

    const [idTokenA, idTokenB] = await Promise.all([
      createRuntimeIdToken({
        apiKey,
        uid: identityA.uid,
        claims: {
          role: "TEAM_LEAD",
          email: identityA.email,
        },
      }),
      createRuntimeIdToken({
        apiKey,
        uid: identityB.uid,
        claims: {
          role: "TEAM_LEAD",
          email: identityB.email,
        },
      }),
    ]);

    const baselineCount = getProblemCountFromSnapshot(capacitySnapshot, problemId);
    const preRaceCount = Math.max(0, maxTeams - 1);

    await updateCapacityCount(problemId, preRaceCount, maxTeams);

    const runSelection = async (idToken, teamId) => {
      const response = await fetchJson(`${baseUrl}/api/team/problem-selection`, {
        method: "POST",
        idToken,
        body: {
          problem_id: problemId,
        },
        expectedStatuses: [200, 409],
      });

      return {
        teamId,
        status: response.status,
        body: response.json || {},
      };
    };

    const [resultA, resultB] = await Promise.all([
      runSelection(idTokenA, identityA.teamId),
      runSelection(idTokenB, identityB.teamId),
    ]);

    const results = [resultA, resultB];
    const successResults = results.filter((item) => item.status === 200);
    const conflictResults = results.filter((item) => item.status === 409);

    assertCondition(successResults.length === 1, `Expected exactly one winner, got ${successResults.length}.`);
    assertCondition(conflictResults.length === 1, `Expected exactly one conflict, got ${conflictResults.length}.`);

    const winner = successResults[0];
    const loser = conflictResults[0];

    assertCondition(
      asTrimmedString(winner?.body?.selected_problem?.problem_id).toUpperCase() === problemId,
      "Winning response does not contain expected problem_id."
    );

    assertCondition(
      /limit|already reached|full/i.test(asTrimmedString(loser?.body?.error)),
      "Conflict response did not indicate capacity/full condition."
    );

    const afterRaceCount = await readCapacityCount(problemId);
    assertCondition(
      afterRaceCount === preRaceCount + 1,
      `Post-race capacity mismatch. Expected ${preRaceCount + 1}, got ${afterRaceCount}.`
    );

    const [selectionA, selectionB] = await Promise.all([
      adminDb.collection("team_problem_selection").doc(identityA.teamId).get(),
      adminDb.collection("team_problem_selection").doc(identityB.teamId).get(),
    ]);

    const selectionDocs = [selectionA, selectionB].filter((doc) => doc.exists);
    assertCondition(selectionDocs.length === 1, `Expected one selection document, found ${selectionDocs.length}.`);

    const selectedTeamId = selectionDocs[0].id;
    assertCondition(
      [identityA.teamId, identityB.teamId].includes(selectedTeamId),
      "Selected team id does not match race contenders."
    );

    const winnerEventId = asTrimmedString(winner?.body?.team_sheet_export_event_id);
    if (winnerEventId) {
      createdSheetEventIds.push(winnerEventId);

      if (forceSheetSync) {
        const sheetSyncResult = await attemptTeamSheetExportSync({
          eventId: winnerEventId,
          force: true,
        });

        console.log(
          `sheet_sync_attempt success=${sheetSyncResult?.success === true} skipped=${
            sheetSyncResult?.skipped === true
          } reason=${asTrimmedString(sheetSyncResult?.reason || "")} error=${asTrimmedString(
            sheetSyncResult?.error || ""
          )}`
        );
      }

      const eventDoc = await adminDb
        .collection(TEAM_SHEET_EXPORT_EVENTS_COLLECTION)
        .doc(winnerEventId)
        .get();

      assertCondition(eventDoc.exists, "Expected winner sheet export event to exist.");
      const eventStatus = asTrimmedString(eventDoc.data()?.sheet_sync?.status || "UNKNOWN").toUpperCase();
      const eventRange = asTrimmedString(eventDoc.data()?.sheet_sync?.target_range || "");

      console.log(`winner_sheet_event_id=${winnerEventId} status=${eventStatus} range=${eventRange || "N/A"}`);

      if (requireSheetSynced) {
        assertCondition(
          eventStatus === "SYNCED",
          `Expected winner sheet sync status SYNCED but got ${eventStatus}.`
        );
      }
    }

    console.log(
      `race_status=ok base_url=${baseUrl} problem_id=${problemId} baseline_count=${baselineCount} pre_race_count=${preRaceCount} final_count=${afterRaceCount} winner_team_id=${winner.teamId}`
    );
  } finally {
    await Promise.allSettled(
      createdSheetEventIds.map((eventId) =>
        adminDb.collection(TEAM_SHEET_EXPORT_EVENTS_COLLECTION).doc(eventId).delete()
      )
    );

    await Promise.allSettled([
      deleteTeamLeadFixture(identityA),
      deleteTeamLeadFixture(identityB),
      restoreCapacityRawSnapshot(capacitySnapshot),
      restoreEventControlsRawSnapshot(controlsSnapshot),
    ]);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(`Problem selection race test failed: ${error.message}`);
    process.exit(1);
  });
