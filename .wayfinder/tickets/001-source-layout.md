# Decide Windows Port Source Layout

Status: closed
Assignee: Codex
Label: wayfinder:grilling
Parent map: ../windows-ade-port-map.md
Blocked by: none

## Question

Should the LucasAlign repository import upstream ADE files at the repository root, keep `damon-ade/` as a nested upstream working tree for the port, or use another relationship such as submodule/subtree? Resolve the layout for active Windows implementation and document the commands needed to move from the current workspace state to that layout without losing upstream provenance.

## Resolution

Use the LucasAlign repository root as the active Windows ADE fork. Keeping the upstream source permanently nested under `damon-ade/` would make app-relative paths, packaging, branch work, and GitHub publishing awkward. A submodule or subtree also adds indirection before there is a working Windows app.

Implemented layout:

- `origin` remains `https://github.com/LucasAlign/agenticdevelopmentenviroment.git`.
- Upstream ADE history was merged into the root branch with `--allow-unrelated-histories`.
- The public upstream remote is `https://github.com/per-simmons/damon-ade.git`.
- The nested `damon-ade/` clone remains untracked as a temporary local reference and can be removed once the root import is trusted.

Useful provenance commands:

```powershell
git fetch upstream --tags
git merge upstream/main
git tag --list
```
