import styles from "../admin-v2.module.css";

export default function LoadingState({ message = "Loading admin workspace..." }) {
  return (
    <div className={styles.loadingState} role="status" aria-live="polite">
      <div className={styles.loadingSpinner} aria-hidden="true" />
      <p className={styles.loadingMessage}>{message}</p>
    </div>
  );
}
