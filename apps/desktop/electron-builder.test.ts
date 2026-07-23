import { describe, expect, test } from "bun:test";
import config from "./electron-builder";

describe("Windows installer configuration", () => {
	test("uses stable LucasAlign application and release identities", () => {
		expect(config.appId).toBe("com.lucasalign.ade");
		expect(config.publish).toMatchObject({
			provider: "github",
			owner: "LucasAlign",
			repo: "agenticdevelopmentenviroment",
		});
	});

	test("builds an assisted per-user x64 NSIS installer", () => {
		expect(config.win?.target).toEqual([
			{
				target: "nsis",
				arch: ["x64"],
			},
		]);
		expect(config.nsis).toMatchObject({
			oneClick: false,
			perMachine: false,
			allowElevation: false,
			allowToChangeInstallationDirectory: true,
		});
	});

	test("registers normal Windows launch shortcuts", () => {
		expect(config.nsis).toMatchObject({
			createDesktopShortcut: true,
			createStartMenuShortcut: true,
			shortcutName: "ADE",
		});
	});

	test("uses the Agent Orange Windows application icon", () => {
		expect(config.win?.icon).toContain("agent-orange-icon.png");
	});

	test("places the browser extension at its packaged runtime path", () => {
		expect(config.extraResources).toContainEqual({
			from: "src/resources/browser-extension",
			to: "browser-extension",
			filter: ["**/*"],
		});
		expect(config.files).toContainEqual({
			from: "src/resources",
			to: "resources",
			filter: ["**/*", "!browser-extension/**/*"],
		});
	});
});
