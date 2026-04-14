"use client";

import { motion } from "framer-motion";

export default function HighlightsSection() {
  return (
    <section id="highlights" className="py-20">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mb-10"
      >
        <h2 className="bg-gradient-to-r from-white to-fuchsia-300 bg-clip-text text-4xl font-black uppercase tracking-tight text-transparent sm:text-5xl">
          Impact <span className="text-zinc-500">_04</span>
        </h2>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-3">
        <motion.article 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="group relative overflow-hidden rounded-[2.5rem] border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-600/20 to-blue-600/10 p-10 backdrop-blur-xl md:col-span-3 lg:p-14"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <p className="text-xs font-bold tracking-[0.4em] text-fuchsia-400 uppercase">Grand Prize Pool</p>
          <h3 className="mt-4 text-5xl font-black tracking-tighter text-white sm:text-7xl lg:text-8xl">
            Rs. 2,00,000<span className="text-fuchsia-500">+</span>
          </h3>
          <div className="mt-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <p className="text-[10px] font-bold tracking-[0.5em] text-zinc-500">EXCLUDING INCUBATION OPPORTUNITIES</p>
            <div className="h-px flex-1 bg-white/10" />
          </div>
        </motion.article>

        {stats.map((stat, idx) => (
          <motion.article
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: idx * 0.1 }}
            className="group relative overflow-hidden rounded-[2rem] border border-white/5 bg-white/5 p-8 text-center backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:bg-white/10"
          >
            <p className="text-5xl font-black tracking-tighter text-cyan-400 sm:text-6xl">
              {stat.value}
            </p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500 transition-colors group-hover:text-zinc-300">
              {stat.label}
            </p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}