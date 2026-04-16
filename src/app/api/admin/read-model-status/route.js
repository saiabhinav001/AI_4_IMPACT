import { NextResponse } from "next/server";
import { adminDb } from "../../../../../firebaseAdmin";
import { getServerFeatureFlags } from "../../../../../lib/server/feature-flags";
import { ADMIN_READ_MODEL_COLLECTION } from "../../../../../lib/server/admin-read-model.js";
import { requireAdmin } from "../_utils/auth";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

function toIsoString(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toEpochMs(value) {
  const date = new Date(String(value || "").trim());
  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return date.getTime();
}

function percent(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Number(value)));
}

async function countDocs(collectionRef) {
  try {
    const aggregate = await collectionRef.count().get();
    return Number(aggregate?.data()?.count || 0);
  } catch {
    const snapshot = await collectionRef.get();
    return snapshot.size;
  }
}

async function readLatestTransactionMeta() {
  const snapshot = await adminDb
    .collection("transactions")
    .orderBy("created_at", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    created_at: toIsoString(doc.get("created_at")),
    registration_type: doc.get("registration_type") || null,
    status: doc.get("status") || null,
  };
}

async function readLatestReadModelMeta() {
  const snapshot = await adminDb
    .collection(ADMIN_READ_MODEL_COLLECTION)
    .orderBy("created_at_epoch_ms", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data() || {};

  return {
    id: doc.id,
    transaction_id: data?.transaction_id || doc.id,
    created_at: data?.created_at || null,
    updated_at: toIsoString(data?.updated_at),
    read_model_version: Number(data?.read_model_version || 0),
  };
}

export async function GET(request) {
  const authResult = await requireAdmin(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const [sourceCount, readModelCount, sourceLatest, readModelLatest] = await Promise.all([
      countDocs(adminDb.collection("transactions")),
      countDocs(adminDb.collection(ADMIN_READ_MODEL_COLLECTION)),
      readLatestTransactionMeta(),
      readLatestReadModelMeta(),
    ]);

    const sourceLatestMs = toEpochMs(sourceLatest?.created_at);
    const readModelLatestMs = toEpochMs(readModelLatest?.created_at);
    const lagMs =
      sourceLatestMs > 0 && readModelLatestMs > 0
        ? Math.max(0, sourceLatestMs - readModelLatestMs)
        : null;

    const coveragePercent =
      sourceCount > 0 ? percent((readModelCount / sourceCount) * 100) : 100;

    const readyForCutover =
      sourceCount === 0 ||
      (coveragePercent >= 99.5 && (lagMs === null || lagMs <= 5 * 60 * 1000));

    const flags = getServerFeatureFlags();

    return NextResponse.json({
      success: true,
      collection: {
        source: "transactions",
        read_model: ADMIN_READ_MODEL_COLLECTION,
      },
      counts: {
        source: sourceCount,
        read_model: readModelCount,
      },
      coverage_percent: Number(coveragePercent.toFixed(2)),
      freshness: {
        lag_ms: lagMs,
        source_latest: sourceLatest,
        read_model_latest: readModelLatest,
      },
      readiness: {
        ready_for_cutover: readyForCutover,
      },
      flags: {
        admin_read_model_enabled: flags.adminReadModelEnabled === true,
        admin_registrations_cache_enabled: flags.adminRegistrationsCacheEnabled !== false,
      },
    });
  } catch (error) {
    console.error("Failed to load admin read model status:", error);
    return NextResponse.json(
      { error: "Failed to load admin read model status." },
      { status: 500 }
    );
  }
}
