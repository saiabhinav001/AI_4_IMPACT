import { motion } from "framer-motion";
import styles from "../admin-v2.module.css";

export default function TrackToggle({ value, options, onChange, isSwitching = false }) {
  return (
    <div className={styles.trackToggle} role="tablist" aria-label="Registration track selector">
      {options.map((option) => {
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${styles.trackButton} ${isActive ? styles.trackButtonActive : ""}`.trim()}
            onClick={() => onChange(option.value)}
          >
            {isActive ? (
              <motion.span
                layoutId="admin-track-active-pill"
                className={styles.trackButtonActiveBg}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                aria-hidden="true"
              />
            ) : null}

            {isActive && isSwitching ? (
              <motion.span
                key={`track-sheen-${option.value}`}
                className={styles.trackButtonSheen}
                initial={{ x: "-125%", opacity: 0 }}
                animate={{ x: "120%", opacity: [0, 0.36, 0] }}
                transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                aria-hidden="true"
              />
            ) : null}

            <span className={styles.trackButtonText}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
