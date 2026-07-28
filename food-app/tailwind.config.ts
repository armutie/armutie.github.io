import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "hsl(var(--canvas))",
        paper: "hsl(var(--paper))",
        ink: "hsl(var(--ink))",
        muted: "hsl(var(--muted))",
        line: "hsl(var(--line))",
        herb: "hsl(var(--herb))",
        "herb-soft": "hsl(var(--herb-soft))",
        tomato: "hsl(var(--tomato))",
        citrus: "hsl(var(--citrus))",
        plum: "hsl(var(--plum))"
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Newsreader", "serif"]
      },
      boxShadow: {
        lift: "0 18px 45px rgba(40, 55, 42, 0.12)",
        soft: "0 8px 24px rgba(40, 55, 42, 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
