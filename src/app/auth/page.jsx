"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

    if (normalized.includes("@")) {
      return normalized;
    }

    const response = await fetch(toRuntimeApiUrl("/api/team/access/resolve"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

  if (checkingAuth) {
    return <AuthPageFallback />;
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Grids */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#8D36D5] to-transparent opacity-30" />
      
      <div className="cyber-card w-full max-w-lg p-12 bg-white/[0.02] backdrop-blur-3xl border border-white/5 rounded-[3rem] relative group">
        <div className="scanning-ray opacity-10" />
        
        <header className="text-center mb-12">
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-2 sm:text-6xl">
            AUTH<span className="text-[#8D36D5]">_</span>PORTAL
          </h1>
          <p className="text-[10px] font-black tracking-[0.5em] text-[#00FFFF] uppercase">
            &gt;&gt; SECURE_GATEWAY_NODE_v1.0
          </p>
        </header>

        {adminOnlyMessage && (
          <div className="mb-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-[10px] tracking-widest uppercase">
            {adminOnlyMessage}
          </div>
        )}

        {passwordResetMessage && (
          <p style={{
            color: "var(--neon-cyan)",
            border: "1px solid var(--neon-cyan)",
            background: "rgba(0,255,255,0.08)",
            padding: "0.6rem",
            fontFamily: "monospace",
            fontSize: "0.8rem",
            marginBottom: "1rem",
          }}>
            {passwordResetMessage}
          </p>
        )}

        {teamLoginModeMessage && (
          <p style={{
            color: "var(--neon-cyan)",
            border: "1px solid var(--neon-cyan)",
            background: "rgba(0,255,255,0.08)",
            padding: "0.6rem",
            fontFamily: "monospace",
            fontSize: "0.8rem",
            marginBottom: "1rem",
          }}>
            {teamLoginModeMessage}
          </p>
        )}

        {!authUser && (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-zinc-500 tracking-[0.3em] uppercase ml-2">
                [ IDENTIFIER_CHAIN ]
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                placeholder="EMAIL_OR_TEAM_ID"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white outline-none focus:border-[#8D36D5] transition-all font-bold placeholder:text-zinc-700"
              />
              <p className="text-[9px] font-bold text-zinc-600 tracking-wider ml-2">
                * TEAM_LEAD EMAIL OR TEAM_ID (e.g. ai4i001)
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-zinc-500 tracking-[0.3em] uppercase ml-2">
                [ PASS_KEY ]
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white outline-none focus:border-[#8D36D5] transition-all font-bold placeholder:text-zinc-700"
              />
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 text-rose-400 font-bold text-[10px] tracking-widest">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-black uppercase text-xs tracking-[0.4em] py-6 rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-2xl disabled:opacity-50"
            >
              {loading ? "AUTHENTICATING..." : "INIT_HANDSHAKE()"}
            </button>
          </form>
        )}

        {authUser && role !== ROLES.ADMIN && (
          <div className="space-y-6">
            <div className="p-8 rounded-2xl bg-cyan-400/5 border border-cyan-400/10 space-y-4">
              <div>
                <span className="text-[9px] font-black text-zinc-600 block mb-1">NODE_IDENTITY</span>
                <p className="font-bold text-white truncate uppercase">{authUser.email}</p>
              </div>
              <div>
                <span className="text-[9px] font-black text-zinc-600 block mb-1">ACCESS_LEVEL</span>
                <p className="font-bold text-[#00FFFF] uppercase tracking-widest">{role || ROLES.PARTICIPANT}</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={() => router.push("/team")}
                className="w-full bg-white text-black font-black uppercase text-xs tracking-widest py-5 rounded-2xl hover:scale-[1.02] transition-all"
              >
                OPEN_SECURE_DASHBOARD()
              </button>
              <button 
                onClick={handleLogout} 
                className="w-full bg-white/5 border border-white/10 text-white font-black uppercase text-xs tracking-widest py-5 rounded-2xl hover:bg-white/10 transition-all"
              >
                TERMINATE_SESSION()
              </button>
            </div>
          </div>
        )}
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
