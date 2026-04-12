"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import type { UseFormRegisterReturn } from "react-hook-form";
import FileUpload from "./FileUpload";
import type { RegistrationTrack } from "./styles";
import { portalStyles } from "./styles";

interface PaymentSectionProps {
  type: RegistrationTrack;
  amount: string;
  amountSuffix: string;
  qrSrc: string;
  sectionTag: string;
  transactionInputProps: UseFormRegisterReturn;
  transactionError?: string;
  fileName: string;
  fileError?: string;
  uploadMessage?: string;
  uploadMessageTone?: "ok" | "error" | "info";
  uploadInProgress?: boolean;
  onFileSelect: (file: File | null) => void;
}

function AnimatedFieldError({ message }: { message?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.p
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-2 text-[11px] text-[#FF8BB5]"
        >
          {message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

export default function PaymentSection({
  type,
  amount,
  amountSuffix,
  qrSrc,
  sectionTag,
  transactionInputProps,
  transactionError,
  fileName,
  fileError,
  uploadMessage,
  uploadMessageTone = "ok",
  uploadInProgress = false,
  onFileSelect,
}: PaymentSectionProps) {
  const qrTitle = type === "workshop" ? "Workshop QR" : "Hackathon QR";

  const uploadToneClass =
    uploadMessageTone === "error"
      ? "border-[rgba(255,135,176,0.45)] bg-[rgba(255,84,148,0.16)] text-[#FFDCE7]"
      : "border-[rgba(214,171,255,0.45)] bg-[rgba(141,54,213,0.22)] text-[#F1E2FF]";

  return (
    <div className="border-t border-[rgba(141,54,213,0.1)] px-8 py-7 max-sm:px-4 max-sm:py-5">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="h-4 w-[3px] rounded bg-[linear-gradient(180deg,#8D36D5,#46067A)] shadow-[0_0_10px_#8D36D5]" />
        <h2 className="font-[var(--font-syne)] text-[13px] font-bold uppercase tracking-[0.1em] text-[#EDE8F5]">
          Payment Verification
        </h2>
        <span className="ml-auto font-[var(--font-dm-mono)] text-[9px] uppercase tracking-[0.1em] text-[#8D36D5]/70">
          {sectionTag}
        </span>
      </div>

      <div className="relative mb-5 flex items-center gap-6 overflow-hidden rounded-[18px] border border-[rgba(141,54,213,0.28)] bg-[rgba(141,54,213,0.06)] p-6 max-md:flex-col max-md:items-start max-md:p-4">
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(141,54,213,0.1),transparent_60%)]" />

        <div
          className="relative z-10 flex h-[130px] w-[130px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-white p-2"
          style={portalStyles.qrFrameGlow}
        >
          <Image
            src={qrSrc}
            alt={qrTitle}
            fill
            sizes="130px"
            className="object-contain"
          />
        </div>

        <div className="relative z-10 flex-1">
          <p className="font-[var(--font-syne)] text-[15px] font-bold text-[#EDE8F5]">{qrTitle}</p>
          <p className="mb-2 mt-1 font-[var(--font-dm-mono)] text-[22px] font-medium leading-none text-[#C48EFF]">
            {amount}
            <span className="ml-1 text-[12px] font-light text-[rgba(237,232,245,0.45)]">
              {amountSuffix}
            </span>
          </p>
          <p className="text-[11px] leading-relaxed text-[rgba(237,232,245,0.45)]">
            Scan, complete payment, then upload your screenshot below.
          </p>
        </div>
      </div>

      <div className="mb-5">
        <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
          Transaction ID
        </label>
        <input
          type="text"
          placeholder="Enter exact UPI transaction ID"
          className="w-full rounded-xl border border-[rgba(141,54,213,0.2)] bg-[rgba(141,54,213,0.06)] px-4 py-[13px] font-[var(--font-dm-sans)] text-sm text-[#EDE8F5] outline-none transition-all duration-300 placeholder:text-[rgba(237,232,245,0.25)] hover:border-[rgba(141,54,213,0.4)] hover:bg-[rgba(141,54,213,0.09)] focus:border-[#8D36D5] focus:bg-[rgba(141,54,213,0.12)] focus:shadow-[0_0_0_3px_rgba(141,54,213,0.15),inset_0_0_0_1px_rgba(141,54,213,0.1)]"
          {...transactionInputProps}
        />
        <p className="mt-2 text-[11px] leading-relaxed text-[rgba(237,232,245,0.62)]">
          Enter the same transaction ID shown in your payment app. This helps us verify your
          registration quickly.
        </p>
        <AnimatedFieldError message={transactionError} />
      </div>

      <div>
        <label className="mb-[7px] block font-[var(--font-dm-mono)] text-[11px] font-medium uppercase tracking-[0.08em] text-[rgba(237,232,245,0.45)]">
          Payment Screenshot
        </label>
        <p className="mb-2 text-[11px] leading-relaxed text-[rgba(237,232,245,0.62)]">
          Upload a clear screenshot with transaction ID, paid amount, and payment status visible
          for faster verification.
        </p>
        <FileUpload
          fileName={fileName}
          disabled={uploadInProgress}
          onFileSelect={onFileSelect}
        />
        <AnimatedFieldError message={fileError} />
      </div>

      <AnimatePresence initial={false}>
        {uploadMessage ? (
          <motion.p
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2 }}
            className={[
              "mt-4 rounded-[10px] border px-3 py-2 text-[12px] font-semibold",
              uploadToneClass,
            ].join(" ")}
          >
            {uploadMessage}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
