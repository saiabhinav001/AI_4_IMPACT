"use client";

import { motion } from "framer-motion";

const cards = [
  {
    title: "The Gap",
    text: "Critical impact sectors still struggle to translate AI prototypes into deployable and ethical products that communities can trust.",
    icon: "01",
  },
  {
    title: "Our Approach",
    text: "Teams pair with challenge owners and mentors to move from idea to tested proof-of-impact through rapid design, validation, and demos.",
    icon: "02",
  },
];

export default function AboutSection() {
  return (
    <section id="about" className="py-20">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mb-10"
      >
        <h2 className="bg-gradient-to-r from-white to-fuchsia-300 bg-clip-text text-4xl font-black uppercase tracking-tight text-transparent sm:text-5xl">
          Mission <span className="text-zinc-500">_01</span>
        </h2>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        {cards.map((card, idx) => (
          <motion.article
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: idx * 0.2 }}
            className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/40 p-10 backdrop-blur-xl transition-all duration-500 hover:border-fuchsia-500/30"
          >
            <div className="absolute -right-4 -top-4 text-8xl font-black text-white/[0.03] transition-colors group-hover:text-fuchsia-500/10">
              {card.icon}
            </div>
            <h3 className="text-3xl font-bold uppercase tracking-wide text-cyan-300">
              {card.title}
            </h3>
            <p className="mt-4 text-lg leading-relaxed text-zinc-400">
              {card.text}
            </p>
            <div className="mt-6 h-1 w-12 bg-fuchsia-500/50 transition-all duration-500 group-hover:w-full" />
          </motion.article>
        ))}
      </div>
    </section>
  );
}