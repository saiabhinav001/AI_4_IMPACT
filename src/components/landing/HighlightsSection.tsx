"use client";

import { motion } from "framer-motion";

export default function HighlightsSection() {
  return (
    <section id="highlights" className="py-12 lg:py-16">
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
        className="group relative flex min-h-[250px] w-full flex-col items-center justify-center p-8 md:min-h-[320px] md:p-12"
      >
        <svg
          className="absolute inset-0 h-full w-full drop-shadow-[0_0_15px_rgba(141,54,213,0.2)] transition-all duration-500 group-hover:drop-shadow-[0_0_25px_rgba(141,54,213,0.5)]"
          viewBox="0 0 1600 500"
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
            d="M0,80 L80,0 L1600,0 L1600,420 L1520,500 L0,500 Z"
            fill="url(#sci-fi-gradient)"
            stroke="url(#border-gradient)"
            strokeWidth="3"
            className="transition-all duration-500 group-hover:stroke-[#a855f7]"
          />
          <path d="M0,80 L80,0" stroke="#c084fc" strokeWidth="6" className="opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
          <path d="M1600,420 L1520,500" stroke="#c084fc" strokeWidth="6" className="opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
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
    </section>
  );
}