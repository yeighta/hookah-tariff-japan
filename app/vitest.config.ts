import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Kept separate from vite.config.ts: the Remix and Netlify plugins aren't needed to test plain modules.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["app/**/*.test.ts"],
  },
});
