/* eslint-disable @next/next/no-img-element */
import { X } from "lucide-react";
import { motion } from "framer-motion";
import styles from "../admin-v2.module.css";

export default function ScreenshotPreviewModal({ previewScreenshot, onClose }) {
  if (!previewScreenshot?.url) return null;

  return (
    <motion.div
      className={styles.previewOverlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot preview"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.section
        className={styles.previewModal}
        onClick={(event) => event.stopPropagation()}
        initial={{ y: 16, opacity: 0.96 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0.96 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className={styles.previewHeader}>
          <h3 className={styles.previewTitle}>{previewScreenshot.label || "Payment screenshot"}</h3>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close preview">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.previewImageWrap}>
          <img
            src={previewScreenshot.url}
            alt="Payment screenshot"
            className={styles.previewImage}
          />
        </div>
      </motion.section>
    </motion.div>
  );
}
