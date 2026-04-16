import {
  invalidateRuntimeCacheKey,
  invalidateRuntimeCachePrefix,
} from "../../../../../lib/server/runtime-cache";
import {
  ADMIN_REGISTRATIONS_CACHE_PREFIX,
  PUBLIC_EVENT_STATE_CACHE_KEY,
} from "../../../../../lib/server/runtime-cache-keys";

function runInvalidationSafe(invalidator, contextLabel) {
  try {
    invalidator();
  } catch (error) {
    console.error(`Runtime cache invalidation failed (${contextLabel}):`, error);
  }
}

export function invalidateAdminRegistrationsCache() {
  runInvalidationSafe(() => {
    invalidateRuntimeCachePrefix(ADMIN_REGISTRATIONS_CACHE_PREFIX);
  }, "admin-registrations");
}

export function invalidatePublicEventStateCache() {
  runInvalidationSafe(() => {
    invalidateRuntimeCacheKey(PUBLIC_EVENT_STATE_CACHE_KEY);
  }, "public-event-state");
}

export function invalidateCachesAfterAdminMutation({
  invalidateEventState = false,
} = {}) {
  invalidateAdminRegistrationsCache();

  if (invalidateEventState) {
    invalidatePublicEventStateCache();
  }
}
