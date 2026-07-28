import { describe, expect, it } from "vitest";
import {
  mealAnalysisResultSchema,
  mealDraftSchema,
} from "@/domain";
import { MOCK_ANALYSIS } from "@/services/mock";
import { analysisFoodToEditable } from "@/lib/nutrition";

describe("runtime validation", () => {
  it("accepts the versioned structured analysis", () => {
    expect(mealAnalysisResultSchema.parse(MOCK_ANALYSIS).analysisVersion).toBe("1");
  });

  it("rejects malformed AI confidence and empty foods", () => {
    const malformed = {
      ...MOCK_ANALYSIS,
      overallConfidence: 1.5,
      foods: [],
    };
    expect(mealAnalysisResultSchema.safeParse(malformed).success).toBe(false);
  });

  it("validates the complete meal form before persistence", () => {
    const result = mealDraftSchema.safeParse({
      clientRequestId: crypto.randomUUID(),
      name: "",
      mealType: "lunch",
      consumedAt: new Date().toISOString(),
      notes: "",
      knownIngredients: "",
      reference: { type: "none" },
      imageRetention: "delete_after_analysis",
      imagePreviewUrl: null,
      imagePath: null,
      analysis: MOCK_ANALYSIS,
      items: MOCK_ANALYSIS.foods.map(analysisFoodToEditable),
      followUpAnswers: {},
    });
    expect(result.success).toBe(false);
  });
});
