"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";

export function NeuralBackground() {
  const { scrollYProgress } = useScroll();

  // Smooth out the scroll values for liquid-like motion
  const smoothY = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  // Parallax and Rotation transforms
  const rotate = useTransform(smoothY, [0, 1], [0, 45]);
  const translateY = useTransform(smoothY, [0, 1], [0, -200]);
  const scanY = useTransform(smoothY, [0, 1], ["0%", "100%"]);
  const opacity = useTransform(smoothY, [0, 0.2, 0.8, 1], [0.3, 0.6, 0.6, 0.3]);

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
      <motion.div
        style={{ 
          rotate,
          y: translateY,
          opacity,
          scale: 1.3
        }}
        className="absolute inset-[-15%] h-[130%] w-[130%]"
      >
        {/* Lattice SVG Pattern */}
        <div className="h-full w-full opacity-[0.08]" 
             style={{ 
               backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M50 0 L100 25 L100 75 L50 100 L0 75 L0 25 Z' fill='none' stroke='%238D36D5' stroke-width='1'/%3E%3Ccircle cx='50' cy='0' r='2' fill='%2300FFFF'/%3E%3Ccircle cx='100' cy='25' r='2' fill='%2300FFFF'/%3E%3C/svg%3E")`,
               backgroundSize: '150px 260px'
             }} 
        />
        
        {/* Kinetic Light Beams */}
        <motion.div 
          animate={{
            opacity: [0.1, 0.3, 0.1],
            x: ['-20%', '120%']
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-[#8D36D5]/10 to-transparent skew-x-12"
        />
      </motion.div>

      {/* Dynamic Scanning Ray */}
      <motion.div 
        style={{ top: scanY }}
        className="absolute left-0 right-0 h-[100px] bg-gradient-to-b from-transparent via-cyan-500/[0.05] to-transparent z-[1]"
      />

      {/* Radial Gradient overlay to depth */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(5,5,5,0.8)_80%)]" />
    </div>
  );
}
