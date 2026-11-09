import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import CureProjectionEffects from "@/components/CureProjectionEffects";
import TestToZeroHeader from "@/components/TestToZeroHeader";
import HydrationGate from "@/app/cure-api/TSMonsterEngine/GreenCardKit/HydrationGate";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-ibm-plex-mono" });

export const metadata: Metadata = {
  title: "ChartUI",
  description: "ChartUI realtime market signal command center",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${display.variable} ${mono.variable}`}><AuthSessionProvider><HydrationGate fallback={<div className="min-h-screen bg-[#05020a]" />}><CureProjectionEffects /><TestToZeroHeader />{children}</HydrationGate></AuthSessionProvider></body></html>;
}
