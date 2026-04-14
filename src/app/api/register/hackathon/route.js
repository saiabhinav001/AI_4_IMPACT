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
import { resolveRegistrationGate } from "../../../../../lib/server/registration-gate";

export const runtime = "nodejs";

function badRequest(error) {
  return NextResponse.json({ error }, { status: 400 });
}

function conflict(error, fieldErrors = {}) {
  return NextResponse.json(
    { error, field_errors: fieldErrors },
    { status: 409 }
  );
}

function normalizeTeamName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export async function POST(request) {
  try {
    const registrationGate = await resolveRegistrationGate(adminDb, "hackathon");
    if (!registrationGate.allowed) {
      return NextResponse.json(
        {
          error: registrationGate.message,
          registration_window: registrationGate.window,
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const teamName = asTrimmedString(body?.team_name);
    const normalizedTeamName = normalizeTeamName(teamName);
    const college = asTrimmedString(body?.college);
    const state = asTrimmedString(body?.state);
    const teamSize = Number(body?.team_size);
    const members = Array.isArray(body?.members) ? body.members : null;
    const upiTransactionId = asTrimmedString(body?.upi_transaction_id);
    const screenshotUrl = asTrimmedString(body?.screenshot_url);

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
      return badRequest("Missing required fields.");
    }

    if (![2, 3, 4].includes(teamSize)) {
      return badRequest("team_size must be 2, 3 or 4.");
    }

    if (members.length !== teamSize) {
      return badRequest("members count must match team_size.");
    }

    if (!isValidHttpUrl(screenshotUrl)) {
      return badRequest("Invalid screenshot_url.");
    }

    if (!isTempScreenshotForRegistrationType(screenshotUrl, "hackathon")) {
      return badRequest(
        "screenshot_url must be an uploaded hackathon payment screenshot."
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

      if (phoneSet.has(phone)) {
        return badRequest(`Duplicate member phone in request: ${phone}.`);
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
      return conflict(messageParts.join(" "), {
        member_emails: Array.from(new Set(conflictingEmails)),
        member_phones: Array.from(new Set(conflictingPhones)),
      });
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
    const payableAmount = teamSize === 2 ? 500 : 800;

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
      team_name_normalized: normalizedTeamName,
      college,
      state,
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
