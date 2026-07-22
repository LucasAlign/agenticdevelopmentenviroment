import {
	type CheckedBinary,
	RUNTIME_BINARY,
} from "@superset/shared/agent-binaries";
import { AGENT_LABELS } from "@superset/shared/agent-command";
import { Button } from "@superset/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@superset/ui/dialog";
import { Input } from "@superset/ui/input";
import { Label } from "@superset/ui/label";
import { RadioGroup, RadioGroupItem } from "@superset/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@superset/ui/select";
import { toast } from "@superset/ui/sonner";
import { useNavigate } from "@tanstack/react-router";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { GitHubRepositoryPicker } from "renderer/components/GitHubRepositoryPicker";
import { downscaleImageToDataUrl } from "renderer/lib/downscale-image";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useRuntimeAvailability } from "renderer/stores/model-bar/useRuntimeAvailability";
import {
	useCloseNewCategoryModal,
	useNewCategoryModalOpen,
} from "renderer/stores/new-category-modal";
import {
	type AgentRuntime,
	buildCrewAgentInputs,
	CREW_TEMPLATES,
	type CrewTemplateId,
} from "./crew-templates";

const CREW_TEMPLATE_IDS = ["starter", "solo", "empty"] as const;
const RUNTIME_CHOICES = ["claude", "codex", "opencode"] as const;

/**
 * Create a Team with an optional starter crew. Generated agents all clone the
 * selected repository and initialize their own durable identity and memory.
 */
export function NewCategoryModal() {
	const isOpen = useNewCategoryModalOpen();
	const closeModal = useCloseNewCategoryModal();
	const navigate = useNavigate();
	const utils = electronTrpc.useUtils();
	const { isAvailable } = useRuntimeAvailability();

	const [name, setName] = useState("");
	const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
	const [crewTemplateId, setCrewTemplateId] =
		useState<CrewTemplateId>("starter");
	const [repositoryUrl, setRepositoryUrl] = useState("");
	const [runtime, setRuntime] = useState<AgentRuntime>("claude");
	const [isCreating, setIsCreating] = useState(false);
	const photoInputRef = useRef<HTMLInputElement>(null);
	const nameInputRef = useRef<HTMLInputElement>(null);

	const createCategory = electronTrpc.projects.createCategory.useMutation();
	const setProjectIcon = electronTrpc.projects.setProjectIcon.useMutation();
	const createAgent = electronTrpc.workspaces.createAgent.useMutation();

	useEffect(() => {
		if (!isOpen) return;
		setName("");
		setPhotoDataUrl(null);
		setCrewTemplateId("starter");
		setRepositoryUrl("");
		setRuntime("claude");
		setIsCreating(false);
		const timer = setTimeout(() => nameInputRef.current?.focus(), 50);
		return () => clearTimeout(timer);
	}, [isOpen]);

	const handlePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		try {
			setPhotoDataUrl(await downscaleImageToDataUrl(file));
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Could not load image",
			);
		}
	};

	const selectedCrew = CREW_TEMPLATES[crewTemplateId];
	const needsRepository = selectedCrew.members.length > 0;
	const canCreate =
		name.trim().length > 0 &&
		(!needsRepository || repositoryUrl.trim().length > 0) &&
		!isCreating;

	const handleCreate = async () => {
		if (!canCreate) return;
		setIsCreating(true);
		let categoryCreated = false;
		let createdAgentCount = 0;

		try {
			const category = await createCategory.mutateAsync({ name: name.trim() });
			categoryCreated = true;

			if (photoDataUrl) {
				await setProjectIcon.mutateAsync({
					id: category.id,
					icon: photoDataUrl,
				});
			}

			const agentInputs = buildCrewAgentInputs({
				templateId: crewTemplateId,
				projectId: category.id,
				repositoryUrl,
				runtime,
			});
			let firstWorkspaceId: string | null = null;

			for (const input of agentInputs) {
				const result = await createAgent.mutateAsync(input);
				firstWorkspaceId ??= result.workspace.id;
				createdAgentCount += 1;
			}

			await utils.workspaces.getAllGrouped.invalidate();
			closeModal();

			if (firstWorkspaceId) {
				navigate({
					to: "/workspace/$workspaceId",
					params: { workspaceId: firstWorkspaceId },
				});
			} else {
				navigate({ to: "/workspaces" });
			}

			toast.success(
				agentInputs.length > 0
					? `Team "${name.trim()}" created with ${agentInputs.length} agent${agentInputs.length === 1 ? "" : "s"}`
					: `Team "${name.trim()}" created`,
			);
		} catch (error) {
			if (categoryCreated) {
				await utils.workspaces.getAllGrouped.invalidate();
				closeModal();
				navigate({ to: "/workspaces" });
				toast.error(
					`Team created, but crew setup stopped after ${createdAgentCount} agent${createdAgentCount === 1 ? "" : "s"}: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			} else {
				toast.error(
					error instanceof Error ? error.message : "Failed to create team",
				);
			}
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<Dialog modal open={isOpen} onOpenChange={(open) => !open && closeModal()}>
			<DialogContent className="sm:max-w-[520px]">
				<DialogHeader>
					<DialogTitle>New team</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-4 py-2">
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => photoInputRef.current?.click()}
							className="size-12 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center text-xs text-muted-foreground border border-border"
						>
							{photoDataUrl ? (
								<img
									src={photoDataUrl}
									alt=""
									className="size-full object-cover"
								/>
							) : (
								"Photo"
							)}
						</button>
						<div className="flex-1">
							<Label htmlFor="category-name">Team name</Label>
							<Input
								id="category-name"
								ref={nameInputRef}
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder="e.g. Newsletter"
								onKeyDown={(event) => {
									if (event.key === "Enter" && canCreate) handleCreate();
								}}
							/>
						</div>
					</div>
					<input
						ref={photoInputRef}
						type="file"
						accept="image/png,image/jpeg,image/webp,image/svg+xml"
						className="hidden"
						onChange={handlePhoto}
					/>

					<div className="flex flex-col gap-1.5">
						<Label>Starter setup</Label>
						<RadioGroup
							value={crewTemplateId}
							onValueChange={(value) =>
								setCrewTemplateId(value as CrewTemplateId)
							}
							className="grid grid-cols-3 gap-2"
						>
							{CREW_TEMPLATE_IDS.map((id) => {
								const template = CREW_TEMPLATES[id];
								return (
									<label
										key={id}
										htmlFor={`crew-${id}`}
										className="flex cursor-pointer flex-col gap-1 rounded-md border border-border p-3"
									>
										<div className="flex items-center gap-2">
											<RadioGroupItem value={id} id={`crew-${id}`} />
											<span className="text-sm font-medium">
												{template.label}
											</span>
										</div>
										<span className="text-xs text-muted-foreground">
											{template.description}
										</span>
									</label>
								);
							})}
						</RadioGroup>
					</div>

					{needsRepository && (
						<div className="flex flex-col gap-2">
							<Label>Repository</Label>
							<GitHubRepositoryPicker
								value={repositoryUrl}
								onSelect={setRepositoryUrl}
								disabled={isCreating}
							/>
							<Input
								value={repositoryUrl}
								onChange={(event) => setRepositoryUrl(event.target.value)}
								placeholder="Or enter a repository URL"
								disabled={isCreating}
							/>
						</div>
					)}

					{needsRepository && (
						<div className="flex flex-col gap-1.5">
							<Label>Runtime</Label>
							<Select
								value={runtime}
								onValueChange={(value) => setRuntime(value as AgentRuntime)}
								disabled={isCreating}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{RUNTIME_CHOICES.map((choice) => {
										const missing = !isAvailable(
											RUNTIME_BINARY[choice] as CheckedBinary,
										);
										return (
											<SelectItem key={choice} value={choice}>
												{AGENT_LABELS[choice]}
												{missing ? " · not installed" : ""}
											</SelectItem>
										);
									})}
								</SelectContent>
							</Select>
						</div>
					)}
				</div>

				<div className="flex justify-end gap-2">
					<Button
						variant="ghost"
						onClick={() => closeModal()}
						disabled={isCreating}
					>
						Cancel
					</Button>
					<Button onClick={handleCreate} disabled={!canCreate}>
						{isCreating
							? "Creating…"
							: selectedCrew.members.length > 0
								? `Create team + ${selectedCrew.members.length} agent${selectedCrew.members.length === 1 ? "" : "s"}`
								: "Create team"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
