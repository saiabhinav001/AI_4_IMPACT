import { useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarClock, Settings2, X } from "lucide-react";
import EventControlsPanel from "./EventControlsPanel";
import styles from "../admin-v2.module.css";

const IST_TIME_ZONE = "Asia/Kolkata";

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

export default function EventControlsWorkspaceModal({
  isOpen,
  onClose,
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
  const resolvedTimezoneLabel =
    String(timezoneLabel || "IST (Asia/Kolkata)").trim() || "IST (Asia/Kolkata)";

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) {
        onClose?.();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, saving]);

  if (!isOpen) {
    return null;
  }

  return (
    <motion.div
      className={styles.eventControlsOverlay}
      onClick={() => {
        if (!saving) {
          onClose?.();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Event controls workspace"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.section
        className={styles.eventControlsModal}
        onClick={(event) => event.stopPropagation()}
        initial={{ y: 18, opacity: 0.96 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 22, opacity: 0.96 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className={styles.eventControlsModalHeader}>
          <div className={styles.eventControlsModalTitleWrap}>
            <p className={styles.eventControlsKicker}>
              <Settings2 size={14} aria-hidden="true" />
              Event Controls Workspace
            </p>
            <h2 className={styles.eventControlsModalTitle}>Schedule Settings</h2>
            <p className={styles.eventControlsModalSubtitle}>
              Set timing for registration, problem release, timer, and freeze.
            </p>
            <div className={styles.eventControlsModalMeta}>
              <span className={styles.eventStatusNow}>
                <CalendarClock size={14} aria-hidden="true" />
                Snapshot at {toIstDateLabel(effectiveState?.now)} ({resolvedTimezoneLabel})
              </span>
            </div>
          </div>

          <button
            type="button"
            className={styles.iconButton}
            onClick={() => {
              if (!saving) {
                onClose?.();
              }
            }}
            aria-label="Close event controls workspace"
            disabled={saving}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.eventControlsModalBody}>
          <EventControlsPanel
            controls={controls}
            effectiveState={effectiveState}
            timezoneLabel={resolvedTimezoneLabel}
            loading={loading}
            saving={saving}
            error={error}
            message={message}
            onRefresh={onRefresh}
            onChangeDraft={onChangeDraft}
            onSave={onSave}
          />
        </div>
      </motion.section>
    </motion.div>
  );
}
