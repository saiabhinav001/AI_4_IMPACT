import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function trim(value) {
  return String(value || "").trim();
}

export function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadStandardEnv() {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, ".env.local"));
  loadEnvFile(path.join(cwd, ".env"));
}

function readServiceAccountFromEnv() {
  const projectId =
    trim(process.env.FIREBASE_ADMIN_PROJECT_ID) ||
    trim(process.env.FIREBASE_PROJECT_ID) ||
    trim(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const clientEmail =
    trim(process.env.FIREBASE_ADMIN_CLIENT_EMAIL) || trim(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = (
    trim(process.env.FIREBASE_ADMIN_PRIVATE_KEY) || trim(process.env.FIREBASE_PRIVATE_KEY)
  ).replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function readServiceAccountFromFile() {
  try {
    const currentFile = fileURLToPath(import.meta.url);
    const rootDir = path.resolve(path.dirname(currentFile), "..");
    const jsonPath = path.join(rootDir, "ai4impact-serviceAcc.json");

    if (!fs.existsSync(jsonPath)) {
      return null;
    }

    const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const projectId = trim(parsed?.project_id);
    const clientEmail = trim(parsed?.client_email);
    const privateKey = trim(parsed?.private_key).replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      return null;
    }

    return {
      projectId,
      clientEmail,
      privateKey,
    };
  } catch {
    return null;
  }
}

function resolveStorageBucket(projectId) {
  return (
    trim(process.env.FIREBASE_STORAGE_BUCKET) ||
    trim(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) ||
    (projectId ? `${projectId}.appspot.com` : "")
  );
}

export function initAdminContext({ requireStorage = false } = {}) {
  loadStandardEnv();

  const runningInGoogleCloud =
    Boolean(process.env.K_SERVICE) ||
    Boolean(process.env.FUNCTION_TARGET) ||
    Boolean(process.env.GOOGLE_CLOUD_PROJECT) ||
    Boolean(process.env.GCLOUD_PROJECT);

  const serviceAccount = readServiceAccountFromEnv() || readServiceAccountFromFile();
  if (!serviceAccount && !runningInGoogleCloud) {
    throw new Error(
      "Missing Firebase Admin credentials. Configure FIREBASE_ADMIN_* env vars or ai4impact-serviceAcc.json."
    );
  }

  const projectId =
    serviceAccount?.projectId ||
    trim(process.env.GOOGLE_CLOUD_PROJECT) ||
    trim(process.env.GCLOUD_PROJECT);
  const storageBucket = resolveStorageBucket(projectId);

  if (requireStorage && !storageBucket) {
    throw new Error(
      "Missing Firebase Storage bucket. Configure FIREBASE_STORAGE_BUCKET or NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET."
    );
  }

  const existingApp = getApps().length ? getApp() : null;
  const app =
    existingApp ||
    initializeApp({
      ...(serviceAccount ? { credential: cert(serviceAccount) } : {}),
      ...(storageBucket ? { storageBucket } : {}),
    });

  const db = getFirestore(app);
  const storage = requireStorage ? getStorage(app).bucket(storageBucket) : null;

  return {
    app,
    db,
    storage,
    projectId: projectId || null,
    storageBucket: storageBucket || null,
  };
}

export function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function fileTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function sha256ForBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function writeJsonFileWithHash(filePath, payload) {
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  const buffer = Buffer.from(content, "utf8");
  const sha256 = sha256ForBuffer(buffer);
  fs.writeFileSync(filePath, buffer);

  return {
    bytes: buffer.byteLength,
    sha256,
  };
}

export function parseCliArgs(argv) {
  const args = {};

  for (const token of argv) {
    if (!token.startsWith("--")) {
      continue;
    }

    const eqIndex = token.indexOf("=");
    if (eqIndex === -1) {
      args[token.slice(2)] = "true";
      continue;
    }

    const key = token.slice(2, eqIndex).trim();
    const value = token.slice(eqIndex + 1).trim();
    args[key] = value;
  }

  return args;
}

export function parseCsvArg(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
