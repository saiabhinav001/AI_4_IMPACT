import { CalendarClock, RefreshCcw, Save, Settings2 } from "lucide-react";
import styles from "../admin-v2.module.css";

const IST_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const STATUS_META = {
  OPEN: { label: "Open", className: "statusOpen" },
  CLOSED: { label: "Closed", className: "statusClosed" },
  SCHEDULED: { label: "Scheduled", className: "statusScheduled" },
  DISABLED: { label: "Disabled", className: "statusDisabled" },
  LIVE: { label: "Live", className: "statusLive" },
};

function toDateTimeLocalInputValue(isoValue) {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  const year = parts.year;
  const month = parts.month;
  const day = parts.day;
  const hours = parts.hour;
  const minutes = parts.minute;

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromDateTimeLocalInputValue(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);

  const utcMs = Date.UTC(year, month - 1, day, hours, minutes) - IST_OFFSET_MS;
  const date = new Date(utcMs);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

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

function WindowEditor({ title, description, value, onChange, timezoneLabel }) {
  return (
    <article className={styles.eventControlCard}>
      <div className={styles.eventControlHead}>
        <h3 className={styles.eventControlTitle}>{title}</h3>
        <p className={styles.eventControlHint}>{description}</p>
      </div>

      <div className={styles.eventControlGrid}>
        <label className={styles.eventInlineCheckbox}>
          <input
            type="checkbox"
            checked={value.enabled === true}
            onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
          />
          <span>Enabled</span>
        </label>

        <label className={styles.eventDateField}>
          <span className={styles.fieldLabel}>Open At ({timezoneLabel})</span>
          <input
            type="datetime-local"
            className={styles.textInput}
            value={toDateTimeLocalInputValue(value.openAt)}
            onChange={(event) =>
              onChange({
                ...value,
                openAt: fromDateTimeLocalInputValue(event.target.value),
              })
            }
          />
        </label>

        <label className={styles.eventDateField}>
          <span className={styles.fieldLabel}>Close At ({timezoneLabel})</span>
          <input
            type="datetime-local"
            className={styles.textInput}
            value={toDateTimeLocalInputValue(value.closeAt)}
            onChange={(event) =>
              onChange({
                ...value,
                closeAt: fromDateTimeLocalInputValue(event.target.value),
              })
            }
          />
        </label>
      </div>
    </article>
  );
}

function ProblemStatementEditor({ value, onChange, timezoneLabel }) {
  return (
    <article className={styles.eventControlCard}>
      <div className={styles.eventControlHead}>
        <h3 className={styles.eventControlTitle}>Problem Statements</h3>
        <p className={styles.eventControlHint}>
          Choose when teams can view problems.
        </p>
      </div>

      <div className={styles.eventControlGrid}>
        <label className={styles.eventInlineCheckbox}>
          <input
            type="checkbox"
            checked={value.enabled === true}
            onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
          />
          <span>Enabled</span>
        </label>

        <label className={styles.eventDateField}>
          <span className={styles.fieldLabel}>Release At ({timezoneLabel})</span>
          <input
            type="datetime-local"
            className={styles.textInput}
            value={toDateTimeLocalInputValue(value.releaseAt)}
            onChange={(event) =>
              onChange({
                ...value,
                releaseAt: fromDateTimeLocalInputValue(event.target.value),
              })
            }
          />
        </label>
      </div>
    </article>
  );
}

function FreezeEditor({ value, onChange, timezoneLabel }) {
  return (
    <article className={styles.eventControlCard}>
      <div className={styles.eventControlHead}>
        <h3 className={styles.eventControlTitle}>Freeze Window</h3>
        <p className={styles.eventControlHint}>
          Choose when team leads can lock edits.
        </p>
      </div>

      <div className={styles.eventControlGrid}>
        <label className={styles.eventInlineCheckbox}>
          <input
            type="checkbox"
            checked={value.enabled === true}
            onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
          />
          <span>Enabled</span>
        </label>

        <label className={styles.eventDateField}>
          <span className={styles.fieldLabel}>Open At ({timezoneLabel})</span>
          <input
            type="datetime-local"
            className={styles.textInput}
            value={toDateTimeLocalInputValue(value.openAt)}
            onChange={(event) =>
              onChange({
                ...value,
                openAt: fromDateTimeLocalInputValue(event.target.value),
              })
            }
          />
        </label>

        <label className={styles.eventDateField}>
          <span className={styles.fieldLabel}>Close At ({timezoneLabel})</span>
          <input
            type="datetime-local"
            className={styles.textInput}
            value={toDateTimeLocalInputValue(value.closeAt)}
            onChange={(event) =>
              onChange({
                ...value,
                closeAt: fromDateTimeLocalInputValue(event.target.value),
              })
            }
          />
        </label>

        <label className={styles.eventInlineCheckbox}>
          <input
            type="checkbox"
            checked={value.adminOverrideEnabled === true}
            onChange={(event) =>
              onChange({
                ...value,
                adminOverrideEnabled: event.target.checked,
              })
            }
          />
          <span>Allow admin override</span>
        </label>
      </div>
    </article>
  );
}

export default function EventControlsPanel({
  controls,
  effectiveState,
  timezoneLabel,
  loading,
  saving,
  error,
  message,
  onRefresh,
  onChangeDraft,
  onSave,
}) {
  const draftControls = controls || null;
  const resolvedTimezoneLabel = String(timezoneLabel || "IST (Asia/Kolkata)").trim() || "IST (Asia/Kolkata)";

  const hasDraft = Boolean(draftControls);

  return (
    <section className={styles.eventControlsPanel} aria-label="Event controls">
      <header className={styles.eventControlsHeader}>
        <div className={styles.eventControlsTitleWrap}>
          <p className={styles.eventControlsKicker}>
            <Settings2 size={14} aria-hidden="true" />
            Event Controls
          </p>
          <h2 className={styles.eventControlsTitle}>Event Schedule Controls</h2>
          <p className={styles.eventControlsSubtitle}>
            Set opening and closing times in one place.
          </p>
          <p className={styles.eventControlsSubtitle}>
            All times below use {resolvedTimezoneLabel}.
          </p>
        </div>

        <div className={styles.eventControlsActions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={onRefresh}
            disabled={loading || saving}
          >
            <RefreshCcw size={14} aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => onSave?.(draftControls)}
            disabled={!hasDraft || saving || loading}
          >
            <Save size={14} aria-hidden="true" />
            {saving ? "Saving..." : "Save Schedule (IST)"}
          </button>
        </div>
      </header>

      {loading ? (
        <p className={styles.eventControlsLoading}>Loading event controls...</p>
      ) : null}

      {error ? <p className={styles.inlineError} aria-live="assertive">{error}</p> : null}
      {message ? <p className={styles.eventControlsMessage} aria-live="polite">{message}</p> : null}

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
          <StatusPill
            label="Timer"
            status={effectiveState?.timer?.status}
          />
          <StatusPill label="Freeze" status={effectiveState?.freeze?.status} />
          <span className={styles.eventStatusNow}>
            <CalendarClock size={14} aria-hidden="true" />
            Snapshot at {toIstDateLabel(effectiveState?.now)} ({resolvedTimezoneLabel})
          </span>
        </div>
      ) : null}

      {hasDraft ? (
        <div className={styles.eventControlsStack}>
          <WindowEditor
            title="Workshop Registration"
            description="Choose when workshop registration is open."
            value={draftControls?.registration?.workshop || {}}
            timezoneLabel={resolvedTimezoneLabel}
            onChange={(nextWindow) =>
              onChangeDraft?.({
                ...(draftControls || {}),
                registration: {
                  ...(draftControls?.registration || {}),
                  workshop: nextWindow,
                },
              })
            }
          />

          <WindowEditor
            title="Hackathon Registration"
            description="Choose when hackathon registration is open."
            value={draftControls?.registration?.hackathon || {}}
            timezoneLabel={resolvedTimezoneLabel}
            onChange={(nextWindow) =>
              onChangeDraft?.({
                ...(draftControls || {}),
                registration: {
                  ...(draftControls?.registration || {}),
                  hackathon: nextWindow,
                },
              })
            }
          />

          <ProblemStatementEditor
            value={draftControls?.problemStatements || {}}
            timezoneLabel={resolvedTimezoneLabel}
            onChange={(nextProblemStatements) =>
              onChangeDraft?.({
                ...(draftControls || {}),
                problemStatements: nextProblemStatements,
              })
            }
          />

          <WindowEditor
            title="Hackathon Timer"
            description="Configure the public runtime countdown page."
            value={draftControls?.timer || {}}
            timezoneLabel={resolvedTimezoneLabel}
            onChange={(nextTimer) =>
              onChangeDraft?.({
                ...(draftControls || {}),
                timer: nextTimer,
              })
            }
          />

          <FreezeEditor
            value={draftControls?.freeze || {}}
            timezoneLabel={resolvedTimezoneLabel}
            onChange={(nextFreeze) =>
              onChangeDraft?.({
                ...(draftControls || {}),
                freeze: nextFreeze,
              })
            }
          />
        </div>
      ) : null}
    </section>
  );
}
