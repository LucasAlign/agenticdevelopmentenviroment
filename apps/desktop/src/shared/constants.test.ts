import { describe, expect, test } from "bun:test";
import { DEFAULT_TELEMETRY_ENABLED } from "./constants";

describe("private beta defaults", () => {
	test("does not enable telemetry without tester consent", () => {
		expect(DEFAULT_TELEMETRY_ENABLED).toBe(false);
	});
});
