import { getEmailStateMeta } from "../_lib/adminData";
import styles from "../admin-v2.module.css";

export default function EmailStateBadge({ emailDelivery }) {
  const meta = getEmailStateMeta(emailDelivery);

  return (
    <span
      className={styles.emailBadge}
      style={{
        "--email-color": meta.color,
        "--email-bg": meta.bg,
      }}
    >
      {meta.label}
    </span>
  );
}
