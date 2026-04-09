"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getUserRole,
  loginWithRole,
  logoutAdmin,
  onUserAuthChange,
} from "../../../lib/auth";
import { ROLES } from "../../../lib/constants/roles";

function AuthPageFallback() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-dark)",
    }}>
      <p style={{ color: "var(--neon-cyan)", fontFamily: "monospace", fontSize: "1.1rem" }}>
        &gt;&gt;&gt; AUTH SYSTEM BOOTSTRAP...
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

  const hasTeamDashboardAccess = useCallback(async (user) => {
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/team/dashboard", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
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

    const response = await fetch("/api/team/access/resolve", {
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

    const unsub = onUserAuthChange(
      (user) => {
        const resolveRole = async () => {
          if (!isActive) return;

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
  }, [hasTeamDashboardAccess, router]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const loginEmail = await resolveLoginEmail(identifier);
      const { user, role: userRole } = await loginWithRole(loginEmail, password);

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
      if (err?.code === "TEAM_ID_NOT_FOUND") {
        setError(">>> TEAM ID INVALID OR TEAM ACCESS IS NOT ENABLED YET.");
      } else if (err?.code === "IDENTIFIER_REQUIRED") {
        setError(">>> ENTER EMAIL OR TEAM ID.");
      } else
      if (err?.code === "auth/invalid-credential") {
        setError(">>> INVALID EMAIL OR PASSWORD.");
      } else if (err?.code === "auth/user-not-found") {
        setError(">>> ACCOUNT NOT FOUND.");
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
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-dark)",
      backgroundImage: `
        linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
      `,
      backgroundSize: "40px 40px",
      padding: "1rem",
    }}>
      <div className="cyber-card" style={{ width: "100%", maxWidth: "460px", padding: "2.5rem" }}>
        <h1 style={{
          fontFamily: "var(--font-heading)",
          fontSize: "2.2rem",
          textShadow: "3px 3px 0 var(--neon-pink)",
          marginBottom: "0.6rem",
          textAlign: "center",
        }}>
          AUTH<span style={{ color: "var(--neon-pink)" }}>_</span>PORTAL
        </h1>
        <p style={{ color: "var(--neon-cyan)", fontFamily: "monospace", fontSize: "0.82rem", textAlign: "center", marginBottom: "1.6rem" }}>
          &gt;&gt;&gt; PUBLIC AUTHENTICATION GATEWAY
        </p>

        {adminOnlyMessage && (
          <p style={{
            color: "var(--danger-red)",
            border: "1px solid var(--danger-red)",
            background: "rgba(255,42,42,0.1)",
            padding: "0.6rem",
            fontFamily: "monospace",
            fontSize: "0.8rem",
            marginBottom: "1rem",
          }}>
            {adminOnlyMessage}
          </p>
        )}

        {!authUser && (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.45rem", color: "var(--text-main)", fontWeight: "bold" }}>
                [ EMAIL OR TEAM ID ]
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: "var(--bg-dark)",
                  border: "2px solid var(--border-color)",
                  color: "var(--neon-cyan)",
                  fontFamily: "monospace",
                }}
              />
              <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", marginTop: "0.35rem" }}>
                Use admin email for admin login, or team ID (example: ai4i001) for team dashboard login.
              </p>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.45rem", color: "var(--text-main)", fontWeight: "bold" }}>
                [ PASSWORD ]
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: "var(--bg-dark)",
                  border: "2px solid var(--border-color)",
                  color: "var(--neon-cyan)",
                  fontFamily: "monospace",
                }}
              />
            </div>

            {error && (
              <p style={{
                color: "var(--danger-red)",
                border: "1px solid var(--danger-red)",
                background: "rgba(255,42,42,0.1)",
                padding: "0.6rem",
                fontFamily: "monospace",
                fontSize: "0.8rem",
                marginBottom: "1rem",
              }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn"
              disabled={loading}
              style={{ width: "100%", opacity: loading ? 0.65 : 1, cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "AUTHENTICATING..." : "LOGIN()"}
            </button>
          </form>
        )}

        {authUser && role !== ROLES.ADMIN && (
          <div style={{
            border: "1px solid var(--neon-cyan)",
            background: "rgba(0,255,255,0.06)",
            padding: "0.9rem",
            fontFamily: "monospace",
            color: "var(--text-main)",
          }}>
            <p style={{ marginBottom: "0.45rem" }}>
              AUTHENTICATED USER: {authUser.email}
            </p>
            <p style={{ marginBottom: "0.45rem" }}>
              ROLE: {role || ROLES.PARTICIPANT}
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "0.8rem" }}>
              Admin dashboard is visible only for role ADMIN.
            </p>
            <button
              onClick={() => router.push("/team")}
              className="btn"
              style={{ width: "100%", marginBottom: "0.6rem" }}
            >
              OPEN_TEAM_DASHBOARD()
            </button>
            <button onClick={handleLogout} className="btn" style={{ width: "100%" }}>
              LOGOUT()
            </button>
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
