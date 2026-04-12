import EmptyState from "./EmptyState";
import RegistrationRow from "./RegistrationRow";
import { PAGE_SIZE } from "../_lib/adminData";
import styles from "../admin-v2.module.css";

const TABLE_COLUMNS = [
  {
    header: "#",
    colClassName: "colIndex",
    thClassName: "thCenter",
  },
  {
    header: "Team",
    colClassName: "colTeam",
  },
  {
    header: "Track",
    colClassName: "colTrack",
    thClassName: "thCenter",
  },
  {
    header: "Leader",
    colClassName: "colLeader",
  },
  {
    header: "Contact",
    colClassName: "colContact",
  },
  {
    header: "College",
    colClassName: "colCollege",
  },
  {
    header: "Size",
    colClassName: "colSize",
    thClassName: "thCenter",
  },
  {
    header: "Transaction ID",
    colClassName: "colTransaction",
  },
  {
    header: "Status",
    colClassName: "colStatus",
    thClassName: "thCenter",
  },
  {
    header: "Email",
    colClassName: "colEmail",
    thClassName: "thCenter",
  },
  {
    header: "Action",
    colClassName: "colAction",
    thClassName: "thCenter",
  },
  {
    header: "Delete",
    colClassName: "colDelete",
    thClassName: "thCenter",
  },
  {
    header: "Screenshot",
    colClassName: "colScreenshot",
    thClassName: "thCenter",
  },
  {
    header: "Submitted",
    colClassName: "colSubmitted",
    thClassName: "thRight",
  },
];

export default function RegistrationsTable({
  rows,
  currentPage,
  totalPages,
  onPageChange,
  formatDateTime,
  isDupName,
  isDupTx,
  onSelectTeam,
  onSendCredentialEmail,
  emailActionBusyId,
  deleteActionBusyId,
  bulkSendBusy,
  apiRuntimeAvailable,
  onDeleteRegistration,
  onOpenScreenshotPreview,
}) {
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    Math.max(0, currentPage - 3),
    Math.min(totalPages, currentPage + 2)
  );

  return (
    <section className={styles.tableSurface} aria-label="Registrations table">
      <header className={styles.tableHeaderBar}>
        <div>
          <h2 className={styles.tableHeaderTitle}>Registration queue</h2>
          <p className={styles.tableHeaderMeta}>
            Select a row to open the detailed review drawer.
          </p>
        </div>
        <span className={styles.tableHeaderBadge}>{rows.length} visible rows</span>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup>
            {TABLE_COLUMNS.map((column) => (
              <col key={column.header} className={styles[column.colClassName]} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {TABLE_COLUMNS.map((column) => (
                <th
                  key={column.header}
                  className={column.thClassName ? styles[column.thClassName] : ""}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length > 0 ? (
              rows.map((registration, index) => (
                <RegistrationRow
                  key={registration.id}
                  registration={registration}
                  rowNumber={(currentPage - 1) * PAGE_SIZE + index + 1}
                  isDuplicateName={isDupName(registration.teamName)}
                  isDuplicateTransaction={isDupTx(registration.payment?.transactionId)}
                  formatDateTime={formatDateTime}
                  onSelect={onSelectTeam}
                  onSendCredentialEmail={onSendCredentialEmail}
                  emailActionBusyId={emailActionBusyId}
                  deleteActionBusyId={deleteActionBusyId}
                  bulkSendBusy={bulkSendBusy}
                  apiRuntimeAvailable={apiRuntimeAvailable}
                  onDeleteRegistration={onDeleteRegistration}
                  onOpenScreenshotPreview={onOpenScreenshotPreview}
                />
              ))
            ) : (
              <tr className={styles.emptyTableRow}>
                <td colSpan={14}>
                  <EmptyState
                    title="No results found"
                    message="Adjust the search or filters to inspect registrations."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <nav className={styles.pagination} aria-label="Table pagination">
          <button
            type="button"
            className={styles.paginationButton}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>

          {pageNumbers.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={`${styles.paginationButton} ${
                pageNumber === currentPage ? styles.paginationButtonActive : ""
              }`.trim()}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}

          <button
            type="button"
            className={styles.paginationButton}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </nav>
      ) : null}
    </section>
  );
}
