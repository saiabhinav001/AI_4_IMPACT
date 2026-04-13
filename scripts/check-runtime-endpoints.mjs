import process from "node:process";

const baseArg = String(process.argv[2] || "").trim();
const baseEnv = String(process.env.APP_BASE_URL || "").trim();
const baseUrl = (baseArg || baseEnv).replace(/\/$/, "");

if (!baseUrl) {
  console.error("Missing base URL. Usage: APP_BASE_URL=https://your-domain npm run health:runtime");
  process.exit(1);
}

const checks = [
  {
    name: "Home page",
    path: "/",
    method: "GET",
    expectedStatuses: [200],
    expectJson: false,
  },
  {
    name: "Team dashboard API runtime",
    path: "/api/team/dashboard",
    method: "GET",
    expectedStatuses: [401, 403],
    expectJson: true,
  },
  {
    name: "Team access resolve API runtime",
    path: "/api/team/access/resolve",
    method: "POST",
    expectedStatuses: [400],
    expectJson: true,
    body: {},
  },
  {
    name: "Admin session API runtime",
    path: "/api/admin/session",
    method: "POST",
    expectedStatuses: [400],
    expectJson: true,
    body: {},
  },
];

function shortText(value, max = 180) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

async function runCheck(check) {
  const url = `${baseUrl}${check.path}`;
  const headers = {};
  let body;

  if (check.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(check.body);
  }

  let response;
  let responseText = "";

  try {
    response = await fetch(url, {
      method: check.method,
      headers,
      body,
      redirect: "manual",
    });

    responseText = await response.text();
  } catch (error) {
    return {
      ok: false,
      name: check.name,
      url,
      reason: `Network error: ${error?.message || String(error)}`,
    };
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const isJson = contentType.includes("application/json");
  const statusOk = check.expectedStatuses.includes(response.status);

  if (!statusOk) {
    return {
      ok: false,
      name: check.name,
      url,
      reason: `Unexpected status ${response.status}. Expected: ${check.expectedStatuses.join(", ")}`,
      details: shortText(responseText),
    };
  }

  if (check.expectJson && !isJson) {
    return {
      ok: false,
      name: check.name,
      url,
      reason: `Expected JSON response but received content-type '${contentType || "unknown"}'.`,
      details: shortText(responseText),
    };
  }

  return {
    ok: true,
    name: check.name,
    url,
    status: response.status,
    contentType,
  };
}

async function main() {
  console.log(`Running runtime checks against ${baseUrl}`);

  const results = [];
  for (const check of checks) {
    const result = await runCheck(check);
    results.push(result);

    if (result.ok) {
      console.log(`PASS | ${result.name} | ${result.status} | ${result.url}`);
    } else {
      console.error(`FAIL | ${result.name} | ${result.url}`);
      console.error(`  Reason: ${result.reason}`);
      if (result.details) {
        console.error(`  Response: ${result.details}`);
      }
    }
  }

  const failures = results.filter((item) => !item.ok);
  if (failures.length > 0) {
    console.error(`Runtime checks failed: ${failures.length}/${results.length}`);
    process.exit(1);
  }

  console.log(`All runtime checks passed: ${results.length}/${results.length}`);
}

main().catch((error) => {
  console.error(`Runtime check script failed: ${error?.message || String(error)}`);
  process.exit(1);
});
