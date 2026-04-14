"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { toRuntimeApiUrl } from "../../../lib/api-base";
import { buildRuntimeIdTokenHeaders } from "../../../lib/runtime-auth";
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
    return fetch(toRuntimeApiUrl(url), {
      ...options,
      headers: {
        ...buildRuntimeIdTokenHeaders(token, options.headers || {}),
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
    <div className="min-h-screen bg-black pt-32 pb-20 px-0">
      <div className="max-w-7xl mx-auto px-0 sm:px-8 lg:px-12">
        <div className="px-6 mb-12 sm:px-0">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-white sm:text-7xl lg:text-8xl">
            PARTICIPANT<br className="sm:hidden" /> DASHBOARD
          </h1>
          <p className="mt-4 text-sm font-bold tracking-[0.3em] text-[#00FFFF] uppercase sm:text-lg">
            CURRENT PHASE: {phase}
          </p>
          <div className="mt-6 h-[1px] w-12 bg-[#8D36D5]" />
        </div>

        <div className="grid grid-cols-1 gap-8">
          {phase === "REGISTRATION" && (
            <div className="cyber-card group p-8 bg-white/[0.03] backdrop-blur-3xl border border-white/5 rounded-[2rem] overflow-hidden relative">
              <div className="scanning-ray opacity-20" />
              <div className="flex justify-between items-start mb-8">
                <span className="text-[10px] font-black tracking-[0.3em] text-[#8D36D5]">STATUS_REPORT</span>
                <span className="text-2xl font-black text-white/10 uppercase">/01</span>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white mb-6 sm:text-3xl">
                REGISTRATION STATUS
              </h3>
              <div className="space-y-4 font-medium">
                <p className="text-sm sm:text-lg">
                  <span className="text-zinc-500 uppercase tracking-widest text-xs mr-4">PAYMENT:</span> 
                  <span className={team?.payment?.status === "SUCCESS" ? "text-cyan-400" : "text-fuchsia-500"}>
                    {team?.payment?.status || "PENDING"}
                  </span>
                </p>
                <p className="text-sm sm:text-lg">
                  <span className="text-zinc-500 uppercase tracking-widest text-xs mr-4">TEAM MEMBERS:</span> 
                  {Array.isArray(team?.members) ? team.members.length : 0}
                </p>
              </div>
            </div>
          )}

          {phase === "PS_SELECTION" && (
            <div className="cyber-card group p-8 bg-white/[0.03] backdrop-blur-3xl border border-white/5 rounded-[2rem] overflow-hidden relative">
              <div className="scanning-ray opacity-20" />
              <div className="flex justify-between items-start mb-8">
                <span className="text-[10px] font-black tracking-[0.3em] text-[#8D36D5]">PROTOCOL_ENTRY</span>
                <span className="text-2xl font-black text-white/10 uppercase">/02</span>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white mb-6 sm:text-3xl">
                PROBLEM STATEMENT
              </h3>
              {team?.psSelection?.selected ? (
                <div className="p-6 rounded-xl bg-cyan-400/5 border border-cyan-400/20">
                  <p className="text-sm sm:text-lg text-cyan-400 font-bold">
                    LOCKED PS: {team?.psSelection?.problemStatementId || "N/A"}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4">
                  <input
                    value={psId}
                    onChange={(e) => setPsId(e.target.value)}
                    placeholder="ENTER PS_ID (e.g. FIN_01)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#8D36D5] transition-all font-bold placeholder:text-zinc-700"
                  />
                  <button 
                    onClick={handlePsSelect} 
                    disabled={busy || profile?.role !== "TEAM_LEAD"}
                    className="btn group relative overflow-hidden px-10 py-4 bg-white text-black font-black uppercase text-xs tracking-widest rounded-xl hover:scale-105 transition-all disabled:opacity-50"
                  >
                    LOCK_PS()
                  </button>
                </div>
              )}
            </div>
          )}

          {phase === "ONGOING" && (
            <div className="cyber-card group p-8 bg-white/[0.03] backdrop-blur-3xl border border-white/5 rounded-[2rem] overflow-hidden relative">
              <div className="scanning-ray opacity-20" />
              <div className="flex justify-between items-start mb-8">
                <span className="text-[10px] font-black tracking-[0.3em] text-[#8D36D5]">TEMPORAL_FLUX</span>
                <span className="text-2xl font-black text-white/10 uppercase">/03</span>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white mb-6 sm:text-3xl">
                LIVE TIMELINE
              </h3>
              <div className="space-y-4">
                {(config?.timelineEvents || []).map((event, index) => {
                  const now = Date.now();
                  const start = toMillis(event?.startAt);
                  const end = toMillis(event?.endAt);
                  const active = Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end;
                  return (
                    <div 
                      key={`${event?.title || "event"}-${index}`} 
                      className={`flex items-center gap-4 transition-all duration-500 ${active ? "opacity-100 scale-100" : "opacity-30 blur-[1px]"}`}
                    >
                      <div className={`h-2 w-2 rounded-full ${active ? "bg-cyan-400 animate-pulse" : "bg-white/20"}`} />
                      <p className={`text-sm sm:text-base font-bold tracking-wide uppercase ${active ? "text-white" : "text-zinc-500"}`}>
                        {event?.title || "Untitled Event"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {phase === "SUBMISSION" && (
            <div className="cyber-card group p-8 bg-white/[0.03] backdrop-blur-3xl border border-white/5 rounded-[2rem] overflow-hidden relative">
              <div className="scanning-ray opacity-20" />
              <div className="flex justify-between items-start mb-8">
                <span className="text-[10px] font-black tracking-[0.3em] text-[#8D36D5]">DATA_EXPORT</span>
                <span className="text-2xl font-black text-white/10 uppercase">/04</span>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-white mb-6 sm:text-3xl">
                FINAL SUBMISSION
              </h3>
              <div className="space-y-6">
                <input
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="GITHUB_REPOSITORY_URL"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white outline-none focus:border-[#8D36D5] transition-all font-bold placeholder:text-zinc-700 disabled:opacity-50"
                  disabled={submissionDisabled || busy}
                />
                <div className="relative">
                  <input
                    type="file"
                    accept=".ppt,.pptx,.pdf"
                    onChange={(e) => setPptFile(e.target.files?.[0] || null)}
                    disabled={submissionDisabled || busy}
                    className="w-full text-xs text-zinc-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-white/10 file:text-white hover:file:bg-white/20 file:cursor-pointer disabled:opacity-50"
                  />
                </div>
                <button 
                  onClick={handleSubmitProject} 
                  disabled={submissionDisabled || busy || profile?.role !== "TEAM_LEAD"}
                  className="btn group relative w-full overflow-hidden px-10 py-6 bg-white text-black font-black uppercase text-sm tracking-widest rounded-xl hover:scale-[1.02] transition-all disabled:opacity-20"
                >
                  {submissionDisabled ? "SUBMISSION_CLOSED" : "LOCKED_SUBMIT()"}
                </button>
              </div>
            </div>
          )}

          {!!message && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 p-6 rounded-2xl bg-[#00FFFF]/5 border border-[#00FFFF]/20"
            >
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#00FFFF]">
                {">> "} {message}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
