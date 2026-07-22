# Windows packaged runtime closure

**Research ticket:** [#9](https://github.com/LucasAlign/agenticdevelopmentenviroment/issues/9)  
**Audited revision:** `8863800882f7841a0b1b437d4bb2a4637ced7181`  
**Target:** unsigned, offline-capable ADE private beta for Windows 10/11 x64

## Decision

Keep the normal electron-builder `nsis` target and build it on a fresh x64 Windows CI runner. Electron supplies Chromium and Node, so an installed ADE does not need a source checkout, Bun, Node, or Codex Desktop. Git and one supported AI CLI remain user-installed capabilities; `gh` remains optional.

The current repository is **not release-ready** for that boundary. The configuration can describe an x64 NSIS installer, but the release workflow never builds Windows, its validation proves package presence rather than installed runtime viability, and one packaged resource path is already inconsistent. The first official beta should not be promoted until the exact CI-produced installer passes an installed clean-machine smoke test on Windows 10 and Windows 11.

## What is already sound

- `electron-builder.ts` uses the full `nsis` target (not the download-on-demand `nsis-web` target), explicitly selects x64, enables an assisted installer, and allows choosing the install directory ([source](../../apps/desktop/electron-builder.ts)). Normal NSIS embeds the application payload, which matches the offline-installer requirement ([electron-builder NSIS](https://www.electron.build/nsis/)).
- Electron distributions include Chromium and Node.js, so packaging the Electron application closes those runtime dependencies for users ([Electron distribution](https://www.electronjs.org/docs/latest/tutorial/application-distribution/)).
- The main build intentionally externalizes `better-sqlite3`, `node-pty`, `@ast-grep/napi`, and `libsql`; the builder explicitly includes and unpacks their runtime packages, while migrations are placed under `process.resourcesPath` ([Vite config](../../apps/desktop/electron.vite.config.ts), [builder config](../../apps/desktop/electron-builder.ts), [local DB path](../../apps/desktop/src/main/lib/local-db/index.ts)). This follows the requirement that native executables cannot remain trapped inside ASAR ([Electron ASAR limitations](https://www.electronjs.org/docs/latest/tutorial/asar-archives)).
- ADE's terminal daemon does not require a separately installed Node: packaged mode starts the bundled Electron executable with `ELECTRON_RUN_AS_NODE=1` and the packaged `terminal-host.js` ([source](../../apps/desktop/src/main/lib/terminal-host/client.ts), [Electron environment variables](https://www.electronjs.org/docs/latest/api/environment-variables/)).
- Durable ADE data is independent of the install directory: the production default is `%USERPROFILE%\.ade`, so normal reinstall/upgrade replacement of application files need not remove teams, repositories, memory, or the local database ([source](../../apps/desktop/src/shared/constants.ts)).

## Confirmed gaps

### P0 — no Windows release artifact is built

`.github/workflows/build-desktop.yml` contains only `build-macos` and `build-linux`; consequently `release-desktop.yml` can never download or attach a Windows `.exe`. Add a `windows-2022` x64 job that installs frozen dependencies, compiles the app, materializes and rebuilds native dependencies for Electron, packages `--win nsis --x64`, and uploads the installer. Build on Windows because native modules must match the target Electron ABI and architecture ([electron-builder multi-platform builds](https://www.electron.build/docs/features/multi-platform-build/)); a GitHub-hosted job starts on a fresh VM ([GitHub-hosted runners](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job)).

The job must also generate a SHA-256 file and upload both files for the draft release. Make CI the only supported producer of beta artifacts.

### P0 — native closure is asserted, not exercised

`copy-native-modules.ts` materializes four native roots plus transitive/platform packages, but `validate-native-runtime.ts` only requires `libsql`, `@neon-rs/load`, `detect-libc`, and a platform `@libsql` package. It does **not** prove that these startup-critical modules load under packaged Electron:

- `better-sqlite3` (ADE opens the local DB during startup),
- `node-pty` (terminal sessions),
- `@ast-grep/napi`,
- `libsql` and `@libsql/win32-x64-msvc`,
- the bundled `terminal-host.js` and `pty-subprocess.js`,
- external migrations under `resources/migrations`.

Add a post-package verifier against `win-unpacked` that fails unless every expected file exists and loads each native addon using the packaged Electron runtime. Then launch `ADE.exe` with an isolated `ADE_HOME_DIR`, wait for a deterministic readiness signal, verify a migrated local database, start a terminal/PTY, and assert that no Bun/Node/source path is used. Native modules must be rebuilt for Electron, and the `SKIP_ELECTRON_REBUILD=1` escape hatch must be forbidden in official CI ([electron-builder native dependencies](https://www.electron.build/docs/troubleshooting/)).

Do not assume a clean PC has the VC++ runtime needed by every MSVC-built addon. Inspect the produced `.node` dependencies and prove the installer on images without a preinstalled redistributable; if a dependency is found, deploy the supported x64 redistributable or app-local runtime files ([Microsoft VC++ deployment](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170)).

### P1 — packaged browser-extension path is wrong

The builder's `files` rule places `src/resources/browser-extension` at `app.asar/resources/browser-extension`, but packaged lookup checks only `process.resourcesPath/browser-extension`. The browser extension therefore will not load in an installed build. Choose one consistent boundary: preferably copy it with `extraResources` to `browser-extension` and keep the runtime lookup, or change the lookup and unpack rule. Include it in the post-package verifier. electron-builder distinguishes application `files` from files placed next to the app with `extraResources` ([application contents](https://www.electron.build/docs/contents/)).

### P1 — installer policy is implicit or stale

Make the private-beta contract explicit in `electron-builder.ts`:

- retain one stable LucasAlign-owned `appId` before the first beta (the current value is `studio.persimmons.ade`),
- set per-user-only installation deliberately; assisted NSIS with `perMachine: false` may expose an install-mode choice, so enforce current-user mode with a tested NSIS include if configuration alone does not,
- explicitly enable Start Menu and default-on desktop shortcuts,
- explicitly preserve application data on uninstall,
- keep signing optional/disabled for this unsigned phase,
- use matching `0.1.0-beta.N` package, installer, About, and GitHub tag versions.

The publish metadata still points to `per-simmons/damon-ade`, not `LucasAlign/agenticdevelopmentenviroment`. Auto-update is disabled, so this is not a launch blocker, but official beta metadata must not identify the wrong repository ([builder config](../../apps/desktop/electron-builder.ts), [updater](../../apps/desktop/src/main/lib/auto-updater.ts)). Keep the eventual `appId` stable because electron-builder derives upgrade identity from it ([NSIS options](https://www.electron.build/docs/api/electron-builder.interface.nsisoptions/)).

## Required clean-machine gate

Promote a draft installer only after the exact CI artifact passes all of the following:

1. Install per-user on clean Windows 10 x64 and Windows 11 x64 with no source checkout, Bun, Node, Git, `gh`, Codex Desktop, AI CLI, or VC++ redistributable preinstalled.
2. Launch without an external console; create and migrate an isolated `%USERPROFILE%\.ade`; load the packaged browser extension; restart successfully.
3. Verify readiness reports Git and all AI runtimes as missing without crashing.
4. Install Git and exactly one supported CLI, authenticate it in its own profile, re-check readiness, clone a repository, and start a PTY-backed agent session.
5. Restart ADE and confirm the CLI login, team, agent memory, repository, and terminal-backed workflow remain usable.
6. Install the next beta over the first and confirm data survives; uninstall and confirm `%USERPROFILE%\.ade` survives.
7. Hash the tested `.exe` and compare it with the checksum attached to the private GitHub Release.

## Implementation sequence

1. Add the Windows CI build and artifact/checksum publication.
2. Correct the packaged browser-extension boundary and make installer identity/shortcut/per-user/data policies explicit.
3. Expand build-time closure validation, then add the `win-unpacked` native-load and installed-app smoke harness.
4. Run the clean Windows 10/11 matrix and promote only the passing draft release.

This is packaging work, not a reason to bundle Git or an AI runtime. ADE-owned code and native services must be closed inside the installer; user-selected developer tools remain external and readiness-gated.
