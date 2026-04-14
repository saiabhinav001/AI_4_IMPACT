"use client";

import { motion, useSpring, useMotionValue } from "framer-motion";
import { useEffect, useState } from "react";

export function CustomCursor() {
  const [isHovering, setIsHovering] = useState(false);
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  const springConfig = { stiffness: 500, damping: 28, mass: 0.5 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };

    const checkHover = () => {
      const hoveredElement = document.querySelector(":hover");
      if (hoveredElement) {
        const style = window.getComputedStyle(hoveredElement);
        setIsHovering(style.cursor === "pointer");
      }
    };

    window.addEventListener("mousemove", moveCursor);
    window.addEventListener("mouseover", checkHover);

    return () => {
      window.removeEventListener("mousemove", moveCursor);
      window.removeEventListener("mouseover", checkHover);
    };
  }, [cursorX, cursorY]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] hidden lg:block">
      {/* Outer HUD Ring */}
      <motion.div
        style={{
          translateX: cursorXSpring,
          translateY: cursorYSpring,
          left: -15,
          top: -15,
        }}
        animate={{
          width: isHovering ? 50 : 30,
          height: isHovering ? 50 : 30,
          rotate: isHovering ? 90 : 0,
        }}
        className="fixed border border-[#8D36D5]/40 rounded-full flex items-center justify-center backdrop-blur-[1px]"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-px bg-[#8D36D5]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-px bg-[#8D36D5]" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-px w-1 bg-[#8D36D5]" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 h-px w-1 bg-[#8D36D5]" />
      </motion.div>

      {/* Inner Operational Dot */}
      <motion.div
        style={{
          translateX: cursorXSpring,
          translateY: cursorYSpring,
          left: -3,
          top: -3,
        }}
        animate={{
          scale: isHovering ? 2 : 1,
          backgroundColor: isHovering ? "#00FFFF" : "#8D36D5",
          boxShadow: isHovering ? "0 0 10px #00FFFF" : "0 0 0px transparent",
        }}
        className="fixed h-1.5 w-1.5 rounded-full z-10"
      />
    </div>
  );
}
