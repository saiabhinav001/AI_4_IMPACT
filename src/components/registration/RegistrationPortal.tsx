"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { DM_Mono, DM_Sans, Syne } from "next/font/google";
import TrackTabs from "./TrackTabs";
import WorkshopForm from "./WorkshopForm";
import HackathonForm from "./HackathonForm";
import { portalStyles, type RegistrationTrack } from "./styles";

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-syne",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-sans",
});

interface RegistrationPortalProps {
  workshopQrSrc: string;
  hackathonQrSrc: string;
}

export default function RegistrationPortal({
  workshopQrSrc,
  hackathonQrSrc,
}: RegistrationPortalProps) {
  const [activeTrack, setActiveTrack] = useState<RegistrationTrack>("workshop");

  return (
    <div
      className={`${syne.variable} ${dmMono.variable} ${dmSans.variable} relative min-h-screen overflow-x-hidden bg-[#07020E] font-[var(--font-dm-sans)] text-[#EDE8F5] normal-case`}
    >
      <div className="fixed inset-0 z-0 overflow-hidden" style={portalStyles.meshBackground}>
        <div className="absolute inset-0" style={portalStyles.meshGrid} />

        <motion.div
          className="absolute -left-24 -top-28"
          style={{ ...portalStyles.orbBase, ...portalStyles.orbOne }}
          animate={{ x: [0, 40], y: [0, 60], scale: [1, 1.12] }}
          transition={{ duration: 20, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-20 top-[40%]"
          style={{ ...portalStyles.orbBase, ...portalStyles.orbTwo }}
          animate={{ x: [0, 40], y: [0, 60], scale: [1, 1.12] }}
          transition={{
            duration: 26,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
            delay: -8,
          }}
        />
        <motion.div
          className="absolute bottom-[5%] left-[20%]"
          style={{ ...portalStyles.orbBase, ...portalStyles.orbThree }}
          animate={{ x: [0, 40], y: [0, 60], scale: [1, 1.12] }}
          transition={{
            duration: 22,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
            delay: -4,
          }}
        />
      </div>

      <div className="pointer-events-none fixed inset-0 z-[1]" style={portalStyles.noiseOverlay} />

      <div className="relative z-10 flex min-h-screen w-full items-start justify-center px-5 pb-20 pt-12 sm:pt-14">
        <div className="w-full max-w-[600px]">
          <header className="mb-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[rgba(141,54,213,0.28)] bg-[rgba(141,54,213,0.14)] px-[14px] py-[6px] pl-[10px] font-[var(--font-dm-mono)] text-[10px] uppercase tracking-[0.12em] text-[rgba(237,232,245,0.7)] backdrop-blur-xl">
              <motion.span
                className="h-2 w-2 rounded-full bg-[#A855F7] shadow-[0_0_8px_#A855F7]"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              Payment Verified Entry
            </div>

            <h1 className="bg-[linear-gradient(135deg,#FFFFFF_30%,#C48EFF_70%,#8D36D5_100%)] bg-clip-text font-[var(--font-syne)] text-[clamp(26px,5vw,38px)] font-extrabold leading-[1.1] tracking-[-0.02em] text-transparent">
              <span className="font-[var(--font-dm-mono)] text-[0.75em] tracking-[0.05em] text-[#8D36D5]">
                {"///"}
              </span>{" "}
              Registration_Portal
            </h1>

            <p className="mt-[10px] max-w-[440px] text-[13px] font-light leading-relaxed tracking-[0.01em] text-[rgba(237,232,245,0.45)]">
              Workshop is individual participation. Hackathon is team participation with 3 or 4 members.
            </p>
          </header>

          <div
            className="w-full overflow-hidden rounded-[24px]"
            style={{ ...portalStyles.glassCard, ...portalStyles.cardGlow }}
          >
            <TrackTabs
              activeTrack={activeTrack}
              onTrackChange={setActiveTrack}
              workshopPanel={<WorkshopForm qrSrc={workshopQrSrc} />}
              hackathonPanel={<HackathonForm qrSrc={hackathonQrSrc} />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
