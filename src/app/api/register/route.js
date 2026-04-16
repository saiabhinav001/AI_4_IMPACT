import { NextResponse } from "next/server";
import { POST as registerHackathon } from "./hackathon/route";
import { cleanupTempScreenshot } from "./_utils/screenshotCleanup";

export const dynamic = "force-static";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const registerRateLimitStore = globalThis.__registerRateLimitStore || new Map();

if (!globalThis.__registerRateLimitStore) {
  globalThis.__registerRateLimitStore = registerRateLimitStore;
}

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const firstIp = forwarded.split(",")[0].trim();
  return firstIp || "unknown";
}

function hitRateLimit(key) {
  const now = Date.now();
  const current = registerRateLimitStore.get(key);

  if (!current || now - current.start >= RATE_LIMIT_WINDOW_MS) {
    registerRateLimitStore.set(key, { count: 1, start: now });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  current.count += 1;
  registerRateLimitStore.set(key, current);
  return false;
}

function asTrimmedString(value) {
  return String(value ?? "").trim();
}

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const clientIp = getClientIp(request);
    if (hitRateLimit(`register:${clientIp}`)) {
      return NextResponse.json(
        { success: false, error: "Too many registration attempts. Please retry in a minute." },
        { status: 429 }
      );
    }

    const body = await request.json();

    const teamName = asTrimmedString(body?.teamName);
    const collegeName = asTrimmedString(body?.collegeName);
    const teamSize = Number(body?.teamSize);
    const participants = Array.isArray(body?.participants) ? body.participants : [];
    const transactionId = asTrimmedString(body?.payment?.transactionId);
    const screenshotUrl = asTrimmedString(body?.payment?.screenshotUrl);
    const idempotencyKey = asTrimmedString(
      request.headers.get("x-idempotency-key") || body?.idempotency_key
    );

    if (!teamName || !collegeName || !participants.length || !transactionId || !screenshotUrl) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    const proxyBody = {
      team_name: teamName,
      college: collegeName,
      team_size: teamSize,
      members: participants.map((participant) => ({
        name: asTrimmedString(participant?.name),
        email: asTrimmedString(participant?.email).toLowerCase(),
        phone: asTrimmedString(participant?.phone),
      })),
      upi_transaction_id: transactionId,
      screenshot_url: screenshotUrl,
      idempotency_key: idempotencyKey || undefined,
    };

    const proxyHeaders = { "Content-Type": "application/json" };
    if (idempotencyKey) {
      proxyHeaders["x-idempotency-key"] = idempotencyKey;
    }

    const proxyRequest = new Request(request.url, {
      method: "POST",
      headers: proxyHeaders,
      body: JSON.stringify(proxyBody),
    });

    const phase1Response = await registerHackathon(proxyRequest);
    const responseBody = await phase1Response.json();

    if (!phase1Response.ok) {
      const errorMessage = String(responseBody?.error || "").toLowerCase();
      if (errorMessage.includes("already registered")) {
        await cleanupTempScreenshot(screenshotUrl);
      }

      return NextResponse.json(
        {
          success: false,
          error: responseBody?.error || "Registration failed. Please try again.",
        },
        { status: phase1Response.status }
      );
    }

    return NextResponse.json({
      success: true,
      id: responseBody.team_id,
      team_id: responseBody.team_id,
    });
  } catch (error) {
    console.error("Registration compatibility route failed:", error);
    return NextResponse.json(
      { success: false, error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}