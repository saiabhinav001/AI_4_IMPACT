import path from "node:path";
import {
  ensureDirectory,
  fileTimestamp,
  loadStandardEnv,
  parseCliArgs,
  writeJsonFileWithHash,
} from "./_backup-utils.mjs";

function asTrimmedString(value) {
  return String(value || "").trim();
}

function parseBoolean(value, fallbackValue = false) {
  const normalized = asTrimmedString(value).toLowerCase();
  if (!normalized) {
    return fallbackValue;
  }

  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off", "disabled"].includes(normalized)) {
    return false;
  }

  return fallbackValue;
}

function parseNonNegativeInteger(value, fallbackValue = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallbackValue;
  }

  return Math.floor(numeric);
}

function deepSort(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => deepSort(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sortedKeys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  const output = {};

  for (const key of sortedKeys) {
    output[key] = deepSort(value[key]);
  }

  return output;
}

function toStableJson(value) {
  return JSON.stringify(deepSort(value));
}

function toItemMap(items) {
  const map = new Map();

  for (const item of items) {
    const transactionId = asTrimmedString(item?.transaction_id);
    if (!transactionId) {
      continue;
    }

    map.set(transactionId, item);
  }

  return map;
}

function diffCollections({ sourceMap, readModelMap, maxDiffItems }) {
  const differences = [];

  for (const [transactionId, sourceItem] of sourceMap.entries()) {
    const readModelItem = readModelMap.get(transactionId);

    if (!readModelItem) {
      differences.push({
        kind: "missing_in_read_model",
        transaction_id: transactionId,
      });
      if (differences.length >= maxDiffItems) {
        return differences;
      }
      continue;
    }

    if (toStableJson(sourceItem) !== toStableJson(readModelItem)) {
      differences.push({
        kind: "payload_mismatch",
        transaction_id: transactionId,
      });
      if (differences.length >= maxDiffItems) {
        return differences;
      }
    }
  }

  for (const [transactionId] of readModelMap.entries()) {
    if (sourceMap.has(transactionId)) {
      continue;
    }

    differences.push({
      kind: "extra_in_read_model",
      transaction_id: transactionId,
    });

    if (differences.length >= maxDiffItems) {
      return differences;
    }
  }

  return differences;
}

async function main() {
  loadStandardEnv();

  const args = parseCliArgs(process.argv.slice(2));
  const type = asTrimmedString(args.type) || null;
  const status = asTrimmedString(args.status) || null;
  const limit = parseNonNegativeInteger(args.limit, 0);
  const maxDiffItems = Math.max(10, parseNonNegativeInteger(args["max-diff-items"], 500));
  const writeReport = parseBoolean(args["write-report"], true);
  const failOnMismatch = parseBoolean(args["fail-on-mismatch"], false);

  const {
    ADMIN_READ_MODEL_COLLECTION,
    buildAdminRegistrationsPayloadFromSource,
    readAdminRegistrationsPayloadFromReadModel,
  } = await import("../lib/server/admin-read-model.js");

  const sourcePayload = await buildAdminRegistrationsPayloadFromSource({ type, status });
  const readModelPayload = await readAdminRegistrationsPayloadFromReadModel({ type, status });

  const sourceRegistrations = Array.isArray(sourcePayload?.registrations)
    ? sourcePayload.registrations
    : [];
  const readModelRegistrations = Array.isArray(readModelPayload?.registrations)
    ? readModelPayload.registrations
    : [];

  const sourceSubset = limit > 0 ? sourceRegistrations.slice(0, limit) : sourceRegistrations;
  const sourceMap = toItemMap(sourceSubset);
  const sourceIds = new Set(sourceMap.keys());

  const filteredReadModel = readModelRegistrations.filter((item) => {
    if (limit <= 0) {
      return true;
    }

    const transactionId = asTrimmedString(item?.transaction_id);
    return sourceIds.has(transactionId);
  });

  const readModelMap = toItemMap(filteredReadModel);

  const differences = diffCollections({
    sourceMap,
    readModelMap,
    maxDiffItems,
  });

  const summary = {
    checked_at: new Date().toISOString(),
    filters: {
      type,
      status,
      limit: limit > 0 ? limit : null,
    },
    source_count: sourceMap.size,
    read_model_count: readModelMap.size,
    mismatch_count: differences.length,
    parity_ok: differences.length === 0,
    read_model_collection: ADMIN_READ_MODEL_COLLECTION,
  };

  const report = {
    summary,
    differences,
  };

  if (writeReport) {
    const outputDir = path.join(process.cwd(), "scripts", "output", "read-model");
    ensureDirectory(outputDir);

    const timestamp = fileTimestamp();
    const reportFileName = `admin-read-model-parity-${timestamp}.json`;
    const reportPath = path.join(outputDir, reportFileName);
    const reportWrite = writeJsonFileWithHash(reportPath, report);

    const manifestPath = path.join(outputDir, `admin-read-model-parity-${timestamp}.manifest.json`);
    writeJsonFileWithHash(manifestPath, {
      generatedAt: new Date().toISOString(),
      kind: "admin-read-model-parity-manifest",
      report: {
        file: reportFileName,
        sha256: reportWrite.sha256,
        bytes: reportWrite.bytes,
      },
      summary,
    });

    console.log(`Parity report written: ${path.relative(process.cwd(), reportPath)}`);
  }

  console.log(`Source checked: ${summary.source_count}`);
  console.log(`Read model checked: ${summary.read_model_count}`);
  console.log(`Mismatch count: ${summary.mismatch_count}`);
  console.log(`Parity OK: ${summary.parity_ok}`);

  if (failOnMismatch && summary.mismatch_count > 0) {
    throw new Error(`Detected ${summary.mismatch_count} parity mismatches.`);
  }
}

main().catch((error) => {
  console.error("Admin read model parity verification failed:", error?.message || String(error));
  process.exit(1);
});
