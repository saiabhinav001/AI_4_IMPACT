"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  getUserRole,
  loginWithRole,
  logoutAdmin,
  onUserAuthChange,
} from "../../../lib/auth";
import { toRuntimeApiUrl } from "../../../lib/api-base";
import { buildRuntimeIdTokenHeaders } from "../../../lib/runtime-auth";
import { ROLES } from "../../../lib/constants/roles";

function AuthPageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <p className="text-sm font-bold tracking-[0.4em] text-[#00FFFF] uppercase animate-pulse">
        &gt;&gt; AUTH_SYSTEM_BOOTSTRAP...
      </p>
    </div>
  );
}

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [role, setRole] = useState(null);

  // Motion hooks for 3D tilt
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  // Elite: Parallax Sheen (moves opposite to tilt)
  const sheenX = useTransform(mouseXSpring, [-0.5, 0.5], ["15%", "-15%"]);
  const sheenY = useTransform(mouseYSpring, [-0.5, 0.5], ["15%", "-15%"]);

  const adminOnlyMessage = useMemo(() => {
    return searchParams?.get("reason") === "admin-only"
      ? ">>> ADMIN DASHBOARD ACCESS IS RESTRICTED TO ADMIN ROLE."
      : "";
  }, [searchParams]);

  const isTeamLoginIntent = useMemo(() => {
    return searchParams?.get("intent") === "team-login";
  }, [searchParams]);

  const isTeamPasswordResetFlow = useMemo(() => {
    const fromQuery = searchParams?.get("flow") === "team-password-reset";
    if (fromQuery) {
      return true;
    }

    if (typeof document === "undefined") {
      return false;
    }

    const referrer = String(document.referrer || "");
    return /\/__\/auth\/action/i.test(referrer) && /[?&]mode=resetPassword/i.test(referrer);
  }, [searchParams]);

  const shouldForceTeamLoginPrompt = isTeamPasswordResetFlow || isTeamLoginIntent;

  const passwordResetMessage = useMemo(() => {
    return isTeamPasswordResetFlow
      ? ">>> PASSWORD UPDATED. LOGIN WITH TEAM ID AND YOUR NEW PASSWORD."
      : "";
  }, [isTeamPasswordResetFlow]);

  const teamLoginModeMessage = useMemo(() => {
    if (isTeamPasswordResetFlow || !isTeamLoginIntent) {
      return "";
    }

    return ">>> TEAM LOGIN MODE ENABLED. USE TEAM ID (OR LEADER EMAIL) + PASSWORD.";
  }, [isTeamLoginIntent, isTeamPasswordResetFlow]);

  const hasTeamDashboardAccess = useCallback(async (user) => {
    if (!user) return false;
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(toRuntimeApiUrl("/api/team/dashboard"), {
        headers: buildRuntimeIdTokenHeaders(idToken),
        cache: "no-store",
      });
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  const resolveLoginEmail = useCallback(async (rawIdentifier) => {
    const normalized = String(rawIdentifier || "").trim().toLowerCase();
    if (!normalized) {
      const error = new Error("Login identifier is required.");
      error.code = "IDENTIFIER_REQUIRED";
      throw error;
    }
    if (normalized.includes("@")) return normalized;
    const response = await fetch(toRuntimeApiUrl("/api/team/access/resolve"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: normalized }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.leader_email) {
      const error = new Error(data?.error || "Invalid team ID or team access is not ready.");
      error.code = "TEAM_ID_NOT_FOUND";
      throw error;
    }
    return String(data.leader_email).trim().toLowerCase();
  }, []);

  useEffect(() => {
    let isActive = true;
    let resetFlowHandled = false;

    const unsub = onUserAuthChange(
      (user) => {
        const resolveRole = async () => {
          if (!isActive) return;

          if (shouldForceTeamLoginPrompt && !resetFlowHandled) {
            resetFlowHandled = true;

            if (user) {
              try {
                await logoutAdmin();
              } catch {
                // Keep user on auth screen even if sign-out cleanup fails.
              }

              if (!isActive) return;
            }

            setAuthUser(null);
            setRole(null);
            setCheckingAuth(false);
            return;
          }

          if (!user) {
            setAuthUser(null);
            setRole(null);
            setCheckingAuth(false);
            return;
          }
          const nextRole = await getUserRole(user);
          if (!isActive) return;
          if (nextRole === ROLES.ADMIN) {
            router.replace("/admin");
            return;
          }
          if (nextRole === ROLES.TEAM_LEAD) {
            router.replace("/team");
            return;
          }
          const canOpenTeamDashboard = await hasTeamDashboardAccess(user);
          if (!isActive) return;
          if (canOpenTeamDashboard) {
            router.replace("/team");
            return;
          }
          setAuthUser(user);
          setRole(nextRole || ROLES.PARTICIPANT);
          setCheckingAuth(false);
        };
        void resolveRole();
      },
      () => {
        if (!isActive) return;
        setCheckingAuth(false);
      }
    );
    return () => {
      isActive = false;
      unsub();
    };
  }, [hasTeamDashboardAccess, router, shouldForceTeamLoginPrompt]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const normalizedIdentifier = String(identifier || "").trim();
      const isTeamIdLoginAttempt =
        Boolean(normalizedIdentifier) && !normalizedIdentifier.includes("@");

      const loginEmail = await resolveLoginEmail(normalizedIdentifier);
      const { user, role: userRole } = await loginWithRole(loginEmail, password);

      if (isTeamIdLoginAttempt && (await hasTeamDashboardAccess(user))) {
        router.replace("/team");
        return;
      }

      if (userRole === ROLES.ADMIN) {
        router.replace("/admin");
        return;
      }
      if (userRole === ROLES.TEAM_LEAD) {
        router.replace("/team");
        return;
      }
      if (await hasTeamDashboardAccess(user)) {
        router.replace("/team");
        return;
      }
      setAuthUser(user);
      setRole(userRole || ROLES.PARTICIPANT);
    } catch (err) {
      const errorCode = String(err?.code || "").trim();
      const errorMessage = String(err?.message || "").toUpperCase();

      if (errorCode === "TEAM_ID_NOT_FOUND") {
        setError(">>> TEAM ID INVALID OR TEAM ACCESS IS NOT ENABLED YET.");
      } else if (errorCode === "IDENTIFIER_REQUIRED") {
        setError(">>> ENTER EMAIL OR TEAM ID.");
      } else if (
        errorCode === "auth/invalid-credential" ||
        errorCode === "auth/invalid-login-credentials" ||
        errorCode === "auth/wrong-password" ||
        errorCode === "auth/invalid-email" ||
        errorMessage.includes("INVALID_LOGIN_CREDENTIALS")
      ) {
        setError(">>> INVALID EMAIL OR PASSWORD.");
      } else if (errorCode === "auth/user-not-found") {
        setError(">>> ACCOUNT NOT FOUND.");
      } else if (errorCode === "auth/too-many-requests") {
        setError(">>> TOO MANY LOGIN ATTEMPTS. PLEASE TRY AGAIN IN A FEW MINUTES.");
      } else if (
        errorCode === "auth/unauthorized-domain" ||
        errorMessage.includes("UNAUTHORIZED_DOMAIN")
      ) {
        setError(">>> LOGIN DOMAIN IS NOT AUTHORIZED. CONTACT ADMIN.");
      } else if (
        errorCode === "FIREBASE_CLIENT_CONFIG_MISSING" ||
        errorMessage.includes("FIREBASE_CLIENT_CONFIG_MISSING")
      ) {
        setError(">>> AUTH CONFIG IS MISSING. CONTACT ADMIN.");
      } else if (errorCode.startsWith("auth/")) {
        setError(">>> AUTHENTICATION FAILED. VERIFY CREDENTIALS AND TRY AGAIN.");
      } else {
        setError(">>> AUTHENTICATION FAILED.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutAdmin();
    setAuthUser(null);
    setRole(null);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      x.set(clientX / innerWidth - 0.5);
      y.set(clientY / innerHeight - 0.5);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [x, y]);

  // Elite: Staggered variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
  };

  if (checkingAuth) {
    return <AuthPageFallback />;
  }

  return (
    <div className="min-h-screen bg-[#07020E] text-[#EDE8F5] selection:bg-[#8D36D5]/30 relative overflow-hidden flex flex-col font-[var(--font-body)]">
      {/* Elite Background Particle Field */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              bottom: "-10%",
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              background: i % 2 === 0 ? "#8D36D5" : "#00FFFF",
              animationDuration: `${Math.random() * 15 + 10}s`,
              animationDelay: `${Math.random() * 10}s`,
              boxShadow: i % 2 === 0 ? "0 0 10px #8D36D5" : "0 0 10px #00FFFF"
            }}
          />
        ))}
      </div>

      {/* Immersive Background Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute inset-0 animate-breathing"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, rgba(141,54,213,0.06) 0px, transparent 1px, transparent 60px, rgba(141,54,213,0.06) 60px), repeating-linear-gradient(90deg, rgba(141,54,213,0.06) 0px, transparent 1px, transparent 60px, rgba(141,54,213,0.06) 60px)`,
            maskImage: "radial-gradient(ellipse at 50% 50%, black 0%, transparent 80%)"
          }}
        />

        <motion.div
          className="absolute -left-24 -top-28 w-[500px] h-[500px] rounded-full blur-[90px] opacity-[0.15] bg-[#46067A]"
          animate={{ x: [0, 30], y: [0, 50], scale: [1, 1.1, 1] }}
          transition={{ duration: 20, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-20 top-[40%] w-[400px] h-[400px] rounded-full blur-[100px] opacity-[0.12] bg-[#8D36D5]"
          animate={{ x: [0, -40], y: [0, 60], scale: [1, 1.2, 1] }}
          transition={{ duration: 25, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        />

        <div className="noise-overlay opacity-[0.04]" />
      </div>

      <div className="flex-1 flex items-center justify-center p-6 relative z-10 pt-[110px] sm:pt-[100px]">
        <motion.div
          style={{ rotateX, rotateY }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-[420px] perspective-1000 preserve-3d"
        >
          {/* Main Glass Card Shell */}
          <motion.div
            className="relative backdrop-blur-[32px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0F061C]/50 shadow-[0_32px_80px_rgba(0,0,0,0.6),0_0_32px_rgba(141,54,213,0.15)] p-0.5 glass-sheen group"
            style={{
              "--sheen-x": sheenX,
              "--sheen-y": sheenY
            }}
          >
            <div className="scanning-ray opacity-20" />

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="px-8 py-10 sm:px-10"
            >
              <motion.header variants={itemVariants} className="text-center mb-8">
                <div className="flex justify-center mb-6">
                  <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 shadow-inner relative group/icon">
                    <div className="absolute inset-0 rounded-2xl bg-[#8D36D5]/20 blur-xl opacity-0 group-hover/icon:opacity-100 transition-opacity" />
                    <Image src="/site-icon.svg" alt="Portal" width={40} height={40} className="w-10 h-10 relative z-10 transition-transform group-hover/icon:scale-110" />
                  </div>
                </div>
                <h1 className="text-3xl font-black uppercase tracking-tighter mb-2 text-white bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/40 group-hover:via-[#8D36D5] transition-all duration-700"
                  style={{ textShadow: '0 0 20px rgba(141, 54, 213, 0.4)' }}>
                  LOG<span className="text-[#8D36D5]">_</span>IN
                </h1>
                <p className="text-[10px] font-bold text-zinc-500 tracking-[0.3em] uppercase opacity-90">
                  SECURE ACCESS GATEWAY
                </p>
              </motion.header>

              {adminOnlyMessage ? (
                <motion.p
                  variants={itemVariants}
                  className="mb-5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300"
                >
                  {adminOnlyMessage}
                </motion.p>
              ) : null}

              {passwordResetMessage ? (
                <motion.p
                  variants={itemVariants}
                  className="mb-5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200"
                >
                  {passwordResetMessage}
                </motion.p>
              ) : null}

              {teamLoginModeMessage ? (
                <motion.p
                  variants={itemVariants}
                  className="mb-5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200"
                >
                  {teamLoginModeMessage}
                </motion.p>
              ) : null}

              {!authUser && (
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-4">
                    <motion.div variants={itemVariants} className="space-y-2 group">
                      <label className="block text-[10px] font-bold text-zinc-400 tracking-[0.2em] uppercase ml-1 opacity-70 group-focus-within:opacity-100 group-focus-within:text-[#8D36D5] transition-all">
                        ACCOUNT EMAIL / ID
                      </label>
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                        placeholder="identity@uplink"
                        className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-5 py-3.5 text-sm text-white outline-none focus:border-[#8D36D5]/50 focus:bg-[#8D36D5]/5 focus:shadow-[0_0_30px_rgba(141,54,213,0.15)] transition-all font-medium placeholder:text-zinc-800"
                      />
                    </motion.div>

                    <motion.div variants={itemVariants} className="space-y-2 group">
                      <label className="block text-[10px] font-bold text-zinc-400 tracking-[0.2em] uppercase ml-1 opacity-70 group-focus-within:opacity-100 group-focus-within:text-[#00FFFF] transition-all">
                        SECURE PASSWORD
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••••••"
                        className="w-full bg-white/[0.02] border border-white/10 rounded-xl px-5 py-3.5 text-sm text-white outline-none focus:border-[#00FFFF]/50 focus:bg-[#00FFFF]/5 focus:shadow-[0_0_30px_rgba(0,255,255,0.1)] transition-all font-medium placeholder:text-zinc-800 tracking-[0.3em]"
                      />
                    </motion.div>
                  </div>

                  {error && (
                    <motion.div
                      variants={itemVariants}
                      className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-[10px] tracking-widest text-center uppercase"
                    >
                      ⚠ {error}
                    </motion.div>
                  )}

                  <motion.div variants={itemVariants}>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full group relative overflow-hidden rounded-xl p-[1px] transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-[#8D36D5] via-[#00FFFF] to-[#46067A] bg-[length:200%_100%] animate-gradient opacity-90 group-hover:opacity-100 transition-opacity" />
                      <div className="relative flex h-14 items-center justify-center rounded-[11px] bg-[#0F061C]/90 transition-all group-hover:bg-transparent">
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white group-hover:text-black transition-colors">
                          {loading ? "AUTHENTICATING..." : "LOGIN"}
                        </span>
                      </div>
                    </button>
                  </motion.div>
                </form>
              )}

              {authUser && role !== ROLES.ADMIN && (
                <div className="space-y-6 pt-2">
                  <motion.div variants={itemVariants} className="border border-[#8D36D5]/20 bg-[#8D36D5]/5 p-6 relative overflow-hidden rounded-2xl">
                    <div className="space-y-4 relative z-10 text-center">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00FFFF]/10 border border-[#00FFFF]/20 text-[#00FFFF] text-[9px] font-bold tracking-widest uppercase mb-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#00FFFF] animate-pulse" />
                        Connection Active
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-zinc-500 block mb-1 tracking-[0.25em] uppercase">LINKED IDENTITY</span>
                        <p className="font-bold text-white truncate text-lg">{authUser.email}</p>
                      </div>
                      <div className="pt-4 flex items-center justify-center gap-10 border-t border-white/5">
                        <div>
                          <span className="text-[8px] font-bold text-zinc-500 block mb-1 tracking-[0.25em] uppercase">SYSTEM RANK</span>
                          <p className="font-black text-[#8D36D5] uppercase tracking-widest text-xs">{role || "PARTICIPANT"}</p>
                        </div>
                        <div className="h-8 w-[1px] bg-white/10" />
                        <div>
                          <span className="text-[8px] font-bold text-zinc-500 block mb-1 tracking-[0.25em] uppercase">DATA STATUS</span>
                          <p className="font-black text-emerald-400 uppercase tracking-widest text-xs animate-pulse">VERIFIED</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <div className="flex flex-col gap-3">
                    <motion.div variants={itemVariants}>
                      <button
                        onClick={() => router.push("/team")}
                        className="w-full bg-[#EDE8F5] text-black font-black uppercase text-[11px] tracking-[0.4em] py-4 rounded-xl hover:bg-[#00FFFF] transition-all duration-500 shadow-[0_20px_40px_rgba(0,0,0,0.4)] group"
                      >
                        ENTER COMMAND CENTER
                      </button>
                    </motion.div>
                    <motion.div variants={itemVariants}>
                      <button
                        onClick={handleLogout}
                        className="w-full bg-white/[0.03] border border-white/10 text-zinc-500 font-bold uppercase text-[9px] tracking-[0.4em] py-3.5 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 transition-all"
                      >
                        LOGOUT SESSION
                      </button>
                    </motion.div>
                  </div>
                </div>
              )}
            </motion.div>

            <motion.div variants={itemVariants} className="mt-8 mb-4 text-center">
              <p className="text-[8px] font-bold text-zinc-800 tracking-[0.6em] uppercase">
                &copy; 2026 AI4IMPACT SYSTEM CLOUD
              </p>
            </motion.div>
          </motion.div>

          {/* Elite Decorative Frames */}
          <div className="absolute -top-3 -left-3 w-12 h-12 border-t-2 border-l-2 border-[#8D36D5]/60 rounded-tl-2xl pointer-events-none transition-all group-hover:scale-110 group-hover:border-[#8D36D5]" />
          <div className="absolute -bottom-3 -right-3 w-12 h-12 border-b-2 border-r-2 border-[#00FFFF]/50 rounded-br-2xl pointer-events-none transition-all group-hover:scale-110 group-hover:border-[#00FFFF]" />
        </motion.div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <AuthPageContent />
    </Suspense>
  );
}
