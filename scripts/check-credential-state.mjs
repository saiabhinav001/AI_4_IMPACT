import fs from "node:fs";
import path from "node:path";

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

async function main() {
  const envPath = path.resolve(".env.local");
  loadEnvFile(envPath);

  const { adminDb } = await import("../firebaseAdmin.js");

  const sample = await adminDb
    .collection("hackathon_registrations")
    .where("payment_verified", "==", true)
    .limit(10)
    .get();

  console.log(`verified_hackathon_sample_count=${sample.size}`);

  sample.forEach((doc) => {
    const data = doc.data() || {};
    const teamAccessId = data.team_access_id || data?.access_credentials?.team_id || null;
    const teamLeadAuthUid = data.team_lead_auth_uid || data?.access_credentials?.auth_uid || null;
    const hasPasswordField = Object.prototype.hasOwnProperty.call(data?.access_credentials || {}, "password");

    console.log(
      JSON.stringify({
        docId: doc.id,
        teamAccessId,
        teamLeadAuthUid,
        hasPasswordField,
      })
    );
  });
}

main().catch((error) => {
  console.error("Failed to inspect credential state:", error.message);
  process.exit(1);
});
