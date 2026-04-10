import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const storageBucket =
  process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

const serviceAccount = readServiceAccountFromEnv() || readServiceAccountFromFile();

if (!serviceAccount) {
  throw new Error(
    "Missing Firebase Admin credentials. Set FIREBASE_ADMIN_* (or FIREBASE_*) env vars, or provide ai4impact-serviceAcc.json."
  );
}

if (!storageBucket) {
  throw new Error("Missing Firebase Storage Bucket in environment variables.");
}

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket,
  });
}

const adminAuth = getAuth();
const adminDb = getFirestore();
const adminStorage = getStorage().bucket(storageBucket);

export { adminAuth, adminDb, adminStorage };