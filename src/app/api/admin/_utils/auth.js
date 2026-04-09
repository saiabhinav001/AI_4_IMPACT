import { NextResponse } from "next/server";
import { adminAuth } from "../../../../../firebaseAdmin";

function unauthorized(message) {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function requireAdmin(request) {
  const authHeader = request.headers.get("authorization") || "";

  if (!authHeader.startsWith("Bearer ")) {
    return { error: unauthorized("Missing or invalid Authorization header.") };
  }

  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    return { error: unauthorized("Missing Firebase ID token.") };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (decodedToken.admin !== true) {
      return {
        error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }

    return { decodedToken };
  } catch (error) {
    console.error("Admin token verification failed:", error);
    return { error: unauthorized("Invalid or expired Firebase ID token.") };
  }
}
