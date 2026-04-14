"use client";

import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import { MagneticWrapper } from "../ui/magnetic-wrapper";
import { TextReveal } from "../ui/text-reveal";
import { GlowTypewriter } from "../ui/glow-typewriter";

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
    <section id="hero" className="relative flex min-h-screen flex-col items-center justify-center pt-32 pb-12 sm:grid sm:grid-cols-2 sm:gap-12 sm:pt-32 scroll-mt-32 overflow-hidden">
      {/* Precision HUD Background Layer */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(141,54,213,0.05)_0%,transparent_70%)]" />
      </div>

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
        className="relative z-10 flex flex-col items-center text-center sm:block sm:text-left"
      >
        <div className="mb-8 hidden h-[1px] w-24 bg-gradient-to-r from-[#8D36D5] to-transparent sm:block" />
        
        {/* Mobile Badge - Small floating indicator */}
        <motion.div variants={itemVariants} className="mb-6 flex items-center gap-3 sm:hidden">
          <div className="h-2 w-2 rounded-full bg-[#8D36D5] animate-pulse" />
          <span className="text-[10px] font-black tracking-[0.4em] text-[#8D36D5] uppercase">HACKATHON // 2026</span>
        </motion.div>

        <div className="relative">
          <div className="hidden sm:block">
            <TextReveal 
              text="AI4 IMPACT" 
              className="text-7xl font-black uppercase leading-[0.8] tracking-tighter lg:text-9xl text-white"
            />
          </div>
          <div className="sm:hidden">
            <GlowTypewriter 
              text="AI4 IMPACT" 
              className="text-5xl font-black uppercase leading-[0.8] tracking-tighter text-white"
              glowColor="#8D36D5"
            />
          </div>
        </div>

        <motion.div 
          variants={itemVariants}
          className="mt-10 max-w-xl border-l-2 border-[#8D36D5]/30 pl-6 lg:mt-12 sm:border-l-2 sm:pl-6 sm:mt-10 mx-auto sm:mx-0"
        >
          <TextReveal 
            text="Build practical AI solutions for real-world social impact with mentors, domain experts, and creators."
            className="text-lg text-zinc-400 leading-relaxed sm:text-xl font-medium"
          />
        </motion.div>

        <motion.div 
          variants={itemVariants}
          className="mt-14 flex flex-col items-center justify-center gap-6 sm:items-start"
        >
          <MagneticWrapper>
            <motion.a
              href="/auth"
              animate={{ 
                boxShadow: ["0 0 20px rgba(141,54,213,0.3)", "0 0 40px rgba(141,54,213,0.5)", "0 0 20px rgba(141,54,213,0.3)"],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="group relative overflow-hidden rounded-2xl bg-white px-12 py-6 text-sm font-black tracking-[0.2em] text-black transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#8D36D5] to-[#46067A] opacity-0 transition-opacity group-hover:opacity-10" />
              REGISTER NOW
            </motion.a>
          </MagneticWrapper>
          
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8D36D5] animate-pulse" />
            <p className="text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase">APRIL 15 - APRIL 18, 2026</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Main Visual - Command Center Card on Mobile */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative group mt-16 sm:mt-0 sm:ml-auto perspective-1000 w-full max-w-sm sm:max-w-none px-6 sm:px-0"
      >
        <motion.div
          style={{ rotateX, rotateY }}
          className="relative preserve-3d hardware-accelerated transition-transform duration-200"
        >
          {/* Mobile Background Wash Effect */}
          <div className="absolute -inset-4 rounded-[3.5rem] bg-gradient-to-r from-[#8D36D5]/20 to-[#46067A]/20 blur-3xl sm:hidden" />
          
          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/40 p-8 backdrop-blur-3xl sm:rounded-[3rem] sm:p-16">
            <div className="scanning-ray opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative mx-auto flex max-w-[240px] items-center justify-center p-4 sm:max-w-sm">
              <Image
                src="/logo-w.svg"
                alt="AI4 Impact logo"
                width={420}
                height={420}
                className="h-auto w-full transition-all duration-700 group-hover:scale-110"
                style={{ 
                  filter: "drop-shadow(0 0 50px rgba(141, 54, 213, 0.4))",
                  transform: "translateZ(60px)" 
                }}
                priority
              />
            </div>
            
            {/* Mobile Decorative Labels */}
            <div className="mt-8 flex flex-col items-center gap-2 sm:hidden">
              <div className="h-px w-8 bg-white/10" />
              <p className="text-[7px] font-black tracking-[0.5em] text-zinc-500 uppercase">LAT: 17.3850 N / LONG: 78.4867 E</p>
            </div>
          </div>
          
          {/* Technical Accent Badges - Hidden on very small screens for cleanliness */}
          <div className="absolute -bottom-6 -left-2 hidden rounded-xl border border-white/10 bg-black/80 px-4 py-2 text-[8px] font-black tracking-[0.4em] text-cyan-400 backdrop-blur-xl shadow-2xl border-l-4 border-l-cyan-500 sm:block sm:-bottom-8 sm:-left-4 sm:text-[10px]">
            SYSTEM_PROTOCOL_v0.9.1
          </div>
          <div className="absolute -top-4 -right-2 hidden rounded-xl border border-white/10 bg-black/80 px-3 py-1.5 text-[7px] font-black tracking-[0.4em] text-[#8D36D5] backdrop-blur-xl opacity-50 sm:block sm:-top-6 sm:-right-4 sm:text-[8px]">
            ACTIVE_INTERFACE
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}