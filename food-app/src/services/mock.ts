import type {
  AuthService,
  AppServices,
  MealRepository,
  MealVisionProvider,
  NutritionProvider,
} from "@/services/interfaces";
import {
  mealAnalysisResultSchema,
  type MealAnalysisInput,
  type MealAnalysisResult,
  type MealDraft,
  type NutritionMatch,
  type Profile,
  type SavedMeal,
} from "@/domain";
import { analysisFoodToEditable } from "@/lib/nutrition";

const STORAGE_KEY = "plateful-demo-meals-v2";
const PROFILE_KEY = "plateful-demo-profile-v1";
const DEMO_USER_ID = "5ca5b2e5-ec26-4554-831b-8f9a4f5ef33e";

export const MOCK_NUTRITION_MATCHES: NutritionMatch[] = [
  {
    source: "mock",
    sourceRecordId: "171077",
    description: "Chicken breast, grilled, skinless",
    uncertain: false,
    nutrientsPer100g: {
      calories: 165,
      protein: 31,
      carbohydrates: 0,
      sugar: 0,
      fat: 3.6,
      fibre: 0,
    },
  },
  {
    source: "mock",
    sourceRecordId: "168482",
    description: "Sweet potato, roasted",
    uncertain: false,
    nutrientsPer100g: {
      calories: 90,
      protein: 2,
      carbohydrates: 20.7,
      sugar: 6.5,
      fat: 0.2,
      fibre: 3.3,
    },
  },
  {
    source: "mock",
    sourceRecordId: "170379",
    description: "Broccoli, cooked",
    uncertain: false,
    nutrientsPer100g: {
      calories: 35,
      protein: 2.4,
      carbohydrates: 7.2,
      sugar: 1.4,
      fat: 0.4,
      fibre: 3.3,
    },
  },
  {
    source: "mock",
    sourceRecordId: "demo-herb-yogurt",
    description: "Yogurt sauce with herbs",
    uncertain: true,
    nutrientsPer100g: {
      calories: 98,
      protein: 4.2,
      carbohydrates: 5.1,
      sugar: 4.3,
      fat: 6.9,
      fibre: 0.2,
    },
  },
];

export const MOCK_ANALYSIS: MealAnalysisResult = mealAnalysisResultSchema.parse({
  analysisVersion: "1",
  referenceObject: {
    type: "canadian_loonie",
    detected: true,
    confidence: 0.92,
  },
  foods: [
    {
      temporaryId: "food-1",
      name: "Grilled chicken breast",
      description: "Sliced skinless chicken breast with visible herbs",
      estimatedWeightGrams: 165,
      minimumWeightGrams: 135,
      maximumWeightGrams: 205,
      confidence: 0.87,
      visibleIngredients: ["chicken breast", "dried herbs"],
      uncertainIngredients: ["cooking oil", "salt"],
      assumptions: ["Oil absorbed during cooking cannot be determined from the photograph."],
      nutritionMatch: MOCK_NUTRITION_MATCHES[0],
    },
    {
      temporaryId: "food-2",
      name: "Roasted sweet potato",
      description: "Cubed sweet potato with browned edges",
      estimatedWeightGrams: 145,
      minimumWeightGrams: 115,
      maximumWeightGrams: 180,
      confidence: 0.84,
      visibleIngredients: ["sweet potato", "herbs"],
      uncertainIngredients: ["cooking oil"],
      assumptions: ["The amount of oil used for roasting is not visible."],
      nutritionMatch: MOCK_NUTRITION_MATCHES[1],
    },
    {
      temporaryId: "food-3",
      name: "Steamed broccoli",
      description: "Cooked broccoli florets",
      estimatedWeightGrams: 105,
      minimumWeightGrams: 80,
      maximumWeightGrams: 135,
      confidence: 0.9,
      visibleIngredients: ["broccoli"],
      uncertainIngredients: [],
      assumptions: ["No added butter or sauce is assumed."],
      nutritionMatch: MOCK_NUTRITION_MATCHES[2],
    },
    {
      temporaryId: "food-4",
      name: "Herb yogurt sauce",
      description: "Pale green yogurt-based sauce",
      estimatedWeightGrams: 48,
      minimumWeightGrams: 35,
      maximumWeightGrams: 65,
      confidence: 0.61,
      visibleIngredients: ["yogurt", "green herbs"],
      uncertainIngredients: ["mayonnaise", "oil", "sweetener"],
      assumptions: ["The sauce base and fat percentage cannot be confirmed visually."],
      nutritionMatch: MOCK_NUTRITION_MATCHES[3],
    },
  ],
  followUpQuestions: [
    {
      id: "sauce-base",
      question: "What is the green sauce mainly made from?",
      options: ["Greek yogurt", "Regular yogurt", "Mayonnaise", "Other", "Not sure"],
      relatedFoodTemporaryId: "food-4",
    },
  ],
  overallConfidence: 0.81,
  warnings: [
    "Added oil, salt, and the exact sauce recipe cannot be measured from the photograph.",
    "The loonie helps with visible scale but does not reveal food depth or density.",
  ],
  imagePath: null,
});

function demoImageUrl() {
  return `${import.meta.env.BASE_URL}demo-meal.png`;
}

function seedMeal(offsetDays: number, mealType: MealDraft["mealType"], name: string): SavedMeal {
  const consumed = new Date();
  consumed.setDate(consumed.getDate() + offsetDays);
  consumed.setHours(mealType === "lunch" ? 12 : mealType === "breakfast" ? 8 : 18, 30, 0, 0);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    clientRequestId: crypto.randomUUID(),
    name,
    mealType,
    consumedAt: consumed.toISOString(),
    notes: offsetDays === 0 ? "Quick lunch after class." : "",
    knownIngredients: "",
    reference: { type: "canadian_loonie" },
    imageRetention: "retain",
    imagePreviewUrl: demoImageUrl(),
    imagePath: null,
    analysis: MOCK_ANALYSIS,
    items: MOCK_ANALYSIS.foods.map(analysisFoodToEditable).map((item) => ({
      ...item,
      userState: "confirmed" as const,
    })),
    followUpAnswers: { "sauce-base": "Greek yogurt" },
    createdAt: now,
    updatedAt: now,
    aiProvider: "mock",
    aiModel: "demo-vision-v1",
  };
}

export class MockVisionProvider implements MealVisionProvider {
  constructor(private readonly delayMs = 1300) {}

  async analyzeMeal(input: MealAnalysisInput) {
    void input;
    await new Promise((resolve) => window.setTimeout(resolve, this.delayMs));
    if (!navigator.onLine) throw new Error("offline");
    return structuredClone(MOCK_ANALYSIS);
  }
}

export class MockNutritionProvider implements NutritionProvider {
  async searchFoods(query: string) {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    const normalized = query.toLowerCase();
    const matches = MOCK_NUTRITION_MATCHES.filter((match) =>
      match.description.toLowerCase().includes(normalized),
    );
    return structuredClone(matches.length ? matches : MOCK_NUTRITION_MATCHES.slice(0, 3));
  }
}

export class MockMealRepository implements MealRepository {
  private readMeals(): SavedMeal[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as SavedMeal[];
    const seeded = [
      seedMeal(0, "lunch", "Herb chicken plate"),
      seedMeal(-1, "dinner", "Roasted dinner plate"),
      seedMeal(-2, "lunch", "Chicken and vegetables"),
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  private writeMeals(meals: SavedMeal[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
  }

  async listMeals() {
    return this.readMeals().sort((a, b) => b.consumedAt.localeCompare(a.consumedAt));
  }

  async getMeal(id: string) {
    return this.readMeals().find((meal) => meal.id === id) ?? null;
  }

  async saveMeal(draft: MealDraft) {
    const meals = this.readMeals();
    const existing = meals.find((meal) => meal.clientRequestId === draft.clientRequestId);
    if (existing) return existing;

    const now = new Date().toISOString();
    const meal: SavedMeal = {
      ...structuredClone(draft),
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      aiProvider: "mock",
      aiModel: "demo-vision-v1",
    };
    this.writeMeals([meal, ...meals]);
    return meal;
  }

  async updateMeal(meal: SavedMeal) {
    const updated = { ...meal, updatedAt: new Date().toISOString() };
    this.writeMeals(this.readMeals().map((entry) => (entry.id === meal.id ? updated : entry)));
    return updated;
  }

  async deleteMeal(id: string) {
    this.writeMeals(this.readMeals().filter((meal) => meal.id !== id));
  }

  async getProfile(): Promise<Profile> {
    const stored = localStorage.getItem(PROFILE_KEY);
    if (stored) return JSON.parse(stored) as Profile;
    const profile: Profile = {
      id: DEMO_USER_ID,
      displayName: "Demo cook",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto",
      dailyTargets: {
        calories: 2200,
        protein: 130,
        carbohydrates: 260,
        sugar: 70,
        fat: 75,
        fibre: 30,
      },
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return profile;
  }

  async updateProfile(profile: Profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return profile;
  }
}

class MockAuthService implements AuthService {
  async getUser() {
    return { id: DEMO_USER_ID, email: "demo@plateful.local" };
  }
  async sendMagicLink(email: string) { void email; }
  async signOut() {}
  onAuthStateChange(listener: Parameters<AuthService["onAuthStateChange"]>[0]) {
    void listener;
    return () => undefined;
  }
}

export function createMockServices(): AppServices {
  return {
    mode: "demo",
    vision: new MockVisionProvider(),
    nutrition: new MockNutritionProvider(),
    meals: new MockMealRepository(),
    auth: new MockAuthService(),
  };
}
