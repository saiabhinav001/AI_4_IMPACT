import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Buffer } from "buffer";
import { adminStorage } from "../../../../../firebaseAdmin";

export const dynamic = "force-dynamic";

const ENV = globalThis?.process?.env || {};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);
const ALLOWED_REGISTRATION_TYPES = new Set(["workshop", "hackathon"]);
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 8;

const uploadRateLimitStore = globalThis.__paymentScreenshotUploadRateLimitStore || new Map();

if (!globalThis.__paymentScreenshotUploadRateLimitStore) {
  globalThis.__paymentScreenshotUploadRateLimitStore = uploadRateLimitStore;
}

function parseBooleanFlag(rawValue, fallbackValue = false) {
  const normalized = String(rawValue || "").trim().toLowerCase();
  if (!normalized) {
    return fallbackValue;
  }

  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off", "disabled"].includes(normalized)) {
    return false;
  }

  return fallbackValue;
}

const COMPRESSION_ENABLED = parseBooleanFlag(
  ENV.FEATURE_PAYMENT_SCREENSHOT_COMPRESSION_ENABLED,
  true
);

function asTrimmedString(value) {
  return String(value || "").trim();
}

function getClientIp(request) {
  const forwarded = asTrimmedString(request.headers.get("x-forwarded-for"));
  const firstIp = forwarded.split(",")[0].trim();
  return firstIp || "unknown";
}

function hitRateLimit(scopeKey) {
  const nowMs = Date.now();
  const entry = uploadRateLimitStore.get(scopeKey);

  if (!entry || nowMs - Number(entry.start || 0) >= RATE_LIMIT_WINDOW_MS) {
    uploadRateLimitStore.set(scopeKey, {
      count: 1,
      start: nowMs,
    });
    return false;
  }

  if (Number(entry.count || 0) >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  entry.count = Number(entry.count || 0) + 1;
  uploadRateLimitStore.set(scopeKey, entry);
  return false;
}

function extensionFromMimeType(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  return null;
}

function normalizeRegistrationType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (ALLOWED_REGISTRATION_TYPES.has(normalized)) {
    return normalized;
  }

  return null;
}

export const runtime = "nodejs";

async function loadSharp() {
  try {
    const sharpModule = await import("sharp");
    return sharpModule.default || sharpModule;
  } catch {
    return null;
  }
}

async function optimizeImageBuffer(buffer, contentType) {
  if (!COMPRESSION_ENABLED) {
    return {
      outputBuffer: buffer,
      outputContentType: contentType,
      outputExtension: extensionFromMimeType(contentType) || "jpg",
      compressed: false,
    };
  }

  const sharp = await loadSharp();
  if (!sharp) {
    return {
      outputBuffer: buffer,
      outputContentType: contentType,
      outputExtension: extensionFromMimeType(contentType) || "jpg",
      compressed: false,
    };
  }

  try {
    let pipeline = sharp(buffer, { failOnError: false }).rotate().resize({
      width: 1800,
      withoutEnlargement: true,
    });

    let optimizedBuffer = buffer;
    let outputContentType = contentType;
    let outputExtension = extensionFromMimeType(contentType) || "jpg";

    if (contentType === "image/png") {
      optimizedBuffer = await pipeline
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
        })
        .toBuffer();
      outputContentType = "image/png";
      outputExtension = "png";
    } else {
      optimizedBuffer = await pipeline
        .jpeg({
          quality: 82,
          mozjpeg: true,
        })
        .toBuffer();
      outputContentType = "image/jpeg";
      outputExtension = "jpg";
    }

    if (!optimizedBuffer.length || optimizedBuffer.length >= buffer.length) {
      return {
        outputBuffer: buffer,
        outputContentType: contentType,
        outputExtension: extensionFromMimeType(contentType) || "jpg",
        compressed: false,
      };
    }

    return {
      outputBuffer: optimizedBuffer,
      outputContentType,
      outputExtension,
      compressed: true,
    };
  } catch {
    return {
      outputBuffer: buffer,
      outputContentType: contentType,
      outputExtension: extensionFromMimeType(contentType) || "jpg",
      compressed: false,
    };
  }
}

export async function POST(request) {
  try {
    const clientIp = getClientIp(request);
    if (hitRateLimit(`upload-payment-screenshot:${clientIp}`)) {
      return NextResponse.json(
        { error: "Too many upload attempts. Please retry in a minute." },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") || formData.get("image");
    const registrationType = normalizeRegistrationType(
      formData.get("registration_type") || formData.get("registrationType")
    );

    if (!registrationType) {
      return NextResponse.json(
        {
          error:
            "registration_type is required and must be either workshop or hackathon.",
        },
        { status: 400 }
      );
    }

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json(
        { error: "No image file provided." },
        { status: 400 }
      );
    }

    const contentType = String(file.type || "").toLowerCase();
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Only JPG and PNG files are allowed." },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Image exceeds 5MB limit." },
        { status: 400 }
      );
    }

    const extension = extensionFromMimeType(contentType);
    if (!extension) {
      return NextResponse.json(
        { error: "Invalid image format." },
        { status: 400 }
      );
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const {
      outputBuffer,
      outputContentType,
      outputExtension,
      compressed,
    } = await optimizeImageBuffer(inputBuffer, contentType);

    if (outputBuffer.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Image exceeds 5MB limit after processing." },
        { status: 400 }
      );
    }

    const objectPath = `payments/${registrationType}/temp_${randomUUID()}.${outputExtension}`;
    const downloadToken = randomUUID();

    const storageFile = adminStorage.file(objectPath);
    await storageFile.save(outputBuffer, {
      resumable: false,
      metadata: {
        contentType: outputContentType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          originalContentType: contentType,
          compressed: compressed ? "true" : "false",
        },
      },
    });

    const screenshot_url = `https://firebasestorage.googleapis.com/v0/b/${adminStorage.name}/o/${encodeURIComponent(
      objectPath
    )}?alt=media&token=${downloadToken}`;

    return NextResponse.json({
      success: true,
      registration_type: registrationType,
      screenshot_url,
    });
  } catch (error) {
    console.error("Payment screenshot upload failed:", error);
    return NextResponse.json(
      { error: "Failed to upload payment screenshot." },
      { status: 500 }
    );
  }
}
