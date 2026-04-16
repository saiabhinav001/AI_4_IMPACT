import { toRuntimeApiUrl } from "../../../lib/api-base";

type AnyObject = Record<string, unknown>;

function asTrimmedString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeKeyPart(value: unknown): string {
  return asTrimmedString(value)
    .toLowerCase()
    .replace(/[^a-z0-9@._:-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function parseErrorText(body: unknown, fallbackMessage: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const message = asTrimmedString((body as { error?: unknown }).error);
    if (message) {
      return message;
    }
  }

  return fallbackMessage;
}

function parseFieldErrors(body: unknown): Record<string, unknown> {
  if (body && typeof body === "object" && "field_errors" in body) {
    const value = (body as { field_errors?: unknown }).field_errors;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return {};
}

async function safeParseResponseBody(response: Response): Promise<unknown> {
  const contentType = asTrimmedString(response.headers.get("content-type")).toLowerCase();

  try {
    if (contentType.includes("application/json")) {
      return await response.json();
    }

    const text = asTrimmedString(await response.text());
    return text ? { error: text } : {};
  } catch {
    return {};
  }
}

export class RuntimeApiError extends Error {
  status: number;

  fieldErrors: Record<string, unknown>;

  responseBody: unknown;

  constructor(message: string, status: number, fieldErrors: Record<string, unknown>, responseBody: unknown) {
    super(message);
    this.name = "RuntimeApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.responseBody = responseBody;
  }
}

async function postJson<TResponse extends AnyObject>(
  path: string,
  payload: AnyObject,
  idempotencyKey: string
): Promise<TResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const normalizedIdempotencyKey = asTrimmedString(idempotencyKey);
  if (normalizedIdempotencyKey) {
    headers["x-idempotency-key"] = normalizedIdempotencyKey;
  }

  const requestBody = {
    ...payload,
    idempotency_key: normalizedIdempotencyKey || undefined,
  };

  const response = await fetch(toRuntimeApiUrl(path), {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  const responseBody = await safeParseResponseBody(response);
  if (!response.ok) {
    throw new RuntimeApiError(
      parseErrorText(responseBody, "Request failed."),
      response.status,
      parseFieldErrors(responseBody),
      responseBody
    );
  }

  return responseBody as TResponse;
}

export function createIdempotencyKey(scope: "workshop" | "hackathon", parts: unknown[]): string {
  const normalizedParts = parts
    .map(normalizeKeyPart)
    .filter(Boolean)
    .slice(0, 6);

  const segments = [scope, ...normalizedParts];
  return segments.join(":").slice(0, 240);
}

export async function uploadPaymentScreenshot(options: {
  file: File;
  registrationType: "workshop" | "hackathon";
}): Promise<string> {
  const formData = new FormData();
  formData.append("file", options.file);
  formData.append("registration_type", options.registrationType);

  const response = await fetch(toRuntimeApiUrl("/api/upload/payment-screenshot"), {
    method: "POST",
    body: formData,
  });

  const responseBody = await safeParseResponseBody(response);
  const screenshotUrl =
    responseBody && typeof responseBody === "object"
      ? asTrimmedString((responseBody as { screenshot_url?: unknown }).screenshot_url)
      : "";

  if (!response.ok || !screenshotUrl) {
    throw new RuntimeApiError(
      parseErrorText(responseBody, "Payment screenshot upload failed."),
      response.status,
      parseFieldErrors(responseBody),
      responseBody
    );
  }

  return screenshotUrl;
}

export type WorkshopMemberPayload = {
  name: string;
  email: string;
  phone: string;
  college: string;
  state: string;
  roll_number: string;
  branch: string;
  department: string;
  branch_selection: string;
  year_of_study: string;
  yearOfStudy: string;
  upi_transaction_id: string;
  screenshot_url: string;
};

export type HackathonMemberPayload = {
  name: string;
  email: string;
  phone: string;
  roll_number: string;
  branch: string;
  department: string;
  branch_selection: string;
  year_of_study: string;
  yearOfStudy: string;
  state: string;
};

export async function submitWorkshopRegistration(
  payload: WorkshopMemberPayload,
  idempotencyKey: string
): Promise<{ success: true; workshop_id: string; participant_id: string }> {
  return postJson<{ success: true; workshop_id: string; participant_id: string }>(
    "/api/register/workshop",
    payload,
    idempotencyKey
  );
}

export async function submitHackathonRegistration(
  payload: {
    team_name: string;
    college: string;
    state: string;
    team_size: number;
    members: HackathonMemberPayload[];
    upi_transaction_id: string;
    screenshot_url: string;
  },
  idempotencyKey: string
): Promise<{ success: true; team_id: string }> {
  return postJson<{ success: true; team_id: string }>(
    "/api/register/hackathon",
    payload,
    idempotencyKey
  );
}
