"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Timeline } from "../ui/timeline";

type EventItem = {
  label: string;
  title: string;
  detail: string;
  start: Date;
  end: Date;
};

const events: EventItem[] = [
  {
    label: "APRIL 15 | 09:00",
    title: "Workshop Day 1",
    detail: "Architecting and AI fundamentals: Frontend/UI UX, API ecosystems, and Cloud Functions.",
    start: new Date("2026-04-15T09:00:00"),
    end: new Date("2026-04-15T16:00:00"),
  },
  {
    label: "APRIL 15 | 23:59",
    title: "Registration Ends",
    detail: "Final deadline for hackathon signup and team formation.",
    start: new Date("2026-04-15T17:56:00"),
    end: new Date("2026-04-15T23:59:59"),
  },
  {
    label: "APRIL 16 | 09:00",
    title: "Workshop Day 2",
    detail: "ML and AI implementation: deep dive into ML models, LLMs, and RAG architectures.",
    start: new Date("2026-04-16T09:00:00"),
    end: new Date("2026-04-16T16:00:00"),
  },
  {
    label: "APRIL 17 | 09:30",
    title: "Inauguration",
    detail: "Official kickoff and problem statement selection phase.",
    start: new Date("2026-04-17T09:30:00"),
    end: new Date("2026-04-17T11:00:00"),
  },
  {
    label: "APRIL 17 | 11:00",
    title: "Hackathon Starts",
    detail: "Development phase begins. Teams start building active prototypes.",
    start: new Date("2026-04-17T11:00:00"),
    end: new Date("2026-04-17T23:59:59"),
  },
  {
    label: "APRIL 17 | 18:00",
    title: "Initial Mentoring",
    detail: "First round of technical reviews and mentor guidance.",
    start: new Date("2026-04-17T18:00:00"),
    end: new Date("2026-04-17T20:00:00"),
  },
  {
    label: "APRIL 18 | 01:00",
    title: "Technical Review",
    detail: "Late-night progress check and system architecture validation.",
    start: new Date("2026-04-18T01:00:00"),
    end: new Date("2026-04-18T03:00:00"),
  },
  {
    label: "APRIL 18 | 13:00",
    title: "Grand Pitch",
    detail: "Teams present their impact-driven AI solutions to the jury.",
    start: new Date("2026-04-18T13:00:00"),
    end: new Date("2026-04-18T16:00:00"),
  },
  {
    label: "APRIL 18 | 16:30",
    title: "Victory Ceremony",
    detail: "Winning teams declared and awards distributed.",
    start: new Date("2026-04-18T16:30:00"),
    end: new Date("2026-04-18T18:00:00"),
  },
];

export default function TimelineSection() {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [completedIndices, setCompletedIndices] = useState<number[]>([]);

  useEffect(() => {
    const updateProgress = () => {
      const now = new Date();
      let active = -1;
      const completed: number[] = [];

      events.forEach((event, idx) => {
        if (now >= event.start && now <= event.end) {
          active = idx;
        } else if (now > event.end) {
          completed.push(idx);
        }
      });

      setActiveIndex(active);
      setCompletedIndices(completed);
    };

    updateProgress();
    const interval = setInterval(updateProgress, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const data = events.map((item, idx) => {
    const isActive = idx === activeIndex;
    return {
      title: item.label,
      content: (
        <div className={`group relative w-full rounded-[4px] border transition-all duration-300 md:max-w-xl ${
          isActive 
            ? "border-[#6B21A8] bg-[#6B21A8] shadow-none -translate-y-1" 
            : "border-white/5 bg-white/[0.01] shadow-[0_0_24px_rgba(141,54,213,0.1)]"
        }`} >
          {/* Corner Brackets */}
          <div className={`absolute -left-2 -top-2 h-8 w-8 border-l-2 border-t-2 transition-all duration-500 sm:group-hover:h-12 sm:group-hover:w-12 ${
            isActive
              ? "border-[#FF6AC1] sm:group-hover:border-[#FF6AC1]"
              : "border-[#8D36D5] sm:border-[#8D36D5]/40 sm:group-hover:border-[#8D36D5]"
          }`} />
          <div className={`absolute -bottom-2 -right-2 h-8 w-8 border-b-2 border-r-2 transition-all duration-500 sm:group-hover:h-12 sm:group-hover:w-12 ${
            isActive
              ? "border-[#FF6AC1] sm:group-hover:border-[#FF6AC1]"
              : "border-[#8D36D5] sm:border-[#8D36D5]/40 sm:group-hover:border-[#8D36D5]"
          }`} />
          <div className="relative z-10 flex h-full flex-col rounded-[4px] p-6 lg:p-8">
            <div className={`scanning-ray ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"}`} />
            
            <div className="mb-4" />

            <h3 className={`relative z-10 text-xl font-black uppercase tracking-[0.08em] transition-colors duration-300 sm:text-2xl ${
              isActive ? "text-white" : "text-white group-hover:text-[#c084fc]"
            }`}>
              {item.title}
            </h3>
            <p className={`relative z-10 mt-3 text-sm leading-relaxed transition-colors duration-300 sm:text-base ${
              isActive ? "text-zinc-100" : "text-zinc-400"
            }`}>
              {item.detail}
            </p>
          </div>
        </div>
      ),
    };
  });

  return (
    <section id="timeline" className="landing-section" style={{ transformStyle: "preserve-3d" }}>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
        className="mb-6 px-0 sm:px-8 lg:mb-8 lg:px-12"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="type-h2 font-black tracking-tighter text-white">
            THE <span className="bg-gradient-to-r from-[#8D36D5] to-[#46067A] bg-clip-text text-transparent italic">TIMELINE</span>
          </h2>
        </div>
      </motion.div>

      <div className="px-0 py-4 sm:px-8 sm:py-6 lg:px-12 lg:py-8">
        <div className="mb-10 h-[1px] w-12 bg-[#8D36D5]" />

        <Timeline 
          data={data} 
          activeIndex={activeIndex}
          completedIndices={completedIndices}
        />
      </div>
    </section>
  );
}