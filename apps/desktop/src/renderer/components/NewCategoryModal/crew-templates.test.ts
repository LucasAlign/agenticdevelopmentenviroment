import { describe, expect, test } from "bun:test";
import { buildCrewAgentInputs, CREW_TEMPLATES } from "./crew-templates";

describe("starter crew templates", () => {
	test("builds the recommended three-agent crew from one repository", () => {
		const inputs = buildCrewAgentInputs({
			templateId: "starter",
			projectId: "team-1",
			repositoryUrl: "  https://github.com/acme/product  ",
			runtime: "codex",
		});

		expect(inputs.map(({ name }) => name)).toEqual([
			"Scout",
			"Builder",
			"Reviewer",
		]);
		expect(inputs.every(({ projectId }) => projectId === "team-1")).toBe(true);
		expect(inputs.every(({ runtime }) => runtime === "codex")).toBe(true);
		expect(
			inputs.every(
				({ repo }) => repo.url === "https://github.com/acme/product",
			),
		).toBe(true);
		expect(inputs.every(({ role }) => role.length > 0)).toBe(true);
	});

	test("builds a solo Builder crew", () => {
		const inputs = buildCrewAgentInputs({
			templateId: "solo",
			projectId: "team-1",
			repositoryUrl: "https://github.com/acme/product",
			runtime: "claude",
		});

		expect(inputs).toHaveLength(1);
		expect(inputs[0]?.name).toBe("Builder");
	});

	test("keeps an empty team compatible with manual agent creation", () => {
		expect(
			buildCrewAgentInputs({
				templateId: "empty",
				projectId: "team-1",
				repositoryUrl: "",
				runtime: "claude",
			}),
		).toEqual([]);
	});

	test("requires one repository for generated agents", () => {
		expect(() =>
			buildCrewAgentInputs({
				templateId: "starter",
				projectId: "team-1",
				repositoryUrl: "  ",
				runtime: "claude",
			}),
		).toThrow("A repository is required for this crew");
	});

	test("keeps every seeded role within the agent role limit", () => {
		for (const template of Object.values(CREW_TEMPLATES)) {
			for (const member of template.members) {
				expect(member.role.length).toBeLessThanOrEqual(280);
			}
		}
	});
});
