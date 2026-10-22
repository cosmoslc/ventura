import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { venturaRules } from "./rules.mjs";

/** apps/* (Next.js) uchun: Next tavsiyalari + loyiha qoidalari. */
export default [
  { ignores: [".next/**", ".next-dev/**", "next-env.d.ts"] },
  ...nextVitals,
  ...nextTs,
  venturaRules,
  {
    rules: {
      // O'zbekcha matnda tutuq belgisi (o', g') juda ko'p — JSX'da ' ruxsat; > va } taqiqlangan qoladi
      "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }],
    },
  },
];
