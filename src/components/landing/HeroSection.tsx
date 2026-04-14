"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export default function HeroSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.8, ease: "easeOut" },
    },
  };

  const imageVariants = {
    hidden: { scale: 0.8, opacity: 0, rotate: -5 },
    visible: {
      scale: 1,
      opacity: 1,
      rotate: 0,
      transition: { duration: 1.2, ease: "easeOut" },
    },
  };

  return (
    <section id="hero" className="relative grid min-h-screen items-center gap-8 pt-24 pb-12 md:grid-cols-2 md:gap-12 lg:pt-32">
      {/* Background Glows */}
      <div className="pointer-events-none absolute -left-20 top-20 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute right-20 bottom-20 h-72 w-72 rounded-full bg-cyan-600/20 blur-[120px]" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10"
      >
        <motion.p 
          variants={itemVariants}
          className="mb-6 inline-flex rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-1.5 text-xs font-bold tracking-[0.3em] text-fuchsia-300 backdrop-blur-sm"
        >
          HACKATHON 2026
        </motion.p>
        
        <motion.h1 
          variants={itemVariants}
          className="text-6xl font-black uppercase leading-[0.9] tracking-tighter sm:text-7xl lg:text-8xl"
        >
          <span className="block text-white">AI4</span>
          <span className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent">IMPACT</span>
        </motion.h1>

        <motion.p 
          variants={itemVariants}
          className="mt-8 max-w-xl text-lg text-zinc-400 leading-relaxed sm:text-xl"
        >
          Build practical AI solutions for real-world social impact with mentors, domain experts, and
          creators from across engineering, design, and policy.
        </motion.p>

        <motion.div 
          variants={itemVariants}
          className="mt-10 flex flex-wrap items-center gap-6"
        >
          <a
            href="/auth"
            className="group relative overflow-hidden rounded-2xl bg-white px-8 py-4 text-sm font-bold tracking-[0.18em] text-black transition-all hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500 to-purple-600 opacity-0 transition-opacity group-hover:opacity-10" />
            REGISTER NOW
          </a>
          <div className="flex flex-col">
            <p className="text-[10px] font-bold tracking-[0.2em] text-fuchsia-500 uppercase">Event Date</p>
            <p className="text-sm font-medium tracking-widest text-white">JUNE 24 - JUNE 26</p>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        variants={imageVariants}
        initial="hidden"
        animate="visible"
        className="relative group lg:ml-auto"
      >
        <div className="absolute -inset-1 rounded-[3rem] bg-gradient-to-r from-fuchsia-500/30 to-cyan-500/30 blur-2xl transition duration-1000 group-hover:opacity-100 group-hover:duration-200" />
        <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/40 p-8 backdrop-blur-2xl sm:p-12">
          <Image
            src="/hazard.svg"
            alt="Decorative hazard stripe"
            width={160}
            height={160}
            className="pointer-events-none absolute -right-8 -top-8 opacity-20 grayscale invert"
          />
          <div className="relative mx-auto flex max-w-sm items-center justify-center p-4">
            <Image
              src="/logo-w.svg"
              alt="AI4 Impact logo"
              width={420}
              height={420}
              className="h-auto w-full transition-transform duration-700 group-hover:scale-110"
              style={{ filter: "drop-shadow(0 0 40px rgba(139, 92, 246, 0.3))" }}
              priority
            />
          </div>
        </div>
        
        {/* Floating Decals */}
        <div className="absolute -bottom-6 -left-6 rounded-2xl border border-white/10 bg-black/60 px-4 py-2 text-[10px] font-bold tracking-widest text-cyan-400 backdrop-blur-xl">
          0x_SYSTEM_READY
        </div>
      </motion.div>
    </section>
  );
}