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

function normalizeTeamName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

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
        scope: "register-hackathon",
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

    const registrationGate = await resolveRegistrationGate(adminDb, "hackathon");
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
      scope: "register-hackathon",
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

    const teamName = asTrimmedString(body?.team_name);
    const normalizedTeamName = normalizeTeamName(teamName);
    const college = asTrimmedString(body?.college);
    const state = asTrimmedString(body?.state);
    const teamSize = Number(body?.team_size);
    const members = Array.isArray(body?.members) ? body.members : null;
    const upiTransactionId = asTrimmedString(body?.upi_transaction_id);
    const screenshotUrl = asTrimmedString(body?.screenshot_url);
    uploadedScreenshotUrl = screenshotUrl;

    if (
      !teamName ||
      !normalizedTeamName ||
      !college ||
      !state ||
      !teamSize ||
      !members ||
      !upiTransactionId ||
      !screenshotUrl
    ) {
      return respond({ error: "Missing required fields." }, 400);
    }

    if (![2, 3, 4].includes(teamSize)) {
      return respond({ error: "team_size must be 2, 3 or 4." }, 400);
    }

    if (members.length !== teamSize) {
      return respond({ error: "members count must match team_size." }, 400);
    }

    if (!isValidHttpUrl(screenshotUrl)) {
      return respond({ error: "Invalid screenshot_url." }, 400);
    }

    if (!isTempScreenshotForRegistrationType(screenshotUrl, "hackathon")) {
      return respond(
        { error: "screenshot_url must be an uploaded hackathon payment screenshot." },
        400
      );
    }

    const normalizedMembers = [];
    const emailSet = new Set();
    const phoneSet = new Set();

    for (let index = 0; index < members.length; index += 1) {
      const member = members[index] || {};
      const name = asTrimmedString(member.name);
      const email = asNormalizedEmail(member.email);
      const phone = asTrimmedString(member.phone);
      const rollNumber = asTrimmedString(member.roll_number || member.rollNumber || member.roll);
      const branch = asTrimmedString(member.branch || member.department);
      const yearOfStudy = asTrimmedString(member.year_of_study || member.yearOfStudy);
      const branchSelection = asTrimmedString(member.branch_selection || member.department || branch);

      if (!name || !email || !phone || !rollNumber || !branch || !yearOfStudy) {
        return respond({ error: `Member ${index + 1} has missing required fields.` }, 400);
      }

      if (!isValidEmail(email)) {
        return respond({ error: `Member ${index + 1} has invalid email.` }, 400);
      }

      if (!isValidPhone(phone)) {
        return respond({ error: `Member ${index + 1} phone must be exactly 10 digits.` }, 400);
      }

      if (emailSet.has(email)) {
        return respond({ error: `Duplicate member email in request: ${email}.` }, 400);
      }

      if (phoneSet.has(phone)) {
        return respond({ error: `Duplicate member phone in request: ${phone}.` }, 400);
      }

      emailSet.add(email);
      phoneSet.add(phone);
      normalizedMembers.push({
        name,
        email,
        phone,
        roll_number: rollNumber,
        branch,
        department: branch,
        branch_selection: branchSelection,
        year_of_study: yearOfStudy,
        yearOfStudy,
        state,
      });
    }

    const memberEmails = normalizedMembers.map((member) => member.email);
    const memberPhones = normalizedMembers.map((member) => member.phone);

    const [existingParticipantsByEmail, existingParticipantsByPhone] = await Promise.all([
      adminDb
        .collection("participants")
        .where("email", "in", memberEmails)
        .get(),
      adminDb
        .collection("participants")
        .where("phone", "in", memberPhones)
        .get(),
    ]);

    const existingHackathonEmailSet = new Set(
      existingParticipantsByEmail.docs
        .filter((doc) => doc.get("registration_type") === "hackathon")
        .map((doc) => asNormalizedEmail(doc.get("email")))
        .filter(Boolean)
    );

    const existingHackathonPhoneSet = new Set(
      existingParticipantsByPhone.docs
        .filter((doc) => doc.get("registration_type") === "hackathon")
        .map((doc) => asTrimmedString(doc.get("phone")))
        .filter(Boolean)
    );

    const conflictingEmails = memberEmails.filter((email) => existingHackathonEmailSet.has(email));
    const conflictingPhones = memberPhones.filter((phone) => existingHackathonPhoneSet.has(phone));

    if (conflictingEmails.length > 0 || conflictingPhones.length > 0) {
      const messageParts = [];
      if (conflictingEmails.length > 0) {
        messageParts.push("One or more member emails are already registered for hackathon.");
      }
      if (conflictingPhones.length > 0) {
        messageParts.push("One or more member phone numbers are already registered for hackathon.");
      }

      await cleanupTempScreenshot(screenshotUrl);
      return respond(
        {
          error: messageParts.join(" "),
          field_errors: {
            member_emails: Array.from(new Set(conflictingEmails)),
            member_phones: Array.from(new Set(conflictingPhones)),
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

    const teamRef = adminDb.collection("hackathon_registrations").doc();
    const transactionRef = adminDb.collection("transactions").doc();
    const participantRefs = normalizedMembers.map(() => adminDb.collection("participants").doc());

    const batch = adminDb.batch();
    const payableAmount = teamSize === 2 ? 500 : 800;

    participantRefs.forEach((participantRef, index) => {
      const member = normalizedMembers[index];
      batch.set(participantRef, {
        participant_id: participantRef.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        roll_number: member.roll_number,
        state: member.state,
        branch: member.branch,
        department: member.department,
        branch_selection: member.branch_selection,
        year_of_study: member.year_of_study,
        yearOfStudy: member.yearOfStudy,
        registration_type: "hackathon",
        registration_ref: teamRef.id,
        created_at: FieldValue.serverTimestamp(),
      });
    });

    batch.set(teamRef, {
      team_id: teamRef.id,
      team_name: teamName,
      team_name_normalized: normalizedTeamName,
      college,
      state,
      team_size: teamSize,
      member_ids: participantRefs.map((ref) => ref.id),
      members: normalizedMembers,
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
      amount: payableAmount,
      status: "pending",
      verified_by: null,
      verified_at: null,
      created_at: FieldValue.serverTimestamp(),
    });

    const teamSizeCounterField = `team_size_${teamSize}`;

    batch.update(
      analyticsRef,
      "total_hackathon",
      FieldValue.increment(1),
      teamSizeCounterField,
      FieldValue.increment(1),
      new FieldPath("colleges", college),
      FieldValue.increment(1),
      new FieldPath("colleges_hackathon", college),
      FieldValue.increment(1),
      "updated_at",
      FieldValue.serverTimestamp()
    );

    await batch.commit();

    try {
      await upsertAdminReadModelForTransaction(transactionRef.id);
    } catch (readModelError) {
      console.error("Failed to upsert admin read model after hackathon registration:", readModelError);
    }

    invalidateAdminRegistrationsCache();

    return respond(
      {
        success: true,
        team_id: teamRef.id,
      },
      200
    );
  } catch (error) {
    console.error("Hackathon registration failed:", error);

    if (uploadedScreenshotUrl) {
      await cleanupTempScreenshot(uploadedScreenshotUrl);
    }

    return respond({ error: "Failed to complete hackathon registration." }, 500);
  }
}
