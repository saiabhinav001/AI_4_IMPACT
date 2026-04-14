"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";

const navItems = [
  { label: "Home", href: "#hero" },
  { label: "About", href: "#about" },
  { label: "Events", href: "#events" },
  { label: "Timeline", href: "#timeline" },
  { label: "Highlights", href: "#highlights" },
  { label: "Sponsors", href: "#sponsors" },
];

export default function LandingNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");

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
    open: { x: 0, opacity: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "py-3" : "py-6"
      }`}
    >
      {/* Scroll Progress Laser */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#8D36D5] via-cyan-400 to-[#46067A] origin-left z-[60]"
        style={{ scaleX }}
      />
      
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className={`relative overflow-hidden rounded-[2rem] border border-white/10 transition-all duration-500 ${
          scrolled || isOpen ? "bg-black/95 backdrop-blur-2xl shadow-2xl" : "bg-black/40 backdrop-blur-lg"
        } px-6 py-4`}>
          {/* Animated Background Glow */}
          <div className="absolute -left-20 -top-20 h-40 w-40 bg-fuchsia-600/10 blur-3xl" />
          
          <div className="relative z-10 flex items-center justify-between">
            {/* Logo */}
            <a href="#hero" onClick={closeMenu} className="group flex items-center gap-2 text-base font-black uppercase tracking-[0.2em] text-white sm:text-2xl sm:gap-3 sm:tracking-[0.3em]">
              <span className="bg-gradient-to-r from-[#8D36D5] to-[#46067A] bg-clip-text text-transparent transition-all group-hover:scale-105">AI4</span>
              <span className="inline">IMPACT</span>
              <div className="h-1 w-1 rounded-full bg-cyan-400 animate-pulse hidden sm:block" />
            </a>

            {/* Desktop Nav */}
            <ul className="hidden lg:flex items-center gap-2">
              {navItems.map((item) => {
                const isActive = activeSection === item.href.slice(1);
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className={`relative px-5 py-2.5 text-sm font-bold uppercase tracking-[0.2em] transition-all duration-300 ${
                        isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="nav-pill"
                          className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#8D36D5]/20 to-[#46067A]/20 border border-[#8D36D5]/30 shadow-[0_4px_15px_rgba(141,54,213,0.3)]"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.6 }}
                        />
                      )}
                      <span className="relative z-10">{item.label}</span>
                    </a>
                  </li>
                );
              })}
              <li className="ml-6">
                <motion.a
                  href="#register"
                  animate={{ 
                    boxShadow: ["0 0 10px rgba(141,54,213,0.2)", "0 0 25px rgba(141,54,213,0.4)", "0 0 10px rgba(141,54,213,0.2)"],
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="relative group overflow-hidden rounded-xl bg-white px-6 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] whitespace-nowrap"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#8D36D5] to-[#46067A] opacity-0 transition-opacity group-hover:opacity-10" />
                  REGISTER NOW
                </motion.a>
              </li>
            </ul>

            {/* Mobile Menu Button */}
            <button 
              onClick={toggleMenu}
              className="group relative z-[100] flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white transition-all hover:bg-white/10 lg:hidden"
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
            <div className="flex h-full flex-col justify-center px-10 pt-24 pb-12 overflow-y-auto">
              <div className="scanning-ray opacity-20" />
              {/* Decorative Background Labels */}
              <div className="absolute right-10 top-32 text-[10vw] font-black text-white/[0.03] pointer-events-none uppercase">NAV_LAYER</div>
              
              <nav className="relative z-10 w-full mb-auto mt-auto">
                <ul className="flex flex-col gap-6">
                  {navItems.map((item, idx) => {
                    const isActive = activeSection === item.href.slice(1);
                    return (
                      <motion.li key={item.href} variants={itemVariants}>
                        <a
                          href={item.href}
                          onClick={closeMenu}
                          className={`group relative flex items-center justify-between text-4xl font-black uppercase tracking-tighter transition-all sm:text-6xl ${
                            isActive ? "text-white" : "text-zinc-600 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold tracking-[0.5em] text-[#8D36D5] opacity-50">/0{idx + 1}</span>
                            {item.label}
                          </div>
                          {isActive && <motion.div layoutId="active-dot" className="h-2 w-2 rounded-full bg-cyan-400" />}
                        </a>
                      </motion.li>
                    );
                  })}
                </ul>
              </nav>

              <motion.div variants={itemVariants} className="mt-16 w-full">
                <a
                  href="#register"
                  onClick={closeMenu}
                  className="group relative flex w-full items-center justify-center overflow-hidden rounded-2xl bg-white py-6 text-base font-black uppercase tracking-[0.4em] text-black shadow-2xl transition-all hover:scale-105 active:scale-95"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#8D36D5] to-[#46067A] opacity-0 transition-opacity group-hover:opacity-10" />
                  REGISTER NOW
                </a>
                <div className="mt-8 flex items-center justify-center gap-4 text-[8px] font-bold tracking-[0.4em] text-zinc-600 uppercase">
                  <div className="h-[1px] w-6 bg-zinc-800" />
                  Secure Terminal Protocol 0x4f
                  <div className="h-[1px] w-6 bg-zinc-800" />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}