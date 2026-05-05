<<<<<<< HEAD
#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";

process.chdir(rootDir);

function isEffectivelyEmptySecret(value) {
  return value === undefined || value === "" || value === "\"\"" || value === "''";
}

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

function canImportUvicorn(command, args = [], extraEnv = {}) {
  const result = spawnSync(command, [...args, "-c", "import uvicorn"], {
    stdio: "ignore",
    shell: false,
    cwd: rootDir,
    env: { ...process.env, ...extraEnv },
  });

  return result.status === 0;
}

function findLocalSitePackages() {
  const libDir = path.join(rootDir, "backend", "venv", "lib");

  try {
    const entries = readdirSync(libDir, { withFileTypes: true });
    const pythonDir = entries.find((entry) => entry.isDirectory() && entry.name.startsWith("python"));
    if (!pythonDir) {
      return null;
    }

    const sitePackages = path.join(libDir, pythonDir.name, "site-packages");
    if (!statSync(sitePackages).isDirectory()) {
      return null;
    }

    return sitePackages;
  } catch {
    return null;
  }
}

function resolvePythonCommand() {
  const localCandidates = [
    { command: path.join(rootDir, "backend", "venv", "Scripts", "python.exe"), args: [], env: {} },
    { command: path.join(rootDir, "backend", "venv", "bin", "python"), args: [], env: {} },
  ];

  for (const candidate of localCandidates) {
    if (
      isExecutable(candidate.command) &&
      commandExists(candidate.command, [...candidate.args, "--version"]) &&
      canImportUvicorn(candidate.command, candidate.args, candidate.env)
    ) {
      return candidate;
    }
  }

  const localSitePackages = findLocalSitePackages();
  const globalCandidates = isWindows
    ? [
        { command: "py", args: ["-3"], env: {} },
        { command: "python", args: [], env: {} },
        { command: "python3", args: [], env: {} },
      ]
    : [
        { command: "python3", args: [], env: {} },
        { command: "python", args: [], env: {} },
      ];

  for (const candidate of globalCandidates) {
    if (
      commandExists(candidate.command, [...candidate.args, "--version"]) &&
      canImportUvicorn(candidate.command, candidate.args, candidate.env)
    ) {
      return candidate;
    }
  }

  if (localSitePackages) {
    for (const candidate of globalCandidates) {
      const env = {
        PYTHONPATH: process.env.PYTHONPATH
          ? `${localSitePackages}${path.delimiter}${process.env.PYTHONPATH}`
          : localSitePackages,
      };

      if (
        commandExists(candidate.command, [...candidate.args, "--version"]) &&
        canImportUvicorn(candidate.command, candidate.args, env)
      ) {
        return { ...candidate, env };
      }
    }
  }

  return null;
}

function resolveNpmCommand() {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath],
      needsValidation: false,
    };
  }

  if (isWindows) {
    return { command: "npm.cmd", args: [], needsValidation: true };
  }

  return { command: "npm", args: [], needsValidation: true };
}

function killProcessTree(child, label) {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }

  console.log(`Stopping ${label} (pid: ${child.pid})...`);

  if (isWindows) {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      shell: false,
    });
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // Best effort cleanup for local dev shutdown.
  }
}

const python = resolvePythonCommand();
if (!python) {
  console.error("Python 3 is required for backend startup.");
  process.exit(1);
}

const npm = resolveNpmCommand();
if (npm.needsValidation && !commandExists(npm.command)) {
  console.error("npm is required for frontend startup.");
  process.exit(1);
}

const env = { ...process.env };

if (isEffectivelyEmptySecret(env.JWT_SECRET)) {
  console.log("JWT_SECRET missing/empty. Using local dev fallback.");
  env.JWT_SECRET = "jobshaman-local-dev-secret-key-change-me";
}

if (isEffectivelyEmptySecret(env.SECRET_KEY)) {
  console.log("SECRET_KEY missing/empty. Using JWT_SECRET value for local dev.");
  env.SECRET_KEY = env.JWT_SECRET;
}

const backendArgs = [
  ...python.args,
  "-m",
  "uvicorn",
  "backend.app.main:app",
  "--reload",
  "--host",
  "0.0.0.0",
  "--port",
  "8000",
];

console.log(`Starting backend: ${[python.command, ...backendArgs].join(" ")}`);
const backend = spawn(python.command, backendArgs, {
  cwd: rootDir,
  env: { ...env, ...(python.env ?? {}) },
  stdio: "inherit",
  shell: false,
});

let frontend;

backend.on("exit", (code, signal) => {
  if (!frontend || frontend.exitCode !== null) {
    return;
  }

  const reason = signal ? `signal ${signal}` : `code ${code}`;
  console.log(`Backend exited (${reason}). Stopping frontend...`);
  killProcessTree(frontend, "frontend");
});

console.log("Starting frontend: npm run dev");
frontend = spawn(npm.command, [...npm.args, "run", "dev"], {
  cwd: rootDir,
  env,
  stdio: "inherit",
  shell: false,
});

let shuttingDown = false;

function cleanupAndExit(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  killProcessTree(frontend, "frontend");
  killProcessTree(backend, "backend");
  process.exit(exitCode);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => cleanupAndExit(0));
}

backend.on("error", (error) => {
  console.error(`Failed to start backend: ${error.message}`);
  cleanupAndExit(1);
});

frontend.on("error", (error) => {
  console.error(`Failed to start frontend: ${error.message}`);
  cleanupAndExit(1);
});

frontend.on("exit", (code, signal) => {
  const exitCode = code ?? (signal ? 1 : 0);
  cleanupAndExit(exitCode);
});
=======
#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";

process.chdir(rootDir);

function isEffectivelyEmptySecret(value) {
  return value === undefined || value === "" || value === "\"\"" || value === "''";
}

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

function canImportUvicorn(command, args = [], extraEnv = {}) {
  const result = spawnSync(command, [...args, "-c", "import uvicorn"], {
    stdio: "ignore",
    shell: false,
    cwd: rootDir,
    env: { ...process.env, ...extraEnv },
  });

  return result.status === 0;
}

function findLocalSitePackages() {
  const libDir = path.join(rootDir, "backend", "venv", "lib");

  try {
    const entries = readdirSync(libDir, { withFileTypes: true });
    const pythonDir = entries.find((entry) => entry.isDirectory() && entry.name.startsWith("python"));
    if (!pythonDir) {
      return null;
    }

    const sitePackages = path.join(libDir, pythonDir.name, "site-packages");
    if (!statSync(sitePackages).isDirectory()) {
      return null;
    }

    return sitePackages;
  } catch {
    return null;
  }
}

function resolvePythonCommand() {
  const localCandidates = [
    { command: path.join(rootDir, "backend", "venv", "Scripts", "python.exe"), args: [], env: {} },
    { command: path.join(rootDir, "backend", "venv", "bin", "python"), args: [], env: {} },
  ];

  for (const candidate of localCandidates) {
    if (
      isExecutable(candidate.command) &&
      commandExists(candidate.command, [...candidate.args, "--version"]) &&
      canImportUvicorn(candidate.command, candidate.args, candidate.env)
    ) {
      return candidate;
    }
  }

  const localSitePackages = findLocalSitePackages();
  const globalCandidates = isWindows
    ? [
        { command: "py", args: ["-3"], env: {} },
        { command: "python", args: [], env: {} },
        { command: "python3", args: [], env: {} },
      ]
    : [
        { command: "python3", args: [], env: {} },
        { command: "python", args: [], env: {} },
      ];

  for (const candidate of globalCandidates) {
    if (
      commandExists(candidate.command, [...candidate.args, "--version"]) &&
      canImportUvicorn(candidate.command, candidate.args, candidate.env)
    ) {
      return candidate;
    }
  }

  if (localSitePackages) {
    for (const candidate of globalCandidates) {
      const env = {
        PYTHONPATH: process.env.PYTHONPATH
          ? `${localSitePackages}${path.delimiter}${process.env.PYTHONPATH}`
          : localSitePackages,
      };

      if (
        commandExists(candidate.command, [...candidate.args, "--version"]) &&
        canImportUvicorn(candidate.command, candidate.args, env)
      ) {
        return { ...candidate, env };
      }
    }
  }

  return null;
}

function resolveNpmCommand() {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath],
      needsValidation: false,
    };
  }

  if (isWindows) {
    return { command: "npm.cmd", args: [], needsValidation: true };
  }

  return { command: "npm", args: [], needsValidation: true };
}

function killProcessTree(child, label) {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }

  console.log(`Stopping ${label} (pid: ${child.pid})...`);

  if (isWindows) {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      shell: false,
    });
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // Best effort cleanup for local dev shutdown.
  }
}

const python = resolvePythonCommand();
if (!python) {
  console.error("Python 3 is required for backend startup.");
  process.exit(1);
}

const npm = resolveNpmCommand();
if (npm.needsValidation && !commandExists(npm.command)) {
  console.error("npm is required for frontend startup.");
  process.exit(1);
}

const env = { ...process.env };

if (isEffectivelyEmptySecret(env.JWT_SECRET)) {
  console.log("JWT_SECRET missing/empty. Using local dev fallback.");
  env.JWT_SECRET = "jobshaman-local-dev-secret-key-change-me";
}

if (isEffectivelyEmptySecret(env.SECRET_KEY)) {
  console.log("SECRET_KEY missing/empty. Using JWT_SECRET value for local dev.");
  env.SECRET_KEY = env.JWT_SECRET;
}

const backendArgs = [
  ...python.args,
  "-m",
  "uvicorn",
  "backend.app.main:app",
  "--reload",
  "--host",
  "0.0.0.0",
  "--port",
  "8000",
];

console.log(`Starting backend: ${[python.command, ...backendArgs].join(" ")}`);
const backend = spawn(python.command, backendArgs, {
  cwd: rootDir,
  env: { ...env, ...(python.env ?? {}) },
  stdio: "inherit",
  shell: false,
});

let frontend;

backend.on("exit", (code, signal) => {
  if (!frontend || frontend.exitCode !== null) {
    return;
  }

  const reason = signal ? `signal ${signal}` : `code ${code}`;
  console.log(`Backend exited (${reason}). Stopping frontend...`);
  killProcessTree(frontend, "frontend");
});

console.log("Starting frontend: npm run dev");
frontend = spawn(npm.command, [...npm.args, "run", "dev"], {
  cwd: rootDir,
  env,
  stdio: "inherit",
  shell: false,
});

let shuttingDown = false;

function cleanupAndExit(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  killProcessTree(frontend, "frontend");
  killProcessTree(backend, "backend");
  process.exit(exitCode);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => cleanupAndExit(0));
}

backend.on("error", (error) => {
  console.error(`Failed to start backend: ${error.message}`);
  cleanupAndExit(1);
});

frontend.on("error", (error) => {
  console.error(`Failed to start frontend: ${error.message}`);
  cleanupAndExit(1);
});

frontend.on("exit", (code, signal) => {
  const exitCode = code ?? (signal ? 1 : 0);
  cleanupAndExit(exitCode);
});
>>>>>>> 4c20d82 (Jobshaman MVP 2.0: Clean repo, i18n Nordic expansion & engine optimization)
