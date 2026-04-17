"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Cpu, Terminal } from "lucide-react";
import { TextReveal } from "../ui/text-reveal";

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
  {
    title: "Runtime Timer",
    detail: "Track the official hackathon countdown in real time from the public timer board.",
    type: "LIVE_MONITOR",
    specs: ["LIVE_CLOCK", "ADMIN_SYNC", "PUBLIC_VIEW"],
    icon: <Cpu size={16} />,
    href: "/timer",
  },
];

function EventCard({
  event,
  itemVariants,
}: {
  event: (typeof events)[number];
  itemVariants: any;
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
    <motion.article
      key={event.title}
      variants={itemVariants}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className="group relative"
    >
      <div className="absolute -left-2 -top-2 h-8 w-8 border-l-2 border-t-2 border-[#8D36D5] transition-all duration-500 sm:border-[#8D36D5]/40 sm:group-hover:h-12 sm:group-hover:w-12 sm:group-hover:border-[#8D36D5]" />
      <div className="absolute -bottom-2 -right-2 h-8 w-8 border-b-2 border-r-2 border-[#8D36D5] transition-all duration-500 sm:border-[#8D36D5]/40 sm:group-hover:h-12 sm:group-hover:w-12 sm:group-hover:border-[#8D36D5]" />

      <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.01] p-6 backdrop-blur-3xl transition-all duration-500 group-hover:border-white/10 group-hover:bg-white/[0.03] sm:p-8">
        <div className="scanning-ray opacity-40 transition-opacity sm:opacity-0 sm:group-hover:opacity-100" />

        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div className="flex-1" style={{ transform: "translateZ(30px)" }}>
            <div className="mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#8D36D5]/20 bg-[#8D36D5]/10 text-[#8D36D5]">
                {event.icon}
              </div>
            </div>

            <h3 className="type-h3 font-black tracking-tighter text-white transition-colors group-hover:text-[#8D36D5]">
              {event.title}
            </h3>
            <p className="type-body mt-4 max-w-xl text-zinc-500 transition-colors group-hover:text-zinc-300">
              {event.detail}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end" style={{ transform: "translateZ(40px)" }}>
            {event.specs.map((spec) => (
              <div
                key={spec}
                className="rounded-md border border-white/5 bg-black/40 px-3 py-1 text-[9px] font-bold tracking-[0.2em] text-zinc-500 transition-all group-hover:border-[#8D36D5]/30 group-hover:bg-[#8D36D5]/5 group-hover:text-[#8D36D5]"
              >
                {spec}
              </div>
            ))}
              {event.href ? (
                <a
                  href={event.href}
                  className="mt-1 inline-flex items-center rounded-md border border-[#8D36D5]/40 bg-[#8D36D5]/10 px-3 py-1 text-[9px] font-black tracking-[0.2em] text-[#d7b5f4] transition-all hover:border-[#8D36D5] hover:bg-[#8D36D5]/20"
                >
                  OPEN_TIMER_BOARD
                </a>
              ) : null}
            <div className="mt-2 hidden items-center gap-2 lg:flex">
              <span className="h-1 w-1 animate-pulse rounded-full bg-[#8D36D5]" />
              <span className="text-[8px] font-black uppercase tracking-[0.4em] text-[#8D36D5]/50">LINK_ESTABLISHED</span>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

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
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  return (
    <section id="events" className="landing-section px-2 sm:px-8 lg:px-12 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
        className="mb-10"
      >
        <div className="mb-6 h-[1px] w-8 bg-[#8D36D5]" />
        <TextReveal 
          text="THE FLOW"
          className="type-h2 font-black tracking-tighter text-white"
        />
      </motion.div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="grid gap-6 md:gap-8"
      >
        {events.map((event) => (
          <EventCard key={event.title} event={event} itemVariants={itemVariants} />
        ))}
      </motion.div>
      
    </section>
  );
}