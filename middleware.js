import { NextResponse } from "next/server";

const SESSION_COOKIE = "admin_session";

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

function hasAdminClaim(lookupUser) {
  const rawClaims = lookupUser?.customAttributes;
  if (!rawClaims || typeof rawClaims !== "string") {
    return false;
  }

  try {
    const claims = JSON.parse(rawClaims);
    return claims?.admin === true;
  } catch {
    return false;
  }
}

async function verifyAdminToken(idToken) {
  const apiKey = globalThis?.process?.env?.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey || !idToken) return false;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!res.ok) return false;
    const data = await res.json();
    const lookupUser = data?.users?.[0] || null;

    if (!lookupUser) return false;

    return hasAdminClaim(lookupUser) || isAllowedAdminEmail(lookupUser.email);
  } catch {
    return false;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isAdminSession = await verifyAdminToken(token);

  if (pathname.startsWith("/admin-v2")) {
    if (!isAdminSession) {
      const loginUrl = new URL("/auth", request.url);
      loginUrl.searchParams.set("reason", "admin-only");
      const response = NextResponse.redirect(loginUrl);
      response.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
      return response;
    }

    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login") && !isAdminSession) {
    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("reason", "admin-only");
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
    return response;
  }

  if (pathname.startsWith("/admin/login") && isAdminSession) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (pathname.startsWith("/admin/login") && !isAdminSession) {
    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("reason", "admin-only");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/admin-v2/:path*"],
};
