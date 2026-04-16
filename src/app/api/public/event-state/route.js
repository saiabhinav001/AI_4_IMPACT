import { NextResponse } from "next/server";
import { adminDb } from "../../../../../firebaseAdmin";
import { getServerFeatureFlags } from "../../../../../lib/server/feature-flags";
import { readThroughRuntimeCache } from "../../../../../lib/server/runtime-cache";
import { PUBLIC_EVENT_STATE_CACHE_KEY } from "../../../../../lib/server/runtime-cache-keys";
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
const ENV = globalThis?.process?.env || {};
const PUBLIC_EVENT_STATE_CACHE_TTL_MS = Number(ENV.PUBLIC_EVENT_STATE_CACHE_TTL_MS || 15000);

function toPositiveInteger(value, fallbackValue) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallbackValue;
  }

  return Math.floor(numeric);
}

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
    const serverFlags = getServerFeatureFlags();
    const cacheEnabled = serverFlags.publicEventStateCacheEnabled !== false;
    const cacheTtlMs = toPositiveInteger(PUBLIC_EVENT_STATE_CACHE_TTL_MS, 15000);

    const cacheResult = await readThroughRuntimeCache({
      cacheKey: PUBLIC_EVENT_STATE_CACHE_KEY,
      ttlMs: cacheTtlMs,
      bypass: !cacheEnabled,
      loader: async () => {
        const controls = await readEventControls();
        const effectiveState = buildPublicEventState(controls);

        return {
          success: true,
          eventState: effectiveState,
          timezone: EVENT_TIME_ZONE,
          timezoneLabel: EVENT_TIME_ZONE_LABEL,
          implementation: getEventControlImplementationStatus(),
        };
      },
    });

    const response = NextResponse.json(cacheResult.payload);
    response.headers.set(
      "x-runtime-cache",
      cacheResult.cacheHit ? "HIT" : cacheResult.coalesced ? "COALESCED" : "MISS"
    );
    response.headers.set("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
    return response;
  } catch (error) {
    console.error("Failed to load public event state:", error);
    return NextResponse.json(
      { error: "Failed to load event state." },
      { status: 500 }
    );
  }
}