import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        surface: "#FFFFFF",
        surfaceElevated: "#F8FAFC",
        surfaceHover: "#F1F5F9",
        borderDark: "#E5E7EB",
        borderSubtle: "#E2E8F0",
        rhGreen: "#CDFF00",
        rhGreenHover: "#BCE600",
        rhRed: "#FF5000",
        mutedGray: "#64748B",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tight: "-0.02em",
        tighter: "-0.035em",
      },
      boxShadow: {
        glowGreen: "0 0 25px -5px rgba(205, 255, 0, 0.4)",
        glowRed: "0 0 25px -5px rgba(255, 80, 0, 0.35)",
        card: "0 4px 20px rgba(0, 0, 0, 0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
