import { NextResponse } from "next/server";
import { adminDb } from "../../../../../firebaseAdmin";
import {
  EVENT_CONTROLS_COLLECTION,
  EVENT_CONTROLS_DOC_ID,
  EVENT_TIME_ZONE,
  EVENT_TIME_ZONE_LABEL,
  buildDefaultEventControls,
  buildPublicEventState,
  getEventControlImplementationStatus,
  normalizeStoredEventControls,
} from "../../../../../lib/server/event-controls";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

async function readEventControls() {
  const controlsRef = adminDb
    .collection(EVENT_CONTROLS_COLLECTION)
    .doc(EVENT_CONTROLS_DOC_ID);

  const controlsDoc = await controlsRef.get();
  if (!controlsDoc.exists) {
    return buildDefaultEventControls();
  }

  return normalizeStoredEventControls(controlsDoc.data());
}

export async function GET() {
  try {
    const controls = await readEventControls();
    const effectiveState = buildPublicEventState(controls);

    return NextResponse.json({
      success: true,
      eventState: effectiveState,
      timezone: EVENT_TIME_ZONE,
      timezoneLabel: EVENT_TIME_ZONE_LABEL,
      implementation: getEventControlImplementationStatus(),
    });
  } catch (error) {
    console.error("Failed to load public event state:", error);
    return NextResponse.json(
      { error: "Failed to load event state." },
      { status: 500 }
    );
  }
}