import ActionCell from "./ActionCell";
import EmailStateBadge from "./EmailStateBadge";
import StatusBadge from "./StatusBadge";
import { Trash2 } from "lucide-react";
import { getLeaderContact, getLeaderName } from "../_lib/adminData";
import styles from "../admin-v2.module.css";

export default function RegistrationRow({
  registration,
  rowNumber,
  isDuplicateName,
  isDuplicateTransaction,
  formatDateTime,
  onSelect,
  onSendCredentialEmail,
  emailActionBusyId,
  deleteActionBusyId,
  bulkSendBusy,
  apiRuntimeAvailable,
  onDeleteRegistration,
  onOpenScreenshotPreview,
}) {
  const leaderName = getLeaderName(registration);
  const leaderContact = getLeaderContact(registration);
  const isDuplicate = isDuplicateName || isDuplicateTransaction;
  const isDeleting = deleteActionBusyId === registration.id;
  const normalizedTrack = String(registration.registrationType || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const isHackathonTrack = normalizedTrack === "hackathon";
  const displayTrack =
    normalizedTrack === "workshop"
      ? "WORKSHOP"
      : isHackathonTrack
        ? "HACKATHON"
        : "UNKNOWN";

  return (
    <tr
      className={`${styles.tableRow} ${isDuplicate ? styles.tableRowDuplicate : ""}`.trim()}
      onClick={() => onSelect(registration)}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(registration);
        }
      }}
    >
      <td className={styles.cellIndex} data-label="#">
        <span className={styles.cellText}>{rowNumber}</span>
      </td>
      <td className={styles.cellTeam} data-label="Team">
        <span className={styles.teamCellContent}>
          <span className={styles.teamName}>{registration.teamName || "-"}</span>
          {isDuplicateName ? <span className={styles.dupTag}>Duplicate</span> : null}
        </span>
      </td>
      <td className={`${styles.cellCenter} ${styles.cellTrack}`.trim()} data-label="Track">
        <span
          className={`${styles.trackPill} ${
            isHackathonTrack
              ? styles.trackHackathon
              : styles.trackWorkshop
          }`.trim()}
        >
          {displayTrack}
        </span>
      </td>
      <td className={styles.cellLeader} title={leaderName} data-label="Leader">
        <span className={styles.cellText}>{leaderName}</span>
      </td>
      <td
        className={`${styles.cellMono} ${styles.cellContact}`.trim()}
        title={leaderContact}
        data-label="Contact"
      >
        <span className={styles.cellText}>{leaderContact}</span>
      </td>
      <td className={styles.cellEllipsis} title={registration.collegeName || "-"} data-label="College">
        <span className={styles.cellText}>{registration.collegeName || "-"}</span>
      </td>
      <td className={`${styles.cellCenter} ${styles.cellSize}`.trim()} data-label="Size">
        <span className={styles.cellText}>{registration.teamSize ?? "-"}</span>
      </td>
      <td className={`${styles.cellMono} ${styles.cellTransaction}`.trim()} data-label="Transaction ID">
        <span className={styles.transactionCellContent}>
          <span className={styles.cellText}>{registration.payment?.transactionId || "-"}</span>
          {isDuplicateTransaction ? <span className={styles.dupTag}>Duplicate</span> : null}
        </span>
      </td>
      <td className={styles.cellCenter} data-label="Status">
        <StatusBadge status={registration.status} />
      </td>
      <td className={styles.cellCenter} data-label="Email">
        <EmailStateBadge emailDelivery={registration.emailDelivery} />
      </td>
      <td className={styles.cellCenter} data-label="Action">
        <ActionCell
          registration={registration}
          onSendCredentialEmail={onSendCredentialEmail}
          emailActionBusyId={emailActionBusyId}
          bulkSendBusy={bulkSendBusy}
          apiRuntimeAvailable={apiRuntimeAvailable}
        />
      </td>
      <td className={styles.cellCenter} data-label="Delete">
        <button
          type="button"
          className={`${styles.deleteIconButton} ${
            isDeleting ? styles.deleteIconButtonBusy : ""
          }`.trim()}
          disabled={isDeleting || !apiRuntimeAvailable}
          title={
            apiRuntimeAvailable
              ? "Delete this registration"
              : "Deletion requires backend API runtime"
          }
          aria-label={isDeleting ? "Deleting registration" : "Delete registration"}
          onClick={(event) => {
            event.stopPropagation();
            onDeleteRegistration(registration);
          }}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </td>
      <td className={styles.cellCenter} data-label="Screenshot">
        {registration.payment?.screenshotUrl ? (
          <button
            type="button"
            className={styles.btnInline}
            onClick={(event) => {
              event.stopPropagation();
              onOpenScreenshotPreview(
                registration.payment.screenshotUrl,
                `${registration.teamName || "Registration"} screenshot`
              );
            }}
          >
            Preview
          </button>
        ) : (
          <span className={styles.mutedDash}>-</span>
        )}
      </td>
      <td className={`${styles.cellMono} ${styles.cellDate}`.trim()} data-label="Submitted">
        <span className={styles.cellText}>{formatDateTime(registration.createdAt)}</span>
      </td>
    </tr>
  );
}
