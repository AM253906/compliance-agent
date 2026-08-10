# compliance-agent

A LangGraph agent that answers one operational question a cannabis processor faces daily: **can this package be released?**

Given a METRC package tag, the agent gathers the package record and its lab results from [metrc-mcp](https://github.com/AM253906/metrc-mcp), retrieves the governing Kentucky testing regulations from [mcp-regulatory-cannabis](https://github.com/AM253906/mcp-regulatory-cannabis), and asks Claude to produce a release/hold recommendation with regulation citations — validated into a strict schema before anything downstream sees it.

I spent six years running licensed cannabis processing operations. Release decisions are made dozens of times a week by cross-referencing METRC's testing state against what the regulations actually require — mostly from memory. This agent is that cross-reference, automated and cited.

## Architecture

```
START → gather_package → gather_regulations → evaluate → END
             │                   │
             └── error ──────────┴── error → END
```

Three LangGraph nodes over typed state:

- **gather_package** — connects to `metrc-mcp` as an MCP client over stdio, fetches the package by tag label and its lab results by package ID.
- **gather_regulations** — connects to `mcp-regulatory-cannabis` the same way and pulls the testing requirements (915 KAR 1:040 §7, 915 KAR 1:110 §5) with citations.
- **evaluate** — sends package, lab results, and regulations to Claude with a decision prompt. The response is parsed and validated against a Zod schema (`decision`, `reasoning`, `citations`, `unmet_requirements`); anything malformed fails loudly rather than flowing onward.

Failures at either gathering stage short-circuit to END with a readable error in state — no API call is spent evaluating incomplete inputs.

The interesting architectural property: the agent's data access is entirely mediated by MCP. The graph doesn't know METRC's REST shape or the regulation corpus format — it speaks tool calls, and the servers own their domains. Swapping the mock for a production METRC instance is an environment variable, not a code change.

## Running it

No METRC credentials are required: the agent ships with a small mock METRC instance (route-based, realistic v2 payload shapes) that `metrc-mcp` is pointed at via `METRC_BASE_URL`. See [metrc-mcp's README](https://github.com/AM253906/metrc-mcp#testing) for why the mock exists — METRC vendor sandbox access requires a training and agreement process.

```bash
npm install
```

Set the environment (see `.env.example`):

```
METRC_MCP_PATH=       # absolute path to metrc-mcp/dist/index.js (built)
REGULATORY_MCP_PATH=  # absolute path to mcp-regulatory-cannabis/build/index.js (built)
ANTHROPIC_API_KEY=    # for the evaluate node
```

Both servers must be built (`npm run build` in each) before the agent can spawn them.

Then:

```bash
npx tsx src/index.ts 1A4FF0100000022000000101   # distillate lot, tests on file
npx tsx src/index.ts 1A4FF0100000022000000102   # crude lot, on hold, no results
```

Output is the final graph state: package data, lab results, matched regulations, and the structured recommendation.

## What the two fixtures demonstrate

**Package `…102`** is the obvious hold: flagged `IsOnHold`, `LabTestingState: SubmittedForTesting`, empty results array. The agent holds it, citing 915 KAR 1:040 §7's requirement that all testing pass before packaging.

**Package `…101`** is the interesting one. METRC marks it `TestPassed`, and both lab results on file (potency, one residual solvent) pass. A naive check releases it. The agent holds it — reasoning that two analytes do not constitute the full panel 915 KAR 1:110 requires (microbials, mycotoxins, heavy metals, pesticides, full residual solvents), so passing state cannot be confirmed against the actual requirement.

That was not a scripted outcome. The fixture was written with an incomplete panel by accident, and the agent caught the gap between *METRC says passed* and *the regulation's definition of passed*. That distinction — state-field compliance versus actual-requirement compliance — is precisely the kind of discrepancy this pattern exists to surface, so the fixture stays as is.

The consequence: both fixtures currently resolve to `hold`, each for a different cited reason. A clean-release fixture (full passing panel) is the natural next addition.

## Design notes

- **Read-only by construction.** The agent only calls read tools; `metrc-mcp` additionally runs in its default read-only mode, so no code path can mutate a compliance record.
- **Structured output or nothing.** The model must return schema-valid JSON. Prose, markdown fences, or missing fields fail the run rather than producing an unvalidated recommendation.
- **Deterministic retrieval, bounded reasoning.** Regulation search terms are fixed (`testing`, all categories) because the agent's question never changes; only the evaluation varies per package. Deriving search terms from the lab results themselves (e.g., a solvent failure searching remediation rules) is deliberate future work.
- **This is decision support, not a decision-maker.** The output is a cited recommendation for a human compliance reviewer. Nothing here files, releases, or modifies anything.

## Related projects

- [metrc-mcp](https://github.com/AM253906/metrc-mcp) — MCP server for the METRC track-and-trace API (the system-of-record layer)
- [mcp-regulatory-cannabis](https://github.com/AM253906/mcp-regulatory-cannabis) — MCP server for Kentucky cannabis processing regulations (the knowledge layer)

## License

MIT