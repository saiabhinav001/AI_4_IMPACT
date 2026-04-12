import styles from "../admin-v2.module.css";

export default function EmptyState({ title, message }) {
  return (
    <div className={styles.emptyState} role="status">
      <h3 className={styles.emptyStateTitle}>{title}</h3>
      <p className={styles.emptyStateText}>{message}</p>
    </div>
  );
}
