import { Download, LogOut, ShieldCheck } from "lucide-react";
import styles from "../admin-v2.module.css";

export default function AdminTopBar({
  userEmail,
  activeTrackLabel,
  apiRuntimeAvailable,
  onExportCSV,
  onLogout,
}) {
  return (
    <header className={styles.topBar}>
      <div className={styles.topBarLeft}>
        <p className={styles.productLabel}>
          <ShieldCheck size={14} className={styles.productLabelIcon} aria-hidden="true" />
          AI4Impact Operations
        </p>
        <h1 className={styles.topBarTitle}>Admin Intelligence Console</h1>
        <p className={styles.topBarSubtext}>
          Active track: <span className={styles.topBarTrack}>{activeTrackLabel}</span>
          <span className={styles.topBarDivider}>|</span>
          <span
            className={`${styles.topBarRuntime} ${
              apiRuntimeAvailable ? styles.topBarRuntimeLive : styles.topBarRuntimeFallback
            }`.trim()}
          >
            {apiRuntimeAvailable ? "API runtime online" : "Firestore fallback mode"}
          </span>
        </p>
      </div>

      <div className={styles.topBarRight}>
        <div className={styles.operatorChip} title={userEmail || ""}>
          <span className={styles.operatorLabel}>Signed in</span>
          <span className={styles.operatorEmail}>{userEmail || "-"}</span>
        </div>

        <div className={styles.topBarActionButtons}>
          <button type="button" className={styles.btnSecondary} onClick={onExportCSV}>
            <Download size={14} aria-hidden="true" />
            Export CSV
          </button>
          <button type="button" className={styles.btnGhost} onClick={onLogout}>
            <LogOut size={14} aria-hidden="true" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
