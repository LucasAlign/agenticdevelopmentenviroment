import { z } from "zod";
import { execWithShellEnv } from "../../workspaces/utils/shell-env";

const GitHubRepositorySchema = z.object({
	nameWithOwner: z.string(),
	url: z.string().url(),
	description: z.string().nullable(),
	isPrivate: z.boolean(),
	pushedAt: z.string(),
});

const GitHubRepositoryListSchema = z.array(GitHubRepositorySchema);

export type GitHubRepository = z.infer<typeof GitHubRepositorySchema>;

export type GitHubRepositoryListResult =
	| { status: "connected"; repositories: GitHubRepository[] }
	| { status: "not-installed"; repositories: []; message: string }
	| { status: "not-authenticated"; repositories: []; message: string }
	| { status: "error"; repositories: []; message: string };

interface CommandError extends Error {
	code?: number | string;
	stderr?: string;
}

type GitHubCommandRunner = (
	command: string,
	args: string[],
	options: { timeout: number },
) => Promise<{ stdout: string }>;

export function parseGitHubRepositories(stdout: string): GitHubRepository[] {
	const repositories = GitHubRepositoryListSchema.parse(JSON.parse(stdout));
	return repositories.sort(
		(a, b) => Date.parse(b.pushedAt) - Date.parse(a.pushedAt),
	);
}

export async function listGitHubRepositories(
	run: GitHubCommandRunner = execWithShellEnv,
): Promise<GitHubRepositoryListResult> {
	try {
		const { stdout } = await run(
			"gh",
			[
				"repo",
				"list",
				"--limit",
				"100",
				"--json",
				"nameWithOwner,url,description,isPrivate,pushedAt",
			],
			{ timeout: 30_000 },
		);

		return {
			status: "connected",
			repositories: parseGitHubRepositories(stdout),
		};
	} catch (error) {
		const commandError = error as CommandError;
		const details = `${commandError.stderr ?? ""}\n${commandError.message}`;
		if (commandError.code === "ENOENT") {
			return {
				status: "not-installed",
				repositories: [],
				message: "GitHub CLI is not installed.",
			};
		}
		if (
			/not logged|not authenticated|gh auth login|authenticate/i.test(details)
		) {
			return {
				status: "not-authenticated",
				repositories: [],
				message: "GitHub CLI is not signed in.",
			};
		}
		return {
			status: "error",
			repositories: [],
			message:
				error instanceof Error
					? error.message
					: "Could not load GitHub repositories.",
		};
	}
}
