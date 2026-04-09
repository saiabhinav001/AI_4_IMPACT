import { NextResponse } from "next/server";
import { requireAdmin } from "../_utils/auth";
import { queueCredentialEmail } from "../_utils/credential-email";

export const runtime = "nodejs";

export async function POST(request) {
  const authResult = await requireAdmin(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const result = await queueCredentialEmail({
      transactionId: body?.transaction_id,
      adminUid: authResult.decodedToken.uid,
      force: body?.force === true,
      requestOrigin: request.headers.get("origin") || "",
      source: "single",
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          email_delivery: result.email_delivery || null,
          retry_after_seconds: result.retry_after_seconds || null,
        },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      email_delivery: result.email_delivery,
    });
  } catch (error) {
    console.error("Failed to process credential email request:", error);
    return NextResponse.json(
      { error: "Failed to queue credential email." },
      { status: 500 }
    );
  }
}
