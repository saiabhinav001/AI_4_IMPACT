import {
  asTrimmedString,
  getBooleanFlag,
  getNumberFlag,
  parseCliFlags,
  resolveBaseUrl,
  truncateText,
} from "./_problem-selection-test-utils.mjs";

function toMillis(value) {
  if (!value) {
    return NaN;
  }

  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? NaN : parsed;
}

function formatCountdown(msRemaining) {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (days > 0) {
    return `${days}D ${hh}:${mm}:${ss}`;
  }

  return `${hh}:${mm}:${ss}`;
}

function normalizeStatus(value) {
  return asTrimmedString(value).toUpperCase();
}

async function readPublicEventState(baseUrl) {
  const url = `${baseUrl}/api/public/event-state`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "cache-control": "no-store",
      pragma: "no-cache",
    },
  });

  const responseText = await response.text();
  const contentType = asTrimmedString(response.headers.get("content-type") || "").toLowerCase();

  if (!response.ok) {
    throw new Error(
      `Public event state request failed (${response.status}): ${truncateText(responseText)}`
    );
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      `Public event state returned non-JSON content-type: ${contentType || "unknown"}`
    );
  }

  const payload = responseText ? JSON.parse(responseText) : {};

  return {
    payload,
    runtimeCache: asTrimmedString(response.headers.get("x-runtime-cache") || ""),
  };
}

async function waitMs(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  const flags = parseCliFlags();

  const baseUrl = resolveBaseUrl(flags);
  const timeoutSeconds = Math.max(10, Math.floor(getNumberFlag(flags, "timeout-seconds", 240)));
  const pollIntervalMs = Math.max(1000, Math.floor(getNumberFlag(flags, "poll-interval-ms", 3000)));
  const expectTransition = getBooleanFlag(flags, "expect-transition", true);

  const startedAtMs = Date.now();
  const deadlineMs = startedAtMs + timeoutSeconds * 1000;

  let initialStatus = "";
  let previousStatus = "";
  let finalStatus = "";
  let sampledReleaseAt = "";

  while (Date.now() <= deadlineMs) {
    const sample = await readPublicEventState(baseUrl);
    const eventState = sample?.payload?.eventState || {};
    const problemState = eventState?.problemStatements || {};

    const status = normalizeStatus(problemState?.status);
    const releaseAt = asTrimmedString(problemState?.releaseAt || "");
    const releaseAtMs = toMillis(releaseAt);

    if (!initialStatus) {
      initialStatus = status || "UNKNOWN";
      sampledReleaseAt = releaseAt;
    }

    if (status !== previousStatus) {
      const remaining = Number.isFinite(releaseAtMs)
        ? formatCountdown(releaseAtMs - Date.now())
        : "N/A";

      console.log(
        `status=${status || "UNKNOWN"} releaseAt=${releaseAt || "null"} remaining=${remaining} cache=${sample.runtimeCache || "N/A"}`
      );
      previousStatus = status;
    }

    finalStatus = status;

    if (status === "LIVE") {
      break;
    }

    await waitMs(pollIntervalMs);
  }

  if (expectTransition && initialStatus === "SCHEDULED" && finalStatus !== "LIVE") {
    throw new Error(
      `Timer transition failed. Initial status SCHEDULED did not become LIVE before timeout (${timeoutSeconds}s).`
    );
  }

  if (expectTransition && initialStatus === "DISABLED") {
    throw new Error("Problem statements are DISABLED. Enable and arm timer before verification.");
  }

  if (expectTransition && finalStatus !== "LIVE" && initialStatus !== "LIVE") {
    throw new Error(
      `Timer verification ended with status ${finalStatus || "UNKNOWN"}. Expected LIVE.`
    );
  }

  const elapsedSeconds = Math.floor((Date.now() - startedAtMs) / 1000);
  console.log(`timer_verification=ok initial=${initialStatus || "UNKNOWN"} final=${finalStatus || "UNKNOWN"} releaseAt=${sampledReleaseAt || "null"} elapsed_seconds=${elapsedSeconds}`);
}

main().catch((error) => {
  console.error(`Timer verification failed: ${error.message}`);
  process.exit(1);
});
