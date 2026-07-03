import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

await rm("dist", { recursive: true, force: true });
await mkdir("dist/vendor", { recursive: true });

const common = {
  bundle: true,
  platform: "browser",
  target: "chrome120",
  sourcemap: false,
  minify: false,
  logLevel: "info"
};

await Promise.all([
  build({
    ...common,
    entryPoints: ["src/background/index.ts"],
    outfile: "dist/background.js",
    format: "iife"
  }),
  build({
    ...common,
    entryPoints: ["src/content/index.ts"],
    outfile: "dist/autofill.js",
    format: "iife"
  }),
  build({
    ...common,
    entryPoints: ["src/content/app-bridge.ts"],
    outfile: "dist/app-bridge.js",
    format: "iife"
  })
]);

await copyFile("manifest.json", "dist/manifest.json");
await cp("icons", "dist/icons", { recursive: true });
await copyFile("vendor/wa-store-migrate.bundle.js", "dist/vendor/wa-store-migrate.bundle.js");
