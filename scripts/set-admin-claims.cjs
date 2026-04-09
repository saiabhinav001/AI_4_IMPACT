const fs = require("fs");
const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

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

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin credentials in .env.local");
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  return getAuth();
}

async function main() {
  const auth = initAdmin();

  const emails = (
    process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || ""
  )
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!emails.length) {
    throw new Error("No admin emails found in ADMIN_EMAILS/NEXT_PUBLIC_ADMIN_EMAILS");
  }

  for (const email of emails) {
    try {
      const user = await auth.getUserByEmail(email);
      const claims = user.customClaims || {};

      if (claims.admin === true) {
        console.log(`${email}: admin claim already true`);
        continue;
      }

      await auth.setCustomUserClaims(user.uid, {
        ...claims,
        admin: true,
      });

      console.log(`${email}: admin claim set`);
    } catch (error) {
      console.error(`${email}: ${error.message}`);
    }
  }

  console.log("Done. Users must refresh token (log out and log in again).");
}

main().catch((error) => {
  console.error("Failed to set admin claims:", error.message);
  process.exitCode = 1;
});
