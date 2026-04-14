"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

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

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "py-2" : "py-4"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className={`relative rounded-2xl border border-white/10 transition-all duration-300 ${
          scrolled || isOpen ? "bg-black/80 backdrop-blur-xl shadow-2xl" : "bg-black/20 backdrop-blur-md"
        } px-4 py-3 sm:px-6`}>
          <div className="flex items-center justify-between">
            {/* Logo */}
            <a href="#hero" className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-white sm:text-lg">
              <span className="bg-gradient-to-r from-fuchsia-500 to-cyan-400 bg-clip-text text-transparent">AI4</span>
              <span className="hidden sm:inline">IMPACT</span>
            </a>

            {/* Desktop Nav */}
            <ul className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-widest text-zinc-400 transition-all hover:bg-white/5 hover:text-white"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li className="ml-2">
                <a
                  href="#register"
                  className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-fuchsia-500/20 transition-all hover:scale-105 active:scale-95"
                >
                  Register
                </a>
              </li>
            </ul>

            {/* Mobile Menu Button */}
            <button 
              onClick={toggleMenu}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white transition-all hover:bg-white/10 lg:hidden"
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* Mobile Nav Menu */}
          <div 
            className={`absolute left-0 right-0 top-[calc(100%+0.5rem)] lg:hidden transition-all duration-300 origin-top ${
              isOpen ? "scale-100 opacity-100 pointer-events-auto" : "scale-95 opacity-0 pointer-events-none"
            }`}
          >
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/90 p-4 backdrop-blur-2xl shadow-2xl">
              <ul className="flex flex-col gap-2">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className="flex w-full items-center rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-widest text-zinc-300 transition-all hover:bg-fuchsia-500/10 hover:text-fuchsia-400"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
                <li className="mt-2 pt-2 border-t border-white/10">
                  <a
                    href="#register"
                    onClick={() => setIsOpen(false)}
                    className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 py-4 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-fuchsia-500/20"
                  >
                    Register Now
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}