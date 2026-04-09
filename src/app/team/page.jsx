"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserRole, logoutAdmin, onUserAuthChange } from "../../../lib/auth";
import { ROLES } from "../../../lib/constants/roles";

function StatusBadge({ status }) {
  const normalized = String(status || "pending").toLowerCase();

  const styleMap = {
    verified: {
      color: "#00FF88",
      border: "1px solid #00FF88",
      background: "rgba(0,255,136,0.12)",
      label: "VERIFIED",
    },
    rejected: {
      color: "#FF2A2A",
      border: "1px solid #FF2A2A",
      background: "rgba(255,42,42,0.12)",
      label: "REJECTED",
    },
    pending: {
      color: "#FFD700",
      border: "1px solid #FFD700",
      background: "rgba(255,215,0,0.12)",
      label: "PENDING",
    },
  };

  const style = styleMap[normalized] || styleMap.pending;

  return (
    <span style={{
      color: style.color,
      border: style.border,
      background: style.background,
      fontFamily: "monospace",
      fontSize: "0.75rem",
      fontWeight: "bold",
      padding: "2px 10px",
      letterSpacing: "0.5px",
    }}>
      {style.label}
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
      const response = await fetch("/api/team/dashboard", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
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

  if (authChecking || loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-dark)",
      }}>
        <p style={{ color: "var(--neon-cyan)", fontFamily: "monospace", fontSize: "1.1rem" }}>
          &gt;&gt;&gt; LOADING TEAM LEAD DASHBOARD...
        </p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-dark)",
      backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
      backgroundSize: "40px 40px",
    }}>
      <nav style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1rem 1.5rem",
        borderBottom: "2px solid var(--border-color)",
        boxShadow: "0 4px 0 var(--neon-purple)",
        background: "var(--bg-dark)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-heading)",
            fontSize: "1.6rem",
            textShadow: "2px 2px 0 var(--neon-pink)",
          }}>
            TEAM<span style={{ color: "var(--neon-pink)" }}>_</span>DASHBOARD
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--neon-cyan)", fontFamily: "monospace" }}>
            {user?.email || "AUTHENTICATED USER"}
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button className="btn" onClick={handleRefresh} disabled={refreshing} style={{ padding: "0.45rem 1rem", fontSize: "0.8rem" }}>
            {refreshing ? "REFRESHING..." : "REFRESH()"}
          </button>
          <button className="btn" onClick={handleLogout} style={{ padding: "0.45rem 1rem", fontSize: "0.8rem", boxShadow: "3px 3px 0 var(--danger-red)" }}>
            LOGOUT()
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1rem" }}>
        {error && (
          <div style={{
            border: "1px solid var(--danger-red)",
            background: "rgba(255,42,42,0.1)",
            color: "var(--danger-red)",
            fontFamily: "monospace",
            padding: "0.8rem",
            marginBottom: "1rem",
          }}>
            {error}
          </div>
        )}

        {!dashboard && !error && (
          <div className="cyber-card" style={{ padding: "2rem" }}>
            <p style={{ color: "var(--text-main)", fontFamily: "monospace" }}>
              No team data found for this account.
            </p>
          </div>
        )}

        {dashboard && (
          <>
            <section className="cyber-card" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
              <h2 style={{ color: "var(--neon-cyan)", fontSize: "1.3rem", marginBottom: "0.8rem" }}>
                TEAM OVERVIEW
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.9rem" }}>
                <p><span style={{ color: "var(--text-muted)" }}>TEAM:</span> {dashboard.team?.team_name || "N/A"}</p>
                <p><span style={{ color: "var(--text-muted)" }}>COLLEGE:</span> {dashboard.team?.college || "N/A"}</p>
                <p><span style={{ color: "var(--text-muted)" }}>TEAM SIZE:</span> {dashboard.team?.team_size || "N/A"}</p>
                <p><span style={{ color: "var(--text-muted)" }}>CREATED:</span> {createdAtLabel}</p>
              </div>
            </section>

            <section className="cyber-card" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
              <h2 style={{ color: "var(--neon-cyan)", fontSize: "1.3rem", marginBottom: "0.8rem" }}>
                PAYMENT STATUS
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.9rem", alignItems: "center" }}>
                <p><span style={{ color: "var(--text-muted)" }}>AMOUNT:</span> {dashboard.payment?.amount ?? 800}</p>
                <p><span style={{ color: "var(--text-muted)" }}>TX ID:</span> {dashboard.payment?.upi_transaction_id || "N/A"}</p>
                <p><span style={{ color: "var(--text-muted)" }}>STATUS:</span> <StatusBadge status={dashboard.payment?.status} /></p>
                <p>
                  <span style={{ color: "var(--text-muted)" }}>SCREENSHOT:</span>{" "}
                  {dashboard.payment?.screenshot_url ? (
                    <a
                      href={dashboard.payment.screenshot_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--neon-pink)", textDecoration: "underline" }}
                    >
                      VIEW
                    </a>
                  ) : "N/A"}
                </p>
              </div>
            </section>

            <section className="cyber-card" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
              <h2 style={{ color: "var(--neon-cyan)", fontSize: "1.3rem", marginBottom: "0.8rem" }}>
                TEAM MEMBERS
              </h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--neon-cyan)" }}>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>ROLE</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>NAME</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>EMAIL</th>
                      <th style={{ textAlign: "left", padding: "0.6rem" }}>PHONE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dashboard.members || []).map((member) => (
                      <tr key={member.participant_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                        <td style={{ padding: "0.6rem", color: member.is_leader ? "var(--neon-cyan)" : "var(--text-muted)" }}>
                          {member.is_leader ? "LEAD" : "MEMBER"}
                        </td>
                        <td style={{ padding: "0.6rem" }}>{member.name || "N/A"}</td>
                        <td style={{ padding: "0.6rem" }}>{member.email || "N/A"}</td>
                        <td style={{ padding: "0.6rem" }}>{member.phone || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="cyber-card" style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
              <h2 style={{ color: "var(--neon-cyan)", fontSize: "1.3rem", marginBottom: "0.8rem" }}>
                PROBLEM STATEMENT SELECTION
              </h2>
              {dashboard.selected_problem ? (
                <div style={{
                  border: "1px solid var(--neon-pink)",
                  background: "rgba(255,0,255,0.08)",
                  padding: "0.8rem",
                  marginBottom: "0.8rem",
                }}>
                  <p><span style={{ color: "var(--text-muted)" }}>SELECTED PROBLEM:</span> {dashboard.selected_problem.problem_title || dashboard.selected_problem.problem_id || "N/A"}</p>
                  <p><span style={{ color: "var(--text-muted)" }}>SELECTED AT:</span> {dashboard.selected_problem.selected_at || "N/A"}</p>
                </div>
              ) : (
                <p style={{ color: "var(--text-muted)", marginBottom: "0.8rem" }}>
                  No problem statement selected yet.
                </p>
              )}

              <h3 style={{ color: "var(--neon-pink)", fontSize: "1rem", marginBottom: "0.6rem" }}>
                AVAILABLE PROBLEM STATEMENTS
              </h3>
              {(dashboard.problem_statements || []).length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>Problem statements are not published yet.</p>
              ) : (
                <div style={{ display: "grid", gap: "0.6rem" }}>
                  {dashboard.problem_statements.map((problem) => (
                    <div key={problem.problem_id} style={{ border: "1px solid var(--border-color)", padding: "0.7rem" }}>
                      <p style={{ color: "var(--text-main)", fontWeight: "bold" }}>{problem.title}</p>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{problem.description || "No description yet."}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="cyber-card" style={{ padding: "1.5rem" }}>
              <h2 style={{ color: "var(--neon-cyan)", fontSize: "1.3rem", marginBottom: "0.8rem" }}>
                LATEST UPDATES
              </h2>
              <ul style={{ marginLeft: "1.1rem", color: "var(--text-main)", display: "grid", gap: "0.45rem" }}>
                {(dashboard.updates || []).map((update) => (
                  <li key={update} style={{ fontFamily: "monospace" }}>{update}</li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
