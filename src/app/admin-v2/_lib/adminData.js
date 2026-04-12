export const PAGE_SIZE = 15;

export const TRACK_OPTIONS = [
  { value: "hackathon", label: "Hackathon" },
  { value: "workshop", label: "Workshop" },
];

export const CHART_COLORS = ["#a78bfa", "#34d399", "#60a5fa", "#f59e0b", "#ef4444"];

export const API_RUNTIME_NOTICE =
  "Admin API runtime is unavailable on current hosting mode. Dashboard is using direct Firestore mode. Credential generation/email actions require localhost server runtime.";

export const EMAIL_STATE_META = {
  NOT_READY: {
    label: "NOT READY",
    color: "#9CA3AF",
    bg: "rgba(156,163,175,0.16)",
  },
  UNSENT: {
    label: "UNSENT",
    color: "#F5C451",
    bg: "rgba(245,196,81,0.16)",
  },
  PENDING: {
    label: "QUEUED",
    color: "#7DD3FC",
    bg: "rgba(125,211,252,0.16)",
  },
  PROCESSING: {
    label: "SENDING",
    color: "#5AB2FF",
    bg: "rgba(90,178,255,0.18)",
  },
  RETRY: {
    label: "RETRY",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.16)",
  },
  ERROR: {
    label: "FAILED",
    color: "#E16D6D",
    bg: "rgba(225,109,109,0.16)",
  },
  SUCCESS: {
    label: "SENT",
    color: "#35C68B",
    bg: "rgba(53,198,139,0.16)",
  },
};

export function normalizeEmailDeliveryState(value) {
  const normalized = String(value || "UNSENT").trim().toUpperCase();
  return EMAIL_STATE_META[normalized] ? normalized : "UNSENT";
}

export function getEmailStateMeta(emailDelivery) {
  const state = normalizeEmailDeliveryState(emailDelivery?.state);
  return {
    state,
    ...EMAIL_STATE_META[state],
  };
}

export function classifyEmailStateBucket(state) {
  if (state === "SUCCESS") return "sent";
  if (state === "ERROR") return "failed";
  if (["PENDING", "PROCESSING", "RETRY"].includes(state)) return "inflight";
  if (state === "NOT_READY") return "not-ready";
  return "unsent";
}

export function isInFlightEmailState(state) {
  return ["PENDING", "PROCESSING"].includes(state);
}

export function canSendCredentialEmailForRegistration(registration) {
  if (registration?.registrationType !== "hackathon") {
    return false;
  }

  if (registration?.status !== "verified") {
    return false;
  }

  if (!registration?.accessCredentials?.teamId || !registration?.accessCredentials?.leaderEmail) {
    return false;
  }

  const state = normalizeEmailDeliveryState(registration?.emailDelivery?.state);
  return !isInFlightEmailState(state);
}

export function isBulkSendCandidate(registration) {
  if (!canSendCredentialEmailForRegistration(registration)) {
    return false;
  }

  const state = normalizeEmailDeliveryState(registration?.emailDelivery?.state);
  return ["UNSENT", "ERROR", "RETRY"].includes(state);
}

export function toEmailDelivery(rawDelivery) {
  const delivery = rawDelivery || {};

  return {
    state: normalizeEmailDeliveryState(delivery?.state),
    canSend: delivery?.can_send === true,
    queueDocId: delivery?.queue_doc_id || "",
    requestedAt: delivery?.requested_at || null,
    lastAttemptAt: delivery?.last_attempt_at || null,
    sentAt: delivery?.sent_at || null,
    attempts: Number(delivery?.attempts || 0),
    requestId: delivery?.request_id || "",
    requestCount: Number(delivery?.request_count || 0),
    retryCount: Number(delivery?.retry_count || 0),
    lastDecisionReason: delivery?.last_decision_reason || "",
    retryAfterSeconds: Number(delivery?.retry_after_seconds || 0),
    error: delivery?.error || "",
    recipient: delivery?.recipient || "",
  };
}

export function getLeaderParticipant(registration) {
  return Array.isArray(registration?.participants) ? registration.participants[0] || null : null;
}

export function getLeaderName(registration) {
  return getLeaderParticipant(registration)?.name || "-";
}

export function getLeaderContact(registration) {
  const leader = getLeaderParticipant(registration);
  return leader?.phone || leader?.email || "-";
}

export function toDateSafe(value) {
  if (!value) return null;
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value) {
  const date = toDateSafe(value);
  if (!date) return "N/A";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function mapRegistrationItem(item) {
  const registrationType = item?.registration_type;
  const registration = item?.registration || {};

  if (registrationType === "workshop") {
    const participant = registration?.participant || {};
    const workshopId = registration?.workshop_id || item?.transaction_id || "";
    const fallbackName = workshopId
      ? `WORKSHOP_${String(workshopId).slice(0, 6).toUpperCase()}`
      : "WORKSHOP";
    const hasParticipant =
      Boolean(participant?.name) || Boolean(participant?.email) || Boolean(participant?.phone);

    return {
      id: item?.transaction_id,
      transactionDocId: item?.transaction_id,
      registrationRefId: item?.registration_ref || registration?.workshop_id || "",
      registrationType,
      teamName: participant?.name || fallbackName,
      collegeName: participant?.college || "",
      state: participant?.state || "",
      teamSize: 1,
      participants: hasParticipant
        ? [
            {
              name: participant?.name || "",
              roll: participant?.roll || "",
              email: participant?.email || "",
              phone: participant?.phone || "",
              branch: participant?.branch || "",
              yearOfStudy: participant?.year_of_study || participant?.yearOfStudy || "",
              state: participant?.state || "",
            },
          ]
        : [],
      payment: {
        transactionId: item?.upi_transaction_id || "",
        screenshotUrl: item?.screenshot_url || "",
      },
      status: item?.status || "pending",
      createdAt: item?.created_at || null,
      notes: item?.status === "verified" ? "Payment verified" : "",
      accessCredentials: null,
      emailDelivery: toEmailDelivery({ state: "NOT_READY", can_send: false }),
    };
  }

  const members = Array.isArray(registration?.members) ? registration.members : [];
  const rawAccessCredentials = registration?.access_credentials || null;
  const accessCredentials = rawAccessCredentials
    ? {
        teamId: rawAccessCredentials?.team_id || "",
        password: "",
        passwordVersion: Number(rawAccessCredentials?.password_version || 0),
        leaderName: rawAccessCredentials?.leader_name || "",
        leaderEmail: rawAccessCredentials?.leader_email || "",
        leaderPhone: rawAccessCredentials?.leader_phone || "",
      }
    : null;

  const emailDelivery = toEmailDelivery(
    rawAccessCredentials?.email_delivery || {
      state:
        item?.status === "verified" && accessCredentials?.leaderEmail
          ? "UNSENT"
          : "NOT_READY",
      can_send: item?.status === "verified" && Boolean(accessCredentials?.leaderEmail),
      recipient: accessCredentials?.leaderEmail || "",
    }
  );

  return {
    id: item?.transaction_id,
    transactionDocId: item?.transaction_id,
    registrationRefId: item?.registration_ref || registration?.team_id || "",
    registrationType: registrationType || "hackathon",
    teamName: registration?.team_name || "",
    collegeName: registration?.college || "",
    state: registration?.state || "",
    teamSize: Number(registration?.team_size) || members.length || null,
    participants: members.map((member) => ({
      name: member?.name || "",
      roll: member?.roll || "",
      email: member?.email || "",
      phone: member?.phone || "",
      branch: member?.branch || member?.department || "",
      yearOfStudy: member?.year_of_study || member?.yearOfStudy || "",
      state: member?.state || registration?.state || "",
    })),
    payment: {
      transactionId: item?.upi_transaction_id || "",
      screenshotUrl: item?.screenshot_url || "",
    },
    status: item?.status || "pending",
    createdAt: item?.created_at || null,
    notes: item?.status === "verified" ? "Payment verified" : "",
    accessCredentials,
    emailDelivery,
  };
}

export function getStatusMeta(status) {
  if (status === "verified") {
    return {
      label: "VERIFIED",
      color: "#35C68B",
      bg: "rgba(53,198,139,0.16)",
      border: "rgba(53,198,139,0.44)",
    };
  }

  if (status === "rejected") {
    return {
      label: "REJECTED",
      color: "#E16D6D",
      bg: "rgba(225,109,109,0.16)",
      border: "rgba(225,109,109,0.44)",
    };
  }

  return {
    label: "PENDING",
    color: "#F5C451",
    bg: "rgba(245,196,81,0.16)",
    border: "rgba(245,196,81,0.44)",
  };
}
