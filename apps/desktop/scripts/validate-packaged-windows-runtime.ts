/**
 * Validate the runtime closure of electron-builder's Windows unpacked output.
 *
 * The native-module probe runs through the packaged ADE executable so every
 * addon is loaded with the same Electron ABI used by the installed app.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const projectRoot = join(import.meta.dirname, "..");

function fail(message: string): never {
	throw new Error(`[validate:packaged-windows-runtime] ${message}`);
}

function assertExists(pathname: string, reason: string): void {
	if (!existsSync(pathname)) fail(`${reason}\nMissing path: ${pathname}`);
}

function validateExternalResources(resourcesDir: string): void {
	const extensionDir = join(resourcesDir, "browser-extension");
	for (const filename of ["manifest.json", "background.js", "content.js"]) {
		assertExists(
			join(extensionDir, filename),
			"Packaged browser extension is incomplete.",
		);
	}

	const migrationsDir = join(resourcesDir, "resources", "migrations");
	assertExists(migrationsDir, "Packaged database migrations are missing.");
	if (
		!readdirSync(migrationsDir).some((filename) => filename.endsWith(".sql"))
	) {
		fail(`No SQL migrations found in ${migrationsDir}`);
	}
}

function createElectronProbe(
	resourcesDir: string,
	expectedVersion?: string,
): string {
	return `
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const resourcesDir = ${JSON.stringify(resourcesDir)};
const expectedVersion = ${JSON.stringify(expectedVersion)};
const appAsar = join(resourcesDir, "app.asar");

for (const relativePath of [
  "dist/main/index.js",
  "dist/main/terminal-host.js",
  "dist/main/pty-subprocess.js",
]) {
  const pathname = join(appAsar, relativePath);
  if (!existsSync(pathname)) throw new Error("Missing packaged application file: " + pathname);
}

const packagedVersion = require(join(appAsar, "package.json")).version;
if (expectedVersion && packagedVersion !== expectedVersion) {
  throw new Error("Expected packaged version " + expectedVersion + ", got " + packagedVersion);
}
console.log("Packaged version " + packagedVersion);

for (const moduleName of [
  "better-sqlite3",
  "node-pty",
  "@ast-grep/napi",
  "libsql",
  "@libsql/win32-x64-msvc",
]) {
  const modulePath = join(appAsar, "node_modules", moduleName);
  require(modulePath);
  console.log("Loaded " + moduleName);
}
`;
}

export function validatePackagedWindowsRuntime(
	unpackedDir: string,
	expectedVersion?: string,
): void {
	const resolvedUnpackedDir = resolve(unpackedDir);
	const executablePath = join(resolvedUnpackedDir, "ADE.exe");
	const resourcesDir = join(resolvedUnpackedDir, "resources");

	assertExists(executablePath, "Packaged ADE executable is missing.");
	assertExists(join(resourcesDir, "app.asar"), "Packaged app.asar is missing.");
	validateExternalResources(resourcesDir);

	const result = spawnSync(
		executablePath,
		["-e", createElectronProbe(resourcesDir, expectedVersion)],
		{
			cwd: resolvedUnpackedDir,
			env: {
				...process.env,
				ELECTRON_RUN_AS_NODE: "1",
			},
			encoding: "utf8",
			timeout: 60_000,
		},
	);

	if (result.error) {
		fail(`Packaged Electron probe could not start: ${result.error.message}`);
	}
	if (result.status !== 0) {
		fail(
			[
				`Packaged Electron probe exited with status ${result.status ?? "unknown"}.`,
				result.stdout.trim(),
				result.stderr.trim(),
			]
				.filter(Boolean)
				.join("\n"),
		);
	}

	console.log(result.stdout.trim());
	console.log(
		"[validate:packaged-windows-runtime] Packaged Windows runtime checks passed",
	);
}

if (import.meta.main) {
	if (process.platform !== "win32" || process.arch !== "x64") {
		fail("This verifier must run on Windows x64.");
	}

	validatePackagedWindowsRuntime(
		process.argv[2] ?? join(projectRoot, "release", "win-unpacked"),
		process.argv[3],
	);
}
