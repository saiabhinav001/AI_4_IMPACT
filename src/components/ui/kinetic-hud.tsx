"use client";

import { motion, useScroll, useTransform } from "framer-motion";

const HUD_ELEMENTS = [
  { x: "10%", y: "15%", speed: 0.1, type: "marker" },
  { x: "85%", y: "25%", speed: 0.2, type: "bracket" },
  { x: "5%", y: "45%", speed: 0.15, type: "hex" },
  { x: "90%", y: "65%", speed: 0.1, type: "marker" },
  { x: "15%", y: "80%", speed: 0.25, type: "hex" },
];

function HudElement({
  el,
  idx,
  scrollYProgress,
}: {
  el: (typeof HUD_ELEMENTS)[number];
  idx: number;
  scrollYProgress: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  const translateY = useTransform(scrollYProgress, [0, 1], ["0%", `${el.speed * 1000}%`]);

  return (
    <motion.div
      style={{
        left: el.x,
        top: el.y,
        y: translateY,
      }}
      className="absolute opacity-20"
    >
      {el.type === "marker" && (
        <div className="flex h-4 w-4 items-center justify-center border border-cyan-500/50">
          <div className="h-1 w-1 bg-cyan-400" />
        </div>
      )}
      {el.type === "bracket" && (
        <div className="whitespace-nowrap font-mono text-[10px] text-[#8D36D5]">[ 0x_LINK_0{idx} ]</div>
      )}
      {el.type === "hex" && (
        <div className="flex flex-col gap-1">
          <div className="h-px w-8 bg-zinc-800" />
          <span className="font-mono text-[8px] text-zinc-600">OFFSET_0x{idx * 10}</span>
        </div>
      )}
    </motion.div>
  );
}

export function KineticHUD() {
  const { scrollYProgress } = useScroll();

  return (
    <div className="absolute inset-0 z-[5] pointer-events-none overflow-hidden">
      {HUD_ELEMENTS.map((el, i) => (
        <HudElement key={i} el={el} idx={i} scrollYProgress={scrollYProgress} />
      ))}
    </div>
  );
}
