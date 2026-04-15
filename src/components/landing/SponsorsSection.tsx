"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const regularSponsors = [
  { role: "Cloud Partner", name: "AWS_ACTIVE", detail: "Infrastructure Core" },
  { role: "Education Partner", name: "ACADEMY_NODE", detail: "Knowledge Vector" },
  { role: "Community Partner", name: "DEV_NETWORK", detail: "Talent Stream" },
  { role: "Media Partner", name: "INTEL_WIRE", detail: "Broadcast Layer" },
];

export default function SponsorsSection() {
  return (
    <section id="sponsors" className="landing-section">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
        className="mb-8 text-center md:text-left"
      >
        <h2 className="type-h2 font-black tracking-tighter text-white">
          THE{" "}
          <span className="bg-gradient-to-r from-[#8D36D5] to-[#46067A] bg-clip-text text-transparent italic">
            PARTNERS
          </span>
        </h2>
      </motion.div>

      {/* FEATURED SPONSOR */}
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="group relative mx-auto mb-10 flex min-h-[148px] w-full max-w-5xl flex-col items-center justify-center p-0 md:min-h-[184px]"
      >
        {/* SVG BACKGROUND */}
        <svg
          className="absolute inset-0 h-full w-full drop-shadow-[0_0_15px_rgba(141,54,213,0.2)] transition-all duration-500 group-hover:drop-shadow-[0_0_25px_rgba(141,54,213,0.5)]"
          viewBox="0 0 1600 400"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="sponsor-sci-fi-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#46067A" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#1b0f2d" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="sponsor-border-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8D36D5" />
              <stop offset="100%" stopColor="#46067A" />
            </linearGradient>
          </defs>

          <path
            d="M0,60 L60,0 L1600,0 L1600,340 L1540,400 L0,400 Z"
            fill="url(#sponsor-sci-fi-gradient)"
            stroke="url(#sponsor-border-gradient)"
            strokeWidth="3"
            className="transition-all duration-500 group-hover:stroke-[#a855f7]"
          />
          <path
            d="M0,60 L60,0"
            stroke="#c084fc"
            strokeWidth="6"
            className="opacity-70 group-hover:opacity-100 transition-opacity duration-500"
          />
          <path
            d="M1600,340 L1540,400"
            stroke="#c084fc"
            strokeWidth="6"
            className="opacity-70 group-hover:opacity-100 transition-opacity duration-500"
          />
        </svg>

        {/* CONTENT */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-4">
          
          {/* 🔼 Bigger Logo */}
          <Image
            src="/kavion.png"
            alt="Kavion.ai Logo"
            width={220}
            height={120}
            className="mb-2 h-auto w-[160px] sm:w-[180px] object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]"
          />

          {/* 🔽 Fixed Description */}
          <p className="text-[1.25rem] text-zinc-400 max-w-lg leading-snug">
            The Governed Intelligence Layer for the Enterprise. Kavion transforms
            unstructured, business-critical documents into continuous, validated
            commercial intelligence.
          </p>
        </div>
      </motion.article>
    </section>
  );
}