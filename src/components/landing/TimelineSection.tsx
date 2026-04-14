"use client";

import { Timeline } from "../ui/timeline";

type EventItem = {
  label: string;
  title: string;
  detail: string;
};

const events: EventItem[] = [
  {
    label: "DAY 1 | 9AM-4PM",
    title: "Workshop Day 1",
    detail: "Architecting and AI fundamentals: Frontend/UI UX, API ecosystems, and Cloud Functions.",
  },
  {
    label: "DAY 1 | 11:59PM",
    title: "Hackathon Registration Ends",
    detail: "Final deadline for hackathon signup.",
  },
  {
    label: "DAY 2 | 9AM-4PM",
    title: "Workshop Day 2",
    detail: "ML and AI implementation: deep dive into ML models, LLMs, and RAG architectures.",
  },
  {
    label: "DAY 3 | 9:30AM-11:00AM",
    title: "Inauguration and PS Selection",
    detail: "Official kickoff; teams select problem statements.",
  },
  {
    label: "DAY 3 | 11:00AM",
    title: "Hackathon Starts",
    detail: "Teams begin hacking.",
  },
  {
    label: "DAY 3 | 6:00PM-8:00PM",
    title: "First Review",
    detail: "Progress check; hacking continues.",
  },
  {
    label: "DAY 4 | 1:00AM-2:00AM",
    title: "Second Review",
    detail: "Deep check; hack into the night.",
  },
  {
    label: "DAY 4 | 1:00PM-4:00PM",
    title: "Presentations",
    detail: "Teams pitch solutions to judges.",
  },
  {
    label: "DAY 4 | 4:00PM-5:00PM",
    title: "Winner Declaration",
    detail: "Awards and felicitation.",
  },
];

export default function TimelineSection() {
  const data = events.map((item) => ({
    // Aceternity maps 'title' to the big sticky text on the left
    title: item.label,
    // Aceternity maps 'content' to the right side content container
    content: (
      <div className="group relative w-full overflow-hidden rounded-2xl border border-[#8D36D5]/40 bg-white/[0.02] p-[1px] shadow-[0_0_24px_rgba(141,54,213,0.1)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(141,54,213,0.3)] md:max-w-xl">
        <div className="relative z-10 flex h-full flex-col rounded-2xl bg-black/40 p-6 backdrop-blur-md lg:p-8">
          <div className="scanning-ray opacity-0 group-hover:opacity-100 transition-opacity" />
          <h3 className="relative z-10 text-xl font-black uppercase tracking-[0.08em] text-white transition-colors duration-300 group-hover:text-[#c084fc] sm:text-2xl">
            {item.title}
          </h3>
          <p className="relative z-10 mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
            {item.detail}
          </p>
          <div className="mt-6 flex items-center gap-2 relative z-10">
            <div className="h-1 w-1 rounded-full bg-[#8D36D5]" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#8D36D5]/60 uppercase">OPERATIONAL_DATA_LOADED</span>
          </div>
        </div>
      </div>
    ),
  }));

  return (
    <section id="timeline" className="bg-black py-16 lg:py-20 scroll-mt-32">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8 lg:mb-10"
      >
        <h2 className="text-5xl font-black uppercase tracking-tighter text-white sm:text-7xl lg:text-8xl">
          THE <span className="bg-gradient-to-r from-[#8D36D5] to-[#46067A] bg-clip-text text-transparent italic">TIMELINE</span>
        </h2>
      </motion.div>

      <div className="rounded-[2.5rem] border border-white/5 bg-white/[0.01] p-4 backdrop-blur-3xl sm:p-6 lg:p-12">
        <div className="mb-10 flex items-center gap-4">
          <div className="h-[1px] w-12 bg-[#8D36D5]" />
          <span className="text-[10px] font-black tracking-[0.5em] text-[#8D36D5] uppercase">
            TEMPORAL_SEQUENCE_STREAM
          </span>
        </div>

        {/* The Aceternity Timeline component infused with our data */}
        <Timeline data={data} />
      </div>
    </section>
  );
}