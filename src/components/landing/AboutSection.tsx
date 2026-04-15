"use client";

import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
import { useRef } from "react";
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
    text: "Most hackathons end as unfinished demos. No users. No validation. No real impact.",
    index: "01",
    tag: "PROBLEM_STATEMENT"
  },
  {
    title: "Strategic Impact",
    text: "At AI4 Impact, you build with mentors, validate with experts, and ship something that actually works.",
    index: "02",
    tag: "SOLUTION_LAYER"
  },
];

function MissionPillarCard({
  pillar,
  idx,
}: {
  pillar: (typeof missionPillars)[number];
  idx: number;
}) {
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
      transition={{ duration: 0.8, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] as const }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className="group relative lg:col-span-6"
    >
      {/* Corner Brackets */}
      <div className="absolute -left-2 -top-2 h-8 w-8 border-l-2 border-t-2 border-[#8D36D5] transition-all duration-500 sm:border-[#8D36D5]/40 sm:group-hover:h-12 sm:group-hover:w-12 sm:group-hover:border-[#8D36D5]" />
      <div className="absolute -bottom-2 -right-2 h-8 w-8 border-b-2 border-r-2 border-[#8D36D5] transition-all duration-500 sm:border-[#8D36D5]/40 sm:group-hover:h-12 sm:group-hover:w-12 sm:group-hover:border-[#8D36D5]" />
      <div className="relative h-full overflow-hidden rounded-xl border border-white/5 bg-white/[0.01] p-6 backdrop-blur-3xl transition-all duration-500 group-hover:border-white/10 group-hover:bg-white/[0.03] sm:p-12">
        <div className="scanning-ray opacity-40 transition-opacity sm:opacity-0 sm:group-hover:opacity-100" />

        <div className="relative z-10 mb-8 flex items-start justify-between" style={{ transform: "translateZ(30px)" }}>
          <span className="text-[10px] font-black tracking-[0.3em] text-[#8D36D5]">{pillar.tag}</span>
          <span className="text-3xl font-black text-white/10 transition-colors sm:text-4xl sm:group-hover:text-[#8D36D5]/20">/{pillar.index}</span>
        </div>
        <h3 className="type-h3 relative z-10 mb-4 font-black tracking-tight text-white group-hover:animate-glitch sm:mb-6" style={{ transform: "translateZ(40px)" }}>
          {pillar.title}
        </h3>
        <p className="type-body relative z-10 font-medium text-zinc-400" style={{ transform: "translateZ(20px)" }}>
          {pillar.text}
        </p>
        <div className="relative z-10 mt-10 h-[1px] w-12 bg-white/10 transition-all duration-1000 group-hover:w-full group-hover:bg-[#8D36D5]/50" />
      </div>
    </motion.div>
  );
}

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
      className="landing-section overflow-hidden"
    >
      {/* Subtle Background Texture */}
      <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_center,_#fff_1px,_transparent_1px)] bg-[length:40px_40px] pointer-events-none" />

      <motion.div
        style={{ x: xText }}
        className="absolute top-20 whitespace-nowrap text-[15vw] font-black uppercase tracking-tighter text-white/[0.05] pointer-events-none select-none"
      >
        AI_4_IMPACT // REGISTER_NOW // BUILD_THE_FUTURE
      </motion.div>

      <div className="relative z-10 max-w-7xl mx-auto px-2 sm:px-8 lg:px-12">
        {/* Header Block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
          className="mb-10 md:mb-14"
        >
          <div className="mb-6 h-[1px] w-12 bg-[#8D36D5]" />
          <TextReveal
            text="THE WHY"
            className="type-h2 font-black text-white"
          />
        </motion.div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-12 lg:gap-8">

          {missionPillars.map((pillar, idx) => (
            <MissionPillarCard key={pillar.title} pillar={pillar} idx={idx} />
          ))}

          {/* Capabilities - Three Smaller Bento Cards */}
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.label}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 + (i * 0.1), ease: [0.16, 1, 0.3, 1] as const }}
              className="lg:col-span-4 group relative"
            >
              {/* Corner Brackets */}
              <div className="absolute -left-2 -top-2 h-8 w-8 border-l-2 border-t-2 border-[#8D36D5] transition-all duration-500 sm:border-[#8D36D5]/40 sm:group-hover:h-12 sm:group-hover:w-12 sm:group-hover:border-[#8D36D5]" />
              <div className="absolute -bottom-2 -right-2 h-8 w-8 border-b-2 border-r-2 border-[#8D36D5] transition-all duration-500 sm:border-[#8D36D5]/40 sm:group-hover:h-12 sm:group-hover:w-12 sm:group-hover:border-[#8D36D5]" />
              <div className="relative h-full overflow-hidden rounded-xl border border-white/5 bg-white/[0.01] p-6 backdrop-blur-3xl transition-all duration-500 group-hover:border-white/10 group-hover:bg-white/[0.03] sm:p-8\">
                {/* HUD Scan Effect */}
                <div className="scanning-ray opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />

                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#8D36D5] animate-pulse" />
                  <span className="text-[9px] font-bold tracking-[0.4em] text-zinc-500 uppercase">{cap.icon}</span>
                </div>
                <h4 className="type-h3 relative z-10 mb-2 font-black tracking-wide text-white sm:mb-3">
                  {cap.label}
                </h4>
                <p className="type-body-sm relative z-10 text-zinc-500">
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