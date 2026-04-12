import { useMemo } from "react";
import { FileText, ImageIcon, ShieldCheck, Users, X } from "lucide-react";
import { motion } from "framer-motion";
import EmailStateBadge from "./EmailStateBadge";
import StatusBadge from "./StatusBadge";
import { getLeaderContact, getLeaderName } from "../_lib/adminData";
import styles from "../admin-v2.module.css";

function DetailField({ label, value, mono = false, copyable = false }) {
  const copyValue = async () => {
    if (!copyable || !value || value === "-") return;

    try {
      await navigator.clipboard.writeText(String(value));
    } catch {
      // Clipboard may be unavailable in some browser contexts.
    }
  };

  return (
    <div className={styles.detailField}>
      <p className={styles.detailLabel}>{label}</p>
      <div className={styles.detailValueRow}>
        <p className={`${styles.detailValue} ${mono ? styles.detailValueMono : ""}`.trim()}>
          {value || "-"}
        </p>
        {copyable ? (
          <button type="button" className={styles.copyButton} onClick={copyValue}>
            Copy
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <section className={styles.drawerSection}>
      <h3 className={styles.drawerSectionTitle}>
        {Icon ? <Icon size={13} className={styles.railNavIcon} aria-hidden="true" /> : null}
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function DetailDrawer({
  team,
  noteText,
  onNoteChange,
  onClose,
  onStatusToggle,
  onRegenerateCredentials,
  onSendCredentialEmail,
  onSaveNotes,
  onOpenScreenshotPreview,
  formatDateTime,
  actionError,
  updateBusy,
  emailActionBusyId,
  bulkSendBusy,
  selectedCanSendCredentialEmail,
  selectedShouldForceResend,
  selectedEmailDelivery,
}) {
  const leaderName = useMemo(() => getLeaderName(team), [team]);
  const leaderContact = useMemo(() => getLeaderContact(team), [team]);
  const isSending = emailActionBusyId === team?.id;

  if (!team) return null;

  return (
    <motion.div
      className={styles.drawerOverlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Registration details"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.aside
        className={styles.detailDrawer}
        onClick={(event) => event.stopPropagation()}
        initial={{ x: 48, opacity: 0.96 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 56, opacity: 0.96 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className={styles.drawerHeader}>
          <div>
            <p className={styles.drawerTrack}>{String(team.registrationType || "").toUpperCase()}</p>
            <h2 className={styles.drawerTitle}>{team.teamName || "Unknown team"}</h2>
            <p className={styles.drawerSubTitle}>{team.collegeName || "-"}</p>
          </div>

          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close details">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.drawerBody}>
          <Section title="Registration summary" icon={ShieldCheck}>
            <div className={styles.badgeRow}>
              <StatusBadge status={team.status} />
              {team.registrationType === "hackathon" ? (
                <EmailStateBadge emailDelivery={team.emailDelivery} />
              ) : null}
            </div>

            <div className={styles.detailGrid}>
              <DetailField label="Registration type" value={team.registrationType} />
              <DetailField label="Team size" value={team.teamSize} />
              <DetailField label="State" value={team.state || "N/A"} />
              <DetailField label="Submitted" value={formatDateTime(team.createdAt)} mono />
              <DetailField label="Leader" value={leaderName} />
              <DetailField label="Contact" value={leaderContact} mono />
              <DetailField
                label="Transaction ID"
                value={team.payment?.transactionId || "N/A"}
                mono
                copyable
              />
              <DetailField
                label="Registration ref"
                value={team.registrationRefId || "N/A"}
                mono
                copyable
              />
            </div>

            {team.payment?.screenshotUrl ? (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  onOpenScreenshotPreview(
                    team.payment.screenshotUrl,
                    `${team.teamName || "Registration"} screenshot`
                  );
                }}
              >
                <ImageIcon size={14} aria-hidden="true" />
                Preview screenshot
              </button>
            ) : null}
          </Section>

          <Section title="Admin actions" icon={ShieldCheck}>
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={updateBusy}
                onClick={() => {
                  void onStatusToggle();
                }}
              >
                {updateBusy
                  ? "Updating status..."
                  : team.status === "verified"
                    ? "Mark as rejected"
                    : "Mark as verified"}
              </button>

              {team.registrationType === "hackathon" ? (
                <button
                  type="button"
                  className={styles.btnSecondary}
                  disabled={updateBusy || team.status !== "verified"}
                  onClick={() => {
                    void onRegenerateCredentials();
                  }}
                >
                  {updateBusy ? "Processing..." : "Regenerate credentials"}
                </button>
              ) : null}

              {team.registrationType === "hackathon" && selectedCanSendCredentialEmail ? (
                <button
                  type="button"
                  className={styles.btnSecondary}
                  disabled={isSending || bulkSendBusy}
                  onClick={() => {
                    void onSendCredentialEmail(team, { force: selectedShouldForceResend });
                  }}
                >
                  {isSending
                    ? "Sending..."
                    : selectedShouldForceResend
                      ? "Resend credential email"
                      : "Send credential email"}
                </button>
              ) : null}
            </div>

            {team.registrationType === "hackathon" ? (
              <div className={styles.credentialPanel}>
                <div className={styles.detailGrid}>
                  <DetailField
                    label="Team ID"
                    value={team.accessCredentials?.teamId || "N/A"}
                    mono
                    copyable
                  />
                  <DetailField
                    label="Leader email"
                    value={team.accessCredentials?.leaderEmail || "N/A"}
                    mono
                    copyable
                  />
                  <DetailField
                    label="Leader phone"
                    value={team.accessCredentials?.leaderPhone || "N/A"}
                    mono
                    copyable
                  />
                  <DetailField
                    label="Password version"
                    value={
                      team.accessCredentials?.passwordVersion
                        ? String(team.accessCredentials.passwordVersion)
                        : "N/A"
                    }
                    mono
                  />
                </div>

                <div className={styles.detailGrid}>
                  <DetailField
                    label="Email state"
                    value={team.emailDelivery?.state || "UNSENT"}
                    mono
                  />
                  <DetailField
                    label="Queue requested"
                    value={selectedEmailDelivery?.requestedAt ? formatDateTime(selectedEmailDelivery.requestedAt) : "N/A"}
                    mono
                  />
                  <DetailField
                    label="Last sent"
                    value={selectedEmailDelivery?.sentAt ? formatDateTime(selectedEmailDelivery.sentAt) : "N/A"}
                    mono
                  />
                  <DetailField
                    label="Retry after"
                    value={
                      selectedEmailDelivery?.retryAfterSeconds > 0
                        ? `${selectedEmailDelivery.retryAfterSeconds} sec`
                        : "N/A"
                    }
                    mono
                  />
                </div>

                {selectedEmailDelivery?.error ? (
                  <p className={styles.inlineError}>{selectedEmailDelivery.error}</p>
                ) : null}
              </div>
            ) : null}

            {actionError ? <p className={styles.inlineError}>{actionError}</p> : null}
          </Section>

          <Section title="Participants" icon={Users}>
            {team.participants?.length ? (
              <div className={styles.participantList}>
                {team.participants.map((participant, index) => (
                  <article key={`${participant.email || participant.phone || index}-${index}`} className={styles.participantCard}>
                    <div className={styles.participantHeader}>
                      <p className={styles.participantRole}>{index === 0 ? "Leader" : `Participant ${index + 1}`}</p>
                      <p className={styles.participantName}>{participant.name || "Unknown"}</p>
                    </div>

                    <div className={styles.participantGrid}>
                      <DetailField label="Email" value={participant.email || "N/A"} mono />
                      <DetailField label="Phone" value={participant.phone || "N/A"} mono />
                      <DetailField label="Roll" value={participant.roll || "N/A"} mono />
                      <DetailField label="Branch" value={participant.branch || "N/A"} />
                      <DetailField label="Year" value={participant.yearOfStudy || "N/A"} />
                      <DetailField label="State" value={participant.state || team.state || "N/A"} />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyInline}>No participants available.</p>
            )}
          </Section>

          <Section title="Admin notes" icon={FileText}>
            <textarea
              value={noteText}
              onChange={(event) => onNoteChange(event.target.value)}
              className={styles.notesInput}
              rows={4}
              placeholder="Add notes for this registration"
            />
            <button
              type="button"
              className={styles.btnSecondary}
              disabled={updateBusy}
              onClick={() => {
                void onSaveNotes();
              }}
            >
              Save notes
            </button>
          </Section>
        </div>
      </motion.aside>
    </motion.div>
  );
}
