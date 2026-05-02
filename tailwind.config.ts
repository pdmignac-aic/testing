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
        ink: "#0a0a0a",
        bone: "#ededed",
        smoke: "#9a9a9a",
        blood: "#ff2e2e",
      },
    },
  },
  plugins: [],
};

export default config;
