import { z } from "zod";

export const RecommendationSchema = z.object({
  decision: z.enum(["release", "hold"]),
  reasoning: z.string(),
  citations: z.array(z.string()),
  unmet_requirements: z.array(z.string()),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;