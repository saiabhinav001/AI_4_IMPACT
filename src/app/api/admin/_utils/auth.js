import { NextResponse } from "next/server";
import { adminAuth } from "../../../../../firebaseAdmin";

const ADMIN_EMAILS = (
  globalThis?.process?.env?.ADMIN_EMAILS ||
  globalThis?.process?.env?.NEXT_PUBLIC_ADMIN_EMAILS ||
  ""
)
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function isAllowedAdminEmail(email) {
  return ADMIN_EMAILS.includes((email || "").trim().toLowerCase());
}

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

    if (decodedToken.admin !== true && !isAllowedAdminEmail(decodedToken.email)) {
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
