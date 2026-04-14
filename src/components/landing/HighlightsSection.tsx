"use client";

import { motion } from "framer-motion";

export default function HighlightsSection() {
  return (
    <section id="highlights" className="py-20">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mb-10"
      >
        <h2 className="text-5xl font-black uppercase tracking-tighter text-white sm:text-7xl lg:text-8xl">
          THE <span className="bg-gradient-to-r from-[#8D36D5] to-[#46067A] bg-clip-text text-transparent italic">IMPACT</span>
        </h2>
      </motion.div>

      {/* Main Prize Pool Card */}
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="group relative flex min-h-[350px] w-full flex-col items-center justify-center p-10 md:min-h-[450px] md:p-20"
      >
        <svg
          className="absolute inset-0 h-full w-full drop-shadow-[0_0_15px_rgba(141,54,213,0.2)] transition-all duration-500 group-hover:drop-shadow-[0_0_25px_rgba(141,54,213,0.5)]"
          viewBox="0 0 1600 800"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="sci-fi-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#46067A" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#1b0f2d" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="border-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8D36D5" />
              <stop offset="100%" stopColor="#46067A" />
            </linearGradient>
          </defs>
          <path
            d="M0,120 L120,0 L1600,0 L1600,680 L1480,800 L0,800 Z"
            fill="url(#sci-fi-gradient)"
            stroke="url(#border-gradient)"
            strokeWidth="3"
            className="transition-all duration-500 group-hover:stroke-[#a855f7]"
          />
          <path d="M0,120 L120,0" stroke="#c084fc" strokeWidth="6" className="opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
          <path d="M1600,680 L1480,800" stroke="#c084fc" strokeWidth="6" className="opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
        </svg>

        <p className="relative z-10 text-xs font-bold tracking-[0.4em] text-[#c084fc] uppercase">Grand Prize Pool</p>
        <h3 className="relative z-10 mt-4 text-center text-5xl font-black tracking-tighter text-white sm:text-7xl lg:text-[7rem]">
          Rs. 1,00,000<span className="text-[#a855f7]">+</span>
        </h3>
        
        <div className="relative z-10 mt-10 flex w-full max-w-4xl items-center gap-4 hidden sm:flex">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/20" />
          <p className="text-[10px] font-bold tracking-[0.5em] text-zinc-400">EXCLUDING INCUBATION OPPORTUNITIES</p>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/20" />
        </div>
        <p className="relative z-10 mt-8 text-center text-[9px] font-bold tracking-[0.3em] text-zinc-400 sm:hidden">
          EXCLUDING INCUBATION OPPORTUNITIES
        </p>
      </motion.article>

      {/* Secondary Metrics Grid */}
      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Design Tracks", value: "04", tech: "ARCH_FRONTEND // API_ECO // CLOUD // AI_ML" },
          { label: "Expert Mentors", value: "30+", tech: "DOMAIN_LEADS // TECH_VET // POLICY_EXP" },
          { label: "Active Teams", value: "75+", tech: "GLOBAL_TALENT // INNOVATION_NODES" },
        ].map((metric, idx) => (
          <motion.article
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 + idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="group relative flex flex-col p-8"
          >
            <svg
              className="absolute inset-0 h-full w-full opacity-40 transition-all duration-500 group-hover:opacity-80 group-hover:drop-shadow-[0_0_15px_rgba(141,54,213,0.3)]"
              viewBox="0 0 400 200"
              preserveAspectRatio="none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0,40 L40,0 L400,0 L400,160 L360,200 L0,200 Z"
                fill="rgba(141, 54, 213, 0.05)"
                stroke="rgba(141, 54, 213, 0.2)"
                strokeWidth="2"
                className="transition-colors group-hover:stroke-[#8D36D5]"
              />
              <path d="M0,40 L40,0" stroke="#8D36D5" strokeWidth="4" className="opacity-50" />
              <path d="M400,160 L360,200" stroke="#8D36D5" strokeWidth="4" className="opacity-50" />
            </svg>

            <div className="relative z-10">
              <span className="text-[10px] font-black tracking-[0.3em] text-[#8D36D5] uppercase truncate block mb-4">
                {metric.tech}
              </span>
              <p className="text-5xl font-black tracking-tighter text-white sm:text-6xl transition-transform group-hover:scale-105 duration-500">
                {metric.value}
              </p>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.4em] text-zinc-500 group-hover:text-white transition-colors">
                {metric.label}
              </p>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}