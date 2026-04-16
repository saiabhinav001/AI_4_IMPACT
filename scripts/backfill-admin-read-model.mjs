import { loadStandardEnv, parseCliArgs } from "./_backup-utils.mjs";

function toSafeInteger(value, fallbackValue = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallbackValue;
  }

  return Math.floor(numeric);
}

async function clearReadModelCollection(adminDb, collectionName) {
  const snapshot = await adminDb.collection(collectionName).get();
  if (snapshot.empty) {
    return 0;
  }

  let deletedCount = 0;
  let batch = adminDb.batch();
  let batchOps = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    batchOps += 1;
    deletedCount += 1;

    if (batchOps >= 400) {
      await batch.commit();
      batch = adminDb.batch();
      batchOps = 0;
    }
  }

  if (batchOps > 0) {
    await batch.commit();
  }

  return deletedCount;
}

async function main() {
  loadStandardEnv();
  const args = parseCliArgs(process.argv.slice(2));
  const limit = toSafeInteger(args.limit, 0);
  const shouldReset = String(args.reset || "false").trim().toLowerCase() === "true";

  const { adminDb } = await import("../firebaseAdmin.js");
  const {
    ADMIN_READ_MODEL_COLLECTION,
    upsertAdminReadModelForTransaction,
  } = await import("../lib/server/admin-read-model.js");

  if (shouldReset) {
    const deleted = await clearReadModelCollection(adminDb, ADMIN_READ_MODEL_COLLECTION);
    console.log(`Cleared read model docs: ${deleted}`);
  }

  let query = adminDb.collection("transactions").orderBy("created_at", "desc");
  if (limit > 0) {
    query = query.limit(limit);
  }

  const snapshot = await query.get();
  if (snapshot.empty) {
    console.log("No transaction docs found. Nothing to backfill.");
    return;
  }

  let successCount = 0;
  let failureCount = 0;

  for (let index = 0; index < snapshot.docs.length; index += 1) {
    const doc = snapshot.docs[index];

    try {
      await upsertAdminReadModelForTransaction(doc.id);
      successCount += 1;
    } catch (error) {
      failureCount += 1;
      console.error(
        `Backfill failed for transaction ${doc.id}: ${error?.message || String(error)}`
      );
    }

    if ((index + 1) % 25 === 0 || index === snapshot.docs.length - 1) {
      console.log(
        `Processed ${index + 1}/${snapshot.docs.length} transactions (ok=${successCount}, failed=${failureCount})`
      );
    }
  }

  console.log("Admin read model backfill complete.");
  console.log(`Collection: ${ADMIN_READ_MODEL_COLLECTION}`);
  console.log(`Successful upserts: ${successCount}`);
  console.log(`Failures: ${failureCount}`);
}

main().catch((error) => {
  console.error("Admin read model backfill failed:", error?.message || String(error));
  process.exit(1);
});
