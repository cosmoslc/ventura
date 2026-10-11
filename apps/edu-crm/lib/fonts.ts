import localFont from "next/font/local";

/*
 * Shrift fayllari loyihaning o'zida (app/fonts, SIL Open Font License). Avval next/font/google edi:
 * u har build paytida shriftni internetdan yuklardi va tarmoq uzilsa build yiqilardi (CI'da shunday bo'lgan).
 * O'zgaruvchan (variable) shrift: bitta faylda hamma qalinlik. Faqat lotin harflari (o'zbekcha ʻ va ʼ bilan).
 */
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
