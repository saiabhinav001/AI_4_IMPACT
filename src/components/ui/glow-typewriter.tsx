"use client";

import { motion } from "framer-motion";

interface GlowTypewriterProps {
  text: string;
  className?: string;
  glowColor?: string;
}

export function GlowTypewriter({ 
  text, 
  className = "", 
  glowColor = "#8D36D5" 
}: GlowTypewriterProps) {
  const characters = text.split("");

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { 
        staggerChildren: 0.1, 
        delayChildren: 0.5 
      },
    },
  };

  const characterVariants = {
    hidden: { 
      opacity: 0, 
      scale: 1.2,
      filter: "blur(10px)",
    },
    visible: {
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
  };

  const glowVariants = {
    initial: {
      textShadow: `0 0 0px ${glowColor}, 0 0 0px ${glowColor}`,
    },
    animate: {
      textShadow: [
        `0 0 10px ${glowColor}44, 0 0 20px ${glowColor}22`,
        `0 0 25px ${glowColor}88, 0 0 45px ${glowColor}44`,
        `0 0 10px ${glowColor}44, 0 0 20px ${glowColor}22`,
      ],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className={`relative flex flex-wrap justify-center sm:justify-start ${className}`}
    >
      {characters.map((char, index) => (
        <motion.span
          key={index}
          variants={characterVariants}
          className="relative inline-block"
        >
          <motion.span
            variants={glowVariants as any}
            initial="initial"
            animate="animate"
            className="inline-block"
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        </motion.span>
      ))}
    </motion.div>
  );
}
