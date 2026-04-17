import { CalendarClock, Settings2 } from "lucide-react";
import styles from "../admin-v2.module.css";

const IST_TIME_ZONE = "Asia/Kolkata";

const STATUS_META = {
  OPEN: { label: "Open", className: "statusOpen" },
  CLOSED: { label: "Closed", className: "statusClosed" },
  SCHEDULED: { label: "Scheduled", className: "statusScheduled" },
  DISABLED: { label: "Disabled", className: "statusDisabled" },
  LIVE: { label: "Live", className: "statusLive" },
};

function toIstDateLabel(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: IST_TIME_ZONE,
    timeZoneName: "short",
  });
}

function statusMeta(status) {
  const normalized = String(status || "").toUpperCase();
  return STATUS_META[normalized] || { label: normalized || "Unknown", className: "statusDisabled" };
}

function StatusPill({ label, status }) {
  const meta = statusMeta(status);

  return (
    <span className={`${styles.eventStatusPill} ${styles[meta.className]}`.trim()}>
      {label}: {meta.label}
    </span>
  );
}

export default function EventControlsQuickAccess({
  effectiveState,
  timezoneLabel,
  loading,
  error,
  onOpen,
}) {
  const resolvedTimezoneLabel =
    String(timezoneLabel || "IST (Asia/Kolkata)").trim() || "IST (Asia/Kolkata)";

  return (
    <section className={styles.eventControlsQuickCard} aria-label="Event controls quick access">
      <header className={styles.eventControlsQuickHeader}>
        <div className={styles.eventControlsQuickTitleWrap}>
          <p className={styles.eventControlsKicker}>
            <Settings2 size={14} aria-hidden="true" />
            Event Controls
          </p>
          <h2 className={styles.eventControlsQuickTitle}>Schedule Settings</h2>
          <p className={styles.eventControlsQuickSubtitle}>
            Open once to manage registration, problem release, timer, and freeze timing.
          </p>
        </div>

        <div className={styles.eventControlsQuickActions}>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={loading}
            onClick={() => {
              onOpen?.();
            }}
          >
            <Settings2 size={14} aria-hidden="true" />
            {loading ? "Loading Controls..." : "Open Event Controls Workspace"}
          </button>
        </div>
      </header>

      {error ? <p className={styles.inlineError}>{error}</p> : null}

      {effectiveState ? (
        <div className={styles.eventStatusRow}>
          <StatusPill
            label="Workshop"
            status={effectiveState?.registration?.workshop?.status}
          />
          <StatusPill
            label="Hackathon"
            status={effectiveState?.registration?.hackathon?.status}
          />
          <StatusPill
            label="Problem Statements"
            status={effectiveState?.problemStatements?.status}
          />
          <StatusPill label="Timer" status={effectiveState?.timer?.status} />
          <StatusPill label="Freeze" status={effectiveState?.freeze?.status} />
        </div>
      ) : (
        <p className={styles.eventControlsLoading}>
          Event control snapshot will appear once controls are loaded.
        </p>
      )}

      <div className={styles.eventControlsQuickMeta}>
        <span className={styles.eventStatusNow}>
          <CalendarClock size={14} aria-hidden="true" />
          Snapshot at {toIstDateLabel(effectiveState?.now)} ({resolvedTimezoneLabel})
        </span>
      </div>
    </section>
  );
}
