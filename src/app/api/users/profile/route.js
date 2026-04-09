import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../../lib/admin";
import { ROLES, ROLE_LIST } from "../../../../../lib/constants/roles";
import { verifyRequestUser } from "../../../../../lib/server/auth";

function clean(value) {
  return String(value || "").trim();
}

export async function PATCH(request) {
  try {
    const authUser = await verifyRequestUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const role = clean(body?.role || ROLES.PARTICIPANT);
    const college = clean(body?.college);
    const phone = clean(body?.phone);
    const fullName = clean(body?.fullName);

    if (!ROLE_LIST.includes(role)) {
      return NextResponse.json({ success: false, error: "Invalid role." }, { status: 400 });
    }

    await adminDb.collection("users").doc(authUser.uid).set(
      {
        uid: authUser.uid,
        email: authUser.email || "",
        role,
        college,
        phone,
        fullName,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to update user profile." },
      { status: 500 }
    );
  }
}
