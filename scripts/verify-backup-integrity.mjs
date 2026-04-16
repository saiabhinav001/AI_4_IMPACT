import fs from "node:fs";
import path from "node:path";
import {
  parseCliArgs,
  sha256ForBuffer,
} from "./_backup-utils.mjs";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findManifestFiles(backupDir, explicitManifestPath) {
  if (explicitManifestPath) {
    return [path.resolve(process.cwd(), explicitManifestPath)];
  }

  if (!fs.existsSync(backupDir)) {
    return [];
  }

  const fileNames = fs.readdirSync(backupDir).filter((fileName) => fileName.endsWith(".manifest.json"));
  fileNames.sort((a, b) => a.localeCompare(b));
  return fileNames.map((fileName) => path.join(backupDir, fileName));
}

function verifyManifest(manifestPath) {
  const manifest = readJson(manifestPath);
  const manifestDir = path.dirname(manifestPath);
  const relativeBackupFile = String(manifest?.backup?.file || "").trim();
  const expectedSha = String(manifest?.backup?.sha256 || "").trim().toLowerCase();

  if (!relativeBackupFile || !expectedSha) {
    return {
      ok: false,
      manifestPath,
      reason: "Manifest is missing backup.file or backup.sha256.",
    };
  }

  const backupPath = path.resolve(manifestDir, relativeBackupFile);
  if (!fs.existsSync(backupPath)) {
    return {
      ok: false,
      manifestPath,
      backupPath,
      reason: "Backup file not found.",
    };
  }

  const buffer = fs.readFileSync(backupPath);
  const actualSha = sha256ForBuffer(buffer).toLowerCase();
  if (actualSha !== expectedSha) {
    return {
      ok: false,
      manifestPath,
      backupPath,
      reason: "SHA256 mismatch.",
      expectedSha,
      actualSha,
    };
  }

  try {
    JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    return {
      ok: false,
      manifestPath,
      backupPath,
      reason: `Backup JSON parse failed: ${error.message || String(error)}`,
    };
  }

  return {
    ok: true,
    manifestPath,
    backupPath,
    sha256: actualSha,
  };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const explicitManifest = String(args.manifest || "").trim();
  const backupDir = path.join(process.cwd(), "scripts", "output", "backups");

  const manifests = findManifestFiles(backupDir, explicitManifest);
  if (manifests.length === 0) {
    throw new Error("No backup manifest files found to verify.");
  }

  let failureCount = 0;
  for (const manifestPath of manifests) {
    const result = verifyManifest(manifestPath);
    if (!result.ok) {
      failureCount += 1;
      console.error(`FAIL ${path.relative(process.cwd(), manifestPath)} :: ${result.reason}`);
      if (result.backupPath) {
        console.error(`  backup=${path.relative(process.cwd(), result.backupPath)}`);
      }
      if (result.expectedSha && result.actualSha) {
        console.error(`  expected=${result.expectedSha}`);
        console.error(`  actual=${result.actualSha}`);
      }
      continue;
    }

    console.log(`PASS ${path.relative(process.cwd(), manifestPath)} -> ${path.relative(process.cwd(), result.backupPath)}`);
  }

  if (failureCount > 0) {
    throw new Error(`Integrity check failed for ${failureCount} manifest file(s).`);
  }

  console.log(`Integrity check passed for ${manifests.length} manifest file(s).`);
}

main().catch((error) => {
  console.error("Backup integrity verification failed:", error.message || String(error));
  process.exit(1);
});
