import { Button } from "@superset/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@superset/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@superset/ui/popover";
import { cn } from "@superset/ui/utils";
import { Check, ChevronsUpDown, LockKeyhole, RefreshCw } from "lucide-react";
import { useState } from "react";
import { FaGithub } from "react-icons/fa";
import { electronTrpc } from "renderer/lib/electron-trpc";

interface GitHubRepositoryPickerProps {
	value: string;
	onSelect: (url: string) => void;
	disabled?: boolean;
}

export function GitHubRepositoryPicker({
	value,
	onSelect,
	disabled = false,
}: GitHubRepositoryPickerProps) {
	const [open, setOpen] = useState(false);
	const repositories = electronTrpc.projects.listGitHubRepositories.useQuery(
		undefined,
		{ retry: false, staleTime: 60_000 },
	);
	const selected = repositories.data?.repositories.find(
		(repository) => repository.url === value,
	);

	const statusMessage = (() => {
		if (repositories.isPending) return "Loading repositories...";
		if (repositories.isError) return "Could not load GitHub repositories.";
		if (repositories.data?.status === "not-installed") {
			return "Install GitHub CLI, then refresh.";
		}
		if (repositories.data?.status === "not-authenticated") {
			return "Run gh auth login, then refresh.";
		}
		if (repositories.data?.status === "error") {
			return repositories.data.message;
		}
		if (repositories.data?.repositories.length === 0) {
			return "No repositories found for this GitHub account.";
		}
		return null;
	})();

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled}
					className="w-full justify-between font-normal"
				>
					<span className="flex min-w-0 items-center gap-2">
						<FaGithub className="size-4 shrink-0" />
						<span className="truncate">
							{selected?.nameWithOwner ?? "Select a GitHub repository"}
						</span>
					</span>
					<ChevronsUpDown className="size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-[var(--radix-popover-trigger-width)] p-0"
			>
				<Command>
					<CommandInput placeholder="Search repositories..." />
					<CommandList>
						{statusMessage ? (
							<div className="flex flex-col items-center gap-3 px-4 py-6 text-center text-sm text-muted-foreground">
								<span>{statusMessage}</span>
								<Button
									variant="outline"
									size="sm"
									disabled={repositories.isFetching}
									onClick={() => repositories.refetch()}
								>
									<RefreshCw
										className={cn(
											"size-3.5",
											repositories.isFetching && "animate-spin",
										)}
									/>
									Refresh
								</Button>
							</div>
						) : (
							<>
								<CommandEmpty>No matching repositories.</CommandEmpty>
								<CommandGroup heading="Your repositories">
									{repositories.data?.repositories.map((repository) => (
										<CommandItem
											key={repository.url}
											value={`${repository.nameWithOwner} ${repository.description ?? ""}`}
											onSelect={() => {
												onSelect(repository.url);
												setOpen(false);
											}}
											className="items-start"
										>
											<Check
												className={cn(
													"mt-0.5 size-4",
													repository.url === value
														? "opacity-100"
														: "opacity-0",
												)}
											/>
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-1.5">
													<span className="truncate font-medium">
														{repository.nameWithOwner}
													</span>
													{repository.isPrivate && (
														<LockKeyhole className="size-3 shrink-0 text-muted-foreground" />
													)}
												</div>
												{repository.description && (
													<p className="truncate text-xs text-muted-foreground">
														{repository.description}
													</p>
												)}
											</div>
										</CommandItem>
									))}
								</CommandGroup>
							</>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
