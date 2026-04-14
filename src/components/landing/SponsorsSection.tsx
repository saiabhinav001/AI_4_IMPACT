"use client";

import { motion } from "framer-motion";

const regularSponsors = [
  { role: "Cloud Partner", name: "AWS_ACTIVE", detail: "Infrastructure Core" },
  { role: "Education Partner", name: "ACADEMY_NODE", detail: "Knowledge Vector" },
  { role: "Community Partner", name: "DEV_NETWORK", detail: "Talent Stream" },
  { role: "Media Partner", name: "INTEL_WIRE", detail: "Broadcast Layer" },
];

export default function SponsorsSection() {
  return (
    <section id="sponsors" className="py-8 lg:py-12">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mb-10 text-center md:text-left"
      >
        <h2 className="text-4xl font-black uppercase tracking-tighter text-white sm:text-6xl lg:text-7xl">
          THE <span className="bg-gradient-to-r from-[#8D36D5] to-[#46067A] bg-clip-text text-transparent italic">PARTNERS</span>
        </h2>
      </motion.div>

      {/* FEATURED SPONSOR: KAVION.AI */}
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="group relative mx-auto mb-10 flex min-h-[140px] w-full max-w-7xl flex-col justify-center p-5 md:p-8"
      >
        {/* Themed Chamfered SVG Background */}
        <svg
          className="absolute inset-0 h-full w-full drop-shadow-[0_0_15px_rgba(141,54,213,0.15)] transition-all duration-500 group-hover:drop-shadow-[0_0_25px_rgba(141,54,213,0.4)]"
          viewBox="0 0 1600 240"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="sponsor-bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#46067A" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#1b0f2d" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="sponsor-border-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8D36D5" />
              <stop offset="100%" stopColor="#46067A" />
            </linearGradient>
          </defs>
          <path
            d="M0,40 L40,0 L1600,0 L1600,200 L1560,240 L0,240 Z"
            fill="url(#sponsor-bg-gradient)"
            stroke="url(#sponsor-border-gradient)"
            strokeWidth="3"
            className="transition-all duration-500 group-hover:stroke-[#a855f7]"
          />
          <path d="M0,40 L40,0" stroke="#c084fc" strokeWidth="6" className="opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
          <path d="M1600,200 L1560,240" stroke="#c084fc" strokeWidth="6" className="opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
        </svg>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-10 text-center md:flex-row md:text-left">
          <div className="flex h-32 w-56 shrink-0 items-center justify-center rounded-2xl border border-[#8D36D5]/30 bg-white/5 p-6 backdrop-blur-md transition-all duration-500 group-hover:bg-white/10 group-hover:scale-105">
            <img 
              src="/kavion.png" 
              alt="Kavion.ai Logo" 
              className="max-h-full max-w-full object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" 
            />
          </div>
          
          <div>
            <div className="mb-3 flex items-center justify-center gap-3 md:justify-start">
              <span className="h-px w-8 bg-[#c084fc]" />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#c084fc]">
                Title AI Sponsor
              </p>
            </div>
            <h3 className="mb-4 text-3xl font-black tracking-tighter text-white sm:text-4xl group-hover:animate-glitch">
              Kavion.ai
            </h3>
            <p className="max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-lg">
              The Governed Intelligence Layer for the Enterprise. Kavion transforms unstructured, business-critical documents into continuous, validated commercial intelligence.
            </p>
          </div>
        </div>
      </motion.article>
    </section>
  );
}