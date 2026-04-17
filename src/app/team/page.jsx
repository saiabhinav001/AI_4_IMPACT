"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { getUserRole, logoutAdmin, onUserAuthChange } from "../../../lib/auth";
import { toRuntimeApiUrl } from "../../../lib/api-base";
import { buildRuntimeIdTokenHeaders } from "../../../lib/runtime-auth";
import { ROLES } from "../../../lib/constants/roles";

const DEFAULT_PROBLEM_RELEASE_AT = "2026-04-17T10:30:00+05:30";

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

function SectionHeading({ number, title, color = "purple" }) {
  const isPurple = color === "purple";
  const glowClass = isPurple ? "from-[#8D36D5] to-[#46067A]" : "from-[#00FFFF] to-[#008080]";
  const textClass = isPurple ? "text-[#8D36D5]" : "text-[#00FFFF]";

  return (
    <div className="mb-12">
      <div className="flex items-center gap-4 mb-3">
        <div className={`h-[2px] w-10 bg-gradient-to-r ${glowClass}`} />

      </div>
      <h2 className="type-h3 font-black tracking-tighter text-white flex items-center gap-3">
        {title.split(' ').map((word, i) => (
          i === 1 ? (
            <span key={i} className={`bg-gradient-to-r ${glowClass} bg-clip-text text-transparent italic`}>
              {word}
            </span>
          ) : <span key={i}>{word}</span>
        ))}
      </h2>
    </div>
  );
}

function DashboardCard({ children, className = "", sheenColor = "rgba(141, 54, 213, 0.1)" }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const mouseXSpring = useSpring(mouseX);
  const mouseYSpring = useSpring(mouseY);

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["3deg", "-3deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-3deg", "3deg"]);
  const sheenX = useTransform(mouseXSpring, [-0.5, 0.5], ["20%", "-20%"]);
  const sheenY = useTransform(mouseYSpring, [-0.5, 0.5], ["20%", "-20%"]);

  const handleMouseMove = (e) => {
    // Only apply 3D effect on desktop sizes to prevent glitching on mobile touch
    if (window.innerWidth < 768) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY }}
      className={`perspective-1000 preserve-3d group ${className}`}
    >
      <motion.div
        className="relative backdrop-blur-[40px] overflow-hidden rounded-[24px] sm:rounded-[40px] border border-white/20 sm:border-white/10 bg-[#0F061C]/70 sm:bg-[#0F061C]/40 shadow-[0_20px_50px_rgba(0,0,0,0.8)] sm:shadow-[0_40px_100px_rgba(0,0,0,0.6)] glass-sheen"
        style={{ "--sheen-x": sheenX, "--sheen-y": sheenY }}
      >
        {/* Hardware Corner Notches */}
        <div className="absolute top-0 left-0 h-8 w-8 sm:h-10 sm:w-10 border-t-2 border-l-2 border-white/20 sm:border-white/10 rounded-tl-[24px] sm:rounded-tl-[40px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 h-8 w-8 sm:h-10 sm:w-10 border-b-2 border-r-2 border-white/20 sm:border-white/10 rounded-br-[24px] sm:rounded-br-[40px] pointer-events-none" />

        <div className="scanning-ray opacity-10 group-hover:opacity-30 transition-opacity" />
        <div className="relative z-10 p-4 sm:p-8 lg:p-10">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "pending").toLowerCase();

  const configMap = {
    verified: {
      bgColor: "bg-emerald-500/10",
      textColor: "text-emerald-400",
      borderColor: "border-emerald-500/20",
      glowColor: "shadow-[0_0_20px_rgba(16,185,129,0.2)]",
      label: "VERIFIED",
    },
    rejected: {
      bgColor: "bg-rose-500/10",
      textColor: "text-rose-400",
      borderColor: "border-rose-500/20",
      glowColor: "shadow-[0_0_20px_rgba(244,63,94,0.2)]",
      label: "REJECTED",
    },
    pending: {
      bgColor: "bg-amber-500/10",
      textColor: "text-amber-400",
      borderColor: "border-amber-500/20",
      glowColor: "shadow-[0_0_20px_rgba(245,158,11,0.2)]",
      label: "PENDING",
    },
  };

  const cfg = configMap[normalized] || configMap.pending;

  return (
    <span className={`inline-flex items-center gap-3 px-7 py-4 rounded-2xl text-sm font-black tracking-[0.15em] border w-full justify-center ${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor} ${cfg.glowColor} transition-all duration-500 hover:scale-105`}>
      <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${cfg.textColor.replace('text-', 'bg-')} animate-pulse shadow-[0_0_10px_currentColor]`} />
      {cfg.label}
    </span>
  );
}

export default function TeamLeadDashboard() {
  const router = useRouter();

  const DEMO_MODE = false;

  const [authChecking, setAuthChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [user, setUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [selectionDialogProblem, setSelectionDialogProblem] = useState(null);
  const [selectionSubmitting, setSelectionSubmitting] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const [selectionMessage, setSelectionMessage] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");

  const pollTimerRef = useRef(null);
  const dashboardRef = useRef(null);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const fetchDashboard = useCallback(async (currentUser, options = {}) => {
    if (!currentUser) return;

    const silent = options?.silent === true;

    if (!silent) {
      setLoading(true);
    }

    if (!silent) {
      setError("");
    }

    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch(toRuntimeApiUrl("/api/team/dashboard"), {
        headers: buildRuntimeIdTokenHeaders(idToken),
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/auth");
          return;
        }

        throw new Error(data?.error || "Failed to load team dashboard.");
      }

      setDashboard(data?.dashboard || null);
      setError("");
    } catch (err) {
      if (!silent) {
        setDashboard(null);
      }
      setError(err?.message || "Failed to load team dashboard.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [router]);

  useEffect(() => {
    let isActive = true;

    // PRODUCTION_MODE: Restoring security and live data fetching
    
    if (DEMO_MODE) {
      // (Demo logic removed for production)
      return;
    }

    const unsub = onUserAuthChange(
      (nextUser) => {
        const resolve = async () => {
          if (!isActive) return;

          if (!nextUser) {
            setAuthChecking(false);
            router.replace("/auth");
            return;
          }

          const role = await getUserRole(nextUser);
          if (!isActive) return;

          if (role === ROLES.ADMIN) {
            router.replace("/admin");
            return;
          }

          setUser(nextUser);
          setAuthChecking(false);
          await fetchDashboard(nextUser);
        };

        void resolve();
      },
      () => {
        if (!isActive) return;
        setAuthChecking(false);
        router.replace("/auth");
      }
    );

    // Safety timeout: If auth or data takes > 10s, force show error/stop loading
    const timer = setTimeout(() => {
      if (isActive && (authChecking || loading)) {
        setLoadingTimeout(true);
        setLoading(false);
        setAuthChecking(false);
      }
    }, 12000);

    return () => {
      isActive = false;
      unsub();
      clearTimeout(timer);
    };
  }, [fetchDashboard, router]);

  useEffect(() => {
    dashboardRef.current = dashboard;
  }, [dashboard]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!selectionDialogProblem) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectionDialogProblem]);

  const resolveDashboardPollInterval = useCallback(
    (snapshot) => {
      if (!snapshot || selectionSubmitting) {
        return 0;
      }

      const teamFrozen = snapshot?.team?.freeze?.locked === true;
      const alreadySelected = Boolean(
        snapshot?.selected_problem?.problem_id || snapshot?.selected_problem?.problem_title
      );

      if (teamFrozen || alreadySelected) {
        return 0;
      }

      const problemState = snapshot?.event_controls?.problem_statements || {};
      const freezeState = snapshot?.event_controls?.freeze || {};

      const problemStatus = asNormalizedStatus(problemState?.status);
      const freezeStatus = asNormalizedStatus(freezeState?.status);

      if (problemStatus === "LIVE" && freezeStatus === "OPEN") {
        return 5000;
      }

      if (problemStatus === "LIVE") {
        return 12000;
      }

      if (problemStatus === "SCHEDULED") {
        const releaseAtMs = toMillis(problemState?.releaseAt || DEFAULT_PROBLEM_RELEASE_AT);
        if (Number.isFinite(releaseAtMs) && releaseAtMs - Date.now() <= 10 * 60 * 1000) {
          return 5000;
        }

        return 30000;
      }

      if (freezeStatus === "SCHEDULED") {
        return 30000;
      }

      return 0;
    },
    [selectionSubmitting]
  );

  useEffect(() => {
    if (!user) {
      clearPollTimer();
      return undefined;
    }

    let cancelled = false;

    const scheduleNextPoll = () => {
      if (cancelled) {
        return;
      }

      clearPollTimer();

      const intervalMs = resolveDashboardPollInterval(dashboardRef.current);
      if (!intervalMs) {
        return;
      }

      pollTimerRef.current = setTimeout(async () => {
        if (cancelled) {
          return;
        }

        await fetchDashboard(user, { silent: true });
        scheduleNextPoll();
      }, intervalMs);
    };

    scheduleNextPoll();

    return () => {
      cancelled = true;
      clearPollTimer();
    };
  }, [user, fetchDashboard, resolveDashboardPollInterval, clearPollTimer]);

  const closeSelectionDialog = useCallback(() => {
    if (selectionSubmitting) {
      return;
    }

    setSelectionDialogProblem(null);
    setSelectionError("");
    setShowConfirmation(false);
    setConfirmationInput("");
  }, [selectionSubmitting]);

  const openSelectionDialog = useCallback((problem) => {
    if (!problem || selectionSubmitting) {
      return;
    }

    setSelectionMessage("");
    setSelectionError("");
    setSelectionDialogProblem(problem);
    setShowConfirmation(false);
  }, [selectionSubmitting]);

  const handleConfirmProblemSelection = useCallback(async () => {
    if (selectionSubmitting) return;
    setSelectionError("");
    setSelectionSubmitting(true);
    setSelectionError("");
    setSelectionMessage("");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(toRuntimeApiUrl("/api/team/problem-selection"), {
        method: "POST",
        headers: buildRuntimeIdTokenHeaders(idToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          problem_id: selectionDialogProblem.problem_id,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to lock problem statement selection.");
      }

      // Success! Update local state immediately to show locked view
      setDashboard(prev => ({
        ...prev,
        selected_problem: {
          problem_id: selectionDialogProblem.problem_id,
          problem_title: selectionDialogProblem.title,
          selected_at: new Date().toISOString()
        }
      }));

      closeSelectionDialog();
      await fetchDashboard(user, { silent: true });

      setSelectionMessage(
        data?.message || "Problem statement selected and locked successfully."
      );
    } catch (selectionFailure) {
      setSelectionError(
        selectionFailure?.message || "Failed to lock problem statement selection."
      );
    } finally {
      setSelectionSubmitting(false);
    }
  }, [selectionDialogProblem, selectionSubmitting, user, fetchDashboard, closeSelectionDialog]);

  const handleLogout = async () => {
    clearPollTimer();
    await logoutAdmin();
    router.replace("/auth");
  };

  const createdAtLabel = useMemo(() => {
    const createdAt = dashboard?.team?.created_at;
    if (!createdAt) return "N/A";

    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "N/A";

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [dashboard?.team?.created_at]);

  const problemStatements = useMemo(
    () => (Array.isArray(dashboard?.problem_statements) ? dashboard.problem_statements : []),
    [dashboard?.problem_statements]
  );

  const problemControlState = dashboard?.event_controls?.problem_statements || {};
  const freezeControlState = dashboard?.event_controls?.freeze || {};
  const teamFreezeState = dashboard?.team?.freeze || {};

  const problemStatus = asNormalizedStatus(problemControlState?.status);
  const freezeStatus = asNormalizedStatus(freezeControlState?.status);
  const teamFrozen = teamFreezeState?.locked === true;
  const hasSelectedProblem = Boolean(
    dashboard?.selected_problem?.problem_id || dashboard?.selected_problem?.problem_title
  );

  const releaseAtMs = toMillis(problemControlState?.releaseAt || DEFAULT_PROBLEM_RELEASE_AT);
  const selectionExpiryMs = Number.isFinite(releaseAtMs) ? releaseAtMs + 20 * 60 * 1000 : null;
  const freezeCloseAtMs = toMillis(freezeControlState?.closeAt);
  const freezeOpenAtMs = toMillis(freezeControlState?.openAt);

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

  const countdownModel = useMemo(() => {
    if (hasSelectedProblem || teamFrozen) {
      return null;
    }

    if (problemStatus === "SCHEDULED" && Number.isFinite(releaseAtMs)) {
      return {
        label: "PROBLEM RELEASE IN",
        targetMs: releaseAtMs,
      };
    }

    if (
      problemStatus === "LIVE" &&
      Number.isFinite(selectionExpiryMs) &&
      nowMs < selectionExpiryMs
    ) {
      return {
        label: "SELECTION WINDOW CLOSES IN",
        targetMs: selectionExpiryMs,
      };
    }

    if (
      problemStatus === "LIVE" &&
      freezeStatus === "OPEN" &&
      Number.isFinite(freezeCloseAtMs)
    ) {
      return {
        label: "ADMIN FREEZE IN",
        targetMs: freezeCloseAtMs,
      };
    }

    if (freezeStatus === "SCHEDULED" && Number.isFinite(freezeOpenAtMs)) {
      return {
        label: "FREEZE WINDOW OPENS IN",
        targetMs: freezeOpenAtMs,
      };
    }

    return null;
  }, [
    hasSelectedProblem,
    teamFrozen,
    problemStatus,
    releaseAtMs,
    freezeStatus,
    freezeCloseAtMs,
    freezeOpenAtMs,
  ]);

  const countdownText = countdownModel
    ? formatCountdown(countdownModel.targetMs - nowMs)
    : "";

  const teamName = String(dashboard?.team?.team_name || "").trim().toUpperCase();
  const isBypassTeam = teamName === "STR";

  const canSelectProblem =
    (isBypassTeam || problemStatus === "LIVE") && 
    !hasSelectedProblem && 
    !teamFrozen && 
    freezeStatus !== "CLOSED" &&
    (DEMO_MODE || (isBypassTeam || (Number.isFinite(selectionExpiryMs) && nowMs < selectionExpiryMs)));

  const problemSelectionHint = useMemo(() => {
    if (teamFrozen) {
      return "Team workspace is frozen. Problem statement changes are locked.";
    }

    if (problemStatus === "LIVE" && Number.isFinite(selectionExpiryMs) && nowMs >= selectionExpiryMs && !DEMO_MODE && !isBypassTeam) {
      return "Problem statements selection is freezed (20-minute window elapsed).";
    }

    if (freezeStatus === "CLOSED") {
      return "Selection window is closed. Contact admin only if override is required.";
    }

    if (problemStatus === "DISABLED") {
      return "Problem statements are currently disabled by admin controls.";
    }

    if (isBypassTeam) {
      return "Testing release active for your team. You may proceed with selection.";
    }

    if (problemStatus === "SCHEDULED") {
      return "Problem statements will be released soon.";
    }

    if (problemStatus === "LIVE" && problemStatements.length === 0) {
      return "Problem statements are live. Please wait while challenge cards are loading.";
    }

    return "Problem statements will be released soon.";
  }, [freezeStatus, problemStatus, problemStatements.length, teamFrozen]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.3 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 30 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
  };

  if ((authChecking || loading) && !loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-sm font-bold tracking-[0.4em] text-[#00FFFF] uppercase animate-pulse">
          &gt;&gt; BOOTING_TEAM_CLIENT...
        </p>
      </div>
    );
  }

  if (loadingTimeout && !dashboard && !error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black p-10 text-center">
        <p className="text-rose-500 font-black tracking-widest mb-6 uppercase">FATAL_ERROR: CONNECTION_TIMEOUT</p>
        <p className="text-zinc-400 text-sm max-w-md mb-8">
          The dashboard is taking longer than expected to load. This might be due to a slow network or authentication sync delay.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold tracking-widest transition-all"
        >
          RETRY_HANDSHAKE
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#07020E] text-[#EDE8F5] selection:bg-[#8D36D5]/30 relative overflow-hidden font-[var(--font-body)]">
      {/* Immersive Background Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute inset-0 animate-breathing"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, rgba(141,54,213,0.06) 0px, transparent 1px, transparent 100px, rgba(141,54,213,0.06) 100px), repeating-linear-gradient(90deg, rgba(141,54,213,0.06) 0px, transparent 1px, transparent 100px, rgba(141,54,213,0.06) 100px)`,
            maskImage: "radial-gradient(ellipse at 50% 50%, black 0%, transparent 90%)"
          }}
        />

        <motion.div
          className="absolute -left-24 -top-28 w-[600px] h-[600px] rounded-full blur-[100px] opacity-[0.12] bg-[#46067A]"
          animate={{ x: [0, 50], y: [0, 80], scale: [1, 1.1, 1] }}
          transition={{ duration: 25, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-20 top-[40%] w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.1] bg-[#8D36D5]"
          animate={{ x: [0, -60], y: [0, 100], scale: [1, 1.2, 1] }}
          transition={{ duration: 30, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        />

        <div className="noise-overlay opacity-[0.04]" />
      </div>

      {/* Dashboard Top Header - Ultra Premium Glass */}
      <div className="sticky top-0 z-[100] border-b border-white/5 bg-[#0F061C]/80 backdrop-blur-[40px] px-6 py-6 sm:py-8 shadow-[0_20px_80px_rgba(0,0,0,0.8)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 sm:px-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-2 w-full md:w-auto"
          >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight flex items-center gap-2 sm:gap-4 text-white flex-wrap"
              style={{ textShadow: '0 0 40px rgba(141, 54, 213, 0.4)' }}>
              TEAM <span className="bg-gradient-to-r from-[#8D36D5] to-[#46067A] bg-clip-text text-transparent italic">DASHBOARD</span>
              <span className="hidden sm:inline-block h-2.5 w-2.5 rounded-full bg-[#00FFFF] animate-pulse ml-1 shadow-[0_0_15px_#00FFFF]" />
            </h1>
            <div className="flex flex-wrap items-center gap-3 sm:gap-5 mt-1 sm:mt-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00FFFF] shadow-[0_0_8px_#00FFFF]" />
                <span className="text-[9px] sm:text-[10px] font-bold text-[#00FFFF] tracking-[0.2em] uppercase opacity-80 break-all">
                  ID: {user?.email?.split('@')[0] || "LOGGED_IN"}
                </span>
              </div>
            </div>
          </motion.div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full md:w-auto mt-2 md:mt-0">
            <Link
              href="/"
              className="group relative flex-1 md:flex-none px-6 py-3.5 rounded-2xl border border-white/10 bg-white/5 transition-all outline-none hover:bg-white/10 active:scale-[0.98]"
            >
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70 group-hover:text-white transition-colors text-center block w-full">
                &lt; BACK TO HOME
              </span>
            </Link>
            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: "rgba(244,63,94,0.15)" }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 md:flex-none relative px-6 py-3.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 transition-all font-heading"
              onClick={handleLogout}
            >
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-400 text-center block w-full">
                TERMINATE
              </span>
            </motion.button>
          </div>
        </div>
      </div>

      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto pt-20 pb-40 px-3 sm:px-12 relative z-10 lg:pt-24"
      >
        {error && (
          <motion.div
            variants={itemVariants}
            className="mb-16 p-10 rounded-[40px] bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-[14px] tracking-widest flex items-center gap-6 uppercase shadow-2xl backdrop-blur-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/20 text-sm animate-pulse">!</div>
            <span>FATAL_ERROR: {error}</span>
          </motion.div>
        )}

        {dashboard && (
          <div className="grid grid-cols-1 gap-16 sm:gap-24">
            {/* Team Overview */}
            <motion.div variants={itemVariants}>
              <div className="flex flex-col gap-4 mb-6 ml-4">
                <h2 className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-4">
                  Team <span className="text-[#8D36D5]">Overview</span>
                  <div className="h-[2px] w-32 bg-gradient-to-r from-[#8D36D5] to-transparent opacity-50" />
                </h2>
              </div>
              <DashboardCard>
                <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 pt-4">
                  {[
                    { label: "TEAM NAME", val: dashboard.team?.team_name, color: "text-white" },
                    { label: "INSTITUTION", val: dashboard.team?.college, color: "text-zinc-200" },
                    { label: "TEAM SIZE", val: dashboard.team?.team_size, color: "text-[#00FFFF]" },
                    { label: "JOIN DATE", val: createdAtLabel, color: "text-zinc-300" }
                  ].map((item) => (
                    <div key={item.label} className="flex flex-col gap-4 group/item px-1 sm:px-4">
                      <span className="text-[12px] font-black text-zinc-500 tracking-[0.3em] uppercase transition-colors group-hover/item:text-[#8D36D5]">
                        {item.label}
                      </span>
                      <span className={`text-xl font-black uppercase leading-snug transition-all duration-300 group-hover/item:translate-x-2 drop-shadow-md ${item.color}`}>
                        {item.val || "NOT SET"}
                      </span>
                      <div className="h-[2px] w-full bg-white/10 group-hover/item:bg-[#8D36D5]/50 transition-all duration-500 shadow-sm" />
                    </div>
                  ))}
                </div>
              </DashboardCard>
            </motion.div>

            {/* Payment Status */}
            <motion.div variants={itemVariants}>
              <div className="flex flex-col gap-4 mb-6 ml-4">
                <h2 className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-4">
                  Payment <span className="text-[#00FFFF]">Status</span>
                  <div className="h-[2px] w-32 bg-gradient-to-r from-[#00FFFF] to-transparent opacity-50" />
                </h2>
              </div>
              <DashboardCard sheenColor="rgba(0, 255, 255, 0.1)">
                {/* Single-row flex layout so everything aligns on the same vertical center */}
                <div className="flex flex-col lg:flex-row items-center gap-10 py-2">

                  {/* ₹ Amount */}
                  <div className="flex flex-col gap-3 min-w-[160px]">
                    <span className="text-[12px] font-black text-zinc-500 tracking-[0.3em] uppercase">REGISTRATION FEE</span>
                    <span className="text-6xl font-black text-white tracking-tighter drop-shadow-2xl leading-none">
                      ₹{dashboard.payment?.amount ?? 800}
                    </span>
                  </div>

                  <div className="hidden lg:block h-20 w-px bg-white/10 flex-shrink-0" />

                  {/* Transaction ID */}
                  <div className="flex flex-col gap-3 flex-1 min-w-0">
                    <span className="text-[12px] font-black text-zinc-500 tracking-[0.3em] uppercase">TRANSACTION ID</span>
                    <div className="text-base font-bold text-[#00FFFF] font-mono tracking-wide uppercase bg-white/[0.05] px-5 py-4 rounded-2xl border border-white/10 shadow-lg w-full text-center whitespace-nowrap overflow-hidden overflow-ellipsis">
                      {dashboard.payment?.upi_transaction_id || "NOT FOUND"}
                    </div>
                  </div>

                  {/* Verification */}
                  <div className="flex flex-col gap-3 min-w-[160px]">
                    <span className="text-[12px] font-black text-zinc-500 tracking-[0.3em] uppercase">VERIFICATION</span>
                    <StatusBadge status={dashboard.payment?.status} />
                  </div>

                </div>
              </DashboardCard>
            </motion.div>

            {/* Team Members */}
            <motion.div variants={itemVariants}>
              <div className="flex flex-col gap-4 mb-6 ml-4">
                <h2 className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-4">
                  Team <span className="text-[#8D36D5]">Members</span>
                  <div className="h-[2px] w-32 bg-gradient-to-r from-[#8D36D5] to-transparent opacity-50" />
                </h2>
              </div>
              <DashboardCard>
                {/* Mobile: card layout; Desktop: table layout */}
                <div className="hidden md:block overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-separate border-spacing-y-6">
                    <thead>
                      <tr className="text-[11px] font-bold text-zinc-500 tracking-[0.35em] uppercase opacity-80">
                        <th className="pb-4 px-6">ROLE</th>
                        <th className="pb-4 px-6">NAME</th>
                        <th className="pb-4 px-6">EMAIL</th>
                        <th className="pb-4 px-6 text-right">PHONE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dashboard.members || []).map((member) => (
                        <tr key={member.participant_id} className="group/row transition-all duration-300">
                          <td className="py-5 px-6 rounded-l-[20px] bg-white/[0.05] border-y border-l border-white/5 group-hover/row:bg-white/[0.12] group-hover/row:border-[#8D36D5]/80 transition-all">
                            <span className={`text-[10px] font-black px-4 py-2 rounded-full tracking-[0.2em] uppercase whitespace-nowrap ${member.is_leader ? "bg-[#8D36D5] text-white shadow-[0_0_20px_rgba(141,54,213,0.5)]" : "bg-white/10 text-zinc-300 border border-white/20"}`}>
                              {member.is_leader ? "TEAM LEAD" : "MEMBER"}
                            </span>
                          </td>
                          <td className="py-5 px-6 bg-white/[0.05] border-y border-white/5 group-hover/row:bg-white/[0.12] transition-all">
                            <span className="text-base font-bold text-white uppercase tracking-tight group-hover/row:text-[#8D36D5] transition-colors">{member.name || "UNNAMED"}</span>
                          </td>
                          <td className="py-5 px-6 bg-white/[0.05] border-y border-white/5 group-hover/row:bg-white/[0.12] transition-all">
                            <span className="text-sm font-medium text-zinc-400 lowercase font-mono group-hover/row:text-zinc-200 transition-colors">
                              {member.email || "---"}
                            </span>
                          </td>
                          <td className="py-5 px-6 rounded-r-[20px] bg-white/[0.05] border-y border-r border-white/5 group-hover/row:bg-white/[0.12] transition-all text-right">
                            <span className="text-sm font-mono text-[#00FFFF] drop-shadow-sm whitespace-nowrap">
                              {member.phone || "---"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card layout */}
                <div className="md:hidden flex flex-col gap-4">
                  {(dashboard.members || []).map((member) => (
                    <div
                      key={member.participant_id}
                      className="rounded-2xl bg-white/[0.05] border border-white/10 p-5 flex flex-col gap-4 hover:bg-white/[0.10] hover:border-[#8D36D5]/40 transition-all duration-300"
                    >
                      {/* Top row: badge + name */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`text-[10px] font-black px-3 py-1.5 rounded-full tracking-[0.2em] uppercase flex-shrink-0 ${member.is_leader ? "bg-[#8D36D5] text-white shadow-[0_0_16px_rgba(141,54,213,0.5)]" : "bg-white/10 text-zinc-300 border border-white/20"}`}>
                          {member.is_leader ? "TEAM LEAD" : "MEMBER"}
                        </span>
                        <span className="text-base font-bold text-white uppercase tracking-tight truncate">{member.name || "UNNAMED"}</span>
                      </div>
                      {/* Email */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-zinc-600 tracking-[0.25em] uppercase">EMAIL</span>
                        <span className="text-sm font-mono text-zinc-400 break-all">{member.email || "---"}</span>
                      </div>
                      {/* Phone */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-zinc-600 tracking-[0.25em] uppercase">PHONE</span>
                        <span className="text-sm font-mono text-[#00FFFF]">{member.phone || "---"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </DashboardCard>
            </motion.div>

            {/* Problem Statement Selection & Latest Updates */}
            <div className="flex flex-col gap-16 sm:gap-24">
              {/* Problem Statement Selection */}
              <motion.div variants={itemVariants}>
                <div className="flex flex-col gap-3 mb-6 ml-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider whitespace-nowrap">
                      Problem Statement
                    </h2>
                    <span className="text-xl sm:text-2xl font-black text-[#00FFFF] uppercase tracking-wider whitespace-nowrap">Selection</span>
                  </div>
                  <div className="h-[2px] w-32 bg-gradient-to-r from-[#00FFFF] to-transparent opacity-50" />
                </div>
                <DashboardCard sheenColor="rgba(0, 255, 255, 0.1)">
                  <div className="space-y-6 sm:space-y-8">
                    {countdownModel ? (
                      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-4 sm:px-6 sm:py-5">
                        <p className="text-[10px] font-black tracking-[0.3em] uppercase text-cyan-300">
                          {countdownModel.label}
                        </p>
                        <p className="mt-2 text-2xl sm:text-4xl font-black text-white tracking-[0.12em] font-mono">
                          {countdownText}
                        </p>
                      </div>
                    ) : null}

                    {selectionMessage ? (
                      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
                        {selectionMessage}
                      </div>
                    ) : null}

                    {selectionError ? (
                      <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
                        {selectionError}
                      </div>
                    ) : null}

                    {hasSelectedProblem ? (
                      <div className="p-6 sm:p-10 lg:p-14 rounded-[32px] sm:rounded-[48px] bg-gradient-to-br from-[#8D36D5]/30 to-[#46067A]/15 border-2 border-[#8D36D5]/50 shadow-[0_40px_120px_rgba(0,0,0,0.8)] relative group/card transition-all overflow-hidden hover:border-[#8D36D5]">
                        <div className="absolute top-0 right-0 p-6 sm:p-10 opacity-[0.05] group-hover/card:opacity-[0.12] transition-opacity pointer-events-none">
                          <svg className="w-24 h-24 sm:w-40 sm:h-40 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                          </svg>
                        </div>
                        <h3 className="text-[clamp(1.2rem,4vw,2.8rem)] font-black text-white uppercase mb-6 sm:mb-10 leading-tight tracking-tighter drop-shadow-2xl pr-20 sm:pr-28">
                          {dashboard.selected_problem.problem_title}
                        </h3>
                        <p className="text-sm sm:text-base font-medium leading-relaxed text-zinc-200 max-w-3xl mb-6 sm:mb-8 font-[var(--font-body)]">
                          {dashboard.selected_problem.problem_description || "Problem statement locked for your team."}
                        </p>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-5 sm:gap-10 pt-6 sm:pt-10 border-t border-white/20">
                          <div className="flex flex-col gap-2">
                            <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest font-[var(--font-body)]">CHALLENGE ID</span>
                            <span className="text-base sm:text-lg font-black text-[#8D36D5] font-mono bg-[#8D36D5]/20 px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl border border-[#8D36D5]/40 shadow-xl inline-block">
                              #{dashboard.selected_problem.problem_id}
                            </span>
                          </div>
                          <div className="flex flex-col gap-2">
                            <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest font-[var(--font-body)]">LOCK DATE</span>
                            <span className="text-base font-bold text-zinc-100 font-mono italic">{dashboard.selected_problem.selected_at || "Recorded"}</span>
                          </div>
                        </div>
                      </div>
                    ) : canSelectProblem && problemStatements.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                        {problemStatements.map((problem) => {
                          const isFull = problem?.is_full === true || (problem?.available_slots !== undefined ? Number(problem.available_slots) <= 0 : false);

                          return (
                            <motion.article
                              key={problem.problem_id}
                              whileHover={{ y: -5, scale: 1.02 }}
                              className="relative group rounded-[32px] border border-white/10 bg-[#0F061C]/50 p-6 sm:p-8 transition-all hover:border-[#00FFFF]/40 hover:bg-[#0F061C]/80 cursor-pointer overflow-hidden backdrop-blur-xl"
                              onClick={() => openSelectionDialog(problem)}
                            >
                              <div className="absolute top-0 right-0 p-4">
                                <span className={`text-[10px] font-black px-4 py-2 rounded-xl border-2 tracking-widest uppercase font-[var(--font-body)] shadow-lg ${isFull ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' : 'bg-[#00FFFF]/20 border-[#00FFFF]/50 text-[#00FFFF]'}`}>
                                  {isFull ? "FULL" : `${problem.selected_teams_count || 0}/${problem.max_teams_allowed || 8}`}
                                </span>
                              </div>

                              <p className="text-[10px] font-black tracking-[0.3em] uppercase text-zinc-500 mt-2 font-[var(--font-body)]">
                                {problem.problem_id}
                              </p>
                              <h3 className="mt-3 text-xl font-black text-white tracking-tight leading-tight group-hover:text-[#00FFFF] transition-colors pr-16 line-clamp-2">
                                {problem.title}
                              </h3>
                              <p className="mt-5 text-sm text-zinc-400 leading-relaxed line-clamp-4 font-[var(--font-body)] tracking-wide">
                                {problem.description || "Problem statement details will be updated shortly."}
                              </p>

                              <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6">
                                <span className="text-[10px] font-black text-zinc-600 tracking-widest uppercase font-[var(--font-body)] group-hover:text-[#00FFFF]/50 transition-colors">
                                  {isFull ? "CAPACITY REACHED" : "AVAILABLE FOR SELECTION"}
                                </span>
                                <div className="flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                                  <span className="text-[10px] font-black text-[#00FFFF] tracking-widest uppercase font-[var(--font-body)]">VIEW DETAILS</span>
                                  <svg className="w-4 h-4 text-[#00FFFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                </div>
                              </div>

                              {/* Decoration */}
                              <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                              <div className="absolute -inset-[100%] bg-gradient-to-r from-transparent via-white/5 to-transparent -rotate-45 group-hover:animate-shine pointer-events-none" />
                            </motion.article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-6 sm:p-12 rounded-[24px] sm:rounded-[40px] bg-white/[0.02] border-4 border-dashed border-white/10 text-center transition-all hover:bg-white/[0.04] hover:border-white/20">
                        <p className="text-[10px] sm:text-[13px] font-black text-zinc-500 tracking-[0.25em] uppercase">
                          Problem Statement Status
                        </p>
                        <p className="mt-3 text-sm sm:text-base font-semibold text-zinc-300 leading-relaxed">
                          {problemSelectionHint}
                        </p>
                        {problemStatus === "SCHEDULED" ? (
                          <p className="mt-3 text-xs sm:text-sm font-mono text-cyan-300">
                            Scheduled Release: {releaseAtLabel}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </DashboardCard>
              </motion.div>

              {/* Latest Updates */}
              <motion.div variants={itemVariants}>
                <div className="flex flex-col gap-4 mb-6 ml-4">
                  <h2 className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-4">
                    Latest <span className="text-[#8D36D5]">Updates</span>
                    <div className="h-[2px] w-32 bg-gradient-to-r from-[#8D36D5] to-transparent opacity-50" />
                  </h2>
                </div>
                <DashboardCard>
                  <div className="space-y-3 sm:space-y-5 max-h-[480px] sm:max-h-[600px] overflow-y-auto pr-2 sm:pr-6 custom-scrollbar pt-2 sm:pt-4">
                    {(dashboard.updates || []).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full opacity-20 py-20 sm:py-32 gap-5">
                        <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full border-4 border-dashed border-zinc-500 animate-spin" />
                        <p className="text-[12px] sm:text-[14px] font-bold tracking-[0.5em] sm:tracking-[0.8em] uppercase text-zinc-500">AWAITING BROADCAST</p>
                      </div>
                    ) : (
                      (dashboard.updates || []).map((update, idx) => (
                        <div key={idx} className="flex gap-3 sm:gap-6 items-start group/log px-3 py-4 sm:px-4 sm:py-5 rounded-xl sm:rounded-2xl hover:bg-white/[0.06] transition-all border border-transparent hover:border-[#8D36D5]/20">
                          <span className="text-sm sm:text-base font-black text-[#8D36D5] font-mono bg-[#8D36D5]/10 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl border border-[#8D36D5]/20 flex-shrink-0 mt-0.5 min-w-[32px] sm:min-w-[40px] text-center">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <p className="text-sm sm:text-base font-semibold text-zinc-100 leading-relaxed group-hover/log:text-white transition-colors">
                            {update.replace('>> ', '')}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </DashboardCard>
              </motion.div>
            </div>
          </div>
        )}
      </motion.main>

      <AnimatePresence>
        {selectionDialogProblem ? (
          <motion.div
            className="fixed inset-0 z-[130] bg-black/95 backdrop-blur-xl px-4 py-8 flex items-center justify-center overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSelectionDialog}
          >
            <motion.section
              className="w-full max-w-2xl rounded-[40px] border border-white/10 bg-[#0F061C]/90 p-8 sm:p-12 shadow-[0_40px_120px_rgba(0,0,0,0.9)] relative overflow-hidden"
              initial={{ y: 50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.95 }}
              onClick={(event) => event.stopPropagation()}
            >
              {/* Animated Background Decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#8D36D5]/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#00FFFF]/10 rounded-full blur-3xl pointer-events-none" />

              {!showConfirmation ? (
                /* STEP 1: Detailed View */
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-black tracking-[0.4em] uppercase text-[#00FFFF] font-[var(--font-body)]">
                        PROBLEM_DETAIL_VIEW
                      </p>
                      <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight uppercase">
                        {selectionDialogProblem.title}
                      </h3>
                    </div>
                    <button
                      onClick={closeSelectionDialog}
                      className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center gap-6 mb-8 p-6 bg-white/5 rounded-3xl border border-white/5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-zinc-500 tracking-widest uppercase font-[var(--font-body)]">IDENTIFIER</span>
                      <span className="text-xl font-black text-white font-mono">#{selectionDialogProblem.problem_id}</span>
                    </div>
                    <div className="h-10 w-px bg-white/10" />
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-zinc-500 tracking-widest uppercase font-[var(--font-body)]">CAPACITY</span>
                      <span className="text-xl font-black text-[#00FFFF] font-[var(--font-body)]">
                        {selectionDialogProblem.selected_teams_count || 0} / {selectionDialogProblem.max_teams_allowed || 8}
                      </span>
                    </div>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto pr-4 custom-scrollbar mb-10">
                    <p className="text-base sm:text-lg leading-relaxed text-zinc-300 font-[var(--font-body)] tracking-wide">
                      {selectionDialogProblem.description || "Problem statement details are unavailable."}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      type="button"
                      onClick={closeSelectionDialog}
                      className="flex-1 px-8 py-5 rounded-2xl border border-white/10 bg-white/5 text-[11px] font-black tracking-[0.2em] uppercase text-zinc-400 transition-all hover:bg-white/10 hover:text-white"
                    >
                      Go Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmation(true)}
                      className="flex-[2] px-8 py-5 rounded-2xl bg-[#00FFFF] text-[#0F061C] text-[11px] font-black tracking-[0.2em] uppercase transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_10px_30px_rgba(0,255,255,0.3)]"
                    >
                      Proceed to Select
                    </button>
                  </div>
                </div>
              ) : (
                /* STEP 2: Confirmation View */
                <div className="relative z-10">
                  <div className="text-center mb-8">
                    <div className="h-20 w-20 rounded-full bg-rose-500/10 border-2 border-rose-500/20 flex items-center justify-center mx-auto mb-6 text-rose-500">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-3">Permanent Lock-In</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed font-[var(--font-body)]">
                      Are you sure? You <span className="text-rose-400 font-bold uppercase underline">cannot revert</span> this decision once frozen.
                      Our systems will record your selection immediately.
                    </p>
                  </div>
                  {selectionError && (
                     <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold text-center uppercase tracking-widest animate-shake">
                       {selectionError}
                     </div>
                   )}

                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      type="button"
                      onClick={() => setShowConfirmation(false)}
                      disabled={selectionSubmitting}
                      className="flex-1 px-8 py-5 rounded-2xl border border-white/10 bg-white/5 text-[11px] font-black tracking-[0.2em] uppercase text-zinc-400 transition-all hover:bg-white/10"
                    >
                      Go Back
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmProblemSelection}
                      disabled={selectionSubmitting}
                      className="flex-[2] px-8 py-5 rounded-2xl bg-rose-500 text-white text-[11px] font-black tracking-[0.2em] uppercase transition-all hover:bg-rose-600 disabled:opacity-20 disabled:grayscale shadow-[0_10px_30px_rgba(244,63,94,0.3)]"
                    >
                      {selectionSubmitting ? "FREEZING..." : "FREEZE SELECTION"}
                    </button>
                  </div>
                </div>
              )}
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

