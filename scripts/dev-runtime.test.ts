import { describe, expect, test } from "bun:test";
import { resolveDevPort, selectCaddyConfig } from "./dev-runtime";

describe("resolveDevPort", () => {
	test("uses the configured port", () => {
		expect(resolveDevPort("WEB_PORT", "3000", { WEB_PORT: "4310" })).toBe(
			"4310",
		);
	});

	test("falls back when the configured port is empty", () => {
		expect(resolveDevPort("WEB_PORT", "3000", { WEB_PORT: "" })).toBe("3000");
	});

	test("rejects invalid ports", () => {
		expect(() =>
			resolveDevPort("WEB_PORT", "3000", { WEB_PORT: "not-a-port" }),
		).toThrow("WEB_PORT must be a valid TCP port");
	});
});

describe("selectCaddyConfig", () => {
	test("prefers a local Caddyfile", () => {
		expect(selectCaddyConfig(["Caddyfile", "Caddyfile.example"])).toBe(
			"Caddyfile",
		);
	});

	test("falls back to the checked-in example", () => {
		expect(selectCaddyConfig(["Caddyfile.example"])).toBe("Caddyfile.example");
	});

	test("returns null when no config exists", () => {
		expect(selectCaddyConfig([])).toBeNull();
	});
});
