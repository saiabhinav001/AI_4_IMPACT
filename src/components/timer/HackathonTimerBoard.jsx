"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { toRuntimeApiUrl } from "../../../lib/api-base";
import styles from "./HackathonTimerBoard.module.css";

const EVENT_TIME_ZONE = "Asia/Kolkata";
const STATUS_LABELS = {
  OPEN: "Live",
  SCHEDULED: "Scheduled",
  CLOSED: "Closed",
  DISABLED: "Disabled",
};

function toMillis(value) {
  if (!value) return NaN;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? NaN : parsed;
}

function toIstDateLabel(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: EVENT_TIME_ZONE,
    timeZoneName: "short",
  });
}

function formatRemaining(diffMs) {
  const safeMs = Math.max(0, Number(diffMs) || 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
  };
}

function statusClassName(status) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "OPEN") return styles.statusOpen;
  if (normalized === "SCHEDULED") return styles.statusScheduled;
  if (normalized === "CLOSED") return styles.statusClosed;
  return styles.statusDisabled;
}

export default function HackathonTimerBoard() {
  const [eventState, setEventState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());

  const fetchEventState = useCallback(async () => {
    try {
      const response = await fetch(toRuntimeApiUrl("/api/public/event-state"), {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.eventState) {
        throw new Error(data?.error || "Failed to load timer state.");
      }

      setEventState(data.eventState);
      setError("");
    } catch (fetchError) {
      setError(fetchError?.message || "Failed to load timer state.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEventState();

    const timer = setInterval(() => {
      void fetchEventState();
    }, 30000);

    return () => clearInterval(timer);
  }, [fetchEventState]);

  useEffect(() => {
    const ticker = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(ticker);
  }, []);

  const timerState = eventState?.timer || {};
  const timerStatus = String(timerState?.status || "DISABLED").toUpperCase();
  const timerLabel = STATUS_LABELS[timerStatus] || timerStatus || "Disabled";

  const openAtMs = toMillis(timerState?.openAt);
  const closeAtMs = toMillis(timerState?.closeAt);

  const activeTarget = useMemo(() => {
    if (timerStatus === "SCHEDULED" && Number.isFinite(openAtMs)) {
      return {
        label: "Timer starts in",
        targetMs: openAtMs,
      };
    }

    if (timerStatus === "OPEN" && Number.isFinite(closeAtMs)) {
      return {
        label: "Hackathon runtime remaining",
        targetMs: closeAtMs,
      };
    }

    return null;
  }, [closeAtMs, openAtMs, timerStatus]);

  const remaining = formatRemaining(activeTarget ? activeTarget.targetMs - nowMs : 0);

  const helperMessage = useMemo(() => {
    if (timerStatus === "DISABLED") {
      return "Timer is disabled in admin controls.";
    }

    if (timerStatus === "SCHEDULED") {
      return "Countdown is waiting for configured start time.";
    }

    if (timerStatus === "OPEN" && !Number.isFinite(closeAtMs)) {
      return "Timer is live, but close time is not configured yet.";
    }

    if (timerStatus === "CLOSED") {
      return "Configured timer has completed.";
    }

    return activeTarget?.label || "Waiting for timer configuration.";
  }, [activeTarget?.label, closeAtMs, timerStatus]);

  return (
    <main className={styles.page}>
      <section className={styles.minimalPanel} aria-live="polite">
        {error ? <p className={styles.inlineError}>{error}</p> : null}

        <div className={styles.branding}>
          <span className={styles.brandTitle}>AI 4 IMPACT</span>
          <span className={styles.brandSubtitle}>RUNTIME MONITOR</span>
        </div>

        <div className={styles.timerGrid}>
          <article className={styles.timerCard}>
            <p className={styles.timerValue}>{remaining.hours}</p>
            <p className={styles.timerLabel}>Hours</p>
          </article>
          <article className={styles.timerCard}>
            <p className={styles.timerValue}>{remaining.minutes}</p>
            <p className={styles.timerLabel}>Minutes</p>
          </article>
          <article className={styles.timerCard}>
            <p className={styles.timerValue}>{remaining.seconds}</p>
            <p className={styles.timerLabel}>Seconds</p>
          </article>
        </div>

        <p className={styles.message}>{helperMessage}</p>

        <div className={styles.statusFooter}>
          <div className={styles.statusBadgeDot}>
            <span className={statusClassName(timerStatus)} />
            <span className={styles.statusText}>{timerLabel}</span>
          </div>
          <span className={styles.snapshot}>Snapshot: {toIstDateLabel(eventState?.now)}</span>
        </div>
      </section>
    </main>
  );
}
