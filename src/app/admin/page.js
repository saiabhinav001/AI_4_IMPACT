"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getUserRole, logoutAdmin, onUserAuthChange } from "../../../lib/auth";
import { ROLES } from "../../../lib/constants/roles";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Legend
} from "recharts";

const CHART_COLORS = ["#00FFFF", "#FF00FF", "#B026FF", "#FF2A2A", "#00FF88"];
const PAGE_SIZE = 15;

function getLeaderParticipant(registration) {
  return Array.isArray(registration?.participants) ? registration.participants[0] || null : null;
}

function getLeaderName(registration) {
  return getLeaderParticipant(registration)?.name || "—";
}

function getLeaderContact(registration) {
  const leader = getLeaderParticipant(registration);
  return leader?.phone || leader?.email || "—";
}

function mapRegistrationItem(item) {
  const registrationType = item?.registration_type;
  const registration = item?.registration || {};

  if (registrationType === "workshop") {
    const participant = registration?.participant || {};
    const workshopId = registration?.workshop_id || item?.transaction_id || "";
    const fallbackName = workshopId
      ? `WORKSHOP_${String(workshopId).slice(0, 6).toUpperCase()}`
      : "WORKSHOP";
    const hasParticipant =
      Boolean(participant?.name) || Boolean(participant?.email) || Boolean(participant?.phone);

    return {
      id: item?.transaction_id,
      transactionDocId: item?.transaction_id,
      registrationType,
      teamName: participant?.name || fallbackName,
      collegeName: participant?.college || "",
      teamSize: 1,
      participants: hasParticipant
        ? [
            {
              name: participant?.name || "",
              roll: "",
              email: participant?.email || "",
              phone: participant?.phone || "",
            },
          ]
        : [],
      payment: {
        transactionId: item?.upi_transaction_id || "",
        screenshotUrl: item?.screenshot_url || "",
      },
      status: item?.status || "pending",
      createdAt: item?.created_at || null,
      notes: item?.status === "verified" ? "Payment verified" : "",
      accessCredentials: null,
    };
  }

  const members = Array.isArray(registration?.members) ? registration.members : [];
  const rawAccessCredentials = registration?.access_credentials || null;
  const accessCredentials = rawAccessCredentials
    ? {
        teamId: rawAccessCredentials?.team_id || "",
        password: "",
        passwordVersion: Number(rawAccessCredentials?.password_version || 0),
        leaderName: rawAccessCredentials?.leader_name || "",
        leaderEmail: rawAccessCredentials?.leader_email || "",
        leaderPhone: rawAccessCredentials?.leader_phone || "",
      }
    : null;

  return {
    id: item?.transaction_id,
    transactionDocId: item?.transaction_id,
    registrationType: registrationType || "hackathon",
    teamName: registration?.team_name || "",
    collegeName: registration?.college || "",
    teamSize: Number(registration?.team_size) || members.length || null,
    participants: members.map((member) => ({
      name: member?.name || "",
      roll: "",
      email: member?.email || "",
      phone: member?.phone || "",
    })),
    payment: {
      transactionId: item?.upi_transaction_id || "",
      screenshotUrl: item?.screenshot_url || "",
    },
    status: item?.status || "pending",
    createdAt: item?.created_at || null,
    notes: item?.status === "verified" ? "Payment verified" : "",
    accessCredentials,
  };
}

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState([]);
  const [dataError, setDataError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSize, setFilterSize] = useState("all");
  const [filterCollege, setFilterCollege] = useState("all");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("table"); // table | analytics
  const [noteText, setNoteText] = useState("");
  const [updateBusy, setUpdateBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [previewScreenshot, setPreviewScreenshot] = useState({
    url: "",
    label: "PAYMENT SCREENSHOT",
  });
  const router = useRouter();

  const toDateSafe = useCallback((value) => {
    if (!value) return null;
    const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }, []);

  // ── Auth guard ──
  useEffect(() => {
    let isActive = true;

    const unsub = onUserAuthChange(
      (u) => {
        const resolveRole = async () => {
          if (!u) {
            if (!isActive) return;
            setLoading(false);
            router.replace("/auth");
            return;
          }

          const role = await getUserRole(u);
          if (!isActive) return;

          if (role === ROLES.ADMIN) {
            setUser(u);
            setLoading(false);
          } else {
            setLoading(false);
            router.replace("/auth?reason=admin-only");
          }
        };

        void resolveRole();
      },
      () => {
        if (!isActive) return;
        setLoading(false);
        router.replace("/auth");
      }
    );

    return () => {
      isActive = false;
      unsub();
    };
  }, [router]);

  const fetchRegistrations = useCallback(async () => {
    if (!user) return;

    const idToken = await user.getIdToken();
    const response = await fetch("/api/admin/registrations", {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("Admin custom claim is missing. Please set { admin: true } for this user.");
      }

      throw new Error(data?.error || "Failed to sync dashboard data.");
    }

    const mapped = Array.isArray(data?.registrations)
      ? data.registrations.map((item) => mapRegistrationItem(item))
      : [];

    setRegistrations(mapped);
    setDataError("");
  }, [user]);

  // ── Admin API sync ──
  useEffect(() => {
    if (!user) return;

    let isCancelled = false;

    const syncOnce = async () => {
      try {
        await fetchRegistrations();
      } catch (error) {
        if (!isCancelled) {
          setDataError(error?.message || "Failed to sync dashboard data.");
        }
      }
    };

    void syncOnce();
    const intervalId = setInterval(() => {
      void syncOnce();
    }, 15000);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [user, fetchRegistrations]);

  // ── Filtering + Search ──
  const filtered = useMemo(() => {
    return registrations.filter((r) => {
      const leader = getLeaderParticipant(r);
      const matchSearch =
        !searchTerm ||
        r.teamName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.collegeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.payment?.transactionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        leader?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        leader?.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        leader?.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSize = filterSize === "all" || r.teamSize === Number(filterSize);
      const matchCollege = filterCollege === "all" || r.collegeName === filterCollege;
      return matchSearch && matchSize && matchCollege;
    });
  }, [registrations, searchTerm, filterSize, filterCollege]);

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // ── Stats ──
  const stats = useMemo(() => {
    const totalRegs = registrations.length;
    const totalParticipants = registrations.reduce((s, r) => s + (r.participants?.length || 0), 0);
    const teamsOf3 = registrations.filter((r) => r.teamSize === 3).length;
    const teamsOf4 = registrations.filter((r) => r.teamSize === 4).length;
    const colleges = new Set(registrations.map((r) => r.collegeName?.toUpperCase())).size;
    return { totalRegs, totalParticipants, teamsOf3, teamsOf4, colleges };
  }, [registrations]);

  // ── Duplicate Detection ──
  const duplicates = useMemo(() => {
    const nameCount = {}, txCount = {};
    registrations.forEach((r) => {
      const n = r.teamName?.toLowerCase();
      const t = r.payment?.transactionId?.toLowerCase();
      if (n) nameCount[n] = (nameCount[n] || 0) + 1;
      if (t) txCount[t] = (txCount[t] || 0) + 1;
    });
    const dupNames = new Set(Object.keys(nameCount).filter((k) => nameCount[k] > 1));
    const dupTx = new Set(Object.keys(txCount).filter((k) => txCount[k] > 1));
    return { dupNames, dupTx };
  }, [registrations]);

  // ── Analytics Data ──
  const analyticsData = useMemo(() => {
    // Registrations over time
    const dateMap = {};
    registrations.forEach((r) => {
      const d = toDateSafe(r.createdAt);
      if (!d) return;
      const isoKey = d.toISOString().slice(0, 10);
      dateMap[isoKey] = (dateMap[isoKey] || 0) + 1;
    });
    const timeline = Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: toDateSafe(date)?.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) || date,
        count,
      }));

    // Top colleges
    const collegeMap = {};
    registrations.forEach((r) => {
      const c = r.collegeName?.toUpperCase() || "UNKNOWN";
      collegeMap[c] = (collegeMap[c] || 0) + 1;
    });
    const topColleges = Object.entries(collegeMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([college, count]) => ({ college: college.length > 15 ? college.slice(0, 15) + "…" : college, count }));

    // Team size distribution
    const sizeDist = [
      { name: "Size 3", value: stats.teamsOf3 },
      { name: "Size 4", value: stats.teamsOf4 },
    ];

    return { timeline, topColleges, sizeDist };
  }, [registrations, stats, toDateSafe]);

  // ── Unique colleges list ──
  const collegeList = useMemo(() => {
    return [...new Set(registrations.map((r) => r.collegeName).filter(Boolean))].sort();
  }, [registrations]);

  // ── CSV Export ──
  const exportCSV = useCallback(() => {
    const headers = [
      "Team Name", "College", "Team Size", "Status", "Transaction ID",
      "Screenshot URL", "Submission Time", "Notes",
      "P1 Name", "P1 Roll", "P1 Email", "P1 Phone",
      "P2 Name", "P2 Roll", "P2 Email", "P2 Phone",
      "P3 Name", "P3 Roll", "P3 Email", "P3 Phone",
      "P4 Name", "P4 Roll", "P4 Email", "P4 Phone",
    ];

    const rows = registrations.map((r) => {
      const dateObj = toDateSafe(r.createdAt);
      const date = dateObj ? dateObj.toISOString() : "N/A";
      const leaderName = getLeaderName(r);
      const leaderContact = getLeaderContact(r);
      const row = [
        r.teamName, leaderName, leaderContact, r.collegeName, r.teamSize, r.status || "pending",
        r.payment?.transactionId || "", r.payment?.screenshotUrl || "",
        date, r.notes || "",
      ];
      for (let i = 0; i < 4; i++) {
        const p = r.participants?.[i];
        row.push(p?.name || "", p?.roll || "", p?.email || "", p?.phone || "");
      }
      return row;
    });

    const csvContent = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `registrations_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [registrations, toDateSafe]);

  const openScreenshotPreview = useCallback((url, label = "PAYMENT SCREENSHOT") => {
    if (!url) return;
    setPreviewScreenshot({ url, label });
  }, []);

  const closeScreenshotPreview = useCallback(() => {
    setPreviewScreenshot({ url: "", label: "PAYMENT SCREENSHOT" });
  }, []);

  // ── Status / Notes update ──

  useEffect(() => {
    setNoteText(
      selectedTeam?.notes || (selectedTeam?.status === "verified" ? "Payment verified" : "")
    );
    setActionError("");
  }, [selectedTeam]);

  const handleLogout = useCallback(async () => {
    try {
      await logoutAdmin();
    } finally {
      router.replace("/auth");
    }
  }, [router]);

  const handleStatusToggle = useCallback(async () => {
    if (!selectedTeam || !user || updateBusy) return;
    const action = selectedTeam.status === "verified" ? "reject" : "verify";
    const newStatus = action === "verify" ? "verified" : "rejected";
    const nextNotes = newStatus === "verified" ? "Payment verified" : "";

    setUpdateBusy(true);
    setActionError("");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/verify-payment", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction_id: selectedTeam.transactionDocId || selectedTeam.id,
          action,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to update status.");
      }

      const nextAccessCredentials = data?.access_credentials
        ? {
            teamId: data.access_credentials.team_id || "",
            password: data.access_credentials.password || "",
            passwordVersion: Number(data.access_credentials.password_version || 0),
            leaderName: data.access_credentials.leader_name || "",
            leaderEmail: data.access_credentials.leader_email || "",
            leaderPhone: data.access_credentials.leader_phone || "",
          }
        : null;

      setRegistrations((prev) =>
        prev.map((item) =>
          item.id === selectedTeam.id
            ? {
                ...item,
                status: newStatus,
                notes: nextNotes,
                accessCredentials: nextAccessCredentials || item.accessCredentials,
              }
            : item
        )
      );
      setSelectedTeam((prev) => (
        prev
          ? {
              ...prev,
              status: newStatus,
              notes: nextNotes,
              accessCredentials: nextAccessCredentials || prev.accessCredentials,
            }
          : prev
      ));
      setNoteText(nextNotes);
    } catch (err) {
      setActionError(err?.message || "Failed to update status.");
    } finally {
      setUpdateBusy(false);
    }
  }, [selectedTeam, updateBusy, user]);

  const handleRegenerateCredentials = useCallback(async () => {
    if (!selectedTeam || !user || updateBusy) return;

    if (selectedTeam.registrationType !== "hackathon") {
      setActionError("Credentials apply only to hackathon teams.");
      return;
    }

    if (selectedTeam.status !== "verified") {
      setActionError("Payment must be VERIFIED before regenerating credentials.");
      return;
    }

    setUpdateBusy(true);
    setActionError("");

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/admin/regenerate-team-credentials", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction_id: selectedTeam.transactionDocId || selectedTeam.id,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to regenerate credentials.");
      }

      const regeneratedCredentials = data?.access_credentials
        ? {
            teamId: data.access_credentials.team_id || "",
            password: data.access_credentials.password || "",
            passwordVersion: Number(data.access_credentials.password_version || 0),
            leaderName: data.access_credentials.leader_name || "",
            leaderEmail: data.access_credentials.leader_email || "",
            leaderPhone: data.access_credentials.leader_phone || "",
          }
        : null;

      setRegistrations((prev) =>
        prev.map((item) =>
          item.id === selectedTeam.id
            ? { ...item, accessCredentials: regeneratedCredentials || item.accessCredentials }
            : item
        )
      );

      setSelectedTeam((prev) =>
        prev
          ? {
              ...prev,
              accessCredentials: regeneratedCredentials || prev.accessCredentials,
            }
          : prev
      );
    } catch (err) {
      setActionError(err?.message || "Failed to regenerate credentials.");
    } finally {
      setUpdateBusy(false);
    }
  }, [selectedTeam, updateBusy, user]);

  const handleSaveNotes = useCallback(async () => {
    if (!selectedTeam || updateBusy) return;
    const nextNotes = noteText.trim();

    setUpdateBusy(true);
    setActionError("");

    try {
      setRegistrations((prev) =>
        prev.map((item) => (item.id === selectedTeam.id ? { ...item, notes: nextNotes } : item))
      );
      setSelectedTeam((prev) => (prev ? { ...prev, notes: nextNotes } : prev));
      setNoteText(nextNotes);
    } catch (err) {
      setActionError(err?.message || "Failed to save notes.");
    } finally {
      setUpdateBusy(false);
    }
  }, [selectedTeam, noteText, updateBusy]);

  // ── Loading state ──
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-dark)" }}>
        <p style={{ color: "var(--neon-cyan)", fontFamily: "monospace", fontSize: "1.2rem" }}>
          &gt;&gt;&gt; LOADING ADMIN INTERFACE...
        </p>
      </div>
    );
  }

  // ── Format date helper ──
  const fmtDate = (ts) => {
    const d = toDateSafe(ts);
    if (!d) return "N/A";
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const selectedLeaderName = selectedTeam ? getLeaderName(selectedTeam) : "—";
  const selectedLeaderContact = selectedTeam ? getLeaderContact(selectedTeam) : "—";
  const selectedAccessCredentials = selectedTeam?.accessCredentials || null;
  const credentialMailto = selectedAccessCredentials?.leaderEmail && selectedAccessCredentials?.password
    ? `mailto:${selectedAccessCredentials.leaderEmail}?subject=${encodeURIComponent("AI4Impact Team Dashboard Access Credentials")}&body=${encodeURIComponent(
        `Hello ${selectedAccessCredentials.leaderName || "Team Leader"},\n\nYour team dashboard credentials are ready.\n\nTeam ID: ${selectedAccessCredentials.teamId || "N/A"}\nPassword: ${selectedAccessCredentials.password || "N/A"}\n\nLogin URL: ${typeof window !== "undefined" ? `${window.location.origin}/auth` : "/auth"}\n\nPlease keep these credentials private.\n\nRegards,\nAI4Impact Admin`
      )}`
    : "";

  const isDupName = (name) => duplicates.dupNames.has(name?.toLowerCase());
  const isDupTx = (tx) => duplicates.dupTx.has(tx?.toLowerCase());

  // ═══════════════════════ RENDER ═══════════════════════
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-dark)", backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "40px 40px" }}>

      {/* ── Top Bar ── */}
      <nav style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "1rem 2rem", borderBottom: "2px solid var(--border-color)",
        boxShadow: "0 4px 0 var(--neon-purple)", background: "var(--bg-dark)",
        position: "sticky", top: 0, zIndex: 100
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.5rem", textShadow: "2px 2px 0 var(--neon-pink)" }}>
            ADMIN<span style={{ color: "var(--neon-pink)" }}>_</span>PANEL
          </h1>
          <span style={{ color: "var(--neon-cyan)", fontSize: "0.75rem", fontFamily: "monospace", border: "1px solid var(--neon-cyan)", padding: "2px 8px" }}>
            {user?.email}
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={exportCSV} className="btn" style={{ padding: "0.4rem 1rem", fontSize: "0.8rem" }}>
            EXPORT_CSV()
          </button>
          <button onClick={handleLogout} className="btn" style={{ padding: "0.4rem 1rem", fontSize: "0.8rem", boxShadow: "3px 3px 0 var(--danger-red)" }}>
            LOGOUT()
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem" }}>

        {dataError && (
          <div style={{
            padding: "0.9rem 1rem",
            border: "1px solid var(--danger-red)",
            background: "rgba(255,42,42,0.08)",
            color: "var(--danger-red)",
            fontFamily: "monospace",
            marginBottom: "1rem"
          }}>
            DATA_SYNC_ERROR: {dataError}
          </div>
        )}

        {/* ── Stats Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
          {[
            { label: "TOTAL REGISTRATIONS", value: stats.totalRegs, color: "var(--neon-cyan)" },
            { label: "TOTAL PARTICIPANTS", value: stats.totalParticipants, color: "var(--neon-pink)" },
            { label: "TEAMS OF 3", value: stats.teamsOf3, color: "var(--neon-cyan)" },
            { label: "TEAMS OF 4", value: stats.teamsOf4, color: "var(--neon-purple)" },
            { label: "UNIQUE COLLEGES", value: stats.colleges, color: "var(--danger-red)" },
          ].map((s) => (
            <div key={s.label} className="cyber-card" style={{ padding: "1.5rem", textAlign: "center" }}>
              <p style={{ fontSize: "2.5rem", fontFamily: "var(--font-heading)", color: s.color, marginBottom: "0.3rem" }}>{s.value}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", letterSpacing: "1px" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Duplicate alerts ── */}
        {(duplicates.dupNames.size > 0 || duplicates.dupTx.size > 0) && (
          <div style={{
            padding: "1rem 1.5rem", border: "2px solid var(--danger-red)",
            background: "rgba(255,42,42,0.08)", marginBottom: "2rem", fontFamily: "monospace"
          }}>
            <p style={{ color: "var(--danger-red)", fontWeight: "bold", marginBottom: "0.5rem" }}>
              !WARNING! DUPLICATES DETECTED
            </p>
            {duplicates.dupNames.size > 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                DUPLICATE TEAM NAMES: {[...duplicates.dupNames].map(n => n.toUpperCase()).join(", ")}
              </p>
            )}
            {duplicates.dupTx.size > 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                DUPLICATE TRANSACTION IDs: {[...duplicates.dupTx].map(t => t.toUpperCase()).join(", ")}
              </p>
            )}
          </div>
        )}

        {/* ── Tab Switcher ── */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
          {["table", "analytics"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "0.5rem 1.5rem", fontFamily: "var(--font-heading)",
                fontSize: "0.9rem", cursor: "pointer", textTransform: "uppercase",
                border: "2px solid var(--border-color)",
                background: activeTab === tab ? "var(--neon-cyan)" : "var(--bg-dark)",
                color: activeTab === tab ? "var(--bg-dark)" : "var(--text-main)",
                boxShadow: activeTab === tab ? "4px 4px 0 var(--neon-pink)" : "3px 3px 0 var(--neon-purple)",
                transition: "all 0.2s"
              }}
            >
              {tab === "table" ? "[ DATA TABLE ]" : "[ ANALYTICS ]"}
            </button>
          ))}
        </div>

        {/* ═══ DATA TABLE TAB ═══ */}
        {activeTab === "table" && (
          <>
            {/* ── Filters ── */}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="SEARCH TEAM / LEADER / CONTACT / COLLEGE / TX ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  flex: "1", minWidth: "200px", padding: "0.7rem",
                  background: "var(--bg-dark)", border: "2px solid var(--neon-cyan)",
                  color: "var(--neon-cyan)", fontFamily: "monospace", fontSize: "0.9rem"
                }}
              />
              <select
                value={filterSize}
                onChange={(e) => {
                  setFilterSize(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "0.7rem 1rem", background: "var(--bg-dark)",
                  border: "2px solid var(--border-color)", color: "var(--text-main)",
                  fontFamily: "monospace", cursor: "pointer"
                }}
              >
                <option value="all">ALL SIZES</option>
                <option value="3">SIZE 3</option>
                <option value="4">SIZE 4</option>
              </select>
              <select
                value={filterCollege}
                onChange={(e) => {
                  setFilterCollege(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: "0.7rem 1rem", background: "var(--bg-dark)",
                  border: "2px solid var(--border-color)", color: "var(--text-main)",
                  fontFamily: "monospace", cursor: "pointer", maxWidth: "250px"
                }}
              >
                <option value="all">ALL COLLEGES</option>
                {collegeList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "1rem", fontFamily: "monospace" }}>
              SHOWING {paginated.length} OF {filtered.length} RESULTS (PAGE {currentPage}/{totalPages})
            </p>

            {/* ── Table ── */}
            <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "monospace", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--neon-cyan)" }}>
                    {["#", "TEAM", "LEADER", "CONTACT", "COLLEGE", "SIZE", "TX ID", "STATUS", "SCREENSHOT", "TIME"].map((h) => (
                      <th key={h} style={{ padding: "0.8rem 0.5rem", textAlign: "left", color: "var(--neon-cyan)", fontWeight: "bold", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((r, i) => {
                    const dupN = isDupName(r.teamName);
                    const dupT = isDupTx(r.payment?.transactionId);
                    const leaderName = getLeaderName(r);
                    const leaderContact = getLeaderContact(r);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedTeam(r)}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
                          background: (dupN || dupT) ? "rgba(255,42,42,0.06)" : "transparent",
                          transition: "background 0.15s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,255,255,0.05)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = (dupN || dupT) ? "rgba(255,42,42,0.06)" : "transparent"}
                      >
                        <td style={{ padding: "0.7rem 0.5rem", color: "var(--text-muted)" }}>{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                        <td style={{ padding: "0.7rem 0.5rem", color: dupN ? "var(--danger-red)" : "var(--text-main)", fontWeight: "bold" }}>
                          {r.teamName?.toUpperCase() || "—"}
                          {dupN && <span style={{ color: "var(--danger-red)", fontSize: "0.7rem" }}> ⚠ DUP</span>}
                        </td>
                        <td style={{ padding: "0.7rem 0.5rem", color: "var(--text-main)", fontWeight: "bold" }}>
                          {leaderName !== "—" ? leaderName.toUpperCase() : "—"}
                        </td>
                        <td style={{ padding: "0.7rem 0.5rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {leaderContact}
                        </td>
                        <td style={{ padding: "0.7rem 0.5rem", color: "var(--text-muted)" }}>{r.collegeName?.toUpperCase() || "—"}</td>
                        <td style={{ padding: "0.7rem 0.5rem", color: "var(--neon-purple)" }}>{r.teamSize}</td>
                        <td style={{ padding: "0.7rem 0.5rem", color: dupT ? "var(--danger-red)" : "var(--neon-cyan)", fontFamily: "monospace" }}>
                          {r.payment?.transactionId || "—"}
                          {dupT && <span style={{ color: "var(--danger-red)", fontSize: "0.7rem" }}> ⚠ DUP</span>}
                        </td>
                        <td style={{ padding: "0.7rem 0.5rem" }}>
                          <span style={{
                            padding: "2px 8px", fontSize: "0.75rem", fontWeight: "bold",
                            background:
                              r.status === "verified"
                                ? "rgba(0,255,136,0.15)"
                                : r.status === "rejected"
                                  ? "rgba(255,42,42,0.15)"
                                  : "rgba(255,255,0,0.1)",
                            color:
                              r.status === "verified"
                                ? "#00FF88"
                                : r.status === "rejected"
                                  ? "#FF2A2A"
                                  : "#FFD700",
                            border: `1px solid ${
                              r.status === "verified"
                                ? "#00FF88"
                                : r.status === "rejected"
                                  ? "#FF2A2A"
                                  : "#FFD700"
                            }`
                          }}>
                            {r.status === "verified"
                              ? "✅ VERIFIED"
                              : r.status === "rejected"
                                ? "❌ REJECTED"
                                : "⏳ PENDING"}
                          </span>
                        </td>
                        <td style={{ padding: "0.7rem 0.5rem" }}>
                          {r.payment?.screenshotUrl ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openScreenshotPreview(
                                  r.payment.screenshotUrl,
                                  `${r.teamName?.toUpperCase() || "REGISTRATION"} SCREENSHOT`
                                );
                              }}
                              style={{
                                background: "transparent",
                                border: "1px solid var(--neon-pink)",
                                color: "var(--neon-pink)",
                                padding: "2px 8px",
                                cursor: "pointer",
                                fontFamily: "monospace",
                                fontSize: "0.75rem",
                              }}
                            >
                              PREVIEW
                            </button>
                          ) : "—"}
                        </td>
                        <td style={{ padding: "0.7rem 0.5rem", color: "var(--text-muted)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{fmtDate(r.createdAt)}</td>
                      </tr>
                    );
                  })}
                  {paginated.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>NO RESULTS FOUND</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  style={{ padding: "0.4rem 1rem", background: "var(--bg-dark)", border: "1px solid var(--border-color)", color: "var(--text-main)", cursor: "pointer", opacity: currentPage === 1 ? 0.4 : 1 }}>
                  PREV
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                  Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2)
                ).map((p) => (
                  <button key={p} onClick={() => setCurrentPage(p)}
                    style={{
                      padding: "0.4rem 0.8rem", border: "1px solid var(--border-color)",
                      background: p === currentPage ? "var(--neon-cyan)" : "var(--bg-dark)",
                      color: p === currentPage ? "var(--bg-dark)" : "var(--text-main)",
                      cursor: "pointer", fontWeight: p === currentPage ? "bold" : "normal"
                    }}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  style={{ padding: "0.4rem 1rem", background: "var(--bg-dark)", border: "1px solid var(--border-color)", color: "var(--text-main)", cursor: "pointer", opacity: currentPage === totalPages ? 0.4 : 1 }}>
                  NEXT
                </button>
              </div>
            )}
          </>
        )}

        {/* ═══ ANALYTICS TAB ═══ */}
        {activeTab === "analytics" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
            {/* Registrations Over Time */}
            <div className="cyber-card" style={{ padding: "1.5rem", gridColumn: "1 / -1" }}>
              <h3 style={{ fontSize: "1.2rem", marginBottom: "1rem", borderBottom: "1px solid var(--text-muted)", paddingBottom: "0.5rem" }}>
                📈 REGISTRATIONS OVER TIME
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analyticsData.timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="date" stroke="#BBB" tick={{ fontSize: 12, fill: "#BBB" }} />
                  <YAxis stroke="#BBB" tick={{ fontSize: 12, fill: "#BBB" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid #00FFFF", color: "#FFF" }} />
                  <Line type="monotone" dataKey="count" stroke="#00FFFF" strokeWidth={2} dot={{ r: 4, fill: "#FF00FF" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Top Colleges */}
            <div className="cyber-card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1.2rem", marginBottom: "1rem", borderBottom: "1px solid var(--text-muted)", paddingBottom: "0.5rem" }}>
                🏫 TOP COLLEGES
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.topColleges} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis type="number" stroke="#BBB" tick={{ fontSize: 11, fill: "#BBB" }} allowDecimals={false} />
                  <YAxis dataKey="college" type="category" width={120} stroke="#BBB" tick={{ fontSize: 10, fill: "#BBB" }} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid #FF00FF", color: "#FFF" }} />
                  <Bar dataKey="count" fill="#FF00FF" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Team Size Distribution */}
            <div className="cyber-card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1.2rem", marginBottom: "1rem", borderBottom: "1px solid var(--text-muted)", paddingBottom: "0.5rem" }}>
                👥 TEAM SIZE DISTRIBUTION
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={analyticsData.sizeDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                    {analyticsData.sizeDist.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid #B026FF", color: "#FFF" }} />
                  <Legend wrapperStyle={{ color: "#BBB" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ═══ TEAM DETAIL MODAL ═══ */}
      {selectedTeam && (
        <div
          onClick={() => setSelectedTeam(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 200, padding: "1rem"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cyber-card"
            style={{
              maxWidth: "700px", width: "100%", maxHeight: "90vh", overflowY: "auto",
              padding: "2.5rem"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.8rem", color: "var(--neon-cyan)", marginBottom: "0.3rem" }}>
                  {selectedTeam.teamName?.toUpperCase()}
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{selectedTeam.collegeName?.toUpperCase()}</p>
              </div>
              <button onClick={() => setSelectedTeam(null)} style={{
                background: "none", border: "2px solid var(--danger-red)", color: "var(--danger-red)",
                padding: "0.3rem 0.8rem", cursor: "pointer", fontWeight: "bold", fontSize: "1rem"
              }}>✕</button>
            </div>

            {/* Status Toggle */}
            <div style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>STATUS:</span>
              <button
                onClick={handleStatusToggle}
                disabled={updateBusy}
                style={{
                  padding: "0.3rem 1rem", border: "1px solid",
                  borderColor:
                    selectedTeam.status === "verified"
                      ? "#00FF88"
                      : selectedTeam.status === "rejected"
                        ? "#FF2A2A"
                        : "#FFD700",
                  background:
                    selectedTeam.status === "verified"
                      ? "rgba(0,255,136,0.15)"
                      : selectedTeam.status === "rejected"
                        ? "rgba(255,42,42,0.15)"
                        : "rgba(255,255,0,0.1)",
                  color:
                    selectedTeam.status === "verified"
                      ? "#00FF88"
                      : selectedTeam.status === "rejected"
                        ? "#FF2A2A"
                        : "#FFD700",
                  cursor: updateBusy ? "not-allowed" : "pointer", fontWeight: "bold", fontSize: "0.8rem",
                  opacity: updateBusy ? 0.6 : 1
                }}
              >
                {selectedTeam.status === "verified"
                  ? "✅ VERIFIED"
                  : selectedTeam.status === "rejected"
                    ? "❌ REJECTED"
                    : "⏳ PENDING"} (TOGGLE)
              </button>
            </div>

            {/* Team Info */}
            <div style={{ marginBottom: "1.5rem", padding: "1rem", border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.02)" }}>
              <p style={{ marginBottom: "0.5rem" }}><span style={{ color: "var(--neon-cyan)" }}>TEAM SIZE:</span> {selectedTeam.teamSize}</p>
              <p style={{ marginBottom: "0.5rem" }}><span style={{ color: "var(--neon-cyan)" }}>TEAM LEADER:</span> {selectedLeaderName}</p>
              <p style={{ marginBottom: "0.5rem" }}><span style={{ color: "var(--neon-cyan)" }}>LEADER CONTACT:</span> {selectedLeaderContact}</p>
              <p style={{ marginBottom: "0.5rem" }}><span style={{ color: "var(--neon-cyan)" }}>SUBMITTED:</span> {fmtDate(selectedTeam.createdAt)}</p>
              <p style={{ marginBottom: "0.5rem" }}>
                <span style={{ color: "var(--neon-cyan)" }}>TX ID:</span>{" "}
                <span style={{ color: "var(--neon-pink)", fontFamily: "monospace" }}>{selectedTeam.payment?.transactionId || "N/A"}</span>
              </p>
              {selectedTeam.registrationType === "hackathon" && (
                <div style={{ marginTop: "0.8rem", borderTop: "1px dashed var(--border-color)", paddingTop: "0.8rem" }}>
                  <p style={{ marginBottom: "0.45rem", color: "var(--neon-cyan)", fontWeight: "bold" }}>
                    TEAM ACCESS CREDENTIALS
                  </p>
                  {selectedAccessCredentials ? (
                    <>
                      <p style={{ marginBottom: "0.35rem" }}>
                        <span style={{ color: "var(--text-muted)" }}>TEAM ID:</span>{" "}
                        <span style={{ color: "var(--neon-pink)", fontFamily: "monospace" }}>{selectedAccessCredentials.teamId || "N/A"}</span>
                      </p>
                      <p style={{ marginBottom: "0.35rem" }}>
                        <span style={{ color: "var(--text-muted)" }}>PASSWORD:</span>{" "}
                        <span style={{ color: "var(--neon-pink)", fontFamily: "monospace" }}>
                          {selectedAccessCredentials.password || "NOT STORED (REGENERATE TO ISSUE NEW PASSWORD)"}
                        </span>
                      </p>
                      {selectedAccessCredentials.passwordVersion > 0 && (
                        <p style={{ marginBottom: "0.35rem" }}>
                          <span style={{ color: "var(--text-muted)" }}>PASSWORD VERSION:</span>{" "}
                          <span style={{ color: "var(--text-main)", fontFamily: "monospace" }}>{selectedAccessCredentials.passwordVersion}</span>
                        </p>
                      )}
                      <p style={{ marginBottom: "0.35rem" }}>
                        <span style={{ color: "var(--text-muted)" }}>LEADER EMAIL:</span>{" "}
                        <span style={{ color: "var(--text-main)", fontFamily: "monospace" }}>{selectedAccessCredentials.leaderEmail || "N/A"}</span>
                      </p>
                      {selectedTeam.status === "verified" && (
                        <button
                          onClick={handleRegenerateCredentials}
                          disabled={updateBusy}
                          className="btn"
                          style={{ marginTop: "0.35rem", marginBottom: "0.55rem", padding: "0.25rem 0.8rem", fontSize: "0.72rem" }}
                        >
                          {updateBusy ? "PROCESSING..." : "REGENERATE_CREDENTIALS()"}
                        </button>
                      )}
                      {credentialMailto && (
                        <a
                          href={credentialMailto}
                          style={{ color: "var(--neon-cyan)", textDecoration: "underline", fontSize: "0.82rem" }}
                        >
                          OPEN EMAIL DRAFT
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: "0.45rem" }}>
                        Credentials are auto-generated when payment is marked VERIFIED.
                      </p>
                      {selectedTeam.status === "verified" && (
                        <button
                          onClick={handleRegenerateCredentials}
                          disabled={updateBusy}
                          className="btn"
                          style={{ padding: "0.25rem 0.8rem", fontSize: "0.72rem" }}
                        >
                          {updateBusy ? "PROCESSING..." : "ISSUE_CREDENTIALS()"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
              {selectedTeam.payment?.screenshotUrl && (
                <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                  <span style={{ color: "var(--neon-cyan)" }}>SCREENSHOT:</span>
                  <button
                    onClick={() => openScreenshotPreview(
                      selectedTeam.payment.screenshotUrl,
                      `${selectedTeam.teamName?.toUpperCase() || "REGISTRATION"} SCREENSHOT`
                    )}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--neon-pink)",
                      color: "var(--neon-pink)",
                      padding: "2px 8px",
                      cursor: "pointer",
                      fontFamily: "monospace",
                      fontSize: "0.75rem",
                    }}
                  >
                    PREVIEW IMAGE
                  </button>
                </div>
              )}
            </div>

            {/* Participants */}
            <h3 style={{ color: "var(--neon-pink)", fontSize: "1.2rem", marginBottom: "1rem", borderBottom: "1px solid var(--text-muted)", paddingBottom: "0.5rem" }}>
              [ PARTICIPANTS ]
            </h3>
            {selectedTeam.participants?.length > 0 ? selectedTeam.participants.map((p, idx) => (
              <div key={idx} style={{
                marginBottom: "1rem", paddingLeft: "1rem",
                borderLeft: `3px solid ${idx === 0 ? "var(--neon-cyan)" : "var(--text-muted)"}`
              }}>
                <p style={{ color: idx === 0 ? "var(--neon-cyan)" : "var(--text-muted)", fontWeight: "bold", marginBottom: "0.3rem" }}>
                  {idx === 0 ? "LEADER" : `PARTICIPANT ${idx + 1}`}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem 1rem", fontSize: "0.9rem" }}>
                  <p><span style={{ color: "var(--text-muted)" }}>NAME:</span> {p.name}</p>
                  <p><span style={{ color: "var(--text-muted)" }}>ROLL:</span> {p.roll}</p>
                  <p><span style={{ color: "var(--text-muted)" }}>EMAIL:</span> {p.email}</p>
                  <p><span style={{ color: "var(--text-muted)" }}>PHONE:</span> {p.phone}</p>
                </div>
              </div>
            )) : (
              <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>NO PARTICIPANTS AVAILABLE</p>
            )}

            {/* Notes */}
            <div style={{ marginTop: "1.5rem" }}>
              <h3 style={{ color: "var(--neon-cyan)", fontSize: "1rem", marginBottom: "0.5rem" }}>[ ADMIN NOTES ]</h3>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add notes about this team..."
                rows={3}
                style={{
                  width: "100%", padding: "0.7rem", background: "var(--bg-dark)",
                  border: "1px solid var(--border-color)", color: "var(--text-main)",
                  fontFamily: "monospace", fontSize: "0.85rem", resize: "vertical"
                }}
              />
              <button
                onClick={handleSaveNotes}
                disabled={updateBusy}
                className="btn" style={{ marginTop: "0.5rem", padding: "0.3rem 1rem", fontSize: "0.8rem" }}
              >
                SAVE_NOTES()
              </button>
              {actionError && (
                <p style={{ color: "var(--danger-red)", marginTop: "0.5rem", fontSize: "0.8rem", fontFamily: "monospace" }}>
                  UPDATE_ERROR: {actionError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {previewScreenshot.url && (
        <div
          onClick={closeScreenshotPreview}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 400,
            padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="cyber-card"
            style={{
              width: "min(95vw, 980px)",
              maxHeight: "90vh",
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.8rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ color: "var(--neon-cyan)", fontFamily: "var(--font-heading)", fontSize: "1rem", margin: 0 }}>
                {previewScreenshot.label}
              </h3>
              <button
                onClick={closeScreenshotPreview}
                style={{
                  background: "none",
                  border: "2px solid var(--danger-red)",
                  color: "var(--danger-red)",
                  padding: "0.2rem 0.7rem",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "0.9rem",
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ overflow: "auto", maxHeight: "80vh", border: "1px solid var(--border-color)" }}>
              <img
                src={previewScreenshot.url}
                alt="Payment screenshot preview"
                style={{ display: "block", width: "100%", height: "auto", objectFit: "contain" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
