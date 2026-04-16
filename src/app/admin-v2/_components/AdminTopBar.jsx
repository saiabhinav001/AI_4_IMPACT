import { Download, FileSpreadsheet, LogOut, Settings2, ShieldCheck, UserPlus } from "lucide-react";
import styles from "../admin-v2.module.css";

export default function AdminTopBar({
  userEmail,
  activeTrackLabel,
  apiRuntimeAvailable,
  credentialSheetUrl,
  onOpenAddTeam,
  onOpenEventControls,
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
          <button
            type="button"
            className={styles.btnPrimary}
            title={
              apiRuntimeAvailable
                ? "Add a team registration manually"
                : "Team creation is unavailable in Firestore fallback mode"
            }
            onClick={onOpenAddTeam}
            disabled={!apiRuntimeAvailable}
          >
            <UserPlus size={14} aria-hidden="true" />
            Add Team
          </button>

          <button
            type="button"
            className={styles.btnPrimary}
            title={
              apiRuntimeAvailable
                ? "Open event controls workspace"
                : "Event controls are unavailable in Firestore fallback mode"
            }
            onClick={onOpenEventControls}
            disabled={!apiRuntimeAvailable}
          >
            <Settings2 size={14} aria-hidden="true" />
            Event Controls
          </button>

          {credentialSheetUrl ? (
            <a
              href={credentialSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.btnSecondary} ${styles.actionLinkButton}`.trim()}
              title="Open Google Sheet for credential verification"
            >
              <FileSpreadsheet size={14} aria-hidden="true" />
              Open Credential Sheet
            </a>
          ) : (
            <button
              type="button"
              className={styles.btnSecondary}
              title="Credential sheet link is not configured in runtime settings"
              disabled
            >
              <FileSpreadsheet size={14} aria-hidden="true" />
              Sheet Link Unavailable
            </button>
          )}

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
