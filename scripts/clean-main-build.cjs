const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const outputPath = path.join(projectRoot, "dist-electron");

if (path.dirname(outputPath) !== projectRoot) {
  throw new Error(`Refusing to clean unexpected path: ${outputPath}`);
}

fs.rmSync(outputPath, { recursive: true, force: true });
