"use client";

import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform, useScroll } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function HeroSection() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // 3D Card Animation Values
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  // Scroll Parallax Logic
  const { scrollY } = useScroll();
  const titleY = useTransform(scrollY, [0, 500], [0, -100]);
  const cardY = useTransform(scrollY, [0, 500], [0, 100]);
  const glowOpacity = useTransform(scrollY, [0, 300], [1, 0]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;

      // For background parallax
      setMousePos({
        x: (clientX / innerWidth - 0.5) * 40,
        y: (clientY / innerHeight - 0.5) * 40,
      });

      // For 3D card
      x.set(clientX / innerWidth - 0.5);
      y.set(clientY / innerHeight - 0.5);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [x, y]);

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
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  return (
    <section 
      id="hero" 
      className="relative grid min-h-[92dvh] grid-cols-1 items-center overflow-x-hidden px-6 pb-10 pt-24 font-[var(--font-body)] scroll-mt-28 sm:grid-cols-2 sm:gap-10 sm:px-10 sm:pt-28 lg:px-14"
    >
      {/* Precision HUD Background Layer */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(141,54,213,0.05)_0%,transparent_70%)]" />
      </div>

      {/* Dynamic Background Glows with Parallax */}
      <motion.div
        animate={{ x: mousePos.x, y: mousePos.y }}
        style={{ opacity: glowOpacity }}
        className="pointer-events-none absolute left-[-28vw] top-16 h-[36rem] w-[36rem] bg-[#8D36D5]/18 blur-[140px]"
      />
      <motion.div
        animate={{ x: -mousePos.x, y: -mousePos.y }}
        style={{ opacity: glowOpacity }}
        className="pointer-events-none absolute right-20 bottom-20 h-96 w-96 rounded-full bg-[#46067A]/20 blur-[120px]"
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ y: titleY }}
        className="relative z-10 flex flex-col items-start text-left"
      >
        <motion.div
          variants={itemVariants}
          className="mt-2 max-w-xl border-l-2 border-[#8D36D5]/30 pl-6"
        >
          <div className="mb-8 flex justify-start">
            <Image
              src="/logo-w.png"
              alt="AI4 Impact logo"
              width={1587}
              height={940}
              sizes="(max-width: 640px) 78vw, (max-width: 1024px) 280px, 340px"
              className="h-auto w-[min(78vw,220px)] sm:w-[min(42vw,280px)] lg:w-[340px]"
              style={{ filter: "drop-shadow(0 0 24px rgba(141, 54, 213, 0.3))" }}
              priority
            />
          </div>

          <p className="font-[var(--font-heading)] text-[clamp(0.96rem,1.9vw,1.25rem)] font-normal uppercase tracking-[0.06em] leading-[1.55] text-zinc-300">
            Build practical AI solutions for real-world social impact with mentors, domain experts, and creators.
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="mt-12 flex flex-col items-start justify-center gap-5"
        >
          <Link
            href="/problem-statements"
            className="group relative inline-flex items-center overflow-hidden rounded-[4px] border border-cyan-400/35 bg-cyan-500/10 px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200 transition-all hover:bg-cyan-500/20 hover:text-white"
          >
            <span className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 bg-[linear-gradient(90deg,rgba(0,255,255,0.08),rgba(141,54,213,0.12),rgba(0,255,255,0.08))]" />
            <span className="relative">Click Here To See Problem Statements</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 bg-[#8D36D5] animate-pulse" />
            <p className="font-[var(--font-body)] text-[0.78rem] font-bold uppercase tracking-[0.2em] text-zinc-500 sm:text-[0.86rem]">APRIL 15 - APRIL 18, 2026</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Main Visual - Command Center Card on Mobile */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ y: cardY }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] as const }}
        className="relative group flex h-full w-full items-center justify-center perspective-1000"
      >
        <motion.div
          style={{ rotateX, rotateY }}
          className="relative w-[min(78vw,28rem)] preserve-3d hardware-accelerated transition-transform duration-200 sm:w-[min(38vw,33rem)]"
        >
          {/* Corner Brackets */}
          <div className="absolute -left-2 -top-2 h-8 w-8 border-l-2 border-t-2 border-[#8D36D5] transition-all duration-500 sm:border-[#8D36D5]/40 sm:group-hover:h-12 sm:group-hover:w-12 sm:group-hover:border-[#8D36D5]" />
          <div className="absolute -bottom-2 -right-2 h-8 w-8 border-b-2 border-r-2 border-[#8D36D5] transition-all duration-500 sm:border-[#8D36D5]/40 sm:group-hover:h-12 sm:group-hover:w-12 sm:group-hover:border-[#8D36D5]" />

          <div className="relative overflow-hidden rounded-xl border border-white/5 bg-black/40 p-6 backdrop-blur-3xl transition-all duration-500 group-hover:border-white/10 group-hover:bg-white/[0.02] sm:p-10">
            <div className="scanning-ray opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative mx-auto flex max-w-[140px] items-center justify-center p-2 sm:max-w-sm sm:p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/site-icon.png"
                alt="AI4 Impact site icon"
                className="h-auto w-full max-w-[280px] object-contain"
                style={{
                  filter: "drop-shadow(0 0 40px rgba(141, 54, 213, 0.35))",
                  transform: "translateZ(40px)",
                }}
              />
            </div>

            {/* Mobile Decorative Labels */}
            <div className="mt-8 flex flex-col items-center gap-2 sm:hidden">
              <div className="h-px w-8 bg-white/10" />
              <p className="text-[7px] font-black tracking-[0.5em] text-zinc-500 uppercase">LAT: 17.3850 N / LONG: 78.4867 E</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
