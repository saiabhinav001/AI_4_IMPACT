import AboutSection from "../components/landing/AboutSection";
import EventsSection from "../components/landing/EventsSection";
import HeroSection from "../components/landing/HeroSection";
import HighlightsSection from "../components/landing/HighlightsSection";
import LandingNavbar from "../components/landing/LandingNavbar";
import SponsorsSection from "../components/landing/SponsorsSection";
import TimelineSection from "../components/landing/TimelineSection";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020205] text-white">
      <div className="noise-overlay" />
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-[10%] -top-[10%] h-[50vw] w-[50vw] rounded-full bg-fuchsia-900/10 blur-[120px]" />
        <div className="absolute -right-[10%] top-[20%] h-[40vw] w-[40vw] rounded-full bg-cyan-900/10 blur-[120px]" />
        <div className="absolute left-[20%] bottom-[-10%] h-[40vw] w-[40vw] rounded-full bg-violet-900/10 blur-[120px]" />
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
      </div>

      <LandingNavbar />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <HeroSection />
        <div className="flex flex-col gap-24 py-24 sm:gap-32 sm:py-32">
          <AboutSection />
          <EventsSection />
          <TimelineSection />
          <HighlightsSection />
          <SponsorsSection />
        </div>
      </div>

      {/* Retro Footer Decal */}
      <footer className="relative z-10 py-10 border-t border-white/5 bg-black/50 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <p className="text-[10px] uppercase tracking-[0.4em] text-zinc-600">
            © 2026 AI4 IMPACT // ALL SYSTEMS OPERATIONAL
          </p>
        </div>
      </footer>
    </main>
  );
}
