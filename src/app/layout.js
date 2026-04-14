import "./globals.css";
import localFont from "next/font/local";
import SmoothScroll from "../components/SmoothScroll";
import { CustomHUDScrollbar } from "../components/ui/custom-hud-scrollbar";
import LandingNavbar from "../components/landing/LandingNavbar";

const headingFont = localFont({
  src: "../../public/fonts/Furore.otf",
  variable: "--font-heading",
  display: "swap",
});

const bodyFont = localFont({
  src: [
    {
      path: "../../public/fonts/carbonplus-light-bl.otf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/carbonplus-regular-bl.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/carbonplus-bold-bl.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-body",
  display: "swap",
});
export const metadata = {
  title: "AI 4 Impact | CBIT",
  description: "Learn. Build. Impact.",
  icons: {
    icon: [
      { url: "/site-icon.svg", type: "image/svg+xml" },
      { url: "/site-icon.png", type: "image/png" },
    ],
    shortcut: [
      { url: "/site-icon.svg", type: "image/svg+xml" },
      { url: "/site-icon.png", type: "image/png" },
    ],
    apple: [{ url: "/site-icon.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <body
        suppressHydrationWarning
        className={`${headingFont.variable} ${bodyFont.variable} antialiased selection:bg-fuchsia-500/30 selection:text-fuchsia-200`}
      >
        <LandingNavbar />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
