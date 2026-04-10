const fs = require("fs");
const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

function loadEnvFile(filePath) {
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

function initAdmin() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw =
    process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = privateKeyRaw ? privateKeyRaw.replace(/\\n/g, "\n") : undefined;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase admin configuration in .env.local");
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  return getFirestore();
}

async function clearCollectionRecursive(db, collectionId) {
  const collectionRef = db.collection(collectionId);
  const hasDocuments = !(await collectionRef.limit(1).get()).empty;

  if (!hasDocuments) {
    console.log(`Skipping ${collectionId} (already empty)`);
    return;
  }

  await db.recursiveDelete(collectionRef);
  console.log(`Deleted collection ${collectionId}`);
}

async function main() {
  const db = initAdmin();
  const collections = await db.listCollections();

  if (!collections.length) {
    console.log("No collections found. Initializing analytics/summary only.");
  }

  for (const collectionRef of collections) {
    await clearCollectionRecursive(db, collectionRef.id);
  }

  await db.collection("analytics").doc("summary").set({
    total_workshop: 0,
    total_hackathon: 0,
    team_size_3: 0,
    team_size_4: 0,
    team_access_counter: 0,
    colleges: {},
    colleges_hackathon: {},
    colleges_workshop: {},
    updated_at: FieldValue.serverTimestamp(),
  });

  console.log("Reinitialized analytics/summary with zeroed counters.");
}

main().catch((error) => {
  console.error("Database cleanup failed:", error.message);
  process.exitCode = 1;
});
