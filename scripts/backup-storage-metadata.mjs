import path from "node:path";
import {
  ensureDirectory,
  fileTimestamp,
  initAdminContext,
  parseCliArgs,
  writeJsonFileWithHash,
} from "./_backup-utils.mjs";

function toSafeInteger(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return Math.floor(numeric);
}

function buildMetadataEntry(fileObject) {
  const metadata = fileObject?.metadata || {};

  return {
    name: String(fileObject?.name || "").trim(),
    bucket: String(metadata?.bucket || "").trim(),
    sizeBytes: toSafeInteger(metadata?.size),
    contentType: String(metadata?.contentType || "").trim(),
    cacheControl: String(metadata?.cacheControl || "").trim(),
    contentDisposition: String(metadata?.contentDisposition || "").trim(),
    md5Hash: String(metadata?.md5Hash || "").trim(),
    crc32c: String(metadata?.crc32c || "").trim(),
    timeCreated: String(metadata?.timeCreated || "").trim() || null,
    updated: String(metadata?.updated || "").trim() || null,
    metadata: metadata?.metadata && typeof metadata.metadata === "object" ? metadata.metadata : {},
  };
}

async function listFilesByPrefix(bucket, prefix) {
  const allFiles = [];
  let pageToken;

  do {
    const [files, nextQuery] = await bucket.getFiles({
      prefix,
      autoPaginate: false,
      maxResults: 1000,
      pageToken,
    });

    allFiles.push(...files);
    pageToken = nextQuery?.pageToken || null;
  } while (pageToken);

  return allFiles;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const prefix = String(args.prefix || "payments/").trim();

  const { storage, projectId, storageBucket } = initAdminContext({ requireStorage: true });
  const outputDir = path.join(process.cwd(), "scripts", "output", "backups");
  ensureDirectory(outputDir);

  const files = await listFilesByPrefix(storage, prefix);
  const entries = files.map((fileObject) => buildMetadataEntry(fileObject));
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const totalBytes = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
  const timestamp = fileTimestamp();

  const backupFileName = `storage-metadata-backup-${timestamp}.json`;
  const backupPath = path.join(outputDir, backupFileName);

  const payload = {
    generatedAt: new Date().toISOString(),
    projectId,
    bucket: storageBucket,
    prefix,
    summary: {
      objectCount: entries.length,
      totalBytes,
    },
    objects: entries,
  };

  const backupWriteResult = writeJsonFileWithHash(backupPath, payload);

  const manifestFileName = `storage-metadata-backup-${timestamp}.manifest.json`;
  const manifestPath = path.join(outputDir, manifestFileName);
  const manifest = {
    generatedAt: new Date().toISOString(),
    kind: "storage-metadata-backup-manifest",
    projectId,
    bucket: storageBucket,
    prefix,
    backup: {
      file: backupFileName,
      sha256: backupWriteResult.sha256,
      bytes: backupWriteResult.bytes,
    },
    summary: payload.summary,
  };

  writeJsonFileWithHash(manifestPath, manifest);

  console.log(`Storage metadata backup written: ${path.relative(process.cwd(), backupPath)}`);
  console.log(`Manifest written: ${path.relative(process.cwd(), manifestPath)}`);
  console.log(`Objects exported: ${entries.length}`);
  console.log(`Total bytes listed: ${totalBytes}`);
}

main().catch((error) => {
  console.error("Storage metadata backup failed:", error.message || String(error));
  process.exit(1);
});
