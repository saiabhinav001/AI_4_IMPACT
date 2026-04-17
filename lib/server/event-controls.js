const IMPLEMENTATION_PHASES = Object.freeze([
  { id: 1, key: "control-plane", label: "Control Plane Foundation" },
  { id: 2, key: "experience-readiness", label: "Experience Readiness" },
  { id: 3, key: "registration-enforcement", label: "Registration Enforcement" },
  { id: 4, key: "problem-freeze-flow", label: "Problem Freeze Flow" },
  { id: 5, key: "team-editing-controls", label: "Team Editing Controls" },
]);

export const EVENT_CONTROLS_COLLECTION = "event_controls";
export const EVENT_CONTROLS_DOC_ID = "global";
export const EVENT_TIME_ZONE = "Asia/Kolkata";
export const EVENT_TIME_ZONE_LABEL = "IST (Asia/Kolkata)";

export const EVENT_CONTROL_IMPLEMENTATION_TOTAL_PHASES = IMPLEMENTATION_PHASES.length;
export const EVENT_CONTROL_IMPLEMENTATION_CURRENT_PHASE = 5;

const REGISTRATION_TRACKS = new Set(["workshop", "hackathon"]);
const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

function asTrimmedString(value) {
  return String(value || "").trim();
}

function toIsoString(value) {
  if (!value) {
    return null;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asBoolean(value, fallbackValue) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallbackValue;
}

function hasExplicitTimeZone(text) {
  return /[zZ]|[+\-]\d{2}:\d{2}$/.test(text);
}

function parseDateAsIst(text) {
  const match = String(text || "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);
  const seconds = Number(match[6] || 0);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds)
  ) {
    return null;
  }

  const utcMs = Date.UTC(year, month - 1, day, hours, minutes, seconds) - IST_OFFSET_MS;
  const date = new Date(utcMs);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseConfiguredDate(text) {
  if (!text) {
    return null;
  }

  if (hasExplicitTimeZone(text)) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return parseDateAsIst(text) || (Number.isNaN(new Date(text).getTime()) ? null : new Date(text));
}

function parseOptionalIsoString(value, fallbackValue, fieldPath) {
  if (value === undefined) {
    return fallbackValue;
  }

  const text = asTrimmedString(value);
  if (!text) {
    return null;
  }

  const date = parseConfiguredDate(text);
  if (!date || Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp for ${fieldPath}. Use a valid ISO datetime.`);
  }

  return date.toISOString();
}

function normalizeWindowInput(windowInput, fallbackWindow, fieldPrefix) {
  const source = windowInput && typeof windowInput === "object" ? windowInput : {};

  return {
    enabled: asBoolean(source.enabled, fallbackWindow.enabled),
    openAt: parseOptionalIsoString(
      source.openAt,
      fallbackWindow.openAt,
      `${fieldPrefix}.openAt`
    ),
    closeAt: parseOptionalIsoString(
      source.closeAt,
      fallbackWindow.closeAt,
      `${fieldPrefix}.closeAt`
    ),
  };
}

function normalizeStoredWindow(windowInput, fallbackWindow) {
  const source = windowInput && typeof windowInput === "object" ? windowInput : {};

  return {
    enabled: asBoolean(source.enabled, fallbackWindow.enabled),
    openAt: toIsoString(source.openAt) || fallbackWindow.openAt,
    closeAt: toIsoString(source.closeAt) || fallbackWindow.closeAt,
  };
}

function parsePhaseMetadata() {
  const phase =
    IMPLEMENTATION_PHASES.find(
      (item) => item.id === EVENT_CONTROL_IMPLEMENTATION_CURRENT_PHASE
    ) || IMPLEMENTATION_PHASES[0];

  return {
    currentPhase: phase.id,
    totalPhases: EVENT_CONTROL_IMPLEMENTATION_TOTAL_PHASES,
    phaseKey: phase.key,
    phaseLabel: phase.label,
  };
}

export function getEventControlImplementationStatus() {
  return parsePhaseMetadata();
}

export function buildDefaultEventControls() {
  return {
    registration: {
      workshop: {
        enabled: true,
        openAt: null,
        closeAt: null,
      },
      hackathon: {
        enabled: true,
        openAt: null,
        closeAt: null,
      },
    },
    problemStatements: {
      enabled: false,
      releaseAt: null,
    },
    timer: {
      enabled: false,
      openAt: null,
      closeAt: null,
    },
    freeze: {
      enabled: false,
      openAt: null,
      closeAt: null,
      adminOverrideEnabled: true,
    },
    metadata: {
      version: 0,
      updatedAt: null,
      updatedByUid: "",
      updatedByEmail: "",
    },
  };
}

export function normalizeStoredEventControls(rawControls) {
  const defaults = buildDefaultEventControls();
  const source = rawControls && typeof rawControls === "object" ? rawControls : {};
  const sourceRegistration =
    source.registration && typeof source.registration === "object"
      ? source.registration
      : {};
  const sourceTimer = source.timer && typeof source.timer === "object" ? source.timer : {};

  const sourceMetadata = source.metadata && typeof source.metadata === "object" ? source.metadata : {};
  const metadataVersion = Number(sourceMetadata.version);

  return {
    registration: {
      workshop: normalizeStoredWindow(
        sourceRegistration.workshop,
        defaults.registration.workshop
      ),
      hackathon: normalizeStoredWindow(
        sourceRegistration.hackathon,
        defaults.registration.hackathon
      ),
    },
    problemStatements: {
      enabled: asBoolean(source?.problemStatements?.enabled, defaults.problemStatements.enabled),
      releaseAt:
        toIsoString(source?.problemStatements?.releaseAt) || defaults.problemStatements.releaseAt,
    },
    timer: normalizeStoredWindow(sourceTimer, defaults.timer),
    freeze: {
      ...normalizeStoredWindow(source.freeze, defaults.freeze),
      adminOverrideEnabled: asBoolean(
        source?.freeze?.adminOverrideEnabled,
        defaults.freeze.adminOverrideEnabled
      ),
    },
    metadata: {
      version:
        Number.isFinite(metadataVersion) && metadataVersion >= 0
          ? Math.floor(metadataVersion)
          : defaults.metadata.version,
      updatedAt: toIsoString(sourceMetadata.updatedAt) || defaults.metadata.updatedAt,
      updatedByUid: asTrimmedString(sourceMetadata.updatedByUid),
      updatedByEmail: asTrimmedString(sourceMetadata.updatedByEmail).toLowerCase(),
    },
  };
}

export function mergeEventControlsInput(inputControls, fallbackControls) {
  const fallback = normalizeStoredEventControls(fallbackControls);
  const source = inputControls && typeof inputControls === "object" ? inputControls : {};
  const sourceRegistration =
    source.registration && typeof source.registration === "object"
      ? source.registration
      : {};

  const sourceProblem =
    source.problemStatements && typeof source.problemStatements === "object"
      ? source.problemStatements
      : {};

  const sourceTimer = source.timer && typeof source.timer === "object" ? source.timer : {};
  const sourceFreeze = source.freeze && typeof source.freeze === "object" ? source.freeze : {};
  const sourceMetadata =
    source.metadata && typeof source.metadata === "object" ? source.metadata : {};

  return {
    registration: {
      workshop: normalizeWindowInput(
        sourceRegistration.workshop,
        fallback.registration.workshop,
        "registration.workshop"
      ),
      hackathon: normalizeWindowInput(
        sourceRegistration.hackathon,
        fallback.registration.hackathon,
        "registration.hackathon"
      ),
    },
    problemStatements: {
      enabled: asBoolean(sourceProblem.enabled, fallback.problemStatements.enabled),
      releaseAt: parseOptionalIsoString(
        sourceProblem.releaseAt,
        fallback.problemStatements.releaseAt,
        "problemStatements.releaseAt"
      ),
    },
    timer: normalizeWindowInput(sourceTimer, fallback.timer, "timer"),
    freeze: {
      ...normalizeWindowInput(sourceFreeze, fallback.freeze, "freeze"),
      adminOverrideEnabled: asBoolean(
        sourceFreeze.adminOverrideEnabled,
        fallback.freeze.adminOverrideEnabled
      ),
    },
    metadata: {
      version: fallback.metadata.version,
      updatedAt: fallback.metadata.updatedAt,
      updatedByUid: asTrimmedString(sourceMetadata.updatedByUid || fallback.metadata.updatedByUid),
      updatedByEmail: asTrimmedString(
        sourceMetadata.updatedByEmail || fallback.metadata.updatedByEmail
      ).toLowerCase(),
    },
  };
}

function pushWindowOrderValidationError(errors, fieldName, windowConfig) {
  const openMs = Date.parse(windowConfig?.openAt || "");
  const closeMs = Date.parse(windowConfig?.closeAt || "");

  if (Number.isFinite(openMs) && Number.isFinite(closeMs) && closeMs <= openMs) {
    errors.push(`${fieldName}.closeAt must be later than ${fieldName}.openAt.`);
  }
}

export function validateEventControls(controls) {
  const errors = [];

  pushWindowOrderValidationError(errors, "registration.workshop", controls?.registration?.workshop);
  pushWindowOrderValidationError(errors, "registration.hackathon", controls?.registration?.hackathon);
  pushWindowOrderValidationError(errors, "timer", controls?.timer);
  pushWindowOrderValidationError(errors, "freeze", controls?.freeze);

  return errors;
}

function evaluateWindowStatus(windowConfig, nowMs) {
  const enabled = windowConfig?.enabled === true;
  if (!enabled) {
    return "DISABLED";
  }

  const openMs = Date.parse(windowConfig?.openAt || "");
  const closeMs = Date.parse(windowConfig?.closeAt || "");

  if (Number.isFinite(openMs) && nowMs < openMs) {
    return "SCHEDULED";
  }

  if (Number.isFinite(closeMs) && nowMs >= closeMs) {
    return "CLOSED";
  }

  return "OPEN";
}

function evaluateReleaseStatus(problemConfig, nowMs) {
  if (problemConfig?.enabled !== true) {
    return "DISABLED";
  }

  const releaseMs = Date.parse(problemConfig?.releaseAt || "");
  if (Number.isFinite(releaseMs) && nowMs < releaseMs) {
    return "SCHEDULED";
  }

  return "LIVE";
}

export function buildPublicEventState(controls, nowDate = new Date()) {
  const normalizedControls = normalizeStoredEventControls(controls);
  const nowMs = nowDate.getTime();
  const nowIso = nowDate.toISOString();

  const workshopStatus = evaluateWindowStatus(
    normalizedControls.registration.workshop,
    nowMs
  );
  const hackathonStatus = evaluateWindowStatus(
    normalizedControls.registration.hackathon,
    nowMs
  );
  const problemStatementStatus = evaluateReleaseStatus(
    normalizedControls.problemStatements,
    nowMs
  );
  const timerStatus = evaluateWindowStatus(normalizedControls.timer, nowMs);
  const freezeStatus = evaluateWindowStatus(normalizedControls.freeze, nowMs);

  return {
    now: nowIso,
    registration: {
      workshop: {
        ...normalizedControls.registration.workshop,
        status: workshopStatus,
        isOpen: workshopStatus === "OPEN",
      },
      hackathon: {
        ...normalizedControls.registration.hackathon,
        status: hackathonStatus,
        isOpen: hackathonStatus === "OPEN",
      },
    },
    problemStatements: {
      ...normalizedControls.problemStatements,
      status: problemStatementStatus,
      isLive: problemStatementStatus === "LIVE",
    },
    timer: {
      ...normalizedControls.timer,
      status: timerStatus,
      isOpen: timerStatus === "OPEN",
    },
    freeze: {
      ...normalizedControls.freeze,
      status: freezeStatus,
      isOpen: freezeStatus === "OPEN",
    },
  };
}

function asSupportedRegistrationTrack(track) {
  const normalized = String(track || "").trim().toLowerCase();
  if (!REGISTRATION_TRACKS.has(normalized)) {
    throw new Error("Unsupported registration track. Use 'workshop' or 'hackathon'.");
  }

  return normalized;
}

function formatIstDateLabel(value) {
  const iso = asTrimmedString(value);
  if (!iso) {
    return "configured schedule";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "configured schedule";
  }

  return `${date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: EVENT_TIME_ZONE,
    timeZoneName: "short",
  })} ${EVENT_TIME_ZONE_LABEL}`;
}

export function getRegistrationWindowState(controls, track, nowDate = new Date()) {
  const supportedTrack = asSupportedRegistrationTrack(track);
  const effectiveState = buildPublicEventState(controls, nowDate);
  const trackState = effectiveState?.registration?.[supportedTrack] || {};

  const status = asTrimmedString(trackState.status).toUpperCase() || "OPEN";

  return {
    track: supportedTrack,
    status,
    isOpen: status === "OPEN",
    enabled: trackState.enabled === true,
    openAt: trackState.openAt || null,
    closeAt: trackState.closeAt || null,
  };
}

export function buildRegistrationGateResult(controls, track, nowDate = new Date()) {
  const windowState = getRegistrationWindowState(controls, track, nowDate);
  const trackLabel =
    windowState.track === "workshop" ? "Workshop" : "Hackathon";

  if (windowState.isOpen) {
    return {
      allowed: true,
      message: "",
      window: windowState,
    };
  }

  if (windowState.status === "SCHEDULED") {
    return {
      allowed: false,
      message: `${trackLabel} registration is not open yet. Opens at ${formatIstDateLabel(
        windowState.openAt
      )}.`,
      window: windowState,
    };
  }

  if (windowState.status === "CLOSED") {
    return {
      allowed: false,
      message: `${trackLabel} registration window is closed.`,
      window: windowState,
    };
  }

  if (windowState.status === "DISABLED") {
    return {
      allowed: false,
      message: `${trackLabel} registration is currently disabled by the event control panel.`,
      window: windowState,
    };
  }

  return {
    allowed: false,
    message: `${trackLabel} registration is unavailable right now. Please try again later.`,
    window: windowState,
  };
}