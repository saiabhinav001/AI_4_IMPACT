import "./globals.css";
import SmoothScroll from "../components/SmoothScroll";
import { Inter, Outfit } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

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
      <body suppressHydrationWarning className={`${inter.variable} ${outfit.variable} antialiased selection:bg-fuchsia-500/30 selection:text-fuchsia-200`}>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
