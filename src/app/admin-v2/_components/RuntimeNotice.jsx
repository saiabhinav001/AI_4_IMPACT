import styles from "../admin-v2.module.css";

export default function RuntimeNotice({ tone = "warning", title, message }) {
  if (!message) return null;

  const toneClass =
    tone === "danger"
      ? styles.noticeDanger
      : tone === "success"
        ? styles.noticeSuccess
        : styles.noticeWarning;

  return (
    <section className={`${styles.notice} ${toneClass}`} role="status" aria-live="polite">
      {title ? <p className={styles.noticeTitle}>{title}</p> : null}
      <p className={styles.noticeText}>{message}</p>
    </section>
  );
}
