import { NextResponse } from "next/server";
import { POST as uploadPaymentScreenshot } from "./payment-screenshot/route";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 8;
const uploadRateLimitStore = globalThis.__uploadRateLimitStore || new Map();

if (!globalThis.__uploadRateLimitStore) {
  globalThis.__uploadRateLimitStore = uploadRateLimitStore;
}

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const firstIp = forwarded.split(",")[0].trim();
  return firstIp || "unknown";
}

function hitRateLimit(key) {
  const now = Date.now();
  const current = uploadRateLimitStore.get(key);

  if (!current || now - current.start >= RATE_LIMIT_WINDOW_MS) {
    uploadRateLimitStore.set(key, { count: 1, start: now });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  current.count += 1;
  uploadRateLimitStore.set(key, current);
  return false;
}

export async function POST(request) {
  try {
    const clientIp = getClientIp(request);
    if (hitRateLimit(`upload:${clientIp}`)) {
      return NextResponse.json(
        { success: false, error: "Too many upload attempts. Please retry in a minute." },
        { status: 429 }
      );
    }

    const phase1Response = await uploadPaymentScreenshot(request);
    const responseBody = await phase1Response.json();

    if (!phase1Response.ok || !responseBody?.success || !responseBody?.screenshot_url) {
      return NextResponse.json(
        {
          success: false,
          error: responseBody?.error || "Upload failed",
        },
        { status: phase1Response.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        url: responseBody.screenshot_url,
        screenshot_url: responseBody.screenshot_url,
      },
      { status: phase1Response.status }
    );
  } catch (error) {
    console.error("Upload compatibility route failed:", error);
    return NextResponse.json(
      { success: false, error: "Image upload failed. Please retry." },
      { status: 500 }
    );
  }
}