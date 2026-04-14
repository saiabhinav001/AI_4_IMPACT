"use client";

import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

export function CustomHUDScrollbar() {
  const { scrollYProgress } = useScroll();
  const [isMobile, setIsMobile] = useState(false);

  const scaleY = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const thumbPosition = useTransform(scrollYProgress, [0, 1], ["0%", "calc(100% - 5rem)"]);
  const thumbTop = useSpring(thumbPosition, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (isMobile) return null;

  return (
    <div className="fixed right-2 top-0 bottom-0 z-[100] w-1.5 py-8 pointer-events-none">
      {/* Scroll Track */}
      <div className="relative h-full w-full rounded-full bg-white/5 backdrop-blur-sm overflow-hidden border border-white/5">
        {/* Animated Background Progress */}
        <motion.div 
          className="absolute inset-x-0 top-0 w-full origin-top bg-gradient-to-b from-[#8D36D5] via-cyan-400 to-[#46067A]"
          style={{ scaleY }}
        />
        
        {/* The Digital HUD Thumb */}
        <motion.div 
          style={{ top: thumbTop }}
          className="absolute left-0 right-0 h-20 w-full"
        >
          {/* Scanning Ray */}
          <div className="absolute inset-0 bg-white shadow-[0_0_15px_#fff,0_0_30px_#8D36D5] animate-pulse" />
          
          {/* Data Bits Decoration */}
          <div className="absolute -left-4 top-1/2 -translate-y-1/2 flex flex-col gap-1">
            <div className="h-1 w-1 rounded-full bg-cyan-400 animate-ping" />
            <div className="h-px w-2 bg-white/30" />
          </div>
          
          <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 whitespace-nowrap text-[6px] font-black tracking-[0.4em] text-white/20 uppercase rotate-90">
            SYSTEM_SYNC_0x92
          </div>
        </motion.div>
      </div>
      
      {/* Bottom Status Notch */}
      <div className="absolute bottom-4 right-0 flex flex-col items-center gap-1 opacity-20">
        <div className="h-px w-4 bg-white" />
        <div className="h-px w-2 bg-white" />
      </div>
    </div>
  );
}
