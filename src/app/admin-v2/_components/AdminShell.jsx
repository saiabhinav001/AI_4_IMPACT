import styles from "../admin-v2.module.css";

export default function AdminShell({ className = "", children }) {
  return (
    <div className={`${styles.root} ${className}`.trim()}>
      <div className={styles.backgroundLayer} aria-hidden="true" />
      <div className={styles.backgroundGlow} aria-hidden="true" />
      <div className={styles.appShell}>{children}</div>
    </div>
  );
}
