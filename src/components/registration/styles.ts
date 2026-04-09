import type { CSSProperties } from "react";

export type RegistrationTrack = "workshop" | "hackathon";

export const registrationPalette = {
  primary: "#8D36D5",
  deep: "#46067A",
  background: "#07020E",
  text: "#EDE8F5",
  muted: "rgba(237,232,245,0.45)",
  border: "rgba(141,54,213,0.28)",
  borderLit: "rgba(141,54,213,0.7)",
  glass: "rgba(15,6,28,0.7)",
};

const noiseTexture =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export const portalStyles: {
  meshBackground: CSSProperties;
  meshGrid: CSSProperties;
  noiseOverlay: CSSProperties;
  orbBase: CSSProperties;
  orbOne: CSSProperties;
  orbTwo: CSSProperties;
  orbThree: CSSProperties;
  glassCard: CSSProperties;
  cardGlow: CSSProperties;
  tabIndicatorGlow: CSSProperties;
  qrFrameGlow: CSSProperties;
  submitGlow: CSSProperties;
  submitGlowHover: CSSProperties;
  uploadGlow: CSSProperties;
} = {
  meshBackground: {
    background:
      "radial-gradient(ellipse 80% 80% at 50% -10%, rgba(70,6,122,0.55) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 90% 90%, rgba(141,54,213,0.18) 0%, transparent 60%), #07020E",
  },
  meshGrid: {
    backgroundImage:
      "repeating-linear-gradient(0deg, rgba(141,54,213,0.04) 0px, transparent 1px, transparent 60px, rgba(141,54,213,0.04) 60px), repeating-linear-gradient(90deg, rgba(141,54,213,0.04) 0px, transparent 1px, transparent 60px, rgba(141,54,213,0.04) 60px)",
    WebkitMaskImage:
      "radial-gradient(ellipse at 50% 0%, black 0%, transparent 75%)",
    maskImage: "radial-gradient(ellipse at 50% 0%, black 0%, transparent 75%)",
  },
  noiseOverlay: {
    backgroundImage: noiseTexture,
    backgroundSize: "200px",
    opacity: 0.035,
  },
  orbBase: {
    borderRadius: "9999px",
    filter: "blur(90px)",
    opacity: 0.25,
  },
  orbOne: {
    width: "500px",
    height: "500px",
    background: registrationPalette.deep,
  },
  orbTwo: {
    width: "380px",
    height: "380px",
    background: registrationPalette.primary,
    opacity: 0.15,
  },
  orbThree: {
    width: "280px",
    height: "280px",
    background: "#C070FF",
    opacity: 0.1,
  },
  glassCard: {
    background: registrationPalette.glass,
    border: `1px solid ${registrationPalette.border}`,
    backdropFilter: "blur(32px) saturate(160%)",
    WebkitBackdropFilter: "blur(32px) saturate(160%)",
  },
  cardGlow: {
    boxShadow:
      "0 0 0 1px rgba(141,54,213,0.06) inset, 0 32px 80px rgba(0,0,0,0.5), 0 0 32px rgba(141,54,213,0.45), 0 0 64px rgba(70,6,122,0.3)",
  },
  tabIndicatorGlow: {
    boxShadow: "0 0 12px rgba(141,54,213,0.8)",
  },
  qrFrameGlow: {
    boxShadow: "0 0 0 1px rgba(141,54,213,0.3), 0 0 16px rgba(141,54,213,0.35)",
  },
  submitGlow: {
    boxShadow:
      "0 0 0 1px rgba(141,54,213,0.5), 0 8px 32px rgba(141,54,213,0.35), 0 0 60px rgba(141,54,213,0.15)",
  },
  submitGlowHover: {
    boxShadow:
      "0 0 0 1px rgba(141,54,213,0.7), 0 12px 40px rgba(141,54,213,0.5), 0 0 80px rgba(141,54,213,0.2)",
  },
  uploadGlow: {
    boxShadow: "0 0 20px rgba(141,54,213,0.2)",
  },
};
