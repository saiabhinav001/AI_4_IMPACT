"use client";

import { motion } from "framer-motion";

const milestones = [
  { name: "Registration", date: "Starts Now", status: "Active" },
  { name: "Team Matching", date: "June 15", status: "Upcoming" },
  { name: "Build Sprint", date: "June 24-26", status: "Upcoming" },
  { name: "Final Demos", date: "June 26", status: "Upcoming" },
];

export default function TimelineSection() {
  return (
    <section id="timeline" className="py-20">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mb-12"
      >
        <h2 className="bg-gradient-to-r from-white to-violet-300 bg-clip-text text-4xl font-black uppercase tracking-tight text-transparent sm:text-5xl">
          Roadmap <span className="text-zinc-500">_02</span>
        </h2>
      </motion.div>

      <div className="relative rounded-[2.5rem] border border-white/10 bg-black/40 p-8 backdrop-blur-xl sm:p-12">
        <div className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Connecting Line */}
          <div className="pointer-events-none absolute left-0 right-0 top-6 hidden h-[2px] bg-gradient-to-r from-fuchsia-500/0 via-fuchsia-500/50 to-cyan-500/0 lg:block" />

          {milestones.map((item, idx) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.15 }}
              className="group relative flex flex-col items-center text-center lg:items-start lg:text-left"
            >
              <div className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border-2 transition-all duration-500 ${
                item.status === 'Active' 
                  ? "border-fuchsia-500 bg-fuchsia-500/20 shadow-[0_0_20px_rgba(217,70,239,0.4)]" 
                  : "border-white/10 bg-black group-hover:border-white/30"
              }`}>
                <div className={`h-3 w-3 rounded-full ${
                  item.status === 'Active' ? "bg-white animate-pulse" : "bg-white/20"
                }`} />
              </div>

              <div className="mt-6">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                  item.status === 'Active' ? "text-fuchsia-400" : "text-zinc-500"
                }`}>
                  {item.date}
                </span>
                <h3 className="mt-1 text-xl font-bold uppercase tracking-wide text-white">
                  {item.name}
                </h3>
                <p className="mt-2 text-xs font-medium text-zinc-500 uppercase tracking-widest transition-colors group-hover:text-zinc-400">
                  {item.status} Phase
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}