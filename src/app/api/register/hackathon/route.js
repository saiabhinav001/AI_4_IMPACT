import { NextResponse } from "next/server";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../../firebaseAdmin";
import {
  asNormalizedEmail,
  asTrimmedString,
  isValidEmail,
  isValidHttpUrl,
  isValidPhone,
} from "../_utils/validation";
import { cleanupTempScreenshot } from "../_utils/screenshotCleanup";

export const runtime = "nodejs";

function badRequest(error) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(request) {
  try {
    const body = await request.json();

    const teamName = asTrimmedString(body?.team_name);
    const college = asTrimmedString(body?.college);
    const teamSize = Number(body?.team_size);
    const members = Array.isArray(body?.members) ? body.members : null;
    const upiTransactionId = asTrimmedString(body?.upi_transaction_id);
    const screenshotUrl = asTrimmedString(body?.screenshot_url);

    if (!teamName || !college || !teamSize || !members || !upiTransactionId || !screenshotUrl) {
      return badRequest("Missing required fields.");
    }

    if (![3, 4].includes(teamSize)) {
      return badRequest("team_size must be either 3 or 4.");
    }

    if (members.length !== teamSize) {
      return badRequest("members count must match team_size.");
    }

    if (!isValidHttpUrl(screenshotUrl)) {
      return badRequest("Invalid screenshot_url.");
    }

    const normalizedMembers = [];
    const emailSet = new Set();

    for (let index = 0; index < members.length; index += 1) {
      const member = members[index] || {};
      const name = asTrimmedString(member.name);
      const email = asNormalizedEmail(member.email);
      const phone = asTrimmedString(member.phone);

      if (!name || !email || !phone) {
        return badRequest(`Member ${index + 1} has missing required fields.`);
      }

      if (!isValidEmail(email)) {
        return badRequest(`Member ${index + 1} has invalid email.`);
      }

      if (!isValidPhone(phone)) {
        return badRequest(`Member ${index + 1} phone must be exactly 10 digits.`);
      }

      if (emailSet.has(email)) {
        return badRequest(`Duplicate member email in request: ${email}.`);
      }

      emailSet.add(email);
      normalizedMembers.push({ name, email, phone });
    }

    const existingChecks = await Promise.all(
      normalizedMembers.map(async (member) => {
        const doc = await adminDb
          .collection("participants")
          .where("email", "==", member.email)
          .limit(1)
          .get();
        return { email: member.email, exists: !doc.empty };
      })
    );

    const duplicateEmail = existingChecks.find((entry) => entry.exists);
    if (duplicateEmail) {
      await cleanupTempScreenshot(screenshotUrl);
      return badRequest(`Email ${duplicateEmail.email} is already registered.`);
    }

    const analyticsRef = adminDb.collection("analytics").doc("summary");
    const analyticsDoc = await analyticsRef.get();

    if (!analyticsDoc.exists) {
      return NextResponse.json(
        { error: "Analytics not initialized. Call /api/admin/init-db first." },
        { status: 500 }
      );
    }

    const teamRef = adminDb.collection("hackathon_registrations").doc();
    const transactionRef = adminDb.collection("transactions").doc();
    const participantRefs = normalizedMembers.map(() => adminDb.collection("participants").doc());

    const batch = adminDb.batch();

    participantRefs.forEach((participantRef, index) => {
      const member = normalizedMembers[index];
      batch.set(participantRef, {
        participant_id: participantRef.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        registration_type: "hackathon",
        registration_ref: teamRef.id,
        created_at: FieldValue.serverTimestamp(),
      });
    });

    batch.set(teamRef, {
      team_id: teamRef.id,
      team_name: teamName,
      college,
      team_size: teamSize,
      member_ids: participantRefs.map((ref) => ref.id),
      transaction_id: transactionRef.id,
      payment_verified: false,
      created_at: FieldValue.serverTimestamp(),
    });

    batch.set(transactionRef, {
      transaction_id: transactionRef.id,
      registration_type: "hackathon",
      registration_ref: teamRef.id,
      upi_transaction_id: upiTransactionId,
      screenshot_url: screenshotUrl,
      amount: 800,
      status: "pending",
      verified_by: null,
      verified_at: null,
      created_at: FieldValue.serverTimestamp(),
    });

    const teamSizeCounterField = teamSize === 3 ? "team_size_3" : "team_size_4";

    batch.update(
      analyticsRef,
      "total_hackathon",
      FieldValue.increment(1),
      teamSizeCounterField,
      FieldValue.increment(1),
      new FieldPath("colleges", college),
      FieldValue.increment(1),
      "updated_at",
      FieldValue.serverTimestamp()
    );

    await batch.commit();

    return NextResponse.json({
      success: true,
      team_id: teamRef.id,
    });
  } catch (error) {
    console.error("Hackathon registration failed:", error);
    return NextResponse.json(
      { error: "Failed to complete hackathon registration." },
      { status: 500 }
    );
  }
}
