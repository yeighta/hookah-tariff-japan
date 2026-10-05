import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mist: { DEFAULT: "#EEF2EF", deep: "#DFE7E2", line: "#C9D6D0" },
        ink: { DEFAULT: "#0E2420", soft: "#4A5E59", faint: "#7C8E89" },
        glass: { DEFAULT: "#0D3D36", deep: "#082C27", line: "#2A5A52" },
        brass: { DEFAULT: "#D4AE55", deep: "#8A6A1F" },
        sage: "#8DB5A8",
        ember: "#F08A5D",
        smoke: "#B9A3E3",
        leaf: "#E6EEE9",
      },
      fontFamily: {
        sans: ['"Zen Kaku Gothic New"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Bricolage Grotesque"', '"Zen Kaku Gothic New"', "ui-sans-serif", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
