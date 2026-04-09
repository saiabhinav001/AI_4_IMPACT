const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const idx = line.indexOf("=");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

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
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!projectId || !clientEmail || !privateKey || !storageBucket) {
    throw new Error("Missing Firebase admin configuration in .env.local");
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket,
    });
  }

  return {
    db: getFirestore(),
    bucket: getStorage().bucket(storageBucket),
  };
}

async function main() {
  const { db, bucket } = initAdmin();

  const duplicateEmail = `dup-${Date.now()}@example.com`;
  const participantRef = db.collection("participants").doc();

  await participantRef.set({
    participant_id: participantRef.id,
    name: "Existing User",
    email: duplicateEmail,
    phone: "9999999999",
    registration_type: "hackathon",
    registration_ref: "dummy_ref",
    created_at: FieldValue.serverTimestamp(),
  });

  const objectPath = `payments/temp_test_${randomUUID()}.jpg`;
  const token = randomUUID();
  const file = bucket.file(objectPath);

  await file.save(Buffer.from("test-image-bytes"), {
    resumable: false,
    metadata: {
      contentType: "image/jpeg",
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  const screenshotUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
    objectPath
  )}?alt=media&token=${token}`;

  const payload = {
    teamName: "Cleanup Test Team",
    collegeName: "Cleanup College",
    teamSize: 3,
    participants: [
      { name: "A", roll: "1", email: duplicateEmail, phone: "9999999999" },
      { name: "B", roll: "2", email: `u2-${Date.now()}@example.com`, phone: "8888888888" },
      { name: "C", roll: "3", email: `u3-${Date.now()}@example.com`, phone: "7777777777" },
    ],
    payment: {
      transactionId: `TX-${Date.now()}`,
      screenshotUrl,
    },
  };

  const response = await fetch("http://localhost:3000/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const responseBody = await response.json();
  const [existsAfter] = await file.exists();

  console.log(`status=${response.status}`);
  console.log(`error=${responseBody.error || ""}`);
  console.log(`temp_file_exists_after=${existsAfter}`);

  await participantRef.delete();
  if (existsAfter) {
    await file.delete({ ignoreNotFound: true });
  }
}

main().catch(async (error) => {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
});
