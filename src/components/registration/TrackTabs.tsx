"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RegistrationTrack } from "./styles";
import { portalStyles } from "./styles";

interface TrackTabsProps {
  activeTrack: RegistrationTrack;
  onTrackChange: (track: RegistrationTrack) => void;
  workshopPanel: ReactNode;
  hackathonPanel: ReactNode;
}

export default function TrackTabs({
  activeTrack,
  onTrackChange,
  workshopPanel,
  hackathonPanel,
}: TrackTabsProps) {
  return (
    <div>
      <div
        role="tablist"
        aria-label="Registration track"
        className="grid grid-cols-2 border-b border-[rgba(141,54,213,0.28)]"
      >
        {(["workshop", "hackathon"] as const).map((track) => {
          const isActive = activeTrack === track;

          return (
            <button
              key={track}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTrackChange(track)}
              className={[
                "relative px-5 py-[18px] text-center font-[var(--font-syne)] text-[13px] font-semibold uppercase tracking-[0.08em] transition-all duration-300",
                isActive
                  ? "text-[#EDE8F5]"
                  : "text-[rgba(237,232,245,0.45)] hover:bg-[rgba(141,54,213,0.06)] hover:text-[rgba(237,232,245,0.7)]",
              ].join(" ")}
            >
              {track === "workshop" ? "Workshop" : "Hackathon"}
              <span
                className={[
                  "pointer-events-none absolute bottom-0 left-1/2 h-[2px] bg-[linear-gradient(90deg,#46067A,#8D36D5)] transition-all duration-300",
                  isActive ? "w-full -translate-x-1/2" : "w-0 -translate-x-1/2",
                ].join(" ")}
                style={isActive ? portalStyles.tabIndicatorGlow : undefined}
              />
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTrack}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          className="will-change-transform"
        >
          {activeTrack === "workshop" ? workshopPanel : hackathonPanel}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
