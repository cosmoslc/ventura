import { JetBrains_Mono, Quicksand } from "next/font/google";

// Shriftlar o'z serverimizdan beriladi (next/font), tashqi CDN'ga so'rov yo'q.
const quicksand = Quicksand({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-quicksand" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-jetbrains" });

export const fontVariables = [quicksand.variable, jetbrains.variable].join(" ");
