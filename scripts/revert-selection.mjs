import { adminDb, FieldValue } from "../firebaseAdmin.js";
import { 
  PROBLEM_STATEMENT_CAPACITY_COLLECTION, 
  PROBLEM_STATEMENT_CAPACITY_DOC_ID,
  PROBLEM_STATEMENT_SELECTION_COLLECTION
} from "../lib/server/problem-statements.js";

async function revertSelection() {
  const teamId = "6nHFfsKLt3I2PlYMjmv2";
  const teamName = "Str";
  
  console.log(`Reverting selection for team: ${teamName} (ID: ${teamId})`);
  
  const teamRef = adminDb.collection("hackathon_registrations").doc(teamId);
  const teamDoc = await teamRef.get();
  
  if (!teamDoc.exists) {
    console.error("Team not found in database.");
    process.exit(1);
  }
  
  const teamData = teamDoc.data();
  const selection = teamData.problem_statement_selection;
  
  if (!selection || !selection.problem_id) {
    console.error("No problem selection found for this team.");
    process.exit(1);
  }
  
  const problemId = selection.problem_id;
  console.log(`Team had selected: ${problemId}`);
  
  const capacityRef = adminDb.collection(PROBLEM_STATEMENT_CAPACITY_COLLECTION).doc(PROBLEM_STATEMENT_CAPACITY_DOC_ID);
  const selectionRef = adminDb.collection(PROBLEM_STATEMENT_SELECTION_COLLECTION).doc(teamId);
  
  await adminDb.runTransaction(async (transaction) => {
    const capacityDoc = await transaction.get(capacityRef);
    const capacityData = capacityDoc.data() || {};
    const counts = capacityData.counts || {};
    
    const currentCount = Number(counts[problemId] || 0);
    const nextCount = Math.max(0, currentCount - 1);
    
    console.log(`Updating capacity for ${problemId}: ${currentCount} -> ${nextCount}`);
    
    // 1. Update capacity
    transaction.update(capacityRef, {
      [`counts.${problemId}`]: nextCount,
      updated_at: FieldValue.serverTimestamp()
    });
    
    // 2. Remove team selection record
    transaction.delete(selectionRef);
    
    // 3. Clear fields in team doc
    transaction.update(teamRef, {
      problem_statement_selection: FieldValue.delete(),
      // Also clear any freeze lock if it was related to this selection
      // Note: The app logic seems to reuse problem_statement_selection.locked
      // but let's be safe.
      updated_at: FieldValue.serverTimestamp()
    });
  });
  
  console.log("Revert successful.");
  process.exit(0);
}

revertSelection().catch(err => {
  console.error(err);
  process.exit(1);
});
