import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq < 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function required(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function main() {
  loadEnvFile(path.resolve(".env.local"));

  const projectId = required("FIREBASE_PROJECT_ID", process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID);
  const clientEmail = required("FIREBASE_CLIENT_EMAIL", process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
  const privateKeyRaw = required("FIREBASE_PRIVATE_KEY", process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  const keyPayload = {
    type: "service_account",
    project_id: projectId,
    private_key_id: "temporary",
    private_key: privateKey,
    client_email: clientEmail,
    client_id: "temporary",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`,
  };

  const tempFile = path.join(os.tmpdir(), `firebase-sa-${Date.now()}.json`);
  fs.writeFileSync(tempFile, JSON.stringify(keyPayload, null, 2), "utf8");

  try {
    const cmd = "npx";
    const result = spawnSync(
      cmd,
      [
        "firebase-tools",
        "deploy",
        "--only",
        "firestore:rules,firestore:indexes,storage",
        "--project",
        projectId,
        "--non-interactive",
      ],
      {
        stdio: "inherit",
        shell: true,
        env: {
          ...process.env,
          GOOGLE_APPLICATION_CREDENTIALS: tempFile,
        },
      }
    );

    if (result.error) {
      console.error("Failed to launch deploy command:", result.error.message);
      process.exit(1);
    }

    if (result.status !== 0) {
      process.exit(result.status || 1);
    }
  } finally {
    try {
      fs.unlinkSync(tempFile);
    } catch {
      // Ignore cleanup failures.
    }
  }
}

main().catch((error) => {
  console.error("Failed to deploy Firestore config:", error.message);
  process.exit(1);
});
