"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import TrackTabs from "./TrackTabs";
import WorkshopForm from "./WorkshopForm";
import HackathonForm from "./HackathonForm";
import { portalStyles, type RegistrationTrack } from "./styles";
import { toRuntimeApiUrl } from "../../../lib/api-base";

interface RegistrationPortalProps {
  workshopQrSrc: string;
  hackathonQrSrc: string;
  hackathonDuoQrSrc: string;
}

type RegistrationWindowSnapshot = {
  status?: string | null;
  enabled?: boolean | null;
  openAt?: string | null;
  closeAt?: string | null;
};

const EVENT_TIME_ZONE = "Asia/Kolkata";
const DEFAULT_TIMEZONE_LABEL = "IST (Asia/Kolkata)";
const KNOWN_WINDOW_STATUS = new Set(["OPEN", "CLOSED", "SCHEDULED", "DISABLED", "LIVE"]);

function toNormalizedWindowStatus(status: unknown): string {
  const normalized = String(status || "").trim().toUpperCase();
  if (KNOWN_WINDOW_STATUS.has(normalized)) {
    return normalized;
  }

  return "OPEN";
}

function isRegistrationWindowOpen(
  windowSnapshot: RegistrationWindowSnapshot | null | undefined
): boolean {
  return toNormalizedWindowStatus(windowSnapshot?.status) === "OPEN";
}

function formatWindowDateLabel(value: unknown): string {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) {
    return "configured schedule";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: EVENT_TIME_ZONE,
    timeZoneName: "short",
  });
}

function buildWindowStatusHint(
  trackLabel: string,
  windowSnapshot: RegistrationWindowSnapshot | null | undefined
): string {
  const normalizedStatus = toNormalizedWindowStatus(windowSnapshot?.status);

  if (normalizedStatus === "OPEN") {
    return `${trackLabel} registration is currently open.`;
  }

  if (normalizedStatus === "SCHEDULED") {
    return `${trackLabel} registration opens at ${formatWindowDateLabel(windowSnapshot?.openAt)}.`;
  }

  if (normalizedStatus === "CLOSED") {
    return `${trackLabel} registration is currently not accepting responses.`;
  }

  if (normalizedStatus === "DISABLED") {
    return `${trackLabel} registration is disabled by admin and not accepting responses.`;
  }

  return `${trackLabel} registration status is being updated.`;
}

function getWindowToneClass(status: unknown): string {
  const normalizedStatus = toNormalizedWindowStatus(status);

  if (normalizedStatus === "OPEN" || normalizedStatus === "LIVE") {
    return "border-emerald-300/45 bg-emerald-500/15 text-emerald-100";
  }

  if (normalizedStatus === "SCHEDULED") {
    return "border-amber-300/45 bg-amber-500/15 text-amber-100";
  }

  if (normalizedStatus === "CLOSED") {
    return "border-rose-300/45 bg-rose-500/15 text-rose-100";
  }

  return "border-zinc-300/35 bg-zinc-500/15 text-zinc-200";
}

function TrackWindowStateCard({
  label,
  status,
  hint,
}: {
  label: string;
  status: string;
  hint: string;
}) {
  return (
    <article className="rounded-[14px] border border-[rgba(141,54,213,0.24)] bg-[rgba(141,54,213,0.1)] px-4 py-3 max-sm:px-3 max-sm:py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-[var(--font-dm-mono)] text-[10px] uppercase tracking-[0.1em] text-[rgba(237,232,245,0.62)]">
          {label}
        </p>
        <span
          className={[
            "rounded-full border px-2 py-0.5 font-[var(--font-dm-mono)] text-[10px] font-semibold uppercase tracking-[0.08em]",
            getWindowToneClass(status),
          ].join(" ")}
        >
          {status}
        </span>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-[rgba(237,232,245,0.76)]">{hint}</p>
    </article>
  );
}

function SingleTrackClosedHint({
  trackLabel,
  hint,
}: {
  trackLabel: string;
  hint: string;
}) {
  return (
    <div className="px-8 pt-5 max-sm:px-4 max-sm:pt-4">
      <div className="rounded-[14px] border border-[rgba(255,140,180,0.36)] bg-[rgba(255,89,153,0.1)] px-4 py-3">
        <p className="font-[var(--font-syne)] text-[12px] font-bold uppercase tracking-[0.08em] text-[#FFD7E3]">
          {trackLabel} responses are currently closed
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[rgba(255,215,227,0.84)]">{hint}</p>
      </div>
    </div>
  );
}

function AllClosedPanel({
  workshopHint,
  hackathonHint,
}: {
  workshopHint: string;
  hackathonHint: string;
}) {
  return (
    <div className="px-8 py-8 max-sm:px-4 max-sm:py-6">
      <div className="rounded-[18px] border border-[rgba(255,140,180,0.36)] bg-[rgba(255,89,153,0.1)] p-5 text-left max-sm:p-4">
        <p className="font-[var(--font-syne)] text-[13px] font-bold uppercase tracking-[0.08em] text-[#FFD7E3]">
          We are not accepting form responses currently
        </p>
        <ul className="mt-2 grid gap-2 text-[12px] leading-relaxed text-[rgba(255,215,227,0.84)]">
          <li>Workshop: {workshopHint}</li>
          <li>Hackathon: {hackathonHint}</li>
        </ul>
        <p className="mt-2 text-[11px] text-[rgba(255,215,227,0.62)]">
          Admin can reopen either track at any time from Event Controls.
        </p>
      </div>
    </div>
  );
}

export default function RegistrationPortal({
  workshopQrSrc,
  hackathonQrSrc,
  hackathonDuoQrSrc,
}: RegistrationPortalProps) {
  const [activeTrack, setActiveTrack] = useState<RegistrationTrack>("workshop");
  const [eventState, setEventState] = useState<Record<string, unknown> | null>(null);
  const [timezoneLabel, setTimezoneLabel] = useState(DEFAULT_TIMEZONE_LABEL);
  const [eventStateError, setEventStateError] = useState("");
  const [eventStateLoaded, setEventStateLoaded] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadEventState = async () => {
      try {
        const response = await fetch(toRuntimeApiUrl("/api/public/event-state"), {
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || data?.success !== true) {
          throw new Error(data?.error || "Failed to load event state.");
        }

        if (!isActive) {
          return;
        }

        setEventState((data?.eventState as Record<string, unknown>) || null);
        setTimezoneLabel(
          String(data?.timezoneLabel || DEFAULT_TIMEZONE_LABEL).trim() || DEFAULT_TIMEZONE_LABEL
        );
        setEventStateError("");
      } catch (error) {
        if (!isActive) {
          return;
        }

        setEventStateError(error instanceof Error ? error.message : "Failed to load event state.");
      } finally {
        if (isActive) {
          setEventStateLoaded(true);
        }
      }
    };

    void loadEventState();

    const intervalId = setInterval(() => {
      void loadEventState();
    }, 45000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, []);

  const registrationState =
    eventState && typeof eventState.registration === "object" && eventState.registration
      ? (eventState.registration as Record<string, unknown>)
      : null;

  const workshopWindow =
    registrationState && typeof registrationState.workshop === "object"
      ? (registrationState.workshop as RegistrationWindowSnapshot)
      : null;

  const hackathonWindow =
    registrationState && typeof registrationState.hackathon === "object"
      ? (registrationState.hackathon as RegistrationWindowSnapshot)
      : null;

  const workshopStatus = toNormalizedWindowStatus(workshopWindow?.status);
  const hackathonStatus = toNormalizedWindowStatus(hackathonWindow?.status);

  const workshopHint = buildWindowStatusHint("Workshop", workshopWindow);
  const hackathonHint = buildWindowStatusHint("Hackathon", hackathonWindow);

  const isWorkshopOpen = isRegistrationWindowOpen(workshopWindow);
  const isHackathonOpen = isRegistrationWindowOpen(hackathonWindow);

  const bothClosed = !isWorkshopOpen && !isHackathonOpen;
  const showTabs = isWorkshopOpen && isHackathonOpen;
  const singleOpenTrack: RegistrationTrack | null = showTabs
    ? null
    : isWorkshopOpen
      ? "workshop"
      : isHackathonOpen
        ? "hackathon"
        : null;

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
            <div className="border-b border-[rgba(141,54,213,0.12)] px-8 py-5 max-sm:px-4 max-sm:py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TrackWindowStateCard
                  label="Workshop"
                  status={workshopStatus}
                  hint={workshopHint}
                />
                <TrackWindowStateCard
                  label="Hackathon"
                  status={hackathonStatus}
                  hint={hackathonHint}
                />
              </div>

              <p className="mt-3 font-[var(--font-dm-mono)] text-[10px] uppercase tracking-[0.1em] text-[rgba(237,232,245,0.52)]">
                All schedule times are shown in {timezoneLabel || DEFAULT_TIMEZONE_LABEL}.
              </p>

              {!eventStateLoaded ? (
                <p className="mt-2 text-[11px] text-[rgba(237,232,245,0.58)]">
                  Checking current registration window status...
                </p>
              ) : null}

              {eventStateError ? (
                <p className="mt-2 text-[11px] text-[rgba(237,232,245,0.58)]">
                  Live event-state feed is temporarily unavailable. Form visibility is based on last known schedule.
                </p>
              ) : null}
            </div>

            {bothClosed ? (
              <AllClosedPanel workshopHint={workshopHint} hackathonHint={hackathonHint} />
            ) : showTabs ? (
              <TrackTabs
                activeTrack={activeTrack}
                onTrackChange={setActiveTrack}
                workshopPanel={<WorkshopForm qrSrc={workshopQrSrc} />}
                hackathonPanel={<HackathonForm qrSrc={hackathonQrSrc} duoQrSrc={hackathonDuoQrSrc} />}
              />
            ) : singleOpenTrack === "workshop" ? (
              <>
                <SingleTrackClosedHint trackLabel="Hackathon" hint={hackathonHint} />
                <WorkshopForm qrSrc={workshopQrSrc} />
              </>
            ) : (
              <>
                <SingleTrackClosedHint trackLabel="Workshop" hint={workshopHint} />
                <HackathonForm qrSrc={hackathonQrSrc} duoQrSrc={hackathonDuoQrSrc} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
