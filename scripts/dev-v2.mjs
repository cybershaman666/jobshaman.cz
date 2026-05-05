#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";

function isExecutable(filePath) {
  try {
    accessSync(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function commandExists(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    stdio: "ignore",
    shell: false,
  });
  return result.status === 0;
}

function resolvePythonCommand() {
  const localCandidates = [
    path.join(rootDir, "backend", ".venv", "bin", "python"),
    path.join(rootDir, "backend", ".venv", "Scripts", "python.exe"),
    path.join(rootDir, "backend", "venv", "bin", "python"),
    path.join(rootDir, "backend", "venv", "Scripts", "python.exe"),
  ];

  for (const localPath of localCandidates) {
    if (isExecutable(localPath)) return localPath;
  }

  const globalCandidates = isWindows
    ? ["python", "python3", "py"]
    : ["python3", "python"];

  for (const cmd of globalCandidates) {
    if (commandExists(cmd)) return cmd;
  }
  return null;
}

function resolveNpmCommand() {
  return isWindows ? "npm.cmd" : "npm";
}

const pythonCmd = resolvePythonCommand();
const npmCmd = resolveNpmCommand();

if (!pythonCmd) {
  console.error("Python 3 is required.");
  process.exit(1);
}

// 1. Start V2 Backend
console.log("Starting Backend (FastAPI V2)...");
const backend = spawn(pythonCmd, ["-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"], {
  cwd: path.join(rootDir, "backend"),
  stdio: "inherit",
  shell: isWindows,
  env: { ...process.env, PYTHONPATH: "." }
});

// 2. Start Frontend (Vite V2)
console.log("Starting Frontend (Vite)...");
const frontend = spawn(npmCmd, ["run", "dev"], {
  cwd: path.join(rootDir, "frontend"),
  stdio: "inherit",
  shell: isWindows
});

function cleanup() {
  console.log("\nStopping V2 development environment...");
  backend.kill();
  frontend.kill();
  process.exit();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

backend.on("exit", (code) => {
  console.log(`Backend process exited with code ${code}`);
  cleanup();
});

frontend.on("exit", (code) => {
  console.log(`Frontend process exited with code ${code}`);
  cleanup();
});
