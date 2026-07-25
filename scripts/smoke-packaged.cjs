const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const executable = path.join(
  projectRoot,
  "release",
  "win-unpacked",
  "Agent Signal.exe"
);

if (!fs.existsSync(executable)) {
  console.error(`APP_SMOKE_FAILED: executable not found at ${executable}`);
  process.exit(1);
}

const child = spawn(executable, ["--smoke-test", "--enable-logging"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: "1"
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
});

let output = "";
const collect = (chunk) => {
  const text = chunk.toString("utf8");
  output += text;
  process.stdout.write(text);
};
child.stdout.on("data", collect);
child.stderr.on("data", collect);

const timeout = setTimeout(() => {
  child.kill();
  console.error("APP_SMOKE_FAILED: packaged app did not exit within 25 seconds.");
  process.exit(1);
}, 25_000);

child.once("error", (error) => {
  clearTimeout(timeout);
  console.error(`APP_SMOKE_FAILED: ${error.message}`);
  process.exit(1);
});

child.once("exit", (code) => {
  clearTimeout(timeout);
  const ok = code === 0 && output.includes("APP_SMOKE_OK");
  if (!ok) {
    console.error(
      `APP_SMOKE_FAILED: process exited with code ${code ?? "unknown"}.`
    );
  }
  process.exit(ok ? 0 : 1);
});
