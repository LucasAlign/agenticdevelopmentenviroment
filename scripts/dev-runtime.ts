export function resolveDevPort(
	environmentVariable: string,
	fallbackPort: string,
	environment: Record<string, string | undefined> = process.env,
): string {
	const port = environment[environmentVariable]?.trim() || fallbackPort;
	const parsed = Number(port);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
		throw new Error(
			`${environmentVariable} must be a valid TCP port; received ${JSON.stringify(port)}`,
		);
	}
	return String(parsed);
}

export function selectCaddyConfig(existingFiles: string[]): string | null {
	if (existingFiles.includes("Caddyfile")) return "Caddyfile";
	if (existingFiles.includes("Caddyfile.example")) return "Caddyfile.example";
	return null;
}
