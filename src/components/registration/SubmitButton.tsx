"use client";

import { motion } from "framer-motion";
import { portalStyles } from "./styles";

interface SubmitButtonProps {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}

export default function SubmitButton({
  label,
  disabled = false,
  loading = false,
  onClick,
}: SubmitButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={disabled || loading ? undefined : { y: -2 }}
      whileTap={disabled || loading ? undefined : { y: 0 }}
      className="group isolate relative w-full overflow-hidden rounded-[14px] border border-[rgba(141,54,213,0.5)] bg-[linear-gradient(135deg,#46067A_0%,#8D36D5_50%,#A855F7_100%)] px-4 py-[17px] font-[var(--font-syne)] text-[13px] font-bold uppercase tracking-[0.1em] text-white outline-none transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-65"
      style={portalStyles.submitGlow}
    >
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.15),transparent_60%)]" />
      <span className="pointer-events-none absolute -inset-[2px] -z-10 rounded-[16px] bg-[linear-gradient(135deg,#A855F7,#8D36D5,#46067A)] opacity-0 blur-[8px] transition-opacity duration-300 group-hover:opacity-100" />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading ? "Submitting..." : label}
        <span className="text-lg transition-transform duration-300 group-hover:translate-x-1">
          {"→"}
        </span>
      </span>
    </motion.button>
  );
}
