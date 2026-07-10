# Decide Windows Terminal Strategy

Status: open
Assignee: unclaimed
Label: wayfinder:research
Parent map: ../windows-ade-port-map.md
Blocked by: Locate Windows Platform Seams

## Question

How should ADE spawn and manage Windows terminal sessions using ConPTY-compatible `node-pty`, including PowerShell detection, fallback shells, environment injection, stop/kill behavior, and process-tree cleanup? Resolve the interface expected by the app before broader terminal implementation starts.
