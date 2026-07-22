import {
	type ExecFileOptionsWithStringEncoding,
	execFile,
} from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Cache the shell environment to avoid repeated shell spawns
let cachedEnv: Record<string, string> | null = null;
let cacheTime = 0;
let isFallbackCache = false;
const CACHE_TTL_MS = 60_000; // 1 minute cache
const FALLBACK_CACHE_TTL_MS = 10_000; // 10 second cache for fallback (retry sooner)

// Track PATH fix state for macOS GUI app PATH fix
let pathFixAttempted = false;
let pathFixSucceeded = false;

export function parseEnvironmentOutput(stdout: string): Record<string, string> {
	const environment: Record<string, string> = {};
	for (const line of stdout.split(/\r?\n/)) {
		const index = line.indexOf("=");
		if (index > 0) {
			environment[line.substring(0, index)] = line.substring(index + 1);
		}
	}
	return environment;
}

export function combineWindowsPaths(
	currentPath?: string,
	machinePath?: string,
	userPath?: string,
): string {
	return [currentPath, machinePath, userPath]
		.filter((value): value is string => Boolean(value?.trim()))
		.join(";");
}

export function getEnvironmentCommand(
	platform: NodeJS.Platform = process.platform,
	environment: NodeJS.ProcessEnv = process.env,
): { command: string; args: string[] } {
	if (platform === "win32") {
		return {
			command: environment.ComSpec || "cmd.exe",
			args: ["/d", "/s", "/c", "set"],
		};
	}
	if (environment.SHELL) {
		return { command: environment.SHELL, args: ["-lc", "env"] };
	}
	return {
		command: platform === "darwin" ? "/bin/zsh" : "/bin/bash",
		args: ["-lc", "env"],
	};
}

async function getFreshWindowsPath(): Promise<string | undefined> {
	const systemRoot = process.env.SystemRoot || "C:\\Windows";
	const powershell = `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
	try {
		const { stdout } = await execFileAsync(
			powershell,
			[
				"-NoLogo",
				"-NoProfile",
				"-NonInteractive",
				"-Command",
				"[string]::Join(';', @([Environment]::GetEnvironmentVariable('Path','Machine'), [Environment]::GetEnvironmentVariable('Path','User')))",
			],
			{ encoding: "utf8", timeout: 10_000 },
		);
		return stdout.trim() || undefined;
	} catch {
		return undefined;
	}
}

/**
 * Gets the full shell environment by spawning a login shell.
 * This captures PATH and other environment variables set in shell profiles
 * which includes tools installed via homebrew.
 *
 * Uses -lc (login, command) instead of -ilc to avoid interactive prompts
 * and TTY issues from dotfiles expecting a terminal.
 *
 * Results are cached for 1 minute to avoid spawning shells repeatedly.
 */
export async function getShellEnvironment(): Promise<Record<string, string>> {
	const now = Date.now();
	const ttl = isFallbackCache ? FALLBACK_CACHE_TTL_MS : CACHE_TTL_MS;
	if (cachedEnv && now - cacheTime < ttl) {
		// Return a copy to prevent caller mutations from corrupting cache
		return { ...cachedEnv };
	}

	const environmentCommand = getEnvironmentCommand();

	try {
		// Use -lc flags (not -ilc):
		// -l: login shell (sources .zprofile/.profile for PATH setup)
		// -c: execute command
		// Avoids -i (interactive) to skip TTY prompts and reduce latency
		const { stdout } = await execFileAsync(
			environmentCommand.command,
			environmentCommand.args,
			{
				timeout: 10_000,
				env: {
					...process.env,
					HOME: os.homedir(),
				},
			},
		);

		const env = parseEnvironmentOutput(stdout);
		if (process.platform === "win32") {
			const freshWindowsPath = await getFreshWindowsPath();
			const combinedPath = combineWindowsPaths(
				env.Path || env.PATH,
				freshWindowsPath,
			);
			if (combinedPath) {
				env.Path = combinedPath;
				env.PATH = combinedPath;
			}
		}

		cachedEnv = env;
		cacheTime = now;
		isFallbackCache = false;
		return { ...env };
	} catch (error) {
		console.warn(
			`[shell-env] Failed to get shell environment: ${error}. Falling back to process.env`,
		);
		// Fall back to process.env if shell spawn fails
		// Cache with shorter TTL so we retry sooner
		const fallback: Record<string, string> = {};
		for (const [key, value] of Object.entries(process.env)) {
			if (typeof value === "string") {
				fallback[key] = value;
			}
		}
		cachedEnv = fallback;
		cacheTime = now;
		isFallbackCache = true;
		return { ...fallback };
	}
}

/**
 * Clears the cached shell environment.
 * Useful for testing or when environment changes are expected.
 */
export function clearShellEnvCache(): void {
	cachedEnv = null;
	cacheTime = 0;
	isFallbackCache = false;
}

/**
 * Returns process env merged with login-shell PATH.
 * Use this for child processes that should resolve binaries exactly
 * as they do in an interactive terminal.
 */
export async function getProcessEnvWithShellPath(
	baseEnv: NodeJS.ProcessEnv = process.env,
): Promise<Record<string, string>> {
	const shellEnv = await getShellEnvironment();
	const env: Record<string, string> = {};

	for (const [key, value] of Object.entries(baseEnv)) {
		if (typeof value === "string") {
			env[key] = value;
		}
	}

	const shellPath = shellEnv.PATH || shellEnv.Path;
	if (!shellPath) {
		return env;
	}

	env.PATH = shellPath;
	if (process.platform === "win32" || "Path" in baseEnv || "Path" in shellEnv) {
		env.Path = shellPath;
	}

	return env;
}

/**
 * Execute a command, retrying once with shell environment if it fails with ENOENT.
 * On macOS, GUI apps launched from Finder/Dock get minimal PATH that excludes
 * homebrew and other user-installed tools. This lazily derives the user's
 * shell environment only when needed, then persists the fix to process.env.PATH.
 */
export async function execWithShellEnv(
	cmd: string,
	args: string[],
	options?: Omit<ExecFileOptionsWithStringEncoding, "encoding">,
): Promise<{ stdout: string; stderr: string }> {
	try {
		return await execFileAsync(cmd, args, { ...options, encoding: "utf8" });
	} catch (error) {
		// Only retry on ENOENT (command not found).
		// Skip if we've already successfully fixed PATH, or if a fix attempt is in progress
		if (
			pathFixSucceeded ||
			pathFixAttempted ||
			!(error instanceof Error) ||
			!("code" in error) ||
			error.code !== "ENOENT"
		) {
			throw error;
		}

		pathFixAttempted = true;
		console.log("[shell-env] Command not found, deriving shell environment");

		try {
			const shellEnv = await getShellEnvironment();

			// Persist the fix to process.env so all subsequent calls benefit
			const shellPath = shellEnv.PATH || shellEnv.Path;
			if (shellPath) {
				process.env.PATH = shellPath;
				if (process.platform === "win32") process.env.Path = shellPath;
				pathFixSucceeded = true;
				console.log("[shell-env] Fixed process.env.PATH for GUI app");
			}

			// Retry with fixed env (respect caller's other env vars, force PATH if present)
			const retryEnv = shellPath
				? { ...shellEnv, ...options?.env, PATH: shellPath, Path: shellPath }
				: { ...shellEnv, ...options?.env };

			return await execFileAsync(cmd, args, {
				...options,
				encoding: "utf8",
				env: retryEnv,
			});
		} catch (retryError) {
			// Shell env derivation or retry failed - allow future retries
			pathFixAttempted = false;
			console.error("[shell-env] Retry failed:", retryError);
			throw retryError;
		}
	}
}
