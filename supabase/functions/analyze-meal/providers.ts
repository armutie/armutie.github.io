import { geminiResponseJsonSchema, nutrientSchema, visionResultSchema, type VisionResult } from "./schemas.ts";

export type MealAnalysisInput = {
  requestId: string;
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
    public readonly code:
      | "timeout"
      | "malformed"
      | "refusal"
      | "unavailable"
      | "provider-configuration"
      | "provider-quota"
      | "no-match",
    message: string,
    public readonly status = 502,
  ) {
    super(message);
  }
}

const sensitiveDiagnosticKeys = new Set([
  "apikey",
  "authorization",
  "headers",
  "inlinedata",
  "imagedata",
  "base64image",
  "data",
  "userdata",
  "user",
  "email",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "secret",
]);

function sanitizeDiagnosticString(value: string) {
  return value
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, "[redacted-api-key]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/gi, "[redacted-image-data]");
}

export function sanitizeProviderDiagnostic(value: unknown): unknown {
  if (typeof value === "string") return sanitizeDiagnosticString(value);
  if (Array.isArray(value)) return value.map(sanitizeProviderDiagnostic);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (
        sensitiveDiagnosticKeys.has(normalizedKey)
        || normalizedKey.includes("authorization")
        || normalizedKey.includes("base64")
        || normalizedKey.includes("imagedata")
        || normalizedKey.includes("userdata")
      ) {
        return [key, "[redacted]"];
      }
      return [key, sanitizeProviderDiagnostic(entry)];
    }),
  );
}

type GeminiInteractionResponse = {
  status?: string;
  output_text?: string;
  steps?: Array<{
    type?: string;
    status?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
    error?: unknown;
  }>;
};

function interactionOutputText(payload: GeminiInteractionResponse) {
  if (typeof payload.output_text === "string" && payload.output_text.length > 0) {
    return payload.output_text;
  }

  const modelOutput = payload.steps
    ?.slice()
    .reverse()
    .find((step) => step.type === "model_output");
  const text = modelOutput?.content
    ?.filter((content) => content.type === "text" && typeof content.text === "string")
    .map((content) => content.text)
    .join("");
  return text || undefined;
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
      "For a follow-up question that is not tied to one food, use an empty relatedFoodTemporaryId string.",
      "The reference object is only an approximate visible scale cue; it cannot establish hidden depth or exact volume.",
      "Use short stable temporary IDs such as food-1. Return only the requested structured object.",
    ].join("\n");

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
            "Api-Revision": "2026-05-20",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.model,
            store: false,
            input: [
              { type: "text", text: prompt },
              {
                type: "image",
                data: input.base64Image,
                mime_type: input.mimeType,
              },
            ],
            response_format: {
              type: "text",
              mime_type: "application/json",
              schema: geminiResponseJsonSchema,
            },
          }),
        },
      );
      if (!response.ok) {
        const responseBody = await response.text();
        let parsedError: unknown;
        try {
          parsedError = JSON.parse(responseBody);
        } catch {
          parsedError = { unparsedErrorBody: responseBody };
        }
        console.error("Gemini request failed", JSON.stringify({
          requestId: input.requestId,
          httpStatus: response.status,
          response: sanitizeProviderDiagnostic(parsedError),
        }));
        if ([400, 401, 403, 404].includes(response.status)) {
          throw new ProviderError(
            "provider-configuration",
            "The vision provider rejected its server configuration.",
          );
        }
        if (response.status === 429) {
          throw new ProviderError(
            "provider-quota",
            "The vision provider quota is temporarily exhausted.",
            429,
          );
        }
        throw new ProviderError("unavailable", "The vision provider is temporarily unavailable.");
      }
      const payload = await response.json() as GeminiInteractionResponse;
      const failedStep = payload.steps?.find((step) => step.status === "failed" || step.error);
      if (payload.status === "failed" || failedStep) {
        console.error("Gemini interaction failed", JSON.stringify({
          requestId: input.requestId,
          httpStatus: response.status,
          response: sanitizeProviderDiagnostic(payload),
        }));
        throw new ProviderError("unavailable", "The vision provider could not complete the analysis.");
      }
      const text = interactionOutputText(payload);
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
