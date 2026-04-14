"use client";

import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
import { useEffect, useMemo } from "react";

type Shard = {
  top: string;
  left: string;
  width: string;
  height: string;
  rotate: string;
  duration: number;
  delay: number;
};

type Dust = {
  top: string;
  left: string;
};

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createShardData(count: number, seed: number): Shard[] {
  const rand = createSeededRandom(seed);
  return Array.from({ length: count }, () => ({
    top: `${rand() * 300}%`,
    left: `${rand() * 100}%`,
    width: `${rand() * 30 + 10}px`,
    height: `${rand() * 30 + 10}px`,
    rotate: `rotate(${rand() * 360}deg)`,
    duration: 3 + rand() * 5,
    delay: rand() * 2,
  }));
}

function createDustData(count: number, seed: number): Dust[] {
  const rand = createSeededRandom(seed);
  return Array.from({ length: count }, () => ({
    top: `${rand() * 400}%`,
    left: `${rand() * 100}%`,
  }));
}

export function ParallaxBackground() {
  const { scrollYProgress } = useScroll();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const shards = useMemo(() => createShardData(20, 20260414), []);
  const dust = useMemo(() => createDustData(40, 20260415), []);

  // Smooth mouse movement
  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX / window.innerWidth - 0.5);
      mouseY.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  // Layer 1: The Deep Grid (Lattice) - Heavy scroll parallax
  const latticeY = useTransform(scrollYProgress, [0, 1], ["0%", "-50%"]); // Increased range
  const latticeRotate = useTransform(springX, [-0.5, 0.5], [-8, 8]); // More dynamic rotation

  // Layer 2: The Nebula (Floating Glows) - Mouse reactive
  const nebulaX = useTransform(springX, [-0.5, 0.5], ["-80px", "80px"]);
  const nebulaY = useTransform(springY, [-0.5, 0.5], ["-80px", "80px"]);

  // Layer 3: Digital Data Shards - Fast kinetic offsets
  const shardsX = useTransform(springX, [-0.5, 0.5], ["150px", "-150px"]);
  const shardsY = useTransform(scrollYProgress, [0, 1], ["0px", "-800px"]); // Much faster scroll

  // Layer 4: Foreground Dust (Fast)
  const dustY = useTransform(scrollYProgress, [0, 1], ["0px", "-1500px"]);

  return (
    <div className="fixed inset-0 z-[0] overflow-hidden pointer-events-none bg-[#050505]">
      {/* Layer 1: Neural Lattice Grid */}
      <motion.div 
        style={{ y: latticeY, rotateX: 25, rotate: latticeRotate }}
        className="absolute inset-[-50%] opacity-40"
      >
        <div 
          className="h-full w-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(141, 54, 213, 0.3) 1.5px, transparent 1.5px),
              linear-gradient(90deg, rgba(141, 54, 213, 0.3) 1.5px, transparent 1.5px)
            `,
            backgroundSize: "80px 80px",
            perspective: "1000px",
            transform: "rotateX(45deg)"
          }}
        />
      </motion.div>

      {/* Layer 2: Volumetric Nebula Glows */}
      <motion.div 
        style={{ x: nebulaX, y: nebulaY }}
        className="absolute inset-0 flex items-center justify-center opacity-40 blur-[120px]"
      >
        <div className="h-[600px] w-[600px] rounded-full bg-gradient-to-tr from-[#8D36D5]/20 via-[#46067A]/10 to-transparent" />
        <div className="absolute top-[20%] left-[30%] h-[400px] w-[400px] rounded-full bg-cyan-500/10" />
      </motion.div>

      {/* Layer 3: Digital Data Shards */}
      <motion.div 
        style={{ x: shardsX, y: shardsY }}
        className="absolute inset-0"
      >
        {shards.map((shard, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.2, 0.5, 0.2], // Increased opacity
              scale: [1, 1.2, 1],
            }}
            transition={{ 
              duration: shard.duration,
              repeat: Infinity,
              delay: shard.delay,
            }}
            className="absolute rounded-sm border border-white/10 bg-white/10 backdrop-blur-[2px]"
            style={{
              top: shard.top,
              left: shard.left,
              width: shard.width,
              height: shard.height,
              transform: shard.rotate,
            }}
          />
        ))}
      </motion.div>

      {/* Layer 4: Foreground Dust Particles (Super Fast) */}
      <motion.div 
        style={{ y: dustY }}
        className="absolute inset-0 pointer-events-none"
      >
        {dust.map((particle, i) => (
          <div
            key={`dust-${i}`}
            className="absolute h-1 w-1 rounded-full bg-white/20"
            style={{
              top: particle.top,
              left: particle.left,
              boxShadow: "0 0 10px rgba(255,255,255,0.3)"
            }}
          />
        ))}
      </motion.div>

      {/* Grain Overlay for Cinematic Depth */}
      <div className="absolute inset-0 opacity-[0.03] noise-overlay mix-blend-overlay" />
    </div>
  );
}
