import {
  EMPTY_NUTRIENTS,
  type EditableMealItem,
  type FoodAnalysis,
  type Nutrients,
} from "@/domain";
import { createId } from "@/lib/utils";

const nutrientKeys = Object.keys(EMPTY_NUTRIENTS) as (keyof Nutrients)[];

export function calculateForWeight(per100g: Nutrients, weightGrams: number): Nutrients {
  const ratio = weightGrams / 100;
  return nutrientKeys.reduce<Nutrients>(
    (result, key) => {
      result[key] = Math.round(per100g[key] * ratio * 10) / 10;
      return result;
    },
    { ...EMPTY_NUTRIENTS },
  );
}

export function sumNutrients(items: Array<Pick<EditableMealItem, "confirmedNutrients">>): Nutrients {
  return items.reduce<Nutrients>(
    (total, item) => {
      nutrientKeys.forEach((key) => {
        total[key] += item.confirmedNutrients[key];
      });
      return total;
    },
    { ...EMPTY_NUTRIENTS },
  );
}

export function analysisFoodToEditable(food: FoodAnalysis): EditableMealItem {
  const nutrients = food.nutritionMatch
    ? calculateForWeight(food.nutritionMatch.nutrientsPer100g, food.estimatedWeightGrams)
    : { ...EMPTY_NUTRIENTS };

  return {
    id: createId("item"),
    temporaryId: food.temporaryId,
    aiDetectedName: food.name,
    confirmedName: food.name,
    aiEstimatedWeightGrams: food.estimatedWeightGrams,
    confirmedWeightGrams: food.estimatedWeightGrams,
    minimumWeightGrams: food.minimumWeightGrams,
    maximumWeightGrams: food.maximumWeightGrams,
    confidence: food.confidence,
    nutritionMatch: food.nutritionMatch,
    originalNutrients: { ...nutrients },
    confirmedNutrients: { ...nutrients },
    assumptions: [...food.assumptions],
    uncertaintyNotes: [...food.uncertainIngredients],
    userState: "detected",
    nutrientOverride: false,
  };
}

export function recalculateItem(item: EditableMealItem, weightGrams: number): EditableMealItem {
  const calculated =
    item.nutritionMatch && !item.nutrientOverride
      ? calculateForWeight(item.nutritionMatch.nutrientsPer100g, weightGrams)
      : item.confirmedNutrients;

  return {
    ...item,
    confirmedWeightGrams: weightGrams,
    confirmedNutrients: calculated,
    userState: item.userState === "added" ? "added" : "edited",
  };
}

export function confidenceLabel(confidence: number) {
  if (confidence >= 0.82) return "High confidence";
  if (confidence >= 0.62) return "Moderate confidence";
  return "Low confidence";
}
