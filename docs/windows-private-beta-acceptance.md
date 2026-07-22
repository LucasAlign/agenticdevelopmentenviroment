# Windows private beta acceptance

Use this checklist against the exact installer and `SHA256SUMS.txt` attached to
the draft GitHub prerelease. Record each completed run in a GitHub issue or
comment visible to invited testers, then replace the corresponding `PENDING`
line in the draft release notes with that evidence URL.

## Required environments

- Clean Windows 10 x64 with no source checkout, Bun, Node.js, Codex Desktop,
  Git, GitHub CLI, supported agent runtime, or separately installed VC++
  redistributable.
- Clean Windows 11 x64 with the same starting conditions.

## Candidate identity

1. Download the installer and `SHA256SUMS.txt` from the draft prerelease.
2. Run `certutil -hashfile ADE-<version>-x64.exe SHA256` and compare the result
   with `SHA256SUMS.txt`.
3. Confirm the installer is unsigned and record the expected SmartScreen
   **More info -> Run anyway** journey.
4. Record the tag, commit SHA, workflow-run URL, installer filename, and SHA-256
   in the acceptance evidence.

## Install and dependency readiness

1. Install for the current user using the default-on desktop shortcut.
2. Confirm ADE appears in the Start Menu and does not open an external console.
3. Launch ADE while Git and every supported agent runtime are absent.
4. Confirm ADE starts, creates `%USERPROFILE%\.ade`, and reports missing tools
   through readiness UI without crashing.
5. Restart ADE and confirm the local database opens successfully.

## Independent runtime matrix

Repeat the following journey with exactly one runtime installed and
authenticated at a time: Codex CLI, Claude Code, and OpenCode.

1. Install Git and the selected runtime outside ADE.
2. Authenticate the runtime in the normal Windows user profile.
3. Confirm ADE detects Git and only that runtime as ready.
4. Clone a repository and start a PTY-backed agent session.
5. Restart ADE and confirm the runtime login and terminal workflow remain valid.

## Upgrade and uninstall retention

1. Create representative ADE state: a team, agent memory, repository, and
   terminal-backed workflow.
2. Install the next beta over the current beta without deleting
   `%USERPROFILE%\.ade`.
3. Confirm all representative state and the external runtime login survive.
4. Uninstall ADE and confirm `%USERPROFILE%\.ade` remains intact.
5. Reinstall ADE and confirm the preserved data is usable.

## Promotion

Dispatch `Promote Windows Desktop Private Beta` with the candidate tag, exact
`publish <tag>` confirmation, and the Windows 10 and Windows 11 evidence URLs.
The workflow refuses promotion unless those URLs are already present in the
draft release notes, the release is still a draft prerelease, its tag is on
`main`, its two assets have exact names, and the installer checksum verifies.
Promotion changes only `draft=false`; it never rebuilds or replaces assets.
