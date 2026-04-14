"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const cards = [
  {
    title: "The Vision Gap",
    text: "Critical impact sectors still struggle to translate AI prototypes into deployable and ethical products that communities can trust. We close this gap through rapid prototyping and domain-expert validation.",
    index: "01",
    accent: "fuchsia",
  },
  {
    title: "Strategic Impact",
    text: "Teams pair with challenge owners and mentors to move from idea to tested proof-of-impact through rapid design, validation, and demos. No fluff, just results.",
    index: "02",
    accent: "cyan",
  },
];

export default function AboutSection() {
const capabilities = [
  { label: "Ethical AI", desc: "Humans-in-the-loop systems designed for transparency." },
  { label: "Rapid Prototyping", desc: "From conceptual theory to functional impact in 36h." },
  { label: "Social Good", desc: "Data-driven solutions for real-world communities." },
];

export default function AboutSection() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const xText = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);

  return (
    <section id="about" ref={containerRef} className="relative py-32 overflow-hidden">
      {/* Mesh Background Glows */}
      <div className="pointer-events-none absolute -left-[10%] top-[20%] h-[600px] w-[600px] rounded-full bg-[#8D36D5]/5 blur-[120px]" />
      <div className="pointer-events-none absolute -right-[10%] bottom-[20%] h-[600px] w-[600px] rounded-full bg-[#46067A]/5 blur-[120px]" />

      {/* Kinetic Background Text */}
      <motion.div 
        style={{ x: xText }}
        className="absolute top-10 whitespace-nowrap text-[12vw] font-black uppercase tracking-tighter text-white/[0.01] pointer-events-none select-none"
      >
        MISSION_PROTOCOL_2026 // SOCIAL_IMPACT_LAYER // 
      </motion.div>

      <div className="relative z-10 grid gap-20 lg:grid-cols-12">
        {/* Left Side: Header & Capabilities */}
        <div className="lg:col-span-12 xl:col-span-5">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px w-8 bg-[#8D36D5]" />
              <span className="text-[10px] font-black tracking-[0.5em] text-[#8D36D5]">CORE_OBJECTIVE</span>
            </div>
            <h2 className="text-6xl font-black uppercase tracking-tighter text-white sm:text-7xl lg:text-8xl">
              THE <span className="bg-gradient-to-r from-[#8D36D5] to-[#46067A] bg-clip-text text-transparent">WHY</span>
            </h2>
            <p className="mt-8 text-xl text-zinc-500 max-w-sm leading-relaxed">
              Engineering solutions for the world's most pressing challenges.
              Where high-tech meets high-purpose.
            </p>

            {/* Strategic Capabilities Grid - Filling the empty space */}
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-1">
              {capabilities.map((cap, i) => (
                <motion.div
                  key={cap.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="group relative flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all hover:bg-white/[0.05]"
                >
                  <div className="absolute left-0 top-0 h-full w-1 origin-bottom scale-y-0 bg-[#8D36D5] transition-transform group-hover:scale-y-100" />
                  <span className="text-xs font-black tracking-widest text-zinc-300 group-hover:text-[#8D36D5]">[{cap.label}]</span>
                  <p className="text-xs text-zinc-500 group-hover:text-zinc-400">{cap.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right Side: Overlapping Cards */}
        <div className="lg:col-span-12 xl:col-span-7 relative pt-12 lg:pt-0">
          <div className="flex flex-col gap-12 lg:flex-row lg:relative lg:h-[600px]">
            {cards.map((card, idx) => (
              <motion.article
                key={card.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: idx * 0.2, ease: [0.16, 1, 0.3, 1] }}
                className={`relative group max-w-md ${
                  idx === 1 ? "xl:absolute xl:bottom-0 xl:right-0" : "xl:absolute xl:top-0 xl:left-0"
                }`}
              >
                <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-[#8D36D5]/20 to-transparent blur-xl opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative overflow-hidden rounded-[2.2rem] border border-white/10 bg-black/60 p-10 backdrop-blur-3xl transition-all duration-500 group-hover:border-[#8D36D5]/40 group-hover:bg-black/40">
                  <div className={`absolute -right-4 -top-4 text-9xl font-black transition-colors ${
                    card.accent === 'fuchsia' ? 'text-[#8D36D5]/[0.02] group-hover:text-[#8D36D5]/[0.08]' : 'text-[#46067A]/[0.02] group-hover:text-[#46067A]/[0.08]'
                  }`}>
                    {card.index}
                  </div>
                  
                  <h3 className={`text-3xl font-bold uppercase tracking-wide ${
                    card.accent === 'fuchsia' ? 'text-[#8D36D5]' : 'text-[#46067A]'
                  }`}>
                    {card.title}
                  </h3>
                  <p className="mt-6 text-lg leading-relaxed text-zinc-400">
                    {card.text}
                  </p>
                  
                  <div className={`mt-8 h-[2px] w-12 transition-all duration-700 group-hover:w-full ${
                    card.accent === 'fuchsia' ? 'bg-[#8D36D5]/50' : 'bg-[#46067A]/50'
                  }`} />
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}