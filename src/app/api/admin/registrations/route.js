import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../../lib/admin";
import { verifyRequestWithProfile, isAdmin } from "../../../../../lib/server/auth";
import { ROLES } from "../../../../../lib/constants/roles";

function clean(value) {
  return String(value || "").trim();
}

export async function GET(request) {
  try {
    const { authUser, profile } = await verifyRequestWithProfile(request);
    if (!authUser || (!isAdmin(profile, authUser) && profile?.role !== ROLES.ADMIN)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const [teamsSnap, workshopsSnap] = await Promise.all([
      adminDb.collection("teams").orderBy("createdAt", "desc").get(),
      adminDb.collection("workshop_registrations").orderBy("createdAt", "desc").get(),
    ]);

    return NextResponse.json({
      success: true,
      teams: teamsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      workshops: workshopsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to load registrations." },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const { authUser, profile } = await verifyRequestWithProfile(request);
    if (!authUser || (!isAdmin(profile, authUser) && profile?.role !== ROLES.ADMIN)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const target = clean(body?.target);
    const id = clean(body?.id);
    const status = clean(body?.status).toUpperCase();
    const notes = body?.notes;

    if (!target || !id || (!status && typeof notes === "undefined")) {
      return NextResponse.json(
        { success: false, error: "target, id and at least one of status/notes are required." },
        { status: 400 }
      );
    }
    if (status && !["APPROVED", "REJECTED", "PENDING", "VERIFIED"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status value." },
        { status: 400 }
      );
    }

    const collectionName = target === "workshop" ? "workshop_registrations" : "teams";
    const updatePayload = { updatedAt: FieldValue.serverTimestamp() };
    if (collectionName === "teams") {
      if (status) updatePayload["payment.status"] = status;
      if (typeof notes !== "undefined") updatePayload.notes = clean(notes);
    } else {
      if (status) updatePayload.status = status;
      if (typeof notes !== "undefined") updatePayload.notes = clean(notes);
    }

    await adminDb.collection(collectionName).doc(id).set(updatePayload, { merge: true });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to update registration status." },
      { status: 500 }
    );
  }
}
