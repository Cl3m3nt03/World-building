// Regenerates the sqlx offline cache (src-tauri/.sqlx/) used to check the
// query! macros at compile time without a database (CI runs with SQLX_OFFLINE).
// Run after changing a migration or a query: `pnpm db:prepare`.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const tauriDir = path.resolve(import.meta.dirname, "..", "src-tauri");
const database = path.join(tauriDir, "target", "sqlx-dev.db");
mkdirSync(path.dirname(database), { recursive: true });

const env = { ...process.env, DATABASE_URL: `sqlite:${database.replaceAll("\\", "/")}` };
const run = (args) => execFileSync("cargo", args, { cwd: tauriDir, env, stdio: "inherit" });

// Fresh development database with every migration applied.
run(["sqlx", "database", "reset", "-y", "--source", "migrations"]);
// Describe every query! of every target (tests included) into .sqlx/.
run(["sqlx", "prepare", "--", "--all-targets"]);
