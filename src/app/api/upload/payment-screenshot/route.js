import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Buffer } from "buffer";
import { adminStorage } from "../../../../../firebaseAdmin";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);
const ALLOWED_REGISTRATION_TYPES = new Set(["workshop", "hackathon"]);

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

export async function POST(request) {
  try {
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

    const objectPath = `payments/${registrationType}/temp_${randomUUID()}.${extension}`;
    const downloadToken = randomUUID();
    const buffer = Buffer.from(await file.arrayBuffer());

    const storageFile = adminStorage.file(objectPath);
    await storageFile.save(buffer, {
      resumable: false,
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
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
