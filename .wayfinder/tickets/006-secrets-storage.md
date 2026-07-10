# Decide Windows Secrets Storage

Status: open
Assignee: unclaimed
Label: wayfinder:research
Parent map: ../windows-ade-port-map.md
Blocked by: Locate Windows Platform Seams

## Question

Should Windows ADE use Electron `safeStorage`, Windows Credential Manager, or another maintained approach for ADE-owned secrets such as OpenRouter keys? Resolve the storage API, renderer/main-process boundary, migration implications from macOS Keychain assumptions, and logging redaction requirements.
