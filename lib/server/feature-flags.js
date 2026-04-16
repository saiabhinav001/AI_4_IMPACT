const ENV = globalThis?.process?.env || {};

function parseBooleanFlag(rawValue, fallbackValue = false) {
  const normalized = String(rawValue || "").trim().toLowerCase();
  if (!normalized) {
    return fallbackValue;
  }

  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off", "disabled"].includes(normalized)) {
    return false;
  }

  return fallbackValue;
}

export const SERVER_FEATURE_FLAGS = Object.freeze({
  adminReadModelEnabled: parseBooleanFlag(ENV.FEATURE_ADMIN_READ_MODEL_ENABLED, false),
  adminAdaptivePollingEnabled: parseBooleanFlag(ENV.FEATURE_ADMIN_ADAPTIVE_POLLING_ENABLED, false),
  adminRegistrationsCacheEnabled: parseBooleanFlag(
    ENV.FEATURE_ADMIN_REGISTRATIONS_CACHE_ENABLED,
    true
  ),
  publicEventStateCacheEnabled: parseBooleanFlag(
    ENV.FEATURE_PUBLIC_EVENT_STATE_CACHE_ENABLED,
    true
  ),
  registrationApiWritePathEnabled: parseBooleanFlag(ENV.FEATURE_REGISTRATION_API_WRITE_PATH_ENABLED, false),
  strictPublicFirestoreRulesEnabled: parseBooleanFlag(ENV.FEATURE_STRICT_PUBLIC_FIRESTORE_RULES_ENABLED, false),
});

export function getServerFeatureFlags() {
  return SERVER_FEATURE_FLAGS;
}
