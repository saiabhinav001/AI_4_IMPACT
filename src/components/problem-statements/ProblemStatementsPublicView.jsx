"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toRuntimeApiUrl } from "../../../lib/api-base";

const DEFAULT_RELEASE_AT = "2026-04-17T10:30:00+05:30";

function asNormalizedStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function toMillis(value) {
  if (!value) return NaN;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function formatCountdown(msRemaining) {
  if (!Number.isFinite(msRemaining)) {
    return "00:00:00";
  }

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

export default function ProblemStatementsPublicView({ statements = [] }) {
  const [eventState, setEventState] = useState(null);
  const [timezoneLabel, setTimezoneLabel] = useState("IST (Asia/Kolkata)");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadEventState = async () => {
      try {
        const response = await fetch(toRuntimeApiUrl("/api/public/event-state"), {
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || data?.success !== true) {
          throw new Error(data?.error || "Failed to load release status.");
        }

        if (!isMounted) {
          return;
        }

        setEventState(data?.eventState || null);
        setTimezoneLabel(
          String(data?.timezoneLabel || "IST (Asia/Kolkata)").trim() || "IST (Asia/Kolkata)"
        );
        setError("");
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }

        setError(fetchError?.message || "Failed to load release status.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadEventState();

    const refreshId = setInterval(() => {
      void loadEventState();
    }, 45000);

    return () => {
      isMounted = false;
      clearInterval(refreshId);
    };
  }, []);

  useEffect(() => {
    setNowMs(Date.now());

    const tickId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(tickId);
    };
  }, []);

  const problemState = eventState?.problemStatements || {};
  const problemStatus = asNormalizedStatus(problemState?.status || "SCHEDULED");
  const releaseAtMs = toMillis(problemState?.releaseAt || DEFAULT_RELEASE_AT);
  const isLive = problemStatus === "LIVE";
  const countdownText = useMemo(() => {
    if (!Number.isFinite(releaseAtMs) || nowMs === null) {
      return "00:00:00";
    }

    return formatCountdown(releaseAtMs - nowMs);
  }, [releaseAtMs, nowMs]);

  const releaseAtLabel = useMemo(() => {
    if (!Number.isFinite(releaseAtMs)) {
      return "TBA";
    }

    return new Date(releaseAtMs).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
      timeZoneName: "short",
    });
  }, [releaseAtMs]);

  return (
    <main className="relative min-h-screen bg-[#06030f] text-white overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(141,54,213,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(141,54,213,0.08)_1px,transparent_1px)] bg-[size:90px_90px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:px-12">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div>
            <p className="text-[10px] font-black tracking-[0.34em] uppercase text-zinc-500">
              Public Release Board
            </p>
            <h1 className="mt-2 text-3xl sm:text-5xl font-black tracking-tight uppercase">
              Problem <span className="text-cyan-300">Statements</span>
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-zinc-400">
              Timezone: {timezoneLabel}
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-5 py-3 text-[11px] font-black tracking-[0.2em] uppercase text-zinc-100 transition-colors hover:bg-white/[0.14]"
          >
            Back To Home
          </Link>
        </header>

        {error ? (
          <div className="mb-8 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
            {error}
          </div>
        ) : null}

        {!isLive ? (
          <section className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6 sm:p-10 text-center">
            <p className="text-[10px] font-black tracking-[0.35em] uppercase text-cyan-300">
              Problem Statements Release In
            </p>
            <p className="mt-4 text-4xl sm:text-6xl font-black tracking-[0.15em] font-mono text-white">
              {countdownText}
            </p>
            <p className="mt-4 text-sm sm:text-base text-zinc-200">
              Scheduled Release: <span className="font-semibold text-cyan-200">{releaseAtLabel}</span>
            </p>
            <p className="mt-3 text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {problemStatus === "DISABLED"
                ? "Problem statements are currently disabled by admin controls."
                : "The statement list will auto-appear here as soon as release goes live."}
            </p>
          </section>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {(Array.isArray(statements) ? statements : []).map((statement, index) => (
              <motion.article
                key={statement.id || index}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: index * 0.04 }}
                className="rounded-3xl border border-white/12 bg-white/[0.04] p-5 sm:p-7"
              >
                <p className="text-[10px] font-black tracking-[0.25em] uppercase text-zinc-500">
                  {statement.id || `PS-${index + 1}`}
                </p>
                <h2 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-white">
                  {statement.title}
                </h2>
                <p className="mt-4 text-sm sm:text-base text-zinc-300 leading-relaxed">
                  {statement.description || "Description will be updated shortly."}
                </p>
              </motion.article>
            ))}

            {!loading && (!Array.isArray(statements) || statements.length === 0) ? (
              <div className="rounded-3xl border border-white/12 bg-white/[0.04] p-6 text-zinc-300">
                No problem statements are configured yet.
              </div>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
