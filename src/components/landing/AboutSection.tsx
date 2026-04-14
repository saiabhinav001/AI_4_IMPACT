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
      className="relative py-32 overflow-hidden scroll-mt-32"
      style={{ 
        background: 'linear-gradient(135deg, #46067A 0%, #8D36D5 100%)',
        boxShadow: '0 0 100px rgba(141, 54, 213, 0.2)'
      }}
    >
      {/* Decorative Overlays */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_#fff_1px,_transparent_1px)] bg-[length:40px_40px]" />
      <div className="absolute inset-0 bg-black/20" />

      {/* Kinetic Background Text */}
      <motion.div 
        style={{ x: xText }}
        className="absolute top-10 whitespace-nowrap text-[12vw] font-black uppercase tracking-tighter text-white/[0.05] pointer-events-none select-none"
      >
        MISSION_PROTOCOL_2026 // SOCIAL_IMPACT_LAYER // 
      </motion.div>

      <div className="relative z-10 grid gap-20 lg:grid-cols-12 px-8 sm:px-12 lg:px-20">
        {/* Left Side: Header & Capabilities */}
        <div className="lg:col-span-12 xl:col-span-5">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px w-12 bg-white/40" />
              <span className="text-[12px] font-black tracking-[0.4em] text-white/80">CORE_OBJECTIVE</span>
            </div>
            <h2 className="text-6xl font-black uppercase tracking-tighter text-white sm:text-7xl lg:text-8xl leading-[0.9]">
              THE <span className="text-white/40">WHY</span>
            </h2>
            <p className="mt-8 text-xl text-white/70 max-w-sm font-medium leading-relaxed">
              Engineering solutions for the world's most pressing challenges.
              Where high-tech meets high-purpose.
            </p>

            {/* Strategic Capabilities Grid */}
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-1">
              {capabilities.map((cap, i) => (
                <motion.div
                  key={cap.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="group relative flex flex-col gap-2 rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-md transition-all hover:bg-white/20"
                >
                  <div className="absolute left-0 top-0 h-full w-1 origin-bottom scale-y-0 bg-white transition-transform group-hover:scale-y-100" />
                  <span className="text-sm font-black tracking-widest text-white">[{cap.label}]</span>
                  <p className="text-xs text-white/70 font-medium group-hover:text-white transition-colors">{cap.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right Side: Overlapping Cards */}
        <div className="lg:col-span-12 xl:col-span-7 relative pt-12 lg:pt-0">
          <div className="flex flex-col gap-12 lg:flex-row lg:relative lg:h-[600px] lg:items-center">
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
                <div className="absolute -inset-1 rounded-[2.5rem] bg-white/20 blur-xl opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative overflow-hidden rounded-[2.5rem] border border-white/30 bg-black/40 p-12 backdrop-blur-3xl transition-all duration-500 group-hover:border-white/60 group-hover:bg-black/60">
                  <div className={`absolute -right-4 -top-4 text-9xl font-black text-white/[0.05] transition-colors group-hover:text-white/[0.1]`}>
                    {card.index}
                  </div>
                  
                  <h3 className="text-4xl font-black uppercase tracking-tight text-white">
                    {card.title}
                  </h3>
                  <p className="mt-6 text-xl leading-relaxed text-white/80 font-medium">
                    {card.text}
                  </p>
                  
                  <div className="mt-10 h-[2px] w-16 bg-white transition-all duration-700 group-hover:w-full" />
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}