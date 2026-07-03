import { copyFile, cp, mkdir, readFile, rm } from "node:fs/promises";
import { build } from "esbuild";

await rm("dist", { recursive: true, force: true });
await mkdir("dist/vendor", { recursive: true });

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const contentScriptFiles = new Set(
  (manifest.content_scripts || []).flatMap((script) => Array.isArray(script.js) ? script.js : [])
);

const common = {
  bundle: true,
  platform: "browser",
  target: "chrome120",
  sourcemap: false,
  minify: false,
  logLevel: "info"
};

const builds = [
  {
    ...common,
    entryPoints: ["src/background/index.ts"],
    outfile: "dist/background.js",
    format: "iife"
  },
  {
    ...common,
    entryPoints: ["src/content/index.ts"],
    outfile: "dist/autofill.js",
    format: "iife"
  }
];

if (contentScriptFiles.has("app-bridge.js")) {
  builds.push({
    ...common,
    entryPoints: ["src/content/app-bridge.ts"],
    outfile: "dist/app-bridge.js",
    format: "iife"
  });
}

await Promise.all(builds.map((options) => build(options)));

await copyFile("manifest.json", "dist/manifest.json");
await cp("icons", "dist/icons", { recursive: true });
await copyFile("vendor/wa-store-migrate.bundle.js", "dist/vendor/wa-store-migrate.bundle.js");
