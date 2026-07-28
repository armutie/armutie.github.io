import { z } from "npm:zod@4.0.15";

export const nutrientSchema = z.object({
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbohydrates: z.number().min(0),
  sugar: z.number().min(0),
  fat: z.number().min(0),
  fibre: z.number().min(0),
}).strict();

export const visionFoodSchema = z.object({
  temporaryId: z.string().min(1),
  name: z.string().min(1).max(160),
  description: z.string().max(500),
  estimatedWeightGrams: z.number().positive().max(5000),
  minimumWeightGrams: z.number().positive().max(5000),
  maximumWeightGrams: z.number().positive().max(5000),
  confidence: z.number().min(0).max(1),
  visibleIngredients: z.array(z.string().max(100)).max(30),
  uncertainIngredients: z.array(z.string().max(100)).max(30),
  assumptions: z.array(z.string().max(300)).max(20),
}).strict().refine((food) => food.minimumWeightGrams <= food.estimatedWeightGrams, {
  message: "The minimum weight must not exceed the estimate.",
}).refine((food) => food.estimatedWeightGrams <= food.maximumWeightGrams, {
  message: "The estimate must not exceed the maximum weight.",
});

export const visionResultSchema = z.object({
  analysisVersion: z.literal("1"),
  referenceObject: z.object({
    type: z.string(),
    detected: z.boolean(),
    confidence: z.number().min(0).max(1),
  }).strict(),
  foods: z.array(visionFoodSchema).min(1).max(30),
  followUpQuestions: z.array(z.object({
    id: z.string(),
    question: z.string().max(300),
    options: z.array(z.string().max(100)).min(2).max(8),
    relatedFoodTemporaryId: z.string().nullable(),
  }).strict()).max(8),
  overallConfidence: z.number().min(0).max(1),
  warnings: z.array(z.string().max(300)).max(20),
}).strict();

export type VisionResult = z.infer<typeof visionResultSchema>;

export const analyzeRequestSchema = z.object({
  action: z.literal("analyze").optional(),
  imageDataUrl: z.string().startsWith("data:image/").max(4_000_000),
  fileName: z.string().max(160),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  reference: z.object({
    type: z.enum([
      "none",
      "canadian_loonie",
      "canadian_toonie",
      "iphone_15",
      "iphone_15_pro",
      "iphone_15_pro_max",
      "custom",
    ]),
    customLabel: z.string().max(80).optional(),
    customWidthMm: z.number().positive().max(1000).optional(),
  }),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  knownIngredients: z.string().max(1000),
  imageRetention: z.enum(["retain", "delete_after_analysis"]),
});

export const nutritionSearchRequestSchema = z.object({
  action: z.literal("nutrition-search"),
  query: z.string().trim().min(2).max(160),
});

export const geminiResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "analysisVersion",
    "referenceObject",
    "foods",
    "followUpQuestions",
    "overallConfidence",
    "warnings",
  ],
  properties: {
    analysisVersion: { type: "string", enum: ["1"] },
    referenceObject: {
      type: "object",
      additionalProperties: false,
      required: ["type", "detected", "confidence"],
      properties: {
        type: { type: "string" },
        detected: { type: "boolean" },
        confidence: { type: "number" },
      },
    },
    foods: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "temporaryId",
          "name",
          "description",
          "estimatedWeightGrams",
          "minimumWeightGrams",
          "maximumWeightGrams",
          "confidence",
          "visibleIngredients",
          "uncertainIngredients",
          "assumptions",
        ],
        properties: {
          temporaryId: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          estimatedWeightGrams: { type: "number" },
          minimumWeightGrams: { type: "number" },
          maximumWeightGrams: { type: "number" },
          confidence: { type: "number" },
          visibleIngredients: { type: "array", items: { type: "string" } },
          uncertainIngredients: { type: "array", items: { type: "string" } },
          assumptions: { type: "array", items: { type: "string" } },
        },
      },
    },
    followUpQuestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "question", "options", "relatedFoodTemporaryId"],
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          relatedFoodTemporaryId: { type: "string" },
        },
      },
    },
    overallConfidence: { type: "number" },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;
