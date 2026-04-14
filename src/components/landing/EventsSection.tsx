"use client";

import { motion } from "framer-motion";

const events = [
  {
    title: "Build Sprint",
    detail: "36-hour product sprint with mentor checkpoints and technical office hours.",
    type: "Technical",
  },
  {
    title: "Demo Arena",
    detail: "Pitch your prototype to judges across impact, innovation, and feasibility criteria.",
    type: "Finalist",
  },
];

export default function EventsSection() {
  return (
    <section id="events" className="py-20">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mb-10"
      >
        <h2 className="bg-gradient-to-r from-white to-blue-300 bg-clip-text text-4xl font-black uppercase tracking-tight text-transparent sm:text-5xl">
          Tracks <span className="text-zinc-500">_03</span>
        </h2>
      </motion.div>

      <div className="grid gap-6">
        {events.map((event, idx) => (
          <motion.article
            key={event.title}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: idx * 0.1 }}
            className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/40 p-8 backdrop-blur-xl transition-all duration-500 hover:border-blue-500/30"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">
                    {event.type}
                  </span>
                </div>
                <h3 className="mt-2 text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
                  {event.title}
                </h3>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-4xl font-black text-white/5 sm:text-6xl">
                  0{idx + 1}
                </span>
                <div className="h-12 w-[1px] bg-white/10 hidden sm:block" />
                <p className="max-w-md text-sm leading-relaxed text-zinc-400 sm:text-base">
                  {event.detail}
                </p>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}