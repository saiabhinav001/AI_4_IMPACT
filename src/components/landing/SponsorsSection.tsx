"use client";

import { motion } from "framer-motion";

const sponsors = ["Cloud Partner", "AI Partner", "Education Partner", "Community Partner", "Media Partner"];

export default function SponsorsSection() {
  return (
    <section id="sponsors" className="py-20">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mb-10"
      >
        <h2 className="bg-gradient-to-r from-white to-blue-300 bg-clip-text text-4xl font-black uppercase tracking-tight text-transparent sm:text-5xl">
          Partners <span className="text-zinc-500">_05</span>
        </h2>
      </motion.div>

      <div className="rounded-[2.5rem] border border-white/5 bg-white/[0.02] p-8 backdrop-blur-3xl sm:p-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {sponsors.map((item, idx) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="group flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-black/40 px-4 py-8 text-center transition-all duration-500 hover:border-white/20 hover:bg-white/5"
            >
              <div className="mb-4 h-1 w-8 bg-zinc-800 transition-all group-hover:bg-blue-500" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 group-hover:text-zinc-300">
                {item}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}