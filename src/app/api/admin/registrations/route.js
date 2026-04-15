import { NextResponse } from "next/server";
import { requireAdmin } from "../_utils/auth";
import { getServerFeatureFlags } from "../../../../../lib/server/feature-flags";
import { readThroughRuntimeCache } from "../../../../../lib/server/runtime-cache";
import { ADMIN_REGISTRATIONS_CACHE_PREFIX } from "../../../../../lib/server/runtime-cache-keys";
import { loadAdminRegistrationsPayload } from "../../../../../lib/server/admin-read-model.js";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["workshop", "hackathon"]);
const ALLOWED_STATUSES = new Set(["pending", "verified", "rejected"]);
const ENV = globalThis?.process?.env || {};
const ADMIN_REGISTRATIONS_CACHE_TTL_MS = Number(
  ENV.ADMIN_REGISTRATIONS_CACHE_TTL_MS || 300000
);

function asTrimmedString(value) {
  return String(value || "").trim();
}

function toPositiveInteger(value, fallbackValue) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallbackValue;
  }

  return Math.floor(numeric);
}

function toOptionalPositiveInteger(value) {
  const normalized = asTrimmedString(value);
  if (!normalized) {
    return null;
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.floor(numeric);
}

function toCacheSegment(value, fallbackValue = "all") {
  const normalized = asTrimmedString(value).toLowerCase();
  return normalized || fallbackValue;
}

function badRequest(error) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function GET(request) {
  const authResult = await requireAdmin(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const limit = toOptionalPositiveInteger(searchParams.get("limit"));
    const cursor = asTrimmedString(searchParams.get("cursor"));

    if (type && !ALLOWED_TYPES.has(type)) {
      return badRequest("type must be workshop or hackathon.");
    }

    if (status && !ALLOWED_STATUSES.has(status)) {
      return badRequest("status must be pending, verified, or rejected.");
    }

    if (limit !== null && limit > 500) {
      return badRequest("limit must be less than or equal to 500.");
    }

    const bypassCache =
      asTrimmedString(searchParams.get("fresh")) === "1" ||
      asTrimmedString(request.headers.get("x-admin-bypass-cache")) === "1" ||
      asTrimmedString(request.headers.get("x-admin-cache-bypass")) === "1";

    const serverFlags = getServerFeatureFlags();
    const cacheEnabled = serverFlags.adminRegistrationsCacheEnabled !== false;
    const preferReadModel = serverFlags.adminReadModelEnabled === true;
    const cacheTtlMs = toPositiveInteger(ADMIN_REGISTRATIONS_CACHE_TTL_MS, 45000);
    const cacheKey = `${ADMIN_REGISTRATIONS_CACHE_PREFIX}:${toCacheSegment(type)}:${toCacheSegment(
      status
    )}:${toCacheSegment(limit === null ? "all" : String(limit))}:${toCacheSegment(
      cursor || "start"
    )}`;

    const cacheResult = await readThroughRuntimeCache({
      cacheKey,
      ttlMs: cacheTtlMs,
      bypass: !cacheEnabled || bypassCache,
      loader: async () => {
        const loaded = await loadAdminRegistrationsPayload({
          type,
          status,
          preferReadModel,
          limit,
          cursor: cursor || null,
        });

        return {
          ...loaded.payload,
          _meta: {
            source: loaded.source,
          },
        };
      },
    });

    const payload = cacheResult.payload || { success: true, registrations: [] };
    const responseBody = {
      success: payload.success === true,
      registrations: Array.isArray(payload.registrations) ? payload.registrations : [],
      pagination:
        payload && typeof payload.pagination === "object" && payload.pagination
          ? payload.pagination
          : null,
    };

    const response = NextResponse.json(responseBody);
    response.headers.set(
      "x-runtime-cache",
      cacheResult.cacheHit ? "HIT" : cacheResult.coalesced ? "COALESCED" : "MISS"
    );
    response.headers.set(
      "x-admin-data-source",
      asTrimmedString(payload?._meta?.source) || "source"
    );
    return response;
  } catch (error) {
    console.error("Failed to load admin registrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch registrations." },
      { status: 500 }
    );
  }
}
