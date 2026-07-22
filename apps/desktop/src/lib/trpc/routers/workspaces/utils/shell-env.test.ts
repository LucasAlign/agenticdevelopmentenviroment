import { describe, expect, test } from "bun:test";
import {
	combineWindowsPaths,
	getEnvironmentCommand,
	parseEnvironmentOutput,
} from "./shell-env";

describe("Windows shell environment", () => {
	test("uses ComSpec instead of a Unix shell", () => {
		expect(
			getEnvironmentCommand("win32", {
				ComSpec: "C:\\Windows\\System32\\cmd.exe",
				SHELL: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
			}),
		).toEqual({
			command: "C:\\Windows\\System32\\cmd.exe",
			args: ["/d", "/s", "/c", "set"],
		});
	});

	test("parses CRLF-delimited environment output", () => {
		expect(
			parseEnvironmentOutput("Path=C:\\Tools\r\nNAME=value=with=equals\r\n"),
		).toEqual({
			Path: "C:\\Tools",
			NAME: "value=with=equals",
		});
	});

	test("combines current machine and user paths", () => {
		expect(combineWindowsPaths("C:\\Current", "C:\\Machine", "C:\\User")).toBe(
			"C:\\Current;C:\\Machine;C:\\User",
		);
	});
});
