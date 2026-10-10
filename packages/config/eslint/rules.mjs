/** Loyiha qoidalari (CLAUDE.md): `any` taqiqlangan, ishlatilmagan o'zgaruvchi — xato (`_` bilan boshlansa mumkin). */
export const venturaRules = {
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
  },
};
