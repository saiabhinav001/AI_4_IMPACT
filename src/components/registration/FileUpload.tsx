"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { portalStyles } from "./styles";

interface FileUploadProps {
  fileName: string;
  disabled?: boolean;
  onFileSelect: (file: File | null) => void;
}

export default function FileUpload({
  fileName,
  disabled = false,
  onFileSelect,
}: FileUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const commitFile = (file: File | null) => {
    if (!file) {
      onFileSelect(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      onFileSelect(null);
      return;
    }

    onFileSelect(file);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    commitFile(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!disabled) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragActive(false);

    if (disabled) {
      return;
    }

    const file = event.dataTransfer?.files?.[0] ?? null;
    commitFile(file);
  };

  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={openPicker}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "group relative w-full cursor-pointer overflow-hidden rounded-[14px] border-2 px-6 py-7 text-center transition-all duration-300",
          isDragActive
            ? "border-solid border-[rgba(141,54,213,1)] bg-[rgba(141,54,213,0.1)]"
            : "border-dashed border-[rgba(141,54,213,0.3)] bg-transparent hover:border-[rgba(141,54,213,1)]",
          disabled ? "cursor-not-allowed opacity-70" : "",
        ].join(" ")}
        disabled={disabled}
      >
        <div
          className={[
            "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(141,54,213,0.08),transparent_70%)] transition-opacity duration-300",
            isDragActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          ].join(" ")}
        />

        <div
          className="relative z-10 mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[14px] border border-[rgba(141,54,213,0.3)] bg-[rgba(141,54,213,0.15)] text-[20px] transition-transform duration-300 group-hover:-translate-y-[3px]"
          style={portalStyles.uploadGlow}
        >
          <span aria-hidden="true">📎</span>
        </div>

        <p className="relative z-10 mb-1 font-[var(--font-syne)] text-[13px] font-bold text-[#EDE8F5]">
          Drag & drop screenshot
        </p>
        <p className="relative z-10 text-[11px] text-[rgba(237,232,245,0.45)]">
          <strong className="font-medium text-[#8D36D5]">Click to browse</strong> · PNG or JPG only
        </p>
        <p className="relative z-10 mt-2 min-h-[14px] font-[var(--font-dm-mono)] text-[10px] text-[#8D36D5]">
          {fileName ? `✓ ${fileName}` : ""}
        </p>
      </motion.button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled}
      />
    </div>
  );
}
