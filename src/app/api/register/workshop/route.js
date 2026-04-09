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

    const name = asTrimmedString(body?.name);
    const email = asNormalizedEmail(body?.email);
    const phone = asTrimmedString(body?.phone);
    const college = asTrimmedString(body?.college);
    const upiTransactionId = asTrimmedString(body?.upi_transaction_id);
    const screenshotUrl = asTrimmedString(body?.screenshot_url);

    if (!name || !email || !phone || !college || !upiTransactionId || !screenshotUrl) {
      return badRequest("Missing required fields.");
    }

    if (!isValidEmail(email)) {
      return badRequest("Invalid email format.");
    }

    if (!isValidPhone(phone)) {
      return badRequest("Phone must be exactly 10 digits.");
    }

    if (!isValidHttpUrl(screenshotUrl)) {
      return badRequest("Invalid screenshot_url.");
    }

    const existingParticipant = await adminDb
      .collection("participants")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!existingParticipant.empty) {
      await cleanupTempScreenshot(screenshotUrl);
      return badRequest("Email already registered.");
    }

    const analyticsRef = adminDb.collection("analytics").doc("summary");
    const analyticsDoc = await analyticsRef.get();

    if (!analyticsDoc.exists) {
      return NextResponse.json(
        { error: "Analytics not initialized. Call /api/admin/init-db first." },
        { status: 500 }
      );
    }

    const participantRef = adminDb.collection("participants").doc();
    const workshopRef = adminDb.collection("workshop_registrations").doc();
    const transactionRef = adminDb.collection("transactions").doc();

    const batch = adminDb.batch();

    batch.set(participantRef, {
      participant_id: participantRef.id,
      name,
      email,
      phone,
      registration_type: "workshop",
      registration_ref: workshopRef.id,
      created_at: FieldValue.serverTimestamp(),
    });

    batch.set(workshopRef, {
      workshop_id: workshopRef.id,
      participant_id: participantRef.id,
      transaction_id: transactionRef.id,
      college,
      payment_verified: false,
      created_at: FieldValue.serverTimestamp(),
    });

    batch.set(transactionRef, {
      transaction_id: transactionRef.id,
      registration_type: "workshop",
      registration_ref: workshopRef.id,
      upi_transaction_id: upiTransactionId,
      screenshot_url: screenshotUrl,
      amount: 150,
      status: "pending",
      verified_by: null,
      verified_at: null,
      created_at: FieldValue.serverTimestamp(),
    });

    batch.update(
      analyticsRef,
      "total_workshop",
      FieldValue.increment(1),
      new FieldPath("colleges", college),
      FieldValue.increment(1),
      "updated_at",
      FieldValue.serverTimestamp()
    );

    await batch.commit();

    return NextResponse.json({
      success: true,
      workshop_id: workshopRef.id,
      participant_id: participantRef.id,
    });
  } catch (error) {
    console.error("Workshop registration failed:", error);
    return NextResponse.json(
      { error: "Failed to complete workshop registration." },
      { status: 500 }
    );
  }
}
