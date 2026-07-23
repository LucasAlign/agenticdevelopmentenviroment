import { describe, expect, test } from "bun:test";
import {
	DEFAULT_TERMINAL_FONT_FAMILY,
	DEFAULT_TERMINAL_FONT_SIZE,
} from "./config";

describe("terminal typography defaults", () => {
	test("prefers a modern Windows monospace font", () => {
		expect(DEFAULT_TERMINAL_FONT_FAMILY.startsWith("Cascadia Code")).toBe(true);
	});

	test("uses the slightly larger shell font size", () => {
		expect(DEFAULT_TERMINAL_FONT_SIZE).toBe(15);
	});
});
