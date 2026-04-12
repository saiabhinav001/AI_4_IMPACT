import {
  Activity,
  BarChart3,
  Building2,
  Download,
  Gauge,
  LogOut,
  Mail,
  ShieldCheck,
  Table2,
  Users,
} from "lucide-react";
import styles from "../admin-v2.module.css";

function RailMetric({ icon: Icon, label, value, tone = "default" }) {
  const toneClass =
    tone === "accent"
      ? styles.railMetricAccent
      : tone === "success"
        ? styles.railMetricSuccess
        : tone === "warning"
          ? styles.railMetricWarning
          : styles.railMetricDefault;

  return (
    <article className={`${styles.railMetric} ${toneClass}`.trim()}>
      <div className={styles.railMetricHead}>
        <Icon size={14} className={styles.railNavIcon} aria-hidden="true" />
        <p className={styles.railMetricLabel}>{label}</p>
      </div>
      <p className={styles.railMetricValue}>{value}</p>
    </article>
  );
}

export default function OperationsRail({
  userEmail,
  activeTrackLabel,
  activeTab,
  onChangeTab,
  stats,
  filterTrack,
  onExportCSV,
  onLogout,
}) {
  const railMetrics = [
    {
      icon: Activity,
      label: "Registrations",
      value: stats.totalRegs,
      tone: "accent",
    },
    {
      icon: Users,
      label: "Participants",
      value: stats.totalParticipants,
      tone: "success",
    },
    {
      icon: Building2,
      label: "Colleges",
      value: stats.colleges,
      tone: "default",
    },
    ...(filterTrack === "hackathon"
      ? [
          {
            icon: Mail,
            label: "Unsent emails",
            value: stats.unsentCredentialEmails,
            tone: "warning",
          },
        ]
      : []),
  ];

  return (
    <aside className={styles.operationsRail}>
      <div className={styles.railBrand}>
        <div className={styles.railBrandTop}>
          <ShieldCheck size={14} className={styles.railNavIcon} aria-hidden="true" />
          <p className={styles.railLabel}>Operations workspace</p>
        </div>
        <h2 className={styles.railTitle}>Admin Command Center</h2>
        <p className={styles.railSubTitle}>
          Active track: <span className={styles.railTrackBadge}>{activeTrackLabel}</span>
        </p>
        <p className={styles.operatorEmail} title={userEmail || ""}>{userEmail || "-"}</p>
      </div>

      <div className={styles.railNav} role="tablist" aria-label="Primary admin views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "table"}
          className={`${styles.railNavButton} ${
            activeTab === "table" ? styles.railNavButtonActive : ""
          }`.trim()}
          onClick={() => onChangeTab("table")}
        >
          <span className={styles.railNavButtonContent}>
            <Table2 size={14} className={styles.railNavIcon} aria-hidden="true" />
            Registration queue
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "analytics"}
          className={`${styles.railNavButton} ${
            activeTab === "analytics" ? styles.railNavButtonActive : ""
          }`.trim()}
          onClick={() => onChangeTab("analytics")}
        >
          <span className={styles.railNavButtonContent}>
            <BarChart3 size={14} className={styles.railNavIcon} aria-hidden="true" />
            Intelligence analytics
          </span>
        </button>
      </div>

      <div className={styles.railMetrics}>
        {railMetrics.map((metric) => (
          <RailMetric
            key={metric.label}
            icon={metric.icon}
            label={metric.label}
            value={metric.value}
            tone={metric.tone}
          />
        ))}

        <RailMetric icon={Gauge} label="Polling" value="15 sec" tone="default" />
      </div>

      <div className={styles.railActions}>
        <button type="button" className={styles.btnSecondary} onClick={onExportCSV}>
          <Download size={14} aria-hidden="true" />
          Export CSV
        </button>

        <button type="button" className={styles.btnGhost} onClick={onLogout}>
          <LogOut size={14} aria-hidden="true" />
          Logout
        </button>
      </div>
    </aside>
  );
}
