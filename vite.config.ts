// The Vite config wrapper already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only, `cloudflare-module` default target — overridden to `vercel` below),
//     VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Pin the Nitro deploy target. Without this the wrapper falls back to its
  // `defaultPreset: "cloudflare-module"`, which emits a Worker bundle
  // (`.output/server/wrangler.json` + `.wrangler/`) that Vercel cannot run.
  // The `vercel` preset emits Build Output API v3 into `.vercel/output`
  // (`.vercel/output/functions/` + `.vercel/output/static/`).
  nitro: { preset: "vercel" },
});
