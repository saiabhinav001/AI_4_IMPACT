"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

function toMillis(value) {
  if (!value) return NaN;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value === "number") return value;
  return Date.parse(value);
}

export default function ParticipantDashboard() {
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [team, setTeam] = useState(null);
  const [config, setConfig] = useState(null);
  const [psId, setPsId] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [pptFile, setPptFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user || null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authUser?.uid) return;
    const userRef = doc(db, "users", authUser.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      setProfile(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [authUser?.uid]);

  useEffect(() => {
    const ref = doc(db, "hackathon_config", "global");
    const unsub = onSnapshot(ref, (snap) => {
      setConfig(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!profile?.teamId) return;
    const teamRef = doc(db, "teams", profile.teamId);
    const unsub = onSnapshot(teamRef, (snap) => {
      setTeam(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [profile?.teamId]);

  const phase = config?.currentPhase || "REGISTRATION";
  const submissionDisabled = useMemo(() => {
    if (phase !== "SUBMISSION") return true;
    if (config?.submissionLocked) return true;
    const deadline = toMillis(config?.submissionDeadline);
    if (Number.isFinite(deadline) && Date.now() > deadline) return true;
    return false;
  }, [phase, config]);

  async function runAuthedFetch(url, options = {}) {
    const token = await authUser.getIdToken();
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async function handlePsSelect() {
    if (!psId.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await runAuthedFetch("/api/teams/ps-select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemStatementId: psId.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Selection failed.");
      setMessage("Problem statement locked successfully.");
    } catch (error) {
      setMessage(error.message || "Failed to select problem statement.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitProject() {
    if (!githubUrl.trim() || !pptFile || !profile?.teamId) return;
    setBusy(true);
    setMessage("");
    try {
      const uploadBody = new FormData();
      uploadBody.append("file", pptFile);
      uploadBody.append("teamId", profile.teamId);

      const uploadRes = await runAuthedFetch("/api/upload/ppt", {
        method: "POST",
        body: uploadBody,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.success) {
        throw new Error(uploadData.error || "Failed to upload PPT.");
      }

      const submitRes = await runAuthedFetch("/api/teams/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUrl: githubUrl.trim(),
          pptUrl: uploadData.url,
        }),
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok || !submitData.success) {
        throw new Error(submitData.error || "Submission failed.");
      }
      setMessage("Submission locked successfully.");
    } catch (error) {
      setMessage(error.message || "Failed to submit project.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-dark)", padding: "2rem" }}>
      <div style={{ maxWidth: "980px", margin: "0 auto" }}>
        <h1 style={{ fontFamily: "var(--font-heading)", marginBottom: "1rem" }}>
          PARTICIPANT DASHBOARD
        </h1>
        <p style={{ color: "var(--neon-cyan)", marginBottom: "1.5rem" }}>
          CURRENT PHASE: {phase}
        </p>

        {phase === "REGISTRATION" && (
          <div className="cyber-card" style={{ padding: "1rem", marginBottom: "1rem" }}>
            <h3>[ REGISTRATION STATUS ]</h3>
            <p>PAYMENT: {team?.payment?.status || "PENDING"}</p>
            <p>TEAM MEMBERS: {Array.isArray(team?.members) ? team.members.length : 0}</p>
          </div>
        )}

        {phase === "PS_SELECTION" && (
          <div className="cyber-card" style={{ padding: "1rem", marginBottom: "1rem" }}>
            <h3>[ PROBLEM STATEMENT ]</h3>
            {team?.psSelection?.selected ? (
              <p>LOCKED PS: {team?.psSelection?.problemStatementId || "N/A"}</p>
            ) : (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <input
                  value={psId}
                  onChange={(e) => setPsId(e.target.value)}
                  placeholder="Enter Problem Statement ID"
                  style={{ flex: 1, padding: "0.6rem", background: "var(--bg-dark)", color: "var(--text-main)", border: "1px solid var(--border-color)" }}
                />
                <button className="btn" onClick={handlePsSelect} disabled={busy || profile?.role !== "TEAM_LEAD"}>
                  LOCK_PS()
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "ONGOING" && (
          <div className="cyber-card" style={{ padding: "1rem", marginBottom: "1rem" }}>
            <h3>[ LIVE TIMELINE ]</h3>
            {(config?.timelineEvents || []).map((event, index) => {
              const now = Date.now();
              const start = toMillis(event?.startAt);
              const end = toMillis(event?.endAt);
              const active = Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end;
              return (
                <p key={`${event?.title || "event"}-${index}`} style={{ color: active ? "var(--neon-pink)" : "var(--text-main)" }}>
                  {active ? ">> " : ""}{event?.title || "Untitled Event"}
                </p>
              );
            })}
          </div>
        )}

        {phase === "SUBMISSION" && (
          <div className="cyber-card" style={{ padding: "1rem", marginBottom: "1rem" }}>
            <h3>[ FINAL SUBMISSION ]</h3>
            <input
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="GitHub Repository URL"
              style={{ width: "100%", padding: "0.6rem", marginBottom: "0.6rem", background: "var(--bg-dark)", color: "var(--text-main)", border: "1px solid var(--border-color)" }}
              disabled={submissionDisabled || busy}
            />
            <input
              type="file"
              accept=".ppt,.pptx,.pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf"
              onChange={(e) => setPptFile(e.target.files?.[0] || null)}
              disabled={submissionDisabled || busy}
              style={{ marginBottom: "0.6rem" }}
            />
            <br />
            <button className="btn" onClick={handleSubmitProject} disabled={submissionDisabled || busy || profile?.role !== "TEAM_LEAD"}>
              {submissionDisabled ? "SUBMISSION_CLOSED" : "SUBMIT_PROJECT()"}
            </button>
          </div>
        )}

        {!!message && (
          <p style={{ color: "var(--neon-cyan)", fontFamily: "monospace" }}>{message}</p>
        )}
      </div>
    </div>
  );
}
