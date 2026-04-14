"use client";

import { motion } from "framer-motion";
import { Cpu, Terminal, Zap, Shield } from "lucide-react";

const events = [
  {
    title: "Build Sprint",
    detail: "36-hour product sprint with mentor checkpoints and technical office hours.",
    type: "CRITICAL_PATH",
    specs: ["36H_DURATION", "MENTOR_SYNC", "TECH_OFFICE_HOURS"],
    icon: <Cpu size={16} />,
  },
  {
    title: "Demo Arena",
    detail: "Pitch your prototype to judges across impact, innovation, and feasibility criteria.",
    type: "VALIDATION_PHASE",
    specs: ["JUDGE_REVIEW", "FEASIBILITY_SCORE", "IMPACT_METRICS"],
    icon: <Terminal size={16} />,
  },
];

export default function EventsSection() {
  return (
    <section id="events" className="pt-10 pb-20 relative scroll-mt-32">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mb-12"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="h-px w-8 bg-[#8D36D5]" />
          <span className="text-[10px] font-black tracking-[0.5em] text-[#8D36D5] uppercase">OPERATIONAL_FLOW</span>
        </div>
        <h2 className="text-5xl font-black uppercase tracking-tighter text-white sm:text-7xl lg:text-8xl">
          THE <span className="bg-gradient-to-r from-[#8D36D5] to-[#46067A] bg-clip-text text-transparent">FLOW</span>
        </h2>
      </motion.div>

      <div className="grid gap-12">
        {events.map((event, idx) => (
          <motion.article
            key={event.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: idx * 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="group relative"
          >
            {/* Holographic Corner Brackets */}
            <div className="absolute -left-2 -top-2 h-8 w-8 border-l-2 border-t-2 border-[#8D36D5]/40 transition-all group-hover:border-[#8D36D5]" />
            <div className="absolute -right-2 -bottom-2 h-8 w-8 border-r-2 border-b-2 border-[#8D36D5]/40 transition-all group-hover:border-[#8D36D5]" />
            
            <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.01] p-8 backdrop-blur-3xl transition-all duration-500 group-hover:bg-white/[0.03] group-hover:border-white/10">
              {/* Scanning Ray */}
              <motion.div 
                animate={{ left: ["-100%", "200%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute top-0 bottom-0 w-32 bg-gradient-to-r from-transparent via-[#8D36D5]/10 to-transparent skew-x-12 pointer-events-none"
              />

              <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8D36D5]/10 text-[#8D36D5] border border-[#8D36D5]/20">
                      {event.icon}
                    </div>
                    <span className="text-[10px] font-black tracking-[0.3em] text-[#8D36D5]/70 uppercase">
                      [{event.type}] // 0x_0{idx + 1}
                    </span>
                  </div>
                  
                  <h3 className="text-4xl font-black uppercase tracking-tighter text-white group-hover:text-[#8D36D5] transition-colors">
                    {event.title}
                  </h3>
                  <p className="mt-4 text-lg text-zinc-500 max-w-xl group-hover:text-zinc-300 transition-colors">
                    {event.detail}
                  </p>
                </div>

                {/* Data Expansion Specs */}
                <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
                  {event.specs.map((spec) => (
                    <div 
                      key={spec}
                      className="px-3 py-1 rounded-md border border-white/5 bg-black/40 text-[9px] font-bold tracking-[0.2em] text-zinc-500 transition-all group-hover:border-[#8D36D5]/30 group-hover:text-[#8D36D5] group-hover:bg-[#8D36D5]/5"
                    >
                      {spec}
                    </div>
                  ))}
                  <div className="mt-2 hidden lg:flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-[#8D36D5] animate-pulse" />
                    <span className="text-[8px] font-black text-[#8D36D5]/50 uppercase tracking-[0.4em]">LINK_ESTABLISHED</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
      
      {/* Decorative Sidebar Decal */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden xl:block pointer-events-none">
        <div className="flex flex-col gap-4 text-white/[0.03] font-black text-6xl vertical-text rotate-180 uppercase tracking-[0.5em]">
          INTEL_FLOW // DATA_SYNC
        </div>
      </div>
    </section>
  );
}