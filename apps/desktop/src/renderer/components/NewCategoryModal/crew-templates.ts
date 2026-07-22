import type { AGENT_RUNTIMES } from "@superset/local-db";

export type CrewTemplateId = "empty" | "solo" | "starter";
export type AgentRuntime = (typeof AGENT_RUNTIMES)[number];

interface CrewMemberTemplate {
	name: string;
	role: string;
}

interface CrewTemplate {
	label: string;
	description: string;
	members: readonly CrewMemberTemplate[];
}

export const CREW_TEMPLATES: Record<CrewTemplateId, CrewTemplate> = {
	empty: {
		label: "Empty team",
		description: "Add agents manually later",
		members: [],
	},
	solo: {
		label: "Solo",
		description: "One implementation-focused agent",
		members: [
			{
				name: "Builder",
				role: "Implement approved work in small, tested changes. Run focused checks, keep scope narrow, and clearly report risks and verification.",
			},
		],
	},
	starter: {
		label: "Starter crew",
		description: "Scout, Builder, and Reviewer",
		members: [
			{
				name: "Scout",
				role: "Investigate requests, reproduce problems, understand architecture, and produce precise implementation plans. Do not modify code unless explicitly asked.",
			},
			{
				name: "Builder",
				role: "Implement approved work in small, tested changes. Run focused checks, keep scope narrow, and clearly report risks and verification.",
			},
			{
				name: "Reviewer",
				role: "Review committed changes independently for correctness, regressions, security risks, and missing tests. Return actionable findings with file locations.",
			},
		],
	},
};

interface BuildCrewAgentInputsOptions {
	templateId: CrewTemplateId;
	projectId: string;
	repositoryUrl: string;
	runtime: AgentRuntime;
}

export function buildCrewAgentInputs({
	templateId,
	projectId,
	repositoryUrl,
	runtime,
}: BuildCrewAgentInputsOptions) {
	const members = CREW_TEMPLATES[templateId].members;
	if (members.length === 0) return [];

	const url = repositoryUrl.trim();
	if (!url) {
		throw new Error("A repository is required for this crew");
	}

	return members.map((member) => ({
		projectId,
		name: member.name,
		role: member.role,
		runtime,
		repo: { type: "clone" as const, url },
	}));
}
