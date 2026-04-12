import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import styles from "../admin-v2.module.css";

export default function SelectField({ label, value, options, onChange, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const controlRef = useRef(null);
  const optionRefs = useRef([]);
  const listboxId = useId();

  const normalizedOptions = useMemo(() => {
    return Array.isArray(options) ? options : [];
  }, [options]);

  const selectedIndex = useMemo(() => {
    return normalizedOptions.findIndex((option) => option.value === value);
  }, [normalizedOptions, value]);

  const selectedLabel =
    selectedIndex >= 0 ? normalizedOptions[selectedIndex].label : normalizedOptions[0]?.label || "-";

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  const openMenu = useCallback(() => {
    setOpen(true);
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [selectedIndex]);

  const commitSelection = useCallback(
    (index) => {
      const option = normalizedOptions[index];
      if (!option) return;
      onChange(option.value);
      setOpen(false);
    },
    [normalizedOptions, onChange]
  );

  useEffect(() => {
    if (!open) return;

    const handleOutsidePointer = (event) => {
      if (!controlRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handleOutsidePointer);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handleOutsidePointer);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open]);

  return (
    <label className={styles.selectField}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.selectControl} ref={controlRef}>
        <button
          type="button"
          className={`${styles.selectTrigger} ${open ? styles.selectTriggerOpen : ""}`.trim()}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel || label}
          aria-controls={listboxId}
          onClick={() => {
            if (open) {
              closeMenu();
            } else {
              openMenu();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!open) {
                openMenu();
                return;
              }
              setHighlightedIndex((previous) =>
                Math.min(normalizedOptions.length - 1, previous + 1)
              );
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              if (!open) {
                openMenu();
                return;
              }
              setHighlightedIndex((previous) => Math.max(0, previous - 1));
              return;
            }

            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (!open) {
                openMenu();
                return;
              }
              commitSelection(highlightedIndex);
            }
          }}
        >
          <span className={styles.selectValue}>{selectedLabel}</span>
          <ChevronDown
            size={14}
            className={`${styles.selectChevron} ${open ? styles.selectChevronOpen : ""}`.trim()}
            aria-hidden="true"
          />
        </button>

        <AnimatePresence>
          {open ? (
            <motion.ul
              id={listboxId}
              role="listbox"
              className={styles.selectMenu}
              initial={{ opacity: 0, y: 6, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.985 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              {normalizedOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = highlightedIndex === index;

                return (
                  <li key={option.value} role="presentation">
                    <button
                      ref={(node) => {
                        optionRefs.current[index] = node;
                      }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`${styles.selectOption} ${
                        isSelected ? styles.selectOptionSelected : ""
                      } ${isHighlighted ? styles.selectOptionActive : ""}`.trim()}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => commitSelection(index)}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </div>
    </label>
  );
}
