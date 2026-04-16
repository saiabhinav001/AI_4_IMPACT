import { NextResponse } from "next/server";
import { FieldPath, FieldValue, adminDb } from "../../../../../firebaseAdmin";

export const dynamic = "force-dynamic";
import {
  asNormalizedEmail,
  asTrimmedString,
  isValidEmail,
  isValidHttpUrl,
  isValidPhone,
} from "../_utils/validation";
import {
  cleanupTempScreenshot,
  isTempScreenshotForRegistrationType,
} from "../_utils/screenshotCleanup";
import {
  beginRegistrationIdempotency,
  finalizeRegistrationIdempotency,
} from "../_utils/idempotency";
import { getClientIp, hitRateLimit } from "../_utils/rate-limit";
import { resolveRegistrationGate } from "../../../../../lib/server/registration-gate";
import { upsertAdminReadModelForTransaction } from "../../../../../lib/server/admin-read-model.js";
import { invalidateAdminRegistrationsCache } from "../../admin/_utils/runtime-cache-invalidation";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

export async function POST(request) {
  let idempotencyContext = null;
  let uploadedScreenshotUrl = "";

  const buildResponse = (payload, status = 200, { replayed = false } = {}) => {
    const response = NextResponse.json(payload, { status });

    if (idempotencyContext?.enabled) {
      response.headers.set("x-idempotency-key", idempotencyContext.idempotencyKey);
    }

    if (replayed) {
      response.headers.set("x-idempotency-replayed", "1");
    }

    return response;
  };

  const respond = async (payload, status = 200) => {
    await finalizeRegistrationIdempotency({
      context: idempotencyContext,
      status,
      responseBody: payload,
      errorMessage: payload?.error,
    });

    return buildResponse(payload, status);
  };

  try {
    const clientIp = getClientIp(request);
    if (
      hitRateLimit({
        scope: "register-workshop",
        identity: clientIp,
        windowMs: RATE_LIMIT_WINDOW_MS,
        maxRequests: RATE_LIMIT_MAX_REQUESTS,
      })
    ) {
      return buildResponse(
        { error: "Too many registration attempts. Please retry in a minute." },
        429
      );
    }

    const registrationGate = await resolveRegistrationGate(adminDb, "workshop");
    if (!registrationGate.allowed) {
      return buildResponse(
        {
          error: registrationGate.message,
          registration_window: registrationGate.window,
        },
        403
      );
    }

    const body = await request.json();

    idempotencyContext = await beginRegistrationIdempotency({
      request,
      body,
      scope: "register-workshop",
    });

    if (idempotencyContext.mode === "replay") {
      return buildResponse(
        idempotencyContext.replayBody || { success: true },
        Number(idempotencyContext.replayStatus || 200),
        { replayed: true }
      );
    }

    if (idempotencyContext.mode === "in-progress") {
      return buildResponse(
        { error: "A matching registration request is already in progress. Please retry shortly." },
        409
      );
    }

    if (idempotencyContext.mode === "payload-mismatch") {
      return buildResponse(
        { error: "Idempotency key was reused with a different payload." },
        409
      );
    }

    const name = asTrimmedString(body?.name);
    const email = asNormalizedEmail(body?.email);
    const phone = asTrimmedString(body?.phone);
    const college = asTrimmedString(body?.college);
    const state = asTrimmedString(body?.state);
    const rollNumber = asTrimmedString(body?.roll_number || body?.rollNumber || body?.roll);
    const branch = asTrimmedString(body?.branch || body?.department);
    const branchSelection = asTrimmedString(body?.branch_selection || body?.department || branch);
    const yearOfStudy = asTrimmedString(body?.year_of_study || body?.yearOfStudy);
    const upiTransactionId = asTrimmedString(body?.upi_transaction_id);
    const screenshotUrl = asTrimmedString(body?.screenshot_url);
    uploadedScreenshotUrl = screenshotUrl;

    if (
      !name ||
      !email ||
      !phone ||
      !college ||
      !state ||
      !rollNumber ||
      !branch ||
      !yearOfStudy ||
      !upiTransactionId ||
      !screenshotUrl
    ) {
      return respond({ error: "Missing required fields." }, 400);
    }

    if (!isValidEmail(email)) {
      return respond({ error: "Invalid email format." }, 400);
    }

    if (!isValidPhone(phone)) {
      return respond({ error: "Phone must be exactly 10 digits." }, 400);
    }

    if (!isValidHttpUrl(screenshotUrl)) {
      return respond({ error: "Invalid screenshot_url." }, 400);
    }

    if (!isTempScreenshotForRegistrationType(screenshotUrl, "workshop")) {
      return respond(
        { error: "screenshot_url must be an uploaded workshop payment screenshot." },
        400
      );
    }

    const [existingEmailParticipants, existingPhoneParticipants] = await Promise.all([
      adminDb.collection("participants").where("email", "==", email).limit(1).get(),
      adminDb.collection("participants").where("phone", "==", phone).limit(1).get(),
    ]);

    const hasWorkshopEmailDuplicate = existingEmailParticipants.docs.some(
      (doc) => doc.get("registration_type") === "workshop"
    );
    const hasWorkshopPhoneDuplicate = existingPhoneParticipants.docs.some(
      (doc) => doc.get("registration_type") === "workshop"
    );

    if (hasWorkshopEmailDuplicate || hasWorkshopPhoneDuplicate) {
      await cleanupTempScreenshot(screenshotUrl);

      return respond(
        {
          error: "Duplicate details found for workshop registration.",
          field_errors: {
            email: hasWorkshopEmailDuplicate,
            phone: hasWorkshopPhoneDuplicate,
          },
        },
        409
      );
    }

    const analyticsRef = adminDb.collection("analytics").doc("summary");
    const analyticsDoc = await analyticsRef.get();

    if (!analyticsDoc.exists) {
      return respond(
        { error: "Analytics not initialized. Call /api/admin/init-db first." },
        500
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
      roll_number: rollNumber,
      state,
      branch,
      department: branch,
      branch_selection: branchSelection,
      year_of_study: yearOfStudy,
      yearOfStudy,
      registration_type: "workshop",
      registration_ref: workshopRef.id,
      created_at: FieldValue.serverTimestamp(),
    });

    batch.set(workshopRef, {
      workshop_id: workshopRef.id,
      participant_id: participantRef.id,
      transaction_id: transactionRef.id,
      college,
      state,
      roll_number: rollNumber,
      branch,
      department: branch,
      branch_selection: branchSelection,
      year_of_study: yearOfStudy,
      yearOfStudy,
      payment_verified: false,
      created_at: FieldValue.serverTimestamp(),
    });

    batch.set(transactionRef, {
      transaction_id: transactionRef.id,
      registration_type: "workshop",
      registration_ref: workshopRef.id,
      upi_transaction_id: upiTransactionId,
      screenshot_url: screenshotUrl,
      amount: 60,
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
      new FieldPath("colleges_workshop", college),
      FieldValue.increment(1),
      "updated_at",
      FieldValue.serverTimestamp()
    );

    await batch.commit();

    try {
      await upsertAdminReadModelForTransaction(transactionRef.id);
    } catch (readModelError) {
      console.error("Failed to upsert admin read model after workshop registration:", readModelError);
    }

    invalidateAdminRegistrationsCache();

    return respond(
      {
        success: true,
        workshop_id: workshopRef.id,
        participant_id: participantRef.id,
      },
      200
    );
  } catch (error) {
    console.error("Workshop registration failed:", error);

    if (uploadedScreenshotUrl) {
      await cleanupTempScreenshot(uploadedScreenshotUrl);
    }

    return respond({ error: "Failed to complete workshop registration." }, 500);
  }
}
