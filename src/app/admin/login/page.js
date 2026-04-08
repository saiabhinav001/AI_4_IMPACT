"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginAdmin, onAuthChange } from "../../../../lib/auth";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthChange(
      (user) => {
        if (user) {
          router.replace("/admin");
        } else {
          setCheckingAuth(false);
        }
      },
      () => {
        setCheckingAuth(false);
      }
    );
    return () => unsub();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginAdmin();
      router.replace("/admin");
    } catch (err) {
      if (err?.code === "ACCESS_DENIED" || err?.message?.includes("ACCESS_DENIED")) {
        setError(">>> ACCESS DENIED. UNAUTHORIZED ACCOUNT.");
      } else if (err?.code === "auth/popup-closed-by-user") {
        setError(">>> LOGIN INTERRUPTED. COMPLETE GOOGLE SIGN-IN.");
      } else if (err?.code === "auth/cancelled-popup-request") {
        setError(">>> SIGN-IN REQUEST CANCELLED. TRY AGAIN.");
      } else {
        setError(">>> SYSTEM ERROR: " + (err?.message || "Authentication failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "var(--bg-dark)"
      }}>
        <p style={{ color: "var(--neon-cyan)", fontFamily: "monospace", fontSize: "1.2rem" }}>
          &gt;&gt;&gt; VERIFYING SECURITY CLEARANCE...
        </p>
      </div>
    );
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
    }}>
      <div className="cyber-card" style={{
        width: "100%", maxWidth: "440px", padding: "3rem",
      }}>
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <h1 style={{
            fontFamily: "var(--font-heading)", fontSize: "2.5rem",
            textShadow: "3px 3px 0 var(--neon-pink)", marginBottom: "0.5rem"
          }}>
            ADMIN<span style={{ color: "var(--neon-pink)" }}>_</span>LOGIN
          </h1>
          <p style={{ color: "var(--neon-cyan)", fontSize: "0.85rem", fontFamily: "monospace" }}>
            &gt;&gt;&gt; AUTHORIZED PERSONNEL ONLY
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{
              display: "block", color: "var(--text-main)", marginBottom: "0.5rem",
              fontWeight: "bold", fontFamily: "var(--font-body)", textTransform: "uppercase"
            }}>[ EMAIL ]</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%", padding: "0.8rem", background: "var(--bg-dark)",
                border: "2px solid var(--border-color)", color: "var(--neon-cyan)",
                fontFamily: "monospace", fontSize: "1rem"
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{
              display: "block", color: "var(--text-main)", marginBottom: "0.5rem",
              fontWeight: "bold", fontFamily: "var(--font-body)", textTransform: "uppercase"
            }}>[ PASSWORD ]</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%", padding: "0.8rem", background: "var(--bg-dark)",
                border: "2px solid var(--border-color)", color: "var(--neon-cyan)",
                fontFamily: "monospace", fontSize: "1rem"
              }}
            />
          </div>

          {error && (
            <p style={{
              color: "var(--danger-red)", marginBottom: "1rem", fontWeight: "bold",
              fontSize: "0.9rem", fontFamily: "monospace",
              padding: "0.5rem", border: "1px solid var(--danger-red)",
              background: "rgba(255,42,42,0.1)"
            }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn" disabled={loading} style={{
            width: "100%", textAlign: "center",
            opacity: loading ? 0.5 : 1, cursor: loading ? "not-allowed" : "pointer"
          }}>
            {loading ? "AUTHENTICATING..." : "INITIATE_LOGIN()"}
          </button>
        </form>
      </div>
    </div>
  );
}
