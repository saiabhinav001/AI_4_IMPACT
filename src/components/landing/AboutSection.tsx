"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const capabilities = [
  { 
    label: "Ethical AI", 
    desc: "Humans-in-the-loop systems designed for transparency.",
    icon: "PROTOCOL_01"
  },
  { 
    label: "Rapid Prototyping", 
    desc: "From conceptual theory to functional impact in 36h.",
    icon: "DEPLOY_02"
  },
  { 
    label: "Social Good", 
    desc: "Data-driven solutions for real-world communities.",
    icon: "IMPACT_03"
  },
];

const missionPillars = [
  {
    title: "The Vision Gap",
    text: "Critical impact sectors struggle to translate prototypes into deployable, ethical products. We close this gap through rapid prototyping and domain-expert validation.",
    index: "01",
    tag: "PROBLEM_STATEMENT"
  },
  {
    title: "Strategic Impact",
    text: "Teams pair with challenge owners to move from idea to tested proof-of-impact. No fluff, just rapid design, validation, and real-world results.",
    index: "02",
    tag: "SOLUTION_LAYER"
  },
];

export default function AboutSection() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const xText = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);

  return (
    <section 
      id="about" 
      ref={containerRef} 
      className="relative py-12 lg:py-16 overflow-hidden scroll-mt-32"
    >
      {/* Subtle Background Texture */}
      <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_center,_#fff_1px,_transparent_1px)] bg-[length:40px_40px] pointer-events-none" />

      {/* Kinetic Background Text - Texture Layer */}
      <motion.div 
        style={{ x: xText }}
        className="absolute top-20 whitespace-nowrap text-[12vw] font-black uppercase tracking-tighter text-white/[0.02] pointer-events-none select-none"
      >
        MISSION_PROTOCOL_2026 // SOCIAL_IMPACT_LAYER // CORE_OBJECTIVE //
      </motion.div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Header Block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-16 lg:mb-24"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px w-12 bg-[#8D36D5]" />
            <span className="text-[10px] font-black tracking-[0.5em] text-[#8D36D5] uppercase">STRATEGIC_OVERVIEW</span>
          </div>
          <h2 className="text-5xl font-black uppercase tracking-tighter text-white sm:text-7xl lg:text-8xl leading-[0.85]">
            THE <span className="bg-gradient-to-r from-[#8D36D5] to-[#46067A] bg-clip-text text-transparent italic">WHY</span>
          </h2>
        </motion.div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 lg:gap-8">
          
          {/* Main Pillars - Two Large Cards */}
          {missionPillars.map((pillar, idx) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: idx * 0.1 }}
              className="lg:col-span-6 group relative"
            >
              <div className="absolute -inset-[1px] rounded-[2rem] bg-gradient-to-br from-[#8D36D5]/20 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="relative h-full overflow-hidden rounded-[2rem] border border-white/5 bg-white/[0.03] p-6 sm:p-12 backdrop-blur-sm transition-all duration-500 group-hover:bg-white/[0.05]">
                <div className="flex justify-between items-start mb-8">
                  <span className="text-[10px] font-black tracking-[0.3em] text-[#8D36D5]">{pillar.tag}</span>
                  <span className="text-4xl font-black text-white/10 group-hover:text-[#8D36D5]/20 transition-colors">/{pillar.index}</span>
                </div>
                <h3 className="text-3xl font-black uppercase tracking-tight text-white mb-6 group-hover:animate-glitch">
                  {pillar.title}
                </h3>
                <p className="text-lg text-zinc-400 leading-relaxed font-medium">
                  {pillar.text}
                </p>
                <div className="mt-10 h-[1px] w-12 bg-white/10 group-hover:w-full group-hover:bg-[#8D36D5]/50 transition-all duration-1000" />
              </div>
            </motion.div>
          ))}

          {/* Capabilities - Three Smaller Bento Cards */}
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.label}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 + (i * 0.1) }}
              className="lg:col-span-4 group relative"
            >
              <div className="relative h-full rounded-[1.5rem] border border-white/5 bg-white/[0.02] p-6 transition-all hover:bg-white/[0.04] sm:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#8D36D5] animate-pulse" />
                  <span className="text-[9px] font-bold tracking-[0.4em] text-zinc-500 uppercase">{cap.icon}</span>
                </div>
                <h4 className="text-xl font-black uppercase tracking-wide text-white mb-3">
                  {cap.label}
                </h4>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  {cap.desc}
                </p>
                {/* Technical Corner Accents */}
                <div className="absolute top-4 right-4 h-2 w-2 border-t border-r border-white/10" />
                <div className="absolute bottom-4 left-4 h-2 w-2 border-b border-l border-white/10" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Closing Technical Strip */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="mt-20 flex items-center justify-between border-t border-white/5 pt-8 text-[10px] font-black tracking-[0.5em] text-zinc-600 uppercase"
        >
          <span>MISSION_READY // 2026</span>
          <div className="flex gap-4">
            <div className="h-1 w-1 rounded-full bg-[#46067A]" />
            <div className="h-1 w-1 rounded-full bg-[#8D36D5]" />
            <div className="h-1 w-1 rounded-full bg-white/10" />
          </div>
          <span>SYST_INIT_OK</span>
        </motion.div>
      </div>
    </section>
  );
}