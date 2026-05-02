import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      colors: {
        cream: "#f7f1e3",
        chalk: "#fffdf6",
        paper: "#efe6d2",
        cobalt: "#1d3fb3",
        "cobalt-light": "#3458d4",
        "cobalt-deep": "#0c1f6b",
        ink: "#0a1746",
        ash: "#6b7790",
        coral: "#ff4d4d",
        amber: "#f4a93a",
      },
      boxShadow: {
        card: "0 1px 0 rgba(10,23,70,0.06), 0 8px 28px rgba(10,23,70,0.06)",
        crisp: "0 1px 0 rgba(10,23,70,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
