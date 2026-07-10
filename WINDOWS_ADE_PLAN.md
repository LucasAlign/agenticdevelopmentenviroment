# Windows Agentic Deployment Environment Plan

## Current State

- Target repo: https://github.com/LucasAlign/agenticdevelopmentenviroment.git
- The remote currently has no published branches.
- The local workspace is an empty Git repository.
- Reference project: https://github.com/per-simmons/damon-ade
- Reference release: ADE 0.1.0, a macOS Apple Silicon Electron app.

## Product Goal

Build a Windows-native agentic development environment inspired by ADE:

- Persistent teams and agents.
- Each agent owns a repo or worktree.
- Each agent has long-lived markdown memory outside the code repo.
- Sessions run real terminal-based coding CLIs.
- The app remains local-first: code, memory, logs, and keys stay on the user machine.

## Recommended Strategy

Start by porting the upstream ADE architecture, not by redesigning the product.

1. Import or fork `per-simmons/damon-ade`.
2. Get the Electron app booting on Windows.
3. Add a small platform abstraction layer for Windows differences.
4. Make one agent + one terminal session work end to end.
5. Expand to packaging, secrets, multi-runtime support, and polished onboarding.

## Architecture

### Desktop Shell

- Electron app with TypeScript.
- Renderer owns teams, agents, sessions, file panels, and model/runtime controls.
- Main process owns filesystem, terminal processes, credential access, and app lifecycle.

### Platform Layer

Create a Windows-aware platform module rather than spreading OS checks throughout the app.

Suggested modules:

- `platform/paths.ts`
- `platform/shell.ts`
- `platform/pty.ts`
- `platform/process.ts`
- `platform/secrets.ts`
- `platform/doctor.ts`

### Storage Layout

Use standard Windows app locations:

- App config: `%APPDATA%\ADE`
- Agent memory: `%APPDATA%\ADE\agents\<agent-id>\memory`
- Worktrees: `%USERPROFILE%\ADE\worktrees`
- Logs/cache: `%LOCALAPPDATA%\ADE`

Allow users to override the worktree root during onboarding.

## Windows-Specific Work

### Terminal Sessions

Use ConPTY-compatible terminal support through `node-pty`.

Shell priority:

1. PowerShell 7 (`pwsh.exe`)
2. Windows PowerShell (`powershell.exe`)
3. Git Bash, if explicitly selected by the user
4. `cmd.exe` as fallback

Each session should:

- Start in the agent worktree.
- Receive only the environment variables required for that runtime.
- Stream output into the terminal UI.
- Support clean stop and forced kill.
- Clean up child process trees.

### Git

Support Git for Windows.

Required operations:

- Detect `git.exe`.
- Initialize empty repos.
- Clone remote repos.
- Create and manage worktrees.
- Report dirty status.
- Avoid committing agent memory files.

Important edge cases:

- Paths with spaces.
- OneDrive paths.
- Long paths.
- Existing repos.
- Git credential prompts inside terminal sessions.

### Runtime CLIs

Initial runtime targets:

- Claude Code: `claude`
- OpenAI Codex: `codex`
- OpenCode: `opencode`

Runtime detection should check:

- Executable exists on PATH.
- Version command works.
- Auth status can be inferred or documented.

OpenRouter-backed models can be added after base CLI launches work.

### Secrets

Replace macOS Keychain behavior with one of:

- Electron `safeStorage`, backed by Windows DPAPI.
- Windows Credential Manager via a maintained Node package.

Store only ADE-owned secrets, such as OpenRouter keys. Do not store credentials that the individual CLIs already manage.

### Installer

Use `electron-builder` or equivalent to produce:

- NSIS installer: `ADE-Setup-x64.exe`
- Portable zip: `ADE-win32-x64.zip`

Later targets:

- ARM64 Windows build.
- MSIX package.
- Code-signed installer.

## Milestones

### M1: Repo Bootstrap

- Import upstream ADE source.
- Add Windows planning docs.
- Add a `windows-port` branch.
- Confirm install/build commands.

Done when the app source is present and dependency installation is documented.

### M2: App Boots On Windows

- Resolve macOS-only imports or APIs.
- Build Electron main, preload, and renderer.
- Launch app on Windows from source.

Done when `bunx electron .` opens the app without platform crashes.

### M3: Terminal Session Prototype

- Add Windows shell detection.
- Spawn a PowerShell-backed PTY.
- Render terminal output in the app.
- Stop and restart a terminal session.

Done when a session tab can run `git status` inside an agent worktree.

### M4: Agent Creation

- Create team.
- Create agent.
- Create or attach repo/worktree.
- Scaffold memory files.
- Open first terminal session automatically.

Done when a new agent can be created and used from the UI.

### M5: Runtime Launches

- Launch Claude Code.
- Launch Codex.
- Launch OpenCode.
- Add runtime availability indicators.
- Add clear error messages for missing CLIs.

Done when each installed runtime can start in an agent worktree.

### M6: Windows Secrets

- Store OpenRouter key locally.
- Inject key only into the spawned runtime process.
- Avoid exposing secrets to renderer logs or UI state.

Done when open-model sessions can launch without re-entering keys.

### M7: Packaging

- Add Windows build target.
- Produce installer and portable zip.
- Add Windows install docs.
- Add troubleshooting docs.

Done when a fresh Windows machine can install and launch ADE.

## Risks

- Terminal process management is the highest-risk area.
- CLI auth flows may behave differently across PowerShell, Git Bash, and integrated terminals.
- Windows path edge cases can break repo and memory paths if not normalized centrally.
- Installer signing and SmartScreen trust require a longer release process.

## First Implementation Task

Import the upstream ADE source into this repository, then create a branch named `codex/windows-ade-port`.

After import, start with the narrowest proof:

1. Install dependencies.
2. Build the app.
3. Launch Electron on Windows.
4. Patch only the first platform crash.
5. Repeat until the UI opens.

