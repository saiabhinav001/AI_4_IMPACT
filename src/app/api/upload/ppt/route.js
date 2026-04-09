import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { adminStorage } from "../../../../../lib/admin";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const teamId = String(formData.get("teamId") || "").trim();

    if (!file || !teamId) {
      return NextResponse.json(
        { success: false, error: "file and teamId are required." },
        { status: 400 }
      );
    }

    const validTypes = [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/pdf",
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Only PPT, PPTX or PDF is allowed." },
        { status: 400 }
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: "File too large. Max 20MB." },
        { status: 400 }
      );
    }

    const ext = file.type.includes("presentationml") ? "pptx" : file.type.includes("powerpoint") ? "ppt" : "pdf";
    const objectPath = `submissions/${teamId}/${Date.now()}-${randomUUID()}.${ext}`;
    const blob = adminStorage.file(objectPath);
    const buffer = Buffer.from(await file.arrayBuffer());
    await blob.save(buffer, {
      resumable: false,
      metadata: { contentType: file.type },
    });

    const [signedUrl] = await blob.getSignedUrl({
      action: "read",
      expires: "2100-01-01",
    });

    return NextResponse.json({ success: true, url: signedUrl, path: objectPath });
  } catch {
    return NextResponse.json(
      { success: false, error: "PPT upload failed." },
      { status: 500 }
    );
  }
}
