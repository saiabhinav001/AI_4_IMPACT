"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { getUserRole, logoutAdmin, onUserAuthChange } from "../../../lib/auth";
import { toRuntimeApiUrl } from "../../../lib/api-base";
import { buildRuntimeIdTokenHeaders } from "../../../lib/runtime-auth";
import { ROLES } from "../../../lib/constants/roles";

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
        className="relative backdrop-blur-[40px] overflow-hidden rounded-[40px] border border-white/10 bg-[#0F061C]/40 shadow-[0_40px_100px_rgba(0,0,0,0.6)] p-0.5 glass-sheen"
        style={{ "--sheen-x": sheenX, "--sheen-y": sheenY }}
      >
        {/* Hardware Corner Notches */}
        <div className="absolute top-0 left-0 h-10 w-10 border-t-2 border-l-2 border-white/10 rounded-tl-[40px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 h-10 w-10 border-b-2 border-r-2 border-white/10 rounded-br-[40px] pointer-events-none" />

        <div className="scanning-ray opacity-10 group-hover:opacity-30 transition-opacity" />
        <div className="relative z-10 p-5 sm:p-8 lg:p-10">
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

  const [authChecking, setAuthChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(async (currentUser, isRefresh = false) => {
    if (!currentUser) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

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
    } catch (err) {
      setDashboard(null);
      setError(err?.message || "Failed to load team dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    let isActive = true;

    // PRODUCTION_MODE: Restoring security and live data fetching
    const DEMO_MODE = false;

    if (DEMO_MODE) {
      // (Demo logic bypassed)
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
          await fetchDashboard(nextUser, false);
        };

        void resolve();
      },
      () => {
        if (!isActive) return;
        setAuthChecking(false);
        router.replace("/auth");
      }
    );

    return () => {
      isActive = false;
      unsub();
    };
  }, [fetchDashboard, router]);

  const handleRefresh = async () => {
    if (!user || refreshing) return;
    await fetchDashboard(user, true);
  };

  const handleLogout = async () => {
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

  if (authChecking || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-sm font-bold tracking-[0.4em] text-[#00FFFF] uppercase animate-pulse">
          &gt;&gt; BOOTING_TEAM_CLIENT...
        </p>
      </div>
    );
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
            className="flex flex-col gap-2"
          >
            <h1 className="type-h3 font-black uppercase tracking-tight flex items-center gap-4 text-white"
              style={{ textShadow: '0 0 40px rgba(141, 54, 213, 0.4)' }}>
              TEAM <span className="bg-gradient-to-r from-[#8D36D5] to-[#46067A] bg-clip-text text-transparent italic">DASHBOARD</span>
              <span className="hidden sm:inline-block h-2.5 w-2.5 rounded-full bg-[#00FFFF] animate-pulse ml-1 shadow-[0_0_15px_#00FFFF]" />
            </h1>
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00FFFF] shadow-[0_0_8px_#00FFFF]" />
                <span className="text-[10px] font-bold text-[#00FFFF] tracking-[0.2em] uppercase opacity-80">
                  ID: {user?.email?.split('@')[0] || "LOGGED_IN"}
                </span>
              </div>
              <div className="h-3 w-px bg-white/10 hidden sm:block" />
              <div className="flex items-center gap-3">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
              </div>
            </div>
          </motion.div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.08)" }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 md:flex-none relative px-8 py-3.5 rounded-2xl border border-white/10 bg-white/5 transition-all disabled:opacity-50"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <span className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2.5 text-white">
                <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {refreshing ? "SYNCING..." : "RE-SYNC"}
              </span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: "rgba(244,63,94,0.15)" }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 md:flex-none relative px-8 py-3.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 transition-all font-heading"
              onClick={handleLogout}
            >
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-400 text-center block">
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
        className="max-w-7xl mx-auto pt-20 pb-40 px-6 sm:px-12 relative z-10 lg:pt-24"
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
                    <div key={item.label} className="flex flex-col gap-4 group/item px-4">
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

                  {/* View Receipt */}
                  <div className="flex flex-col gap-3 min-w-[160px]">
                    <span className="text-[12px] font-black text-zinc-500 tracking-[0.3em] uppercase opacity-0 select-none">_</span>
                    {dashboard.payment?.screenshot_url ? (
                      <a
                        href={dashboard.payment.screenshot_url}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative flex w-full items-center justify-center overflow-hidden rounded-2xl py-4 transition-all hover:scale-[1.03] active:scale-[0.98] shadow-2xl"
                      >
                        <div className="absolute inset-0 bg-white transition-all duration-300 group-hover:bg-[#00FFFF]" />
                        <span className="relative text-base font-black uppercase tracking-[0.15em] text-black whitespace-nowrap">
                          VIEW RECEIPT
                        </span>
                      </a>
                    ) : (
                      <div className="w-full py-4 rounded-2xl border-2 border-dashed border-white/10 text-center">
                        <span className="text-sm font-bold tracking-[0.2em] uppercase text-zinc-600">NO RECEIPT</span>
                      </div>
                    )}
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
                  {dashboard.selected_problem ? (
                    <div className="p-6 sm:p-10 lg:p-14 rounded-[32px] sm:rounded-[48px] bg-gradient-to-br from-[#8D36D5]/30 to-[#46067A]/15 border-2 border-[#8D36D5]/50 shadow-[0_40px_120px_rgba(0,0,0,0.8)] relative group/card transition-all overflow-hidden hover:border-[#8D36D5]">
                      {/* Decorative icon — capped so it never overflows */}
                      <div className="absolute top-0 right-0 p-6 sm:p-10 opacity-[0.05] group-hover/card:opacity-[0.12] transition-opacity pointer-events-none">
                        <svg className="w-24 h-24 sm:w-40 sm:h-40 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                        </svg>
                      </div>
                      <h3 className="text-[clamp(1.2rem,4vw,2.8rem)] font-black text-white uppercase mb-6 sm:mb-10 leading-tight tracking-tighter drop-shadow-2xl pr-20 sm:pr-28">
                        {dashboard.selected_problem.problem_title}
                      </h3>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-5 sm:gap-10 pt-6 sm:pt-10 border-t border-white/20">
                        <div className="flex flex-col gap-2">
                          <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">CHALLENGE ID</span>
                          <span className="text-base sm:text-lg font-black text-[#8D36D5] font-mono bg-[#8D36D5]/20 px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl border border-[#8D36D5]/40 shadow-xl inline-block">
                            #{dashboard.selected_problem.problem_id}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2">
                          <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">LOCK DATE</span>
                          <span className="text-base font-bold text-zinc-100 font-mono italic">{dashboard.selected_problem.selected_at}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 sm:p-20 rounded-[32px] sm:rounded-[48px] bg-white/[0.02] border-4 border-dashed border-white/10 text-center transition-all hover:bg-white/[0.04] hover:border-white/20">
                      <p className="text-sm sm:text-[18px] font-black text-zinc-600 tracking-[0.3em] sm:tracking-[0.6em] uppercase">Problem Statements will be Released Soon</p>
                    </div>
                  )}
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
    </div>
  );
}

