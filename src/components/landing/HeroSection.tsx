"use client";

import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

export default function HeroSection() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // 3D Card Animation Values
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

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
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <section id="hero" className="relative grid min-h-screen items-center gap-8 pt-24 pb-4 md:grid-cols-2 md:gap-12 lg:pt-32 scroll-mt-32">
      {/* Dynamic Background Glows with Parallax */}
      <motion.div 
        animate={{ x: mousePos.x, y: mousePos.y }}
        className="pointer-events-none absolute -left-20 top-20 h-72 w-72 rounded-full bg-[#8D36D5]/10 blur-[120px]" 
      />
      <motion.div 
        animate={{ x: -mousePos.x, y: -mousePos.y }}
        className="pointer-events-none absolute right-20 bottom-20 h-72 w-72 rounded-full bg-[#46067A]/10 blur-[120px]" 
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10"
      >
        <motion.div variants={itemVariants} className="flex items-center gap-4 mb-6">
          <p className="inline-flex rounded-full border border-[#8D36D5]/30 bg-[#8D36D5]/10 px-4 py-1.5 text-[10px] font-bold tracking-[0.4em] text-[#8D36D5] backdrop-blur-sm">
            HACKATHON 2026
          </p>
          <div className="h-[1px] w-12 bg-white/10" />
        </motion.div>
        
        <motion.h1 
          variants={itemVariants}
          className="relative text-5xl font-black uppercase leading-[0.85] tracking-tighter sm:text-7xl lg:text-9xl group"
        >
          <span className="block text-white transition-all group-hover:animate-glitch">AI4</span>
          <span className="bg-gradient-to-r from-[#8D36D5] to-[#46067A] bg-clip-text text-transparent group-hover:animate-glitch">IMPACT</span>
        </motion.h1>

        <motion.p 
          variants={itemVariants}
          className="mt-6 max-w-xl text-base text-zinc-400 leading-relaxed sm:text-xl border-l-2 border-[#8D36D5]/30 pl-6 lg:mt-10"
        >
          Build practical AI solutions for real-world social impact with mentors, domain experts, and
          creators from across engineering, design, and policy.
        </motion.p>

        <motion.div 
          variants={itemVariants}
          className="mt-12 flex flex-wrap items-center gap-8"
        >
          <a
            href="/auth"
            className="group relative overflow-hidden rounded-2xl bg-white px-10 py-5 text-sm font-black tracking-[0.2em] text-black transition-all hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#8D36D5] to-[#46067A] opacity-0 transition-opacity group-hover:opacity-10" />
            REGISTER NOW
          </a>
          <div className="flex flex-col">
            <p className="text-[10px] font-black tracking-[0.5em] text-[#8D36D5] uppercase">TIMELINE_STATUS</p>
            <p className="text-base font-bold tracking-widest text-white mt-1">JUNE 24 - JUNE 26, 2026</p>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative group lg:ml-auto perspective-1000"
      >
        <motion.div
          style={{ rotateX, rotateY }}
          className="relative preserve-3d transition-transform duration-200"
        >
          <div className="absolute -inset-2 rounded-[3.5rem] bg-gradient-to-r from-[#8D36D5]/20 to-[#46067A]/20 blur-3xl transition duration-1000 group-hover:opacity-100" />
          <div className="relative overflow-hidden rounded-[3rem] border border-white/10 bg-black/40 p-10 backdrop-blur-3xl sm:p-16">
            <Image
              src="/hazard.svg"
              alt="Decorative hazard stripe"
              width={160}
              height={160}
              className="pointer-events-none absolute -right-12 -top-12 opacity-10 blur-[2px] grayscale invert"
            />
            <div className="relative mx-auto flex max-w-sm items-center justify-center p-4">
              <Image
                src="/logo-w.svg"
                alt="AI4 Impact logo"
                width={420}
                height={420}
                className="h-auto w-full transition-all duration-700 group-hover:scale-105"
                style={{ 
                  filter: "drop-shadow(0 0 50px rgba(141, 54, 213, 0.4))",
                  transform: "translateZ(50px)" 
                }}
                priority
              />
            </div>

            {/* Scanning Line Animation */}
            <motion.div 
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-[2px] bg-cyan-500/20 blur-[1px] z-20 pointer-events-none"
            />
          </div>
          
          <div className="absolute -bottom-8 -left-4 rounded-2xl border border-white/10 bg-black/80 px-4 py-2 text-[8px] font-black tracking-[0.4em] text-cyan-400 backdrop-blur-xl shadow-2xl border-l-4 border-l-cyan-500 sm:-left-8 sm:px-6 sm:py-3 sm:text-[10px]">
            SYSTEM_PROTOCOL_v0.9.1
          </div>
          <div className="absolute -top-6 -right-4 rounded-2xl border border-white/10 bg-black/80 px-3 py-1.5 text-[7px] font-black tracking-[0.4em] text-[#8D36D5] backdrop-blur-xl opacity-50 sm:-right-6 sm:px-4 sm:py-2 sm:text-[8px]">
            LAT: 17.3850 N / LONG: 78.4867 E
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}