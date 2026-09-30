import type { Config } from "tailwindcss";
import baseConfig from "./tailwind.config";

// Pełny zestaw źródeł (w tym admin) — arkusz admina jest nadzbiorem publicznego.
export default {
  ...baseConfig,
  content: ["./src/**/*.{ts,tsx}"],
} satisfies Config;
