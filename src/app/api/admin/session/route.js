import { NextResponse } from "next/server";

const SESSION_COOKIE = "admin_session";

const ADMIN_EMAILS = (
  process.env.ADMIN_EMAILS ||
  process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
  ""
)
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function isAllowedAdminEmail(email) {
  return ADMIN_EMAILS.includes((email || "").trim().toLowerCase());
}

async function lookupFirebaseUser(idToken) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error("Server is missing Firebase API key.");
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  const user = data?.users?.[0];

  if (!user?.email) {
    return null;
  }

  return {
    email: user.email,
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const idToken = body?.idToken;

    if (!idToken) {
      return NextResponse.json(
        { success: false, error: "Missing idToken" },
        { status: 400 }
      );
    }

    const user = await lookupFirebaseUser(idToken);

    if (!user || !isAllowedAdminEmail(user.email)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: idToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Session initialization failed" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });
  return response;
}
