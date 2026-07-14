# Resolve Windows Dependency Install Hang

Status: open
Assignee: Codex
Label: wayfinder:task
Parent map: ../windows-ade-port-map.md
Blocked by: none

## Question

Why does `bun.cmd install` hang before linking workspace binaries on Windows in `C:\Users\Lucas\OneDrive\Documents\ade`, and what is the smallest reliable install path that produces `node_modules\.bin\cross-env` so `apps/desktop` can compile? Compare likely causes such as OneDrive filesystem behavior, Bun linker backend, partial install state, and workspace/package-specific stalls.

## Investigation log

- `bun.cmd install --filter @ade/desktop --ignore-scripts --backend=copyfile --network-concurrency=4 --no-progress --verbose` fails quickly inside the managed Codex sandbox with `error: bun is unable to write files to tempdir: AccessDenied`.
- Redirecting `TEMP`, `TMP`, and `TMPDIR` to repo-local `.tmp` is not enough by itself. Bun still reports `AccessDenied` when it uses the default/global cache.
- Adding a repo-local `--cache-dir .bun-cache` gets past the tempdir error, but the cache is empty and Bun tries to resolve package manifests for the full workspace graph. Without network this fails with many `ConnectionRefused`/`failed to resolve` errors, even with `--filter @ade/desktop` and `--frozen-lockfile`.
- Running the same repo-local temp/cache install with network escalation still timed out after 5 minutes. The orphaned `bun.exe` process was confirmed and killed.
- Current partial install state is mixed: `apps/desktop/node_modules/cross-env` exists, but `.bin` shims were missing before repair. Root `node_modules` only had root tooling packages; `apps/desktop/node_modules` has many desktop dependencies.
- `npm.cmd rebuild --ignore-scripts --no-audit --no-fund` in `apps/desktop` completed and created `apps/desktop/node_modules/.bin/cross-env.cmd` and `electron-vite.cmd`.
- After the npm rebuild, `bun.cmd run --cwd apps/desktop compile:app` gets past `bun: command not found: cross-env`, but fails immediately because `cross-env` imports `@epic-web/invariant` and the Bun isolated-store junction target `node_modules/.bun/@epic-web+invariant@1.0.0/...` is absent.
- A narrow `npm.cmd install --no-save --package-lock=false --ignore-scripts --no-audit --no-fund @epic-web/invariant@1.0.0 cross-spawn@7.0.6` from the repo root also timed out and did not place the missing packages.

## Current conclusion

The blocker is no longer just binary linking. Bun previously extracted a large portion of the desktop workspace, but left an incomplete isolated store: bins were missing, and at least one transitive runtime dependency target is missing behind a junction. The sandbox also blocks Bun's default temp/cache writes, so reliable reproduction should use either an unrestricted normal shell or a repo-local temp/cache with network available long enough to repopulate the cache.

Smallest partial repair found so far:

```powershell
cd C:\Users\Lucas\OneDrive\Documents\ade\apps\desktop
npm.cmd rebuild --ignore-scripts --no-audit --no-fund
```

This creates `apps/desktop\node_modules\.bin\cross-env.cmd`, but it is not sufficient for compile because the isolated Bun store is still missing `@epic-web/invariant`.

## 2026-07-12 repair progress

- Targeted package-local repairs now let `compile:app` launch `cross-env`, Electron Vite, and native esbuild successfully.
- The main process build consistently completes after transforming 979 modules, and the preload build completes after transforming 2 modules.
- Repaired incomplete isolated-store trees for `simple-git`, TanStack Router/DB, Framer Motion, PostHog, Radix UI, `cmdk`, Lucide, Sonner, React DnD, Monaco React, and TipTap/ProseMirror. Exact declared versions were installed into `.tmp` scratch trees and copied into the broken Bun-store or workspace targets.
- Renderer dependency resolution advanced from 10 modules to 3,140 modules. The latest explicit missing-module failures (`@tiptap/pm` and `@tiptap/extension-list`) were repaired.
- After promoting the verified TipTap/ProseMirror runtime tree to root `node_modules`, the next verification run stopped producing output and remained alive with nearly idle Bun/esbuild processes and only about 45 seconds of Node CPU after a prolonged wait. Those orphaned build processes were killed.

The dependency-linking frontier is now substantially repaired, but ticket acceptance is not yet met: `compile:app` has not exited successfully, and the latest failure mode is a renderer build hang after dependency resolution rather than a missing `cross-env` binary.

## 2026-07-14 clean short-path diagnostic

- Created a clean checkout at `C:\ade` from local branch `codex/windows-ade-port` with `core.longpaths=true` before checkout. The checkout was clean and outside OneDrive.
- Ran the recommended clean install shape with repo-local temp/cache:

```powershell
$env:TEMP='C:\ade\.tmp'
$env:TMP='C:\ade\.tmp'
$env:TMPDIR='C:\ade\.tmp'
bun.cmd install --ignore-scripts --backend=copyfile --linker=hoisted `
  --network-concurrency=4 --cache-dir .bun-cache --verbose
```

- The install still hung outside OneDrive. After a 15 minute timeout, `bun.exe` remained alive, `node_modules` existed, but `node_modules\.bin\cross-env.cmd` did not.
- A logged rerun showed the stall happens before scripts and before binary shim creation. The last meaningful verbose line was:

```text
[PackageManager] waiting for 2094 tasks
```

- The same log showed very slow extraction for some packages even on the short path, including `core-js` taking about 1m51s and several smaller packages taking multiple seconds. The final active temp extraction dirs included `lucide-react-native` and `react-dnd-touch-backend`.
- `npm.cmd install --ignore-scripts --no-audit --no-fund --package-lock=false` is not a viable diagnostic fallback for the root workspace as-is; it fails fast with `EUNSUPPORTEDPROTOCOL` on `workspace:*`.
- As a narrower graph test, temporarily changed the throwaway `C:\ade\package.json` workspace list from `apps/*` to only `apps/desktop` while keeping `packages/*` and `tooling/*`. The same hoisted copyfile install still timed out after 15 minutes, left `bun.exe` alive, and still did not create `node_modules\.bin\cross-env.cmd`. This rules out the simplest theory that the hang is only caused by `apps/mobile` or unrelated app workspaces being included in the root workspace graph.

Current classification: OneDrive and Windows path length are not the primary cause. The clean short-path hoisted copyfile install reproduces the hang, so this is most likely a Bun 1.3.6 Windows package-manager extraction/linker task-drain problem for this workspace graph. The smallest reliable install path is still unknown; no clean install has produced `node_modules\.bin\cross-env.cmd`.

## 2026-07-14 install-ready workaround

- Moved the active build attempt to `D:\ade` because `C:` had fallen below 1 GB free and Node began failing tiny commands with `VirtualAlloc`/OpenSSL malloc errors. Deleting the old throwaway `C:\ade` checkout recovered enough C: space for Node to run again.
- Full Bun installs still hung with both Bun 1.3.6 and npm-exec Bun 1.3.14. The reliable dependency path found so far is pnpm 10 against only the desktop dependency closure:

```powershell
cd D:\ade
# temporary build-checkout metadata:
# - pnpm-workspace.yaml matching package.json workspaces
# - packageManager set to pnpm@10.0.0
# - .npmrc with node-linker=hoisted and store-dir=D:\pnpm-store

$env:TEMP='D:\ade\.tmp'
$env:TMP='D:\ade\.tmp'
$env:TMPDIR='D:\ade\.tmp'
npm.cmd exec --cache D:\npm-cache --yes --package pnpm@10.0.0 -- `
  pnpm install --filter @ade/desktop... --ignore-scripts --reporter append-only
```

- The filtered pnpm install completed in about 13 minutes and produced the needed root shims, including `node_modules\.bin\cross-env.cmd`, `electron-vite.cmd`, and `electron-builder.cmd`.
- `compile:app` required two source fixes:
  - `apps/desktop/src/renderer/globals.css` now imports `streamdown/styles.css` by package name and scans the hoisted root `node_modules` path instead of hard-coding `packages/ui/node_modules`.
  - `file-icons.ts` now imports `SiCss`, because the installed `react-icons` version does not export `SiCss3`.
- On this machine, renderer compile also needed `DISABLE_SOURCEMAPS=1` and `NODE_OPTIONS=--max-old-space-size=5120` to avoid Windows commit pressure. With those settings, Electron Vite successfully built main, preload, and renderer. Renderer transformed 9,611 modules and completed in about 12 minutes.
- Native-module packaging needed `copy-native-modules.ts` to materialize packages from the hoisted workspace root, not only Bun's isolated store. Validation now tolerates disabled sourcemaps when `DISABLE_SOURCEMAPS=1`.
- Electron Builder failed native rebuild for `node-pty` because Visual Studio Build Tools are not installed. Added `SKIP_ELECTRON_REBUILD=1` to allow local smoke-test packaging with rebuilds skipped; CI/release machines with Build Tools can leave rebuilds enabled.
- Electron Builder's pnpm dependency collector failed on the temporary pnpm lock with `ERR_PNPM_MISSING_TARBALL_INTEGRITY`. For the disposable build checkout only, packaging succeeded by temporarily switching root package-manager metadata to npm and stripping app dependency metadata so Electron Builder used the explicit `files` inclusions instead of pnpm dependency collection.

Install-ready smoke artifact produced:

```text
D:\ade\apps\desktop\release\ADE-0.1.0-x64.exe
```

Unpacked preview launched successfully from:

```text
D:\ade\apps\desktop\release\win-unpacked\ADE.exe
```

Ticket status: the original Bun install hang remains a Bun/package-manager issue, but the Windows port now has a working local install/package workaround using filtered pnpm, disabled sourcemaps, hoisted native-module materialization, and Electron rebuild skipping.
