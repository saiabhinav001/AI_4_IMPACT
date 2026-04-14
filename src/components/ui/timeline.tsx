"use client";
import { useScroll, useTransform, motion } from "framer-motion";
import React, { useRef } from "react";

interface TimelineEntry {
  title: string;
  content: React.ReactNode;
}

export const Timeline = ({ data }: { data: TimelineEntry[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    // Adjusting offsets so the line fills completely right as the user reaches the end
    offset: ["start 10%", "end 60%"],
  });

  // FIX: Using percentages instead of calculating exact pixels prevents the line from
  // becoming invisible on desktop or overflowing the container on mobile.
  const heightTransform = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  return (
    <div className="w-full bg-transparent font-sans" ref={containerRef}>
      <div className="relative mx-auto max-w-7xl">
        {data.map((item, index) => (
          <div key={index} className="flex justify-start pt-10 md:gap-10 md:pt-20 lg:pt-32">
            {/* Sticky Label Section */}
            <div className="sticky top-40 z-40 flex max-w-xs flex-col items-center self-start md:w-full md:flex-row lg:max-w-sm">
              <div className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full bg-black md:left-3">
                {/* The glowing neon dot */}
                <div className="h-4 w-4 rounded-full border-2 border-[#8D36D5] bg-black shadow-[0_0_12px_rgba(141,54,213,0.8)]" />
              </div>
              <h3 className="hidden text-xl font-black uppercase tracking-widest text-[#c084fc] md:block md:pl-20 md:text-3xl lg:text-4xl">
                {item.title}
              </h3>
            </div>

            {/* Content Section */}
            {/* Added controlled padding to the last item so the container ends gracefully */}
            <div className={`relative w-full pr-4 md:pr-0 pl-14 md:pl-0 ${index === data.length - 1 ? "pb-12" : "pb-0"}`}>
              {/* Mobile Label */}
              <h3 className="mb-4 block text-left text-[11px] font-bold uppercase tracking-widest text-[#c084fc] md:hidden">
                {item.title}
              </h3>
              {item.content}
            </div>
          </div>
        ))}
        
        {/* The Vertical Line Track Base */}
        {/* FIX: bottom-6 ensures the line STRICTLY stays inside this section and never touches Highlights */}
        <div
          className="absolute left-[31px] top-6 bottom-6 w-[2px] overflow-hidden bg-[linear-gradient(to_bottom,var(--tw-gradient-stops))] from-transparent from-[0%] via-white/10 to-transparent to-[99%] md:left-[31px] [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)]"
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