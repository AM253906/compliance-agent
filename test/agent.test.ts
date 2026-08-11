import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

/**
 * Known-answer tests, run against the full agent CLI.
 *
 * Layered the same way the rest of the stack is tested:
 *  - The plumbing test (unknown package) exercises both MCP servers and the
 *    graph's error short-circuit, and costs nothing: the conditional edge
 *    routes to END before the evaluate node, so no API call is made.
 *  - The decision tests require ANTHROPIC_API_KEY and are skipped without
 *    it. Both fixtures currently resolve to "hold" for different, citable
 *    reasons (see README: "What the two fixtures demonstrate").
 *
 * Requires METRC_MCP_PATH and REGULATORY_MCP_PATH in the environment,
 * same as running the agent normally.
 */

const HAS_KEY = Boolean(process.env.ANTHROPIC_API_KEY);

function runAgent(label: string): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", "src/index.ts", label], {
      shell: true,
      env: process.env,
    });
    let stdout = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout }));
  });
}

function parseFinalState(stdout: string): Record<string, any> {
  const start = stdout.indexOf("{");
  assert.notEqual(start, -1, `No JSON found in agent output:\n${stdout}`);
  return JSON.parse(stdout.slice(start));
}

describe("compliance-agent known-answer runs", () => {
  test("unknown package label short-circuits with a readable error and no recommendation", async () => {
    const { stdout } = await runAgent("1A4FF0100000022000000999");
    const state = parseFinalState(stdout);

    assert.ok(state.error, "expected error to be populated");
    assert.match(String(state.error), /404|not exist|not found/i);
    assert.ok(!state.recommendation, "no recommendation should be produced on error");
  });

  test(
    "package …101 (TestPassed, partial panel) is held for incomplete testing",
    { skip: !HAS_KEY && "ANTHROPIC_API_KEY not set" },
    async () => {
      const { stdout } = await runAgent("1A4FF0100000022000000101");
      const state = parseFinalState(stdout);

      assert.equal(state.error, null);
      assert.equal(state.recommendation?.decision, "hold");
      assert.ok(
        state.recommendation.citations.some((c: string) => c.includes("915 KAR")),
        "decision should cite a KAR section"
      );
    }
  );

  test(
    "package …102 (on hold, no results) is held",
    { skip: !HAS_KEY && "ANTHROPIC_API_KEY not set" },
    async () => {
      const { stdout } = await runAgent("1A4FF0100000022000000102");
      const state = parseFinalState(stdout);

      assert.equal(state.error, null);
      assert.equal(state.recommendation?.decision, "hold");
      assert.ok(state.recommendation.unmet_requirements.length > 0);
    }
  );
});
