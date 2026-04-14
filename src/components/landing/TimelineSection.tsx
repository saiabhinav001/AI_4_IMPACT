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
      <div className="group relative w-full overflow-hidden rounded-2xl border border-[#8D36D5]/40 bg-[linear-gradient(120deg,rgba(70,6,122,0.35),rgba(141,54,213,0.16))] p-[1px] shadow-[0_0_24px_rgba(141,54,213,0.15)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(141,54,213,0.4)] md:max-w-xl">
        <div className="relative z-10 flex h-full flex-col rounded-2xl bg-black/70 p-6 backdrop-blur-md lg:p-8">
          <h3 className="text-xl font-bold uppercase tracking-[0.08em] text-white transition-colors duration-300 group-hover:text-[#c084fc] sm:text-2xl">
            {item.title}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300 sm:text-base">
            {item.detail}
          </p>
        </div>
      </div>
    ),
  }));

  return (
    <section id="timeline" className="bg-black py-16 lg:py-20">
      <div className="mb-8 lg:mb-10">
        <h2 className="bg-[linear-gradient(90deg,#46067A,#8D36D5)] bg-clip-text text-4xl font-black uppercase tracking-tight text-transparent sm:text-5xl">
          Strategic Timeline <span className="text-zinc-500">_02</span>
        </h2>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-black/70 p-4 backdrop-blur-xl sm:p-6 lg:p-8">
        <div className="mb-6">
          <span className="rounded-full bg-[linear-gradient(90deg,#46067A,#8D36D5)] px-4 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
            AI4IMPACT Event Flow
          </span>
        </div>

        {/* The Aceternity Timeline component infused with our data */}
        <Timeline data={data} />
      </div>
    </section>
  );
}