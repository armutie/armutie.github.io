import { z } from "zod";
import { selectedReferenceSchema } from "@/lib/reference-objects";

export const nutrientsSchema = z.object({
  calories: z.number().min(0).max(10000),
  protein: z.number().min(0).max(2000),
  carbohydrates: z.number().min(0).max(2000),
  sugar: z.number().min(0).max(2000),
  fat: z.number().min(0).max(2000),
  fibre: z.number().min(0).max(2000),
});
export type Nutrients = z.infer<typeof nutrientsSchema>;

export const EMPTY_NUTRIENTS: Nutrients = {
  calories: 0,
  protein: 0,
  carbohydrates: 0,
  sugar: 0,
  fat: 0,
  fibre: 0,
};

export const nutritionMatchSchema = z.object({
  source: z.enum(["usda", "manual", "mock"]),
  sourceRecordId: z.string().nullable(),
  description: z.string(),
  nutrientsPer100g: nutrientsSchema,
  uncertain: z.boolean(),
});
export type NutritionMatch = z.infer<typeof nutritionMatchSchema>;

export const foodAnalysisSchema = z.object({
  temporaryId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  estimatedWeightGrams: z.number().positive().max(5000),
  minimumWeightGrams: z.number().positive().max(5000),
  maximumWeightGrams: z.number().positive().max(5000),
  confidence: z.number().min(0).max(1),
  visibleIngredients: z.array(z.string()),
  uncertainIngredients: z.array(z.string()),
  assumptions: z.array(z.string()),
  nutritionMatch: nutritionMatchSchema.nullable(),
});

export const mealAnalysisResultSchema = z.object({
  analysisVersion: z.literal("1"),
  referenceObject: z.object({
    type: z.string(),
    detected: z.boolean(),
    confidence: z.number().min(0).max(1),
  }),
  foods: z.array(foodAnalysisSchema).min(1),
  followUpQuestions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      options: z.array(z.string()).min(2),
      relatedFoodTemporaryId: z.string().nullable(),
    }),
  ),
  overallConfidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
  imagePath: z.string().nullable().optional(),
});
export type MealAnalysisResult = z.infer<typeof mealAnalysisResultSchema>;
export type FoodAnalysis = z.infer<typeof foodAnalysisSchema>;

export const editableMealItemSchema = z.object({
  id: z.string(),
  temporaryId: z.string(),
  aiDetectedName: z.string(),
  confirmedName: z.string().trim().min(1, "Enter a food name.").max(160),
  aiEstimatedWeightGrams: z.number().positive(),
  confirmedWeightGrams: z.coerce.number().positive("Weight must be greater than zero.").max(5000),
  minimumWeightGrams: z.number().positive(),
  maximumWeightGrams: z.number().positive(),
  confidence: z.number().min(0).max(1),
  nutritionMatch: nutritionMatchSchema.nullable(),
  originalNutrients: nutrientsSchema,
  confirmedNutrients: nutrientsSchema,
  assumptions: z.array(z.string()),
  uncertaintyNotes: z.array(z.string()),
  userState: z.enum(["detected", "edited", "confirmed", "added"]),
  nutrientOverride: z.boolean(),
});
export type EditableMealItem = z.infer<typeof editableMealItemSchema>;

export const mealDraftSchema = z.object({
  clientRequestId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  consumedAt: z.string().datetime({ offset: true }),
  notes: z.string().max(1000),
  knownIngredients: z.string().max(1000),
  reference: selectedReferenceSchema,
  imageRetention: z.enum(["retain", "delete_after_analysis"]),
  imagePreviewUrl: z.string().nullable(),
  imagePath: z.string().nullable(),
  analysis: mealAnalysisResultSchema,
  items: z.array(editableMealItemSchema).min(1, "Add at least one food."),
  followUpAnswers: z.record(z.string(), z.string()),
});
export type MealDraft = z.infer<typeof mealDraftSchema>;

export const savedMealSchema = mealDraftSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  aiProvider: z.string(),
  aiModel: z.string(),
});
export type SavedMeal = z.infer<typeof savedMealSchema>;

export type DailyTargets = Nutrients;

export type Profile = {
  id: string;
  displayName: string;
  timeZone: string;
  dailyTargets: DailyTargets;
};

export type MealAnalysisInput = {
  image: Blob;
  imageDataUrl: string;
  fileName: string;
  mimeType: string;
  reference: z.infer<typeof selectedReferenceSchema>;
  mealType: MealDraft["mealType"];
  knownIngredients: string;
  imageRetention: MealDraft["imageRetention"];
};
