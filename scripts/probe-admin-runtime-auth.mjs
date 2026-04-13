import { adminAuth } from "../firebaseAdmin.js";
import { RUNTIME_ID_TOKEN_HEADER } from "../lib/runtime-auth.js";

function asTrimmed(value) {
  return String(value || "").trim();
}

function firstArg(index, fallback = "") {
  return asTrimmed(process.argv[index] || fallback);
}

function truncateBody(value, maxLength = 220) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

async function signInWithCustomToken({ apiKey, customToken }) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    }
  );

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Custom token sign-in failed (${response.status}): ${truncateBody(responseText)}`
    );
  }

  const parsed = responseText ? JSON.parse(responseText) : {};
  const idToken = asTrimmed(parsed.idToken);

  if (!idToken) {
    throw new Error("Custom token sign-in response did not include idToken.");
  }

  return idToken;
}

async function runAuthenticatedProbe({ baseUrl, idToken }) {
  const missingTransactionId = "probe-missing-tx-404";

  const testCases = [
    {
      method: "GET",
      path: "/api/admin/registrations",
      body: null,
      allowedStatuses: [200],
      name: "Registrations listing",
    },
    {
      method: "POST",
      path: "/api/admin/verify-payment",
      body: {
        transaction_id: missingTransactionId,
        action: "verify",
      },
      allowedStatuses: [404],
      name: "Verify payment (missing tx)",
    },
    {
      method: "POST",
      path: "/api/admin/regenerate-team-credentials",
      body: {
        transaction_id: missingTransactionId,
      },
      allowedStatuses: [404],
      name: "Regenerate credentials (missing tx)",
    },
    {
      method: "POST",
      path: "/api/admin/send-team-credentials-email",
      body: {
        transaction_id: missingTransactionId,
      },
      allowedStatuses: [404],
      name: "Send credential email (missing tx)",
    },
    {
      method: "POST",
      path: "/api/admin/send-team-credentials-email/bulk",
      body: {
        transaction_ids: [missingTransactionId],
      },
      allowedStatuses: [200],
      name: "Bulk send (missing tx)",
    },
    {
      method: "POST",
      path: "/api/admin/delete-registration",
      body: {
        transaction_id: missingTransactionId,
      },
      allowedStatuses: [404],
      name: "Delete registration (missing tx)",
    },
  ];

  const outcomes = [];

  for (const testCase of testCases) {
    const requestUrl = `${baseUrl}${testCase.path}`;
    const requestOptions = {
      method: testCase.method,
      headers: {
        [RUNTIME_ID_TOKEN_HEADER]: idToken,
      },
    };

    if (testCase.body !== null) {
      requestOptions.headers["content-type"] = "application/json";
      requestOptions.body = JSON.stringify(testCase.body);
    }

    const response = await fetch(requestUrl, requestOptions);
    const responseBody = await response.text();
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();

    const statusAllowed = testCase.allowedStatuses.includes(response.status);
    const authRejected = response.status === 401 || response.status === 403;
    const jsonLike = contentType.includes("application/json");

    const passed = statusAllowed && jsonLike && !authRejected;

    outcomes.push({
      ...testCase,
      status: response.status,
      contentType,
      passed,
      body: truncateBody(responseBody),
    });
  }

  return outcomes;
}

async function main() {
  const baseUrl = firstArg(2, "https://ai4impact.web.app").replace(/\/$/, "");
  const apiKey =
    firstArg(3) ||
    asTrimmed(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) ||
    asTrimmed(process.env.FIREBASE_WEB_API_KEY);

  if (!apiKey) {
    throw new Error(
      "Missing Firebase Web API key. Pass it as arg2 or set NEXT_PUBLIC_FIREBASE_API_KEY."
    );
  }

  const probeUid = `runtime-admin-probe-${Date.now()}`;
  let cleanupStatus = "not-run";

  try {
    const customToken = await adminAuth.createCustomToken(probeUid, { admin: true });
    const idToken = await signInWithCustomToken({ apiKey, customToken });
    const outcomes = await runAuthenticatedProbe({ baseUrl, idToken });

    console.log(`Authenticated admin runtime probe: ${baseUrl}`);

    let passedCount = 0;
    for (const result of outcomes) {
      const marker = result.passed ? "PASS" : "FAIL";
      if (result.passed) {
        passedCount += 1;
      }

      console.log(
        `${marker} | ${result.name} | ${result.method} ${result.path} | ${result.status} | ${result.contentType}`
      );
      console.log(`  body: ${result.body}`);
    }

    console.log(`Summary: ${passedCount}/${outcomes.length} probes passed`);

    if (passedCount !== outcomes.length) {
      process.exitCode = 1;
    }
  } finally {
    try {
      await adminAuth.deleteUser(probeUid);
      cleanupStatus = "deleted";
    } catch {
      cleanupStatus = "skipped";
    }

    console.log(`Probe auth-user cleanup: ${cleanupStatus} (${probeUid})`);
  }
}

main().catch((error) => {
  console.error(`Probe failed: ${error.message}`);
  process.exit(1);
});
