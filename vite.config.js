import { defineConfig } from "vite";

// base: "./" keeps asset URLs relative so the built site works from any
// host or sub-path (GitHub Pages, Netlify, a file server, etc.) without
// reconfiguration. Change to "/<repo>/" only if you need absolute paths.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true
  },
  server: {
    port: 5173
  },
  // Scope Vitest to the app's own tests, ignoring deps and build output.
  test: {
    include: ["src/**/*.test.js"],
    exclude: ["**/node_modules/**", "dist/**"]
  }
});
