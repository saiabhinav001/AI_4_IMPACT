import { NextResponse } from 'next/server';
import { randomUUID } from "crypto";
import { adminStorage } from "../../../../lib/admin";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 8;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const uploadRateLimitStore = globalThis.__uploadRateLimitStore || new Map();

if (!globalThis.__uploadRateLimitStore) {
  globalThis.__uploadRateLimitStore = uploadRateLimitStore;
}

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const firstIp = forwarded.split(',')[0].trim();
  return firstIp || 'unknown';
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
        { success: false, error: 'Too many upload attempts. Please retry in a minute.' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("image");

    if (!file) {
      return NextResponse.json({ success: false, error: "No image file provided" }, { status: 400 });
    }

    if (!file.type?.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'Only image uploads are allowed' },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Image is too large. Max allowed size is 5MB.' },
        { status: 400 }
      );
    }

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const objectPath = `payments/${Date.now()}-${randomUUID()}.${ext}`;
    const blob = adminStorage.file(objectPath);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await blob.save(buffer, {
      resumable: false,
      metadata: { contentType: file.type },
    });

    const [signedUrl] = await blob.getSignedUrl({
      action: "read",
      expires: "2100-01-01",
    });

    return NextResponse.json({ success: true, url: signedUrl, path: objectPath });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Image upload failed. Please retry.' },
      { status: 500 }
    );
  }
}