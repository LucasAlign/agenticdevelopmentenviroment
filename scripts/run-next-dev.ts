import { resolveDevPort } from "./dev-runtime";

const [environmentVariable, fallbackPort] = Bun.argv.slice(2);
if (!environmentVariable || !fallbackPort) {
	throw new Error(
		"Usage: run-next-dev.ts <PORT_ENVIRONMENT_VARIABLE> <DEFAULT_PORT>",
	);
}

const port = resolveDevPort(environmentVariable, fallbackPort);
const child = Bun.spawn(
	[process.execPath, "x", "next", "dev", "--port", port],
	{
		cwd: process.cwd(),
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
