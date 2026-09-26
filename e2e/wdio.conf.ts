/**
 * End-to-end tests: WebdriverIO drives the real app through tauri-driver,
 * which relays WebDriver commands to msedgedriver (WebView2).
 *
 * Prerequisites (see README): `cargo install tauri-driver@2.0.6 --locked`,
 * then `pnpm test:e2e` installs the matching msedgedriver and builds the app.
 *
 * Every run uses a fresh temporary BUILDERZ_HOME, so the tests never touch the
 * real settings, logs or Documents folder (see src-tauri/src/paths.rs).
 */
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const application = path.join(root, "src-tauri", "target", "debug", "builderz.exe");
const msedgedriver = path.join(root, "e2e", ".bin", "msedgedriver.exe");
const tauriDriverBin = process.env.TAURI_DRIVER ?? "tauri-driver";

// Created once by the launcher; the workers inherit it through the environment.
process.env.BUILDERZ_HOME ??= mkdtempSync(path.join(os.tmpdir(), "builderz-e2e-"));
const home = process.env.BUILDERZ_HOME;

let tauriDriver: ChildProcess | undefined;

/**
 * Native driver given to tauri-driver. With E2E_DRIVER_LOG=<file>, a small
 * wrapper runs msedgedriver with --verbose logging to that file (tauri-driver
 * has no option for it); used by CI to diagnose session failures.
 */
function nativeDriver(): string {
  const log = process.env.E2E_DRIVER_LOG;
  if (!log) return msedgedriver;
  const wrapper = path.join(root, "e2e", ".bin", "msedgedriver-verbose.cmd");
  writeFileSync(wrapper, `@"${msedgedriver}" %* --verbose "--log-path=${log}"\r\n`);
  return wrapper;
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }
}

export const config: WebdriverIO.Config = {
  runner: "local",
  specs: ["./specs/**/*.e2e.ts"],
  maxInstances: 1,
  hostname: "127.0.0.1",
  port: 4444,
  capabilities: [
    {
      // @ts-expect-error tauri-driver's own capability, unknown to WebdriverIO's types
      "tauri:options": { application },
    },
  ],
  logLevel: "warn",
  waitforTimeout: 15_000,
  connectionRetryCount: 2,
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: { ui: "bdd", timeout: 120_000 },

  onPrepare() {
    run("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join("scripts", "install-msedgedriver.ps1"),
    ]);
    if (process.env.E2E_SKIP_BUILD !== "1") {
      // Debug build with the front bundled (no dev server).
      // Through node + pnpm's own entry point: no shell needed for pnpm.cmd.
      const pnpm = process.env.npm_execpath;
      if (!pnpm) throw new Error("Run the e2e tests through pnpm (pnpm test:e2e).");
      run(process.execPath, [pnpm, "tauri", "build", "--debug", "--no-bundle"]);
    }
    console.log(`BUILDERZ_HOME=${home}`);
  },

  beforeSession() {
    tauriDriver = spawn(tauriDriverBin, ["--native-driver", nativeDriver()], {
      stdio: ["ignore", "inherit", "inherit"],
      env: process.env,
    });
  },

  afterSession() {
    tauriDriver?.kill();
  },

  onComplete() {
    if (process.env.E2E_KEEP_HOME !== "1") {
      rmSync(home, { recursive: true, force: true });
    }
  },
};
