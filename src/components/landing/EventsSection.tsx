"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Cpu, Terminal, Zap, Shield } from "lucide-react";
import { TextReveal } from "../ui/text-reveal";
import { MagneticWrapper } from "../ui/magnetic-wrapper";

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
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <section id="events" className="pt-10 pb-20 relative scroll-mt-32">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mb-12"
      >
        <div className="mb-6 h-[1px] w-8 bg-[#8D36D5]" />
        <TextReveal 
          text="THE FLOW"
          className="text-5xl font-black uppercase tracking-tighter text-white sm:text-7xl lg:text-8xl"
        />
      </motion.div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="grid gap-12"
      >
        {events.map((event, idx) => {
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
            <motion.article
              key={event.title}
              variants={itemVariants}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
              className="group relative"
            >
              {/* Holographic Corner Brackets */}
              <div className="absolute -left-2 -top-2 h-8 w-8 border-l-2 border-t-2 border-[#8D36D5]/40 transition-all duration-500 group-hover:border-[#8D36D5] group-hover:h-12 group-hover:w-12" />
              <div className="absolute -right-2 -bottom-2 h-8 w-8 border-r-2 border-b-2 border-[#8D36D5]/40 transition-all duration-500 group-hover:border-[#8D36D5] group-hover:h-12 group-hover:w-12" />
              
              <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.01] p-6 backdrop-blur-3xl transition-all duration-500 group-hover:bg-white/[0.03] group-hover:border-white/10 sm:p-8">
                {/* Scanning Ray */}
                <div className="scanning-ray opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
                  <div className="flex-1" style={{ transform: "translateZ(30px)" }}>
                    <div className="mb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8D36D5]/10 text-[#8D36D5] border border-[#8D36D5]/20">
                        {event.icon}
                      </div>
                    </div>
                    
                    <h3 className="text-4xl font-black uppercase tracking-tighter text-white group-hover:text-[#8D36D5] transition-colors">
                      {event.title}
                    </h3>
                    <p className="mt-4 text-lg text-zinc-500 max-w-xl group-hover:text-zinc-300 transition-colors">
                      {event.detail}
                    </p>
                  </div>

                  {/* Data Expansion Specs */}
                  <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end" style={{ transform: "translateZ(40px)" }}>
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
          );
        })}
      </motion.div>
      
    </section>
  );
}