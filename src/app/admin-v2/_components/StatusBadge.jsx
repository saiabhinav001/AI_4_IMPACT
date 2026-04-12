import { getStatusMeta } from "../_lib/adminData";
import styles from "../admin-v2.module.css";

export default function StatusBadge({ status }) {
  const meta = getStatusMeta(status);

  return (
    <span
      className={styles.statusBadge}
      style={{
        "--status-color": meta.color,
        "--status-bg": meta.bg,
        "--status-border": meta.border,
      }}
    >
      {meta.label}
    </span>
  );
}
