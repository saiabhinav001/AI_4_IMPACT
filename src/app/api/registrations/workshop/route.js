import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../../lib/admin";
import { PHASES } from "../../../../../lib/constants/phases";
import { verifyRequestWithProfile } from "../../../../../lib/server/auth";
import { getHackathonConfig } from "../../../../../lib/server/hackathon";

function clean(value) {
  return String(value || "").trim();
}

export async function POST(request) {
  try {
    const { authUser, profile } = await verifyRequestWithProfile(request);
    if (!authUser || !profile) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const config = await getHackathonConfig();
    if (config.currentPhase !== PHASES.REGISTRATION) {
      return NextResponse.json(
        { success: false, error: "Workshop registration is currently closed." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const college = clean(body?.college || profile?.college);
    const phone = clean(body?.phone || profile?.phone);
    const paymentScreenshotUrl = clean(body?.paymentScreenshotUrl);
    const paymentReference = clean(body?.paymentReference);

    if (!college || !phone || !paymentScreenshotUrl || !paymentReference) {
      return NextResponse.json(
        {
          success: false,
          error: "college, phone, paymentScreenshotUrl, paymentReference are required.",
        },
        { status: 400 }
      );
    }

    const ref = await adminDb.collection("workshop_registrations").add({
      uid: authUser.uid,
      email: authUser.email || "",
      college,
      phone,
      payment: {
        screenshotUrl: paymentScreenshotUrl,
        reference: paymentReference,
        status: "PENDING",
      },
      status: "PENDING",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection("users").doc(authUser.uid).set(
      {
        college,
        phone,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, registrationId: ref.id });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to register for workshop." },
      { status: 500 }
    );
  }
}
