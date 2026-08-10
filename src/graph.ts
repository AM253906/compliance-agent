import { StateGraph, START, END } from "@langchain/langgraph";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ComplianceState } from "./state.js";
import { parseToolJson } from "./mcp.js";
import { RecommendationSchema } from "./schema.js";
import { ChatAnthropic } from "@langchain/anthropic";

export function buildGraph(metrc: Client, regulatory:Client) {
    async function gatherPackage(state: typeof ComplianceState.State) {
        try {
        const pkgResult = await metrc.callTool({
            name: "get_package",
            arguments: { label: state.packageLabel },
        });
        if (pkgResult.isError) {
            const msg = (pkgResult.content as Array<{ text: string }>)[0]?.text;
            return { error: msg ?? "get_package failed" };
        }
        const pkg = parseToolJson<{ Id: number }>(pkgResult);

        const labsResult = await metrc.callTool({
            name: "get_lab_test_results",
            arguments: { packageId: pkg.Id },
        });
        const labs = parseToolJson<{ results: unknown[] }>(labsResult);

        return { packageData: pkg, labResults: labs.results, error: null };
        } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
        }
    }

    async function gatherRegulations(state: typeof ComplianceState.State) {
        try {
        const result = await regulatory.callTool({
            name: "search_regulations",
            arguments: { query: "testing", category: "all" },
        });

        const text = (result.content as Array<{ type: string; text: string }>)
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("\n");
        if (!text.trim()) return { error: "Regulation search returned no sections." };
            return { regulations: text };
        } catch (e) {
            return { error: e instanceof Error ? e.message : String(e) };
        }
    }

    async function evaluate(state: typeof ComplianceState.State) {
        try {
            const model = new ChatAnthropic({ model: "claude-sonnet-4-6", temperature: 0 });

            const prompt = `You are a cannabis compliance analyst reviewing a package for release under Kentucky regulations.

        PACKAGE:
        ${JSON.stringify(state.packageData, null, 2)}

        LAB RESULTS:
        ${JSON.stringify(state.labResults, null, 2)}

        GOVERNING REGULATIONS:
        ${state.regulations}

        Decide whether this package may be released or must be held. Cite the specific regulation sections that drive your decision. If required testing is incomplete or the package is on hold, the decision must be "hold".

        Respond with ONLY a JSON object, no markdown fences, matching:
        {"decision":"release"|"hold","reasoning":"...","citations":["915 KAR 1:040 §7"],"unmet_requirements":["..."]}`;

            const response = await model.invoke(prompt);
            const raw = String(response.content).replace(/```json|```/g, "").trim();
            const parsed = RecommendationSchema.parse(JSON.parse(raw));
            return { recommendation: parsed, error: null };
        } catch (e) {
            return { error: e instanceof Error ? e.message : String(e) };
        }
    }

    return new StateGraph(ComplianceState)
        .addNode("gather_package", gatherPackage)
        .addNode("gather_regulations", gatherRegulations)
        .addNode("evaluate", evaluate)
        .addEdge(START, "gather_package")
        .addConditionalEdges("gather_package", (s) => s.error ? END : "gather_regulations")
        .addConditionalEdges("gather_regulations", (s) => s.error ? END : "evaluate")
        .addEdge("evaluate", END)
        .compile();
}