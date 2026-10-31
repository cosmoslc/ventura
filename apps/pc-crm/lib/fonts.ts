import localFont from "next/font/local";

const quicksand = localFont({
  src: "../app/fonts/quicksand-latin-wght-normal.woff2",
  weight: "300 700",
  display: "swap",
  variable: "--font-quicksand",
});

const jetbrains = localFont({
  src: "../app/fonts/jetbrains-mono-latin-wght-normal.woff2",
  weight: "100 800",
  display: "swap",
  variable: "--font-jetbrains",
});

export const fontVariables = [quicksand.variable, jetbrains.variable].join(" ");
