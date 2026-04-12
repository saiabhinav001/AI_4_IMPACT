import styles from "../admin-v2.module.css";

export default function ResultsMeta({
  paginatedCount,
  filteredCount,
  currentPage,
  totalPages,
  bulkSendBusy,
  bulkSendCandidateCount,
  apiRuntimeAvailable,
  bulkActionMessage,
  onBulkSend,
}) {
  const bulkDisabled = bulkSendBusy || bulkSendCandidateCount === 0 || !apiRuntimeAvailable;

  return (
    <section className={styles.resultsMeta} aria-label="Result metadata and bulk actions">
      <p className={styles.resultsMetaText}>
        Showing {paginatedCount} of {filteredCount} results. Page {currentPage} of {totalPages}.
      </p>

      <div className={styles.resultsMetaPills}>
        <span className={styles.metaPill}>Visible: {paginatedCount}</span>
        <span className={styles.metaPill}>Matched: {filteredCount}</span>
      </div>

      <div className={styles.resultsMetaActions}>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={bulkDisabled}
          onClick={onBulkSend}
        >
          {bulkSendBusy ? "Bulk sending..." : `Bulk send unsent (${bulkSendCandidateCount})`}
        </button>
      </div>

      {bulkActionMessage ? <p className={styles.bulkMessage}>{bulkActionMessage}</p> : null}
    </section>
  );
}
