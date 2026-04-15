"use client";
import { useScroll, useTransform, motion } from "framer-motion";
import React, { useRef } from "react";

interface TimelineEntry {
  title: string;
  content: React.ReactNode;
}

export const Timeline = ({ 
  data, 
  activeIndex = -1,
  completedIndices = []
}: { 
  data: TimelineEntry[], 
  activeIndex?: number,
  completedIndices?: number[]
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 10%", "end 60%"],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  return (
    <div className="w-full bg-transparent font-sans" ref={containerRef}>
      <div className="relative mx-auto max-w-7xl">
        {data.map((item, index) => {
          const isActive = index === activeIndex;
          const isCompleted = completedIndices.includes(index);

          return (
            <div key={index} className="flex justify-start pt-10 md:gap-10 md:pt-16 lg:pt-24">
              {/* Sticky Label Section */}
              <div className="sticky top-40 z-40 flex max-w-xs flex-col items-center self-start md:w-full md:flex-row lg:max-w-sm">
                <div className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full bg-black md:left-3">
                  {/* The glowing neon dot */}
                  <div className={`h-4 w-4 rounded-full border-2 bg-black transition-all duration-500 ${
                    isActive 
                      ? "border-[#FF6AC1] shadow-[0_0_18px_rgba(255,106,193,0.9)] scale-125" 
                      : isCompleted
                        ? "border-[#8D36D5] bg-[#8D36D5]/40"
                        : "border-[#8D36D5]/30"
                  }`} />
                  {isActive && (
                    <div className="absolute inset-0 h-10 w-10 rounded-full border border-[#FF6AC1]/50 animate-ping" />
                  )}
                </div>
                <h3 className={`hidden text-base font-black uppercase tracking-widest md:block md:pl-20 transition-colors duration-500 lg:text-xl ${
                  isActive ? "text-zinc-100" : isCompleted ? "text-zinc-500" : "text-zinc-700"
                }`}>
                  {item.title}
                </h3>
              </div>

              {/* Content Section */}
              <div className={`relative w-full pr-4 md:pr-0 pl-14 md:pl-0 ${index === data.length - 1 ? "pb-12" : "pb-0"}`}>
                {/* Mobile Label */}
                <h3 className={`mb-4 block text-left text-[10px] font-bold uppercase tracking-widest md:hidden transition-colors ${
                  isActive ? "text-zinc-100 font-black" : isCompleted ? "text-zinc-600" : "text-zinc-800"
                }`}>
                  {item.title}
                </h3>
                {item.content}
              </div>
            </div>
          );
        })}
        
        {/* The Vertical Line Track Base */}
        <div
          className="absolute left-[31px] top-6 bottom-6 w-[2px] overflow-hidden bg-white/5 md:left-[31px] [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)]"
        >
          {/* The Animated Glowing Progress Laser */}
          <motion.div
            style={{
              height: heightTransform,
              opacity: opacityTransform,
            }}
            className="absolute inset-x-0 top-0 w-[2px] rounded-full bg-gradient-to-t from-[#8D36D5] via-[#46067A] to-transparent from-[0%] via-[10%] shadow-[0_0_15px_rgba(141,54,213,1)]"
          />
        </div>
      </div>
    </div>
  );
};