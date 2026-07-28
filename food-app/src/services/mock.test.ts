import { describe, expect, it, vi } from "vitest";
import { MockMealRepository, MockVisionProvider, MOCK_ANALYSIS } from "@/services/mock";
import { analysisFoodToEditable, recalculateItem, sumNutrients } from "@/lib/nutrition";
import type { MealAnalysisInput, MealDraft } from "@/domain";

function analysisInput(): MealAnalysisInput {
  const file = new File(["image"], "meal.jpg", { type: "image/jpeg" });
  return {
    image: file,
    imageDataUrl: "data:image/jpeg;base64,aW1hZ2U=",
    fileName: file.name,
    mimeType: file.type,
    reference: { type: "canadian_loonie" },
    mealType: "lunch",
    knownIngredients: "",
    imageRetention: "delete_after_analysis",
  };
}

describe("mock provider and workflow integration", () => {
  it("runs analysis, edits an item, saves once, and exposes the updated daily total", async () => {
    const vision = new MockVisionProvider(0);
    const repository = new MockMealRepository();
    const analysis = await vision.analyzeMeal(analysisInput());
    const items = analysis.foods.map(analysisFoodToEditable);
    items[0] = recalculateItem(items[0], 200);
    items[0].confirmedName = "Confirmed grilled chicken";

    const draft: MealDraft = {
      clientRequestId: crypto.randomUUID(),
      name: "Integration lunch",
      mealType: "lunch",
      consumedAt: new Date().toISOString(),
      notes: "",
      knownIngredients: "",
      reference: { type: "canadian_loonie" },
      imageRetention: "delete_after_analysis",
      imagePreviewUrl: null,
      imagePath: null,
      analysis,
      items,
      followUpAnswers: {},
    };

    const firstSave = await repository.saveMeal(draft);
    const retrySave = await repository.saveMeal(draft);
    const loaded = await repository.getMeal(firstSave.id);

    expect(retrySave.id).toBe(firstSave.id);
    expect(loaded?.items[0].aiDetectedName).toBe("Grilled chicken breast");
    expect(loaded?.items[0].confirmedName).toBe("Confirmed grilled chicken");
    expect(sumNutrients(loaded!.items).calories).toBeGreaterThan(500);
  });

  it("surfaces provider failure without inventing a result", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await expect(new MockVisionProvider(0).analyzeMeal(analysisInput())).rejects.toThrow("offline");
    online.mockRestore();
  });

  it("returns a schema-valid mock analysis", () => {
    expect(MOCK_ANALYSIS.foods.length).toBeGreaterThan(0);
    expect(MOCK_ANALYSIS.analysisVersion).toBe("1");
  });
});
