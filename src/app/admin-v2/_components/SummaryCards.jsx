import { Activity, Building2, Mail, User, Users } from "lucide-react";
import styles from "../admin-v2.module.css";

function SummaryCard({ icon: Icon, label, value, helper, tone = "default" }) {
  const toneClass =
    tone === "accent"
      ? styles.summaryCardAccent
      : tone === "warning"
        ? styles.summaryCardWarning
        : tone === "success"
          ? styles.summaryCardSuccess
          : styles.summaryCardDefault;

  return (
    <article className={`${styles.summaryCard} ${toneClass}`.trim()}>
      <div className={styles.summaryHeader}>
        <Icon size={15} className={styles.summaryIcon} aria-hidden="true" />
        <p className={styles.summaryLabel}>{label}</p>
      </div>
      <p className={styles.summaryValue}>{value}</p>
      <p className={styles.summaryHelper}>{helper}</p>
    </article>
  );
}

export default function SummaryCards({ stats, filterTrack }) {
  const cards = [
    {
      icon: Activity,
      label: "Total registrations",
      value: stats.totalRegs,
      helper: "Submission records",
      tone: "accent",
    },
    {
      icon: Users,
      label: "Total participants",
      value: stats.totalParticipants,
      helper: "Member-level count",
      tone: "success",
    },
    {
      icon: Building2,
      label: "Unique colleges",
      value: stats.colleges,
      helper: "Institution spread",
      tone: "default",
    },
    ...(filterTrack === "workshop"
      ? [
          {
            icon: User,
            label: "Individual entries",
            value: stats.teamsOf1,
            helper: "Workshop registrations",
            tone: "default",
          },
        ]
      : [
          {
            icon: Users,
            label: "Teams of 2",
            value: stats.teamsOf2,
            helper: "Hackathon grouping",
            tone: "default",
          },
          {
            icon: Users,
            label: "Teams of 3",
            value: stats.teamsOf3,
            helper: "Hackathon grouping",
            tone: "default",
          },
          {
            icon: Users,
            label: "Teams of 4",
            value: stats.teamsOf4,
            helper: "Hackathon grouping",
            tone: "default",
          },
          {
            icon: Mail,
            label: "Unsent emails",
            value: stats.unsentCredentialEmails,
            helper: "Credential dispatch queue",
            tone: "warning",
          },
        ]),
  ];

  return (
    <section className={styles.summaryGrid} aria-label="Registration summary">
      {cards.map((card) => (
        <SummaryCard
          key={card.label}
          icon={card.icon}
          label={card.label}
          value={card.value}
          helper={card.helper}
          tone={card.tone}
        />
      ))}
    </section>
  );
}
