import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { selectCaddyConfig } from "./dev-runtime";

const repositoryRoot = resolve(import.meta.dir, "..");
const config = selectCaddyConfig(
	["Caddyfile", "Caddyfile.example"].filter((file) =>
		existsSync(resolve(repositoryRoot, file)),
	),
);
const caddy = Bun.which("caddy");

if (!caddy) {
	console.warn(
		"[dev:caddy] Caddy is not installed; continuing without the optional HTTP/2 development proxy.",
	);
	process.exit(0);
}

if (!config) {
	console.warn(
		"[dev:caddy] No Caddyfile or Caddyfile.example exists; continuing without the optional proxy.",
	);
	process.exit(0);
}

if (config === "Caddyfile.example") {
	console.warn(
		"[dev:caddy] Using Caddyfile.example because Caddyfile is absent.",
	);
}

const child = Bun.spawn(
	[caddy, "run", "--config", resolve(repositoryRoot, config)],
	{
		cwd: repositoryRoot,
		env: process.env,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	},
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.once(signal, () => child.kill(signal));
}

process.exit(await child.exited);
