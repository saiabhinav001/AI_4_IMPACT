import { NextResponse } from "next/server";
import { adminDb, FieldValue } from "../../../../../firebaseAdmin";
import {
  EVENT_CONTROLS_COLLECTION,
  EVENT_CONTROLS_DOC_ID,
  EVENT_TIME_ZONE,
  EVENT_TIME_ZONE_LABEL,
  buildDefaultEventControls,
  buildPublicEventState,
  getEventControlImplementationStatus,
  mergeEventControlsInput,
  normalizeStoredEventControls,
  validateEventControls,
} from "../../../../../lib/server/event-controls";
import { requireAdmin } from "../_utils/auth";
import { invalidatePublicEventStateCache } from "../_utils/runtime-cache-invalidation";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

const AUDIT_COLLECTION = "admin_audit_logs";

function asTrimmedString(value) {
  return String(value || "").trim();
}

function badRequest(error, details = []) {
  return NextResponse.json(
    {
      error,
      details,
    },
    { status: 400 }
  );
}

async function readEventControls() {
  const controlsRef = adminDb
    .collection(EVENT_CONTROLS_COLLECTION)
    .doc(EVENT_CONTROLS_DOC_ID);

  const controlsDoc = await controlsRef.get();
  if (!controlsDoc.exists) {
    return {
      ref: controlsRef,
      controls: buildDefaultEventControls(),
    };
  }

  return {
    ref: controlsRef,
    controls: normalizeStoredEventControls(controlsDoc.data()),
  };
}

export async function GET(request) {
  const authResult = await requireAdmin(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { controls } = await readEventControls();

    return NextResponse.json({
      success: true,
      controls,
      effectiveState: buildPublicEventState(controls),
      timezone: EVENT_TIME_ZONE,
      timezoneLabel: EVENT_TIME_ZONE_LABEL,
      implementation: getEventControlImplementationStatus(),
    });
  } catch (error) {
    console.error("Failed to read event controls:", error);
    return NextResponse.json(
      { error: "Failed to load event controls." },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  const authResult = await requireAdmin(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const incomingControls = body?.controls;

    if (!incomingControls || typeof incomingControls !== "object") {
      return badRequest("controls payload is required.");
    }

    const { ref: controlsRef, controls: currentControls } = await readEventControls();

    let mergedControls;
    try {
      mergedControls = mergeEventControlsInput(incomingControls, currentControls);
    } catch (error) {
      return badRequest(error?.message || "Invalid event control payload.");
    }

    const validationErrors = validateEventControls(mergedControls);
    if (validationErrors.length > 0) {
      return badRequest("Event controls validation failed.", validationErrors);
    }

    const actorUid = asTrimmedString(authResult?.decodedToken?.uid);
    const actorEmail = asTrimmedString(authResult?.decodedToken?.email).toLowerCase();
    const nextVersion =
      Math.max(0, Number(currentControls?.metadata?.version || 0)) + 1;

    const controlsToStore = {
      ...mergedControls,
      metadata: {
        ...mergedControls.metadata,
        version: nextVersion,
        updatedByUid: actorUid,
        updatedByEmail: actorEmail,
        updatedAt: FieldValue.serverTimestamp(),
      },
    };

    await controlsRef.set(controlsToStore, { merge: false });

    const controlsAfterWriteDoc = await controlsRef.get();
    const controlsAfterWrite = controlsAfterWriteDoc.exists
      ? normalizeStoredEventControls(controlsAfterWriteDoc.data())
      : normalizeStoredEventControls(controlsToStore);

    try {
      await adminDb.collection(AUDIT_COLLECTION).add({
        action: "EVENT_CONTROLS_UPDATED",
        target: `${EVENT_CONTROLS_COLLECTION}/${EVENT_CONTROLS_DOC_ID}`,
        actor_uid: actorUid || null,
        actor_email: actorEmail || null,
        before: currentControls,
        after: controlsAfterWrite,
        created_at: FieldValue.serverTimestamp(),
      });
    } catch (auditError) {
      console.error("Failed to write event controls audit log:", auditError);
    }

    invalidatePublicEventStateCache();

    return NextResponse.json({
      success: true,
      controls: controlsAfterWrite,
      effectiveState: buildPublicEventState(controlsAfterWrite),
      timezone: EVENT_TIME_ZONE,
      timezoneLabel: EVENT_TIME_ZONE_LABEL,
      implementation: getEventControlImplementationStatus(),
    });
  } catch (error) {
    console.error("Failed to update event controls:", error);
    return NextResponse.json(
      { error: "Failed to update event controls." },
      { status: 500 }
    );
  }
}