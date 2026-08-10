import { Annotation } from "@langchain/langgraph";
import { Recommendation } from "./schema.js";

export const ComplianceState = Annotation.Root({
  packageLabel: Annotation<string>,
  packageData: Annotation<Record<string, unknown> | null>,
  labResults: Annotation<unknown[]>,
  regulations: Annotation<string | null>,
  recommendation: Annotation<Recommendation | null>,
  error: Annotation<string | null>,
});