"use client";

import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
import { useRef, useState } from "react";
import { TextReveal } from "../ui/text-reveal";

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

      <motion.div
        style={{ x: xText }}
        className="absolute top-20 whitespace-nowrap text-[12vw] font-black uppercase tracking-tighter text-white/[0.02] pointer-events-none select-none"
      >
        AI_4_IMPACT // REGISTER_NOW
      </motion.div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Header Block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-16 lg:mb-24"
        >
          <div className="mb-6 h-[1px] w-12 bg-[#8D36D5]" />
          <TextReveal 
            text="THE WHY"
            className="text-5xl font-black uppercase tracking-tighter text-white sm:text-7xl lg:text-8xl leading-[0.85]"
          />
        </motion.div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 lg:gap-8">

          {missionPillars.map((pillar, idx) => {
            const x = useMotionValue(0);
            const y = useMotionValue(0);
            const mouseXSpring = useSpring(x);
            const mouseYSpring = useSpring(y);
            const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["5deg", "-5deg"]);
            const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-5deg", "5deg"]);

            const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const width = rect.width;
              const height = rect.height;
              const mouseX = e.clientX - rect.left;
              const mouseY = e.clientY - rect.top;
              const xPct = mouseX / width - 0.5;
              const yPct = mouseY / height - 0.5;
              x.set(xPct);
              y.set(yPct);
            };

            const handleMouseLeave = () => {
              x.set(0);
              y.set(0);
            };

            return (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                className="lg:col-span-6 group relative"
              >
                <div className="absolute -inset-[1px] rounded-[2rem] bg-gradient-to-br from-[#8D36D5]/20 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
                <div className="relative h-full overflow-hidden rounded-[2rem] border border-white/5 bg-white/[0.03] p-6 sm:p-12 backdrop-blur-sm transition-all duration-500 group-hover:bg-white/[0.05]">
                  <div className="scanning-ray opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="flex justify-between items-start mb-8 relative z-10" style={{ transform: "translateZ(30px)" }}>
                    <span className="text-[10px] font-black tracking-[0.3em] text-[#8D36D5]">{pillar.tag}</span>
                    <span className="text-4xl font-black text-white/10 group-hover:text-[#8D36D5]/20 transition-colors">/{pillar.index}</span>
                  </div>
                  <h3 className="text-3xl font-black uppercase tracking-tight text-white mb-6 group-hover:animate-glitch relative z-10" style={{ transform: "translateZ(40px)" }}>
                    {pillar.title}
                  </h3>
                  <p className="text-lg text-zinc-400 leading-relaxed font-medium relative z-10" style={{ transform: "translateZ(20px)" }}>
                    {pillar.text}
                  </p>
                  <div className="mt-10 h-[1px] w-12 bg-white/10 group-hover:w-full group-hover:bg-[#8D36D5]/50 transition-all duration-1000 relative z-10" />
                </div>
              </motion.div>
            );
          })}

          {/* Capabilities - Three Smaller Bento Cards */}
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.label}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 + (i * 0.1), ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-4 group relative"
            >
              <div className="relative h-full overflow-hidden rounded-[1.5rem] border border-white/5 bg-white/[0.02] p-6 transition-all hover:bg-white/[0.04] sm:p-8">
                {/* HUD Scan Effect */}
                <div className="scanning-ray opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#8D36D5] animate-pulse" />
                  <span className="text-[9px] font-bold tracking-[0.4em] text-zinc-500 uppercase">{cap.icon}</span>
                </div>
                <h4 className="text-xl font-black uppercase tracking-wide text-white mb-3 relative z-10">
                  {cap.label}
                </h4>
                <p className="text-sm text-zinc-500 leading-relaxed relative z-10">
                  {cap.desc}
                </p>

                {/* Technical HUD Accents */}
                <div className="absolute top-4 right-4 h-2 w-2 border-t border-r border-white/10 z-10" />
                <div className="absolute bottom-4 left-4 h-2 w-2 border-b border-l border-white/10 z-10" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}