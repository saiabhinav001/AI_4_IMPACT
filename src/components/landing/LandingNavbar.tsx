"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "py-3" : "py-6"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className={`relative overflow-hidden rounded-[2rem] border border-white/10 transition-all duration-500 ${
          scrolled || isOpen ? "bg-black/90 backdrop-blur-2xl shadow-2xl" : "bg-black/40 backdrop-blur-lg"
        } px-6 py-4`}>
          {/* Animated Background Glow */}
          <div className="absolute -left-20 -top-20 h-40 w-40 bg-fuchsia-600/10 blur-3xl" />
          
          <div className="relative flex items-center justify-between">
            {/* Logo */}
            <a href="#hero" className="group flex items-center gap-2 text-base font-black uppercase tracking-[0.2em] text-white sm:text-2xl sm:gap-3 sm:tracking-[0.3em]">
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
                          className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#8D36D5]/20 to-[#46067A]/20 border border-[#8D36D5]/30"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      <span className="relative z-10">{item.label}</span>
                    </a>
                  </li>
                );
              })}
              <li className="ml-6">
                <a
                  href="#register"
                  className="relative group overflow-hidden rounded-xl bg-white px-6 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] text-black transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] whitespace-nowrap"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#8D36D5] to-[#46067A] opacity-0 transition-opacity group-hover:opacity-10" />
                  REGISTER NOW
                </a>
              </li>
            </ul>

            {/* Mobile Menu Button */}
            <button 
              onClick={toggleMenu}
              className="group flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white transition-all hover:bg-white/10 lg:hidden"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} className="group-hover:rotate-180 transition-transform duration-500" />}
            </button>
          </div>

          {/* Mobile Nav Menu */}
          <AnimatePresence>
            {isOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="lg:hidden overflow-hidden"
              >
                <div className="pt-8 pb-4">
                  <ul className="flex flex-col gap-3">
                    {navItems.map((item) => {
                      const isActive = activeSection === item.href.slice(1);
                      return (
                        <li key={item.href}>
                          <a
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={`flex w-full items-center rounded-2xl px-6 py-4 text-base font-black uppercase tracking-[0.3em] transition-all ${
                              isActive 
                                ? "bg-gradient-to-r from-[#8D36D5] to-[#46067A] text-white" 
                                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                            }`}
                          >
                            {item.label}
                          </a>
                        </li>
                      );
                    })}
                    <li className="mt-6">
                      <a
                        href="#register"
                        onClick={() => setIsOpen(false)}
                        className="flex w-full items-center justify-center rounded-2xl bg-white py-5 text-sm font-black uppercase tracking-[0.4em] text-black shadow-2xl"
                      >
                        REGISTER NOW
                      </a>
                    </li>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>
      </div>
    </header>
  );
}