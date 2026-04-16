import {
  EVENT_CONTROLS_COLLECTION,
  EVENT_CONTROLS_DOC_ID,
  buildDefaultEventControls,
  buildRegistrationGateResult,
  normalizeStoredEventControls,
} from "./event-controls";

export async function readEventControlsFromDb(adminDb) {
  const controlsRef = adminDb
    .collection(EVENT_CONTROLS_COLLECTION)
    .doc(EVENT_CONTROLS_DOC_ID);

  const controlsDoc = await controlsRef.get();
  if (!controlsDoc.exists) {
    return buildDefaultEventControls();
  }

  return normalizeStoredEventControls(controlsDoc.data());
}

export async function resolveRegistrationGate(adminDb, track) {
  const controls = await readEventControlsFromDb(adminDb);
  return buildRegistrationGateResult(controls, track);
}
