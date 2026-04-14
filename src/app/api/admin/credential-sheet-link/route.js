import { NextResponse } from "next/server";
import { requireAdmin } from "../_utils/auth";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

const ENV = globalThis?.process?.env || {};

function asTrimmedString(value) {
  return String(value || "").trim();
}

function buildCredentialSheetUrl() {
  const explicitUrl = asTrimmedString(
    ENV.CREDENTIAL_SHEET_URL || ENV.GOOGLE_SHEETS_URL || ""
  );

  if (/^https?:\/\//i.test(explicitUrl)) {
    return explicitUrl;
  }

  const spreadsheetId = asTrimmedString(ENV.GOOGLE_SHEETS_SPREADSHEET_ID || "");
  if (!spreadsheetId) {
    return "";
  }

  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit`;
}

export async function GET(request) {
  const authResult = await requireAdmin(request);
  if (authResult.error) {
    return authResult.error;
  }

  const url = buildCredentialSheetUrl();
  if (!url) {
    return NextResponse.json(
      {
        success: false,
        configured: false,
        error: "Credential sheet link is not configured.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    configured: true,
    url,
    worksheet:
      asTrimmedString(
        ENV.CREDENTIAL_SHEET_WORKSHEET || ENV.GOOGLE_SHEETS_WORKSHEET || "Sheet1"
      ) || "Sheet1",
  });
}
