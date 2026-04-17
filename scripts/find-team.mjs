import { adminDb } from "../firebaseAdmin.js";

async function findTeam() {
  console.log(`Listing all hackathon registrations to find 'STR'...`);
  
  const snapshot = await adminDb.collection("hackathon_registrations").get();
    
  if (snapshot.empty) {
    console.log("No registrations found at all.");
    process.exit(0);
  }
  
  let found = false;
  snapshot.forEach(doc => {
    const data = doc.data();
    const name = (data.team_name || "").toUpperCase();
    if (name.includes("STR")) {
      console.log(`Found Team ID: ${doc.id}`);
      console.log("Data:", JSON.stringify(data, null, 2));
      found = true;
    }
  });
  
  if (!found) console.log("No partial match found for 'STR'.");
  process.exit(0);
}

findTeam().catch(err => {
  console.error(err);
  process.exit(1);
});
