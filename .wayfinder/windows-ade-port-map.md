# Windows ADE Port Map

Labels: wayfinder:map
Tracker: local-markdown

## Destination

Produce a clear implementation route for turning upstream `per-simmons/damon-ade` v0.1.0 into a Windows-capable LucasAlign ADE fork: source layout chosen, first Windows boot path known, and the platform decisions needed for terminal sessions, paths, secrets, runtime launch, and packaging reduced to actionable implementation work.

## Notes

- Use the `wayfinder` skill for this effort.
- Planning is the default: tickets resolve decisions or gather facts that make the route clear.
- The first implementation milestone after planning is to boot the Electron desktop app from source on Windows, then patch platform crashes one at a time.
- Keep upstream behavior and architecture as the starting point; avoid product redesign while porting.
- Local tracker convention: each child ticket is a Markdown file in `.wayfinder/tickets/`. A ticket is unclaimed when `Assignee: unclaimed`; it is frontier when `Status: open` and `Blocked by: none`.

## Decisions so far

## Not yet specified

- Windows UI polish and onboarding specifics after the app boots.
- Code-signing and SmartScreen release strategy after a Windows installer target exists.
- ARM64 Windows support after x64 packaging is proven.
- Whether long-path enablement needs app-level handling, installer guidance, or both.
- Whether Git Bash should be a first-class session shell or only an explicit advanced option.

## Out of scope

- Rebuilding ADE as a different product before the Windows port is understood.
- Publishing a release before the source app boots and a Windows packaging route is decided.
