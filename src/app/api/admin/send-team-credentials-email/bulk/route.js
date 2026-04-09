import { NextResponse } from "next/server";
import { requireAdmin } from "../../_utils/auth";
import { queueCredentialEmail } from "../../_utils/credential-email";

export const runtime = "nodejs";

const MAX_BULK_ITEMS = 150;

function asTrimmedString(value) {
  return String(value || "").trim();
}

export async function POST(request) {
  const authResult = await requireAdmin(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const force = body?.force === true;
    const rawTransactionIds = Array.isArray(body?.transaction_ids)
      ? body.transaction_ids
      : [];

    const transactionIds = [...new Set(
      rawTransactionIds
        .map((value) => asTrimmedString(value))
        .filter(Boolean)
    )];

    if (transactionIds.length === 0) {
      return NextResponse.json(
        { error: "transaction_ids (non-empty array) is required." },
        { status: 400 }
      );
    }

    if (transactionIds.length > MAX_BULK_ITEMS) {
      return NextResponse.json(
        {
          error: `Maximum ${MAX_BULK_ITEMS} transaction_ids are allowed per bulk request.`,
        },
        { status: 400 }
      );
    }

    const results = [];
    let queued = 0;
    let skipped = 0;
    let failed = 0;

    for (const transactionId of transactionIds) {
      const result = await queueCredentialEmail({
        transactionId,
        adminUid: authResult.decodedToken.uid,
        force,
        requestOrigin: request.headers.get("origin") || "",
        source: "bulk",
      });

      if (result.success) {
        queued += 1;
      } else if (Number(result.status || 500) >= 500) {
        failed += 1;
      } else {
        skipped += 1;
      }

      results.push({
        transaction_id: transactionId,
        success: result.success === true,
        status: result.status || 500,
        code: result.code || null,
        error: result.error || null,
        retry_after_seconds: result.retry_after_seconds || null,
        email_delivery: result.email_delivery || null,
      });
    }

    return NextResponse.json({
      success: true,
      summary: {
        requested: transactionIds.length,
        queued,
        skipped,
        failed,
      },
      results,
    });
  } catch (error) {
    console.error("Bulk credential email queue failed:", error);
    return NextResponse.json(
      { error: "Failed to process bulk credential email queue request." },
      { status: 500 }
    );
  }
}
