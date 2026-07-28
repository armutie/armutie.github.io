import { describe, expect, it } from "vitest";
import {
  mealAnalysisResultSchema,
  mealDraftSchema,
  savedMealSchema,
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

  it("accepts PostgreSQL timestamps with explicit UTC offsets", () => {
    const result = savedMealSchema.safeParse({
      id: "96e5f8b7-5c92-45ab-95ba-6c78678d71ad",
      clientRequestId: crypto.randomUUID(),
      name: "Breakfast",
      mealType: "breakfast",
      consumedAt: "2026-07-28T09:15:00+00:00",
      notes: "",
      knownIngredients: "",
      reference: { type: "none" },
      imageRetention: "delete_after_analysis",
      imagePreviewUrl: null,
      imagePath: null,
      analysis: MOCK_ANALYSIS,
      items: MOCK_ANALYSIS.foods.map(analysisFoodToEditable),
      followUpAnswers: {},
      createdAt: "2026-07-28T09:16:00+00:00",
      updatedAt: "2026-07-28T09:16:00+00:00",
      aiProvider: "gemini",
      aiModel: "gemini-3.6-flash",
    });

    expect(result.success).toBe(true);
  });
});
