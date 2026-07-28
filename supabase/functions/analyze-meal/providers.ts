import { geminiResponseJsonSchema, nutrientSchema, visionResultSchema, type VisionResult } from "./schemas.ts";

export type MealAnalysisInput = {
  base64Image: string;
  mimeType: string;
  mealType: string;
  knownIngredients: string;
  referenceDescription: string;
};

export interface MealVisionProvider {
  analyzeMeal(input: MealAnalysisInput): Promise<VisionResult>;
}

export type NutritionMatch = {
  source: "usda";
  sourceRecordId: string;
  description: string;
  nutrientsPer100g: {
    calories: number;
    protein: number;
    carbohydrates: number;
    sugar: number;
    fat: number;
    fibre: number;
  };
  uncertain: boolean;
};

export interface NutritionProvider {
  searchFoods(query: string): Promise<NutritionMatch[]>;
}

export class ProviderError extends Error {
  constructor(
    public readonly code: "timeout" | "malformed" | "refusal" | "unavailable" | "no-match",
    message: string,
    public readonly status = 502,
  ) {
    super(message);
  }
}

export class GeminiMealVisionProvider implements MealVisionProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async analyzeMeal(input: MealAnalysisInput): Promise<VisionResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const prompt = [
      "Analyze this meal photograph for a user-editable nutrition estimate.",
      `Meal context: ${input.mealType}.`,
      `Known ingredients supplied by the user: ${input.knownIngredients || "none"}.`,
      `Reference object context: ${input.referenceDescription}.`,
      "Identify only foods plausibly visible. Estimate each visible serving weight in grams and provide a wide, honest range.",
      "Do not claim to see invisible ingredients or exact oil, butter, sugar, cream, sauce, filling, density, or hidden food.",
      "List those unknowns as uncertain ingredients or assumptions. Ask only questions that would materially improve the result.",
      "The reference object is only an approximate visible scale cue; it cannot establish hidden depth or exact volume.",
      "Use short stable temporary IDs such as food-1. Return only the requested structured object.",
    ].join("\n");

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: prompt },
                { inlineData: { mimeType: input.mimeType, data: input.base64Image } },
              ],
            }],
            generationConfig: {
              responseMimeType: "application/json",
              responseJsonSchema: geminiResponseJsonSchema,
            },
          }),
        },
      );
      if (!response.ok) {
        const detail = await response.text();
        console.error("Gemini request failed", response.status, detail.slice(0, 500));
        throw new ProviderError("unavailable", "The vision provider is temporarily unavailable.");
      }
      const payload = await response.json();
      const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new ProviderError("refusal", "The vision provider could not identify food in this image.", 422);
      }
      let decoded: unknown;
      try {
        decoded = JSON.parse(text);
      } catch {
        throw new ProviderError("malformed", "The vision provider returned invalid structured data.");
      }
      const parsed = visionResultSchema.safeParse(decoded);
      if (!parsed.success) {
        console.error("Gemini schema validation failed", parsed.error.issues);
        throw new ProviderError("malformed", "The vision result was incomplete. Please retry.");
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ProviderError("timeout", "The vision provider took too long to respond.", 504);
      }
      throw new ProviderError("unavailable", "The vision provider could not be reached.");
    } finally {
      clearTimeout(timeout);
    }
  }
}

type UsdaFood = {
  fdcId: number;
  description: string;
  dataType?: string;
  foodNutrients?: Array<{
    nutrientId?: number;
    nutrientName?: string;
    nutrientNumber?: string;
    unitName?: string;
    value?: number;
  }>;
};

const nutrientIds = {
  calories: [1008, 2047, 2048],
  protein: [1003],
  carbohydrates: [1005],
  sugar: [2000, 1063],
  fat: [1004],
  fibre: [1079],
} as const;

function readNutrient(food: UsdaFood, ids: readonly number[]) {
  const nutrient = food.foodNutrients?.find((entry) => entry.nutrientId && ids.includes(entry.nutrientId));
  return Number(nutrient?.value ?? 0);
}

function isAmbiguousFood(description: string) {
  return /\b(curry|casserole|stew|restaurant|homemade|mixed|sauce|sandwich|pizza|bowl)\b/i.test(description);
}

export class UsdaFoodDataCentralProvider implements NutritionProvider {
  constructor(private readonly apiKey: string) {}

  async searchFoods(query: string): Promise<NutritionMatch[]> {
    const response = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(this.apiKey)}`,
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        pageSize: 8,
        dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
      }),
      },
    );
    if (!response.ok) {
      console.error("USDA request failed", response.status);
      throw new ProviderError("unavailable", "Nutrition data is temporarily unavailable.");
    }
    const payload = await response.json();
    const foods = (payload.foods ?? []) as UsdaFood[];
    return foods.map((food) => {
      const nutrients = nutrientSchema.parse({
        calories: readNutrient(food, nutrientIds.calories),
        protein: readNutrient(food, nutrientIds.protein),
        carbohydrates: readNutrient(food, nutrientIds.carbohydrates),
        sugar: readNutrient(food, nutrientIds.sugar),
        fat: readNutrient(food, nutrientIds.fat),
        fibre: readNutrient(food, nutrientIds.fibre),
      });
      return {
        source: "usda" as const,
        sourceRecordId: String(food.fdcId),
        description: food.description,
        nutrientsPer100g: nutrients,
        uncertain: isAmbiguousFood(query) || isAmbiguousFood(food.description),
      };
    });
  }
}

export function createVisionProvider(): MealVisionProvider {
  const provider = Deno.env.get("VISION_PROVIDER") ?? "gemini";
  if (provider !== "gemini") throw new Error(`Unsupported VISION_PROVIDER: ${provider}`);
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  return new GeminiMealVisionProvider(apiKey, Deno.env.get("VISION_MODEL") ?? "gemini-3.6-flash");
}

export function createNutritionProvider(): NutritionProvider {
  const provider = Deno.env.get("NUTRITION_PROVIDER") ?? "usda";
  if (provider !== "usda") throw new Error(`Unsupported NUTRITION_PROVIDER: ${provider}`);
  const apiKey = Deno.env.get("USDA_API_KEY");
  if (!apiKey) throw new Error("USDA_API_KEY is not configured.");
  return new UsdaFoodDataCentralProvider(apiKey);
}
