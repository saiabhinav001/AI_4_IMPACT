"use client";

import { motion } from "framer-motion";

export default function HighlightsSection() {
  return (
    <section id="highlights" className="py-8 lg:py-12">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mb-10"
      >
        <h2 className="text-4xl font-black uppercase tracking-tighter text-white sm:text-6xl lg:text-7xl">
          THE <span className="bg-gradient-to-r from-[#8D36D5] to-[#46067A] bg-clip-text text-transparent italic">IMPACT</span>
        </h2>
      </motion.div>

      {/* Main Prize Pool Card */}
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="group relative flex min-h-[200px] w-full flex-col items-center justify-center p-6 md:min-h-[260px] md:p-10"
      >
        <svg
          className="absolute inset-0 h-full w-full drop-shadow-[0_0_15px_rgba(141,54,213,0.2)] transition-all duration-500 group-hover:drop-shadow-[0_0_25px_rgba(141,54,213,0.5)]"
          viewBox="0 0 1600 400"
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
            d="M0,60 L60,0 L1600,0 L1600,340 L1540,400 L0,400 Z"
            fill="url(#sci-fi-gradient)"
            stroke="url(#border-gradient)"
            strokeWidth="3"
            className="transition-all duration-500 group-hover:stroke-[#a855f7]"
          />
          <path d="M0,60 L60,0" stroke="#c084fc" strokeWidth="6" className="opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
          <path d="M1600,340 L1540,400" stroke="#c084fc" strokeWidth="6" className="opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
        </svg>

        <h3 className="relative z-10 mt-4 text-center text-4xl font-black tracking-tighter text-white sm:text-6xl lg:text-[6.5rem]">
          Rs. 1,00,000<span className="text-[#a855f7]">+</span>
        </h3>
        
      </motion.article>
    </section>
  );
}