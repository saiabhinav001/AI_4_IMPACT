"use client";

import { useState, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

const navItems = [
  { label: "Home", href: "/#hero" },
  { label: "About", href: "/#about" },
  { label: "Events", href: "/#events" },
  { label: "Timeline", href: "/#timeline" },
  { label: "Highlights", href: "/#highlights" },
  { label: "Sponsors", href: "/#sponsors" },
];

const actionItems = [
  { label: "Login", href: "/auth" },
];

const desktopItems = [...navItems, ...actionItems];

export default function LandingNavbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isIslandHovered, setIsIslandHovered] = useState(false);
  const [traceData, setTraceData] = useState<Array<{ offset: number; array: string }>>([]);

  const islandRef = useRef<HTMLDivElement | null>(null);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    const observerOptions = {
      root: null,
      rootMargin: "-20% 0px -70% 0px",
      threshold: 0,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    const sections = document.querySelectorAll("section[id]");
    sections.forEach((section) => observer.observe(section));

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      sections.forEach((section) => observer.unobserve(section));
    };
  }, []);

  useEffect(() => {
    const calculateTraceData = () => {
      const islandEl = islandRef.current;
      if (!islandEl) {
        return;
      }

      const islandRect = islandEl.getBoundingClientRect();
      const perimeter = 2 * (islandRect.width + islandRect.height);
      if (perimeter <= 0 || islandRect.width <= 0) {
        return;
      }

      const topEdgePath = (islandRect.width / perimeter) * 100;
      const nextTraceData = desktopItems.map((_, index) => {
        const linkEl = linkRefs.current[index];
        if (!linkEl) {
          return { offset: 5, array: "0 0 10 40 10 40" };
        }

        const linkRect = linkEl.getBoundingClientRect();
        const centerX = linkRect.left + linkRect.width / 2 - islandRect.left;
        const ratioX = Math.min(1, Math.max(0, centerX / islandRect.width));
        const centerPath = ratioX * topEdgePath;
        const segment = Math.max(8, Math.min(14, ((linkRect.width + 24) / perimeter) * 100 * 2.8));
        const segmentStart = Math.max(0, Math.min(topEdgePath - segment, centerPath - segment / 2));

        return {
          offset: Number((100 - segmentStart).toFixed(3)),
          array: `${segment.toFixed(3)} ${(100 - segment).toFixed(3)}`,
        };
      });

      setTraceData(nextTraceData);
    };

    calculateTraceData();
    window.addEventListener("resize", calculateTraceData);

    return () => {
      window.removeEventListener("resize", calculateTraceData);
    };
  }, []);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  };

  const closeMenu = () => {
    setIsOpen(false);
    document.body.style.overflow = "unset";
  };

  const menuVariants = {
    closed: {
      opacity: 0,
      scale: 0.95,
      transition: {
        staggerChildren: 0.05,
        staggerDirection: -1,
      },
    },
    open: {
      opacity: 1,
      scale: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    closed: { x: -20, opacity: 0 },
    open: { x: 0, opacity: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
  };

  if (pathname && (pathname.startsWith("/team") || pathname.startsWith("/auth") || pathname.startsWith("/admin"))) {
    return null;
  }

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "py-2 bg-transparent border-transparent lg:bg-[#0F061C]/95 lg:backdrop-blur-xl lg:border-transparent"
          : "py-3 lg:py-4 bg-transparent"
      }`}
    >
      {/* Scroll Progress Laser */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#8D36D5] via-cyan-400 to-[#46067A] origin-left z-[60]"
        style={{ scaleX }}
      />
      
      <div
        className={`mx-auto w-full transition-all duration-500 ${
          scrolled || isOpen ? "max-w-7xl px-4 sm:px-6 lg:px-8" : "max-w-none px-4 sm:px-6 lg:px-0"
        }`}
      >
        <nav
          className="relative min-h-[56px] overflow-visible border border-transparent bg-transparent px-0 py-2 sm:min-h-[60px] lg:px-4 lg:py-3"
        >
          {/* Animated Background Glow - Hidden on very small screens to prevent overflow */}
          <div className="absolute -left-20 -top-20 h-40 w-40 bg-fuchsia-600/10 blur-3xl hidden sm:block" />
          
          <div className="relative z-10 flex w-full items-center justify-end lg:justify-center">

            {/* Desktop Nav */}
            <div className="relative z-20 hidden lg:flex items-center justify-center">
              <div
                ref={islandRef}
                onMouseEnter={() => setIsIslandHovered(true)}
                onMouseLeave={() => {
                  setIsIslandHovered(false);
                  setHoveredIndex(null);
                }}
                className={`group relative flex h-11 items-center gap-1 rounded-sm border px-2.5 transition-all duration-500 ${
                  scrolled
                    ? "border-white/10 bg-black/40 backdrop-blur-xl"
                    : "border-transparent bg-transparent"
                }`}
              >
                <Link
                  href="/#hero"
                  onMouseEnter={() => setHoveredIndex(null)}
                  onClick={closeMenu}
                  className="relative z-10 flex h-full w-11 items-center justify-center rounded-[2px] border-r border-white/10 bg-white/[0.03]"
                >
                  <Image src="/site-icon.svg" alt="AI4 Impact" width={24} height={24} className="h-6 w-6" priority />
                </Link>

                <div className="absolute -left-2 -top-2 h-6 w-6 border-l-2 border-t-2 border-[#8D36D5]/70 transition-all duration-500 sm:h-8 sm:w-8 sm:border-[#8D36D5]/40 sm:group-hover:h-10 sm:group-hover:w-10 sm:group-hover:border-[#8D36D5]" />
                <div className="absolute -bottom-2 -right-2 h-6 w-6 border-b-2 border-r-2 border-[#8D36D5]/70 transition-all duration-500 sm:h-8 sm:w-8 sm:border-[#8D36D5]/40 sm:group-hover:h-10 sm:group-hover:w-10 sm:group-hover:border-[#8D36D5]" />

                {navItems.map((item, index) => {
                  const isActive = activeSection === item.href.slice(1);
                  return (
                    <a
                      key={item.href}
                      ref={(el) => {
                        linkRefs.current[index] = el;
                      }}
                      href={item.href}
                      onMouseEnter={() => setHoveredIndex(index)}
                      className={`touch-target relative z-10 inline-flex items-center px-3 py-1.5 text-sm uppercase tracking-widest font-[var(--font-body)] transition-colors duration-200 ${
                        isActive ? "text-white font-bold drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "text-zinc-200 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </a>
                  );
                })}

                <div className="mx-2 h-6 w-px bg-white/10" />

                {actionItems.map((item, idx) => {
                  const actionIndex = navItems.length + idx;
                  return (
                    <Link
                      key={item.href}
                      ref={(el) => {
                        linkRefs.current[actionIndex] = el;
                      }}
                      href={item.href}
                      onMouseEnter={() => setHoveredIndex(actionIndex)}
                      className="touch-target relative z-10 inline-flex items-center rounded-[2px] border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-white/70 transition-all duration-200 hover:bg-white/[0.08] hover:text-white"
                    >
                      {item.label}
                    </Link>
                  );
                })}

                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <rect
                    x="0.6"
                    y="0.6"
                    width="98.8"
                    height="98.8"
                    fill="transparent"
                    strokeWidth="0.8"
                    stroke="rgba(255,255,255,0.95)"
                    pathLength="100"
                    style={{
                      opacity: isIslandHovered ? 1 : 0,
                      strokeDashoffset: hoveredIndex !== null ? (traceData[hoveredIndex]?.offset ?? 5) : 5,
                      strokeDasharray: hoveredIndex !== null ? (traceData[hoveredIndex]?.array ?? "0 0 10 40 10 40") : "0 0 10 40 10 40",
                      transition: "stroke-dashoffset 500ms ease-in-out, stroke-dasharray 500ms ease-in-out, opacity 500ms ease-in-out",
                    }}
                  />
                </svg>
              </div>
            </div>

            <button 
              onClick={toggleMenu}
              className="touch-target group relative z-[100] flex h-11 w-11 items-center justify-center bg-transparent text-white transition-colors hover:text-white/80 lg:hidden sm:h-12 sm:w-12"
              aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isOpen ? "close" : "open"}
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  {isOpen ? <X size={24} /> : <Menu size={24} />}
                </motion.div>
              </AnimatePresence>
            </button>
          </div>

        </nav>
      </div>

      {/* Mobile HUD Overlay Menu - Moved outside nav to prevent clipping */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            variants={menuVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="fixed inset-0 z-[90] flex min-h-screen w-full flex-col bg-black/98 backdrop-blur-3xl lg:hidden"
          >
            <div className="flex h-full flex-col overflow-y-auto px-5 pb-4 pt-16 sm:px-7 sm:pb-6 sm:pt-20">
              <div className="scanning-ray opacity-20" />
              {/* Decorative Background Labels */}
              <div className="pointer-events-none absolute right-7 top-20 text-[9vw] font-black uppercase text-white/[0.025]">NAV_LAYER</div>
              
              <nav className="relative z-10 w-full">
                <ul className="flex flex-col gap-2.5 sm:gap-3">
                  {navItems.map((item, idx) => {
                    const isActive = activeSection === item.href.slice(1);
                    return (
                      <motion.li key={item.href} variants={itemVariants}>
                        <a
                          href={item.href}
                          onClick={closeMenu}
                          className={`touch-target group relative flex items-center justify-between py-0.5 text-[clamp(1.2rem,5.3vw,2.15rem)] font-black uppercase tracking-tight transition-all ${
                            isActive ? "text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]" : "text-zinc-300 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-[8px] font-bold tracking-[0.28em] text-[#8D36D5] opacity-55">/0{idx + 1}</span>
                            {item.label}
                          </div>
                          {isActive && <motion.div layoutId="active-dot" className="h-1.5 w-1.5 bg-cyan-400" />}
                        </a>
                      </motion.li>
                    );
                  })}
                </ul>
              </nav>

              <motion.div variants={itemVariants} className="mt-4 w-full sm:mt-6">
                <div className="grid gap-3">
                  <Link
                    href="/auth"
                    onClick={closeMenu}
                    className="touch-target flex w-full items-center justify-center rounded-[4px] border border-white/10 bg-white/5 py-2.5 text-[11px] font-black uppercase tracking-[0.22em] text-white transition-colors hover:bg-white/10"
                  >
                    LOGIN
                  </Link>
                </div>
                <div className="mt-3 flex items-center justify-center gap-2.5 text-[6px] font-bold tracking-[0.24em] text-zinc-600 uppercase sm:mt-4">
                  <div className="h-[1px] w-4 bg-zinc-800" />
                  Secure Terminal Protocol 0x4f
                  <div className="h-[1px] w-4 bg-zinc-800" />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
