# Build prompts (R-12)

Every prompt given to the AI during the build, with every response, in order. The project
was built with Claude Code (desktop app) as the only AI tool.

| # | Session | Dates | Transcript |
| --- | --- | --- | --- |
| 01 | Acme Credit build | 2026-10-21 → 2026-10-23 | [prompts/01-acme-credit-build.md](prompts/01-acme-credit-build.md) |


## Instructions by phase (technical summary)

What the owner directed, in engineering terms, grouped by phase. Prompt numbers refer to
the current `## Prompt N` headings of the transcript.

| Phase | Instructions | Prompts |
| --- | --- | --- |
| **0 · Tooling and kickoff** | Update the engineering harness; establish stack and architecture constraints; review requirements, install project skills, define the brand, commit the baseline, and scaffold F0. | 1–4 |
| **1 · Feature delivery** | Implement required features; refine theme and locale controls, navigation, data caching, reviewer sign-in, the in-wallet store, responsive layouts, card settings, and product presentation. | 5–6, 9, 17, 19, 22–23 |
| **2 · Audit and hardening** | Run the full audit chain; fix P0 and HIGH findings; improve mobile activity and store behavior, order details, pagination, accessibility, session handling, and verification records. | 8, 10–11, 13, 26–29, 31 |
| **3 · Developer experience** | Provide one-command Docker startup and test execution; diagnose startup failures; print service URLs and ports and support stopping the full stack. | 14–15, 18 |
| **4 · Reviewer-facing UI** | Prioritize the brand introduction, product tour, generated visual assets, responsive landing and admin interfaces, demo sign-in, favicons, and compact product cards. | 6, 16–19, 22–23, 27–28 |
| **5 · Delivery and platform** | Create the private GitHub repository, configure authorized Render access, review rate limits, publish API documentation and the database diagram, and fix deployed Open Graph previews. | 21, 24–25, 30 |

## How the transcript is produced

`scripts/export-prompts.py` turns the Claude Code session log into the transcript
(`python scripts/export-prompts.py <session.jsonl> docs/prompts/01-acme-credit-build.md .env`).
It keeps every prompt, including messages sent while Claude was working and the answers
given in question dialogs, and every assistant reply, in order. Each owner prompt shows its
**instruction in technical terms** first (written at delivery, from
`scripts/prompt-intents.json`) and, folded below it, the **original prompt exactly as typed**.
Every instruction given to a subagent is quoted in full with its report. Other tool calls are
listed by name with a short input; their raw outputs are left out (they are data, often very
large). Values of the local `.env` are redacted.
