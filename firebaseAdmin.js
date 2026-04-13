import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const { getApp, getApps, initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldPath, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

function normalizePrivateKey(value) {
  return String(value || "").replace(/\\n/g, "\n").trim();
}

function readServiceAccountFromEnv() {
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "";
  const clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL || "";
  const privateKey = normalizePrivateKey(
    process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY || ""
  );

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
    const currentFilePath = fileURLToPath(import.meta.url);
    const currentDir = path.dirname(currentFilePath);
    const filePath = path.join(currentDir, "ai4impact-serviceAcc.json");

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const projectId = String(parsed?.project_id || "").trim();
    const clientEmail = String(parsed?.client_email || "").trim();
    const privateKey = normalizePrivateKey(parsed?.private_key || "");

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

const inferredProjectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  "";

const storageBucket =
  process.env.FIREBASE_STORAGE_BUCKET ||
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  (inferredProjectId ? `${inferredProjectId}.appspot.com` : "");

const serviceAccount = readServiceAccountFromEnv() || readServiceAccountFromFile();

const runningInGoogleCloud =
  Boolean(process.env.K_SERVICE) ||
  Boolean(process.env.FUNCTION_TARGET) ||
  Boolean(process.env.GOOGLE_CLOUD_PROJECT) ||
  Boolean(process.env.GCLOUD_PROJECT);

const adminInitErrors = [];

if (!serviceAccount && !runningInGoogleCloud) {
  adminInitErrors.push(
    "Missing Firebase Admin credentials. Set FIREBASE_ADMIN_* (or FIREBASE_*) env vars, or provide ai4impact-serviceAcc.json."
  );
}

if (!storageBucket) {
  adminInitErrors.push("Missing Firebase Storage Bucket in environment variables.");
}

const adminInitErrorMessage = adminInitErrors.join(" ").trim();

function createMissingAdminProxy(resourceName) {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(
          `${adminInitErrorMessage} Attempted to access ${resourceName} before Firebase Admin initialization.`
        );
      },
    }
  );
}

let adminApp = null;
let adminAuth;
let adminDb;
let adminStorage;

if (!adminInitErrorMessage) {
  try {
    adminApp = getApp();
  } catch {
    const appOptions = {
      storageBucket,
    };

    if (serviceAccount) {
      appOptions.credential = cert(serviceAccount);
    }

    if (!getApps().length) {
      adminApp = initializeApp(appOptions);
    } else {
      adminApp = getApps()[0];
    }
  }

  adminAuth = getAuth(adminApp);
  adminDb = getFirestore(adminApp);
  adminStorage = getStorage(adminApp).bucket(storageBucket);
} else {
  adminAuth = createMissingAdminProxy("adminAuth");
  adminDb = createMissingAdminProxy("adminDb");
  adminStorage = createMissingAdminProxy("adminStorage");
}

export { adminAuth, adminDb, adminStorage, FieldPath, FieldValue, Timestamp };