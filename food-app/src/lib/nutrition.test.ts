import { describe, expect, it } from "vitest";
import { MOCK_ANALYSIS } from "@/services/mock";
import {
  analysisFoodToEditable,
  calculateForWeight,
  recalculateItem,
  sumNutrients,
} from "@/lib/nutrition";

describe("nutrition calculations", () => {
  it("scales provider values deterministically by serving weight", () => {
    expect(calculateForWeight({
      calories: 200,
      protein: 10,
      carbohydrates: 30,
      sugar: 4,
      fat: 7,
      fibre: 5,
    }, 150)).toEqual({
      calories: 300,
      protein: 15,
      carbohydrates: 45,
      sugar: 6,
      fat: 10.5,
      fibre: 7.5,
    });
  });

  it("sums only confirmed nutrient values", () => {
    const items = MOCK_ANALYSIS.foods.slice(0, 2).map(analysisFoodToEditable);
    items[0].confirmedNutrients.calories = 123;
    expect(sumNutrients(items).calories).toBe(253.5);
  });

  it("preserves the original estimate when a user changes weight", () => {
    const original = analysisFoodToEditable(MOCK_ANALYSIS.foods[0]);
    const edited = recalculateItem(original, 200);

    expect(edited.aiEstimatedWeightGrams).toBe(165);
    expect(edited.originalNutrients).toEqual(original.originalNutrients);
    expect(edited.confirmedWeightGrams).toBe(200);
    expect(edited.confirmedNutrients.calories).toBe(330);
    expect(edited.userState).toBe("edited");
  });

  it("does not overwrite a manual nutrient override after weight changes", () => {
    const original = analysisFoodToEditable(MOCK_ANALYSIS.foods[0]);
    original.nutrientOverride = true;
    original.confirmedNutrients.calories = 410;
    const edited = recalculateItem(original, 200);
    expect(edited.confirmedNutrients.calories).toBe(410);
  });
});
