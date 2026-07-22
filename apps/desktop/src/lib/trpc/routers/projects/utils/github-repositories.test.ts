import { describe, expect, it } from "bun:test";
import {
	listGitHubRepositories,
	parseGitHubRepositories,
} from "./github-repositories";

describe("GitHub repository listing", () => {
	it("parses and sorts repositories by recent activity", () => {
		const repositories = parseGitHubRepositories(
			JSON.stringify([
				{
					nameWithOwner: "owner/older",
					url: "https://github.com/owner/older",
					description: null,
					isPrivate: false,
					pushedAt: "2026-01-01T00:00:00Z",
				},
				{
					nameWithOwner: "owner/newer",
					url: "https://github.com/owner/newer",
					description: "Recently updated",
					isPrivate: true,
					pushedAt: "2026-07-20T00:00:00Z",
				},
			]),
		);

		expect(repositories.map((repository) => repository.nameWithOwner)).toEqual([
			"owner/newer",
			"owner/older",
		]);
	});

	it("reports when GitHub CLI is missing", async () => {
		const result = await listGitHubRepositories(async () => {
			throw Object.assign(new Error("spawn gh ENOENT"), { code: "ENOENT" });
		});

		expect(result.status).toBe("not-installed");
	});

	it("reports when GitHub CLI is not authenticated", async () => {
		const result = await listGitHubRepositories(async () => {
			throw Object.assign(new Error("gh auth login required"), {
				stderr: "You are not logged into any GitHub hosts",
			});
		});

		expect(result.status).toBe("not-authenticated");
	});
});
