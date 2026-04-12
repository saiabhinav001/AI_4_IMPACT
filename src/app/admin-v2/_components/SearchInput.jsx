import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import styles from "../admin-v2.module.css";

export default function SearchInput({ value, onChange }) {
  const inputRef = useRef(null);

  useEffect(() => {
    const handleSlashShortcut = (event) => {
      if (event.defaultPrevented) return;
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        const isEditableTarget =
          target.isContentEditable ||
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.getAttribute("role") === "textbox";

        if (isEditableTarget) return;
      }

      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };

    window.addEventListener("keydown", handleSlashShortcut);
    return () => {
      window.removeEventListener("keydown", handleSlashShortcut);
    };
  }, []);

  return (
    <label className={styles.searchField}>
      <span className={styles.fieldLabel}>Search registrations</span>
      <div className={styles.searchInputWrap}>
        <Search size={14} className={styles.searchIcon} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={styles.textInput}
          placeholder="Team, leader, contact, college or transaction"
        />
        <span className={styles.searchHint} title="Press / to focus">
          /
        </span>
      </div>
    </label>
  );
}
