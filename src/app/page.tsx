import dynamic from "next/dynamic";
import HeroSection from "../components/landing/HeroSection";

const ParallaxBackground = dynamic(
  () => import("../components/ui/parallax-background").then((mod) => mod.ParallaxBackground)
);

const KineticHUD = dynamic(
  () => import("../components/ui/kinetic-hud").then((mod) => mod.KineticHUD)
);

const AboutSection = dynamic(() => import("../components/landing/AboutSection"));
const EventsSection = dynamic(() => import("../components/landing/EventsSection"));
const TimelineSection = dynamic(() => import("../components/landing/TimelineSection"));
const HighlightsSection = dynamic(() => import("../components/landing/HighlightsSection"));
const SponsorsSection = dynamic(() => import("../components/landing/SponsorsSection"));

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <ParallaxBackground />
      <KineticHUD />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-0 sm:px-6 lg:px-8">
        <HeroSection />
        <AboutSection />
        <EventsSection />
        <TimelineSection />
        <HighlightsSection />
        <SponsorsSection />
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
