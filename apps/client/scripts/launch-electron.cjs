const { spawn } = require("node:child_process");
const path = require("node:path");

const appRoot = path.resolve(__dirname, "..");
const electronBinary = require("electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

if (!env.VITE_DEV_SERVER_URL) {
  env.VITE_DEV_SERVER_URL = "http://localhost:5173";
}

const child = spawn(electronBinary, ["."], {
  cwd: appRoot,
  stdio: "inherit",
  env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
