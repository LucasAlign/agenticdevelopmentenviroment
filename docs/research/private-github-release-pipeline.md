# Private GitHub release pipeline for the Windows beta

## Decision

Use a two-stage GitHub Actions pipeline in the private LucasAlign repository:

1. A pushed tag named `desktop-v<semver>-beta.<n>` builds and verifies exactly one unsigned Windows x64 NSIS installer, generates a consumer-visible SHA-256 checksum file, and creates a **draft prerelease**.
2. A separate, manually dispatched promotion workflow verifies that same draft and its assets again, then publishes it without rebuilding or replacing anything.

For the first release, the canonical tag is `desktop-v0.1.0-beta.1`, the application version is `0.1.0-beta.1`, and the installer is `ADE-0.1.0-beta.1-x64.exe`. A published prerelease—not an Actions artifact or a draft—is the official beta. GitHub releases are tag-based, and repository readers can view releases, so invited testers only need read access to the private repository ([GitHub: About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)).

## Why this shape

The current pipeline cannot produce the required beta:

- `.github/workflows/build-desktop.yml` has macOS and Linux jobs but no Windows job.
- `.github/workflows/release-desktop.yml` builds the stable channel and creates a draft, but does not mark it as a prerelease.
- Its `workflow_dispatch.version` input is unused, and the release job is skipped for dispatches.
- The tag is not converted into `apps/desktop/package.json`'s version, so a beta tag can still package version `0.1.0`.
- `apps/desktop/electron-builder.ts` already targets NSIS x64, but its GitHub publisher identity still points at `per-simmons/damon-ade`.

Separating candidate creation from promotion guarantees that every downloadable installer came from CI and that approval changes only release visibility. GitHub recommends drafting first when assets must be complete before publication, and `gh release create` supports `--draft`, `--prerelease`, `--latest=false`, and `--verify-tag` ([GitHub: Managing releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository), [GitHub CLI: `gh release create`](https://cli.github.com/manual/gh_release_create)).

## Candidate workflow

Create a Windows-only beta workflow rather than extending the current cross-platform stable release. Its contract should be:

### Trigger and version

- Trigger only on `push.tags: ["desktop-v*-beta.*"]`; GitHub Actions supports tag filters on `push` ([workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpushbranchestagsbranches-ignoretags-ignore)).
- Reject anything that does not exactly match `^desktop-v([0-9]+\.[0-9]+\.[0-9]+-beta\.[0-9]+)$`.
- Require the tagged commit to be contained in `origin/main` and require no release already exists for that tag.
- Derive the package version exclusively from the tag, update `apps/desktop/package.json` only in the runner workspace, and assert `app.getVersion()`/packaged metadata and filename all match it. Do not commit the temporary version edit.

### Build

- Run on the explicit `windows-2022` x64 GitHub-hosted image, not the moving `windows-latest` alias. GitHub provides fresh x64 Windows VMs for private repositories ([runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)).
- Install the repository-pinned Bun version, run `bun install --frozen`, then the normal lint, typecheck, and test gates.
- Compile the desktop app and run electron-builder explicitly for `--win nsis --x64 --publish never` with `CSC_IDENTITY_AUTO_DISCOVERY=false`. `--publish never` keeps electron-builder from implicitly creating or modifying releases ([electron-builder CLI](https://www.electron.build/docs/cli/), [publishing options](https://www.electron.build/publish/)).
- Keep the assisted, per-user NSIS design explicit: `oneClick: false`, `perMachine: false`, and `allowToChangeInstallationDirectory: true`. Electron-builder documents assisted/per-user behavior and these defaults, but spelling them out makes the installer contract reviewable ([NSIS options](https://www.electron.build/docs/api/electron-builder.interface.nsisoptions/)).

### Automated verification

Fail before draft creation unless all checks pass:

- Exactly one `ADE-<version>-x64.exe` exists, is non-empty, has the expected version metadata, and `Get-AuthenticodeSignature` reports it as unsigned for this beta.
- Perform a silent per-user install into a temporary clean path on the runner, confirm the installed executable and Start Menu registration, launch ADE without Bun, Node, Codex desktop, or the source checkout on `PATH`, wait for the readiness UI/process to become healthy, then uninstall and confirm the designated user-data directory is preserved.
- Run the packaged native-module/runtime validation against the installed application, not only the build tree.
- Generate `SHA256SUMS.txt` from the final installer using SHA-256, then immediately recompute and compare it. Upload the installer and checksum together as one Actions artifact and fail if files are missing.

GitHub's artifact action produces a SHA-256 digest for the uploaded artifact archive and validates that archive on download, but testers need a checksum for the installer itself; therefore `SHA256SUMS.txt` is a distinct release asset ([GitHub: Store and share data](https://docs.github.com/en/actions/tutorials/store-and-share-data#validating-artifacts)).

### Draft creation

Use a final Linux or Windows job, dependent on every verification job, with only `contents: write`; all build/test jobs should have `contents: read`. GitHub documents that `contents: write` is sufficient to create a release and unspecified permissions become `none` ([workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions)). Download the Actions artifact, verify its digest and `SHA256SUMS.txt`, then run:

```text
gh release create <tag> <installer> SHA256SUMS.txt \
  --verify-tag --draft --prerelease --latest=false \
  --title "ADE <version> Private Beta" --notes-file <generated-notes>
```

The draft notes should identify the tag, full commit SHA, workflow-run URL, unsigned/SmartScreen warning, checksum verification command, manual-install instructions, and acceptance checklist. Retain the Actions artifact for 30 days; the release assets become the durable distribution copies after publication.

## Manual promotion

Create `workflow_dispatch` workflow `promote-desktop-beta.yml` with required inputs `tag` and an exact confirmation such as `publish <tag>`. The operator must first record successful clean-machine acceptance for Windows 10 x64 and Windows 11 x64 against the draft's checksum. Standard GitHub-hosted Windows runners are Windows Server images, so they cannot replace those client-OS checks; this is the intentionally manual beta gate.

The promotion job must:

1. Validate the tag grammar and confirm the tag points to a commit on `main`.
2. Confirm the release exists, is a draft, and is marked prerelease.
3. Require exactly the expected installer and `SHA256SUMS.txt`; download them and verify the checksum.
4. Confirm the release target SHA equals the tag SHA and the notes contain the workflow-run evidence plus Windows 10/11 acceptance references.
5. Publish only by running `gh release edit <tag> --draft=false --prerelease --latest=false`; GitHub CLI explicitly supports publishing an existing draft this way ([`gh release edit`](https://cli.github.com/manual/gh_release_edit)).

Promotion must never rebuild, rename, or re-upload assets. If verification fails, leave the draft untouched, delete the bad tag/release deliberately, fix the source or workflow, and mint the next beta number. Do not mutate a published beta.

## Security and operational guardrails

- Pin third-party actions to reviewed full commit SHAs; GitHub identifies this as the only immutable way to reference an action ([secure use reference](https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions)).
- Use `GITHUB_TOKEN`, not a long-lived personal token, and grant `contents: write` only to draft-creation and promotion jobs.
- Add workflow concurrency keyed by tag so retries cannot race release creation.
- Enable immutable releases if the repository plan supports it; GitHub protects tags and assets only after publication, which reinforces the draft-then-publish design ([GitHub CLI release immutability](https://cli.github.com/manual/gh_release_create#immutable-releases)).
- Do not use a protected-environment reviewer as the sole approval mechanism unless the LucasAlign GitHub plan is confirmed to support required reviewers for private repositories. The explicit dispatch-and-confirmation gate works independently of that plan feature.

## Implementation boundary

This decision covers release provenance and promotion only. The pipeline should not be enabled until the separate packaging/readiness work proves that the installed ADE app is local-first, self-contained, stores durable data under `%USERPROFILE%\.ade`, and does not open unexpected console windows. Automatic updates remain out of scope for the private beta.
