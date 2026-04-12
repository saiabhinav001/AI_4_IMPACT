"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import TrackTabs from "./TrackTabs";
import WorkshopForm from "./WorkshopForm";
import HackathonForm from "./HackathonForm";
import { portalStyles, type RegistrationTrack } from "./styles";

interface RegistrationPortalProps {
  workshopQrSrc: string;
  hackathonQrSrc: string;
  hackathonDuoQrSrc: string;
}

export default function RegistrationPortal({
  workshopQrSrc,
  hackathonQrSrc,
  hackathonDuoQrSrc,
}: RegistrationPortalProps) {
  const [activeTrack, setActiveTrack] = useState<RegistrationTrack>("workshop");

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[#07020E] font-[var(--font-dm-sans)] text-[#EDE8F5] normal-case"
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
            <div className="mb-6 flex justify-center">
              <Image
                src="/logo-w.png"
                alt="AI4Impact"
                width={294}
                height={175}
                priority
                className="h-auto w-full max-w-[280px]"
              />
            </div>

            <h1 className="mt-2 [font-family:var(--font-dm-sans)] text-[clamp(30px,5vw,42px)] font-semibold leading-[1.15] tracking-normal text-white">
              Registration Form
            </h1>

            <div className="mt-[12px] max-w-[560px] space-y-3 text-[13px] font-light leading-relaxed tracking-[0.01em] text-white">
              <p>
                AI4Impact - Learn, Build, Impact! is a national-level Hackathon-n-Workshop
                designed to empower students to innovate with purpose, taking place from 15th to
                18th April 2026.
              </p>
              <p>
                The event begins with Full Stack AI Workshops (15th &amp; 16th April), where
                participants will gain hands-on experience in building and deploying AI/ML-powered
                applications. This is followed by a 30-hour Hackathon (17th &amp; 18th April),
                focused on solving real-world challenges through innovation and collaboration. To
                streamline development, ready-to-use codebase templates will be provided, allowing
                participants to focus purely on creativity and problem-solving.
              </p>
              <p>
                At its core, AI4Impact is about leveraging technology for social good, encouraging
                participants to build practical AI/ML solutions that address pressing societal
                issues.
              </p>
              <p className="font-medium text-white">Learn. Build. Impact.</p>
            </div>

            <div className="mt-5 rounded-[18px] border border-[rgba(141,54,213,0.28)] bg-[rgba(141,54,213,0.08)] p-4 text-white/90 backdrop-blur-sm">
              <p className="font-[var(--font-syne)] text-[12px] font-bold uppercase tracking-[0.08em] text-[#EDE8F5]">
                Need Help With Registration?
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[rgba(237,232,245,0.75)]">
                For any registration or payment query, please contact our student coordination team.
              </p>

              <ul className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2">
                <li>
                  <a className="text-[#EDE8F5] hover:text-white" href="tel:+916303487822">
                    Akhilesh Reddy - 63034 87822
                  </a>
                </li>
                <li>
                  <a className="text-[#EDE8F5] hover:text-white" href="tel:+916281011433">
                    Teja - 62810 11433
                  </a>
                </li>
                <li>
                  <a className="text-[#EDE8F5] hover:text-white" href="tel:+919866191349">
                    Neha Reddy - 98661 91349
                  </a>
                </li>
                <li>
                  <a className="text-[#EDE8F5] hover:text-white" href="tel:+916302898414">
                    Harinya Reddy - 63028 98414
                  </a>
                </li>
                <li className="sm:col-span-2">
                  <a className="text-[#EDE8F5] hover:text-white" href="tel:+918498898884">
                    KVDS Pragna - 84988 98884
                  </a>
                </li>
              </ul>
            </div>
          </header>

          <div
            className="w-full overflow-hidden rounded-[24px]"
            style={{ ...portalStyles.glassCard, ...portalStyles.cardGlow }}
          >
            <TrackTabs
              activeTrack={activeTrack}
              onTrackChange={setActiveTrack}
              workshopPanel={<WorkshopForm qrSrc={workshopQrSrc} />}
              hackathonPanel={<HackathonForm qrSrc={hackathonQrSrc} duoQrSrc={hackathonDuoQrSrc} />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
