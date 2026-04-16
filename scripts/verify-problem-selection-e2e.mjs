import {
  TEAM_SHEET_EXPORT_EVENTS_COLLECTION,
  attemptTeamSheetExportSync,
} from "../src/app/api/admin/_utils/team-sheet-export.js";
import { adminDb } from "../firebaseAdmin.js";
import {
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
  writeEventControlsWithVersion,
} from "./_problem-selection-test-utils.mjs";

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitMs(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

  const identity = createDisposableIdentity("ps-e2e", "solo");
  let exportedEventId = "";

  try {
    console.log(`e2e_fixture_team_id=${identity.teamId} e2e_fixture_email=${identity.email}`);

    const currentControls = await readNormalizedEventControls();
    const liveControls = buildLiveWindowControls(currentControls, {
      releaseOffsetSeconds,
      freezeDurationMinutes,
    });

    await writeEventControlsWithVersion(liveControls, actorEmail);

    await createTeamLeadFixture(identity, {
      displayIndex: 1,
      teamName: "Runtime E2E Team",
      leadName: "Runtime E2E Lead",
      leadPhone: "9110001001",
    });

    const idToken = await createRuntimeIdToken({
      apiKey,
      uid: identity.uid,
      claims: {
        role: "TEAM_LEAD",
        email: identity.email,
      },
    });

    let beforeDashboard = await fetchJson(`${baseUrl}/api/team/dashboard`, {
      method: "GET",
      idToken,
      expectedStatuses: [200],
    });

    assertCondition(beforeDashboard?.json?.success === true, "Initial dashboard call did not return success=true.");

    let beforeProblemList = Array.isArray(beforeDashboard?.json?.dashboard?.problem_statements)
      ? beforeDashboard.json.dashboard.problem_statements
      : [];

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const problemStatus = asTrimmedString(
        beforeDashboard?.json?.dashboard?.event_controls?.problem_statements?.status
      ).toUpperCase();

      const hasProblem = beforeProblemList.some(
        (item) => asTrimmedString(item?.problem_id).toUpperCase() === problemId
      );

      if (hasProblem) {
        break;
      }

      if (problemStatus === "LIVE") {
        break;
      }

      await waitMs(2500);
      beforeDashboard = await fetchJson(`${baseUrl}/api/team/dashboard`, {
        method: "GET",
        idToken,
        expectedStatuses: [200],
      });

      beforeProblemList = Array.isArray(beforeDashboard?.json?.dashboard?.problem_statements)
        ? beforeDashboard.json.dashboard.problem_statements
        : [];
    }

    const beforeProblemIds = beforeProblemList.map((item) =>
      asTrimmedString(item?.problem_id).toUpperCase()
    );

    assertCondition(
      beforeProblemIds.includes(problemId),
      `Problem '${problemId}' was not visible in dashboard list. Available: ${beforeProblemIds.join(", ") || "none"}`
    );

    const beforeSelectedProblem = beforeDashboard?.json?.dashboard?.selected_problem;
    assertCondition(
      !beforeSelectedProblem?.problem_id,
      "Expected no selected problem before selection call."
    );

    const baselineCount = getProblemCountFromSnapshot(capacitySnapshot, problemId);

    const selectResponse = await fetchJson(`${baseUrl}/api/team/problem-selection`, {
      method: "POST",
      idToken,
      body: {
        problem_id: problemId,
      },
      expectedStatuses: [200],
    });

    console.log(`selection_first_status=${selectResponse.status}`);

    assertCondition(selectResponse?.json?.success === true, "Problem selection API did not return success=true.");
    assertCondition(
      asTrimmedString(selectResponse?.json?.selected_problem?.problem_id).toUpperCase() === problemId,
      "Selected problem id in API response does not match requested problem."
    );

    exportedEventId = asTrimmedString(selectResponse?.json?.team_sheet_export_event_id);

    const afterDashboard = await fetchJson(`${baseUrl}/api/team/dashboard`, {
      method: "GET",
      idToken,
      expectedStatuses: [200],
    });

    const afterSelectedProblem = afterDashboard?.json?.dashboard?.selected_problem || {};
    assertCondition(
      asTrimmedString(afterSelectedProblem.problem_id).toUpperCase() === problemId,
      "Dashboard did not persist selected problem after selection."
    );

    const secondSelection = await fetchJson(`${baseUrl}/api/team/problem-selection`, {
      method: "POST",
      idToken,
      body: {
        problem_id: problemId,
      },
      expectedStatuses: [200, 409],
    });

    console.log(`selection_second_status=${secondSelection.status}`);

    assertCondition(
      secondSelection.status === 409,
      `Second selection status expected 409 but got ${secondSelection.status}. Body: ${JSON.stringify(
        secondSelection.json || {}
      )}`
    );

    assertCondition(
      /already selected/i.test(asTrimmedString(secondSelection?.json?.error)),
      "Second selection did not return expected conflict message."
    );

    const updatedCount = await readCapacityCount(problemId);
    assertCondition(
      updatedCount === baselineCount + 1,
      `Capacity count mismatch for ${problemId}. Expected ${baselineCount + 1}, got ${updatedCount}.`
    );

    const selectionDoc = await adminDb
      .collection("team_problem_selection")
      .doc(identity.teamId)
      .get();

    assertCondition(selectionDoc.exists, "team_problem_selection document was not created.");

    if (exportedEventId) {
      const sheetEventRef = adminDb
        .collection(TEAM_SHEET_EXPORT_EVENTS_COLLECTION)
        .doc(exportedEventId);

      const initialSheetEvent = await sheetEventRef.get();
      assertCondition(initialSheetEvent.exists, "Team sheet export event document was not created.");

      if (forceSheetSync) {
        const sheetSyncResult = await attemptTeamSheetExportSync({
          eventId: exportedEventId,
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

      const finalSheetEvent = await sheetEventRef.get();
      const sheetStatus = asTrimmedString(finalSheetEvent.data()?.sheet_sync?.status || "UNKNOWN").toUpperCase();
      const sheetTargetRange = asTrimmedString(finalSheetEvent.data()?.sheet_sync?.target_range || "");

      console.log(`sheet_event_id=${exportedEventId} sheet_status=${sheetStatus} sheet_target_range=${sheetTargetRange || "N/A"}`);

      if (requireSheetSynced) {
        assertCondition(
          sheetStatus === "SYNCED",
          `Expected sheet sync status SYNCED but got ${sheetStatus}.`
        );
      }
    }

    console.log(`e2e_status=ok base_url=${baseUrl} problem_id=${problemId} team_id=${identity.teamId}`);
  } finally {
    if (exportedEventId) {
      await Promise.allSettled([
        adminDb.collection(TEAM_SHEET_EXPORT_EVENTS_COLLECTION).doc(exportedEventId).delete(),
      ]);
    }

    await Promise.allSettled([
      deleteTeamLeadFixture(identity),
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
    console.error(`Problem selection E2E verification failed: ${error.message}`);
    process.exit(1);
  });
