"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getUserRole, logoutAdmin, onUserAuthChange } from "../../../../lib/auth";
import { toRuntimeApiUrl } from "../../../../lib/api-base";
import { buildRuntimeIdTokenHeaders } from "../../../../lib/runtime-auth";
import { ROLES } from "../../../../lib/constants/roles";
import { db } from "../../../../lib/firebase";
import {
  loadAdminRegistrationsFromClient,
  updatePaymentStatusFromClient,
} from "../../../../lib/admin-client";
import {
  API_RUNTIME_NOTICE,
  canSendCredentialEmailForRegistration,
  classifyEmailStateBucket,
  formatDateTime,
  getEmailStateMeta,
  getLeaderContact,
  getLeaderName,
  getStatusMeta,
  isBulkSendCandidate,
  isInFlightEmailState,
  mapRegistrationItem,
  normalizeEmailDeliveryState,
  PAGE_SIZE,
  toDateSafe,
  toEmailDelivery,
} from "../_lib/adminData";

const ENV = globalThis?.process?.env || {};
const DEFAULT_CREDENTIAL_SHEET_URL = String(
  ENV.NEXT_PUBLIC_CREDENTIAL_SHEET_URL || ""
).trim();

function toPositiveInteger(value, fallbackValue) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallbackValue;
  }

  return Math.floor(numeric);
}

function clampPositiveInteger(value, minValue, maxValue, fallbackValue) {
  const parsed = toPositiveInteger(value, fallbackValue);
  return Math.min(maxValue, Math.max(minValue, parsed));
}

const DEFAULT_ADMIN_POLL_MS = clampPositiveInteger(
  ENV.NEXT_PUBLIC_ADMIN_POLL_DEFAULT_MS,
  120000,
  300000,
  180000
);
const FAST_ADMIN_POLL_MS = clampPositiveInteger(
  ENV.NEXT_PUBLIC_ADMIN_POLL_FAST_MS,
  5000,
  30000,
  15000
);
const HIDDEN_ADMIN_POLL_MS = clampPositiveInteger(
  ENV.NEXT_PUBLIC_ADMIN_POLL_HIDDEN_MS,
  180000,
  600000,
  300000
);
const FAST_POLL_WINDOW_MS = clampPositiveInteger(
  ENV.NEXT_PUBLIC_ADMIN_POLL_FAST_WINDOW_MS,
  30000,
  300000,
  90000
);
const LEGACY_ADMIN_POLL_MS = clampPositiveInteger(
  ENV.NEXT_PUBLIC_ADMIN_POLL_LEGACY_MS,
  15000,
  120000,
  60000
);
const ADMIN_PERIODIC_FRESH_MS = clampPositiveInteger(
  ENV.NEXT_PUBLIC_ADMIN_PERIODIC_FRESH_MS,
  300000,
  1800000,
  900000
);
const ADMIN_REGISTRATIONS_PAGE_LIMIT = clampPositiveInteger(
  ENV.NEXT_PUBLIC_ADMIN_REGISTRATIONS_PAGE_LIMIT,
  25,
  500,
  120
);
const ADMIN_REGISTRATIONS_MAX_PAGES = clampPositiveInteger(
  ENV.NEXT_PUBLIC_ADMIN_REGISTRATIONS_MAX_PAGES,
  1,
  50,
  8
);
const ADAPTIVE_POLLING_ENABLED =
  String(ENV.NEXT_PUBLIC_FEATURE_ADMIN_ADAPTIVE_POLLING_ENABLED || "true")
    .trim()
    .toLowerCase() !== "false";
const CLIENT_FALLBACK_ENABLED =
  String(ENV.NEXT_PUBLIC_FEATURE_ADMIN_CLIENT_FALLBACK_ENABLED || "false")
    .trim()
    .toLowerCase() === "true";

function buildAdminRegistrationsUrl({ fresh = false, track = "all", limit, cursor } = {}) {
  const baseUrl = toRuntimeApiUrl("/api/admin/registrations");

  const query = new URLSearchParams();
  if (fresh) {
    query.set("fresh", "1");
  }

  const normalizedTrack = String(track || "").trim().toLowerCase();
  if (normalizedTrack === "workshop" || normalizedTrack === "hackathon") {
    query.set("type", normalizedTrack);
  }

  const normalizedLimit = toPositiveInteger(limit, 0);
  if (normalizedLimit > 0) {
    query.set("limit", String(Math.min(normalizedLimit, 500)));
  }

  const normalizedCursor = String(cursor || "").trim();
  if (normalizedCursor) {
    query.set("cursor", normalizedCursor);
  }

  const serializedQuery = query.toString();
  if (!serializedQuery) {
    return baseUrl;
  }

  const joinSymbol = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${joinSymbol}${serializedQuery}`;
}

function isDocumentVisible() {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState === "visible";
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function appendSearchValue(parts, value) {
  const normalized = normalizeSearchText(value);
  if (normalized) {
    parts.push(normalized);
  }
}

function buildRegistrationSearchBlob(registration) {
  const parts = [];

  appendSearchValue(parts, registration?.teamName);
  appendSearchValue(parts, registration?.collegeName);
  appendSearchValue(parts, registration?.state);
  appendSearchValue(parts, registration?.status);
  appendSearchValue(parts, registration?.registrationType);
  appendSearchValue(parts, registration?.teamSize);
  appendSearchValue(parts, registration?.transactionDocId || registration?.id);
  appendSearchValue(parts, registration?.registrationRefId);
  appendSearchValue(parts, registration?.payment?.transactionId);

  const participants = Array.isArray(registration?.participants) ? registration.participants : [];
  participants.forEach((participant, index) => {
    appendSearchValue(parts, participant?.name);
    appendSearchValue(parts, participant?.email);
    appendSearchValue(parts, participant?.phone);
    appendSearchValue(parts, participant?.roll);
    appendSearchValue(parts, participant?.branch);
    appendSearchValue(parts, participant?.yearOfStudy || participant?.year_of_study);
    appendSearchValue(parts, participant?.state);

    if (index === 0) {
      appendSearchValue(parts, `leader ${participant?.name || ""}`);
      appendSearchValue(parts, `leader ${participant?.email || ""}`);
      appendSearchValue(parts, `leader ${participant?.phone || ""}`);
    }
  });

  const access = registration?.accessCredentials || {};
  appendSearchValue(parts, access?.teamId);
  appendSearchValue(parts, access?.leaderName);
  appendSearchValue(parts, access?.leaderEmail);
  appendSearchValue(parts, access?.leaderPhone);

  return parts.join(" ");
}

function matchesSearchBlob(searchBlob, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return true;
  }

  return tokens.every((token) => searchBlob.includes(token));
}

export function useAdminDashboard() {
  const [isTrackSwitching, startTrackSwitch] = useTransition();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState([]);
  const [dataError, setDataError] = useState("");

  const [filterTrack, setFilterTrack] = useState("workshop");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSize, setFilterSize] = useState("all");
  const [filterCollege, setFilterCollege] = useState("all");
  const [filterEmailState, setFilterEmailState] = useState("all");

  const [selectedTeam, setSelectedTeam] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("table");
  const [noteText, setNoteText] = useState("");

  const [updateBusy, setUpdateBusy] = useState(false);
  const [emailActionBusyId, setEmailActionBusyId] = useState("");
  const [deleteActionBusyId, setDeleteActionBusyId] = useState("");
  const [bulkSendBusy, setBulkSendBusy] = useState(false);
  const [bulkActionMessage, setBulkActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [addTeamBusy, setAddTeamBusy] = useState(false);
  const [addTeamError, setAddTeamError] = useState("");

  const [apiRuntimeAvailable, setApiRuntimeAvailable] = useState(true);
  const [runtimeNotice, setRuntimeNotice] = useState("");
  const [credentialSheetUrl, setCredentialSheetUrl] = useState(DEFAULT_CREDENTIAL_SHEET_URL);

  const [eventControls, setEventControls] = useState(null);
  const [eventControlsEffectiveState, setEventControlsEffectiveState] = useState(null);
  const [eventControlImplementation, setEventControlImplementation] = useState(null);
  const [eventControlTimezoneLabel, setEventControlTimezoneLabel] = useState("IST (Asia/Kolkata)");
  const [eventControlsLoading, setEventControlsLoading] = useState(false);
  const [eventControlsSaving, setEventControlsSaving] = useState(false);
  const [eventControlsError, setEventControlsError] = useState("");
  const [eventControlsMessage, setEventControlsMessage] = useState("");

  const [previewScreenshot, setPreviewScreenshot] = useState({
    url: "",
    label: "PAYMENT SCREENSHOT",
  });

  const router = useRouter();
  const adminPollTimerRef = useRef(null);
  const fastPollingUntilRef = useRef(0);
  const lastFreshSyncRef = useRef(0);

  const clearAdminPollTimer = useCallback(() => {
    if (adminPollTimerRef.current) {
      clearTimeout(adminPollTimerRef.current);
      adminPollTimerRef.current = null;
    }
  }, []);

  const boostAdminPollingWindow = useCallback(() => {
    if (!ADAPTIVE_POLLING_ENABLED) {
      return;
    }

    fastPollingUntilRef.current = Date.now() + FAST_POLL_WINDOW_MS;
  }, []);

  useEffect(() => {
    let isActive = true;

    const unsubscribe = onUserAuthChange(
      (authUser) => {
        const resolveRole = async () => {
          if (!authUser) {
            if (!isActive) return;
            setLoading(false);
            router.replace("/auth");
            return;
          }

          const role = await getUserRole(authUser);
          if (!isActive) return;

          if (role === ROLES.ADMIN) {
            setUser(authUser);
            setLoading(false);
            return;
          }

          setLoading(false);
          router.replace("/auth?reason=admin-only");
        };

        void resolveRole();
      },
      () => {
        if (!isActive) return;
        setLoading(false);
        router.replace("/auth");
      }
    );

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [router]);

  const fetchRegistrations = useCallback(
    async ({ fresh = false } = {}) => {
      if (!user) return;

      let apiFailureMessage = "";

      const setClientFallbackMode = () => {
        setApiRuntimeAvailable(false);
        setRuntimeNotice(API_RUNTIME_NOTICE);
      };

      try {
        const idToken = await user.getIdToken();
        const headers = buildRuntimeIdTokenHeaders(
          idToken,
          fresh ? { "x-admin-cache-bypass": "1" } : {}
        );

        const mapped = [];
        let cursor = "";

        for (let pageIndex = 0; pageIndex < ADMIN_REGISTRATIONS_MAX_PAGES; pageIndex += 1) {
          const response = await fetch(
            buildAdminRegistrationsUrl({
              fresh,
              track: filterTrack,
              limit: ADMIN_REGISTRATIONS_PAGE_LIMIT,
              cursor,
            }),
            {
              headers,
              cache: "no-store",
            }
          );

          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            if (response.status !== 404 && response.status !== 405) {
              if (response.status === 403) {
                throw new Error(
                  "Admin access denied. Ensure this account has admin claim or users/{uid}.role=ADMIN."
                );
              }

              throw new Error(data?.error || "Failed to sync dashboard data.");
            }

            break;
          }

          const pageRegistrations = Array.isArray(data?.registrations)
            ? data.registrations.map((item) => mapRegistrationItem(item))
            : [];
          mapped.push(...pageRegistrations);

          const pagination = data?.pagination || null;
          const nextCursor = String(pagination?.next_cursor || "").trim();
          const hasMore = pagination?.has_more === true && Boolean(nextCursor);

          if (!hasMore || nextCursor === cursor) {
            break;
          }

          cursor = nextCursor;
        }

        setRegistrations(mapped);
        setDataError("");
        setApiRuntimeAvailable(true);
        setRuntimeNotice("");
        return;
      } catch (apiError) {
        if (apiError?.message) {
          apiFailureMessage = String(apiError.message);
        }

        if (apiFailureMessage && !apiFailureMessage.includes("Failed to fetch")) {
          setDataError(apiFailureMessage);
        }
      }

      if (!CLIENT_FALLBACK_ENABLED) {
        setApiRuntimeAvailable(false);
        setRuntimeNotice(API_RUNTIME_NOTICE);
        throw new Error(apiFailureMessage || "Runtime API unavailable for admin registrations.");
      }

      try {
        const fallbackData = await loadAdminRegistrationsFromClient(db);
        const normalizedTrack = String(filterTrack || "").trim().toLowerCase();
        const filteredFallback = fallbackData.filter((item) => {
          if (normalizedTrack === "workshop" || normalizedTrack === "hackathon") {
            return item?.registration_type === normalizedTrack;
          }

          return true;
        });
        const mappedFallback = filteredFallback.map((item) => mapRegistrationItem(item));

        setRegistrations(mappedFallback);
        setDataError("");
        setClientFallbackMode();
      } catch (clientError) {
        throw new Error(
          clientError?.message ||
            "Failed to sync dashboard data in Firestore fallback mode. Check admin auth and rules."
        );
      }
    },
    [user, filterTrack]
  );

  useEffect(() => {
    if (!user) return;

    let isCancelled = false;

    const getNextPollDelay = () => {
      if (!ADAPTIVE_POLLING_ENABLED) {
        return LEGACY_ADMIN_POLL_MS;
      }

      if (Date.now() < fastPollingUntilRef.current) {
        return FAST_ADMIN_POLL_MS;
      }

      return isDocumentVisible() ? DEFAULT_ADMIN_POLL_MS : HIDDEN_ADMIN_POLL_MS;
    };

    const syncOnce = async ({ fresh = false } = {}) => {
      const now = Date.now();
      const needsPeriodicFresh =
        ADMIN_PERIODIC_FRESH_MS > 0 &&
        now - Number(lastFreshSyncRef.current || 0) >= ADMIN_PERIODIC_FRESH_MS;
      const shouldFetchFresh = fresh || needsPeriodicFresh;

      try {
        await fetchRegistrations({ fresh: shouldFetchFresh });
        if (shouldFetchFresh) {
          lastFreshSyncRef.current = Date.now();
        }
      } catch (error) {
        if (!isCancelled) {
          setDataError(error?.message || "Failed to sync dashboard data.");
        }
      }
    };

    const scheduleNextPoll = () => {
      if (isCancelled) {
        return;
      }

      clearAdminPollTimer();
      adminPollTimerRef.current = setTimeout(async () => {
        await syncOnce();
        scheduleNextPoll();
      }, getNextPollDelay());
    };

    const handleVisibilityChange = () => {
      if (!ADAPTIVE_POLLING_ENABLED || isCancelled) {
        return;
      }

      if (isDocumentVisible()) {
        void syncOnce();
      }

      scheduleNextPoll();
    };

    void syncOnce();
    scheduleNextPoll();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      isCancelled = true;
      clearAdminPollTimer();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [user, fetchRegistrations, clearAdminPollTimer]);

  const refreshRegistrationsAfterMutation = useCallback(() => {
    boostAdminPollingWindow();
    void fetchRegistrations({ fresh: true });
  }, [boostAdminPollingWindow, fetchRegistrations]);

  useEffect(() => {
    if (!user) return;

    let isCancelled = false;

    const resolveCredentialSheetUrl = async () => {
      if (DEFAULT_CREDENTIAL_SHEET_URL) {
        if (!isCancelled) {
          setCredentialSheetUrl(DEFAULT_CREDENTIAL_SHEET_URL);
        }
        return;
      }

      try {
        const idToken = await user.getIdToken();
        const response = await fetch(toRuntimeApiUrl("/api/admin/credential-sheet-link"), {
          headers: buildRuntimeIdTokenHeaders(idToken),
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          return;
        }

        const url = String(data?.url || "").trim();
        if (!isCancelled && url) {
          setCredentialSheetUrl(url);
        }
      } catch {
        // Keep dashboard fully functional even when sheet-link lookup fails.
      }
    };

    void resolveCredentialSheetUrl();

    return () => {
      isCancelled = true;
    };
  }, [user]);

  const fetchEventControls = useCallback(async () => {
    if (!user) return;

    setEventControlsLoading(true);
    setEventControlsError("");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(toRuntimeApiUrl("/api/admin/event-controls"), {
        headers: buildRuntimeIdTokenHeaders(idToken),
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 404 || response.status === 405) {
        setApiRuntimeAvailable(false);
        setRuntimeNotice(API_RUNTIME_NOTICE);
        throw new Error("Event controls are unavailable on static hosting mode.");
      }

      if (!response.ok || data?.success !== true) {
        throw new Error(data?.error || "Failed to load event controls.");
      }

      setEventControls(data?.controls || null);
      setEventControlsEffectiveState(data?.effectiveState || null);
      setEventControlImplementation(data?.implementation || null);
      setEventControlTimezoneLabel(
        String(data?.timezoneLabel || data?.timezone || "IST (Asia/Kolkata)").trim() ||
          "IST (Asia/Kolkata)"
      );
      setApiRuntimeAvailable(true);
      setRuntimeNotice("");
      return data;
    } catch (error) {
      setEventControlsError(error?.message || "Failed to load event controls.");
      return null;
    } finally {
      setEventControlsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void fetchEventControls();
  }, [user, fetchEventControls]);

  const saveEventControls = useCallback(
    async (nextControls) => {
      if (!user || !nextControls || typeof nextControls !== "object") {
        return null;
      }

      setEventControlsSaving(true);
      setEventControlsError("");
      setEventControlsMessage("");

      try {
        const idToken = await user.getIdToken();
        const response = await fetch(toRuntimeApiUrl("/api/admin/event-controls"), {
          method: "PUT",
          headers: buildRuntimeIdTokenHeaders(idToken, {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ controls: nextControls }),
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 404 || response.status === 405) {
          setApiRuntimeAvailable(false);
          setRuntimeNotice(API_RUNTIME_NOTICE);
          throw new Error("Event controls are unavailable on static hosting mode.");
        }

        if (!response.ok || data?.success !== true) {
          const details = Array.isArray(data?.details) ? data.details : [];
          const detailText = details.length > 0 ? ` ${details.join(" ")}` : "";
          throw new Error(`${data?.error || "Failed to save event controls."}${detailText}`.trim());
        }

        setEventControls(data?.controls || null);
        setEventControlsEffectiveState(data?.effectiveState || null);
        setEventControlImplementation(data?.implementation || null);
        setEventControlTimezoneLabel(
          String(data?.timezoneLabel || data?.timezone || "IST (Asia/Kolkata)").trim() ||
            "IST (Asia/Kolkata)"
        );
        setEventControlsMessage("Event controls saved successfully.");
        setApiRuntimeAvailable(true);
        setRuntimeNotice("");
        return data;
      } catch (error) {
        setEventControlsError(error?.message || "Failed to save event controls.");
        return null;
      } finally {
        setEventControlsSaving(false);
      }
    },
    [user]
  );

  const updateEventControlsDraft = useCallback((nextControls) => {
    if (!nextControls || typeof nextControls !== "object") {
      return;
    }

    setEventControls(nextControls);
    setEventControlsMessage("");
    setEventControlsError("");
  }, []);

  const registrationsForTrack = useMemo(() => {
    return registrations.filter((registration) => registration.registrationType === filterTrack);
  }, [registrations, filterTrack]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterTrack]);

  const effectiveFilterSize = useMemo(() => {
    if (filterTrack === "workshop" && filterSize !== "all" && filterSize !== "1") {
      return "all";
    }

    if (filterTrack === "hackathon" && filterSize === "1") {
      return "all";
    }

    return filterSize;
  }, [filterTrack, filterSize]);

  const searchableRegistrations = useMemo(() => {
    return registrationsForTrack.map((registration) => ({
      registration,
      searchBlob: buildRegistrationSearchBlob(registration),
    }));
  }, [registrationsForTrack]);

  const filtered = useMemo(() => {
    return searchableRegistrations
      .filter(({ registration, searchBlob }) => {
      const matchSearch = matchesSearchBlob(searchBlob, searchTerm);

      const emailState = normalizeEmailDeliveryState(registration?.emailDelivery?.state);
      const emailBucket = classifyEmailStateBucket(emailState);

      const matchSize =
        effectiveFilterSize === "all" || registration.teamSize === Number(effectiveFilterSize);
      const matchCollege =
        filterCollege === "all" || registration.collegeName === filterCollege;
      const matchEmailState =
        filterEmailState === "all" ||
        (filterEmailState === "sent" && emailBucket === "sent") ||
        (filterEmailState === "unsent" && emailBucket === "unsent") ||
        (filterEmailState === "failed" && emailBucket === "failed") ||
        (filterEmailState === "inflight" && emailBucket === "inflight") ||
        (filterEmailState === "not-ready" && emailBucket === "not-ready");

      return matchSearch && matchSize && matchCollege && matchEmailState;
    })
      .map((item) => item.registration);
  }, [searchableRegistrations, searchTerm, effectiveFilterSize, filterCollege, filterEmailState]);

  const bulkSendCandidateIds = useMemo(() => {
    return filtered
      .filter((registration) => isBulkSendCandidate(registration))
      .map((registration) => registration.transactionDocId || registration.id)
      .filter(Boolean);
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const stats = useMemo(() => {
    const totalRegs = registrationsForTrack.length;
    const totalParticipants = registrationsForTrack.reduce(
      (sum, registration) => sum + (registration.participants?.length || 0),
      0
    );
    const teamsOf1 = registrationsForTrack.filter((registration) => registration.teamSize === 1).length;
    const teamsOf2 = registrationsForTrack.filter((registration) => registration.teamSize === 2).length;
    const teamsOf3 = registrationsForTrack.filter((registration) => registration.teamSize === 3).length;
    const teamsOf4 = registrationsForTrack.filter((registration) => registration.teamSize === 4).length;
    const colleges = new Set(
      registrationsForTrack.map((registration) => registration.collegeName?.toUpperCase())
    ).size;

    const unsentCredentialEmails = registrationsForTrack.filter((registration) => {
      if (registration.registrationType !== "hackathon") return false;
      const state = normalizeEmailDeliveryState(registration?.emailDelivery?.state);
      return ["UNSENT", "ERROR", "RETRY"].includes(state);
    }).length;

    return {
      totalRegs,
      totalParticipants,
      teamsOf1,
      teamsOf2,
      teamsOf3,
      teamsOf4,
      colleges,
      unsentCredentialEmails,
    };
  }, [registrationsForTrack]);

  const duplicates = useMemo(() => {
    const nameCount = {};
    const txCount = {};

    registrationsForTrack.forEach((registration) => {
      const normalizedName = registration.teamName?.toLowerCase();
      const normalizedTx = registration.payment?.transactionId?.toLowerCase();
      if (normalizedName) nameCount[normalizedName] = (nameCount[normalizedName] || 0) + 1;
      if (normalizedTx) txCount[normalizedTx] = (txCount[normalizedTx] || 0) + 1;
    });

    const dupNames = new Set(Object.keys(nameCount).filter((key) => nameCount[key] > 1));
    const dupTx = new Set(Object.keys(txCount).filter((key) => txCount[key] > 1));

    return { dupNames, dupTx };
  }, [registrationsForTrack]);

  const analyticsData = useMemo(() => {
    const dateMap = {};

    registrationsForTrack.forEach((registration) => {
      const date = toDateSafe(registration.createdAt);
      if (!date) return;

      const isoKey = date.toISOString().slice(0, 10);
      dateMap[isoKey] = (dateMap[isoKey] || 0) + 1;
    });

    const timeline = Object.entries(dateMap)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, count]) => ({
        date:
          toDateSafe(date)?.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          }) || date,
        count,
      }));

    const collegeMap = {};
    registrationsForTrack.forEach((registration) => {
      const collegeName = registration.collegeName?.toUpperCase() || "UNKNOWN";
      collegeMap[collegeName] = (collegeMap[collegeName] || 0) + 1;
    });

    const topColleges = Object.entries(collegeMap)
      .sort((entryA, entryB) => entryB[1] - entryA[1])
      .slice(0, 8)
      .map(([college, count]) => ({
        college: college.length > 18 ? `${college.slice(0, 18)}...` : college,
        count,
      }));

    const sizeDist = [];
    if (filterTrack === "workshop") {
      sizeDist.push({ name: "Individual", value: stats.teamsOf1 });
    } else {
      sizeDist.push(
        { name: "Size 2", value: stats.teamsOf2 },
        { name: "Size 3", value: stats.teamsOf3 },
        { name: "Size 4", value: stats.teamsOf4 }
      );
    }

    return { timeline, topColleges, sizeDist };
  }, [registrationsForTrack, stats, filterTrack]);

  const collegeList = useMemo(() => {
    return [...new Set(registrationsForTrack.map((registration) => registration.collegeName).filter(Boolean))].sort();
  }, [registrationsForTrack]);

  const sizeOptions = useMemo(() => {
    if (filterTrack === "workshop") {
      return [
        { value: "all", label: "All entries" },
        { value: "1", label: "Individual" },
      ];
    }

    if (filterTrack === "hackathon") {
      return [
        { value: "all", label: "All sizes" },
        { value: "2", label: "Size 2" },
        { value: "3", label: "Size 3" },
        { value: "4", label: "Size 4" },
      ];
    }

    return [{ value: "all", label: "All entries" }];
  }, [filterTrack]);

  const exportCSV = useCallback(() => {
    const headers = [
      "Track",
      "Team Name",
      "Leader",
      "Contact",
      "College",
      "Team Size",
      "Status",
      "Transaction ID",
      "Screenshot URL",
      "Submission Time",
      "Notes",
      "P1 Name",
      "P1 Roll",
      "P1 Email",
      "P1 Phone",
      "P2 Name",
      "P2 Roll",
      "P2 Email",
      "P2 Phone",
      "P3 Name",
      "P3 Roll",
      "P3 Email",
      "P3 Phone",
      "P4 Name",
      "P4 Roll",
      "P4 Email",
      "P4 Phone",
    ];

    const rows = filtered.map((registration) => {
      const date = toDateSafe(registration.createdAt);
      const isoDate = date ? date.toISOString() : "N/A";

      const row = [
        String(registration.registrationType || "").toUpperCase(),
        registration.teamName,
        getLeaderName(registration),
        getLeaderContact(registration),
        registration.collegeName,
        registration.teamSize,
        registration.status || "pending",
        registration.payment?.transactionId || "",
        registration.payment?.screenshotUrl || "",
        isoDate,
        registration.notes || "",
      ];

      for (let index = 0; index < 4; index += 1) {
        const participant = registration.participants?.[index];
        row.push(
          participant?.name || "",
          participant?.roll || "",
          participant?.email || "",
          participant?.phone || ""
        );
      }

      return row;
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `registrations_${filterTrack}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filtered, filterTrack]);

  const openScreenshotPreview = useCallback((url, label = "PAYMENT SCREENSHOT") => {
    if (!url) return;
    setPreviewScreenshot({ url, label });
  }, []);

  const closeScreenshotPreview = useCallback(() => {
    setPreviewScreenshot({ url: "", label: "PAYMENT SCREENSHOT" });
  }, []);

  useEffect(() => {
    setNoteText(
      selectedTeam?.notes || (selectedTeam?.status === "verified" ? "Payment verified" : "")
    );
    setActionError("");
  }, [selectedTeam]);

  const handleLogout = useCallback(async () => {
    try {
      await logoutAdmin();
    } finally {
      router.replace("/auth");
    }
  }, [router]);

  const handleStatusToggle = useCallback(async () => {
    if (!selectedTeam || !user || updateBusy) return;

    const action = selectedTeam.status === "verified" ? "reject" : "verify";
    const newStatus = action === "verify" ? "verified" : "rejected";
    const nextNotes = newStatus === "verified" ? "Payment verified" : "";

    setUpdateBusy(true);
    setActionError("");

    try {
      let updatedViaApi = false;

      if (apiRuntimeAvailable) {
        const idToken = await user.getIdToken();
        const response = await fetch(toRuntimeApiUrl("/api/admin/verify-payment"), {
          method: "POST",
          headers: buildRuntimeIdTokenHeaders(idToken, {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            transaction_id: selectedTeam.transactionDocId || selectedTeam.id,
            action,
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data?.success) {
          const nextAccessCredentials = data?.access_credentials
            ? {
                teamId: data.access_credentials.team_id || "",
                password: data.access_credentials.password || "",
                passwordVersion: Number(data.access_credentials.password_version || 0),
                leaderName: data.access_credentials.leader_name || "",
                leaderEmail: data.access_credentials.leader_email || "",
                leaderPhone: data.access_credentials.leader_phone || "",
              }
            : null;

          const nextEmailDelivery =
            newStatus === "verified" && nextAccessCredentials
              ? toEmailDelivery({
                  state: "UNSENT",
                  can_send: true,
                  recipient: nextAccessCredentials.leaderEmail,
                })
              : toEmailDelivery({ state: "NOT_READY", can_send: false });

          setRegistrations((prev) =>
            prev.map((item) =>
              item.id === selectedTeam.id
                ? {
                    ...item,
                    status: newStatus,
                    notes: nextNotes,
                    accessCredentials: nextAccessCredentials || item.accessCredentials,
                    emailDelivery: nextEmailDelivery,
                  }
                : item
            )
          );

          setSelectedTeam((prev) =>
            prev
              ? {
                  ...prev,
                  status: newStatus,
                  notes: nextNotes,
                  accessCredentials: nextAccessCredentials || prev.accessCredentials,
                  emailDelivery: nextEmailDelivery,
                }
              : prev
          );

          setNoteText(nextNotes);
          updatedViaApi = true;
          setApiRuntimeAvailable(true);
          setRuntimeNotice("");
        } else if (response.status === 404 || response.status === 405) {
          setApiRuntimeAvailable(false);
          setRuntimeNotice(API_RUNTIME_NOTICE);
        } else {
          throw new Error(data?.error || "Failed to update status.");
        }
      }

      if (!updatedViaApi) {
        await updatePaymentStatusFromClient(db, {
          transactionId: selectedTeam.transactionDocId || selectedTeam.id,
          registrationType: selectedTeam.registrationType,
          registrationRefId: selectedTeam.registrationRefId,
          status: newStatus,
          verifierUid: user.uid,
        });

        const fallbackEmailDelivery =
          selectedTeam.registrationType === "hackathon"
            ? newStatus === "verified" && selectedTeam?.accessCredentials?.leaderEmail
              ? toEmailDelivery({
                  state: "UNSENT",
                  can_send: true,
                  recipient: selectedTeam.accessCredentials.leaderEmail,
                })
              : toEmailDelivery({ state: "NOT_READY", can_send: false })
            : selectedTeam.emailDelivery;

        setRegistrations((prev) =>
          prev.map((item) =>
            item.id === selectedTeam.id
              ? {
                  ...item,
                  status: newStatus,
                  notes: nextNotes,
                  emailDelivery: fallbackEmailDelivery,
                }
              : item
          )
        );

        setSelectedTeam((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus,
                notes: nextNotes,
                emailDelivery: fallbackEmailDelivery,
              }
            : prev
        );

        setNoteText(nextNotes);
      }

      refreshRegistrationsAfterMutation();
    } catch (error) {
      setActionError(error?.message || "Failed to update status.");
    } finally {
      setUpdateBusy(false);
    }
  }, [
    selectedTeam,
    user,
    updateBusy,
    apiRuntimeAvailable,
    refreshRegistrationsAfterMutation,
  ]);

  const handleRegenerateCredentials = useCallback(async () => {
    if (!selectedTeam || !user || updateBusy) return;

    if (!apiRuntimeAvailable) {
      setActionError(
        "Credential generation requires backend API runtime. Use localhost server mode for this action."
      );
      return;
    }

    if (selectedTeam.registrationType !== "hackathon") {
      setActionError("Credentials apply only to hackathon teams.");
      return;
    }

    if (selectedTeam.status !== "verified") {
      setActionError("Payment must be VERIFIED before regenerating credentials.");
      return;
    }

    setUpdateBusy(true);
    setActionError("");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(toRuntimeApiUrl("/api/admin/regenerate-team-credentials"), {
        method: "POST",
        headers: buildRuntimeIdTokenHeaders(idToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          transaction_id: selectedTeam.transactionDocId || selectedTeam.id,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 404 || response.status === 405) {
        setApiRuntimeAvailable(false);
        setRuntimeNotice(API_RUNTIME_NOTICE);
        throw new Error("Credential generation is unavailable on static hosting mode.");
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to regenerate credentials.");
      }

      const regeneratedCredentials = data?.access_credentials
        ? {
            teamId: data.access_credentials.team_id || "",
            password: data.access_credentials.password || "",
            passwordVersion: Number(data.access_credentials.password_version || 0),
            leaderName: data.access_credentials.leader_name || "",
            leaderEmail: data.access_credentials.leader_email || "",
            leaderPhone: data.access_credentials.leader_phone || "",
          }
        : null;

      const nextEmailDelivery = regeneratedCredentials
        ? toEmailDelivery({
            state: "UNSENT",
            can_send: true,
            recipient: regeneratedCredentials.leaderEmail,
          })
        : selectedTeam.emailDelivery;

      setRegistrations((prev) =>
        prev.map((item) =>
          item.id === selectedTeam.id
            ? {
                ...item,
                accessCredentials: regeneratedCredentials || item.accessCredentials,
                emailDelivery: nextEmailDelivery,
              }
            : item
        )
      );

      setSelectedTeam((prev) =>
        prev
          ? {
              ...prev,
              accessCredentials: regeneratedCredentials || prev.accessCredentials,
              emailDelivery: nextEmailDelivery,
            }
          : prev
      );

      refreshRegistrationsAfterMutation();
    } catch (error) {
      setActionError(error?.message || "Failed to regenerate credentials.");
    } finally {
      setUpdateBusy(false);
    }
  }, [
    selectedTeam,
    user,
    updateBusy,
    apiRuntimeAvailable,
    refreshRegistrationsAfterMutation,
  ]);

  const handleSendCredentialEmail = useCallback(
    async (targetTeam, { force = false } = {}) => {
      if (!targetTeam || !user) return;

      if (!apiRuntimeAvailable) {
        setActionError(
          "Credential email sending requires backend API runtime. Use localhost server mode for this action."
        );
        return;
      }

      if (bulkSendBusy) {
        setActionError("Bulk credential email dispatch is running. Please wait.");
        return;
      }

      const targetEmailMeta = getEmailStateMeta(targetTeam?.emailDelivery);
      if (isInFlightEmailState(targetEmailMeta.state)) {
        setActionError("Credential email is already queued. Please wait for delivery update.");
        return;
      }

      if (!canSendCredentialEmailForRegistration(targetTeam)) {
        setActionError("Team credentials are not ready. Verify payment first.");
        return;
      }

      setEmailActionBusyId(targetTeam.id);
      setActionError("");

      try {
        const idToken = await user.getIdToken();
        const response = await fetch(toRuntimeApiUrl("/api/admin/send-team-credentials-email"), {
          method: "POST",
          headers: buildRuntimeIdTokenHeaders(idToken, {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            transaction_id: targetTeam.transactionDocId || targetTeam.id,
            force,
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 404 || response.status === 405) {
          setApiRuntimeAvailable(false);
          setRuntimeNotice(API_RUNTIME_NOTICE);
          throw new Error("Credential email API is unavailable on static hosting mode.");
        }

        if (!response.ok || !data?.success) {
          const conflictDelivery = data?.email_delivery
            ? toEmailDelivery({
                ...data.email_delivery,
                retry_after_seconds: data?.retry_after_seconds || 0,
              })
            : null;

          if (conflictDelivery) {
            setRegistrations((prev) =>
              prev.map((item) =>
                item.id === targetTeam.id ? { ...item, emailDelivery: conflictDelivery } : item
              )
            );

            setSelectedTeam((prev) =>
              prev && prev.id === targetTeam.id ? { ...prev, emailDelivery: conflictDelivery } : prev
            );
          }

          const retryAfterSeconds = Number(data?.retry_after_seconds || 0);
          const retrySuffix =
            Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
              ? ` Retry after ${retryAfterSeconds} seconds.`
              : "";

          throw new Error(`${data?.error || "Failed to send credential email."}${retrySuffix}`);
        }

        const nextEmailDelivery = toEmailDelivery(data?.email_delivery);

        setRegistrations((prev) =>
          prev.map((item) =>
            item.id === targetTeam.id ? { ...item, emailDelivery: nextEmailDelivery } : item
          )
        );

        setSelectedTeam((prev) =>
          prev && prev.id === targetTeam.id ? { ...prev, emailDelivery: nextEmailDelivery } : prev
        );

        setDataError("");
        refreshRegistrationsAfterMutation();
      } catch (error) {
        const message = error?.message || "Failed to send credential email.";

        if (selectedTeam?.id === targetTeam.id) {
          setActionError(message);
        } else {
          setDataError(`EMAIL_SEND_ERROR: ${message}`);
        }
      } finally {
        setEmailActionBusyId("");
      }
    },
    [
      bulkSendBusy,
      selectedTeam,
      user,
      apiRuntimeAvailable,
      refreshRegistrationsAfterMutation,
    ]
  );

  const handleBulkSendUnsent = useCallback(async () => {
    if (!user || bulkSendBusy) return;

    if (!apiRuntimeAvailable) {
      setDataError(
        "Bulk credential email dispatch requires backend API runtime. Use localhost server mode for this action."
      );
      return;
    }

    if (bulkSendCandidateIds.length === 0) {
      setBulkActionMessage("No unsent credential emails found in the current filtered view.");
      return;
    }

    setBulkSendBusy(true);
    setBulkActionMessage("");
    setDataError("");
    setActionError("");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(toRuntimeApiUrl("/api/admin/send-team-credentials-email/bulk"), {
        method: "POST",
        headers: buildRuntimeIdTokenHeaders(idToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          transaction_ids: bulkSendCandidateIds,
          force: false,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 404 || response.status === 405) {
        setApiRuntimeAvailable(false);
        setRuntimeNotice(API_RUNTIME_NOTICE);
        throw new Error("Bulk credential email API is unavailable on static hosting mode.");
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to bulk send unsent credential emails.");
      }

      const resultList = Array.isArray(data?.results) ? data.results : [];
      const nextDeliveryByTransactionId = new Map();

      for (const resultItem of resultList) {
        const transactionId = String(resultItem?.transaction_id || "").trim();
        if (!transactionId) continue;

        if (resultItem?.email_delivery) {
          nextDeliveryByTransactionId.set(
            transactionId,
            toEmailDelivery(resultItem.email_delivery)
          );
          continue;
        }

        if (resultItem?.success !== true) {
          nextDeliveryByTransactionId.set(
            transactionId,
            toEmailDelivery({
              state: "UNSENT",
              error: resultItem?.error || "",
              retry_after_seconds: resultItem?.retry_after_seconds || 0,
            })
          );
        }
      }

      if (nextDeliveryByTransactionId.size > 0) {
        setRegistrations((prev) =>
          prev.map((item) => {
            const transactionKey = item.transactionDocId || item.id;
            const nextDelivery = nextDeliveryByTransactionId.get(transactionKey);
            if (!nextDelivery) return item;
            return {
              ...item,
              emailDelivery: nextDelivery,
            };
          })
        );

        setSelectedTeam((prev) => {
          if (!prev) return prev;

          const transactionKey = prev.transactionDocId || prev.id;
          const nextDelivery = nextDeliveryByTransactionId.get(transactionKey);
          if (!nextDelivery) return prev;

          return {
            ...prev,
            emailDelivery: nextDelivery,
          };
        });
      }

      const summary = data?.summary || {};
      const requested = Number(summary?.requested || bulkSendCandidateIds.length);
      const queued = Number(summary?.queued || 0);
      const skipped = Number(summary?.skipped || 0);
      const failed = Number(summary?.failed || 0);

      setBulkActionMessage(
        `Bulk send complete: queued ${queued}/${requested}, skipped ${skipped}, failed ${failed}.`
      );

      if (failed > 0) {
        setDataError(
          `Some bulk email operations failed (${failed}). Review email status and retry individually if needed.`
        );
      }

      refreshRegistrationsAfterMutation();
    } catch (error) {
      setDataError(error?.message || "Failed to bulk send unsent credential emails.");
    } finally {
      setBulkSendBusy(false);
    }
  }, [
    bulkSendBusy,
    bulkSendCandidateIds,
    user,
    apiRuntimeAvailable,
    refreshRegistrationsAfterMutation,
  ]);

  const handleDeleteRegistration = useCallback(async (targetTeam) => {
    if (!targetTeam || !user || deleteActionBusyId) {
      return;
    }

    if (!apiRuntimeAvailable) {
      setActionError(
        "Registration deletion requires backend API runtime. Use localhost server mode for this action."
      );
      return;
    }

    const transactionId = targetTeam.transactionDocId || targetTeam.id;
    if (!transactionId) {
      setActionError("Missing transaction identifier for deletion.");
      return;
    }

    const targetLabel =
      targetTeam.registrationType === "hackathon"
        ? "hackathon team"
        : "workshop registration";

    const targetName = String(targetTeam.teamName || targetTeam.registrationRefId || transactionId)
      .trim()
      .slice(0, 80);

    if (typeof window !== "undefined") {
      const isHackathon = targetTeam.registrationType === "hackathon";
      const confirmMessage =
        `Delete ${targetLabel} \"${targetName}\"?\n\n` +
        (isHackathon
          ? "This will permanently remove team, participants, transaction, and analytics impact."
          : "This will permanently remove participant, workshop registration, transaction, and analytics impact.") +
        "\n\nThis action cannot be undone.";

      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) {
        return;
      }
    }

    setDeleteActionBusyId(targetTeam.id);
    setActionError("");
    setDataError("");
    setBulkActionMessage("");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(toRuntimeApiUrl("/api/admin/delete-registration"), {
        method: "POST",
        headers: buildRuntimeIdTokenHeaders(idToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          transaction_id: transactionId,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 404 || response.status === 405) {
        setApiRuntimeAvailable(false);
        setRuntimeNotice(API_RUNTIME_NOTICE);
        throw new Error("Registration deletion is unavailable on static hosting mode.");
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to delete registration.");
      }

      setRegistrations((prev) => prev.filter((item) => item.id !== targetTeam.id));
      setSelectedTeam((prev) => (prev?.id === targetTeam.id ? null : prev));

      if (data?.notice) {
        setBulkActionMessage(`${data.message} ${data.notice}`.trim());
      } else {
        setBulkActionMessage(data?.message || "Registration deleted successfully.");
      }

      refreshRegistrationsAfterMutation();
    } catch (error) {
      const message = error?.message || "Failed to delete registration.";

      if (selectedTeam?.id === targetTeam.id) {
        setActionError(message);
      } else {
        setDataError(`DELETE_ERROR: ${message}`);
      }
    } finally {
      setDeleteActionBusyId("");
    }
  }, [
    apiRuntimeAvailable,
    deleteActionBusyId,
    selectedTeam,
    user,
    refreshRegistrationsAfterMutation,
  ]);

  const resetAddTeamError = useCallback(() => {
    setAddTeamError("");
  }, []);

  const handleAddTeam = useCallback(async (payload) => {
    if (!user) {
      throw new Error("Admin session unavailable. Please sign in again.");
    }

    if (!apiRuntimeAvailable) {
      const message =
        "Team creation requires backend API runtime. This action is unavailable in Firestore fallback mode.";
      setAddTeamError(message);
      throw new Error(message);
    }

    if (addTeamBusy) {
      throw new Error("Team creation is already in progress. Please wait.");
    }

    setAddTeamBusy(true);
    setAddTeamError("");
    setDataError("");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(toRuntimeApiUrl("/api/admin/add-team"), {
        method: "POST",
        headers: buildRuntimeIdTokenHeaders(idToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(payload || {}),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 404 || response.status === 405) {
        setApiRuntimeAvailable(false);
        setRuntimeNotice(API_RUNTIME_NOTICE);
        throw new Error("Team creation is unavailable on static hosting mode.");
      }

      if (!response.ok || data?.success !== true) {
        throw new Error(data?.error || "Failed to create team.");
      }

      setBulkActionMessage(data?.message || "Team added successfully.");
      refreshRegistrationsAfterMutation();
      return data;
    } catch (error) {
      const message = error?.message || "Failed to create team.";
      setAddTeamError(message);
      throw new Error(message);
    } finally {
      setAddTeamBusy(false);
    }
  }, [
    user,
    apiRuntimeAvailable,
    addTeamBusy,
    refreshRegistrationsAfterMutation,
  ]);

  const handleSaveNotes = useCallback(async () => {
    if (!selectedTeam || updateBusy) return;
    const nextNotes = noteText.trim();

    setUpdateBusy(true);
    setActionError("");

    try {
      setRegistrations((prev) =>
        prev.map((item) => (item.id === selectedTeam.id ? { ...item, notes: nextNotes } : item))
      );
      setSelectedTeam((prev) => (prev ? { ...prev, notes: nextNotes } : prev));
      setNoteText(nextNotes);
    } catch (error) {
      setActionError(error?.message || "Failed to save notes.");
    } finally {
      setUpdateBusy(false);
    }
  }, [selectedTeam, noteText, updateBusy]);

  const selectedEmailDelivery = selectedTeam?.emailDelivery || toEmailDelivery(null);
  const selectedEmailMeta = getEmailStateMeta(selectedEmailDelivery);

  const selectedCanSendCredentialEmail =
    canSendCredentialEmailForRegistration(selectedTeam) &&
    !bulkSendBusy &&
    apiRuntimeAvailable;

  const selectedShouldForceResend = selectedEmailMeta.state === "SUCCESS";

  const isDupName = useCallback(
    (name) => duplicates.dupNames.has(String(name || "").toLowerCase()),
    [duplicates]
  );

  const isDupTx = useCallback(
    (transactionId) => duplicates.dupTx.has(String(transactionId || "").toLowerCase()),
    [duplicates]
  );

  const updateTrack = useCallback((track) => {
    startTrackSwitch(() => {
      setFilterSize((previous) => {
        if (track === "workshop" && previous !== "all" && previous !== "1") {
          return "all";
        }

        if (track === "hackathon" && previous === "1") {
          return "all";
        }

        return previous;
      });
      setFilterTrack(track);
      setCurrentPage(1);
    });
  }, [startTrackSwitch]);

  const updateSearch = useCallback((value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  const updateSizeFilter = useCallback((value) => {
    setFilterSize(value);
    setCurrentPage(1);
  }, []);

  const updateCollegeFilter = useCallback((value) => {
    setFilterCollege(value);
    setCurrentPage(1);
  }, []);

  const updateEmailStateFilter = useCallback((value) => {
    setFilterEmailState(value);
    setCurrentPage(1);
  }, []);

  const openTeamDetail = useCallback((team) => {
    setSelectedTeam(team);
  }, []);

  const closeTeamDetail = useCallback(() => {
    setSelectedTeam(null);
  }, []);

  return {
    loading,
    user,
    dataError,
    runtimeNotice,
    apiRuntimeAvailable,
    credentialSheetUrl,
    eventControls,
    eventControlsEffectiveState,
    eventControlImplementation,
    eventControlTimezoneLabel,
    eventControlsLoading,
    eventControlsSaving,
    eventControlsError,
    eventControlsMessage,

    activeTab,
    setActiveTab,

    filterTrack,
    isTrackSwitching,
    searchTerm,
    filterSize: effectiveFilterSize,
    filterCollege,
    filterEmailState,

    updateTrack,
    updateSearch,
    updateSizeFilter,
    updateCollegeFilter,
    updateEmailStateFilter,

    currentPage,
    setCurrentPage,
    totalPages,

    registrationsForTrack,
    filtered,
    paginated,

    collegeList,
    sizeOptions,
    stats,
    duplicates,
    analyticsData,

    bulkSendCandidateIds,
    bulkSendBusy,
    bulkActionMessage,
    addTeamBusy,
    addTeamError,

    selectedTeam,
    selectedEmailDelivery,
    selectedEmailMeta,
    selectedCanSendCredentialEmail,
    selectedShouldForceResend,
    noteText,
    setNoteText,

    actionError,
    updateBusy,
    emailActionBusyId,
    deleteActionBusyId,

    previewScreenshot,
    openScreenshotPreview,
    closeScreenshotPreview,

    exportCSV,
    fetchEventControls,
    saveEventControls,
    updateEventControlsDraft,
    handleLogout,
    handleStatusToggle,
    handleRegenerateCredentials,
    handleSendCredentialEmail,
    handleBulkSendUnsent,
    handleDeleteRegistration,
    handleAddTeam,
    resetAddTeamError,
    handleSaveNotes,

    openTeamDetail,
    closeTeamDetail,

    formatDateTime,
    getLeaderName,
    getLeaderContact,
    getStatusMeta,
    getEmailStateMeta,
    canSendCredentialEmailForRegistration,
    isDupName,
    isDupTx,
  };
}
