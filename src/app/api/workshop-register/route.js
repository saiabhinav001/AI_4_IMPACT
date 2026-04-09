import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../lib/admin";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const workshopRateLimitStore = globalThis.__workshopRateLimitStore || new Map();

if (!globalThis.__workshopRateLimitStore) {
  globalThis.__workshopRateLimitStore = workshopRateLimitStore;
}

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const firstIp = forwarded.split(",")[0].trim();
  return firstIp || "unknown";
}

function hitRateLimit(key) {
  const now = Date.now();
  const current = workshopRateLimitStore.get(key);
  if (!current || now - current.start >= RATE_LIMIT_WINDOW_MS) {
    workshopRateLimitStore.set(key, { count: 1, start: now });
    return false;
  }
  if (current.count >= RATE_LIMIT_MAX_REQUESTS) return true;
  current.count += 1;
  workshopRateLimitStore.set(key, current);
  return false;
}

function clean(value) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^\+?[0-9\-\s]{8,18}$/.test(phone);
}

export async function POST(request) {
  try {
    const clientIp = getClientIp(request);
    if (hitRateLimit(`workshop:${clientIp}`)) {
      return NextResponse.json(
        { success: false, error: "Too many workshop attempts. Please retry in a minute." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const fullName = clean(body?.fullName);
    const email = clean(body?.email).toLowerCase();
    const college = clean(body?.college);
    const phone = clean(body?.phone);
    const paymentScreenshotUrl = clean(body?.paymentScreenshotUrl);
    const paymentReference = clean(body?.paymentReference);

    if (!fullName || !email || !college || !phone || !paymentScreenshotUrl || !paymentReference) {
      return NextResponse.json(
        { success: false, error: "fullName, email, college, phone and payment details are required." },
        { status: 400 }
      );
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ success: false, error: "Invalid email." }, { status: 400 });
    }
    if (!isValidPhone(phone)) {
      return NextResponse.json({ success: false, error: "Invalid phone number." }, { status: 400 });
    }

    const ref = await adminDb.collection("workshop_registrations").add({
      uid: "",
      fullName,
      email,
      college,
      phone,
      payment: {
        screenshotUrl: paymentScreenshotUrl,
        reference: paymentReference,
        status: "PENDING",
      },
      source: "legacy_public_form",
      status: "PENDING",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, registrationId: ref.id });
  } catch {
    return NextResponse.json(
      { success: false, error: "Workshop registration failed. Please retry." },
      { status: 500 }
    );
  }
}
