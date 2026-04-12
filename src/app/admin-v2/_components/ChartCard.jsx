import styles from "../admin-v2.module.css";

export default function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <article className={`${styles.chartCard} ${className}`.trim()}>
      <div className={styles.chartCardHeader}>
        <h3 className={styles.chartCardTitle}>{title}</h3>
        {subtitle ? <p className={styles.chartCardSubtitle}>{subtitle}</p> : null}
      </div>
      <div className={styles.chartCardBody}>{children}</div>
    </article>
  );
}
