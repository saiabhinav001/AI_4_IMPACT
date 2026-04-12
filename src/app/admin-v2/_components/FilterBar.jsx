import { SlidersHorizontal } from "lucide-react";
import TrackToggle from "./TrackToggle";
import SearchInput from "./SearchInput";
import SelectField from "./SelectField";
import styles from "../admin-v2.module.css";

export default function FilterBar({
  filterTrack,
  trackOptions,
  onTrackChange,
  trackSwitching,
  searchTerm,
  onSearchChange,
  filterSize,
  sizeOptions,
  onSizeChange,
  filterCollege,
  collegeList,
  onCollegeChange,
  filterEmailState,
  onEmailStateChange,
}) {
  return (
    <section className={styles.filterBar} aria-label="Table filters">
      <div className={styles.filterTopRow}>
        <div className={styles.filterHeading}>
          <SlidersHorizontal size={14} className={styles.filterHeadingIcon} aria-hidden="true" />
          <p className={styles.filterHeadingText}>Filter stack</p>
        </div>
        <TrackToggle
          value={filterTrack}
          options={trackOptions}
          onChange={onTrackChange}
          isSwitching={trackSwitching}
        />
      </div>

      <div className={styles.filterGrid}>
        <SearchInput value={searchTerm} onChange={onSearchChange} />

        <SelectField
          label="Team size"
          ariaLabel="Team size"
          value={filterSize}
          onChange={onSizeChange}
          options={sizeOptions}
        />

        <SelectField
          label="College"
          ariaLabel="College"
          value={filterCollege}
          onChange={onCollegeChange}
          options={[
            { value: "all", label: "All colleges" },
            ...collegeList.map((collegeName) => ({
              value: collegeName,
              label: collegeName,
            })),
          ]}
        />

        <SelectField
          label="Email state"
          ariaLabel="Email state"
          value={filterEmailState}
          onChange={onEmailStateChange}
          options={[
            { value: "all", label: "All email states" },
            { value: "unsent", label: "Unsent" },
            { value: "inflight", label: "Queued or sending" },
            { value: "failed", label: "Failed" },
            { value: "sent", label: "Sent" },
            { value: "not-ready", label: "Not ready" },
          ]}
        />
      </div>
    </section>
  );
}
