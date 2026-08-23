import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#F8FAFC",
        muted: "#94A3B8",
        panel: "rgba(8, 27, 51, 0.72)",
        line: "rgba(0, 212, 255, 0.18)",
        brand: "#00D4FF",
        action: "#0066FF",
        success: "#00E676",
        warning: "#FFD166",
        danger: "#FF4D6D"
      },
      boxShadow: {
        panel: "0 20px 70px rgba(0, 0, 0, 0.35)",
        glow: "0 0 0 1px rgba(0, 212, 255, 0.22), 0 18px 55px rgba(0, 102, 255, 0.18)",
        neon: "0 0 22px rgba(0, 212, 255, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
